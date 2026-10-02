// Transforma o layout da cidade em malhas: chão, calçadas, casas de laje,
// muros pixados, comércio com letreiro aceso, postes de luz de sódio, fios,
// Caixa d'Água no balão, feira com paredão, posto, terrão, cerrado, horizonte.

import * as THREE from 'three';
import { GeoBuilder, hex, type RGB, type UVRect } from '../utils/geo';
import { mulberry32, pick, range } from '../utils/rng';
import {
  AVENUE_Z, BALAO, BLOCK_HALF, BORDER, CURB_H, EXTENT, GRID_EDGE, NODES, OLD_BORDER, PITCH, ROAD, SHOP_NAMES, SIDEWALK,
  inBalao, nodePos, type City, type Lamp, type Lot,
} from './city';
import { ATLAS_ROWS, GRAFF_MURALS, GRAFF_TAGS, ROW, SIGN_ROW, type Textures } from './textures';
import { buildVehicle, PAINTS } from '../traffic/vehicles';
import { patchTriplanar } from '../fx/triplanar';
import type { Assets } from '../assets';
import { isCovered } from './props';
import { WIRE_TIES, type LampModel } from './lampModel';

const TILE_W = 12; // metros por largura de linha do atlas
const FLOOR_H = 3;

function rowUV(row: number, u0: number, u1: number, vf0 = 0, vf1 = 1): UVRect {
  // linhas 16+ ficam na metade direita do atlas (grafites temáticos)
  const half = row >= ROW.graff0 ? 1 : 0;
  const r = row - half * ROW.graff0;
  const top = 1 - r / ATLAS_ROWS;
  const bot = 1 - (r + 1) / ATLAS_ROWS;
  const h = top - bot;
  // encolhe meio texel pra não sangrar a linha vizinha (e a outra metade)
  const e = 0.5 / (256 * ATLAS_ROWS);
  const eu = 1 / 2048;
  const u = (t: number) => half * 0.5 + eu + t * (0.5 - 2 * eu);
  return [u(u0), bot + h * vf0 + e, u(u1), bot + h * vf1 - e];
}

/** mural: às vezes os dois antigos, quase sempre os temáticos (BSBASS, favela, Brasil, DF) */
function muralRow(rnd: () => number): number {
  return rnd() < 0.15 ? ROW.grafite0 + Math.floor(rnd() * 2) : ROW.graff0 + Math.floor(rnd() * GRAFF_MURALS);
}

/** parede pixada: metade pixo reto, metade tags temáticas */
function tagRow(rnd: () => number): number {
  return rnd() < 0.5 ? ROW.pixo0 + Math.floor(rnd() * 6) : ROW.graff0 + GRAFF_MURALS + Math.floor(rnd() * GRAFF_TAGS);
}

function spanUV(row: number, width: number, rnd: () => number, vf0 = 0, vf1 = 1): UVRect {
  // mural é palavra inteira: espreme na parede em vez de cortar no meio
  const mural = (row >= ROW.grafite0 && row < ROW.grafite0 + 2) || (row >= ROW.graff0 && row < ROW.graff0 + GRAFF_MURALS);
  const span = mural ? 1 : Math.min(1, width / TILE_W);
  const u0 = rnd() * (1 - span);
  return rowUV(row, u0, u0 + span, vf0, vf1);
}

function tileUV(row: number, col: number, cols = 4): UVRect {
  return rowUV(row, col / cols + 0.004, (col + 1) / cols - 0.004);
}

function signUV(i: number): UVRect {
  const top = 1 - i / 16, bot = 1 - (i + 1) / 16;
  return [0, bot, 1, top];
}

const PAINT_COLORS = [0xe3cf86, 0x9cc3d4, 0xe0a0a0, 0xa9d1a4, 0xe8b070, 0xcdbfe6, 0xf0ece4, 0x7fb0a8, 0xd8d890, 0xe6c0d0];

export interface CityMeshes {
  group: THREE.Group;
  lampLights: THREE.Vector3[]; // posição das cabeças dos postes
  paredaoLeds: THREE.MeshBasicMaterial; // pisca com o grave
  beacon: THREE.MeshBasicMaterial; // luz de obstáculo da caixa d'água
  /** postes que dá pra derrubar (instanciados, um por instância) */
  lampInst: LampInstances | null;
  /** grupos de peças pesadas dos postes (some de longe) */
  lampDetail: THREE.InstancedMesh[];
  /** fios: cada trecho liga dois postes (pra sumir quando um deles cai) */
  wires: { mesh: THREE.LineSegments; ranges: { a: Lamp; b: Lamp; start: number; end: number }[] };
}

export interface LampInstances {
  lamps: Lamp[];
  /** índice em lampLights de cada poste */
  light: number[];
  /** peças de cada variante de poste (corpo + braço + cabeça), que caem juntas */
  body: THREE.InstancedMesh[][];
  /** variante de cada poste e a instância dele dentro das peças da variante */
  variant: number[];
  slot: number[];
  /** parte pesada do poste (cruzeta com isoladores), separada por pedaço da cidade */
  detail: ({ im: THREE.InstancedMesh; slot: number } | null)[];
  /** mancha de luz no chão (some quando o poste cai) */
  pool: THREE.InstancedMesh;
  /** matriz de cada poste em pé */
  base: THREE.Matrix4[];
}

const LAMP_H = 9;
/** lado (m) dos pedaços da cidade em que as cruzetas dos postes são agrupadas */
const DETAIL_TILE = 160;

/** poste de braço único, com o braço apontando pra +Z local */
function lampProto(flat: GeoBuilder, emissive: GeoBuilder): void {
  const H = LAMP_H;
  flat.mat = 1;
  flat.box(0, H / 2, 0, 0.26, H, 0.26, hex(0x8c8a84));
  flat.mat = 2;
  flat.box(0, 0.6, 0, 0.3, 1.2, 0.3, hex(0x6a6862)); // pé pixado/sujo
  flat.mat = 3;
  flat.box(0, H - 0.1, 1.1, 0.1, 0.1, 2.3, hex(0x55544f));
  flat.box(0, H - 0.25, 2.2, 0.36, 0.2, 0.7, hex(0x3a3a38));
  emissive.box(0, H - 0.37, 2.2, 0.3, 0.04, 0.6, hex(0xffb050, 3.2));
  flat.mat = 0;
}

