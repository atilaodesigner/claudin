import type { QualityPreset } from '../save/SaveService';

export interface QualityLevel {
  name: string;
  maxDpr: number;
  minScale: number;
  maxScale: number;
  post: boolean;
  bloom: boolean;
  msaa: number;
  shadows: boolean;
  shadowMap: number;
  particles: number;
  renderDistance: number;
  npcDensity: number;
}

export const QUALITY_LEVELS: readonly QualityLevel[] = [
  { name: 'Mínima', maxDpr: 1, minScale: 0.6, maxScale: 0.8, post: false, bloom: false, msaa: 0, shadows: false, shadowMap: 512, particles: 0.35, renderDistance: 220, npcDensity: 0.5 },
  { name: 'Baixa', maxDpr: 1.25, minScale: 0.7, maxScale: 1, post: false, bloom: false, msaa: 0, shadows: true, shadowMap: 1024, particles: 0.55, renderDistance: 300, npcDensity: 0.7 },
  { name: 'Média', maxDpr: 1.6, minScale: 0.75, maxScale: 1, post: true, bloom: true, msaa: 0, shadows: true, shadowMap: 1024, particles: 0.8, renderDistance: 420, npcDensity: 1 },
  { name: 'Alta', maxDpr: 2, minScale: 0.85, maxScale: 1, post: true, bloom: true, msaa: 4, shadows: true, shadowMap: 2048, particles: 1, renderDistance: 600, npcDensity: 1 },
];

export interface DeviceProfile {
  mobile: boolean;
  lowEnd: boolean;
  multiDraw: boolean;
  initialLevel: number;
}

export function detectDevice(multiDraw: boolean, software = false): DeviceProfile {
  const ua = navigator.userAgent;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const lowEnd = mem <= 3 || cores <= 4;
  let initialLevel = mobile ? (lowEnd ? 1 : 2) : 3;
  if (!multiDraw) initialLevel = Math.min(initialLevel, 1);
  const forced = new URLSearchParams(location.search).get('quality');
  if (software) initialLevel = 0;
  if (forced !== null && /^[0-3]$/.test(forced)) initialLevel = Number(forced);
  return { mobile, lowEnd, multiDraw, initialLevel };
}

/**
 * Watches frame time and adapts resolution, effects, shadows, particles and draw
 * distance. Resolution moves in small steps (not noticeable); expensive toggles
 * (shadows → shader recompile) wait for a calm moment (menu, results)... unless the
 * device is clearly drowning mid-run (far below the target or hitching again and again):
 * then the level drops right away, one recompile instead of a whole stage of stutter.
 */
export class AdaptiveQualityManager {
  level: number;
  scale: number;
  private avgFrame = 1 / 60;
  private overBudget = 0;
  private underBudget = 0;
  private sinceChange = 0;
  /** Long frames (≥100 ms) recently, decaying: repeated hitches count as overload. */
  private hitches = 0;
  /** Time spent far over budget (below ~2/3 of the target fps). */
  private drowning = 0;
  private sinceEmergency = 99;
  preset: QualityPreset = 'auto';
  targetFps = 60;
  /** Level change waiting for a hitch-safe moment. */
  pendingLevel: number | null = null;
  onApply: ((q: QualityLevel, scale: number, levelChanged: boolean) => void) | null = null;
  fps = 60;

  constructor(private readonly profile: DeviceProfile) {
    this.level = profile.initialLevel;
    this.scale = QUALITY_LEVELS[this.level]!.maxScale;
  }

  /** Upper bound for the level (online rooms keep the frame light), null = none. */
  private cap: number | null = null;

  get current(): QualityLevel {
    return QUALITY_LEVELS[this.cap === null ? this.level : Math.min(this.level, this.cap)] as QualityLevel;
  }

  /** Limits (or releases, with null) the quality level; applies right away. */
  setCap(cap: number | null): void {
    if (cap === this.cap) return;
    this.cap = cap;
    this.scale = Math.min(this.scale, this.current.maxScale);
    this.onApply?.(this.current, this.scale, true);
  }

