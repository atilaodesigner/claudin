// Transforma o layout da cidade em malhas: chão, calçadas, casas de laje,
// muros pixados, comércio com letreiro aceso, postes de luz de sódio, fios,
// Caixa d'Água no balão, feira com paredão, posto, terrão, cerrado, horizonte.

import * as THREE from 'three';
import { GeoBuilder, hex, type RGB, type UVRect } from '../utils/geo';
import { mulberry32, pick, range } from '../utils/rng';
import {
  AVENUE_Z, BALAO, BLOCK_HALF, BORDER, CURB_H, EXTENT, NODES, PITCH, ROAD, SHOP_NAMES, SIDEWALK,
  inBalao, nodePos, type City, type Lot,
} from './city';
import { ATLAS_ROWS, ROW, SIGN_ROW, type Textures } from './textures';
import { buildVehicle, PAINTS } from '../traffic/vehicles';

const TILE_W = 12; // metros por largura de linha do atlas
const FLOOR_H = 3;

function rowUV(row: number, u0: number, u1: number, vf0 = 0, vf1 = 1): UVRect {
  const top = 1 - row / ATLAS_ROWS;
  const bot = 1 - (row + 1) / ATLAS_ROWS;
  const h = top - bot;
  // encolhe meio texel pra não sangrar a linha vizinha
  const e = 0.5 / (256 * ATLAS_ROWS);
  return [u0, bot + h * vf0 + e, u1, bot + h * vf1 - e];
}

function spanUV(row: number, width: number, rnd: () => number, vf0 = 0, vf1 = 1): UVRect {
  const span = Math.min(1, width / TILE_W);
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
}

