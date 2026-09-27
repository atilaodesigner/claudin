/**
 * Ranked divisions. Pure logic: RP (rank points) move with how a run's score compares
 * to the par of the player's current division, on a log scale so a lucky run can't
 * skip three divisions and a bad one doesn't wipe a week of progress.
 */
export interface Division {
  id: string;
  name: string;
  /** RP needed to enter. */
  min: number;
  /** Score that keeps you even in this division. */
  par: number;
  color: string;
}

export const DIVISIONS: readonly Division[] = [
  { id: 'bronze', name: 'BRONZE', min: 0, par: 400_000, color: '#d08a4e' },
  { id: 'prata', name: 'PRATA', min: 250, par: 900_000, color: '#c9d3dc' },
  { id: 'ouro', name: 'OURO', min: 600, par: 1_800_000, color: '#ffcf3f' },
  { id: 'platina', name: 'PLATINA', min: 1050, par: 3_200_000, color: '#6ff0e0' },
  { id: 'diamante', name: 'DIAMANTE', min: 1600, par: 5_500_000, color: '#8fb8ff' },
  { id: 'mestre', name: 'MESTRE ALIENÍGENA', min: 2300, par: 9_000_000, color: '#5dffa0' },
];

export interface DivisionStatus {
  division: Division;
  index: number;
  next: Division | null;
  /** 0..1 toward the next division. */
  progress: number;
}

export function divisionFor(rp: number): DivisionStatus {
  let index = 0;
  for (let i = 0; i < DIVISIONS.length; i++) if (rp >= (DIVISIONS[i] as Division).min) index = i;
  const division = DIVISIONS[index] as Division;
  const next = DIVISIONS[index + 1] ?? null;
  const progress = next ? Math.min(1, Math.max(0, (rp - division.min) / (next.min - division.min))) : 1;
  return { division, index, next, progress };
}

export const RANK = {
  perDoubling: 25,
  extractBonus: 10,
  deathPenalty: 10,
  minDelta: -40,
  maxDelta: 60,
} as const;

/** RP change for one ranked run. */
export function rpDelta(rp: number, score: number, extracted: boolean): number {
  const par = divisionFor(rp).division.par;
  const perf = Math.log2(Math.max(1, score) / par) * RANK.perDoubling;
  const d = Math.round(perf + (extracted ? RANK.extractBonus : -RANK.deathPenalty));
  return Math.max(RANK.minDelta, Math.min(RANK.maxDelta, d));
}

export function applyRp(rp: number, delta: number): number {
  return Math.max(0, rp + delta);
}
