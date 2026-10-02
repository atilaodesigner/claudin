// Carros estacionados de verdade: os mesmos GLB do tráfego (Uno, Uno com
// escada, Kombi...) parados no meio-fio, faróis apagados. Cada peça de cada
// modelo vira um InstancedMesh (um draw call pra todos os carros daquele
// modelo); a lataria pega a cor de cada carro pela cor da instância.

import * as THREE from 'three';
import { prepareCar, repaint, type CarEntry } from '../car/gltfCar';
import { makeSoftTexture } from '../car/mustang';
import { PAINTS } from '../traffic/vehicles';
import type { Parked } from './city';
import { mergeByMaterial } from '../utils/mergeModel';
import type { BreakSpec, PropPart } from './breakables';
import type { Shape } from '../physics/collide';
import { ChunkCuller, groupByCell } from './chunks';

/** batida forte arremessa o carro estacionado (massa de carro popular) */
const PARKED_SPEC: BreakSpec = { mass: 950, minV: 6 };

export interface ParkedCars {
  group: THREE.Group;
  /** peças de cada modelo (pro Breakables mexer nas instâncias) */
  parts: Map<string, PropPart[][]>;
  breakables: { name: string; index: number; shape: Shape; base: THREE.Matrix4; h: number; r: number; spec: BreakSpec }[];
}

/** só a semente do carro decide o modelo: o mesmo lugar sempre tem o mesmo carro */
function pickModel(models: { entry: CarEntry }[], seed: number): number {
  const total = models.reduce((a, m) => a + (m.entry.weight ?? 1), 0);
  let r = ((seed * 7919) % 1000) / 1000 * total;
  for (let i = 0; i < models.length; i++) {
    r -= models[i]!.entry.weight ?? 1;
    if (r <= 0) return i;
  }
  return models.length - 1;
}

export function buildParked(list: Parked[], cars: { entry: CarEntry; scene: THREE.Group }[], culler: ChunkCuller): ParkedCars | null {
  // ônibus não estaciona na rua
  const models = cars.filter((c) => c.entry.role === 'traffic' && !c.entry.bus);
  if (!models.length || !list.length) return null;
  const group = new THREE.Group();
  group.name = 'parked';
  const byModel = models.map(() => [] as Parked[]);
  for (const p of list) byModel[pickModel(models, p.color)]!.push(p);

  const shadowMat = new THREE.MeshBasicMaterial({ map: makeSoftTexture(), color: 0x000000, transparent: true, opacity: 0.75, depthWrite: false });
  const col = new THREE.Color();
  const partsBy = new Map<string, PropPart[][]>();
  const breakables: ParkedCars['breakables'] = [];
  models.forEach((model, mi) => {
    const here = byModel[mi]!;
    if (!here.length) return;
    const p = prepareCar(model.scene, model.entry);
    const recolor = model.entry.recolor !== false;
    // cor branca na lataria: a cor de cada carro vem da instância
    if (recolor) repaint(p, 0xffffff, null, 0.35);
    const paint = new Set<THREE.Material>(recolor ? p.paintMats : []);
    const parts = mergeByMaterial(p.root, (m) => paint.has(m)).map((part) => {
      // estacionado: farol, lanterna e painel apagados
      const sm = part.mat as THREE.MeshStandardMaterial;
      if (sm.emissive) {
        sm.emissive.setRGB(0, 0, 0);
        sm.emissiveMap = null;
      }
      if ((part.mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) (part.mat as THREE.MeshBasicMaterial).color.multiplyScalar(0.15);
      return part;
    });
    const base = here.map((c) => new THREE.Matrix4().makeRotationY(c.rot).setPosition(c.x, 0, c.z));
    // um InstancedMesh por peça e por pedaço do mapa (o longe/fora da tela não desenha)
    const props: PropPart[][] = here.map(() => []);
    const cells = groupByCell(base);
    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, local: THREE.Matrix4, paint: boolean, hideOnHit = false) => {
      const out: THREE.InstancedMesh[] = [];
      for (const idx of cells) {
        const im = new THREE.InstancedMesh(geo, mat, idx.length);
        idx.forEach((i, k) => {
          im.setMatrixAt(k, new THREE.Matrix4().multiplyMatrices(base[i]!, local));
          if (paint) im.setColorAt(k, col.setHex(PAINTS[here[i]!.color % PAINTS.length]!));
          props[i]!.push({ im, local, index: k, hideOnHit });
        });
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.matrixAutoUpdate = false;
        // folga pros carros arremessados não sumirem na beira da tela
        im.computeBoundingSphere();
        im.boundingSphere!.radius += 20;
        culler.add(im, 280);
        group.add(im);
        out.push(im);
      }
      return out;
    };
    for (const part of parts) inst(part.geo, part.mat, new THREE.Matrix4(), part.flag);
    // sombra de contato (some enquanto o carro está voando)
    const lift = new THREE.Matrix4().makeTranslation(0, 0.02, 0);
    for (const sh of inst(new THREE.PlaneGeometry(p.halfW * 2 + 0.6, p.halfL * 2 + 0.8).rotateX(-Math.PI / 2), shadowMat, lift, false, true)) {
      sh.renderOrder = 2;
      sh.layers.set(1);
    }
    const name = model.entry.id;
    partsBy.set(name, props);
    here.forEach((c, i) => {
      if (c.shape) breakables.push({ name, index: i, shape: c.shape, base: base[i]!, h: p.height / 2, r: p.halfW, spec: PARKED_SPEC });
    });
  });
  return { group, parts: partsBy, breakables };
}