export function buildCityMeshes(city: City, tx: Textures, real: Assets['tex'] = {}, hasProps = false, skipTrees = false, skipParked = false, lampModel: LampModel | null = null): CityMeshes {
  const rnd = mulberry32(1961);
  const group = new THREE.Group();

  const walls = new GeoBuilder(); // atlas de paredes
  const glow = new GeoBuilder(); // janelas acesas (textura litWindow)
  const signs = new GeoBuilder(); // letreiros (atlas de lojas)
  const flat = new GeoBuilder(); // coisas de cor sólida (postes, caixa d'água, árvores...)
  const emissive = new GeoBuilder(); // luzes sem textura
  const sidewalk = new GeoBuilder();
  const green = new GeoBuilder(); // placas verdes
  const marks = new GeoBuilder(); // pintura no asfalto
  const pools = new GeoBuilder(); // manchas de luz no chão
  const dirt = new GeoBuilder();
  const lines: number[] = []; // fios de poste
  const wireRanges: CityMeshes['wires']['ranges'] = [];
  const lampLights: THREE.Vector3[] = [];

  // ================= casas =================
  // bairros novos (fora do muro antigo) em malhas próprias: a câmera descarta o bairro que não está na tela
  const districts = new Map<string, { walls: GeoBuilder; glow: GeoBuilder; signs: GeoBuilder; flat: GeoBuilder; emissive: GeoBuilder }>();
  for (const lot of city.lots) {
    if (Math.max(Math.abs(lot.x), Math.abs(lot.z)) < OLD_BORDER) {
      buildLot(lot, walls, glow, signs, flat, emissive, lines);
      continue;
    }
    const key = `${Math.sign(lot.x)},${Math.sign(lot.z)}`;
    let d = districts.get(key);
    if (!d) districts.set(key, (d = { walls: new GeoBuilder(), glow: new GeoBuilder(), signs: new GeoBuilder(), flat: new GeoBuilder(), emissive: new GeoBuilder() }));
    buildLot(lot, d.walls, d.glow, d.signs, d.flat, d.emissive, lines);
  }

  // ================= calçadas =================
  for (const b of city.blocks) {
    const open = b.kind === 'terrao' || b.kind === 'feira' || b.kind === 'posto';
    if (b.kind === 'terrao' || b.kind === 'ferro') {
      // anel de calçada + chão de terra (o ferro-velho põe o pátio por cima)
      const h = BLOCK_HALF, s = SIDEWALK;
      slab(sidewalk, b.x, b.z + h - s / 2, h * 2, s);
      slab(sidewalk, b.x, b.z - h + s / 2, h * 2, s);
      slab(sidewalk, b.x + h - s / 2, b.z, s, h * 2 - 2 * s);
      slab(sidewalk, b.x - h + s / 2, b.z, s, h * 2 - 2 * s);
      dirt.setTransform(b.x, 0.015, b.z, 0);
      const d = h - s;
      dirt.quad([-d, 0, d], [d, 0, d], [d, 0, -d], [-d, 0, -d], [0, 0, d / 6, d / 6]);
      dirt.resetTransform();
      if (b.kind === 'terrao') buildTerrao(flat, b.x, b.z);
      continue;
    }
    if (open) {
      // feira e posto: piso de concreto com meio-fio baixo
      concreteLot(sidewalk, b.x, b.z);
      if (b.kind === 'feira') buildFeira(flat, emissive, signs, marks, b.x, b.z, rnd);
      else buildPosto(flat, emissive, signs, pools, walls, b.x, b.z);
      continue;
    }
    if (inBalao(b.x, b.z, BLOCK_HALF * 1.5)) {
      balaoSlab(sidewalk, b.x, b.z);
    } else {
      slab(sidewalk, b.x, b.z, BLOCK_HALF * 2, BLOCK_HALF * 2);
    }
    if (b.kind === 'praca') buildPraca(flat, emissive, marks, b.x, b.z);
  }

  // ================= becos, terrenos baldios e miolo de quadra aberto =================
  for (const o of city.openLots) {
    if (o.kind === 'vacant') {
      dirt.setTransform(o.x, CURB_H + 0.012, o.z, o.rot);
      const hw = o.w / 2, hd = o.d / 2;
      dirt.quad([-hw, 0, hd], [hw, 0, hd], [hw, 0, -hd], [-hw, 0, -hd], [0, 0, o.w / 6, o.d / 6]);
      dirt.resetTransform();
    } else {
      // beco: canaleta escura no meio do piso
      flat.setTransform(o.x, CURB_H, o.z, o.rot);
      flat.mat = 1;
      flat.box(0, 0.006, 0, 0.4, 0.012, o.d, hex(0x2e2e30));
      flat.mat = 0;
      flat.resetTransform();
    }
  }
  for (const c of city.courtyards) {
    // miolo de terra batida (dá pra atravessar a quadra pelo beco)
    dirt.setTransform(c.x, CURB_H + 0.012, c.z, 0);
    const h = c.half;
    dirt.quad([-h, 0, h], [h, 0, h], [h, 0, -h], [-h, 0, -h], [0, 0, h / 6, h / 6]);
    dirt.resetTransform();
    // poste de madeira com lâmpada no meio do miolo
    flat.mat = 3;
    flat.box(c.x + 3, CURB_H + 2.3, c.z - 2, 0.18, 4.6, 0.18, hex(0x5a4030));
    flat.box(c.x + 3, CURB_H + 4.5, c.z - 1.6, 0.08, 0.08, 0.8, hex(0x333333));
    flat.mat = 0;
    emissive.box(c.x + 3, CURB_H + 4.4, c.z - 1.2, 0.22, 0.22, 0.22, hex(0xffc070, 3));
    lampLights.push(new THREE.Vector3(c.x + 3, CURB_H + 4.1, c.z - 1.2));
    poolQuad(pools, c.x + 3, c.z - 1.2, 11, hex(0xff9a3c, 0.4), CURB_H + 0.03);
  }

  // ================= fora da grade: estrada de terra, rodovias, Estrutural, Serra, bairros =================
  const trail = new GeoBuilder();
  const highway = new GeoBuilder();
  const asphaltRoads = city.outerRoads.filter((r) => r.kind === 'asphalt' && !r.disc);
  for (const r of city.outerRoads) {
    if (r.kind === 'dirt') {
      ribbon(trail, r.pts, r.w, 0.02, !!r.loop, 0, r.w / 6, 6, hex(0xffffff));
      continue;
    }
    if (r.disc) {
      // praça redonda (mirante)
      const [c0, c1] = r.pts;
      const cx = (c0![0] + c1![0]) / 2, cz = (c0![1] + c1![1]) / 2, R = r.w / 2;
      const ring: [number, number][] = [];
      for (let k = 0; k < 48; k++) ring.push([cx + Math.cos((k / 48) * Math.PI * 2) * R, cz + Math.sin((k / 48) * Math.PI * 2) * R]);
      for (let k = 0; k < 48; k++) {
        const p = ring[k]!, q = ring[(k + 1) % 48]!;
        // fatia de pizza (centro repetido no 3º e 4º vértice: a normal sai de dois lados distintos)
        const A: [number, number, number] = [p[0], 0.04, p[1]], B: [number, number, number] = [q[0], 0.04, q[1]], O: [number, number, number] = [cx, 0.04, cz];
        const up = (B[2] - A[2]) * (O[0] - A[0]) - (B[0] - A[0]) * (O[2] - A[2]) > 0;
        highway.quad(A, up ? B : O, O, up ? O : B, [p[0] / 7, p[1] / 7, q[0] / 7, q[1] / 7], hex(0xffffff));
      }
      ribbon(marks, ring, 0.18, 0.046, true, -0.8, 1, 1, hex(0xdedede, 0.8));
      continue;
    }
    // a rua que chega numa maior para na beira dela (sem duas camadas de asfalto brigando)
    const pts = r.loop ? r.pts : trimInto(r.pts, asphaltRoads.filter((o) => o !== r && o.w >= r.w));
    if (pts.length < 2) continue;
    // a maior por cima: Estrutural > anel de bairro > ligações > ruas do miolo
    const rank = r.name === 'VIA ESTRUTURAL' ? 3 : r.loop ? 2 : r.w >= 14 ? 1 : 0;
    const y = 0.022 + rank * 0.008;
    ribbon(highway, pts, r.w, y, !!r.loop, 0, r.w / 7, 7, hex(0xffffff));
    const my = y + 0.005;
    // bordas brancas
    for (const off of [-(r.w / 2 - 0.5), r.w / 2 - 0.5]) ribbon(marks, pts, 0.15, my, !!r.loop, off, 1, 1, hex(0xdedede, 0.8));
    if (r.w >= 20) {
      // via expressa: faixa dupla amarela no meio e faixas brancas tracejadas
      for (const off of [-0.18, 0.18]) ribbon(marks, pts, 0.12, my, !!r.loop, off, 1, 1, hex(0xe8b21e, 0.9));
      for (const off of [-r.w / 4, r.w / 4]) ribbon(marks, dashPts(pts, 3, 6, !!r.loop), 0.13, my, false, off, 1, 1, hex(0xdedede, 0.75), 1);
    } else if (r.name === 'ESTRADA DA SERRA') {
      // serra: faixa dupla contínua (proibido ultrapassar... no papel)
      for (const off of [-0.16, 0.16]) ribbon(marks, pts, 0.11, my, false, off, 1, 1, hex(0xe8b21e, 0.9));
    } else {
      ribbon(marks, dashPts(pts, 4, 8, !!r.loop), 0.16, my, false, 0, 1, 1, hex(0xe8b21e, 0.9), 1);
    }
  }

  // ================= marcações de rua =================
  const Y = 0.012;
  for (let n = 0; n < NODES; n++) {
    const c = nodePos(n);
    for (let s = 0; s < NODES - 1; s++) {
      const a = nodePos(s) + ROAD / 2 + 3, b = nodePos(s + 1) - ROAD / 2 - 3;
      for (const vertical of [true, false]) {
        const isAvenue = !vertical && c === AVENUE_Z;
        // linha central
        if (!isAvenue) {
          for (let t = a; t < b - 3; t += 8) {
            const t1 = Math.min(t + 4, b);
            if (inBalao(vertical ? c : (t + t1) / 2, vertical ? (t + t1) / 2 : c, 4)) continue;
            stripe(marks, vertical, c, t, t1, 0.14, hex(0xe8b21e, 0.9));
          }
        } else {
          for (let t = a; t < b - 3; t += 8) {
            const t1 = Math.min(t + 4, b);
            if (inBalao((t + t1) / 2, c, 4)) continue;
            for (const off of [-5, 5]) stripe(marks, vertical, c + off, t, t1, 0.12, hex(0xdedede, 0.8));
          }
        }
        // bordas contínuas
        for (const off of [-(ROAD / 2 - 0.6), ROAD / 2 - 0.6]) {
          let t0 = a;
          const step = 6;
          for (let t = a; t < b; t += step) {
            const t1 = Math.min(t + step, b);
            if (inBalao(vertical ? c + off : (t + t1) / 2, vertical ? (t + t1) / 2 : c + off, 3)) { t0 = t1; continue; }
            if (t1 >= b || inBalao(vertical ? c + off : t1 + step / 2, vertical ? t1 + step / 2 : c + off, 3)) {
              stripe(marks, vertical, c + off, t0, t1, 0.12, hex(0xdedede, 0.75));
              t0 = t1;
            }
          }
        }
      }
    }
  }
  // faixas de pedestre nos cruzamentos
  for (let i = 0; i < NODES; i++) {
    for (let j = 0; j < NODES; j++) {
      const x = nodePos(i), z = nodePos(j);
      if (inBalao(x, z, 20)) continue;
      if ((i * 7 + j * 3) % 3 === 0) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const cx = x + dx * (ROAD / 2 + 1.8), cz = z + dz * (ROAD / 2 + 1.8);
        if (Math.abs(cx) > EXTENT || Math.abs(cz) > EXTENT) continue;
        for (let k = -4; k <= 4; k++) {
          const along = k * 1.9;
          const px = dx !== 0 ? cx : x + along, pz = dz !== 0 ? cz : z + along;
          marks.setTransform(px, Y, pz, dx !== 0 ? 0 : Math.PI / 2);
          marks.quad([-0.45, 0, 1.4], [0.45, 0, 1.4], [0.45, 0, -1.4], [-0.45, 0, -1.4], [0, 0, 0.5, 1], hex(0xe0e0e0, 0.8));
        }
      }
    }
  }
  marks.resetTransform();

  // ================= canteiro da avenida =================
  for (const m of city.medians) {
    const len = m.x1 - m.x0;
    flat.setTransform((m.x0 + m.x1) / 2, 0, AVENUE_Z, 0);
    flat.mat = 1;
    flat.box(0, 0.14, 0, len, 0.28, 1.6, hex(0xa8a39a));
    flat.mat = 0;
    flat.box(0, 0.285, 0, len - 0.2, 0.01, 1.3, hex(0x28331f));
    flat.mat = 1;
    // listras amarelas e pretas nas pontas
    for (const s of [-1, 1]) flat.box(s * (len / 2 - 0.4), 0.3, 0, 0.8, 0.02, 1.62, hex(0xe8b21e));
  }
  flat.resetTransform();

  // ================= balão + Caixa d'Água =================
  flat.mat = 1;
  flat.cylinder(0, 0, 0, BALAO.island, BALAO.island, 0.3, 40, hex(0xa8a39a));
  flat.mat = 0;
  flat.cylinder(0, 0.301, 0, BALAO.island - 0.4, BALAO.island - 0.4, 0.001, 40, hex(0x4a3a20));
  buildCaixaDagua(flat, emissive);
  // faixa do balão
  for (let k = 0; k < 48; k++) {
    if (k % 2) continue;
    const a0 = (k / 48) * Math.PI * 2, a1 = ((k + 1) / 48) * Math.PI * 2;
    const r0 = BALAO.island + 5.5, r1 = r0 + 0.14;
    const p = (a: number, r: number): [number, number, number] => [Math.cos(a) * r, Y, Math.sin(a) * r];
    marks.quad(p(a0, r1), p(a1, r1), p(a1, r0), p(a0, r0), [0, 0, 1, 1], hex(0xdedede, 0.8));
  }

  // ================= postes =================
  // os de calçada (com colisor) viram instâncias pra poder cair um por um
  const breakLamps = city.lamps.filter((l) => l.shape && (l.dirX !== 0 || l.dirZ !== 0));
  const lampLight: number[] = [];
  const lampBase: THREE.Matrix4[] = [];
  for (const l of breakLamps) {
    lampLight.push(lampLights.length);
    lampLights.push(new THREE.Vector3(l.x + l.dirX * 2.2, LAMP_H - 0.6, l.z + l.dirZ * 2.2));
    lampBase.push(new THREE.Matrix4().makeRotationY(Math.atan2(l.dirX, l.dirZ)).setPosition(l.x, 0, l.z));
  }
  const medianPoles: THREE.Matrix4[] = [], medianArms: THREE.Matrix4[] = [];
  for (const l of city.lamps) {
    if (l.shape && (l.dirX !== 0 || l.dirZ !== 0)) continue;
    const double = l.dirX === 0 && l.dirZ === 0;
    if (lampModel) {
      // poste de verdade (instanciado lá embaixo): aqui só luz e mancha no chão
      const arms: [number, number][] = double ? [[0, 1], [0, -1]] : [[l.dirX, l.dirZ]];
      arms.forEach(([dx, dz], k) => {
        const ax = l.x + dx * 2.2, az = l.z + dz * 2.2;
        (k === 0 ? medianPoles : medianArms).push(new THREE.Matrix4().makeRotationY(Math.atan2(dx, dz)).setPosition(l.x, 0, l.z));
        lampLights.push(new THREE.Vector3(ax, LAMP_H - 0.6, az));
        poolQuad(pools, ax, az, 10.5, hex(0xff9a3c, 0.46));
      });
      continue;
    }
    const arms: [number, number][] = double ? [[0, 1], [0, -1]] : [[l.dirX, l.dirZ]];
    const H = 9;
    flat.setTransform(l.x, 0, l.z, 0);
    flat.mat = 1;
    flat.box(0, H / 2, 0, 0.26, H, 0.26, hex(0x8c8a84));
    flat.mat = 2;
    flat.box(0, 0.6, 0, 0.3, 1.2, 0.3, hex(0x6a6862)); // pé pixado/sujo
    flat.mat = 3;
    flat.resetTransform();
    for (const [dx, dz] of arms) {
      const ax = l.x + dx * 2.2, az = l.z + dz * 2.2;
      const rot = Math.atan2(dx, dz);
      flat.setTransform(l.x, 0, l.z, rot);
      flat.box(0, H - 0.1, 1.1, 0.1, 0.1, 2.3, hex(0x55544f));
      flat.box(0, H - 0.25, 2.2, 0.36, 0.2, 0.7, hex(0x3a3a38));
      emissive.setTransform(l.x, 0, l.z, rot);
      emissive.box(0, H - 0.37, 2.2, 0.3, 0.04, 0.6, hex(0xffb050, 3.2));
      flat.mat = 3;
      lampLights.push(new THREE.Vector3(ax, H - 0.6, az));
      // mancha de luz no chão
      poolQuad(pools, ax, az, 10.5, hex(0xff9a3c, 0.46));
    }
  }
  flat.resetTransform();
  flat.mat = 0;
  emissive.resetTransform();

  // fios entre postes vizinhos (mesma calçada)
  const byLine = new Map<string, Lamp[]>();
  for (const l of city.lamps) {
    if (l.dirX === 0 && l.dirZ === 0) continue;
    const key = l.dirX !== 0 ? `x${l.x.toFixed(1)}` : `z${l.z.toFixed(1)}`;
    if (!byLine.has(key)) byLine.set(key, []);
    byLine.get(key)!.push(l);
  }
  for (const [key, list] of byLine) {
    list.sort((a, b) => (key[0] === 'x' ? a.z - b.z : a.x - b.x));
    for (let k = 0; k + 1 < list.length; k++) {
      const a = list[k]!, b = list[k + 1]!;
      if (Math.hypot(a.x - b.x, a.z - b.z) > 40) continue;
      const start = lines.length;
      wireRanges.push({ a, b, start, end: 0 });
      // poste de verdade: amarra nos isoladores da cruzeta (que atravessa a calçada)
      const ties: [number, number][] = lampModel ? WIRE_TIES : [[0, 8.2], [0, 7.6], [0, 7.0]];
      for (const [off, h] of ties) {
        const ox = a.dirX * off, oz = a.dirZ * off;
        const seg = 6;
        for (let s = 0; s < seg; s++) {
          const t0 = s / seg, t1 = (s + 1) / seg;
          const sag = (t: number) => h - Math.sin(t * Math.PI) * 0.9;
          lines.push(a.x + ox + (b.x - a.x) * t0, sag(t0), a.z + oz + (b.z - a.z) * t0);
          lines.push(a.x + ox + (b.x - a.x) * t1, sag(t1), a.z + oz + (b.z - a.z) * t1);
        }
      }
      wireRanges[wireRanges.length - 1]!.end = lines.length;
    }
  }

  // ================= placas verdes =================
  city.signs.forEach((s, k) => {
    flat.setTransform(s.x, 0, s.z, s.rot);
    flat.mat = 3;
    flat.box(-1.6, 1.9, 0, 0.1, 3.8, 0.1, hex(0x777777));
    flat.box(1.6, 1.9, 0, 0.1, 3.8, 0.1, hex(0x777777));
    green.setTransform(s.x, 0, s.z, s.rot);
    green.wallZ(-1.9, 1.9, 3.0, 3.95, 0.06, signUV(k % 16));
    flat.box(0, 3.47, 0, 3.8, 0.95, 0.06, hex(0x0d5a34, 0.6));
    flat.mat = 0;
  });
  flat.resetTransform();
  green.resetTransform();

  // ================= carros estacionados =================
  const parkedB = new GeoBuilder();
  const parkedGroup: THREE.BufferGeometry[] = [];
  for (const p of skipParked ? [] : city.parked) {
    if (hasProps && isCovered(p)) continue; // esses viram "carro com capa" (props.ts)
    const v = buildVehicle(p.model, PAINTS[p.color % PAINTS.length]!, false);
    const m = new THREE.Matrix4().makeRotationY(p.rot).setPosition(p.x, 0, p.z);
    v.body.applyMatrix4(m);
    parkedGroup.push(v.body);
  }
  void parkedB;

  // ================= árvores =================
  if (!skipTrees) for (const t of city.trees) buildTree(flat, t.x, t.z, t.s, t.kind, rnd);

  // ================= muro do fim do mapa =================
  const W = BORDER;
  for (const [x0, z0, x1, z1] of [[-W, W, W, W], [W, -W, -W, -W], [W, W, W, -W], [-W, -W, -W, W]] as const) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const rot = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
    const n = Math.ceil(len / 10);
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n;
      const ax = x0 + (x1 - x0) * t0, az = z0 + (z1 - z0) * t0;
      const bx = x0 + (x1 - x0) * t1, bz = z0 + (z1 - z0) * t1;
      const row = rnd() < 0.55 ? tagRow(rnd) : rnd() < 0.7 ? muralRow(rnd) : ROW.block;
      walls.quad([bx, 0, bz], [ax, 0, az], [ax, 3.2, az], [bx, 3.2, bz], spanUV(row, 10, rnd), [1, 1, 1]);
      walls.quad([ax, 0, az], [bx, 0, bz], [bx, 3.2, bz], [ax, 3.2, az], spanUV(ROW.block, 10, rnd), [0.8, 0.8, 0.8]);
    }
    void rot;
  }

  // ================= materiais / meshes =================
  const wallMat = new THREE.MeshStandardMaterial({ map: tx.wall, vertexColors: true, roughness: 0.92, metalness: 0 });
  const flatMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 });
  patchTriplanar(flatMat, { conc: real.conc, rebar: real.rebar, metal: real.metal });
  const glowMat = new THREE.MeshBasicMaterial({ map: tx.litWindow, vertexColors: true });
  const signMat = new THREE.MeshBasicMaterial({ map: tx.shops, vertexColors: true });
  const emisMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const walkMat = new THREE.MeshStandardMaterial({ map: real.sidewalk ?? tx.sidewalk, vertexColors: true, roughness: 0.9 });
  (real.sidewalk ?? tx.sidewalk).repeat.set(0.5, 0.5);
  if (real.sidewalk_n) {
    real.sidewalk_n.repeat.set(0.5, 0.5);
    walkMat.normalMap = real.sidewalk_n;
    walkMat.color.setHex(0xc8c0b4);
  }
  const greenMat = new THREE.MeshStandardMaterial({ map: tx.signs, roughness: 0.6, emissive: 0x0a2a18, emissiveIntensity: 0.4 });
  const marksMat = new THREE.MeshStandardMaterial({ map: tx.marks, vertexColors: true, roughness: 0.7, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const poolMat = new THREE.MeshBasicMaterial({ map: tx.pool, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 });
  const dirtMat = new THREE.MeshStandardMaterial({ map: real.dirt ?? tx.dirt, roughness: 1 });
  if (real.dirt) {
    // terra do cerrado: puxa a foto pro vermelho
    dirtMat.color.setHex(0xe07a52);
    if (real.dirt_n) {
      dirtMat.normalMap = real.dirt_n;
      dirtMat.normalScale.set(1.2, 1.2);
    }
  }

  const add = (b: GeoBuilder, m: THREE.Material, name: string, order = 0) => {
    if (b.vertexCount === 0) return;
    const mesh = new THREE.Mesh(b.build(), m);
    mesh.name = name;
    mesh.renderOrder = order;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  };
  add(walls, wallMat, 'walls');
  add(flat, flatMat, 'flat');
  add(glow, glowMat, 'glow');
  add(signs, signMat, 'signs');
  add(emissive, emisMat, 'emissive');
  add(sidewalk, walkMat, 'sidewalk');
  add(green, greenMat, 'green');
  add(marks, marksMat, 'marks', 1);
  add(pools, poolMat, 'pools', 2);
  add(dirt, dirtMat, 'dirt');
  // estrada de terra batida: a mesma terra, mais clara e lisa
  const trailMat = dirtMat.clone();
  trailMat.color.setHex(real.dirt ? 0xf0b088 : 0xd0a080);
  add(trail, trailMat, 'trail');
  // rodovia: asfalto com textura em metros (repete a cada 7 m)
  const hwTex = (real.asphalt ?? tx.asphalt).clone();
  hwTex.repeat.set(1, 1);
  hwTex.wrapS = hwTex.wrapT = THREE.RepeatWrapping;
  hwTex.needsUpdate = true;
  add(highway, new THREE.MeshStandardMaterial({ map: hwTex, roughness: 0.8, color: real.asphalt ? 0xb8b0a8 : 0xa8a29c }), 'highway');
  for (const [key, d] of districts) {
    add(d.walls, wallMat, `walls ${key}`);
    add(d.flat, flatMat, `flat ${key}`);
    add(d.glow, glowMat, `glow ${key}`);
    add(d.signs, signMat, `signs ${key}`);
    add(d.emissive, emisMat, `emissive ${key}`);
  }
  // morros da serra
  if (city.region.mounds.length) {
    const hillMat = new THREE.MeshStandardMaterial({ map: dirtMat.map, normalMap: dirtMat.normalMap, vertexColors: true, roughness: 1, flatShading: true });
    const hills = new THREE.Mesh(buildHills(city.region.mounds), hillMat);
    hills.name = 'hills';
    hills.matrixAutoUpdate = false;
    group.add(hills);
  }

  // carros estacionados (um draw call)
  if (parkedGroup.length) {
    const merged = mergeGeos(parkedGroup);
    const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.5 }));
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }

  // fios
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  const wires = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x07070a, transparent: true, opacity: 0.8 }));
  wires.matrixAutoUpdate = false;
  group.add(wires);

  // postes derrubáveis: uma instância por poste (cada variante com as suas peças)
  let lampInst: LampInstances | null = null;
  const lampDetail: THREE.InstancedMesh[] = [];
  const instOf = (geo: THREE.BufferGeometry, m: THREE.Material, mats: THREE.Matrix4[], name: string, order = 0) => {
    const im = new THREE.InstancedMesh(geo, m, Math.max(1, mats.length));
    im.count = mats.length;
    mats.forEach((mx, i) => im.setMatrixAt(i, mx));
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.computeBoundingSphere();
    im.name = name;
    im.renderOrder = order;
    group.add(im);
    return im;
  };
  if (breakLamps.length) {
    const pp = new GeoBuilder();
    poolQuad(pp, 0, 2.2, 10.5, hex(0xff9a3c, 0.46));
    const pool = instOf(pp.build(), poolMat, lampBase, 'lampPools', 2);
    if (lampModel) {
      const nv = lampModel.variants.length;
      // um em cada quatro com transformador (quando tem a segunda variante)
      const variant = breakLamps.map((_, i) => (nv > 1 && i % 4 === 1 ? 1 : 0));
      const slot: number[] = [];
      const per = lampModel.variants.map(() => [] as THREE.Matrix4[]);
      variant.forEach((v, i) => {
        slot.push(per[v]!.length);
        per[v]!.push(lampBase[i]!);
      });
      const body = lampModel.variants.map((vt, v) => vt.parts.map((p, k) => instOf(p.geo, p.mat, per[v]!, `lampPole${v}_${k}`)));
      // cruzetas: um InstancedMesh por pedaço da cidade e variante (dá pra cortar o que está longe/fora da tela)
      const tileOf = (x: number, z: number) => `${Math.floor((x + EXTENT + ROAD) / DETAIL_TILE)},${Math.floor((z + EXTENT + ROAD) / DETAIL_TILE)}`;
      const groups = new Map<string, number[]>();
      breakLamps.forEach((l, i) => {
        const k = `${variant[i]}|${tileOf(l.x, l.z)}`;
        const g = groups.get(k);
        if (g) g.push(i);
        else groups.set(k, [i]);
      });
      const detail: ({ im: THREE.InstancedMesh; slot: number } | null)[] = breakLamps.map(() => null);
      for (const [k, list] of groups) {
        const v = Number(k.split('|')[0]);
        const d = lampModel.variants[v]!.detail;
        if (!d) continue;
        const im = instOf(d.geo, d.mat, list.map((i) => lampBase[i]!), `lampDetail${k}`);
        lampDetail.push(im);
        list.forEach((i, slot) => (detail[i] = { im, slot }));
      }
      lampInst = { lamps: breakLamps, light: lampLight, body, variant, slot, detail, pool, base: lampBase };
    } else {
      const pf = new GeoBuilder(), pe = new GeoBuilder();
      lampProto(pf, pe);
      lampInst = {
        lamps: breakLamps,
        light: lampLight,
        body: [[instOf(pf.build(), flatMat, lampBase, 'lampPoles'), instOf(pe.build(), emisMat, lampBase, 'lampHeads')]],
        variant: breakLamps.map(() => 0),
        slot: breakLamps.map((_, i) => i),
        detail: breakLamps.map(() => null),
        pool,
        base: lampBase,
      };
    }
  }
  // postes do canteiro (braço duplo): o poste uma vez, o braço de cada lado
  if (lampModel && medianPoles.length) {
    const v0 = lampModel.variants[0]!;
    v0.parts.forEach((p, k) => instOf(p.geo, p.mat, medianPoles, `medianPole${k}`));
    if (v0.detail) lampDetail.push(instOf(v0.detail.geo, v0.detail.mat, medianPoles, 'lampDetailMedian'));
    if (medianArms.length) lampModel.arm.forEach((p, k) => instOf(p.geo, p.mat, medianArms, `medianArm${k}`));
  }

  // chão: asfalto + terra do cerrado em volta
  const aSize = EXTENT * 2 + ROAD;
  tx.asphalt.repeat.set(aSize / 9, aSize / 9);
  const asphaltMat = new THREE.MeshStandardMaterial({ map: tx.asphalt, roughness: 0.82, metalness: 0.0, color: 0xb0aaa4 });
  if (real.asphalt) {
    // asfalto de verdade (foto + relevo + rugosidade), repetindo a cada 7 m
    for (const t of [real.asphalt, real.asphalt_n, real.asphalt_r]) t?.repeat.set(aSize / 7, aSize / 7);
    asphaltMat.map = real.asphalt;
    asphaltMat.color.setHex(0xc4bcb4);
    if (real.asphalt_n) asphaltMat.normalMap = real.asphalt_n;
    if (real.asphalt_r) {
      asphaltMat.roughnessMap = real.asphalt_r;
      asphaltMat.roughness = 1;
    }
  }
  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(EXTENT * 2 + ROAD, EXTENT * 2 + ROAD),
    asphaltMat,
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.y = 0.005;
  asphalt.name = 'asphalt';
  group.add(asphalt);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshStandardMaterial({ map: (real.dirt ?? tx.dirt).clone(), roughness: 1, color: real.dirt ? 0xb06040 : 0x8a6a5a }),
  );
  const gmap = (ground.material as THREE.MeshStandardMaterial).map!;
  gmap.wrapS = gmap.wrapT = THREE.RepeatWrapping;
  gmap.repeat.set(4000 / 14, 4000 / 14);
  gmap.needsUpdate = true;
  ground.rotation.x = -Math.PI / 2;
  ground.name = 'ground';
  group.add(ground);

  // paredão (LEDs que pulsam com o grave)
  const paredaoLeds = new THREE.MeshBasicMaterial({ color: 0x33e0ff });
  const feira = city.blocks.find((b) => b.kind === 'feira');
  if (feira) group.add(buildParedao(feira.x - 30, feira.z - 10, paredaoLeds));

  const beacon = new THREE.MeshBasicMaterial({ color: 0xff2010 });
  const bMesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), beacon);
  bMesh.position.set(0, 30.6, 0);
  group.add(bMesh);

  group.add(buildHorizon(tx));

  return { group, lampLights, paredaoLeds, beacon, lampInst, lampDetail, wires: { mesh: wires, ranges: wireRanges } };
}

