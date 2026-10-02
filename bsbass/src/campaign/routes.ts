// Trajetos dos capítulos pela cidade. No BSBASS THE GAME tudo (polícia,
// bonde, caminhão, bloqueios, cinemáticas) vive em "espaço de pista": s =
// metros ao longo do circuito, x = deslocamento lateral. Aqui cada capítulo
// ganha um circuito fechado pelas ruas da sua região, amostrado de metro em
// metro do mesmo jeito (posição, frente, direita, curvatura suavizada), e a
// lógica original roda em cima dele. Durante a missão as ruas laterais dos
// cruzamentos e os terrenos abertos da beira ganham barreira, pra rota virar
// circuito sem sair do mundo aberto.

import { BLOCK_HALF, NODES, ROAD, SIDEWALK, nodePos } from '../world/city';

/** metade da largura útil da pista (a rua tem 20 m; o jogo original usava 22) */
export const RHALF = 9.4;
/** faixas do original (±2,8 e ±8,2 numa pista de 22 m) na mesma proporção */
export const LANES = [-8.2, -2.8, 2.8, 8.2].map((x) => (x * RHALF) / 11);
const CORNER_R = 11;

import { ROUTES, YARD_BLOCK, type RouteDef } from './layout';

export { ROUTES, YARD_BLOCK };

/** lados abertos (sem casa) de quadras especiais: n = +z, s = -z, e = +x, w = -x */
export const OPEN_SIDES: Record<string, string> = {
  terrao: 'nsew',
  feira: 'nsew',
  praca: 'nsew',
  posto: 'n',
  ferro: 'new',
};

export interface Barrier {
  x: number;
  z: number;
  /** meia-extensão ao longo de X e Z */
  hx: number;
  hz: number;
}

export interface Route {
  def: RouteDef;
  n: number;
  P: Float32Array; // x,z por metro
  F: Float32Array; // frente
  R: Float32Array; // direita (F × cima)
  K: Float32Array; // curvatura suavizada
  curveId: Int16Array;
  zone: Float32Array;
  curveCount: number;
  barriers: Barrier[];
  /** ponto do capítulo (s = 0) */
  point: { x: number; z: number; heading: number };
}

const key = (i: number, j: number) => i * 100 + j;

