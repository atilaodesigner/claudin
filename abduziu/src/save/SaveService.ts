import type { MetaNodeId } from '../config/meta';
import type { SaveBackend } from './SaveBackend';

export type QualityPreset = 'auto' | 'baixa' | 'media' | 'alta';

export interface Settings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  haptics: boolean;
  reduceShake: boolean;
  reduceFlashes: boolean;
  quality: QualityPreset;
  uiScale: number;
  skipIntro: boolean;
  showFps: boolean;
}

export interface DexEntry {
  count: number;
  firstCaptureAt: number;
  bestCombo: number;
}

export interface Records {
  bestScore: number;
  bestCombo: number;
  bestMassKg: number;
  bestAlert: number;
  fastestMaxAlert: number | null;
  totalAbducted: number;
  totalRuns: number;
  jetsCaptured: number;
  bossesDefeated: number;
  longestRun: number;
}

export interface DailyResult {
  bestScore: number;
  attempts: number;
}

export interface CityProgress {
  stars: [boolean, boolean, boolean];
  bestScore: number;
  clears: number;
  plays: number;
}

export interface RankData {
  rp: number;
  peak: number;
  games: number;
  week: string;
  weekBest: number;
  lastDelta: number;
}

export interface RunSummary {
  date: number;
  score: number;
  objects: number;
  massKg: number;
  bestCombo: number;
  maxAlert: number;
  duration: number;
  cores: number;
  extracted: boolean;
  daily: boolean;
  mode?: string;
  city?: string;
  rpDelta?: number;
}

export interface SaveData {
  version: number;
  cores: number;
  totalCoresEarned: number;
  meta: Partial<Record<MetaNodeId, number>>;
  dex: Record<string, DexEntry>;
  records: Records;
  settings: Settings;
  daily: Record<string, DailyResult>;
  history: RunSummary[];
  campaign: Record<string, CityProgress>;
  rank: RankData;
  last: { mode: string; city: string };
  flags: { tutorialDone: boolean; introSeen: boolean; firstRunDone: boolean };
}

export const SAVE_VERSION = 1;
const SAVE_KEY = 'ovni-brasil:save';

export function defaultSettings(): Settings {
  return {
    masterVolume: 0.9,
    musicVolume: 0.6,
    sfxVolume: 0.9,
    haptics: true,
    reduceShake: false,
    reduceFlashes: false,
    quality: 'auto',
    uiScale: 1,
    skipIntro: false,
    showFps: false,
  };
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    cores: 0,
    totalCoresEarned: 0,
    meta: {},
    dex: {},
    records: {
      bestScore: 0,
      bestCombo: 0,
      bestMassKg: 0,
      bestAlert: 0,
      fastestMaxAlert: null,
      totalAbducted: 0,
      totalRuns: 0,
      jetsCaptured: 0,
      bossesDefeated: 0,
      longestRun: 0,
    },
    settings: defaultSettings(),
    daily: {},
    history: [],
    campaign: {},
    rank: { rp: 0, peak: 0, games: 0, week: '', weekBest: 0, lastDelta: 0 },
    last: { mode: 'campanha', city: 'nova_aurora' },
    flags: { tutorialDone: false, introSeen: false, firstRunDone: false },
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Deep-merges persisted data onto defaults so older/corrupted saves never crash the game. */
function mergeDefaults<T>(defaults: T, loaded: unknown): T {
  if (!isObject(defaults) || !isObject(loaded)) {
    if (loaded === undefined) return defaults;
    if (typeof loaded === typeof defaults || (defaults === null && typeof loaded === 'number')) return loaded as T;
    return defaults;
  }
  const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
  for (const [k, v] of Object.entries(loaded)) {
    const d = (defaults as Record<string, unknown>)[k];
    if (d === undefined) out[k] = v;
    else if (isObject(d)) out[k] = Object.keys(d).length === 0 ? (isObject(v) ? v : d) : mergeDefaults(d, v);
    else if (Array.isArray(d)) out[k] = Array.isArray(v) ? v : d;
    else out[k] = mergeDefaults(d, v);
  }
  return out as T;
}

export function migrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (!isObject(raw)) return base;
  const merged = mergeDefaults(base, raw);
  merged.version = SAVE_VERSION;
  if (!Number.isFinite(merged.cores) || merged.cores < 0) merged.cores = 0;
  if (merged.history.length > 30) merged.history = merged.history.slice(-30);
  return merged;
}

export class SaveService {
  private data: SaveData;
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly backend: SaveBackend) {
    this.data = this.load();
  }

  get backendName(): string {
    return this.backend.name;
  }

  private load(): SaveData {
    const raw = this.backend.load(SAVE_KEY);
    if (!raw) return defaultSave();
    try {
      return migrate(JSON.parse(raw));
    } catch {
      return defaultSave();
    }
  }

  get(): SaveData {
    return this.data;
  }

  update(mutator: (d: SaveData) => void, immediate = false): void {
    mutator(this.data);
    this.dirty = true;
    if (immediate) this.flush();
    else this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, 400);
  }

  flush(): boolean {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (!this.dirty) return true;
    const ok = this.backend.save(SAVE_KEY, JSON.stringify(this.data));
    if (ok) this.dirty = false;
    return ok;
  }

  reset(): void {
    this.data = defaultSave();
    this.backend.remove(SAVE_KEY);
    this.dirty = false;
  }

  export(): string {
    return JSON.stringify(this.data);
  }

  import(json: string): boolean {
    try {
      this.data = migrate(JSON.parse(json));
      this.dirty = true;
      this.flush();
      return true;
    } catch {
      return false;
    }
  }
}
