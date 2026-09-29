// Efeitos de "rabisco" estilo NFS Unbound: traços soltos de caneta, sem
// preenchimento (zigue-zague de chama, laçadas de fumaça, linhas de
// velocidade tremidas, asa só no contorno, raio, espiral, estalos). Cada
// rabisco tem dois quadros desenhados com tremida diferente que alternam
// rápido: o traço "ferve" como animação feita à mão.

import * as THREE from 'three';

export const Doodle = { Flame: 0, Cloud: 2, Speed: 4, Star: 6, Wing: 8, Bolt: 10, Swirl: 12, Ring: 14 } as const;
export type Doodle = (typeof Doodle)[keyof typeof Doodle];

type P = [number, number];

function jitter(n: number): number {
  return (Math.random() - 0.5) * n;
}

/**
 * Traço de caneta aberto: suaviza os pontos (Catmull-Rom), treme cada ponto
 * um pouco e afina nas pontas como marcador de verdade. Sombra fininha por
 * baixo só pra destacar do fundo, sem virar contorno.
 */
function stroke(g: CanvasRenderingContext2D, pts: P[], width: number, wobble = 3): void {
  if (pts.length < 2) return;
  const src = pts.map(([x, y]): P => [x + jitter(wobble), y + jitter(wobble)]);
  const pl: P[] = [];
  for (let i = 0; i < src.length - 1; i++) {
    const p0 = src[Math.max(0, i - 1)]!, p1 = src[i]!, p2 = src[i + 1]!, p3 = src[Math.min(src.length - 1, i + 2)]!;
    for (let k = 0; k < 6; k++) {
      const t = k / 6, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      pl.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  pl.push(src[src.length - 1]!);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const pass of [0, 1]) {
    g.strokeStyle = pass === 0 ? 'rgba(0,0,0,0.28)' : '#fff';
    for (let i = 0; i < pl.length - 1; i++) {
      const u = i / (pl.length - 1);
      // pressão: começa fino, engrossa, solta no fim
      const w = width * (0.35 + 0.65 * Math.sin(Math.min(1, u * 1.15) * Math.PI) ** 0.6);
      g.lineWidth = pass === 0 ? w + 3 : w;
      g.beginPath();
      g.moveTo(pl[i]![0], pl[i]![1]);
      g.lineTo(pl[i + 1]![0], pl[i + 1]![1]);
      g.stroke();
    }
  }
}

function drawCell(g: CanvasRenderingContext2D, kind: number, cx: number, cy: number): void {
  const j = jitter;
  switch (kind) {
    case Doodle.Flame: {
      // chama num traço só, zigue-zague subindo e descendo (lambida de fogo)
      const pts: P[] = [[cx - 70, cy + 70]];
      const peaks = 5;
      for (let i = 0; i < peaks; i++) {
        const x = cx - 60 + (i + 0.5) * (120 / peaks);
        const h = (i === 2 ? 105 : i % 2 ? 70 : 85) + j(20);
        pts.push([x + j(8), cy + 60 - h - 20], [x + 12 + j(6), cy + 30 + j(12)]);
      }
      pts.push([cx + 72, cy + 70]);
      stroke(g, pts, 7, 5);
      // duas lambidas soltas por dentro
      stroke(g, [[cx - 22, cy + 55], [cx - 10 + j(8), cy - 10], [cx + 2, cy + 30]], 5, 4);
      stroke(g, [[cx + 8, cy + 60], [cx + 24 + j(8), cy + 5], [cx + 34, cy + 40]], 5, 4);
      break;
    }
    case Doodle.Cloud: {
      // fumaça = laçadas contínuas, tipo "eeee" de caneta que embola
      const pts: P[] = [];
      const loops = 5;
      for (let i = 0; i <= loops * 10; i++) {
        const t = i / 10;
        const a = t * Math.PI * 2;
        const r = 28 + Math.sin(t * 1.7) * 6;
        pts.push([cx - 85 + t * (170 / loops) + Math.cos(a + Math.PI) * r, cy + 10 + Math.sin(a + Math.PI) * r * 0.9 - Math.sin((t / loops) * Math.PI) * 30]);
      }
      stroke(g, pts, 6, 4);
      break;
    }
    case Doodle.Speed: {
      // linhas de velocidade tremidas, desencontradas
      for (let k = 0; k < 4; k++) {
        const y = cy - 66 + k * 44 + j(14);
        const x0 = cx - 110 + Math.random() * 40, x1 = cx + 40 + Math.random() * 70;
        const pts: P[] = [];
        for (let i = 0; i <= 5; i++) pts.push([x0 + ((x1 - x0) * i) / 5, y + Math.sin(i * 1.8 + k) * 5]);
        stroke(g, pts, 6, 3);
      }
      break;
    }
    case Doodle.Star: {
      // brilho: quatro riscos cruzados + risquinhos soltos
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI + j(0.25);
        const r = k % 2 ? 55 : 90;
        stroke(g, [[cx - Math.cos(a) * r, cy - Math.sin(a) * r], [cx + j(10), cy + j(10)], [cx + Math.cos(a) * r, cy + Math.sin(a) * r]], 6, 4);
      }
      for (let k = 0; k < 3; k++) {
        const a = Math.random() * 6.28, d = 95 + j(20);
        stroke(g, [[cx + Math.cos(a) * d, cy + Math.sin(a) * d], [cx + Math.cos(a) * (d + 22), cy + Math.sin(a) * (d + 22)]], 5, 2);
      }
      break;
    }
    case Doodle.Wing: {
      // asa só no traço: um arco de cima e três penas em "V" abertas
      stroke(g, [[cx - 95, cy + 30], [cx - 40, cy - 55], [cx + 30, cy - 75], [cx + 100, cy - 60]], 7, 5);
      for (let k = 0; k < 3; k++) {
        const x = cx + 90 - k * 42, y = cy - 50 + k * 22;
        stroke(g, [[x + j(6), y], [x - 34 + j(8), y + 40 + j(8)], [x - 70 + j(6), y + 52 + k * 8]], 6, 4);
      }
      break;
    }
    case Doodle.Bolt: {
      // raio em zigue-zague, aberto
      stroke(g, [[cx + 40, cy - 110], [cx - 25 + j(10), cy - 30], [cx + 25 + j(10), cy - 20], [cx - 30 + j(10), cy + 60], [cx + 10, cy + 55], [cx - 20, cy + 112]], 7, 5);
      break;
    }
    case Doodle.Swirl: {
      // espiral embolada
      const pts: P[] = [];
      for (let t = 0; t <= 1.0001; t += 0.04) {
        const a = t * Math.PI * 6;
        const r = 8 + t * 88;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.75]);
      }
      stroke(g, pts, 6, 5);
      break;
    }
    default: {
      // estalo: riscos radiais curtos + um laço solto que não fecha
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 + j(0.35);
        const r0 = 52 + j(14), r1 = 92 + j(24);
        stroke(g, [[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]], 7, 2);
      }
      const pts: P[] = [];
      const a0 = Math.random() * 6.28;
      for (let t = 0; t <= 1.0001; t += 0.1) {
        const a = a0 + t * Math.PI * 1.75;
        pts.push([cx + Math.cos(a) * 34, cy + Math.sin(a) * 30]);
      }
      stroke(g, pts, 5, 3);
    }
  }
}