export function buildRoute(def: RouteDef, blockKind: (i: number, j: number) => string = () => 'res'): Route {
  const pts = def.nodes.map(([i, j]) => [nodePos(i), nodePos(j)] as [number, number]);
  const m = pts.length;
  // ---------- polilinha densa: retas + arcos de 90° nos cantos ----------
  // começa no meio do primeiro trecho (é onde fica o ponto do capítulo)
  const dense: [number, number][] = [];
  const dir = (a: [number, number], b: [number, number]) => {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz);
    return [dx / l, dz / l] as [number, number];
  };
  const mid0: [number, number] = [(pts[0]![0] + pts[1]![0]) / 2, (pts[0]![1] + pts[1]![1]) / 2];
  dense.push(mid0);
  const lineTo = (x: number, z: number) => {
    const [px, pz] = dense[dense.length - 1]!;
    const l = Math.hypot(x - px, z - pz);
    const n = Math.max(1, Math.ceil(l / 0.25));
    for (let k = 1; k <= n; k++) dense.push([px + ((x - px) * k) / n, pz + ((z - pz) * k) / n]);
  };
  for (let c = 1; c <= m; c++) {
    const N = pts[c % m]!, prev = pts[(c - 1) % m]!, next = pts[(c + 1) % m]!;
    const d1 = dir(prev, N), d2 = dir(N, next);
    const A: [number, number] = [N[0] - d1[0] * CORNER_R, N[1] - d1[1] * CORNER_R];
    lineTo(A[0], A[1]);
    // centro do arco: do canto, andando pra dentro da curva
    const C: [number, number] = [A[0] + d2[0] * CORNER_R, A[1] + d2[1] * CORNER_R];
    const a0 = Math.atan2(A[1] - C[1], A[0] - C[0]);
    const B: [number, number] = [N[0] + d2[0] * CORNER_R, N[1] + d2[1] * CORNER_R];
    const a1 = Math.atan2(B[1] - C[1], B[0] - C[0]);
    let da = a1 - a0;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const steps = Math.ceil((Math.abs(da) * CORNER_R) / 0.25);
    for (let k = 1; k <= steps; k++) {
      const a = a0 + (da * k) / steps;
      dense.push([C[0] + Math.cos(a) * CORNER_R, C[1] + Math.sin(a) * CORNER_R]);
    }
  }
  lineTo(mid0[0], mid0[1]);
  // ---------- reamostra de metro em metro ----------
  const acc: number[] = [0];
  for (let k = 1; k < dense.length; k++) acc.push(acc[k - 1]! + Math.hypot(dense[k]![0] - dense[k - 1]![0], dense[k]![1] - dense[k - 1]![1]));
  const total = acc[acc.length - 1]!;
  const n = Math.round(total);
  const P = new Float32Array(n * 2), F = new Float32Array(n * 2), R = new Float32Array(n * 2), K = new Float32Array(n), raw = new Float32Array(n);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const s = (i / n) * total;
    while (k < acc.length - 2 && acc[k + 1]! < s) k++;
    const f = (s - acc[k]!) / Math.max(1e-6, acc[k + 1]! - acc[k]!);
    P[i * 2] = dense[k]![0] + (dense[k + 1]![0] - dense[k]![0]) * f;
    P[i * 2 + 1] = dense[k]![1] + (dense[k + 1]![1] - dense[k]![1]) * f;
  }
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n, b = (i + 1) % n;
    let fx = P[b * 2]! - P[a * 2]!, fz = P[b * 2 + 1]! - P[a * 2 + 1]!;
    const l = Math.hypot(fx, fz) || 1;
    fx /= l;
    fz /= l;
    F[i * 2] = fx;
    F[i * 2 + 1] = fz;
    // direita = frente × cima (mesma convenção do jogo original)
    R[i * 2] = -fz;
    R[i * 2 + 1] = fx;
  }
  // curvatura como no original: variação da frente projetada na direita, média de ±14 m
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n, b = (i + 1) % n;
    const dx = (F[b * 2]! - F[a * 2]!) / 2, dz = (F[b * 2 + 1]! - F[a * 2 + 1]!) / 2;
    raw[i] = -(dx * R[i * 2]! + dz * R[i * 2 + 1]!);
  }
  const W = 14;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = -W; j <= W; j++) s += raw[(i + j + n) % n]!;
    K[i] = s / (2 * W + 1);
  }
  // curvas numeradas (combo) e zonas de drift, mesmos limiares do original
  const curveId = new Int16Array(n).fill(-1), zone = new Float32Array(n).fill(1);
  let cur = -1, cnt = 0;
  for (let i = 0; i < n; i++) {
    const kk = Math.abs(K[i]!);
    if (kk > 0.0042) {
      if (cur < 0) cur = cnt++;
      curveId[i] = cur;
      if (kk > 0.0075) zone[i] = 1.5;
    } else cur = -1;
  }
  // a volta começa numa reta, então a última curva não emenda com a primeira
  const point = { x: P[0]!, z: P[1]!, heading: Math.atan2(F[0]!, F[1]!) };
  return { def, n, P, F, R, K, curveId, zone, curveCount: cnt, barriers: routeBarriers(def, blockKind), point };
}

