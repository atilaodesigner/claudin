import { AdditiveBlending, CircleGeometry, Mesh, MeshBasicMaterial, SphereGeometry, type Material } from 'three';
import type { ModelLibrary } from '../assets/ModelLibrary';

/** Shared geometries/materials for enemy meshes (rotor blur, glows, fake shadows). */
export class EnemyAssets {
  readonly rotorMat = new MeshBasicMaterial({ color: 0xdfe8f0, transparent: true, opacity: 0.22, depthWrite: false });
  readonly glowRed = new MeshBasicMaterial({ color: 0xff2d2d, blending: AdditiveBlending, transparent: true, depthWrite: false });
  readonly glowBlue = new MeshBasicMaterial({ color: 0x2d6bff, blending: AdditiveBlending, transparent: true, depthWrite: false });
  readonly glowOrange = new MeshBasicMaterial({ color: 0xffa040, blending: AdditiveBlending, transparent: true, depthWrite: false });
  readonly shadowMat = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
  readonly disc = new CircleGeometry(1, 24);
  readonly sphere = new SphereGeometry(1, 10, 8);

  constructor(
    readonly lib: ModelLibrary,
    readonly material: Material,
  ) {}

  model(key: string): Mesh {
    const m = new Mesh(this.lib.get(key).geometry, this.material);
    m.castShadow = true;
    return m;
  }

  rotor(radius: number): Mesh {
    const m = new Mesh(this.disc, this.rotorMat);
    m.rotation.x = -Math.PI / 2;
    m.scale.setScalar(radius);
    return m;
  }

  glow(mat: MeshBasicMaterial, r: number): Mesh {
    const m = new Mesh(this.sphere, mat);
    m.scale.setScalar(r);
    return m;
  }

  fakeShadow(w: number, l: number): Mesh {
    const m = new Mesh(this.disc, this.shadowMat);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(w, l, 1);
    m.renderOrder = 2;
    return m;
  }
}
