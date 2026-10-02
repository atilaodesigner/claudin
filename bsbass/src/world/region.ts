// Além da quebrada (dados puros, sem three.js), no estilo de mapa de jogo de
// rua: a Via Estrutural (anel de via expressa em volta de tudo, ligado à
// avenida e às ruas do meio), a Estrada da Serra (cotovelos e curvas entre os
// morros até o mirante, no noroeste) e o Setor Novo (bairro de ruas tortas no
// sudeste, ligado à Estrutural).

import { circle, rect, type Shape } from '../physics/collide';
import { mulberry32, pick, range } from '../utils/rng';
import type { Lamp, Lot, OuterRoad, Parked, Tree } from './city';

/** borda do mapa inteiro (muro) */
export const WORLD = 1150;
export const EXPRESS_W = 22;
export const SERRA_W = 11;
export const BAIRRO_W = 12;

/** morro da serra (cone torto; colide pela base) */
export interface Mound {
  x: number;
  z: number;
  r: number;
  h: number;
  seed: number;
}

export interface Region {
  roads: OuterRoad[];
  lots: Lot[];
  lamps: Lamp[];
  trees: Tree[];
  parked: Parked[];
  mounds: Mound[];
  colliders: Shape[];
  /** mirante no alto da serra */
  mirante: { x: number; z: number; r: number };
  /** eixo da Estrada da Serra (do anel até o mirante) */
  serra: [number, number][];
  /** eixo da Via Estrutural (fechado) */
  ring: [number, number][];
  /** nomes dos lugares pro mapa */
  labels: { x: number; z: number; text: string }[];
}

/** raio da Via Estrutural num ângulo (quadrado bem arredondado, ondulado) */
export function expressR(a: number): number {
  const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const sq = 1 / Math.pow(c ** 3 + s ** 3, 1 / 3);
  return 720 * sq * (1 + 0.06 * Math.sin(2 * a + 0.5) + 0.03 * Math.sin(3 * a + 2.0));
}

export function expressPoint(a: number): [number, number] {
  const r = expressR(a);
  return [Math.cos(a) * r, Math.sin(a) * r];
}

/** anel da Estrutural como polilinha fechada */
export function expressRing(): [number, number][] {
  const out: [number, number][] = [];
  const N = 320;
  for (let i = 0; i < N; i++) out.push(expressPoint((i / N) * Math.PI * 2));
  return out;
}

/** Catmull-Rom pelos pontos de controle, amostrada a cada ~step metros */
export function smoothPath(ctrl: [number, number][], step = 4, loop = false): [number, number][] {
  const out: [number, number][] = [];
  const n = ctrl.length;
  const at = (i: number) => (loop ? ctrl[((i % n) + n) % n]! : ctrl[Math.max(0, Math.min(n - 1, i))]!);
  const segs = loop ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const m = Math.max(2, Math.ceil(len / step));
    for (let k = 0; k < m; k++) {
      const t = k / m, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (!loop) out.push(ctrl[n - 1]!);
  return out;
}

function bezier(a: [number, number], c: [number, number], b: [number, number], n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az;
  const L = dx * dx + dz * dz;
  const t = L > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L)) : 0;
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}

/** distância até a borda da estrada mais perto */
export function roadEdgeDist(roads: OuterRoad[], x: number, z: number): number {
  let best = Infinity;
  for (const r of roads) {
    const n = r.pts.length, m = r.loop ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const a = r.pts[i]!, b = r.pts[(i + 1) % n]!;
      // pula trecho longe (barato)
      if (Math.abs(a[0] - x) > 400 && Math.abs(b[0] - x) > 400) continue;
      best = Math.min(best, segDist(x, z, a[0], a[1], b[0], b[1]) - r.w / 2);
    }
  }
  return best;
}