// ------------------------------------------------------------------

function mergeGeos(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = [];
  let off = 0;
  for (const g of list) {
    const p = g.getAttribute('position'), n = g.getAttribute('normal'), c = g.getAttribute('color');
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      col.push(c.getX(i), c.getY(i), c.getZ(i));
    }
    const ix = g.getIndex()!;
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off);
    off += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setIndex(new THREE.Uint32BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

/**
 * faixa no chão seguindo uma linha (estrada fora da grade). off = deslocamento
 * lateral; uw/vlen = UV por largura e por metros ao longo; dash > 0 pula trechos.
 */
function ribbon(b: GeoBuilder, pts: [number, number][], w: number, y: number, loop: boolean, off: number, uw: number, vlen: number, col: RGB, dash = 0): void {
  const n = pts.length, m = loop ? n : n - 1;
  const nor = pts.map((_, i) => {
    const a = pts[loop ? (i - 1 + n) % n : Math.max(0, i - 1)]!, c = pts[loop ? (i + 1) % n : Math.min(n - 1, i + 1)]!;
    const dx = c[0] - a[0], dz = c[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    return [-dz / l, dx / l] as const;
  });
  let v = 0;
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % n;
    const p = pts[i]!, q = pts[j]!, np = nor[i]!, nq = nor[j]!;
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const v1 = v + L / vlen;
    if (dash > 0 && i % 2 === 1) { v = v1; continue; }
    const P = (pt: readonly [number, number], nn: readonly [number, number], s: number): [number, number, number] => [pt[0] + nn[0] * (off + s * w / 2), y, pt[1] + nn[1] * (off + s * w / 2)];
    const a = P(p, np, -1), bb = P(p, np, 1), c = P(q, nq, 1), d = P(q, nq, -1);
    // normal pra cima: (b - a) x (d - a) tem que ter y > 0
    const ny = (bb[2] - a[2]) * (d[0] - a[0]) - (bb[0] - a[0]) * (d[2] - a[2]);
    if (ny > 0) b.quad(a, bb, c, d, [0, v, uw, v1], col);
    else b.quad(a, d, c, bb, [0, v, uw, v1], col);
    v = v1;
  }
}

function slab(b: GeoBuilder, cx: number, cz: number, sx: number, sz: number): void {
  b.resetTransform();
  const x0 = cx - sx / 2, x1 = cx + sx / 2, z0 = cz - sz / 2, z1 = cz + sz / 2, h = CURB_H;
  const uv = (ax: number, az: number, bx: number, bz: number): UVRect => [ax, az, bx, bz];
  b.quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], uv(x0 / 2, z1 / 2, x1 / 2, z0 / 2), [1, 1, 1]);
  const curb: RGB = hex(0xb8b4aa);
  b.quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], [0, 0, 0.1, 0.1], curb);
  b.quad([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], [0, 0, 0.1, 0.1], curb);
  b.quad([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], [0, 0, 0.1, 0.1], curb);
  b.quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], [0, 0, 0.1, 0.1], curb);
}

