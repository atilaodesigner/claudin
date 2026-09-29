// Colisão 2D (plano XZ): retângulos orientados (OBB) e círculos, via SAT.
// Mesma convenção do three.js: rot = rotation.y, eixo "comprimento" = (sin r, cos r).

export interface Rect {
  kind: 'rect';
  x: number;
  z: number;
  hw: number; // meia largura (eixo X local)
  hl: number; // meio comprimento (eixo Z local)
  rot: number;
}

export interface Circle {
  kind: 'circle';
  x: number;
  z: number;
  r: number;
}

export type Shape = Rect | Circle;

export interface Contact {
  nx: number; // normal apontando de B pra A
  nz: number;
  depth: number;
  px: number; // ponto de contato aproximado
  pz: number;
}

export function rect(x: number, z: number, hw: number, hl: number, rot = 0): Rect {
  return { kind: 'rect', x, z, hw, hl, rot };
}

export function circle(x: number, z: number, r: number): Circle {
  return { kind: 'circle', x, z, r };
}

export function corners(r: Rect, out: number[] = new Array(8)): number[] {
  const s = Math.sin(r.rot), c = Math.cos(r.rot);
  // eixos: X local = (c, -s), Z local = (s, c)
  const ax = c * r.hw, az = -s * r.hw;
  const bx = s * r.hl, bz = c * r.hl;
  out[0] = r.x + ax + bx; out[1] = r.z + az + bz;
  out[2] = r.x - ax + bx; out[3] = r.z - az + bz;
  out[4] = r.x - ax - bx; out[5] = r.z - az - bz;
  out[6] = r.x + ax - bx; out[7] = r.z + az - bz;
  return out;
}

const ca: number[] = new Array(8);
const cb: number[] = new Array(8);

function project(cs: number[], ax: number, az: number): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 8; i += 2) {
    const d = cs[i]! * ax + cs[i + 1]! * az;
    if (d < lo) lo = d;
    if (d > hi) hi = d;
  }
  return [lo, hi];
}

function inside(r: Rect, x: number, z: number): boolean {
  const s = Math.sin(r.rot), c = Math.cos(r.rot);
  const dx = x - r.x, dz = z - r.z;
  return Math.abs(dx * c - dz * s) <= r.hw + 1e-6 && Math.abs(dx * s + dz * c) <= r.hl + 1e-6;
}

function rectRect(a: Rect, b: Rect): Contact | null {
  corners(a, ca);
  corners(b, cb);
  const axes = [
    [Math.cos(a.rot), -Math.sin(a.rot), 0],
    [Math.sin(a.rot), Math.cos(a.rot), 0],
    [Math.cos(b.rot), -Math.sin(b.rot), 1],
    [Math.sin(b.rot), Math.cos(b.rot), 1],
  ] as const;
  let best = Infinity, bnx = 0, bnz = 0, fromB = false;
  for (const [ax, az, owner] of axes) {
    const [amin, amax] = project(ca, ax, az);
    const [bmin, bmax] = project(cb, ax, az);
    const o = Math.min(amax, bmax) - Math.max(amin, bmin);
    if (o <= 0) return null;
    if (o < best) {
      best = o;
      // orienta de B pra A
      const dir = (a.x - b.x) * ax + (a.z - b.z) * az;
      bnx = dir >= 0 ? ax : -ax;
      bnz = dir >= 0 ? az : -az;
      fromB = owner === 1;
    }
  }
  // ponto de contato: média dos vértices de um que estão dentro do outro
  let px = 0, pz = 0, n = 0;
  for (let i = 0; i < 8; i += 2) {
    if (inside(b, ca[i]!, ca[i + 1]!)) { px += ca[i]!; pz += ca[i + 1]!; n++; }
    if (inside(a, cb[i]!, cb[i + 1]!)) { px += cb[i]!; pz += cb[i + 1]!; n++; }
  }
  if (n > 0) {
    px /= n;
    pz /= n;
  } else if (fromB) {
    // quinas cruzadas sem vértice dentro: usa o vértice de A mais profundo
    let m = Infinity;
    for (let i = 0; i < 8; i += 2) {
      const d = ca[i]! * bnx + ca[i + 1]! * bnz;
      if (d < m) { m = d; px = ca[i]!; pz = ca[i + 1]!; }
    }
  } else {
    let m = -Infinity;
    for (let i = 0; i < 8; i += 2) {
      const d = cb[i]! * bnx + cb[i + 1]! * bnz;
      if (d > m) { m = d; px = cb[i]!; pz = cb[i + 1]!; }
    }
  }
  return { nx: bnx, nz: bnz, depth: best, px, pz };
}

