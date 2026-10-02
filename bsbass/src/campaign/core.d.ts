// Tipos do núcleo copiado do BSBASS THE GAME (core.js).

export interface CarDef {
  name: string;
  tag: string;
  model: string;
  frontZ: boolean;
  len: number;
  maxSpeed: number;
  accel: number;
  steerRate: number;
  steerAtSpeed: number;
  gripRear: number;
  driftGrip: number;
  gripRecovery: number;
  angDamp: number;
  driftYaw: number;
  counterAssist: number;
  maxSlip: number;
  boostSpeed: number;
  hp: number;
  unlock: { chapter?: string; stars?: number; coins?: number } | null;
}

export interface PilotDef {
  id: string;
  name: string;
  model: string;
  tag: string;
  color: string;
  perk: string;
  unlock: { chapter?: string; stars?: number } | null;
  mods: { score?: number; comboHold?: number; damage?: number; gripRecovery?: number; accel?: number; maxSlip?: number; angDamp?: number; steerRate?: number; speed?: number; hp?: number; boostRate?: number; boostDur?: number };
}

export interface PaintDef {
  id: string;
  name: string;
  color: string | null;
  unlock?: { stars: number };
}

export interface Challenge {
  type: 'complete' | 'score' | 'combo' | 'driftTime' | 'noHeavy' | 'nearMiss';
  value?: number;
  label: string;
}

export interface ChapterDef {
  id: string;
  title: string;
  trackId?: string;
  intro: string[];
  objective: string;
  win: { type: 'lap' | 'intercept' | 'survive' | 'escape' | 'free'; laps?: number; time?: number };
  speed: number;
  dmgMul?: number;
  tutorial?: boolean;
  cops: { queue: string[]; max: number; start?: number; ramp?: { at: number; max: number } };
  truck: { mode: 'show' | 'intercept' } | null;
  blocks: boolean;
  challenges: Challenge[];
  reward: number;
}

export interface CarState {
  px: number;
  pz: number;
  h: number;
  vx: number;
  vz: number;
  omega: number;
  drift: boolean;
  driftHold: number;
  grip: number;
  boostT: number;
  speedMul: number;
  slip: number;
  vf: number;
  vl: number;
  powerMul?: number;
}

export interface ScorerState {
  total: number;
  pending: number;
  mult: number;
  active: boolean;
  sinceValid: number;
  driftTime: number;
  heavyHits: number;
  nearMisses: number;
  bestMult: number;
}

export interface ScoreEvent {
  type: 'combo' | 'mult' | 'lost' | 'transition' | 'near' | 'clean' | 'multDown';
  points?: number;
  mult?: number;
}

export interface Summary {
  score: number;
  bestCombo: number;
  bestMult: number;
  driftTime: number;
  quality: number;
  grade: string;
  heavyHits: number;
  nearMisses: number;
}

export interface Scorer {
  state: ScorerState;
  S: Record<string, number>;
  update(o: { dt: number; speed: number; slip: number; grounded?: boolean; progress: number; colliding: boolean; curveId: number; dir: number; lap: number; zone: number }): void;
  hit(impact: number): 'heavy' | 'light' | 'ignored';
  nearMiss(id: string): boolean;
  copKill(): number;
  finish(): Summary;
  summary(): Summary;
  liveScore(): number;
  drainEvents(): ScoreEvent[];
}

export interface Message {
  type: string;
  text: string;
  priority: number;
  left: number;
  id: number;
  changed: boolean;
}

export interface MessageQueue {
  q: { current: Message | null; t: number };
  push(type: string, text: string, priority: number, dur?: number): string;
  tick(dt: number): Message | null;
}

export interface ChapterSave {
  done: boolean;
  stars: boolean[];
  best: number;
}

export interface SaveData {
  v: number;
  coins: number;
  equipped: string;
  pilot: string;
  paints: Record<string, string>;
  unlockedCars: string[];
  chapters: Record<string, ChapterSave>;
  bestFree: number;
  options: Record<string, boolean | string>;
  tutorialDone: boolean;
  applied: string[];
}

export interface SaveStore {
  readonly data: SaveData;
  status: string;
  save(): boolean;
  reset(): void;
}

export interface ApplyResult {
  duplicate: boolean;
  coins: number;
  newStars: number;
  stars?: boolean[];
  record: boolean;
  firstClear: boolean;
  prevBest?: number;
}

export interface Core {
  CONFIG: {
    control: Record<string, number | string>;
    drive: Record<string, number>;
    assist: Record<string, number>;
    boost: Record<string, number>;
    damage: Record<string, number>;
    scoring: Record<string, number>;
    rewards: Record<string, number>;
  };
  CARS: Record<string, CarDef>;
  CAR_ORDER: string[];
  PAINTS: PaintDef[];
  CHAPTERS: ChapterDef[];
  PILOTS: PilotDef[];
  pilotById(id: string): PilotDef;
  pilotCar(carKey: string, pilotId: string): CarDef;
  pilotScoring(pilotId: string): Record<string, number>;
  pilotUnlocked(data: SaveData, p: PilotDef): boolean;
  carStats(c: CarDef): { velocidade: number; resposta: number; drift: number; resistencia: number };
  newCarState(px: number, pz: number, h: number, speed: number): CarState;
  stepCar(c: CarState, input: { steer: number; throttle?: number; brake?: boolean; handbrake?: boolean }, dt: number, P: CarDef, T: { h: number; k: number; x: number } | number | null): CarState;
  slipDeg(c: { vx: number; vz: number; h: number }): number;
  DriftScorer(cfg?: Record<string, number>): Scorer;
  MessageQueue(opts?: object): MessageQueue;
  SaveStore(storage: Storage | null, key?: string): SaveStore;
  defaultSave(): SaveData;
  validateSave(d: unknown): SaveData | null;
  totalStars(data: SaveData): number;
  chapterUnlocked(data: SaveData, idx: number): boolean;
  carUnlockState(data: SaveData, key: string): { owned: boolean; requirementMet?: boolean; coins?: number; affordable?: boolean; label?: string };
  buyCar(data: SaveData, key: string): boolean;
  paintUnlocked(data: SaveData, p: PaintDef): boolean;
  evaluateChallenges(ch: ChapterDef, res: object): boolean[];
  applyResult(data: SaveData, chIdx: number, res: object, token: string): ApplyResult;
  clamp(v: number, a: number, b: number): number;
  damp(a: number, b: number, k: number, dt: number): number;
  wrapAng(a: number): number;
}

export const BSB: Core;