/** quadra encostada no balão: quadrado menos o círculo */
function balaoSlab(b: GeoBuilder, cx: number, cz: number): void {
  b.resetTransform();
  const h = BLOCK_HALF, R = BALAO.ring + 2;
  const pts: [number, number][] = [];
  const corners: [number, number][] = [[cx - h, cz - h], [cx + h, cz - h], [cx + h, cz + h], [cx - h, cz + h]];
  for (let k = 0; k < 4; k++) {
    const [ax, az] = corners[k]!, [bx, bz] = corners[(k + 1) % 4]!;
    const n = 40;
    for (let s = 0; s < n; s++) {
      let x = ax + ((bx - ax) * s) / n, z = az + ((bz - az) * s) / n;
      const d = Math.hypot(x - BALAO.x, z - BALAO.z);
      if (d < R) { x = BALAO.x + ((x - BALAO.x) / d) * R; z = BALAO.z + ((z - BALAO.z) / d) * R; }
      pts.push([x, z]);
    }
  }
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(shape);
  const p = g.getAttribute('position');
  const ix = g.getIndex()!;
  const base = b.vertexCount;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = -p.getY(i);
    b.pos.push(x, CURB_H, z);
    b.nor.push(0, 1, 0);
    b.uv.push(x / 2, z / 2);
    b.col.push(1, 1, 1);
    b.mid.push(0);
  }
  // ShapeGeometry fica no plano XY virado pra +Z; depois do "flip" de z o sentido inverte
  for (let i = 0; i < ix.count; i += 3) b.idx.push(base + ix.getX(i), base + ix.getX(i + 2), base + ix.getX(i + 1));
  // meio-fio acompanhando o contorno
  const curb: RGB = hex(0xb8b4aa);
  for (let k = 0; k < pts.length; k++) {
    const [ax, az] = pts[k]!, [bx, bz] = pts[(k + 1) % pts.length]!;
    b.quad([bx, 0, bz], [ax, 0, az], [ax, CURB_H, az], [bx, CURB_H, bz], [0, 0, 0.1, 0.1], curb);
  }
}

