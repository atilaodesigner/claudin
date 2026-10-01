// Layout da quebrada (dados puros, sem three.js): malha de ruas estilo
// quadras de cidade-satélite do DF, avenida com canteiro, balão, terrão,
// feira, posto, lotes com casas de laje, postes, carros estacionados.

import { circle, rect, type Shape } from '../physics/collide';
import { mulberry32, pick, range } from '../utils/rng';
import { YARD_BLOCK, routeStreetSegments } from '../campaign/layout';

export const PITCH = 100; // distância entre eixos de rua
export const ROAD = 20; // largura da rua
export const NODES = 9; // ruas por eixo
export const EXTENT = ((NODES - 1) / 2) * PITCH; // 400
export const BLOCK_HALF = (PITCH - ROAD) / 2; // 40
export const SIDEWALK = 3;
export const CURB_H = 0.12;
export const LANE = 3.3; // afastamento da faixa em relação ao eixo
export const BORDER = EXTENT + ROAD / 2 + 26; // muro do fim do mapa
export const BALAO = { x: 0, z: 0, island: 12, ring: 34 };
export const AVENUE_Z = 0; // a avenida corta o mapa no eixo X

export type BlockKind = 'res' | 'terrao' | 'feira' | 'praca' | 'posto' | 'ferro';

export interface Block {
  i: number;
  j: number;
  x: number;
  z: number;
  kind: BlockKind;
}

export type HouseStyle = 'plaster' | 'brick' | 'block' | 'painted';

export interface Lot {
  x: number;
  z: number;
  w: number; // largura ao longo da rua
  d: number; // profundidade
  rot: number; // rotation.y: a fachada olha pra +Z local
  floors: number;
  style: HouseStyle;
  tint: number; // 0..1 escolhe cor da pintura
  shop: number; // -1 = residência, senão índice da placa
  muro: boolean; // casa recuada com muro + portão
  seed: number;
}

export interface Lamp {
  x: number;
  z: number;
  dirX: number; // pra onde o braço aponta (rua)
  dirZ: number;
  /** colisor (só os postes de calçada; dá pra derrubar) */
  shape?: Shape;
}

export interface Parked {
  x: number;
  z: number;
  rot: number;
  model: number;
  color: number;
  /** colisor (o carro pode ser arremessado numa batida forte) */
  shape?: Shape;
}

export interface Tree {
  x: number;
  z: number;
  s: number;
  kind: 'ipe-rosa' | 'ipe-amarelo' | 'cerrado';
}

export interface RoadSign {
  x: number;
  z: number;
  rot: number;
  text: string;
  sub: string;
}

export interface City {
  blocks: Block[];
  lots: Lot[];
  lamps: Lamp[];
  parked: Parked[];
  trees: Tree[];
  signs: RoadSign[];
  colliders: Shape[];
  medians: { x0: number; x1: number }[]; // canteiro da avenida (z = AVENUE_Z)
}

export const SHOP_NAMES = [
  'BAR DO VÉI',
  'ESPETINHO DA TIA',
  'AÇAÍ 61',
  'BORRACHARIA 24H',
  'LAN HOUSE',
  'SALÃO DA DIDI',
  'MERCADINHO',
  'DISK GÁS',
  'OFICINA DO BIGODE',
  'IGREJA',
  'PASTEL & CALDO',
  'SOM AUTOMOTIVO',
] as const;

export const PLACES = ['CEILÂNDIA', 'SAMAMBAIA', 'TAGUATINGA', 'SOL NASCENTE', 'RECANTO DAS EMAS', 'ESTRUTURAL', 'SANTA MARIA', 'RIACHO FUNDO', 'PLANALTINA', 'GAMA'] as const;

export function nodePos(i: number): number {
  return -EXTENT + i * PITCH;
}

export function blockKind(i: number, j: number): BlockKind {
  if (i === YARD_BLOCK.i && j === YARD_BLOCK.j) return 'ferro';
  if (i === 5 && j === 2) return 'terrao';
  if (i === 2 && j === 5) return 'feira';
  if (i === 6 && j === 5) return 'praca';
  if (i === 1 && j === 2) return 'posto';
  return 'res';
}

export function inBalao(x: number, z: number, pad = 0): boolean {
  return Math.hypot(x - BALAO.x, z - BALAO.z) < BALAO.ring + pad;
}

