// Partículas na CPU desenhadas como Points: fumaça de pneu, poeira
// vermelha, chama do nitro, faíscas de batida.

import * as THREE from 'three';

const VERT = /* glsl */ `
attribute vec4 pcolor;
attribute float psize;
attribute vec3 pextra; // variante do atlas, ângulo, vida (1 nasceu -> 0 morreu)
varying vec4 vColor;
varying vec3 vExtra;
uniform float uScale;
void main() {
  vColor = pcolor;
  vExtra = pextra;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = psize * uScale / max(-mv.z, 0.1);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D map;
varying vec4 vColor;
varying vec3 vExtra;
void main() {
#ifdef CLOUD
  // nuvem "brócolis": bolotas com sombra de desenho, borda firme; morre
  // se desfazendo pelas bordas em vez de só ficar transparente
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(vExtra.y), s = sin(vExtra.y);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
  if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) discard;
  float v = vExtra.x;
  vec2 cell = vec2(mod(v, 2.0), floor(v / 2.0));
  vec4 t = texture2D(map, (clamp(p, 0.01, 0.99) + cell) * 0.5);
  float th = mix(0.9, 0.42, smoothstep(0.0, 0.45, vExtra.z));
  float a = smoothstep(th - 0.05, th + 0.05, t.a);
  gl_FragColor = vec4(vColor.rgb * t.rgb, a * min(0.92, vColor.a * 2.6));
#else
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vColor.rgb, vColor.a * t.a);
#endif
  if (gl_FragColor.a < 0.004) discard;
}
`;

/**
 * Atlas 2×2 de nuvens estilo desenho (cada uma um cacho de bolotas, igual
 * brócolis): alfa = campo suave (o shader recorta com borda firme), cor =
 * luz de cima em 3 faixas (toon).
 */
export function makeCloudAtlas(): THREE.CanvasTexture {
  const S = 256, N = S * 2;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const img = g.createImageData(N, N);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const L = [-0.45, 0.72, 0.53];
  const ll = Math.hypot(L[0]!, L[1]!, L[2]!);
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell % 2) * S, oy = Math.floor(cell / 2) * S;
    // bolota grande no meio + cacho em volta, mais cheio em cima
    const blobs: [number, number, number][] = [[0, 0.04, 0.27 + rnd() * 0.04]];
    const n = 6 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rnd() * 0.5;
      const d = 0.17 + rnd() * 0.07;
      const up = Math.sin(a) < 0 ? 1.0 : 0.8; // y da tela cresce pra baixo
      blobs.push([Math.cos(a) * d, Math.sin(a) * d * up, 0.13 + rnd() * 0.07]);
    }
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const px = x / S - 0.5, py = y / S - 0.5;
        let best = 0, bi = 0;
        for (let i = 0; i < blobs.length; i++) {
          const [bx, by, br] = blobs[i]!;
          const f = 1 - Math.hypot(px - bx, py - by) / (br * 2); // 0,5 na borda da bolota
          if (f > best) { best = f; bi = i; }
        }
        const o = ((oy + y) * N + ox + x) * 4;
        if (best <= 0) { img.data[o + 3] = 0; continue; }
        const [bx, by, br] = blobs[bi]!;
        const nx = (px - bx) / br, ny = -(py - by) / br;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const lam = (nx * L[0]! + ny * L[1]! + nz * L[2]!) / ll;
        // 3 faixas de luz (desenho) + miolo das bolotas mais escuro
        let sh = lam > 0.55 ? 1 : lam > 0.1 ? 0.8 : 0.6;
        if (best < 0.56) sh *= 0.9; // contorno das bolotas
        const v = Math.round(255 * sh);
        img.data[o] = v; img.data[o + 1] = v; img.data[o + 2] = Math.min(255, v + 6);
        img.data[o + 3] = Math.round(Math.min(1, best) * 255);
      }
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  return t;
}

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
  private extra: Float32Array;
  private next = 0;
  private material: THREE.ShaderMaterial;

  constructor(private max: number, map: THREE.Texture, additive: boolean, cloud = false) {
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
    this.extra = new Float32Array(max * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pextra', new THREE.BufferAttribute(this.extra, 3).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.material = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, uScale: { value: 400 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      defines: cloud ? { CLOUD: '' } : {},
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
    this.extra[i * 3] = Math.floor(Math.random() * 4);
    this.extra[i * 3 + 1] = Math.random() * Math.PI * 2;
    this.extra[i * 3 + 2] = 1;
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
      this.extra[i * 3 + 2] = t;
      // entra rápido, some devagar
      const fade = Math.min(1, (1 - t) * 8) * t;
      this.col[i * 4 + 3] = this.baseA[i]! * fade;
    }
    const g = this.points.geometry;
    g.attributes.position!.needsUpdate = true;
    g.attributes.pcolor!.needsUpdate = true;
    g.attributes.psize!.needsUpdate = true;
    g.attributes.pextra!.needsUpdate = true;
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
