// Marcas de pneu no asfalto (buffer circular de quads) e rastro de luz
// das lanternas (fita virada pra câmera).

import * as THREE from 'three';

export class SkidMarks {
  readonly mesh: THREE.Mesh;
  private pos: Float32Array;
  private col: Float32Array;
  private next = 0;
  private last: ({ x: number; z: number } | null)[] = [];

  constructor(private max = 2400) {
    this.pos = new Float32Array(max * 4 * 3);
    this.col = new Float32Array(max * 4 * 4);
    const idx = new Uint32Array(max * 6);
    for (let i = 0; i < max; i++) {
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.mesh = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  /** chama todo frame por roda; intensidade 0 encerra o traço */
  add(wheel: number, x: number, y: number, z: number, intensity: number, dirt: boolean): void {
    const last = this.last[wheel];
    if (intensity <= 0.05) {
      this.last[wheel] = null;
      return;
    }
    if (!last) {
      this.last[wheel] = { x, z };
      return;
    }
    const dx = x - last.x, dz = z - last.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) return;
    if (d > 3) {
      this.last[wheel] = { x, z };
      return;
    }
    const w = 0.14;
    const nx = (-dz / d) * w, nz = (dx / d) * w;
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    const yy = y + 0.02;
    this.pos.set([last.x + nx, yy, last.z + nz, last.x - nx, yy, last.z - nz, x - nx, yy, z - nz, x + nx, yy, z + nz], i * 12);
    const a = Math.min(0.75, intensity * 0.8);
    const c = dirt ? [0.12, 0.05, 0.02, a] : [0.015, 0.015, 0.015, a];
    for (let k = 0; k < 4; k++) this.col.set(c, i * 16 + k * 4);
    this.last[wheel] = { x, z };
    const g = this.mesh.geometry;
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}

export class LightTrail {
  readonly mesh: THREE.Mesh;
  private pts: THREE.Vector3[] = [];
  private pos: Float32Array;
  private col: Float32Array;

  constructor(private n = 16, private color = new THREE.Color(1.6, 0.05, 0.03), private width = 0.04) {
    this.pos = new Float32Array(n * 2 * 3);
    this.col = new Float32Array(n * 2 * 4);
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
  }

  private v = new THREE.Vector3();
  private side = new THREE.Vector3();
  private view = new THREE.Vector3();

  update(p: THREE.Vector3, camera: THREE.Camera, strength: number): void {
    const head = this.pts[0];
    if (!head || head.distanceToSquared(p) > 0.04) {
      this.pts.unshift(p.clone());
      if (this.pts.length > this.n) this.pts.pop();
    } else {
      head.copy(p);
    }
    const cam = camera.position;
    for (let i = 0; i < this.n; i++) {
      const a = this.pts[Math.min(i, this.pts.length - 1)] ?? p;
      const b = this.pts[Math.min(i + 1, this.pts.length - 1)] ?? a;
      this.v.subVectors(a, b);
      if (this.v.lengthSq() < 1e-6) this.v.set(0, 0, 1);
      this.view.subVectors(cam, a);
      this.side.crossVectors(this.v, this.view).normalize();
      const t = i / (this.n - 1);
      const w = this.width * (1 - t * 0.7);
      this.pos.set([a.x + this.side.x * w, a.y + this.side.y * w, a.z + this.side.z * w, a.x - this.side.x * w, a.y - this.side.y * w, a.z - this.side.z * w], i * 6);
      const alpha = strength * (1 - t) * (i < this.pts.length ? 1 : 0);
      const c = this.color;
      this.col.set([c.r, c.g, c.b, alpha, c.r, c.g, c.b, alpha], i * 8);
    }
    const g = this.mesh.geometry;
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}
