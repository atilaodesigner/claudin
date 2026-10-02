import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { prepareCar, type CarEntry } from '../src/car/gltfCar';

/** carro de mentira em cm, deitado no eixo X, frente em -X, com rodas e faróis nomeados */
function fakeCar(): THREE.Group {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0xcc2222, name: 'CarPaint' });
  const body = new THREE.Mesh(new THREE.BoxGeometry(450, 80, 180), paint);
  body.position.y = 90;
  body.name = 'Body';
  g.add(body);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, name: 'Tire' });
  for (const [x, z, n] of [[-140, 80, 'wheel_fl'], [-140, -80, 'wheel_fr'], [140, 80, 'wheel_rl'], [140, -80, 'wheel_rr']] as const) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(33, 33, 22, 16), tireMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 33, z);
    w.name = n;
    g.add(w);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(5, 10, 40), new THREE.MeshStandardMaterial({ name: 'HeadLight' }));
  head.position.set(-226, 100, 50);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(5, 10, 40), new THREE.MeshStandardMaterial({ name: 'TailLight' }));
  tail.position.set(226, 100, 50);
  g.add(head, tail);
  g.scale.setScalar(1.3); // escala errada de propósito
  return g;
}

const entry: CarEntry = { id: 't', file: 't.glb', role: 'traffic', name: 't', length: 4.5, credit: '', license: '', url: '' };

describe('carro GLB normalizado', () => {
  it('põe o comprimento certo, frente em +Z e chão em y = 0', () => {
    const p = prepareCar(fakeCar(), entry);
    expect(p.halfL * 2).toBeCloseTo(4.5, 2);
    expect(p.halfW).toBeLessThan(p.halfL);
    const box = new THREE.Box3().setFromObject(p.root);
    expect(box.min.y).toBeCloseTo(0, 3);
    // farol tem que ter ido pra frente (+Z)
    let headZ = 0;
    p.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.Material).name === 'HeadLight') headZ = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).z;
    });
    expect(headZ).toBeGreaterThan(2);
  });

  it('acha as quatro rodas na ordem DE, DD, TE, TD e a pintura', () => {
    const p = prepareCar(fakeCar(), entry);
    expect(p.wheels).toHaveLength(4);
    const [fl, fr, rl, rr] = p.wheels.map((w) => w.steer.position);
    expect(fl!.z).toBeGreaterThan(0);
    expect(fl!.x).toBeGreaterThan(0);
    expect(fr!.x).toBeLessThan(0);
    expect(rl!.z).toBeLessThan(0);
    expect(rr!.x).toBeLessThan(0);
    expect(p.wheelR).toBeGreaterThan(0.25);
    expect(p.wheelR).toBeLessThan(0.45);
    expect(p.paintMats.map((m) => m.name)).toEqual(['CarPaint']);
  });
});