export function buildCity(seed = 61): City {
  const rnd = mulberry32(seed);
  const blocks: Block[] = [];
  const lots: Lot[] = [];
  const lamps: Lamp[] = [];
  const parked: Parked[] = [];
  const trees: Tree[] = [];
  const signs: RoadSign[] = [];
  const colliders: Shape[] = [];

  for (let i = 0; i < NODES - 1; i++) {
    for (let j = 0; j < NODES - 1; j++) {
      const x = nodePos(i) + PITCH / 2;
      const z = nodePos(j) + PITCH / 2;
      blocks.push({ i, j, x, z, kind: blockKind(i, j) });
    }
  }

  // ---------- lotes ----------
  const inner = BLOCK_HALF - SIDEWALK; // 37
  const depth = 21;
  for (const b of blocks) {
    if (b.kind === 'terrao' || b.kind === 'feira' || b.kind === 'praca') continue;
    // 4 lados. rot = direção pra onde a fachada olha
    const sides = [
      { rot: 0, len: inner * 2, ox: 0, oz: inner - depth / 2, along: [1, 0] }, // norte (+Z) olha pra +Z
      { rot: Math.PI, len: inner * 2, ox: 0, oz: -(inner - depth / 2), along: [-1, 0] },
      { rot: Math.PI / 2, len: (inner - depth) * 2, ox: inner - depth / 2, oz: 0, along: [0, -1] },
      { rot: -Math.PI / 2, len: (inner - depth) * 2, ox: -(inner - depth / 2), oz: 0, along: [0, 1] },
    ];
    for (const s of sides) {
      let n = Math.max(1, Math.round(s.len / range(rnd, 8.5, 12)));
      if (b.kind === 'posto' && s.rot === 0) continue; // frente do posto aberta
      if (b.kind === 'ferro' && s.rot !== Math.PI) continue; // ferro-velho: só a fileira de casas dos fundos
      const w = s.len / n;
      for (let k = 0; k < n; k++) {
        const t = -s.len / 2 + w * (k + 0.5);
        const lx = b.x + s.ox + s.along[0]! * t;
        const lz = b.z + s.oz + s.along[1]! * t;
        if (inBalao(lx, lz, 10)) continue;
        if (b.kind === 'posto' && s.rot !== Math.PI && Math.hypot(lx - b.x, lz - (b.z + 20)) < 30) continue;
        const r = rnd();
        const style: HouseStyle = r < 0.3 ? 'brick' : r < 0.45 ? 'block' : r < 0.75 ? 'painted' : 'plaster';
        const floors = rnd() < 0.5 ? 1 : rnd() < 0.8 ? 2 : 3;
        const shop = rnd() < 0.22 ? Math.floor(rnd() * SHOP_NAMES.length) : -1;
        lots.push({
          x: lx,
          z: lz,
          w: w - 0.05,
          d: depth,
          rot: s.rot,
          floors,
          style,
          tint: rnd(),
          shop,
          muro: shop < 0 && rnd() < 0.55,
          seed: Math.floor(rnd() * 1e9),
        });
        const horiz = Math.abs(Math.sin(s.rot)) > 0.5;
        colliders.push(rect(lx, lz, horiz ? depth / 2 : (w - 0.05) / 2, horiz ? (w - 0.05) / 2 : depth / 2));
      }
    }
    // miolo da quadra (inalcançável, mas precisa de colisor se o balão abrir espaço)
    const innerHalf = inner - depth;
    if (b.kind !== 'ferro' && !inBalao(b.x, b.z, innerHalf + 12)) colliders.push(rect(b.x, b.z, innerHalf, innerHalf));
  }

  // ---------- canteiro central da avenida ----------
  const medians: { x0: number; x1: number }[] = [];
  for (let i = 0; i < NODES - 1; i++) {
    let x0 = nodePos(i) + ROAD / 2 + 6;
    let x1 = nodePos(i + 1) - ROAD / 2 - 6;
    if (x1 > -BALAO.ring - 8 && x0 < BALAO.ring + 8) {
      if (x0 < 0) x1 = -BALAO.ring - 8;
      else x0 = BALAO.ring + 8;
    }
    if (x1 - x0 < 5) continue;
    medians.push({ x0, x1 });
    colliders.push(rect((x0 + x1) / 2, AVENUE_Z, (x1 - x0) / 2, 0.8));
  }

  // ---------- balão ----------
  colliders.push(circle(BALAO.x, BALAO.z, BALAO.island));
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.4;
    trees.push({ x: Math.cos(a) * 6.5, z: Math.sin(a) * 6.5, s: range(rnd, 1, 1.35), kind: k % 2 ? 'ipe-amarelo' : 'ipe-rosa' });
  }

  // ---------- postes ----------
  const step = 34;
  for (let n = 0; n < NODES; n++) {
    const c = nodePos(n);
    for (let t = -EXTENT; t <= EXTENT; t += step) {
      // trecho entre cruzamentos
      const off = ((t % PITCH) + PITCH) % PITCH;
      if (off < ROAD / 2 + 4 || off > PITCH - ROAD / 2 - 4) continue;
      for (const side of [-1, 1]) {
        const d = ROAD / 2 + 0.9;
        // ruas no eixo Z (x = c) e no eixo X (z = c); alterna o lado
        const alt = Math.round(t / step) % 2 === 0 ? 1 : -1;
        if (side !== alt) continue;
        const a = { x: c + side * d, z: t, dirX: -side, dirZ: 0 };
        const b = { x: t, z: c + side * d, dirX: 0, dirZ: -side };
        for (const p of [a, b]) {
          if (inBalao(p.x, p.z, 4)) continue;
          if (Math.abs(p.x) > EXTENT + ROAD || Math.abs(p.z) > EXTENT + ROAD) continue;
          const sh = circle(p.x, p.z, 0.22);
          lamps.push({ ...p, shape: sh });
          colliders.push(sh);
        }
      }
    }
  }
  // postes no canteiro da avenida (braço duplo)
  for (const m of medians) {
    for (let x = m.x0 + 8; x < m.x1 - 4; x += 30) lamps.push({ x, z: AVENUE_Z, dirX: 0, dirZ: 0 });
  }
  // postes em volta do balão
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const r = BALAO.ring + 2;
    const sh = circle(Math.cos(a) * r, Math.sin(a) * r, 0.22);
    lamps.push({ x: sh.x, z: sh.z, dirX: -Math.cos(a), dirZ: -Math.sin(a), shape: sh });
    colliders.push(sh);
  }

  // ---------- carros estacionados ----------
  // (nunca nas ruas das rotas dos capítulos: viram circuito durante a missão)
  const routeSegs = routeStreetSegments();
  for (let k = 0; k < 110; k++) {
    const vertical = rnd() < 0.5;
    const n = Math.floor(rnd() * NODES);
    const c = nodePos(n);
    if (!vertical && c === AVENUE_Z) continue;
    const seg = Math.floor(rnd() * (NODES - 1));
    const t = nodePos(seg) + ROAD / 2 + 8 + rnd() * (PITCH - ROAD - 16);
    const side = rnd() < 0.5 ? -1 : 1;
    const d = ROAD / 2 - 1.5;
    const x = vertical ? c + side * d : t;
    const z = vertical ? t : c + side * d;
    if (inBalao(x, z, 8)) continue;
    {
      const a = vertical ? `${n},${seg}` : `${seg},${n}`, b2 = vertical ? `${n},${seg + 1}` : `${seg + 1},${n}`;
      if (routeSegs.has(a < b2 ? `${a}|${b2}` : `${b2}|${a}`)) continue;
    }
    // mão certa: estaciona virado pro sentido da faixa do lado
    const rot = vertical ? (side > 0 ? Math.PI : 0) : side > 0 ? Math.PI / 2 : -Math.PI / 2;
    if (lamps.some((l) => Math.hypot(l.x - x, l.z - z) < 4)) continue;
    if (parked.some((p) => Math.hypot(p.x - x, p.z - z) < 7)) continue;
    const model = Math.floor(rnd() * 4);
    const shape = rect(x, z, 0.95, 2.1, rot);
    parked.push({ x, z, rot, model, color: Math.floor(rnd() * 1000), shape });
    colliders.push(shape);
  }

  // ---------- terrão, praça, feira ----------
  for (const b of blocks) {
    if (b.kind === 'terrao') {
      // traves do campinho
      for (const s of [-1, 1]) {
        colliders.push(circle(b.x - 3.6, b.z + s * 30, 0.12));
        colliders.push(circle(b.x + 3.6, b.z + s * 30, 0.12));
      }
      for (let k = 0; k < 9; k++) {
        const a = rnd() * Math.PI * 2;
        const x = b.x + Math.cos(a) * range(rnd, 33, 37);
        const z = b.z + Math.sin(a) * range(rnd, 33, 37);
        trees.push({ x, z, s: range(rnd, 0.8, 1.3), kind: 'cerrado' });
        colliders.push(circle(x, z, 0.35));
      }
    }
    if (b.kind === 'praca') {
      for (let k = 0; k < 7; k++) {
        const x = b.x + range(rnd, -30, 30);
        const z = b.z + range(rnd, -30, 30);
        if (Math.abs(x - b.x) < 16 && Math.abs(z - b.z) < 10) continue;
        trees.push({ x, z, s: range(rnd, 1, 1.4), kind: pick(rnd, ['ipe-rosa', 'ipe-amarelo', 'cerrado'] as const) });
        colliders.push(circle(x, z, 0.4));
      }
      // quadra poliesportiva: alambrado
      colliders.push(rect(b.x, b.z + 10, 15, 0.1));
      colliders.push(rect(b.x, b.z - 10, 15, 0.1));
    }
    if (b.kind === 'feira') {
      // barracas da feira
      for (let k = 0; k < 6; k++) {
        const x = b.x - 25 + k * 10;
        colliders.push(rect(x, b.z + 28, 3.5, 2.5));
      }
    }
    if (b.kind === 'posto') {
      // pilares da cobertura e bombas
      for (const sx of [-10, 10]) for (const sz of [8, 22]) colliders.push(rect(b.x + sx, b.z + sz, 0.4, 0.4));
      colliders.push(rect(b.x - 5, b.z + 15, 0.6, 1.8));
      colliders.push(rect(b.x + 5, b.z + 15, 0.6, 1.8));
    }
  }

  // ---------- cerrado em volta + muro do fim do mapa ----------
  for (let k = 0; k < 120; k++) {
    const side = Math.floor(rnd() * 4);
    const t = range(rnd, -BORDER, BORDER);
    const o = range(rnd, EXTENT + ROAD / 2 + 4, BORDER - 2);
    const x = side === 0 ? t : side === 1 ? -o : side === 2 ? t : o;
    const z = side === 0 ? o : side === 1 ? t : side === 2 ? -o : t;
    trees.push({ x, z, s: range(rnd, 0.7, 1.3), kind: 'cerrado' });
    colliders.push(circle(x, z, 0.35));
  }
  const W = BORDER;
  colliders.push(rect(0, W + 1, W + 2, 1), rect(0, -W - 1, W + 2, 1), rect(W + 1, 0, 1, W + 2), rect(-W - 1, 0, 1, W + 2));

  // ---------- placas verdes ----------
  const names = [...PLACES];
  for (let k = 0; k < 14; k++) {
    const i = 1 + Math.floor(rnd() * (NODES - 2));
    const j = 1 + Math.floor(rnd() * (NODES - 2));
    if (i === 4 && j === 4) continue;
    const vertical = rnd() < 0.5;
    const x = nodePos(i) + (vertical ? ROAD / 2 + 1.4 : -16);
    const z = nodePos(j) + (vertical ? -16 : -(ROAD / 2 + 1.4));
    const text = names[k % names.length]!;
    const sub = `QN${'MNOPR'[k % 5]} ${1 + Math.floor(rnd() * 30)}`;
    signs.push({ x, z, rot: vertical ? Math.PI : Math.PI / 2, text, sub });
  }

  return { blocks, lots, lamps, parked, trees, signs, colliders, medians };
}

