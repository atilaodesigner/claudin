import { AdditiveBlending, CanvasTexture, CircleGeometry, Mesh, MeshBasicMaterial, SphereGeometry, type Material } from 'three';
import type { ModelLibrary } from '../assets/ModelLibrary';

function rotorTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
  g.addColorStop(0, 'rgba(40,44,50,0.5)');
  g.addColorStop(0.7, 'rgba(210,220,230,0.08)');
  g.addColorStop(1, 'rgba(210,220,230,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  ctx.translate(64, 64);
  for (let i = 0; i < 2; i++) {
    ctx.rotate(Math.PI / 2);
    const lg = ctx.createLinearGradient(0, -6, 0, 6);
    lg.addColorStop(0, 'rgba(30,32,36,0)');
    lg.addColorStop(0.5, 'rgba(30,32,36,0.35)');
    lg.addColorStop(1, 'rgba(30,32,36,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(-62, -5, 124, 10);
  }
  return new CanvasTexture(c);
}

/** Shared geometries/materials for enemy meshes (rotor blur, glows, fake shadows). */
export class EnemyAssets {
  readonly rotorMat = new MeshBasicMaterial({ color: 0xffffff, map: rotorTexture(), transparent: true, opacity: 0.55, depthWrite: false });
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

  /** Frees what this set owns (the model geometries belong to the shared library). */
  dispose(): void {
    this.rotorMat.map?.dispose();
    for (const m of [this.rotorMat, this.glowRed, this.glowBlue, this.glowOrange, this.shadowMat]) m.dispose();
    this.disc.dispose();
    this.sphere.dispose();
  }

  fakeShadow(w: number, l: number): Mesh {
    const m = new Mesh(this.disc, this.shadowMat);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(w, l, 1);
    m.renderOrder = 2;
    return m;
  }
}