  setPreset(p: QualityPreset): void {
    this.preset = p;
    const forced = p === 'baixa' ? 1 : p === 'media' ? 2 : p === 'alta' ? 3 : null;
    if (forced !== null) {
      this.level = forced;
      this.scale = this.current.maxScale;
      this.onApply?.(this.current, this.scale, true);
    } else {
      this.level = this.profile.initialLevel;
      this.scale = this.current.maxScale;
      this.onApply?.(this.current, this.scale, true);
    }
  }

  /** Seconds of uninterrupted play: hitches right after a run starts are warm-up, not overload. */
  private playTime = 0;

  /**
   * Call every frame with the raw (unclamped) frame delta. `canChangeLevel`: a calm moment
   * for expensive switches; `inPlay`: the player is in control, so overload hurts right now.
   */
  sample(rawDt: number, canChangeLevel: boolean, inPlay = false): void {
    if (rawDt <= 0) return;
    const realDt = Math.min(rawDt, 0.25);
    this.sinceEmergency += realDt;
    this.playTime = inPlay ? this.playTime + realDt : 0;
    this.hitches = Math.max(0, this.hitches - realDt * 0.25);
    // a long frame is a hitch (a gap of seconds is a hidden tab or a breakpoint, not the GPU);
    // a stall, or a run's warm-up (first draws compile shaders), says nothing about the steady
    // cost, so it doesn't feed the average either
    if (rawDt > 0.1) {
      const warmingUp = inPlay && this.playTime <= 4;
      if (rawDt < 2 && !warmingUp && inPlay) this.hitches += 1;
      if (rawDt > 0.25 || warmingUp) return;
    }
    this.avgFrame += (realDt - this.avgFrame) * 0.05;
    this.fps = 1 / this.avgFrame;
    this.sinceChange += realDt;
    if (this.pendingLevel !== null && canChangeLevel) {
      this.level = this.pendingLevel;
      this.pendingLevel = null;
      this.scale = Math.min(this.scale, this.current.maxScale);
      this.onApply?.(this.current, this.scale, true);
      return;
    }
    if (this.preset !== 'auto') return;
    const budget = 1 / this.targetFps;
    // drowning: well below the target for seconds, or hitching over and over
    if (inPlay && this.playTime > 4 && this.avgFrame > budget * 1.6) this.drowning += realDt;
    else this.drowning = Math.max(0, this.drowning - realDt * 2);
    if (inPlay && (this.drowning > 2.5 || this.hitches >= 4) && this.sinceEmergency > 8) {
      this.drowning = 0;
      this.hitches = 0;
      this.sinceEmergency = 0;
      this.sinceChange = 0;
      const q = this.current;
      const effective = this.cap === null ? this.level : Math.min(this.level, this.cap);
      if (this.scale > q.minScale + 0.001) {
        // big step down in resolution first: free and instant
        this.scale = Math.max(q.minScale, this.scale - 0.15);
        this.onApply?.(q, this.scale, false);
      } else if (effective > 0) {
        this.pendingLevel = null;
        this.level = effective - 1;
        this.scale = Math.min(this.scale, this.current.maxScale);
        this.onApply?.(this.current, this.scale, true);
      }
      return;
    }
    if (this.avgFrame > budget * 1.18) {
      this.overBudget += realDt;
      this.underBudget = 0;
    } else if (this.avgFrame < budget * 1.04) {
      this.underBudget += realDt;
      this.overBudget = Math.max(0, this.overBudget - realDt);
    } else {
      this.overBudget = Math.max(0, this.overBudget - realDt * 0.5);
    }

    if (this.overBudget > 1.2 && this.sinceChange > 1) {
      this.overBudget = 0;
      this.sinceChange = 0;
      const q = this.current;
      if (this.scale > q.minScale + 0.001) {
        this.scale = Math.max(q.minScale, this.scale - 0.05);
        this.onApply?.(q, this.scale, false);
      } else if (this.level > 0) {
        this.pendingLevel = this.level - 1;
      }
    } else if (this.underBudget > 6 && this.sinceChange > 4) {
      this.underBudget = 0;
      this.sinceChange = 0;
      const q = this.current;
      if (this.scale < q.maxScale - 0.001) {
        this.scale = Math.min(q.maxScale, this.scale + 0.05);
        this.onApply?.(q, this.scale, false);
      } else if (this.level < this.profile.initialLevel) {
        this.pendingLevel = this.level + 1;
      }
    }
  }
}
