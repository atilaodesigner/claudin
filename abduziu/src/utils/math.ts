export const TAU = Math.PI * 2;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function invLerp(a: number, b: number, v: number): number {
  return a === b ? 0 : (v - a) / (b - a);
}

export function remap(v: number, a0: number, a1: number, b0: number, b1: number): number {
  return lerp(b0, b1, clamp01(invLerp(a0, a1, v)));
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** Frame-rate independent exponential damping toward a target. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  const delta = wrapAngle(target - current);
  return current + delta * (1 - Math.exp(-lambda * dt));
}

export function wrapAngle(a: number): number {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

export function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function len2(x: number, z: number): number {
  return Math.sqrt(x * x + z * z);
}

export function randRange(rand: () => number, min: number, max: number): number {
  return min + (max - min) * rand();
}

export function formatInt(n: number): string {
  return Math.floor(n).toLocaleString('pt-BR');
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

export function formatTons(kg: number): string {
  const t = kg / 1000;
  if (t < 10) return `${t.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} T`;
  return `${Math.round(t).toLocaleString('pt-BR')} T`;
}

/** Critically damped spring (per axis). Mutates state, returns new value. */
export interface SpringState {
  value: number;
  velocity: number;
}

export function springStep(s: SpringState, target: number, stiffness: number, damping: number, dt: number): number {
  const force = (target - s.value) * stiffness - s.velocity * damping;
  s.velocity += force * dt;
  s.value += s.velocity * dt;
  return s.value;
}