export function buildCityMeshes(city: City, tx: Textures): CityMeshes {
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
  const lampLights: THREE.Vector3[] = [];

  // ================= casas =================
  for (const lot of city.lots) buildLot(lot, walls, glow, signs, flat, emissive, lines);

  // ================= calçadas =================
  for (const b of city.blocks) {
    const open = b.kind === 'terrao' || b.kind === 'feira' || b.kind === 'posto';
    if (b.kind === 'terrao') {
      // anel de calçada + chão de terra
      const h = BLOCK_HALF, s = SIDEWALK;
      slab(sidewalk, b.x, b.z + h - s / 2, h * 2, s);
      slab(sidewalk, b.x, b.z - h + s / 2, h * 2, s);
      slab(sidewalk, b.x + h - s / 2, b.z, s, h * 2 - 2 * s);
      slab(sidewalk, b.x - h + s / 2, b.z, s, h * 2 - 2 * s);
      dirt.setTransform(b.x, 0.015, b.z, 0);
      const d = h - s;
      dirt.quad([-d, 0, d], [d, 0, d], [d, 0, -d], [-d, 0, -d], [0, 0, d / 6, d / 6]);
      dirt.resetTransform();
      buildTerrao(flat, b.x, b.z);
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
    flat.box(0, 0.14, 0, len, 0.28, 1.6, hex(0xa8a39a));
    flat.box(0, 0.285, 0, len - 0.2, 0.01, 1.3, hex(0x5a3a22));
    // listras amarelas e pretas nas pontas
    for (const s of [-1, 1]) flat.box(s * (len / 2 - 0.4), 0.3, 0, 0.8, 0.02, 1.62, hex(0xe8b21e));
  }
  flat.resetTransform();

  // ================= balão + Caixa d'Água =================
  flat.cylinder(0, 0, 0, BALAO.island, BALAO.island, 0.3, 40, hex(0xa8a39a));
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
  for (const l of city.lamps) {
    const double = l.dirX === 0 && l.dirZ === 0;
    const arms: [number, number][] = double ? [[0, 1], [0, -1]] : [[l.dirX, l.dirZ]];
    const H = 9;
    flat.setTransform(l.x, 0, l.z, 0);
    flat.box(0, H / 2, 0, 0.26, H, 0.26, hex(0x8c8a84));
    flat.box(0, 0.6, 0, 0.3, 1.2, 0.3, hex(0x6a6862)); // pé pixado/sujo
    flat.resetTransform();
    for (const [dx, dz] of arms) {
      const ax = l.x + dx * 2.2, az = l.z + dz * 2.2;
      const rot = Math.atan2(dx, dz);
      flat.setTransform(l.x, 0, l.z, rot);
      flat.box(0, H - 0.1, 1.1, 0.1, 0.1, 2.3, hex(0x55544f));
      flat.box(0, H - 0.25, 2.2, 0.36, 0.2, 0.7, hex(0x3a3a38));
      emissive.setTransform(l.x, 0, l.z, rot);
      emissive.box(0, H - 0.37, 2.2, 0.3, 0.04, 0.6, hex(0xffb050, 3.2));
      lampLights.push(new THREE.Vector3(ax, H - 0.6, az));
      // mancha de luz no chão
      poolQuad(pools, ax, az, 10.5, hex(0xff9a3c, 0.55));
    }
  }
  flat.resetTransform();
  emissive.resetTransform();

  // fios entre postes vizinhos (mesma calçada)
  const byLine = new Map<string, { x: number; z: number }[]>();
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
      for (const h of [8.2, 7.6, 7.0]) {
        const seg = 6;
        for (let s = 0; s < seg; s++) {
          const t0 = s / seg, t1 = (s + 1) / seg;
          const sag = (t: number) => h - Math.sin(t * Math.PI) * 0.9;
          lines.push(a.x + (b.x - a.x) * t0, sag(t0), a.z + (b.z - a.z) * t0);
          lines.push(a.x + (b.x - a.x) * t1, sag(t1), a.z + (b.z - a.z) * t1);
        }
      }
    }
  }

  // ================= placas verdes =================
  city.signs.forEach((s, k) => {
    flat.setTransform(s.x, 0, s.z, s.rot);
    flat.box(-1.6, 1.9, 0, 0.1, 3.8, 0.1, hex(0x777777));
    flat.box(1.6, 1.9, 0, 0.1, 3.8, 0.1, hex(0x777777));
    green.setTransform(s.x, 0, s.z, s.rot);
    green.wallZ(-1.9, 1.9, 3.0, 3.95, 0.06, signUV(k % 16));
    flat.box(0, 3.47, 0, 3.8, 0.95, 0.06, hex(0x0d5a34, 0.6));
  });
  flat.resetTransform();
  green.resetTransform();

  // ================= carros estacionados =================
  const parkedB = new GeoBuilder();
  const parkedGroup: THREE.BufferGeometry[] = [];
  for (const p of city.parked) {
    const v = buildVehicle(p.model, PAINTS[p.color % PAINTS.length]!, false);
    const m = new THREE.Matrix4().makeRotationY(p.rot).setPosition(p.x, 0, p.z);
    v.body.applyMatrix4(m);
    parkedGroup.push(v.body);
  }
  void parkedB;

  // ================= árvores =================
  for (const t of city.trees) buildTree(flat, t.x, t.z, t.s, t.kind, rnd);

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
      const row = rnd() < 0.7 ? ROW.pixo0 + Math.floor(rnd() * 6) : rnd() < 0.5 ? ROW.grafite0 + Math.floor(rnd() * 2) : ROW.block;
      walls.quad([bx, 0, bz], [ax, 0, az], [ax, 3.2, az], [bx, 3.2, bz], spanUV(row, 10, rnd), [1, 1, 1]);
      walls.quad([ax, 0, az], [bx, 0, bz], [bx, 3.2, bz], [ax, 3.2, az], spanUV(ROW.block, 10, rnd), [0.8, 0.8, 0.8]);
    }
    void rot;
  }

  // ================= materiais / meshes =================
  const wallMat = new THREE.MeshStandardMaterial({ map: tx.wall, vertexColors: true, roughness: 0.92, metalness: 0 });
  const flatMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 });
  const glowMat = new THREE.MeshBasicMaterial({ map: tx.litWindow, vertexColors: true });
  const signMat = new THREE.MeshBasicMaterial({ map: tx.shops, vertexColors: true });
  const emisMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const walkMat = new THREE.MeshStandardMaterial({ map: tx.sidewalk, vertexColors: true, roughness: 0.95 });
  tx.sidewalk.repeat.set(0.5, 0.5);
  const greenMat = new THREE.MeshStandardMaterial({ map: tx.signs, roughness: 0.6, emissive: 0x0a2a18, emissiveIntensity: 0.4 });
  const marksMat = new THREE.MeshStandardMaterial({ map: tx.marks, vertexColors: true, roughness: 0.7, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const poolMat = new THREE.MeshBasicMaterial({ map: tx.pool, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 });
  const dirtMat = new THREE.MeshStandardMaterial({ map: tx.dirt, roughness: 1 });

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

  // chão: asfalto + terra do cerrado em volta
  tx.asphalt.repeat.set((EXTENT * 2 + ROAD) / 9, (EXTENT * 2 + ROAD) / 9);
  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(EXTENT * 2 + ROAD, EXTENT * 2 + ROAD),
    new THREE.MeshStandardMaterial({ map: tx.asphalt, roughness: 0.82, metalness: 0.0, color: 0xb0aaa4 }),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.y = 0.005;
  asphalt.name = 'asphalt';
  group.add(asphalt);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshStandardMaterial({ map: tx.dirt.clone(), roughness: 1, color: 0x8a6a5a }),
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

  return { group, lampLights, paredaoLeds, beacon };
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
  const y0 = CURB_H;
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
  const pixoRow = () => ROW.pixo0 + Math.floor(rnd() * 6);

  // ---- corpo da casa, andar por andar ----
  for (let f = 0; f < lot.floors; f++) {
    const fy0 = f * FLOOR_H, fy1 = fy0 + FLOOR_H;
    // último andar às vezes sem reboco (tijolo aparente, "puxadinho")
    const unfinished = f > 0 && f === lot.floors - 1 && rnd() < 0.45;
    let row: number = unfinished ? ROW.brick : baseRow;
    let col: RGB = unfinished || row === ROW.brick || row === ROW.block ? [1, 1, 1] : paint;
    if (f === 0 && !lot.muro && rnd() < 0.45) { row = pixoRow(); col = [1, 1, 1]; }
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
            glow.wallZ(cx - dw / 2, cx + dw / 2, 0, 2.6, zf, [0.02, 0.1, 0.48, 0.5], lot.shop % 2 ? hex(0xe8fff4, 1.3) : hex(0xffe0b0, 1.3));
            walls.wallZ(cx - dw / 2, cx + dw / 2, 2.2, 2.6, zf + 0.01, tileUV(ROW.doors, 0), [1, 1, 1]);
            // mesa de plástico e cadeiras na calçada (bar)
            if (lot.shop === 0 || lot.shop === 1 || lot.shop === 10) plasticTables(flat, cx, hz + 1.8, rnd);
          } else {
            walls.wallZ(cx - dw / 2, cx + dw / 2, 0, 2.6, zf, tileUV(ROW.doors, Math.floor(rnd() * 4)), [1, 1, 1]);
          }
        }
        // letreiro aceso
        signs.wallZ(-hw + 0.3, hw - 0.3, 2.7, 3.35, zf + 0.06, signUV(lot.shop % SHOP_NAMES.length), [1.05, 1.05, 1.05]);
        flat.box(0, 3.02, hz + 0.02, lot.w - 0.4, 0.7, 0.05, hex(0x111111));
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
    flat.box(0, fy1 - 0.08, hz + 0.08, lot.w, 0.16, 0.18, hex(0x9c978e));
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
    flat.box(0, H + 0.3, hz - 0.1, lot.w, 0.6, 0.2, hex(0xb0aa9e));
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
      flat.box(cx, H + 1.0, back + 1, 0.05, 2, 0.05, hex(0x777777));
      flat.box(cx, H + 1.9, back + 1, 1.2, 0.03, 0.03, hex(0x777777));
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
    const mRow = rnd() < 0.55 ? pixoRow() : rnd() < 0.12 ? ROW.grafite0 + Math.floor(rnd() * 2) : baseRow;
    const mCol: RGB = mRow >= ROW.pixo0 || mRow === ROW.brick || mRow === ROW.block ? [1, 1, 1] : paint;
    const z = front - 0.1;
    walls.wallZ(-hw, gx - gate / 2, 0, mh, z, spanUV(mRow, gx - gate / 2 + hw, rnd, 0, mh / FLOOR_H), mCol);
    walls.wallZ(gx + gate / 2, hw, 0, mh, z, spanUV(mRow, hw - gx - gate / 2, rnd, 0, mh / FLOOR_H), mCol);
    walls.wallZ(gx - gate / 2, gx + gate / 2, 0, mh, z, tileUV(ROW.doors, Math.floor(rnd() * 4)), [0.9, 0.9, 0.9]);
    // topo do muro (com caco de vidro... fica só a faixa escura)
    flat.box(0, mh + 0.05, z - 0.08, lot.w, 0.1, 0.2, hex(0x8a857c));
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
  flat.cylinder(0, 0.3, 0, 2.4, 2.0, 1, 16, hex(0x8a857c));
  flat.cylinder(0, 1.3, 0, 1.6, 1.4, 20, 16, c);
  flat.cylinder(0, 21.3, 0, 1.4, 6.5, 4.5, 20, c, false);
  flat.cylinder(0, 25.8, 0, 6.5, 6.5, 2.6, 20, hex(0xd6d0c2));
  flat.cylinder(0, 28.4, 0, 6.5, 1.2, 1.6, 20, hex(0xb0aa9c));
  flat.cylinder(0, 30.0, 0, 0.1, 0.1, 0.6, 6, hex(0x444444));
  // faixa pintada e luzes de baixo pra cima
  flat.cylinder(0, 26.6, 0, 6.52, 6.52, 0.5, 20, hex(0x1d4fb8), false);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    emissive.box(Math.cos(a) * 3.2, 0.5, Math.sin(a) * 3.2, 0.4, 0.2, 0.4, hex(0xffe0a0, 2));
  }
}

