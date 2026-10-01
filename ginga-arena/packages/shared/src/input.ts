/** One tick of intent. Only bits: never positions, forces or angles. */
export const Btn = {
  Left: 1,
  Right: 2,
  Jump: 4,
  Touch: 8,
  Attack: 16,
} as const;
export const BTN_MASK = 31;

export interface InputFrame {
  /** Strictly increasing per client. */
  seq: number;
  /** Simulation tick this input is meant for. */
  tick: number;
  buttons: number;
}

export function isValidButtons(b: unknown): b is number {
  return typeof b === 'number' && Number.isInteger(b) && b >= 0 && b <= BTN_MASK;
}

/** Horizontal intent in world space: -1, 0 or +1. */
export function moveAxis(buttons: number): -1 | 0 | 1 {
  const l = buttons & Btn.Left ? 1 : 0;
  const r = buttons & Btn.Right ? 1 : 0;
  return (r - l) as -1 | 0 | 1;
}
