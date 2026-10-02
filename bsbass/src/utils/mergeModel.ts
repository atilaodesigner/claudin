// Junta as malhas de um modelo GLB por material (pra instanciar com poucos
// draw calls): carros estacionados e postes.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface MergedPart {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  /** o que `flag` disse do material (a pintura do carro, por exemplo) */
  flag: boolean;
}

function toFloat(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): THREE.BufferAttribute {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c);
  return new THREE.BufferAttribute(out, a.itemSize);
}

/** geometria só com posição/normal/uv (pra dar pra juntar peças de origens diferentes) */
function clean(g: THREE.BufferGeometry, index: ArrayLike<number> | null, start: number, count: number, local: THREE.Matrix4): THREE.BufferGeometry {
  const src = new THREE.BufferGeometry();
  // os GLB vêm quantizados (inteiros normalizados): passa pra float antes de mover
  for (const k of ['position', 'normal', 'uv']) if (g.attributes[k]) src.setAttribute(k, toFloat(g.attributes[k]!));
  if (index) src.setIndex(Array.from(index).slice(start, start + count));
  const out = src.index ? src.toNonIndexed() : src.clone();
  if (!out.attributes.normal) out.computeVertexNormals();
  if (!out.attributes.uv) out.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(out.attributes.position!.count * 2), 2));
  out.applyMatrix4(local);
  return out;
}

/**
 * o modelo inteiro em poucas peças: tudo que usa o mesmo material vira uma
 * geometria só, já na posição dentro do modelo (um draw call por material)
 */
export function mergeByMaterial(root: THREE.Object3D, flag: (m: THREE.Material) => boolean = () => false): MergedPart[] {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  // o material de cada malha pode ser um clone: junta pelos materiais iguais (mesmas texturas e cor)
  const byKey = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>();
  const keyOf = (mat: THREE.Material) => {
    const m = mat as THREE.MeshStandardMaterial;
    return [m.type, m.name, m.map?.uuid, m.normalMap?.uuid, m.color?.getHex(), m.transparent, m.opacity, m.side, flag(mat)].join('|');
  };
  const put = (mat: THREE.Material, geo: THREE.BufferGeometry) => {
    const k = keyOf(mat);
    const l = byKey.get(k);
    if (l) l.geos.push(geo);
    else byKey.set(k, { mat, geos: [geo] });
  };
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    const local = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const g = m.geometry;
    const idx = g.index ? (g.index.array as ArrayLike<number>) : null;
    const total = idx ? idx.length : g.attributes.position!.count;
    if (mats.length === 1 || !g.groups.length) {
      put(mats[0]!, clean(g, idx, 0, total, local));
      return;
    }
    for (const grp of g.groups) {
      const mat = mats[grp.materialIndex ?? 0];
      if (!mat) continue;
      if (idx) put(mat, clean(g, idx, grp.start, Math.min(grp.count, total - grp.start), local));
    }
  });
  const out: MergedPart[] = [];
  for (const { mat, geos } of byKey.values()) {
    const geo = geos.length > 1 ? mergeGeometries(geos) : geos[0]!;
    if (geo) out.push({ geo, mat, flag: flag(mat) });
  }
  return out;
}
