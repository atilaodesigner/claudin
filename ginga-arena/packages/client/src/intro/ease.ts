export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
/** Progress of `t` through the [a, b] window, clamped to 0..1. */
export const seg = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
export const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number): number => t * t * t;
export const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t: number): number => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