function makeAtlas(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 16; i++) {
    const cx = (i % 4) * 256 + 128, cy = Math.floor(i / 4) * 256 + 128;
    g.save();
    g.beginPath();
    g.rect(cx - 128, cy - 128, 256, 256);
    g.clip();
    drawCell(g, i & ~1, cx, cy);
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const VERT = /* glsl */ `
attribute vec4 dcolor;
attribute vec3 dinfo; // cell, rotation, size
varying vec4 vColor;
varying float vCell;
varying float vRot;
uniform float uScale;
uniform float uTime;
void main() {
  vColor = dcolor;
  // alterna entre os dois quadros do desenho ~9 vezes por segundo
  float boil = mod(floor(uTime * 9.0 + dinfo.x * 1.7), 2.0);
  vCell = dinfo.x + boil;
  vRot = dinfo.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = dinfo.z * uScale / max(-mv.z, 0.1);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D map;
varying vec4 vColor;
varying float vCell;
varying float vRot;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
  if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) discard;
  float cell = floor(vCell + 0.5);
  vec2 uv = (vec2(mod(cell, 4.0), 3.0 - floor(cell / 4.0)) + vec2(p.x, 1.0 - p.y)) / 4.0;
  vec4 t = texture2D(map, uv);
  // branco do desenho vira a cor; o contorno preto continua preto
  vec3 col = mix(vec3(0.02), vColor.rgb, t.r);
  float a = t.a * vColor.a;
  if (a < 0.02) discard;
  gl_FragColor = vec4(col, a);
}
`;

export class Doodles {
  readonly points: THREE.Points;
  enabled = true;
  private pos: Float32Array;
  private col: Float32Array;
  private info: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private baseSize: Float32Array;
  private grow: Float32Array;
  private spin: Float32Array;
  private baseA: Float32Array;
  private next = 0;
  private mat: THREE.ShaderMaterial;

  constructor(private max = 260) {
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.info = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max).fill(1);
    this.baseSize = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.baseA = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('dcolor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('dinfo', new THREE.BufferAttribute(this.info, 3).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: makeAtlas() }, uScale: { value: 400 }, uTime: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 9;
  }

  setViewportHeight(h: number, fovDeg: number): void {
    this.mat.uniforms.uScale!.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
  }

  emit(kind: Doodle, x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, life: number, color: THREE.Color, opts: { grow?: number; rot?: number; spin?: number; alpha?: number } = {}): void {
    if (!this.enabled) return;
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.col.set([color.r, color.g, color.b, 0], i * 4);
    this.info.set([kind, opts.rot ?? Math.random() * 6.28, size], i * 3);
    this.baseSize[i] = size;
    this.grow[i] = opts.grow ?? 0.6;
    this.spin[i] = opts.spin ?? 0;
    this.baseA[i] = opts.alpha ?? 1;
    this.life[i] = life;
    this.maxLife[i] = life;
  }

  update(dt: number, time: number): void {
    this.mat.uniforms.uTime!.value = time;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i]! <= 0) {
        this.col[i * 4 + 3] = 0;
        continue;
      }
      this.life[i]! -= dt;
      const t = 1 - Math.max(0, this.life[i]! / this.maxLife[i]!);
      this.pos[i * 3]! += this.vel[i * 3]! * dt;
      this.pos[i * 3 + 1]! += this.vel[i * 3 + 1]! * dt;
      this.pos[i * 3 + 2]! += this.vel[i * 3 + 2]! * dt;
      const k = Math.max(0, 1 - 2.5 * dt);
      this.vel[i * 3]! *= k;
      this.vel[i * 3 + 2]! *= k;
      // estoura rápido (pop), segura e some
      const pop = t < 0.15 ? 0.4 + (t / 0.15) * 0.75 : 1.15 - (t - 0.15) * 0.15;
      this.info[i * 3 + 2] = this.baseSize[i]! * pop * (1 + this.grow[i]! * t);
      this.info[i * 3 + 1]! += this.spin[i]! * dt;
      this.col[i * 4 + 3] = this.baseA[i]! * (t > 0.7 ? (1 - t) / 0.3 : 1);
    }
    const g = this.points.geometry;
    g.attributes.position!.needsUpdate = true;
    g.attributes.dcolor!.needsUpdate = true;
    g.attributes.dinfo!.needsUpdate = true;
  }
}
