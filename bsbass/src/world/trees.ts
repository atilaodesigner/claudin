// Árvores com textura de verdade (ambientCG, CC0): tronco e galhos com casca,
// copa feita de "cards" cruzados com cachos de folha recortados. Os ipês usam
// o cacho claro tingido de rosa/amarelo (florada); o cerrado fica verde-oliva.

import * as THREE from 'three';
import { GeoBuilder, type RGB } from '../utils/geo';
import { mulberry32, range } from '../utils/rng';
import type { City, Tree } from './city';

const GREEN: [number, number, number, number] = [0.005, 0.01, 0.495, 0.99];
const BLOSSOM: [number, number, number, number] = [0.505, 0.01, 0.995, 0.99];

function limb(b: GeoBuilder, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r0: number, r1: number): void {
  // tronco/galho cônico de 7 lados, com UV contínuo pra casca
  const seg = 7;
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  const len = Math.hypot(dx, dy, dz);
  const ax = new THREE.Vector3(dx, dy, dz).normalize();
  const u = Math.abs(ax.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const s1 = new THREE.Vector3().crossVectors(ax, u).normalize();
  const s2 = new THREE.Vector3().crossVectors(ax, s1).normalize();
  const ring = (t: number, r: number, a: number): [number, number, number] => {
    const c = Math.cos(a) * r, s = Math.sin(a) * r;
    return [x0 + dx * t + s1.x * c + s2.x * s, y0 + dy * t + s1.y * c + s2.y * s, z0 + dz * t + s1.z * c + s2.z * s];
  };
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    b.quad(ring(0, r0, a0), ring(0, r0, a1), ring(1, r1, a1), ring(1, r1, a0), [i / seg, 0, (i + 1) / seg, len / 1.5], [1, 1, 1]);
  }
}

function card(b: GeoBuilder, x: number, y: number, z: number, size: number, rotY: number, tilt: number, uv: [number, number, number, number], col: RGB): void {
  // dois quads cruzados (X) = volume de copa visto de qualquer lado
  const h = size / 2;
  for (const extra of [0, Math.PI / 2]) {
    const a = rotY + extra;
    const cx = Math.cos(a) * h, cz = -Math.sin(a) * h;
    const ty = Math.sin(tilt) * h;
    b.quad([x - cx, y - h + ty, z - cz], [x + cx, y - h - ty, z + cz], [x + cx, y + h - ty, z + cz], [x - cx, y + h + ty, z - cz], uv, col);
  }
}

function tree(bark: GeoBuilder, leaves: GeoBuilder, t: Tree, rnd: () => number): void {
  const s = t.s;
  const base = t.x === 0 && t.z === 0 ? 0 : 0; // (ilha do balão já compensa na altura)
  const y0 = Math.hypot(t.x, t.z) < 13 ? 0.3 : base;
  if (t.kind === 'cerrado') {
    // árvore torta do cerrado: tronco em dois lances + copa baixa e aberta
    const lx = range(rnd, -0.6, 0.6) * s, lz = range(rnd, -0.6, 0.6) * s;
    const mx = t.x + lx, mz = t.z + lz, my = y0 + 1.6 * s;
    limb(bark, t.x, y0, t.z, mx, my, mz, 0.2 * s, 0.14 * s);
    const tx = mx + range(rnd, -0.8, 0.8) * s, tz = mz + range(rnd, -0.8, 0.8) * s, ty = my + 1.1 * s;
    limb(bark, mx, my, mz, tx, ty, tz, 0.14 * s, 0.07 * s);
    limb(bark, mx, my, mz, mx - lx * 1.5, my + 0.9 * s, mz - lz * 1.5, 0.1 * s, 0.05 * s);
    const col: RGB = [range(rnd, 0.62, 0.8), range(rnd, 0.68, 0.82), range(rnd, 0.42, 0.55)];
    for (let k = 0; k < 6; k++) {
      card(leaves, tx + range(rnd, -1.3, 1.3) * s, ty + range(rnd, -0.2, 0.5) * s, tz + range(rnd, -1.3, 1.3) * s, range(rnd, 1.4, 2.1) * s, rnd() * 6, range(rnd, -0.2, 0.2), GREEN, col);
    }
    return;
  }
  // ipê: tronco reto, 3 galhos abrindo, copa redonda florida
  const top = y0 + 2.8 * s;
  limb(bark, t.x, y0, t.z, t.x, top, t.z, 0.2 * s, 0.13 * s);
  const tips: [number, number, number][] = [];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + rnd();
    const ex = t.x + Math.cos(a) * 1.3 * s, ez = t.z + Math.sin(a) * 1.3 * s, ey = top + 1.2 * s;
    limb(bark, t.x, top - 0.3 * s, t.z, ex, ey, ez, 0.1 * s, 0.05 * s);
    tips.push([ex, ey, ez]);
  }
  const col: RGB = t.kind === 'ipe-rosa' ? [1.05, range(rnd, 0.42, 0.55), range(rnd, 0.72, 0.85)] : [1.1, range(rnd, 0.82, 0.92), 0.22];
  for (let k = 0; k < 10; k++) {
    const [ex, ey, ez] = tips[k % 3]!;
    const cx = k < 3 ? t.x : ex, cz = k < 3 ? t.z : ez;
    card(leaves, cx + range(rnd, -0.8, 0.8) * s, ey + range(rnd, -0.4, 0.7) * s, cz + range(rnd, -0.8, 0.8) * s, range(rnd, 1.6, 2.3) * s, rnd() * 6, range(rnd, -0.25, 0.25), k % 4 === 3 ? GREEN : BLOSSOM, k % 4 === 3 ? [0.8, 0.85, 0.6] : col);
  }
}

export function buildTrees(city: City, barkTex: THREE.Texture, leafTex: THREE.Texture): THREE.Group {
  const rnd = mulberry32(4242);
  const bark = new GeoBuilder();
  const leaves = new GeoBuilder();
  for (const t of city.trees) tree(bark, leaves, t, rnd);
  barkTex.wrapS = barkTex.wrapT = THREE.RepeatWrapping;
  const g = new THREE.Group();
  g.name = 'trees';
  const trunk = new THREE.Mesh(bark.build(), new THREE.MeshStandardMaterial({ map: barkTex, vertexColors: true, roughness: 0.95, color: 0x9a8a78 }));
  const crown = new THREE.Mesh(
    leaves.build(),
    new THREE.MeshStandardMaterial({ map: leafTex, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }),
  );
  trunk.matrixAutoUpdate = crown.matrixAutoUpdate = false;
  g.add(trunk, crown);
  return g;
}
