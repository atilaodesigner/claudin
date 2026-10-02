// Linha guia no chão: faixa com setas correndo pra frente, saindo do carro e
// seguindo o percurso (rota do capítulo ou checkpoints do racha). No mundo
// livre fica escondida. Uma malha só, reescrita a cada quadro.

import * as THREE from 'three';

/** amostras da faixa (uma a cada STEP metros) */
const MAX = 128;
const STEP = 1.25;
const WIDTH = 2.3;
/** metros em que a faixa sai do carro e encosta no percurso */
const BLEND = 14;

const VERT = /* glsl */ `
attribute float along;
attribute float side;
varying float vAlong;
varying float vSide;
#include <fog_pars_vertex>
void main() {
  vAlong = along;
  vSide = side;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform float uLen;
uniform vec3 uColor;
varying float vAlong;
varying float vSide;
#include <fog_pars_fragment>
void main() {
  float s = abs(vSide);
  // seta ">" apontando pra frente: faixa que recua nas bordas
  float p = fract((vAlong - s * 1.1 - uTime * 9.0) / 3.2);
  float chev = smoothstep(0.0, 0.08, p) * (1.0 - smoothstep(0.34, 0.44, p));
  // borda fina contínua + seta cheia
  float rail = smoothstep(0.78, 0.9, s) * (1.0 - smoothstep(0.96, 1.0, s));
  float a = max(chev * 0.85, rail * 0.55);
  // some perto do carro e no fim, e pulsa de leve
  a *= smoothstep(1.5, 6.0, vAlong) * (1.0 - smoothstep(uLen - 30.0, uLen, vAlong));
  a *= 0.8 + 0.2 * sin(uTime * 5.0 - vAlong * 0.25);
  gl_FragColor = vec4(uColor * a * 1.6, a);
  #include <fog_fragment>
}`;

export class GuideLine {
  readonly mesh: THREE.Mesh;
  private pos: Float32Array;
  private along: Float32Array;
  private geo: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;
  private t = 0;
  /** amostras do caminho montado neste quadro (x,z) */
  private px = new Float32Array(MAX);
  private pz = new Float32Array(MAX);
  private n = 0;
  private dense: number[] = [];
  private denseKey = '';

  constructor() {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 2 * 3);
    this.along = new Float32Array(MAX * 2);
    const side = new Float32Array(MAX * 2);
    const idx: number[] = [];
    for (let i = 0; i < MAX; i++) {
      side[i * 2] = -1;
      side[i * 2 + 1] = 1;
      if (i < MAX - 1) {
        const a = i * 2;
        // virado pra cima (sentido anti-horário visto de cima)
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('along', new THREE.BufferAttribute(this.along, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('side', new THREE.BufferAttribute(side, 1));
    this.geo.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uLen: { value: 100 }, uColor: { value: new THREE.Color() } }]),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
    this.mesh.name = 'guide';
  }

  hide(): void {
    this.mesh.visible = false;
  }

  /** começa um caminho novo */
  begin(): void {
    this.n = 0;
  }

  /** acrescenta um ponto; devolve false quando encheu */
  push(x: number, z: number): boolean {
    if (this.n >= MAX) return false;
    this.px[this.n] = x;
    this.pz[this.n] = z;
    this.n++;
    return true;
  }

  get full(): boolean {
    return this.n >= MAX;
  }

