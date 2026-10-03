import { BALANCE } from '../config/gameBalance';

const C = BALANCE.combo;

export interface ComboRegisterResult {
  count: number;
  milestone: number | null;
  frenzyStarted: boolean;
}

export interface ComboUpdateResult {
  endedWith: number;
  frenzyEnded: boolean;
}

/** ABDUCTION COMBO: chained absorptions inside a shrinking time window. */
export class ComboSystem {
  count = 0;
  best = 0;
  timer = 0;
  window: number = C.baseWindow;
  frenzyTimer = 0;
  extraWindow = 0;
  /** Frenzy duration multiplier (FRENESI PROLONGADO, TEMPO-BALA, Frenesi Estendido). */
  frenzyMult = 1;
  private nextFrenzyAt: number = C.frenzyAt;
  private readonly updateResult: ComboUpdateResult = { endedWith: 0, frenzyEnded: false };

  reset(): void {
    this.count = 0;
    this.best = 0;
    this.timer = 0;
    this.frenzyTimer = 0;
    this.nextFrenzyAt = C.frenzyAt;
  }

  get active(): boolean {
    return this.count > 0 && this.timer > 0;
  }

  get frenzy(): boolean {
    return this.frenzyTimer > 0;
  }

  get multiplier(): number {
    return Math.min(C.maxMultiplier, 1 + this.count * C.multiplierPerCount);
  }

  get timerFraction(): number {
    return this.window > 0 ? Math.max(0, this.timer / this.window) : 0;
  }

  /** Register one absorption. Heavier objects extend the window. */
  register(tier: number): ComboRegisterResult {
    this.count += 1;
    if (this.count > this.best) this.best = this.count;
    this.window = Math.min(C.maxWindow, C.baseWindow + tier * C.windowPerTier) + this.extraWindow;
    if (this.frenzy) this.window *= 1.6;
    this.timer = this.window;

    let milestone: number | null = null;
    for (const m of C.milestones) {
      if (this.count === m) milestone = m;
    }
    let frenzyStarted = false;
    if (this.count >= this.nextFrenzyAt) {
      this.nextFrenzyAt = this.count + C.frenzyEvery;
      frenzyStarted = !this.frenzy;
      this.frenzyTimer = C.frenzyDuration * this.frenzyMult;
    }
    return { count: this.count, milestone, frenzyStarted };
  }

  extendFrenzy(seconds: number): void {
    if (this.frenzy) this.frenzyTimer = Math.min(C.frenzyDuration * this.frenzyMult * 1.5, this.frenzyTimer + seconds);
  }

  forceFrenzy(): void {
    this.frenzyTimer = C.frenzyDuration * this.frenzyMult;
  }

  update(dt: number): ComboUpdateResult {
    const r = this.updateResult;
    r.endedWith = 0;
    r.frenzyEnded = false;
    if (this.frenzyTimer > 0) {
      this.frenzyTimer -= dt;
      if (this.frenzyTimer <= 0) {
        this.frenzyTimer = 0;
        r.frenzyEnded = true;
      }
    }
    if (this.count > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        r.endedWith = this.count;
        this.count = 0;
        this.timer = 0;
        this.nextFrenzyAt = C.frenzyAt;
      }
    }
    return r;
  }
}
