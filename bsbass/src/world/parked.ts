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

export function buildParked(list: Parked[], cars: { entry: CarEntry; scene: THREE.Group }[]): THREE.Group | null {
  // ônibus não estaciona na rua
  const models = cars.filter((c) => c.entry.role === 'traffic' && !c.entry.bus);
  if (!models.length || !list.length) return null;
  const group = new THREE.Group();
  group.name = 'parked';
  const byModel = models.map(() => [] as Parked[]);
  for (const p of list) byModel[pickModel(models, p.color)]!.push(p);

  const shadowMat = new THREE.MeshBasicMaterial({ map: makeSoftTexture(), color: 0x000000, transparent: true, opacity: 0.75, depthWrite: false });
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
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
    for (const part of parts) {
      const im = new THREE.InstancedMesh(part.geo, part.mat, here.length);
      base.forEach((b, i) => {
        im.setMatrixAt(i, b);
        if (part.flag) im.setColorAt(i, col.setHex(PAINTS[here[i]!.color % PAINTS.length]!));
      });
      im.matrixAutoUpdate = false;
      im.computeBoundingSphere();
      group.add(im);
    }
    // sombra de contato
    const sh = new THREE.InstancedMesh(new THREE.PlaneGeometry(p.halfW * 2 + 0.6, p.halfL * 2 + 0.8).rotateX(-Math.PI / 2), shadowMat, here.length);
    base.forEach((b, i) => sh.setMatrixAt(i, m4.copy(b).setPosition(here[i]!.x, 0.02, here[i]!.z)));
    sh.renderOrder = 2;
    sh.matrixAutoUpdate = false;
    sh.computeBoundingSphere();
    sh.layers.set(1);
    group.add(sh);
  });
  return group;
}