function concreteLot(b: GeoBuilder, cx: number, cz: number): void {
  b.resetTransform();
  const h = BLOCK_HALF, y = 0.03;
  b.quad([cx - h, y, cz + h], [cx + h, y, cz + h], [cx + h, y, cz - h], [cx - h, y, cz - h], [(cx - h) / 3, (cz + h) / 3, (cx + h) / 3, (cz - h) / 3], hex(0x9a968e));
}

function stripe(b: GeoBuilder, vertical: boolean, c: number, t0: number, t1: number, hw: number, col: RGB): void {
  b.resetTransform();
  const y = 0.012;
  if (vertical) b.quad([c - hw, y, t1], [c + hw, y, t1], [c + hw, y, t0], [c - hw, y, t0], [0, 0, 0.3, (t1 - t0) / 4], col);
  else b.quad([t0, y, c + hw], [t1, y, c + hw], [t1, y, c - hw], [t0, y, c - hw], [0, 0, 0.3, (t1 - t0) / 4], col);
}

function poolQuad(b: GeoBuilder, x: number, z: number, r: number, col: RGB, y = 0.14): void {
  b.resetTransform();
  b.quad([x - r, y, z + r], [x + r, y, z + r], [x + r, y, z - r], [x - r, y, z - r], [0, 0, 1, 1], col);
}

// ------------------------------------------------------------------
// casa de laje

