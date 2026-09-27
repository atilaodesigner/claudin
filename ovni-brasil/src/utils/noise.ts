/** Cheap smooth 1D noise used for shake, wobble and organic motion (no allocations). */
function hash1(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}

export function noise1(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash1(i) * (1 - u) + hash1(i + 1) * u) * 2 - 1;
}

/** Fractal noise in [-1,1] with a per-channel seed offset. */
export function fbm1(x: number, seed = 0): number {
  return noise1(x + seed * 17.13) * 0.65 + noise1(x * 2.13 + seed * 5.7) * 0.35;
}
