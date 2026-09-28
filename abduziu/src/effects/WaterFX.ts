import {
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  type Texture,
  Vector3,
} from 'three';
import type { ParticleManager } from './ParticleManager';

/** Height of the water sheet drawn by World (the sea/river plane). */
const WATER_Y = 0.07;
const RING_COUNT = 40;

interface Ring {
  mesh: Mesh;
  mat: MeshBasicMaterial;
  life: number;
  max: number;
  r0: number;
  r1: number;
  alpha: number;
  active: boolean;
}

/** Soft foam ring: bright band near the rim, faded inside, a little broken up. */
function foamTexture(): CanvasTexture {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const img = g.createImageData(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = (x + 0.5) / s - 0.5;
      const dy = (y + 0.5) / s - 0.5;
      const r = Math.hypot(dx, dy) * 2;
      const a = Math.atan2(dy, dx);
      // crest at r≈0.86 with a soft trailing slope inside, broken by angular noise
      const crest = Math.exp(-Math.pow((r - 0.88) / 0.03, 2));
      const trail = r < 0.88 ? Math.exp(-Math.pow((r - 0.88) / 0.1, 2)) * 0.12 : 0;
      const broken = 0.7 + 0.3 * Math.sin(a * 23 + Math.sin(a * 7) * 2) * Math.sin(a * 11);
      const v = Math.min(1, (crest + trail) * broken) * (r < 1 ? 1 : 0);
      const i = (y * s + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(v * 255);
    }
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

const columnVert = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uWobble;
  void main() {
    vUv = uv;
    vec3 p = position;
    // twisting, bulging water pulled up by the beam
    float h = uv.y;
    float w = sin(uTime * 7.0 + h * 9.0 + atan(p.z, p.x) * 3.0) * 0.06 * uWobble;
    p.xz *= 1.0 + w + sin(uTime * 3.0 + h * 4.0) * 0.04;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const columnFrag = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uAlpha;
  uniform vec3 uColor;
  uniform sampler2D uNoise;
  void main() {
    float h = vUv.y;
    vec2 q = vec2(vUv.x * 3.0, h * 1.4 - uTime * 1.3);
    float n = texture2D(uNoise, q).r;
    float n2 = texture2D(uNoise, q * 2.3 + vec2(0.3, -uTime * 0.7)).g;
    float streak = smoothstep(0.45, 0.9, n * 0.7 + n2 * 0.5);
    vec3 col = mix(uColor, vec3(0.92, 0.98, 1.0), streak * 0.8 + h * 0.25);
    // solid at the base, spraying apart towards the top
    float a = uAlpha * (1.0 - smoothstep(0.35, 1.0, h)) * (0.55 + streak * 0.6);
    gl_FragColor = vec4(col, a);
  }
`;

/**
 * Water response to the saucer: expanding foam rings (a wake when moving), a column of
 * water sucked up by the beam and droplets spraying at the rim. Any ship can make ripples.
 */
export class WaterFX {
  readonly group = new Group();
  private readonly rings: Ring[] = [];
  private readonly column: Mesh;
  private readonly columnMat: ShaderMaterial;
  private readonly timers = new Map<unknown, number>();
  private readonly waterColor = new Color(0x4fb3d9);
  private readonly spray = new Color(0xe8f7ff);
  private columnH = 0;
  private time = 0;
  private cursor = 0;

  constructor(
    noise: Texture,
    private readonly particles: ParticleManager,
  ) {
    const tex = foamTexture();
    const geo = new PlaneGeometry(2, 2);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < RING_COUNT; i++) {
      const mat = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, blending: NormalBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
      const mesh = new Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 2;
      this.group.add(mesh);
      this.rings.push({ mesh, mat, life: 0, max: 1, r0: 1, r1: 2, alpha: 1, active: false });
    }
    this.columnMat = new ShaderMaterial({
      vertexShader: columnVert,
      fragmentShader: columnFrag,
      uniforms: {
        uTime: { value: 0 },
        uAlpha: { value: 0 },
        uWobble: { value: 1 },
        uColor: { value: this.waterColor },
        uNoise: { value: noise },
      },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    // unit column: radius 1 at the bottom, narrower at the top, height 1 (base at y=0)
    const cg = new CylinderGeometry(0.35, 1, 1, 40, 8, true);
    cg.translate(0, 0.5, 0);
    this.column = new Mesh(cg, this.columnMat);
    this.column.visible = false;
    this.column.renderOrder = 3;
    this.group.add(this.column);
  }

  /** Tints foam/column to the city's water. */
  setWaterColor(hex: number): void {
    this.waterColor.setHex(hex).lerp(new Color(0xffffff), 0.25);
  }

  private ring(x: number, z: number, r0: number, r1: number, life: number, alpha: number): void {
    const r = this.rings[this.cursor] as Ring;
    this.cursor = (this.cursor + 1) % RING_COUNT;
    r.active = true;
    r.life = 0;
    r.max = life;
    r.r0 = r0;
    r.r1 = r1;
    r.alpha = alpha;
    r.mesh.position.set(x, WATER_Y + 0.02, z);
    r.mesh.rotation.y = Math.random() * Math.PI * 2;
    r.mesh.visible = true;
  }

  /**
   * Ripples + wake for any ship over water. `key` identifies the ship (for its spawn timer).
   */
  touch(key: unknown, x: number, z: number, vx: number, vz: number, radius: number, dt: number): void {
    const speed = Math.hypot(vx, vz);
    let t = (this.timers.get(key) ?? 0) - dt;
    if (t <= 0) {
      // faster ships drop rings more often, which draws the wake
      t = speed > 2 ? 0.09 : 0.22;
      const back = speed > 0.5 ? 0.6 * radius : 0;
      const nx = speed > 0.5 ? vx / speed : 0;
      const nz = speed > 0.5 ? vz / speed : 0;
      this.ring(x - nx * back, z - nz * back, radius * 0.6, radius * (speed > 2 ? 1.9 : 2.5), speed > 2 ? 1.0 : 1.7, speed > 2 ? 0.6 : 0.8);
      if (speed > 3) {
        // the two arms of the V-shaped wake
        const px = -nz;
        const pz = nx;
        for (const s of [-1, 1]) this.ring(x - nx * radius * 1.3 + px * s * radius * 0.8, z - nz * radius * 1.3 + pz * s * radius * 0.8, radius * 0.25, radius * 1.3, 0.9, 0.45);
      }
    }
    this.timers.set(key, t);
  }

  /**
   * The player's saucer: ripples/wake, the beam's water column and spray.
   * @param over whether the beam footprint is on water
   */
  update(dt: number, over: boolean, ufo: Vector3, vel: Vector3, radius: number, beamRadius: number, beamOn: boolean): void {
    this.time += dt;
    if (over) this.touch(this, ufo.x, ufo.z, vel.x, vel.z, beamRadius, dt);

    // water column rises into an active beam, collapses when it leaves the water
    const top = Math.max(0, ufo.y - radius * 0.35 - WATER_Y);
    const target = over && beamOn ? Math.min(top * 0.55, beamRadius * 1.6) : 0;
    this.columnH += (target - this.columnH) * (1 - Math.exp(-(target > this.columnH ? 2.2 : 5) * dt));
    const visible = this.columnH > 0.05;
    this.column.visible = visible;
    if (visible) {
      const r = beamRadius * 0.55;
      this.column.position.set(ufo.x, WATER_Y, ufo.z);
      this.column.scale.set(r, this.columnH, r);
      const u = this.columnMat.uniforms;
      u.uTime!.value = this.time;
      u.uAlpha!.value = Math.min(0.9, this.columnH / (beamRadius * 0.4));
      u.uWobble!.value = 1 + Math.hypot(vel.x, vel.z) * 0.05;

      // droplets: spray at the rim, a few climbing the column
      const n = Math.min(10, Math.floor(dt * (60 + beamRadius * 10) + Math.random()));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = r * (0.8 + Math.random() * 0.5);
        const out = 2 + Math.random() * 3;
        this.particles.single(false, ufo.x + Math.cos(a) * rr, WATER_Y + 0.1, ufo.z + Math.sin(a) * rr, Math.cos(a) * out + vel.x * 0.3, 3 + Math.random() * 4, Math.sin(a) * out + vel.z * 0.3, this.spray, 0.7 + Math.random() * 0.4, 0.25 + beamRadius * 0.05, 0.05, -9, 0.6, 0.9);
      }
      if (Math.random() < dt * 20) {
        const a = Math.random() * Math.PI * 2;
        const rr = r * Math.random() * 0.6;
        this.particles.single(true, ufo.x + Math.cos(a) * rr, WATER_Y + this.columnH * Math.random() * 0.6, ufo.z + Math.sin(a) * rr, 0, 4 + Math.random() * 3, 0, this.waterColor, 0.9, 0.3 + beamRadius * 0.04, 0.05, 0, 1, 0.7);
      }
    }

    for (const r of this.rings) {
      if (!r.active) continue;
      r.life += dt;
      const k = r.life / r.max;
      if (k >= 1) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const e = 1 - Math.pow(1 - k, 2.2);
      const s = r.r0 + (r.r1 - r.r0) * e;
      r.mesh.scale.set(s, 1, s);
      r.mat.opacity = r.alpha * (k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88);
    }
  }

  /** A splash (something dropped into the water). */
  splash(x: number, z: number, size: number): void {
    this.ring(x, z, size * 0.3, size * 2.2, 1.2, 0.8);
    this.ring(x, z, size * 0.2, size * 1.2, 0.8, 0.6);
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 2 + Math.random() * 3;
      this.particles.single(false, x, WATER_Y + 0.1, z, Math.cos(a) * v, 4 + Math.random() * 4, Math.sin(a) * v, this.spray, 0.8, 0.3 + size * 0.1, 0.05, -9, 0.6, 0.9);
    }
  }

  clear(): void {
    for (const r of this.rings) {
      r.active = false;
      r.mesh.visible = false;
    }
    this.columnH = 0;
    this.column.visible = false;
    this.timers.clear();
  }
}