/** anda pela polilinha chamando f a cada `every` metros (posição, tangente unitária) */
function walk(pts: [number, number][], every: number, f: (x: number, z: number, tx: number, tz: number, s: number) => void, offset = 0): void {
  let s = 0, next = offset;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 1e-6) continue;
    const tx = (b[0] - a[0]) / l, tz = (b[1] - a[1]) / l;
    while (next <= s + l) {
      const t = next - s;
      f(a[0] + tx * t, a[1] + tz * t, tx, tz, next);
      next += every;
    }
    s += l;
  }
}

/** rodovias novas: a Estrutural e as ligações com a grade (a da avenida a cidade já faz) */
export function expressRoads(gridEdge: number): OuterRoad[] {
  const roads: OuterRoad[] = [{ pts: expressRing(), w: EXPRESS_W, kind: 'asphalt', loop: true, name: 'VIA ESTRUTURAL' }];
  // ligações norte/sul: da rua do meio da grade (x = 0) até o anel
  for (const sgn of [1, -1]) {
    const start: [number, number] = [0, sgn * gridEdge];
    const end = expressPoint(sgn * Math.PI / 2);
    const ctrl: [number, number] = [sgn * 40, (start[1] + end[1]) / 2];
    roads.push({ pts: bezier(start, ctrl, end, 24), w: 14, kind: 'asphalt' });
  }
  return roads;
}