function buildLot(lot: Lot, walls: GeoBuilder, glow: GeoBuilder, signs: GeoBuilder, flat: GeoBuilder, emissive: GeoBuilder, lines: number[]): void {
  const rnd = mulberry32(lot.seed);
  // fora da grade não tem calçada: a casa senta no chão
  const y0 = Math.max(Math.abs(lot.x), Math.abs(lot.z)) > GRID_EDGE ? 0 : CURB_H;
  const hw = lot.w / 2;
  const front = lot.d / 2; // fachada em z = +front (local)
  const setback = lot.muro ? range(rnd, 3, 5) : 0;
  const hz = front - setback; // frente da casa
  const houseDepth = range(rnd, 12, 16);
  const back = hz - houseDepth;
  const H = lot.floors * FLOOR_H;
  const paint = lot.style === 'painted' ? hex(PAINT_COLORS[Math.floor(lot.tint * PAINT_COLORS.length)]!) : ([1, 1, 1] as RGB);

  for (const B of [walls, glow, signs, flat, emissive]) B.setTransform(lot.x, y0, lot.z, lot.rot);

  const baseRow = lot.style === 'brick' ? ROW.brick : lot.style === 'block' ? ROW.block : rnd() < 0.5 ? ROW.plaster : ROW.plasterDirty;
  const pixoRow = () => tagRow(rnd);

  // ---- corpo da casa, andar por andar ----
  for (let f = 0; f < lot.floors; f++) {
    const fy0 = f * FLOOR_H, fy1 = fy0 + FLOOR_H;
    // último andar às vezes sem reboco (tijolo aparente, "puxadinho")
    const unfinished = f > 0 && f === lot.floors - 1 && rnd() < 0.45;
    let row: number = unfinished ? ROW.brick : baseRow;
    let col: RGB = unfinished || row === ROW.brick || row === ROW.block ? [1, 1, 1] : paint;
    if (f === 0 && !lot.muro && rnd() < 0.45) { row = rnd() < 0.25 ? muralRow(rnd) : pixoRow(); col = [1, 1, 1]; }
    // fachada
    walls.wallZ(-hw, hw, fy0, fy1, hz, spanUV(row, lot.w, rnd), col);
    // laterais (aparecem quando o vizinho é mais baixo)
    walls.quad([hw, fy0, hz], [hw, fy0, back], [hw, fy1, back], [hw, fy1, hz], spanUV(unfinished ? ROW.brick : ROW.plasterDirty, houseDepth, rnd), [0.85, 0.85, 0.85]);
    walls.quad([-hw, fy0, back], [-hw, fy0, hz], [-hw, fy1, hz], [-hw, fy1, back], spanUV(unfinished ? ROW.brick : ROW.plasterDirty, houseDepth, rnd), [0.85, 0.85, 0.85]);
    walls.quad([hw, fy0, back], [-hw, fy0, back], [-hw, fy1, back], [hw, fy1, back], spanUV(ROW.block, lot.w, rnd), [0.7, 0.7, 0.7]);

    // aberturas
    const zf = hz + 0.03;
    if (f === 0) {
      if (lot.shop >= 0) {
        // comércio: portas de enrolar, uma aberta com luz
        const doors = lot.w > 9 ? 2 : 1;
        for (let k = 0; k < doors; k++) {
          const dw = 3.2;
          const cx = doors === 1 ? 0 : (k === 0 ? -1 : 1) * (hw / 2);
          const open = k === 0 && rnd() < 0.8;
          if (open) {
            glow.wallZ(cx - dw / 2, cx + dw / 2, 0, 2.6, zf, [0.02, 0.1, 0.48, 0.5], lot.shop % 2 ? hex(0xe8fff4, 0.75) : hex(0xffe0b0, 0.75));
            walls.wallZ(cx - dw / 2, cx + dw / 2, 2.2, 2.6, zf + 0.01, tileUV(ROW.doors, 0), [1, 1, 1]);
            // mesa de plástico e cadeiras na calçada (bar)
            if (lot.shop === 0 || lot.shop === 1 || lot.shop === 10) plasticTables(flat, cx, hz + 1.8, rnd);
          } else {
            walls.wallZ(cx - dw / 2, cx + dw / 2, 0, 2.6, zf, tileUV(ROW.doors, Math.floor(rnd() * 4)), [1, 1, 1]);
          }
        }
        // letreiro aceso
        signs.wallZ(-hw + 0.3, hw - 0.3, 2.7, 3.35, zf + 0.06, signUV(lot.shop % SHOP_NAMES.length), [1.05, 1.05, 1.05]);
        flat.mat = 3;
        flat.box(0, 3.02, hz + 0.02, lot.w - 0.4, 0.7, 0.05, hex(0x333333));
        flat.mat = 0;
      } else if (!lot.muro) {
        // garagem + janela
        const gx = -hw + 2;
        walls.wallZ(gx - 1.5, gx + 1.5, 0, 2.5, zf, tileUV(ROW.doors, Math.floor(rnd() * 4)), [1, 1, 1]);
        windowAt(walls, glow, hw - 2.2, 1.0, 2.2, zf, rnd, 0.3);
      }
    } else {
      const n = lot.w > 9 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const cx = n === 1 ? range(rnd, -1, 1) : (k === 0 ? -1 : 1) * hw * 0.45;
        windowAt(walls, glow, cx, fy0 + 1.0, fy0 + 2.2, zf, rnd, 0.35);
      }
    }
    // laje (borda) entre andares
    flat.mat = 2;
    flat.box(0, fy1 - 0.08, hz + 0.08, lot.w, 0.16, 0.18, hex(0x9c978e));
    flat.mat = 0;
  }

  // ---- telhado ----
  if (lot.floors === 1 && rnd() < 0.4) {
    // telha de fibrocimento de uma água
    const tH = 0.7;
    walls.quad([-hw, H + tH, back - 0.3], [-hw, H, hz + 0.5], [hw, H, hz + 0.5], [hw, H + tH, back - 0.3], rowUV(ROW.telha, 0, Math.min(1, lot.w / TILE_W)), [0.9, 0.9, 0.9]);
    walls.quad([-hw, H + tH, back - 0.3], [hw, H + tH, back - 0.3], [hw, H, hz + 0.5], [-hw, H, hz + 0.5], rowUV(ROW.telha, 0, 0.1), [0.3, 0.3, 0.3]);
  } else {
    walls.quad([-hw, H, hz], [hw, H, hz], [hw, H, back], [-hw, H, back], rowUV(ROW.laje, 0, Math.min(1, lot.w / TILE_W)), [1, 1, 1]);
    // platibanda (murinho da laje)
    flat.mat = 2;
    flat.box(0, H + 0.3, hz - 0.1, lot.w, 0.6, 0.2, hex(0xb0aa9e));
    flat.mat = 0;
    // ferros de espera pro próximo andar (sempre em construção)
    if (rnd() < 0.55) {
      for (const [px, pz] of [[-hw + 0.3, hz - 0.3], [hw - 0.3, hz - 0.3], [-hw + 0.3, back + 0.3], [hw - 0.3, back + 0.3]] as const) {
        const w = localToWorld(lot, px, pz);
        for (let r = 0; r < 4; r++) {
          const ox = (r % 2) * 0.12, oz = Math.floor(r / 2) * 0.12;
          lines.push(w[0] + ox, y0 + H, w[1] + oz, w[0] + ox + range(rnd, -0.1, 0.1), y0 + H + range(rnd, 0.8, 1.4), w[1] + oz);
        }
      }
    }
    // caixa d'água azul
    if (rnd() < 0.7) {
      const cx = range(rnd, -hw + 1, hw - 1), cz = range(rnd, back + 1.2, hz - 2);
      flat.cylinder(cx, H, cz, 0.62, 0.72, 0.9, 10, hex(0x2261c4));
      flat.cylinder(cx, H + 0.9, cz, 0.74, 0.05, 0.25, 10, hex(0x1b4f9e));
    }
    // antena / parabólica
    if (rnd() < 0.3) {
      const cx = range(rnd, -hw + 0.8, hw - 0.8);
      flat.mat = 3;
      flat.box(cx, H + 1.0, back + 1, 0.05, 2, 0.05, hex(0x777777));
      flat.box(cx, H + 1.9, back + 1, 1.2, 0.03, 0.03, hex(0x777777));
      flat.mat = 0;
    }
    // varal
    if (rnd() < 0.3) {
      const z = range(rnd, back + 1, hz - 1);
      for (let k = 0; k < 4; k++) flat.box(range(rnd, -hw + 0.5, hw - 0.5), H + 1.2, z, 0.5, 0.6, 0.02, hex(pick(rnd, [0xd04040, 0xe0e0e0, 0x3050c0, 0xe0c020, 0x40a060])));
    }
  }

  // ---- muro + portão ----
  if (lot.muro) {
    const mh = 2.3;
    const gate = range(rnd, 2.6, 3.2);
    const gx = range(rnd, -hw + gate / 2 + 0.5, hw - gate / 2 - 0.5);
    const mRow = rnd() < 0.5 ? pixoRow() : rnd() < 0.3 ? muralRow(rnd) : baseRow;
    const mCol: RGB = mRow >= ROW.pixo0 || mRow === ROW.brick || mRow === ROW.block ? [1, 1, 1] : paint;
    const z = front - 0.1;
    walls.wallZ(-hw, gx - gate / 2, 0, mh, z, spanUV(mRow, gx - gate / 2 + hw, rnd, 0, mh / FLOOR_H), mCol);
    walls.wallZ(gx + gate / 2, hw, 0, mh, z, spanUV(mRow, hw - gx - gate / 2, rnd, 0, mh / FLOOR_H), mCol);
    walls.wallZ(gx - gate / 2, gx + gate / 2, 0, mh, z, tileUV(ROW.doors, Math.floor(rnd() * 4)), [0.9, 0.9, 0.9]);
    // topo do muro (com caco de vidro... fica só a faixa escura)
    flat.mat = 1;
    flat.box(0, mh + 0.05, z - 0.08, lot.w, 0.1, 0.2, hex(0x8a857c));
    flat.mat = 0;
    // laterais do quintal
    for (const s of [-1, 1]) walls.quad(
      s > 0 ? [hw, 0, z] : [-hw, 0, hz], s > 0 ? [hw, 0, hz] : [-hw, 0, z],
      s > 0 ? [hw, mh, hz] : [-hw, mh, z], s > 0 ? [hw, mh, z] : [-hw, mh, hz],
      spanUV(ROW.plasterDirty, setback, rnd, 0, mh / FLOOR_H), [0.8, 0.8, 0.8]);
    // luz da varanda
    if (rnd() < 0.35) emissive.box(range(rnd, -hw + 1, hw - 1), 2.6, hz + 0.05, 0.3, 0.15, 0.1, hex(0xfff0c0, 2.5));
  }

  for (const B of [walls, glow, signs, flat, emissive]) B.resetTransform();
}

function localToWorld(lot: Lot, x: number, z: number): [number, number] {
  const c = Math.cos(lot.rot), s = Math.sin(lot.rot);
  return [lot.x + x * c + z * s, lot.z - x * s + z * c];
}