function buildTerrao(flat: GeoBuilder, x: number, z: number): void {
  const white = hex(0xe8e8e8);
  for (const s of [-1, 1]) {
    const gz = z + s * 30;
    flat.box(x - 3.6, 1.2, gz, 0.12, 2.4, 0.12, white);
    flat.box(x + 3.6, 1.2, gz, 0.12, 2.4, 0.12, white);
    flat.box(x, 2.4, gz, 7.3, 0.12, 0.12, white);
  }
}

function buildFeira(flat: GeoBuilder, emissive: GeoBuilder, signs: GeoBuilder, marks: GeoBuilder, x: number, z: number, rnd: () => number): void {
  const tarps = [0x1f4fb8, 0xc02020, 0xe8c21a, 0xe8e8e8, 0x2a9a50, 0xd05a10];
  for (let k = 0; k < 6; k++) {
    const bx = x - 25 + k * 10, bz = z + 28;
    const col = hex(tarps[k]!);
    for (const [dx, dz] of [[-3.3, -2.3], [3.3, -2.3], [-3.3, 2.3], [3.3, 2.3]] as const) flat.box(bx + dx, 1.3, bz + dz, 0.08, 2.6, 0.08, hex(0x999999));
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
  flat.box(x - 8, 2.6, z + 34, 0.2, 5.2, 0.2, hex(0x555555));
  flat.box(x + 8, 2.6, z + 34, 0.2, 5.2, 0.2, hex(0x555555));
  // vagas pintadas
  for (let k = 0; k < 12; k++) {
    marks.setTransform(x - 33 + k * 6, 0.04, z - 20, 0);
    marks.quad([-0.08, 0, 3], [0.08, 0, 3], [0.08, 0, -3], [-0.08, 0, -3], [0, 0, 0.2, 1], hex(0xdddddd, 0.8));
  }
  marks.resetTransform();
}

function buildPosto(flat: GeoBuilder, emissive: GeoBuilder, signs: GeoBuilder, pools: GeoBuilder, walls: GeoBuilder, x: number, z: number): void {
  const cz = z + 15;
  // cobertura
  flat.box(x, 5.8, cz, 26, 0.9, 20, hex(0xe8e8e8));
  flat.box(x, 6.0, cz + 10.02, 26, 0.5, 0.05, hex(0xc01818));
  flat.box(x, 6.0, cz - 10.02, 26, 0.5, 0.05, hex(0xc01818));
  emissive.box(x, 5.33, cz, 24, 0.04, 18, hex(0xf0f6ff, 0.75));
  for (const sx of [-10, 10]) for (const sz of [-7, 7]) flat.box(x + sx, 2.7, cz + sz, 0.8, 5.4, 0.8, hex(0xd8d8d8));
  // bombas
  for (const sx of [-5, 5]) {
    flat.box(x + sx, 0.9, cz, 1.2, 1.8, 3.6, hex(0xe0e0e0));
    emissive.box(x + sx + 0.61, 1.3, cz, 0.02, 0.5, 1.2, hex(0x40ff90, 1.6));
    emissive.box(x + sx - 0.61, 1.3, cz, 0.02, 0.5, 1.2, hex(0x40ff90, 1.6));
  }
  poolQuad(pools, x, cz, 20, hex(0xdfe8ff, 0.22), 0.05);
  // conveniência
  const sz = z - 22;
  walls.setTransform(x, 0, sz, 0);
  walls.wallZ(-12, 12, 0, 4, 6, rowUV(ROW.plaster, 0, 1), hex(0xf0f0f0));
  walls.resetTransform();
  emissive.box(x, 1.4, sz + 6.05, 14, 2.4, 0.05, hex(0xe8fff0, 0.8));
  signs.setTransform(x, 0, sz + 6.15, 0);
  signs.wallZ(-8, 8, 3.0, 4.0, 0, signUV(SIGN_ROW.conveniencia), [1.4, 1.4, 1.4]);
  signs.resetTransform();
  // totem
  flat.box(x + 16, 4, z + 36, 0.4, 8, 0.4, hex(0x666666));
  signs.setTransform(x + 16, 0, z + 36.3, 0);
  signs.wallZ(-3, 3, 7, 8.6, 0, signUV(SIGN_ROW.posto), [1.6, 1.6, 1.6]);
  signs.resetTransform();
  signs.setTransform(x + 16, 0, z + 35.7, Math.PI);
  signs.wallZ(-3, 3, 7, 8.6, 0, signUV(SIGN_ROW.posto), [1.6, 1.6, 1.6]);
  signs.resetTransform();
}

function buildPraca(flat: GeoBuilder, emissive: GeoBuilder, marks: GeoBuilder, x: number, z: number): void {
  // quadra poliesportiva
  flat.box(x, CURB_H + 0.02, z, 30, 0.04, 20, hex(0x2d6a55));
  flat.box(x, CURB_H + 0.03, z, 26, 0.04, 14, hex(0x2a4f8a));
  marks.setTransform(x, CURB_H + 0.06, z, 0);
  marks.quad([-0.06, 0, 7], [0.06, 0, 7], [0.06, 0, -7], [-0.06, 0, -7], [0, 0, 0.2, 1], hex(0xffffff, 0.9));
  marks.resetTransform();
  // alambrado
  for (let k = -7; k <= 7; k++) for (const s of [-1, 1]) flat.box(x + k * 2, CURB_H + 2, z + s * 10, 0.06, 4, 0.06, hex(0x777777));
  for (const s of [-1, 1]) flat.box(x, CURB_H + 3.95, z + s * 10, 30, 0.05, 0.05, hex(0x777777));
  // tabelas de basquete
  for (const s of [-1, 1]) {
    flat.box(x + s * 14, CURB_H + 1.6, z, 0.12, 3.2, 0.12, hex(0x888888));
    flat.box(x + s * 13.8, CURB_H + 3.2, z, 0.06, 1.1, 1.7, hex(0xeeeeee));
  }
  // refletores da quadra
  for (const s of [-1, 1]) {
    flat.box(x + s * 16, CURB_H + 4.5, z + 11, 0.2, 9, 0.2, hex(0x666666));
    emissive.box(x + s * 16, CURB_H + 9, z + 10.8, 1.2, 0.5, 0.1, hex(0xf6fbff, 1.5));
  }
  // bancos
  for (let k = 0; k < 4; k++) flat.box(x - 24 + k * 16, CURB_H + 0.45, z + 16, 2, 0.1, 0.5, hex(0x9a948a));
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