  /**
   * Caminho de uma polilinha (x,z) já no mundo: acha o trecho mais perto do
   * carro, sai do carro e segue a polilinha (cantos arredondados) daí pra frente.
   */
  fromPolyline(pts: { x: number; z: number }[], carX: number, carZ: number, key: string): void {
    if (key !== this.denseKey) {
      this.dense = densify(pts);
      this.denseKey = key;
    }
    const dense = this.dense;
    // ponto mais perto do carro, só olhando o começo (o carro tá indo pro primeiro alvo)
    let best = 0, bd = Infinity;
    const look = Math.min(dense.length / 2, 400);
    for (let i = 0; i < look; i++) {
      const d = (dense[i * 2]! - carX) ** 2 + (dense[i * 2 + 1]! - carZ) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    this.begin();
    const stride = Math.round(STEP / DENSE);
    for (let i = best, k = 0; i < dense.length / 2 && !this.full; i += stride, k++) {
      const w = smooth((k * STEP) / BLEND);
      this.push(carX + (dense[i * 2]! - carX) * w, carZ + (dense[i * 2 + 1]! - carZ) * w);
    }
  }

  /** escreve a malha com o caminho montado e mostra */
  commit(dt: number, color: THREE.ColorRepresentation, y = 0.06): void {
    this.t += dt;
    const n = this.n;
    if (n < 3) {
      this.mesh.visible = false;
      return;
    }
    let dist = 0;
    for (let i = 0; i < MAX; i++) {
      const j = Math.min(i, n - 1);
      const a = Math.max(0, j - 1), b = Math.min(n - 1, j + 1);
      let tx = this.px[b]! - this.px[a]!, tz = this.pz[b]! - this.pz[a]!;
      const l = Math.hypot(tx, tz) || 1;
      tx /= l;
      tz /= l;
      if (i > 0 && i < n) dist += Math.hypot(this.px[j]! - this.px[j - 1]!, this.pz[j]! - this.pz[j - 1]!);
      const h = WIDTH / 2;
      const o = i * 6;
      // lado -1 à esquerda, +1 à direita (direita = (-tz, tx))
      this.pos[o] = this.px[j]! + tz * h;
      this.pos[o + 1] = y;
      this.pos[o + 2] = this.pz[j]! - tx * h;
      this.pos[o + 3] = this.px[j]! - tz * h;
      this.pos[o + 4] = y;
      this.pos[o + 5] = this.pz[j]! + tx * h;
      this.along[i * 2] = this.along[i * 2 + 1] = dist;
    }
    this.geo.attributes.position!.needsUpdate = true;
    this.geo.attributes.along!.needsUpdate = true;
    this.mat.uniforms.uTime!.value = this.t;
    this.mat.uniforms.uLen!.value = dist;
    (this.mat.uniforms.uColor!.value as THREE.Color).set(color);
    this.mesh.visible = true;
  }
}

function smooth(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** espaçamento da polilinha densa */
const DENSE = 0.25;
const CORNER = 9;

/** polilinha com cantos arredondados, amostrada a cada DENSE metros */
function densify(pts: { x: number; z: number }[]): number[] {
  const out: number[] = [];
  const line = (ax: number, az: number, bx: number, bz: number) => {
    const l = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(l / DENSE));
    for (let k = 0; k < n; k++) out.push(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n);
  };
  if (pts.length < 2) return pts.flatMap((p) => [p.x, p.z]);
  let cx = pts[0]!.x, cz = pts[0]!.z;
  for (let i = 1; i < pts.length; i++) {
    const b = pts[i]!;
    const c = pts[i + 1];
    if (!c) {
      line(cx, cz, b.x, b.z);
      out.push(b.x, b.z);
      break;
    }
    const l1 = Math.hypot(b.x - cx, b.z - cz), l2 = Math.hypot(c.x - b.x, c.z - b.z);
    const r = Math.min(CORNER, l1 / 2, l2 / 2);
    const ex = b.x - ((b.x - cx) / (l1 || 1)) * r, ez = b.z - ((b.z - cz) / (l1 || 1)) * r;
    const fx = b.x + ((c.x - b.x) / (l2 || 1)) * r, fz = b.z + ((c.z - b.z) / (l2 || 1)) * r;
    line(cx, cz, ex, ez);
    // bezier quadrática com controle no canto
    const n = Math.max(2, Math.ceil((r * 1.6) / DENSE));
    for (let k = 0; k < n; k++) {
      const t = k / n, u = 1 - t;
      out.push(u * u * ex + 2 * u * t * b.x + t * t * fx, u * u * ez + 2 * u * t * b.z + t * t * fz);
    }
    cx = fx;
    cz = fz;
  }
  return out;
}

/** desloca a polilinha pra direita (mão de direção), mantendo os cantos */
export function offsetRight(pts: { x: number; z: number }[], d: number): { x: number; z: number }[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(pts.length - 1, i + 1)]!;
    // média das normais dos dois trechos (esquina: desloca na bissetriz)
    let nx = 0, nz = 0, cnt = 0;
    for (const [u, v] of [[a, p], [p, b]] as const) {
      const l = Math.hypot(v.x - u.x, v.z - u.z);
      if (l < 1e-3) continue;
      nx += -(v.z - u.z) / l;
      nz += (v.x - u.x) / l;
      cnt++;
    }
    const l = Math.hypot(nx, nz) || 1;
    nx /= l;
    nz /= l;
    // na esquina a bissetriz precisa ser mais longa pra manter a distância
    const cos = Math.max(0.5, l / Math.max(1, cnt));
    return { x: p.x + (nx * d) / cos, z: p.z + (nz * d) / cos };
  });
}