export function buildRegion(existing: OuterRoad[], oldBorder: number, seed = 404): Region {
  const rnd = mulberry32(seed);
  const roads: OuterRoad[] = [];
  const lots: Lot[] = [];
  const lamps: Lamp[] = [];
  const trees: Tree[] = [];
  const parked: Parked[] = [];
  const mounds: Mound[] = [];
  const colliders: Shape[] = [];
  const labels: Region['labels'] = [];
  const ring = existing.find((r) => r.name === 'VIA ESTRUTURAL')!.pts;
  const inside = (x: number, z: number, pad: number) => Math.abs(x) < WORLD - pad && Math.abs(z) < WORLD - pad;

  // ================= Estrada da Serra (noroeste) =================
  const a0 = -0.75 * Math.PI;
  const P0 = expressPoint(a0);
  const dx = Math.cos(a0), dz = Math.sin(a0); // pra fora do anel
  const nx = -dz, nz = dx; // de lado
  // (o "adiante" é comprimido pra caber até o muro)
  const local = (along: number, lat: number): [number, number] => [P0[0] + dx * along * 0.74 + nx * lat, P0[1] + dz * along * 0.74 + nz * lat];
  // (adiante, de lado): sobe em zigue-zague com três cotovelos, depois curvas abertas até o mirante
  const serraCtrl = ([
    [0, 0], [45, 0], [95, 25], [120, 90], [135, 150],
    [160, 185], [195, 178], [210, 130], [212, 40], [218, -60], [232, -130],
    [258, -165], [292, -150], [305, -95], [312, 0], [325, 85],
    [350, 135], [385, 140], [410, 100], [430, 30], [470, -30], [530, -45],
    [585, 0], [625, 70], [680, 95], [730, 60], [760, 30],
  ] as [number, number][]).map(([a, l]) => local(a, l));
  const serra = smoothPath(serraCtrl, 3.5);
  roads.push({ pts: serra, w: SERRA_W, kind: 'asphalt', name: 'ESTRADA DA SERRA' });
  const end = serra[serra.length - 1]!;
  const mir = local(790, 30);
  const mirante = { x: mir[0], z: mir[1], r: 28 };
  roads.push({ pts: [[mirante.x - 0.05, mirante.z], [mirante.x + 0.05, mirante.z]], w: mirante.r * 2, kind: 'asphalt', disc: true });
  // ligação do fim da estrada até a praça do mirante
  roads.push({ pts: [end, [mirante.x, mirante.z]], w: SERRA_W, kind: 'asphalt' });
  labels.push({ x: local(420, 0)[0], z: local(420, 0)[1], text: 'SERRA' });

  // postes esparsos na serra (madeira, alternando o lado)
  let side = 1;
  walk(serra, 70, (x, z, tx, tz) => {
    const ox = -tz * side, oz = tx * side;
    const px = x + ox * (SERRA_W / 2 + 1.3), pz = z + oz * (SERRA_W / 2 + 1.3);
    const sh = circle(px, pz, 0.22);
    lamps.push({ x: px, z: pz, dirX: -ox, dirZ: -oz, shape: sh });
    colliders.push(sh);
    side = -side;
  }, 30);
  // mirante: guarda-corpo (menos na entrada) e postes
  const inA = Math.atan2(end[1] - mirante.z, end[0] - mirante.x);
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * Math.PI * 2;
    let d = Math.abs(a - inA) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    if (d < 0.32) continue;
    colliders.push(circle(mirante.x + Math.cos(a) * (mirante.r + 0.6), mirante.z + Math.sin(a) * (mirante.r + 0.6), 0.6));
  }
  for (const a of [inA + 1.3, inA - 1.3, inA + Math.PI]) {
    const px = mirante.x + Math.cos(a) * (mirante.r - 1.2), pz = mirante.z + Math.sin(a) * (mirante.r - 1.2);
    const sh = circle(px, pz, 0.22);
    lamps.push({ x: px, z: pz, dirX: -Math.cos(a), dirZ: -Math.sin(a), shape: sh });
    colliders.push(sh);
  }

  // ================= bairros de ruas tortas =================
  const all = [...existing, ...roads];
  const district = (o: DistrictDef) => {
    const dr = buildDistrict(o, rnd, all, lots, lamps, parked, colliders, inside);
    roads.push(...dr);
    all.push(...dr);
    labels.push({ x: o.C[0], z: o.C[1], text: o.name });
  };
  // Setor Novo (sudeste): casas de laje
  district({
    name: 'SETOR NOVO', C: [815, 810], R: 232, w: BAIRRO_W,
    links: [[0.25 * Math.PI, 70], [0.1 * Math.PI, -40], [0.4 * Math.PI, 40]],
    chords: [[0.25, 2.75, 30, -20], [1.7, 4.5, -25, 35], [3.4, 5.75, 20, 25], [4.9, 0.9, -10, -30]],
    lot: [8, 11, 9, 13], floors: [1, 3], styles: ['painted', 'plaster', 'brick', 'block'], shops: 0.14, parked: 0.55,
  });
  // Polo de Galpões (nordeste): galpão, oficina, depósito
  district({
    name: 'POLO DE GALPÕES', C: [825, -820], R: 200, w: BAIRRO_W + 2,
    links: [[-0.25 * Math.PI, -60], [-0.08 * Math.PI, 40]],
    chords: [[2.4, 5.6, 25, 20], [0.9, 3.9, -30, 10]],
    lot: [16, 26, 18, 28], floors: [1, 2], styles: ['block', 'block', 'plaster', 'brick'], shops: 0.04, parked: 0.35,
  });

  // ---------- postes da Estrutural (lado de fora, a cada 48 m) ----------
  walk([...ring, ring[0]!], 48, (x, z, tx, tz) => {
    // normal pra fora do anel
    let ox = -tz, oz = tx;
    if (ox * x + oz * z < 0) { ox = -ox; oz = -oz; }
    const px = x + ox * (EXPRESS_W / 2 + 1.4), pz = z + oz * (EXPRESS_W / 2 + 1.4);
    if (roadEdgeDist(all, px, pz) < 0.8) return;
    const sh = circle(px, pz, 0.22);
    lamps.push({ x: px, z: pz, dirX: -ox, dirZ: -oz, shape: sh });
    colliders.push(sh);
  });

  // ================= morros da serra =================
  for (let al = -60; al < 980; al += 46) {
    for (let lt = -420; lt <= 420; lt += 46) {
      const [x, z] = local(al + range(rnd, -18, 18), lt + range(rnd, -18, 18));
      const r = range(rnd, 22, 46) * (0.8 + Math.min(1, Math.max(0, al) / 700) * 0.5);
      if (!inside(x, z, r * 0.6 + 4)) continue;
      // não come o anel, a cidade velha nem a estrada
      if (Math.hypot(x, z) < expressR(Math.atan2(z, x)) + EXPRESS_W / 2 + r + 12) continue;
      if (roadEdgeDist(all, x, z) < r + 7) continue;
      if (Math.hypot(x - mirante.x, z - mirante.z) < mirante.r + r + 10) continue;
      const h = r * range(rnd, 0.55, 1.05) * (0.7 + Math.min(1, Math.max(0, al) / 700) * 0.9);
      mounds.push({ x, z, r, h, seed: Math.floor(rnd() * 1e9) });
      colliders.push(circle(x, z, r * 0.86));
    }
  }

  // ================= cerrado entre o anel de terra e o muro =================
  for (let k = 0; k < 900; k++) {
    const x = range(rnd, -WORLD + 6, WORLD - 6), z = range(rnd, -WORLD + 6, WORLD - 6);
    if (Math.max(Math.abs(x), Math.abs(z)) < oldBorder) continue;
    if (roadEdgeDist(all, x, z) < 5) continue;
    if (mounds.some((m) => Math.hypot(m.x - x, m.z - z) < m.r + 2)) continue;
    if (lots.some((l) => Math.hypot(l.x - x, l.z - z) < Math.max(l.w, l.d) / 2 + 2)) continue;
    if (Math.hypot(x - mirante.x, z - mirante.z) < mirante.r + 4) continue;
    trees.push({ x, z, s: range(rnd, 0.7, 1.5), kind: rnd() < 0.08 ? pick(rnd, ['ipe-rosa', 'ipe-amarelo'] as const) : 'cerrado' });
    colliders.push(circle(x, z, 0.35));
  }
  labels.push({ x: 0, z: -expressR(-Math.PI / 2) - 55, text: 'VIA ESTRUTURAL' });

  return { roads, lots, lamps, trees, parked, mounds, colliders, mirante, serra, ring, labels };
}

