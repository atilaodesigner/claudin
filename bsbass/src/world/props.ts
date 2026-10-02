// Objetos de rua realistas (Poly Haven, CC0) espalhados pela quebrada:
// ar-condicionado nas fachadas, pilha de pneu e tambor azul na borracharia,
// saco de cimento na porta de quem tá subindo a laje, carro com capa,
// hidrante, lixeira, caixa de energia, barreira de concreto no canteiro,
// rádio e caixas na feira, cadeira de plástico empilhada e engradado na porta
// do bar, botijão de gás, saco de lixo no meio-fio e caixote de feira.
// Tudo instanciado (um draw call por peça).

import * as THREE from 'three';
import type { Assets, ModelName } from '../assets';
import { circle, rect, type Shape } from '../physics/collide';
import type { BreakSpec, PropPart } from './breakables';
import { mulberry32, pick, range } from '../utils/rng';
import { ChunkCuller, groupByCell } from './chunks';
import { NO_REFLECT } from '../fx/wet';
import { AVENUE_Z, BALAO, CURB_H, EXTENT, NODES, PITCH, ROAD, inBalao, nodePos, type City, type Lot } from './city';

/** carro estacionado que vira "carro com capa" (o resto continua procedural) */
export function isCovered(p: { model: number; color: number }): boolean {
  return p.color % 3 === 0;
}

// qual variante usar quando o arquivo traz duas lado a lado
const VARIANT: Partial<Record<ModelName, number>> = { exterior_aircon_unit: 1, fire_hydrant: 0, metal_trash_can: 1 };

function prepare(src: THREE.Group, name: ModelName): THREE.Object3D {
  const v = VARIANT[name];
  if (v === undefined || src.children.length < 2) return src;
  const g = new THREE.Group();
  const c = src.children[Math.min(v, src.children.length - 1)]!.clone();
  c.position.x = 0;
  c.position.z = 0;
  g.add(c);
  return g;
}

class Placer {
  private list = new Map<ModelName, THREE.Matrix4[]>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();

  /** devolve a matriz da instância (e o índice dela, pra mexer depois) */
  add(name: ModelName, x: number, y: number, z: number, rotY: number, scale = 1, rotX = 0, rotZ = 0): { index: number; matrix: THREE.Matrix4 } {
    this.e.set(rotX, rotY, rotZ, 'YXZ');
    this.q.setFromEuler(this.e);
    this.p.set(x, y, z);
    this.s.setScalar(scale);
    if (!this.list.has(name)) this.list.set(name, []);
    const list = this.list.get(name)!;
    const matrix = this.m.compose(this.p, this.q, this.s).clone();
    list.push(matrix);
    return { index: list.length - 1, matrix };
  }

  /**
   * Um InstancedMesh por peça do modelo e por pedaço do mapa (dá pra cortar o
   * que está longe/fora da tela). `parts[name][i]` = peças da instância i.
   */
  build(models: Assets['models'], dynamic: Set<ModelName>, culler: ChunkCuller): { group: THREE.Group; parts: Map<ModelName, PropPart[][]> } {
    const out = new THREE.Group();
    out.name = 'props';
    const parts = new Map<ModelName, PropPart[][]>();
    const box = new THREE.Box3();
    const tmp = new THREE.Matrix4();
    for (const [name, mats] of this.list) {
      const src = models[name];
      if (!src || !mats.length) continue;
      const obj = prepare(src, name);
      obj.updateMatrixWorld(true);
      // miudeza (cadeira, saco de lixo, caixa) some antes e não entra no reflexo do asfalto
      const small = box.setFromObject(obj).getSize(new THREE.Vector3()).length() < 2.4;
      const list: PropPart[][] = mats.map(() => []);
      parts.set(name, list);
      const cells = groupByCell(mats);
      obj.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const local = mesh.matrixWorld.clone();
        for (const idx of cells) {
          const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, idx.length);
          idx.forEach((i, k) => {
            im.setMatrixAt(k, tmp.multiplyMatrices(mats[i]!, local));
            list[i]!.push({ im, local, index: k });
          });
          if (dynamic.has(name)) im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          im.instanceMatrix.needsUpdate = true;
          im.computeBoundingSphere();
          // folga pro objeto derrubado não sumir na beira da tela
          if (dynamic.has(name)) im.boundingSphere!.radius += 8;
          im.name = name;
          if (small) im.layers.set(NO_REFLECT);
          culler.add(im, small ? 150 : 300);
          out.add(im);
        }
      });
    }
    return { group: out, parts };
  }
}

