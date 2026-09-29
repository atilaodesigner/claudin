// Partículas na CPU desenhadas como Points: fumaça de pneu, poeira
// vermelha, chama do nitro, faíscas de batida.

import * as THREE from 'three';

const VERT = /* glsl */ `
attribute vec4 pcolor;
attribute float psize;
varying vec4 vColor;
uniform float uScale;
void main() {
  vColor = pcolor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = psize * uScale / max(-mv.z, 0.1);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D map;
varying vec4 vColor;
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vColor.rgb, vColor.a * t.a);
  if (gl_FragColor.a < 0.004) discard;
}
`;

export interface EmitOptions {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;
  size: number;
  grow: number; // tamanho extra por segundo
  r: number; g: number; b: number; a: number;
  drag?: number;
  gravity?: number;
}

export class Particles {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private grow: Float32Array;
  private baseA: Float32Array;
  private drag: Float32Array;
  private grav: Float32Array;
  private next = 0;
  private material: THREE.ShaderMaterial;

  constructor(private max: number, map: THREE.Texture, additive: boolean) {
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max).fill(1);
    this.grow = new Float32Array(max);
    this.baseA = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.material = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, uScale: { value: 400 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
  }

  setViewportHeight(h: number, fovDeg: number): void {
    // tamanho em metros -> pixels
    this.material.uniforms.uScale!.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
  }

  /** fração das partículas emitidas (preset de qualidade) */
  density = 1;

  emit(o: EmitOptions): void {
    if (this.density < 1 && Math.random() > this.density) return;
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos[i * 3] = o.x; this.pos[i * 3 + 1] = o.y; this.pos[i * 3 + 2] = o.z;
    this.vel[i * 3] = o.vx; this.vel[i * 3 + 1] = o.vy; this.vel[i * 3 + 2] = o.vz;
    this.col[i * 4] = o.r; this.col[i * 4 + 1] = o.g; this.col[i * 4 + 2] = o.b; this.col[i * 4 + 3] = o.a;
    this.baseA[i] = o.a;
    this.size[i] = o.size;
    this.grow[i] = o.grow;
    this.life[i] = o.life;
    this.maxLife[i] = o.life;
    this.drag[i] = o.drag ?? 1.5;
    this.grav[i] = o.gravity ?? 0;
  }

  update(dt: number): void {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i]! <= 0) {
        if (this.col[i * 4 + 3] !== 0) this.col[i * 4 + 3] = 0;
        continue;
      }
      this.life[i]! -= dt;
      const k = Math.max(0, 1 - this.drag[i]! * dt);
      this.vel[i * 3]! *= k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1]! * k - this.grav[i]! * dt;
      this.vel[i * 3 + 2]! *= k;
      this.pos[i * 3]! += this.vel[i * 3]! * dt;
      this.pos[i * 3 + 1] = Math.max(0.02, this.pos[i * 3 + 1]! + this.vel[i * 3 + 1]! * dt);
      this.pos[i * 3 + 2]! += this.vel[i * 3 + 2]! * dt;
      this.size[i]! += this.grow[i]! * dt;
      const t = Math.max(0, this.life[i]! / this.maxLife[i]!);
      // entra rápido, some devagar
      const fade = Math.min(1, (1 - t) * 8) * t;
      this.col[i * 4 + 3] = this.baseA[i]! * fade;
    }
    const g = this.points.geometry;
    g.attributes.position!.needsUpdate = true;
    g.attributes.pcolor!.needsUpdate = true;
    g.attributes.psize!.needsUpdate = true;
  }
}

/** poeira fina flutuando em volta da câmera (seca do DF) */
export class DustMotes {
  readonly points: THREE.Points;
  private base: Float32Array;
  private pos: Float32Array;
  private t = 0;

  constructor(map: THREE.Texture, private n = 500, private r = 30) {
    this.base = new Float32Array(n * 3);
    this.pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.base[i * 3] = (Math.random() - 0.5) * 2 * r;
      this.base[i * 3 + 1] = Math.random() * 8;
      this.base[i * 3 + 2] = (Math.random() - 0.5) * 2 * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(
      g,
      new THREE.PointsMaterial({ map, size: 0.07, color: 0xffb070, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.points.frustumCulled = false;
  }

  update(dt: number, cx: number, cz: number): void {
    this.t += dt;
    const r = this.r, d = r * 2;
    for (let i = 0; i < this.n; i++) {
      const bx = this.base[i * 3]! + Math.sin(this.t * 0.3 + i) * 1.5 + this.t * 0.8;
      const bz = this.base[i * 3 + 2]! + Math.cos(this.t * 0.25 + i * 1.3) * 1.5 + this.t * 0.3;
      // embrulha em volta da câmera
      this.pos[i * 3] = cx + ((((bx - cx) % d) + d * 1.5) % d) - r;
      this.pos[i * 3 + 1] = this.base[i * 3 + 1]! + Math.sin(this.t * 0.5 + i * 0.7) * 0.3;
      this.pos[i * 3 + 2] = cz + ((((bz - cz) % d) + d * 1.5) % d) - r;
    }
    this.points.geometry.attributes.position!.needsUpdate = true;
  }
}