/** barreiras da missão: bocas das ruas laterais e beiras de terreno aberto */
export function routeBarriers(def: RouteDef, blockKind: (i: number, j: number) => string = () => 'res'): Barrier[] {
  const out: Barrier[] = [];
  const used = new Set<string>(); // trechos de rua usados (entre nós vizinhos)
  const visited = new Set<number>();
  const m = def.nodes.length;
  for (let c = 0; c < m; c++) {
    const [i0, j0] = def.nodes[c]!, [i1, j1] = def.nodes[(c + 1) % m]!;
    const si = Math.sign(i1 - i0), sj = Math.sign(j1 - j0);
    let i = i0, j = j0;
    visited.add(key(i, j));
    while (i !== i1 || j !== j1) {
      const ni = i + si, nj = j + sj;
      used.add(`${Math.min(key(i, j), key(ni, nj))}-${Math.max(key(i, j), key(ni, nj))}`);
      i = ni;
      j = nj;
      visited.add(key(i, j));
    }
  }
  const d = ROAD / 2 + 2.5;
  const half = ROAD / 2 + SIDEWALK;
  for (const kk of visited) {
    const i = Math.floor(kk / 100), j = kk % 100;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= NODES || nj >= NODES) continue;
      const seg = `${Math.min(kk, key(ni, nj))}-${Math.max(kk, key(ni, nj))}`;
      if (used.has(seg)) continue;
      const x = nodePos(i) + di * d, z = nodePos(j) + dj * d;
      out.push(di !== 0 ? { x, z, hx: 0.6, hz: half } : { x, z, hx: half, hz: 0.6 });
    }
  }
  // terrenos abertos na beira da rota
  const edge = BLOCK_HALF - 1.2;
  for (const seg of used) {
    const [a, b] = seg.split('-').map(Number) as [number, number];
    const i0 = Math.floor(a / 100), j0 = a % 100, i1 = Math.floor(b / 100), j1 = b % 100;
    const vertical = i0 === i1; // rua no eixo Z (x constante)
    const bi = Math.min(i0, i1), bj = Math.min(j0, j1);
    // as duas quadras dos lados do trecho, e qual lado delas encosta na rua
    const sides: [number, number, string][] = vertical
      ? [[i0 - 1, bj, 'e'], [i0, bj, 'w']]
      : [[bi, j0 - 1, 'n'], [bi, j0, 's']];
    for (const [qi, qj, side] of sides) {
      if (qi < 0 || qj < 0 || qi >= NODES - 1 || qj >= NODES - 1) continue;
      const open = OPEN_SIDES[blockKind(qi, qj)];
      if (!open || !open.includes(side)) continue;
      const cx = nodePos(qi) + 50, cz = nodePos(qj) + 50;
      const ox = side === 'e' ? edge : side === 'w' ? -edge : 0;
      const oz = side === 'n' ? edge : side === 's' ? -edge : 0;
      out.push(vertical ? { x: cx + ox, z: cz, hx: 0.6, hz: BLOCK_HALF - 2 } : { x: cx, z: cz + oz, hx: BLOCK_HALF - 2, hz: 0.6 });
    }
  }
  return out;
}

/** posição e direções no metro s (interpolado); escreve em out */
export interface Frame {
  x: number;
  z: number;
  fx: number;
  fz: number;
  rx: number;
  rz: number;
}

export function wrapS(r: Route, s: number): number {
  const n = r.n;
  return ((s % n) + n) % n;
}

export function frameAt(r: Route, s: number, out: Frame): Frame {
  s = wrapS(r, s);
  const n = r.n, i = s | 0, f = s - i, j = (i + 1) % n;
  const P = r.P, F = r.F;
  out.x = P[i * 2]! + (P[j * 2]! - P[i * 2]!) * f;
  out.z = P[i * 2 + 1]! + (P[j * 2 + 1]! - P[i * 2 + 1]!) * f;
  let fx = F[i * 2]! + (F[j * 2]! - F[i * 2]!) * f, fz = F[i * 2 + 1]! + (F[j * 2 + 1]! - F[i * 2 + 1]!) * f;
  const l = Math.hypot(fx, fz) || 1;
  fx /= l;
  fz /= l;
  out.fx = fx;
  out.fz = fz;
  out.rx = -fz;
  out.rz = fx;
  return out;
}

export function curvAt(r: Route, s: number): number {
  s = wrapS(r, s);
  const i = s | 0, f = s - i;
  return r.K[i]! + (r.K[(i + 1) % r.n]! - r.K[i]!) * f;
}

const _f: Frame = { x: 0, z: 0, fx: 0, fz: 1, rx: -1, rz: 0 };
/** projeta um ponto do mundo na pista partindo de um s conhecido (como projectPlayer do original) */
export function project(r: Route, x: number, z: number, sHint: number): { s: number; x: number } {
  let s = sHint;
  for (let k = 0; k < 3; k++) {
    frameAt(r, s, _f);
    s += (x - _f.x) * _f.fx + (z - _f.z) * _f.fz;
  }
  frameAt(r, s, _f);
  return { s, x: (x - _f.x) * _f.rx + (z - _f.z) * _f.rz };
}

/** ponto do mundo em (s, x) */
export function worldAt(r: Route, s: number, x: number): { x: number; z: number; heading: number } {
  frameAt(r, s, _f);
  return { x: _f.x + _f.rx * x, z: _f.z + _f.rz * x, heading: Math.atan2(_f.fx, _f.fz) };
}