/** objetos que o carro derruba em vez de parar nele */
export const BREAKABLE: Partial<Record<ModelName, BreakSpec & { box?: boolean }>> = {
  metal_trash_can: { mass: 18, minV: 0.4 },
  barrel_03: { mass: 30, minV: 0.6 },
  Barrel_02: { mass: 30, minV: 0.6 },
  cardboard_box_01: { mass: 4, minV: 0.2, box: true },
  fire_hydrant: { mass: 140, minV: 2.5, fx: 'water' },
  utility_box_01: { mass: 90, minV: 2.5, fx: 'sparks', box: true },
  plastic_monobloc_chair_01: { mass: 3, minV: 0.2 },
  propane_tank: { mass: 16, minV: 0.4 },
  trashbag: { mass: 4, minV: 0.2 },
  wooden_crate_01: { mass: 6, minV: 0.2, box: true },
};

export interface BreakProp {
  name: ModelName;
  index: number;
  shape: Shape;
  base: THREE.Matrix4;
  h: number; // meia altura
  r: number; // raio no chão
  spec: BreakSpec;
}

function lotFront(lot: Lot): number {
  // mesmo sorteio do buildLot (primeiro número da semente do lote)
  const setback = lot.muro ? range(mulberry32(lot.seed), 3, 5) : 0;
  return lot.d / 2 - setback;
}

function toWorld(lot: Lot, x: number, z: number): [number, number] {
  const c = Math.cos(lot.rot), s = Math.sin(lot.rot);
  return [lot.x + x * c + z * s, lot.z - x * s + z * c];
}

export interface Props {
  group: THREE.Group;
  colliders: Shape[];
  breakables: BreakProp[];
  parts: Map<ModelName, PropPart[][]>;
}