function rectCircle(a: Rect, c: Circle): Contact | null {
  // círculo no referencial do retângulo
  const s = Math.sin(a.rot), co = Math.cos(a.rot);
  const dx = c.x - a.x, dz = c.z - a.z;
  const lx = dx * co - dz * s; // eixo X local
  const lz = dx * s + dz * co; // eixo Z local
  const qx = Math.max(-a.hw, Math.min(a.hw, lx));
  const qz = Math.max(-a.hl, Math.min(a.hl, lz));
  let ex = lx - qx, ez = lz - qz;
  let d = Math.hypot(ex, ez);
  let depth: number;
  if (d > 1e-6) {
    if (d >= c.r) return null;
    depth = c.r - d;
    ex /= d; ez /= d;
  } else {
    // centro dentro do retângulo
    const px = a.hw - Math.abs(lx), pz = a.hl - Math.abs(lz);
    if (px < pz) { ex = Math.sign(lx) || 1; ez = 0; depth = px + c.r; }
    else { ex = 0; ez = Math.sign(lz) || 1; depth = pz + c.r; }
    d = 0;
  }
  // normal local (de A pro círculo) -> mundo; queremos de B(círculo) pra A: inverte
  const wx = ex * co + ez * s;
  const wz = -ex * s + ez * co;
  const px = a.x + qx * co + qz * s;
  const pz = a.z - qx * s + qz * co;
  return { nx: -wx, nz: -wz, depth, px, pz };
}

/** Colisão de A (sempre retângulo, o carro) contra B. */
export function collide(a: Rect, b: Shape): Contact | null {
  return b.kind === 'rect' ? rectRect(a, b) : rectCircle(a, b);
}

export function shapeBounds(s: Shape): [number, number, number, number] {
  if (s.kind === 'circle') return [s.x - s.r, s.z - s.r, s.x + s.r, s.z + s.r];
  const ex = Math.abs(Math.cos(s.rot)) * s.hw + Math.abs(Math.sin(s.rot)) * s.hl;
  const ez = Math.abs(Math.sin(s.rot)) * s.hw + Math.abs(Math.cos(s.rot)) * s.hl;
  return [s.x - ex, s.z - ez, s.x + ex, s.z + ez];
}

/** Hash espacial simples pros colisores estáticos. */
export class SpatialGrid<T extends Shape> {
  private cells = new Map<number, T[]>();
  private stamp = new Map<T, number>();
  private query = 0;

  constructor(private cell = 16) {}

  private key(ix: number, iz: number): number {
    return (ix + 4096) * 8192 + (iz + 4096);
  }

  insert(s: T): void {
    const [x0, z0, x1, z1] = shapeBounds(s);
    for (let ix = Math.floor(x0 / this.cell); ix <= Math.floor(x1 / this.cell); ix++) {
      for (let iz = Math.floor(z0 / this.cell); iz <= Math.floor(z1 / this.cell); iz++) {
        const k = this.key(ix, iz);
        let list = this.cells.get(k);
        if (!list) this.cells.set(k, (list = []));
        list.push(s);
      }
    }
  }

  near(x0: number, z0: number, x1: number, z1: number, out: T[] = []): T[] {
    out.length = 0;
    const q = ++this.query;
    for (let ix = Math.floor(x0 / this.cell); ix <= Math.floor(x1 / this.cell); ix++) {
      for (let iz = Math.floor(z0 / this.cell); iz <= Math.floor(z1 / this.cell); iz++) {
        const list = this.cells.get(this.key(ix, iz));
        if (!list) continue;
        for (const s of list) {
          if (this.stamp.get(s) === q) continue;
          this.stamp.set(s, q);
          out.push(s);
        }
      }
    }
    return out;
  }
}

export interface Body {
  x: number;
  z: number;
  vx: number;
  vz: number;
  yawRate: number;
}

/**
 * Resolve o contato empurrando o corpo pra fora e aplicando impulso com
 * restituição e atrito. Retorna a velocidade de impacto normal (m/s).
 * `otherMass` = Infinity pra parede; com massa finita devolve o impulso em `out`.
 */
export function resolve(
  body: Body,
  mass: number,
  inertia: number,
  c: Contact,
  restitution = 0.25,
  friction = 0.35,
  otherMass = Infinity,
  out?: { jx: number; jz: number },
): number {
  const share = otherMass === Infinity ? 1 : otherMass / (mass + otherMass);
  body.x += c.nx * c.depth * share;
  body.z += c.nz * c.depth * share;

  const rx = c.px - body.x, rz = c.pz - body.z;
  // velocidade do ponto de contato: v + ω × r (ω no eixo Y)
  // ω × r em XZ com rotação positiva de Z pra X: (ω rz, -ω rx)
  const pvx = body.vx + body.yawRate * rz;
  const pvz = body.vz - body.yawRate * rx;
  const vn = pvx * c.nx + pvz * c.nz;
  if (vn >= 0) return 0;

  const invM = 1 / mass + (otherMass === Infinity ? 0 : 1 / otherMass);
  const rn = rz * c.nx - rx * c.nz; // "braço" do impulso
  const j = (-(1 + restitution) * vn) / (invM + (rn * rn) / inertia);
  let jx = c.nx * j, jz = c.nz * j;

  // atrito tangencial
  const tx = -c.nz, tz = c.nx;
  const vt = pvx * tx + pvz * tz;
  const rt = rz * tx - rx * tz;
  let jt = -vt / (invM + (rt * rt) / inertia);
  const maxT = friction * j;
  jt = Math.max(-maxT, Math.min(maxT, jt));
  jx += tx * jt;
  jz += tz * jt;

  body.vx += jx / mass;
  body.vz += jz / mass;
  body.yawRate += (rz * jx - rx * jz) / inertia;
  if (out) { out.jx = -jx; out.jz = -jz; }
  return -vn;
}