interface DistrictDef {
  name: string;
  C: [number, number];
  R: number;
  w: number;
  /** ligações com a Estrutural: [ângulo no anel, curvatura] */
  links: [number, number][];
  /** ruas atravessando: [ângulo de saída, de chegada, desvio do miolo x, z] */
  chords: [number, number, number, number][];
  /** largura min/max, profundidade min/max do lote */
  lot: [number, number, number, number];
  floors: [number, number];
  styles: Lot['style'][];
  shops: number;
  parked: number;
}

/** bairro: anel torto + ruas cruzando + ligações; casas, postes e carros na beira */
function buildDistrict(o: DistrictDef, rnd: () => number, all: OuterRoad[], lots: Lot[], lamps: Lamp[], parked: Parked[], colliders: Shape[], inside: (x: number, z: number, pad: number) => boolean): OuterRoad[] {
  const { C, R } = o;
  const ph = rnd() * 6;
  const loopR = (a: number) => R * (1 + 0.1 * Math.sin(3 * a + ph) + 0.06 * Math.sin(5 * a + ph * 2));
  const loopPt = (a: number): [number, number] => [C[0] + Math.cos(a) * loopR(a), C[1] + Math.sin(a) * loopR(a)];
  const loop: [number, number][] = [];
  for (let i = 0; i < 180; i++) loop.push(loopPt((i / 180) * Math.PI * 2));
  const roads: OuterRoad[] = [{ pts: loop, w: o.w, kind: 'asphalt', loop: true, name: o.name }];
  for (const [ar, bend] of o.links) {
    const a = expressPoint(ar);
    // ponto do anel do bairro mais perto da saída
    let b = loop[0]!, bd = Infinity;
    for (const p of loop) {
      const d = Math.hypot(p[0] - a[0], p[1] - a[1]);
      if (d < bd) { bd = d; b = p; }
    }
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ctrl: [number, number] = [mx - ((b[1] - a[1]) / l) * bend, mz + ((b[0] - a[0]) / l) * bend];
    roads.push({ pts: bezier(a, ctrl, b, Math.max(8, Math.ceil(l / 8))), w: o.w, kind: 'asphalt' });
  }
  for (const [a1, a2, jx, jz] of o.chords) {
    const a = loopPt(a1), b = loopPt(a2);
    roads.push({ pts: bezier(a, [C[0] + jx, C[1] + jz], b, 40), w: o.w - 2, kind: 'asphalt' });
  }
  const near = [...all, ...roads];
  for (const r of roads) {
    const pts = r.loop ? [...r.pts, r.pts[0]!] : r.pts;
    for (const s of [1, -1]) {
      walk(pts, (o.lot[0] + o.lot[1]) / 2 + 1.5, (x, z, tx, tz) => {
        const w = range(rnd, o.lot[0], o.lot[1]), d = range(rnd, o.lot[2], o.lot[3]);
        const ox = -tz * s, oz = tx * s;
        const off = r.w / 2 + 3 + d / 2;
        const cx = x + ox * off, cz = z + oz * off;
        if (!inside(cx, cz, Math.max(w, d) / 2 + 8)) return;
        if (roadEdgeDist(near, cx, cz) < d / 2 + 2.4) return;
        const rr = Math.hypot(w, d) / 2;
        if (lots.some((l) => Math.abs(l.x - cx) < 40 && Math.hypot(l.x - cx, l.z - cz) < rr + Math.hypot(l.w, l.d) / 2 - 1.2)) return;
        if (rnd() < 0.1) return; // terreno vazio
        const rot = Math.atan2(-ox, -oz);
        const lot: Lot = {
          x: cx, z: cz, w, d, rot,
          floors: o.floors[0] + Math.floor(rnd() * (o.floors[1] - o.floors[0] + 1)),
          style: pick(rnd, o.styles),
          tint: rnd(),
          shop: rnd() < o.shops ? Math.floor(rnd() * 12) : -1,
          muro: rnd() < 0.35,
          seed: Math.floor(rnd() * 1e9),
        };
        lots.push(lot);
        colliders.push(rect(cx, cz, w / 2, d / 2, rot));
      }, rnd() * 6);
    }
    // postes alternando o lado
    let ls = 1;
    walk(pts, 34, (x, z, tx, tz) => {
      const ox = -tz * ls, oz = tx * ls;
      const px = x + ox * (r.w / 2 + 1.2), pz = z + oz * (r.w / 2 + 1.2);
      ls = -ls;
      if (roadEdgeDist(near, px, pz) < 0.6) return;
      if (lots.some((l) => Math.abs(l.x - px) < 30 && Math.hypot(l.x - px, l.z - pz) < Math.max(l.w, l.d) / 2 + 0.5)) return;
      const sh = circle(px, pz, 0.22);
      lamps.push({ x: px, z: pz, dirX: -ox, dirZ: -oz, shape: sh });
      colliders.push(sh);
    }, 10);
    // carro parado na beira
    walk(pts, 50, (x, z, tx, tz) => {
      if (rnd() > o.parked) return;
      const s2 = rnd() < 0.5 ? 1 : -1;
      const px = x - tz * s2 * (r.w / 2 - 0.9), pz = z + tx * s2 * (r.w / 2 - 0.9);
      if (roadEdgeDist(all, px, pz) < 4) return;
      if (roads.some((q) => q !== r && roadEdgeDist([q], px, pz) < 3)) return;
      if (lamps.some((l) => Math.abs(l.x - px) < 5 && Math.hypot(l.x - px, l.z - pz) < 4)) return;
      // mão certa: virado pro sentido da faixa do lado (direita = (-tz, tx))
      const rot = s2 > 0 ? Math.atan2(tx, tz) : Math.atan2(-tx, -tz);
      const shape = rect(px, pz, 0.95, 2.1, rot);
      parked.push({ x: px, z: pz, rot, model: Math.floor(rnd() * 4), color: Math.floor(rnd() * 1000), shape });
      colliders.push(shape);
    }, 20);
  }
  return roads;
}