export interface Surface {
  grip: number;
  height: number;
  dirt: boolean;
}

export function blockAt(city: City, x: number, z: number): Block | null {
  const i = Math.floor((x + EXTENT) / PITCH);
  const j = Math.floor((z + EXTENT) / PITCH);
  if (i < 0 || j < 0 || i >= NODES - 1 || j >= NODES - 1) return null;
  const b = city.blocks[i * (NODES - 1) + j]!;
  if (Math.abs(x - b.x) > BLOCK_HALF || Math.abs(z - b.z) > BLOCK_HALF) return null;
  return b;
}

export function surfaceAt(city: City, x: number, z: number): Surface {
  if (Math.abs(x) > EXTENT + ROAD / 2 || Math.abs(z) > EXTENT + ROAD / 2) return { grip: 0.68, height: 0, dirt: true };
  if (inBalao(x, z)) return { grip: Math.hypot(x, z) < BALAO.island + 1.5 ? 0.8 : 1, height: 0, dirt: false };
  const b = blockAt(city, x, z);
  if (!b) return { grip: 1, height: 0, dirt: false };
  if (b.kind === 'terrao') {
    const edge = Math.max(Math.abs(x - b.x), Math.abs(z - b.z));
    return edge > BLOCK_HALF - SIDEWALK ? { grip: 1, height: CURB_H, dirt: false } : { grip: 0.7, height: 0, dirt: true };
  }
  if (b.kind === 'feira' || b.kind === 'posto') return { grip: 1, height: 0, dirt: false };
  return { grip: 0.95, height: CURB_H, dirt: false };
}

/** ponto de respawn mais próximo: meio da faixa mais perto */
export function nearestLane(x: number, z: number): { x: number; z: number; heading: number } {
  const snap = (v: number) => nodePos(Math.max(0, Math.min(NODES - 1, Math.round((v + EXTENT) / PITCH))));
  const cx = snap(x), cz = snap(z);
  const dx = Math.abs(x - cx), dz = Math.abs(z - cz);
  let px: number, pz: number, heading: number;
  if (dx < dz) {
    // rua vertical x = cx; faixa da direita indo pra +Z fica em x = cx - LANE
    px = cx - LANE;
    pz = Math.max(-EXTENT, Math.min(EXTENT, z));
    heading = 0;
  } else {
    px = Math.max(-EXTENT, Math.min(EXTENT, x));
    pz = cz + LANE;
    heading = Math.PI / 2;
  }
  // fora dos cruzamentos e do balão
  if (inBalao(px, pz, 6)) {
    px = -BALAO.ring - 20;
    pz = AVENUE_Z + LANE;
    heading = Math.PI / 2;
  }
  return { x: px, z: pz, heading };
}