function windowAt(walls: GeoBuilder, glow: GeoBuilder, cx: number, y0: number, y1: number, z: number, rnd: () => number, litChance: number): void {
  const w = range(rnd, 1.2, 1.8);
  if (rnd() < litChance) {
    const warm = rnd() < 0.75;
    const col = warm ? hex(pick(rnd, [0xffc070, 0xffd8a0, 0xffe6c0]), range(rnd, 1.1, 1.8)) : hex(pick(rnd, [0x9fd0ff, 0xc0e8ff, 0xd8a0ff]), 1.3);
    const v = rnd() < 0.5 ? 0 : 0.5;
    glow.wallZ(cx - w / 2, cx + w / 2, y0, y1, z + 0.01, [v + 0.01, 0.01, v + 0.49, 0.99], col);
  } else {
    walls.wallZ(cx - w / 2, cx + w / 2, y0, y1, z + 0.01, tileUV(ROW.windows, Math.floor(rnd() * 4)), [1, 1, 1]);
  }
}

function plasticTables(flat: GeoBuilder, cx: number, z: number, rnd: () => number): void {
  // mesa de plástico amarela/vermelha de bar (marca registrada)
  const col = rnd() < 0.5 ? hex(0xe8c21a) : hex(0xc02020);
  for (let k = 0; k < 2; k++) {
    const x = cx + (k - 0.5) * 1.6;
    flat.box(x, 0.72, z, 0.7, 0.04, 0.7, col);
    for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]] as const) flat.box(x + dx, 0.36, z + dz, 0.04, 0.72, 0.04, col);
    for (const s of [-1, 1]) {
      flat.box(x + s * 0.55, 0.42, z, 0.4, 0.04, 0.4, col);
      flat.box(x + s * 0.73, 0.65, z, 0.04, 0.45, 0.4, col);
    }
  }
}

// ------------------------------------------------------------------
// lugares especiais

function buildCaixaDagua(flat: GeoBuilder, emissive: GeoBuilder): void {
  // a Caixa d'Água da Ceilândia: fuste de concreto + taça
  const c = hex(0xc9c3b6);
  flat.mat = 2;
  flat.cylinder(0, 0.3, 0, 2.4, 2.0, 1, 16, hex(0x8a857c));
  flat.mat = 1;
  flat.cylinder(0, 1.3, 0, 1.6, 1.4, 20, 16, c);
  flat.cylinder(0, 21.3, 0, 1.4, 6.5, 4.5, 20, c, false);
  flat.cylinder(0, 25.8, 0, 6.5, 6.5, 2.6, 20, hex(0xd6d0c2));
  flat.cylinder(0, 28.4, 0, 6.5, 1.2, 1.6, 20, hex(0xb0aa9c));
  flat.mat = 3;
  flat.cylinder(0, 30.0, 0, 0.1, 0.1, 0.6, 6, hex(0x444444));
  flat.mat = 1;
  // faixa pintada e luzes de baixo pra cima
  flat.cylinder(0, 26.6, 0, 6.52, 6.52, 0.5, 20, hex(0x1d4fb8), false);
  flat.mat = 0;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    emissive.box(Math.cos(a) * 3.2, 0.5, Math.sin(a) * 3.2, 0.4, 0.2, 0.4, hex(0xffe0a0, 2));
  }
}

function buildTerrao(flat: GeoBuilder, x: number, z: number): void {
  const white = hex(0xe8e8e8);
  for (const s of [-1, 1]) {
    const gz = z + s * 30;
    flat.mat = 3;
    flat.box(x - 3.6, 1.2, gz, 0.12, 2.4, 0.12, white);
    flat.box(x + 3.6, 1.2, gz, 0.12, 2.4, 0.12, white);
    flat.box(x, 2.4, gz, 7.3, 0.12, 0.12, white);
    flat.mat = 0;
  }
}

function buildFeira(flat: GeoBuilder, emissive: GeoBuilder, signs: GeoBuilder, marks: GeoBuilder, x: number, z: number, rnd: () => number): void {
  const tarps = [0x1f4fb8, 0xc02020, 0xe8c21a, 0xe8e8e8, 0x2a9a50, 0xd05a10];
  for (let k = 0; k < 6; k++) {
    const bx = x - 25 + k * 10, bz = z + 28;
    const col = hex(tarps[k]!);
    flat.mat = 3;
    for (const [dx, dz] of [[-3.3, -2.3], [3.3, -2.3], [-3.3, 2.3], [3.3, 2.3]] as const) flat.box(bx + dx, 1.3, bz + dz, 0.08, 2.6, 0.08, hex(0x999999));
    flat.mat = 0;
    flat.box(bx, 2.65, bz, 7, 0.1, 5, col);
    flat.box(bx, 0.9, bz - 1.8, 6.4, 0.1, 1.2, hex(0x8a6a4a)); // bancada
    // caixotes de fruta
    for (let c = 0; c < 4; c++) flat.box(bx - 2.4 + c * 1.6, 1.1, bz - 1.8, 1, 0.3, 0.7, hex(pick(rnd, [0xe05020, 0x40a030, 0xe0c020, 0xa02060])));
    // lâmpada pendurada
    emissive.box(bx, 2.35, bz, 0.25, 0.25, 0.25, hex(0xfff0c0, 3));
  }
  // varal de lâmpadas
  for (let k = 0; k < 30; k++) emissive.box(x - 30 + k * 2, 3.2 - Math.sin((k / 30) * Math.PI) * 0.4, z + 24.5, 0.12, 0.12, 0.12, hex(pick(rnd, [0xff4040, 0x40ff80, 0xffe040, 0x40a0ff]), 3));
  signs.setTransform(x, 0, z + 34, 0);
  signs.wallZ(-9, 9, 4.2, 6.2, 0.1, signUV(SIGN_ROW.feira), [1.5, 1.5, 1.5]);
  signs.resetTransform();
  flat.mat = 3;
  flat.box(x - 8, 2.6, z + 34, 0.2, 5.2, 0.2, hex(0x555555));
  flat.box(x + 8, 2.6, z + 34, 0.2, 5.2, 0.2, hex(0x555555));
  flat.mat = 0;
  // vagas pintadas
  for (let k = 0; k < 12; k++) {
    marks.setTransform(x - 33 + k * 6, 0.04, z - 20, 0);
    marks.quad([-0.08, 0, 3], [0.08, 0, 3], [0.08, 0, -3], [-0.08, 0, -3], [0, 0, 0.2, 1], hex(0xdddddd, 0.8));
  }
  marks.resetTransform();
}

function buildPosto(flat: GeoBuilder, emissive: GeoBuilder, signs: GeoBuilder, pools: GeoBuilder, walls: GeoBuilder, x: number, z: number): void {
  // cobertura, bombas e totem são 3D de verdade (posto.ts); aqui fica a luz no chão e a loja
  void flat;
  const cz = z + 15;
  poolQuad(pools, x, cz, 20, hex(0xdfe8ff, 0.3), 0.05);
  // conveniência
  const sz = z - 22;
  walls.setTransform(x, 0, sz, 0);
  walls.wallZ(-12, 12, 0, 4, 6, rowUV(ROW.plaster, 0, 1), hex(0xf0f0f0));
  walls.resetTransform();
  emissive.box(x, 1.4, sz + 6.05, 14, 2.4, 0.05, hex(0xe8fff0, 0.8));
  signs.setTransform(x, 0, sz + 6.15, 0);
  signs.wallZ(-8, 8, 3.0, 4.0, 0, signUV(SIGN_ROW.conveniencia), [1.4, 1.4, 1.4]);
  signs.resetTransform();
}

function buildPraca(flat: GeoBuilder, emissive: GeoBuilder, marks: GeoBuilder, x: number, z: number): void {
  // quadra poliesportiva
  flat.mat = 1;
  flat.box(x, CURB_H + 0.02, z, 30, 0.04, 20, hex(0x2d6a55));
  flat.box(x, CURB_H + 0.03, z, 26, 0.04, 14, hex(0x2a4f8a));
  flat.mat = 3;
  marks.setTransform(x, CURB_H + 0.06, z, 0);
  marks.quad([-0.06, 0, 7], [0.06, 0, 7], [0.06, 0, -7], [-0.06, 0, -7], [0, 0, 0.2, 1], hex(0xffffff, 0.9));
  marks.resetTransform();
  // alambrado
  for (let k = -7; k <= 7; k++) for (const s of [-1, 1]) flat.box(x + k * 2, CURB_H + 2, z + s * 10, 0.06, 4, 0.06, hex(0x777777));
  for (const s of [-1, 1]) flat.box(x, CURB_H + 3.95, z + s * 10, 30, 0.05, 0.05, hex(0x777777));
  // tabelas de basquete
  for (const s of [-1, 1]) {
    flat.box(x + s * 14, CURB_H + 1.6, z, 0.12, 3.2, 0.12, hex(0x888888));
    flat.mat = 0;
    flat.box(x + s * 13.8, CURB_H + 3.2, z, 0.06, 1.1, 1.7, hex(0xeeeeee));
    flat.mat = 3;
  }
  // refletores da quadra
  for (const s of [-1, 1]) {
    flat.box(x + s * 16, CURB_H + 4.5, z + 11, 0.2, 9, 0.2, hex(0x666666));
    emissive.box(x + s * 16, CURB_H + 9, z + 10.8, 1.2, 0.5, 0.1, hex(0xf6fbff, 1.5));
  }
  // bancos
  flat.mat = 1;
  for (let k = 0; k < 4; k++) flat.box(x - 24 + k * 16, CURB_H + 0.45, z + 16, 2, 0.1, 0.5, hex(0x9a948a));
  flat.mat = 0;
}