/** lite: preset BAIXA, pula as pilhas decorativas (engradado é a malha mais pesada) */
export function buildProps(city: City, models: Assets['models'], lite: boolean, culler: ChunkCuller): Props {
  const rnd = mulberry32(3131);
  // semente separada pros objetos novos, pra não mexer onde os antigos caem
  const rnd2 = mulberry32(6161);
  const P = new Placer();
  const colliders: Shape[] = [];
  const breakables: BreakProp[] = [];
  const y0 = CURB_H;
  // tamanho real de cada modelo (pro colisor e pra física quando cai)
  const sizes = new Map<ModelName, THREE.Vector3 | null>();
  const sizeOf = (name: ModelName): THREE.Vector3 | null => {
    if (!sizes.has(name)) {
      const src = models[name];
      let v: THREE.Vector3 | null = null;
      if (src) {
        const o = prepare(src, name);
        o.updateMatrixWorld(true);
        v = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
      }
      sizes.set(name, v);
    }
    return sizes.get(name)!;
  };
  /** objeto derrubável: põe, cria o colisor e registra */
  const loose = (name: ModelName, x: number, y: number, z: number, rot: number): void => {
    const { index, matrix } = P.add(name, x, y, z, rot);
    const spec = BREAKABLE[name], size = sizeOf(name);
    if (!spec || !size) return;
    const r = Math.max(size.x, size.z) / 2;
    const shape = spec.box ? rect(x, z, size.x / 2, size.z / 2, rot) : circle(x, z, r * 0.9);
    colliders.push(shape);
    breakables.push({ name, index, shape, base: matrix, h: size.y / 2, r, spec });
  };

  // ---------- fachadas ----------
  for (const lot of city.lots) {
    const hz = lotFront(lot);
    const hw = lot.w / 2;
    // ar-condicionado no andar de cima
    if (lot.floors >= 2 && rnd() < 0.3) {
      const f = 1 + Math.floor(rnd() * (lot.floors - 1));
      const [x, z] = toWorld(lot, range(rnd, -hw + 0.8, hw - 0.8), hz + 0.2);
      P.add('exterior_aircon_unit', x, y0 + f * 3 + 1.6, z, lot.rot);
    }
    // obra: saco de cimento + tambor na calçada
    if (rnd() < 0.05) {
      const sx = range(rnd, -hw + 1, hw - 1);
      for (let k = 0; k < 2 + Math.floor(rnd() * 4); k++) {
        const [x, z] = toWorld(lot, sx + (k % 2) * 0.5 - 0.25, lot.d / 2 + 1.1 + Math.floor(k / 2) * 0.05);
        P.add('cement_bag', x, y0 + Math.floor(k / 2) * 0.17, z, lot.rot + Math.PI / 2 + range(rnd, -0.2, 0.2));
      }
      const [bx, bz] = toWorld(lot, sx + 1.2, lot.d / 2 + 1.1);
      loose('barrel_03', bx, y0, bz, rnd() * 6);
    }
    // borracharia e oficina: pilha de pneu e tambor azul
    if (lot.shop === 3 || lot.shop === 8) {
      for (let st = 0; st < 3; st++) {
        const [x, z] = toWorld(lot, -hw + 1 + st * 0.9, lot.d / 2 + 1.2);
        const n = 2 + Math.floor(rnd() * 5);
        for (let k = 0; k < n; k++) P.add('old_tyre', x + range(rnd, -0.04, 0.04), y0 + 0.08 + k * 0.16, z, rnd() * 6, 1, Math.PI / 2);
      }
      const [bx, bz] = toWorld(lot, hw - 1, lot.d / 2 + 1.1);
      loose('barrel_03', bx, y0, bz, rnd() * 6);
      const [cx, cz] = toWorld(lot, hw - 1.8, lot.d / 2 + 1.3);
      loose('Barrel_02', cx, y0, cz, rnd() * 6);
    }
    // mercadinho e lanchonete: caixas de papelão na porta
    if (lot.shop === 6 || lot.shop === 10) {
      for (let k = 0; k < 3; k++) {
        const [x, z] = toWorld(lot, range(rnd, -hw + 0.6, hw - 0.6), lot.d / 2 + 0.8);
        loose('cardboard_box_01', x, y0 + (k === 2 ? 0.34 : 0), z, rnd() * 6);
      }
    }
    // bar: rádio em cima da mesa de plástico
    if ((lot.shop === 0 || lot.shop === 1) && rnd() < 0.6) {
      const [x, z] = toWorld(lot, range(rnd, -hw + 1, hw - 1), hz + 0.5);
      P.add('boombox', x, y0, z, lot.rot + range(rnd, -0.4, 0.4), 0.9);
    }
    // tambor azul solto na frente de casa
    if (lot.shop < 0 && rnd() < 0.035) {
      const [x, z] = toWorld(lot, range(rnd, -hw + 0.6, hw - 0.6), lot.d / 2 + 0.7);
      loose(rnd() < 0.6 ? 'barrel_03' : 'Barrel_02', x, y0, z, rnd() * 6);
    }
  }

  // ---------- calçadas: lixeira, hidrante, caixa de energia ----------
  const sidewalkSpot = (rnd: () => number): [number, number, number] | null => {
    const vertical = rnd() < 0.5;
    const c = nodePos(Math.floor(rnd() * NODES));
    const t = (rnd() * 2 - 1) * EXTENT;
    const off = (t + EXTENT) % PITCH;
    if (off < ROAD / 2 + 6 || off > PITCH - ROAD / 2 - 6) return null;
    const side = rnd() < 0.5 ? -1 : 1;
    const d = ROAD / 2 + range(rnd, 0.6, 1.1);
    const x = vertical ? c + side * d : t, z = vertical ? t : c + side * d;
    if (inBalao(x, z, 6) || Math.abs(x) > EXTENT + 5 || Math.abs(z) > EXTENT + 5) return null;
    if (city.lamps.some((l) => Math.hypot(l.x - x, l.z - z) < 2)) return null;
    const facing = vertical ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : side > 0 ? Math.PI : 0;
    return [x, z, facing];
  };
  for (let k = 0; k < 90; k++) {
    const s = sidewalkSpot(rnd);
    if (!s) continue;
    const [x, z, f] = s;
    const kind = rnd();
    if (kind < 0.45) loose('metal_trash_can', x, y0, z, f + range(rnd, -0.5, 0.5));
    else if (kind < 0.7) loose('utility_box_01', x, y0, z, f + Math.PI);
    else loose('fire_hydrant', x, y0, z, f);
  }

  // ---------- saco de lixo amontoado no meio-fio ----------
  for (let k = 0; k < 45; k++) {
    const s = sidewalkSpot(rnd2);
    if (!s) continue;
    const [x, z, f] = s;
    const n = 1 + Math.floor(rnd2() * 4);
    for (let j = 0; j < n; j++) {
      // enfileirado ao longo do meio-fio
      const t = (j - (n - 1) / 2) * 0.55 + range(rnd2, -0.08, 0.08);
      loose('trashbag', x + Math.cos(f) * t, y0, z - Math.sin(f) * t, rnd2() * 6);
    }
  }

  // ---------- bar, mercadinho e casa: cadeira, engradado, botijão ----------
  for (const lot of city.lots) {
    const hz = lotFront(lot);
    const hw = lot.w / 2;
    const bar = lot.shop === 0 || lot.shop === 1 || lot.shop === 10;
    if (bar) {
      // pilha de cadeira encostada na parede de um lado, engradado do outro
      const side = rnd2() < 0.5 ? -1 : 1;
      const chairs = 3 + Math.floor(rnd2() * 3);
      const [cx, cz] = toWorld(lot, side * (hw - 0.55), hz + 0.45);
      const crot = lot.rot + Math.PI + range(rnd2, -0.15, 0.15);
      const stack = rnd2() < 0.5, crates = rnd2() < 0.4;
      if (!lite && stack) {
        for (let j = 0; j < chairs; j++) P.add('plastic_monobloc_chair_01', cx, y0 + j * 0.09, cz, crot);
        colliders.push(circle(cx, cz, 0.33));
      }
      const cols = rnd2() < 0.25 ? 2 : 1;
      for (let c = 0; c < cols; c++) {
        const h = 2 + Math.floor(rnd2() * 3);
        const [ex, ez] = toWorld(lot, -side * (hw - 0.5 - c * 0.53), hz + 0.3);
        if (lite || !crates) continue;
        for (let j = 0; j < h; j++) P.add('plastic_crate_02', ex, y0 + j * 0.25, ez, lot.rot + range(rnd2, -0.06, 0.06));
        colliders.push(rect(ex, ez, 0.26, 0.21, lot.rot));
      }
      // uma cadeira largada na calçada
      const [lx, lz] = toWorld(lot, range(rnd2, -hw + 1, hw - 1), hz + 2.6);
      if (rnd2() < 0.5) loose('plastic_monobloc_chair_01', lx, y0, lz, rnd2() * 6);
    }
    // mercadinho: botijão na porta; casa: às vezes um encostado no muro
    const tanks = lot.shop === 6 ? 1 + Math.floor(rnd2() * 3) : lot.shop < 0 && rnd2() < 0.04 ? 1 : 0;
    const tx = range(rnd2, -hw + 1.2, hw - 1.2 - tanks * 0.6);
    for (let j = 0; j < tanks; j++) {
      const [x, z] = toWorld(lot, tx + j * 0.62, lot.d / 2 + 0.45);
      loose('propane_tank', x, y0, z, rnd2() * 6);
    }
  }

  // ---------- carros com capa (no lugar de parte dos estacionados) ----------
  for (const p of city.parked) {
    if (!isCovered(p)) continue;
    const { index, matrix } = P.add('covered_car', p.x, 0, p.z, p.rot);
    const size = sizeOf('covered_car');
    // batida forte arremessa (usa o colisor do estacionado)
    if (p.shape && size) breakables.push({ name: 'covered_car', index, shape: p.shape, base: matrix, h: size.y / 2, r: Math.min(size.x, size.z) / 2, spec: { mass: 950, minV: 6 } });
  }

  // ---------- miolo de quadra e terreno baldio: entulho que o carro derruba ----------
  const rnd4 = mulberry32(4141);
  const junk: ModelName[] = ['Barrel_02', 'barrel_03', 'trashbag', 'trashbag', 'cardboard_box_01', 'wooden_crate_01', 'metal_trash_can'];
  for (const c of city.courtyards) {
    const n = 3 + Math.floor(rnd4() * 4);
    for (let k = 0; k < n; k++) {
      // perto das paredes do miolo, longe do meio (caminho entre os becos)
      const side = Math.floor(rnd4() * 4), t = range(rnd4, -c.half + 2, c.half - 2), e = c.half - range(rnd4, 1, 2.5);
      const x = c.x + (side === 0 ? t : side === 1 ? -t : side === 2 ? e : -e);
      const z = c.z + (side === 0 ? e : side === 1 ? -e : side === 2 ? t : -t);
      loose(pick(rnd4, junk), x, y0, z, rnd4() * 6);
    }
  }
  for (const o of city.openLots) {
    if (o.kind !== 'vacant') continue;
    for (let k = 0; k < 2; k++) {
      const [x, z] = toWorld({ x: o.x, z: o.z, rot: o.rot } as Lot, range(rnd4, -o.w / 2 + 1, o.w / 2 - 1), range(rnd4, -o.d / 2 + 2, o.d / 2 - 4));
      loose(pick(rnd4, junk), x, y0, z, rnd4() * 6);
    }
  }

  // ---------- barreiras de concreto nas pontas do canteiro ----------
  for (const m of city.medians) {
    for (const x of [m.x0 - 1.2, m.x1 + 1.2]) {
      P.add('concrete_road_barrier', x, 0, AVENUE_Z, 0);
      colliders.push(rect(x, AVENUE_Z, 0.78, 0.3));
    }
  }
  // e em volta do terrão, fechando o campinho
  const terrao = city.blocks.find((b) => b.kind === 'terrao');
  if (terrao) {
    for (let k = -3; k <= 3; k++) {
      if (k === 0) continue;
      for (const s of [-1, 1]) {
        const x = terrao.x + k * 5.5, z = terrao.z + s * 36.5;
        P.add('concrete_road_barrier', x, 0, z, 0);
        colliders.push(rect(x, z, 0.78, 0.3));
      }
    }
  }

  // ---------- feira ----------
  const feira = city.blocks.find((b) => b.kind === 'feira');
  if (feira) {
    for (let k = 0; k < 6; k++) {
      const bx = feira.x - 25 + k * 10, bz = feira.z + 28;
      for (let j = 0; j < 3; j++) loose('cardboard_box_01', bx - 2.5 + j * 0.5 + range(rnd, -0.1, 0.1), 0.03, bz - 3.1, rnd() * 0.5);
      if (k % 2 === 0) loose('Barrel_02', bx + 3, 0.03, bz - 2.8, rnd() * 6);
      // caixote de madeira do lado das caixas de papelão
      for (let j = 0; j < 2; j++) loose('wooden_crate_01', bx + 0.4 + j * 0.9, 0.03, bz - 3.2 + range(rnd2, -0.1, 0.1), range(rnd2, -0.2, 0.2));
    }
    // rádio no chão do lado do paredão
    P.add('boombox', feira.x - 27.5, 0.03, feira.z - 11.5, Math.PI / 5 + Math.PI);
    loose('metal_trash_can', feira.x + 30, 0.03, feira.z - 30, 1);
  }
  // balão: cones? não, tambor de obra da prefeitura
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.3;
    P.add('barrel_03', Math.cos(a) * (BALAO.island - 1), 0.3, Math.sin(a) * (BALAO.island - 1), a);
  }

  void pick;
  const built = P.build(models, new Set(breakables.map((b) => b.name)), culler);
  return { group: built.group, colliders, breakables, parts: built.parts };
}