function buildParedao(x: number, z: number, leds: THREE.MeshBasicMaterial): THREE.Group {
  // carro com o porta-malas aberto e o paredão de som em cima (a alma da feira)
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = Math.PI / 5;
  const car = buildVehicle(3, 0x1b1c1f, false);
  const body = new THREE.Mesh(car.body, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.6 }));
  g.add(body);
  const box = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.7 });
  const cone = new THREE.MeshStandardMaterial({ color: 0x252525, roughness: 0.4, metalness: 0.3 });
  const stack = new THREE.Group();
  stack.position.set(0, 1.0, -1.3);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.6), box);
      b.position.set((c - 0.5) * 0.78, 0.38 + r * 0.78, 0);
      stack.add(b);
      const spk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16), cone);
      spk.rotation.x = Math.PI / 2;
      spk.position.set((c - 0.5) * 0.78, 0.38 + r * 0.78, -0.31);
      stack.add(spk);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 6, 20), leds);
      ring.position.set((c - 0.5) * 0.78, 0.38 + r * 0.78, -0.33);
      stack.add(ring);
    }
  }
  stack.rotation.y = Math.PI;
  g.add(stack);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.06), leds);
  bar.position.set(0, 3.45, -1.3);
  g.add(bar);
  return g;
}

function buildTree(flat: GeoBuilder, x: number, z: number, s: number, kind: 'ipe-rosa' | 'ipe-amarelo' | 'cerrado', rnd: () => number): void {
  flat.resetTransform();
  const trunk = hex(kind === 'cerrado' ? 0x3a2a1e : 0x4a3a2c);
  if (kind === 'cerrado') {
    // árvore torta do cerrado
    const lean = range(rnd, -0.6, 0.6);
    flat.setTransform(x, 0, z, range(rnd, 0, Math.PI * 2));
    flat.box(lean * 0.4, 1.0 * s, 0, 0.22 * s, 2 * s, 0.22 * s, trunk);
    flat.box(lean * 0.9, 2.3 * s, 0.2, 0.16 * s, 1.2 * s, 0.16 * s, trunk);
    const leaf = hex(pick(rnd, [0x3a4a22, 0x4a5a2a, 0x5a5a30]));
    for (let k = 0; k < 3; k++) flat.box(lean + range(rnd, -1, 1) * s, (2.8 + rnd() * 0.6) * s, range(rnd, -1, 1) * s, 2.2 * s, 0.7 * s, 1.8 * s, leaf);
  } else {
    flat.setTransform(x, 0.3, z, range(rnd, 0, Math.PI * 2));
    flat.box(0, 1.6 * s, 0, 0.3 * s, 3.2 * s, 0.3 * s, trunk);
    const col = kind === 'ipe-rosa' ? hex(pick(rnd, [0xd8488e, 0xe060a0, 0xc03a80])) : hex(pick(rnd, [0xf2c21a, 0xe8b010, 0xffd23a]));
    for (let k = 0; k < 5; k++) flat.box(range(rnd, -1.2, 1.2) * s, (3.4 + rnd() * 1.2) * s, range(rnd, -1.2, 1.2) * s, range(rnd, 1.6, 2.6) * s, range(rnd, 1, 1.6) * s, range(rnd, 1.6, 2.6) * s, col);
  }
  flat.resetTransform();
}

// ------------------------------------------------------------------
// horizonte: luzes das outras satélites e a silhueta de Brasília ao longe

function buildHorizon(tx: Textures): THREE.Group {
  const g = new THREE.Group();
  const rnd = mulberry32(77);
  const pos: number[] = [], col: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < 2600; i++) {
    const a = rnd() * Math.PI * 2;
    const r = range(rnd, 900, 1700);
    pos.push(Math.cos(a) * r, range(rnd, 0, 1) ** 3 * 18 + 1, Math.sin(a) * r);
    c.setHex(rnd() < 0.7 ? 0xffa050 : rnd() < 0.5 ? 0xfff0d0 : 0xa0c8ff);
    const k = range(rnd, 0.6, 1.8);
    col.push(c.r * k, c.g * k, c.b * k);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  pg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ size: 3.2, sizeAttenuation: true, vertexColors: true, map: tx.glow, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  g.add(pts);

  // silhuetas (Torre de TV e Congresso) bem longe, pro lado leste
  const sil = new THREE.MeshBasicMaterial({ color: 0x0b0a10, fog: false });
  const dir = new THREE.Vector3(1, 0, -0.35).normalize();
  const base = dir.clone().multiplyScalar(2200);
  const torre = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 9, 220, 6), sil);
  torre.position.copy(base).add(new THREE.Vector3(0, 110, -120));
  g.add(torre);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 8, 8), sil);
  deck.position.copy(torre.position).add(new THREE.Vector3(0, 10, 0));
  g.add(deck);
  for (const off of [-9, 9]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(12, 150, 26), sil);
    t.position.copy(base).add(new THREE.Vector3(off * 1.3, 75, 180));
    g.add(t);
  }
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(40, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), sil);
  bowl.position.copy(base).add(new THREE.Vector3(0, 40, 280));
  g.add(bowl);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(32, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), sil);
  dome.position.copy(base).add(new THREE.Vector3(0, 8, 90));
  g.add(dome);
  // luzes vermelhas de obstáculo
  const red = new THREE.MeshBasicMaterial({ color: 0xff2020, fog: false });
  for (const p of [torre.position.clone().add(new THREE.Vector3(0, 112, 0)), base.clone().add(new THREE.Vector3(-11.7, 152, 180)), base.clone().add(new THREE.Vector3(11.7, 152, 180))]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(2.4, 6, 4), red);
    m.position.copy(p);
    m.name = 'aviation';
    g.add(m);
  }
  return g;
}

export { PITCH };

/** tira do fim (e do começo) da polilinha o trecho que entra numa estrada maior */
function trimInto(pts: [number, number][], others: { pts: [number, number][]; w: number; loop?: boolean }[]): [number, number][] {
  // amostra mais fina pra cortar perto da beira
  const fine: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5));
    for (let k = 0; k < n; k++) fine.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  fine.push(pts[pts.length - 1]!);
  const inside = (p: [number, number]) => others.some((o) => {
    const n = o.pts.length, m = o.loop ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const a = o.pts[i]!, b = o.pts[(i + 1) % n]!;
      if (Math.abs(a[0] - p[0]) > 60 && Math.abs(b[0] - p[0]) > 60) continue;
      if (segDist2(p[0], p[1], a[0], a[1], b[0], b[1]) < o.w / 2 - 1) return true;
    }
    return false;
  });
  let s = 0, e = fine.length;
  while (s < e - 2 && inside(fine[s]!)) s++;
  while (e > s + 2 && inside(fine[e - 1]!)) e--;
  return fine.slice(Math.max(0, s - 1), Math.min(fine.length, e + 1));
}

function segDist2(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az;
  const L = dx * dx + dz * dz;
  const t = L > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L)) : 0;
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}

/** polilinha reamostrada em pares (traço, vão) pro ribbon com dash: [a0, a1, b0, b1, ...] */
function dashPts(pts: [number, number][], on: number, period: number, loop: boolean): [number, number][] {
  const src = loop ? [...pts, pts[0]!] : pts;
  const out: [number, number][] = [];
  let s = 0;
  let next = 0;
  for (let i = 0; i < src.length - 1; i++) {
    const a = src[i]!, b = src[i + 1]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 1e-6) continue;
    while (next <= s + l) {
      const t = (next - s) / l;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      next += out.length % 2 === 1 ? on : period - on;
    }
    s += l;
  }
  if (out.length % 2 === 1) out.pop();
  return out;
}

/** morros: domo torto de terra, capim seco no meio e pedra no topo (um BufferGeometry só) */
function buildHills(mounds: { x: number; z: number; r: number; h: number; seed: number }[]): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], uv: number[] = [];
  const SEG = 16, RINGS = 6;
  const earth = [0.62, 0.34, 0.22], grass = [0.5, 0.44, 0.26], rock = [0.46, 0.42, 0.38];
  for (const m of mounds) {
    const rnd = mulberry32(m.seed);
    const jit: number[] = [];
    for (let k = 0; k < SEG; k++) jit.push(0.82 + rnd() * 0.3);
    const vert = (ring: number, k: number): [number, number, number] => {
      const u = ring / RINGS; // 0 na base, 1 no topo
      const a = (k / SEG) * Math.PI * 2 + m.seed % 7;
      const r = m.r * (1 - u) * jit[k % SEG]! * (ring === RINGS ? 0 : 1);
      const y = ring === 0 ? -0.6 : m.h * Math.pow(Math.sin((u * Math.PI) / 2), 1.4) * (0.9 + ((m.seed >> (k % 8)) & 3) * 0.04);
      return [m.x + Math.cos(a) * r, y, m.z + Math.sin(a) * r];
    };
    const color = (y: number): number[] => {
      const t = Math.max(0, Math.min(1, y / Math.max(1, m.h)));
      const c = t < 0.5 ? earth.map((v, i) => v + (grass[i]! - v) * (t / 0.5)) : grass.map((v, i) => v + (rock[i]! - v) * ((t - 0.5) / 0.5));
      return c;
    };
    for (let ring = 0; ring < RINGS; ring++) {
      for (let k = 0; k < SEG; k++) {
        const a = vert(ring, k), b = vert(ring, k + 1), c = vert(ring + 1, k + 1), d = vert(ring + 1, k);
        // virado pra fora (vista de cima, sentido anti-horário)
        for (const p of ring === RINGS - 1 ? [a, c, b] : [a, c, b, a, d, c]) {
          pos.push(p[0], p[1], p[2]);
          col.push(...color(p[1]));
          uv.push(p[0] / 14, p[2] / 14);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
