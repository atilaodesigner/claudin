import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  NormalBlending,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type Scene,
} from 'three';

export interface BurstOptions {
  count: number;
  color: number;
  colorVar?: number;
  speed: number;
  speedVar?: number;
  /** Direction bias (normalized) and spread 0..1 (1 = sphere). */
  dir?: Vector3;
  spread?: number;
  gravity?: number;
  drag?: number;
  life: number;
  lifeVar?: number;
  size: number;
  sizeEnd?: number;
  radius?: number;
  alpha?: number;
}

const _c = new Color();
const _c2 = new Color();
const _v = new Vector3();

/** CPU-simulated point particles with pooled buffers (zero allocations per frame). */
class PointSystem {
  readonly points: Points;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly size: Float32Array;
  private readonly alpha: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly grav: Float32Array;
  private readonly drag: Float32Array;
  private readonly s0: Float32Array;
  private readonly s1: Float32Array;
  private readonly a0: Float32Array;
  private readonly geo: BufferGeometry;
  count = 0;
  budget: number;

  constructor(readonly capacity: number, additive: boolean) {
    this.budget = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.s0 = new Float32Array(capacity);
    this.s1 = new Float32Array(capacity);
    this.a0 = new Float32Array(capacity);
    this.geo = new BufferGeometry();
    const mk = (arr: Float32Array, n: number) => new BufferAttribute(arr, n).setUsage(DynamicDrawUsage);
    this.geo.setAttribute('position', mk(this.pos, 3));
    this.geo.setAttribute('color', mk(this.col, 3));
    this.geo.setAttribute('aSize', mk(this.size, 1));
    this.geo.setAttribute('aAlpha', mk(this.alpha, 1));
    this.geo.setDrawRange(0, 0);
    const mat = new ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aAlpha;
        attribute vec3 color;
        uniform float uScale;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uScale / -mv.z, 1.0, 160.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: additive
        ? /* glsl */ `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = (1.0 - smoothstep(0.0, 1.0, d));
          a = a * a * vAlpha;
          gl_FragColor = vec4(vColor * a * 1.6, a);
        }`
        : /* glsl */ `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = (1.0 - smoothstep(0.55, 1.0, d)) * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    });
    this.points = new Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 8 : 7;
  }

  setScale(pixelHeight: number): void {
    (this.points.material as ShaderMaterial).uniforms.uScale!.value = pixelHeight * 0.9;
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: Color, life: number, size: number, sizeEnd: number, gravity: number, drag: number, alpha: number): void {
    if (this.count >= this.budget) return;
    const i = this.count++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = color.r;
    this.col[i * 3 + 1] = color.g;
    this.col[i * 3 + 2] = color.b;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.s0[i] = size;
    this.s1[i] = sizeEnd;
    this.size[i] = size;
    this.grav[i] = gravity;
    this.drag[i] = drag;
    this.a0[i] = alpha;
    this.alpha[i] = alpha;
  }

  private copy(from: number, to: number): void {
    for (let k = 0; k < 3; k++) {
      this.pos[to * 3 + k] = this.pos[from * 3 + k] as number;
      this.vel[to * 3 + k] = this.vel[from * 3 + k] as number;
      this.col[to * 3 + k] = this.col[from * 3 + k] as number;
    }
    this.life[to] = this.life[from] as number;
    this.maxLife[to] = this.maxLife[from] as number;
    this.s0[to] = this.s0[from] as number;
    this.s1[to] = this.s1[from] as number;
    this.size[to] = this.size[from] as number;
    this.grav[to] = this.grav[from] as number;
    this.drag[to] = this.drag[from] as number;
    this.a0[to] = this.a0[from] as number;
    this.alpha[to] = this.alpha[from] as number;
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.count) {
      const l = (this.life[i] as number) - dt;
      if (l <= 0) {
        this.count--;
        if (i !== this.count) this.copy(this.count, i);
        continue;
      }
      this.life[i] = l;
      const d = Math.max(0, 1 - (this.drag[i] as number) * dt);
      const vi = i * 3;
      this.vel[vi] = (this.vel[vi] as number) * d;
      this.vel[vi + 1] = (this.vel[vi + 1] as number) * d - (this.grav[i] as number) * dt;
      this.vel[vi + 2] = (this.vel[vi + 2] as number) * d;
      this.pos[vi] = (this.pos[vi] as number) + (this.vel[vi] as number) * dt;
      this.pos[vi + 1] = (this.pos[vi + 1] as number) + (this.vel[vi + 1] as number) * dt;
      this.pos[vi + 2] = (this.pos[vi + 2] as number) + (this.vel[vi + 2] as number) * dt;
      const t = 1 - l / (this.maxLife[i] as number);
      this.size[i] = (this.s0[i] as number) + ((this.s1[i] as number) - (this.s0[i] as number)) * t;
      const fadeIn = Math.min(1, t * 8);
      this.alpha[i] = (this.a0[i] as number) * fadeIn * (1 - t * t);
      i++;
    }
    this.geo.setDrawRange(0, this.count);
    const attrs = ['position', 'color', 'aSize', 'aAlpha'];
    for (const a of attrs) {
      const attr = this.geo.getAttribute(a) as BufferAttribute;
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, this.count * attr.itemSize);
      attr.needsUpdate = true;
    }
  }

  clear(): void {
    this.count = 0;
    this.geo.setDrawRange(0, 0);
  }
}

/** Solid debris chunks (lit cubes) with bounce. */
class DebrisSystem {
  readonly mesh: InstancedMesh;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly rot: Float32Array;
  private readonly spin: Float32Array;
  private readonly life: Float32Array;
  private readonly size: Float32Array;
  private readonly floor: Float32Array;
  private count = 0;
  budget: number;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly s = new Vector3();
  private readonly p = new Vector3();
  private readonly axis = new Vector3();

  constructor(readonly capacity: number) {
    this.budget = capacity;
    this.mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 }), capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.rot = new Float32Array(capacity * 3);
    this.spin = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.floor = new Float32Array(capacity);
    for (let i = 0; i < capacity; i++) this.mesh.setColorAt(i, _c.setHex(0xffffff));
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, color: Color, life: number, floorY: number): void {
    if (this.count >= this.budget) return;
    const i = this.count++;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.rot.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i * 3);
    this.spin.set([(Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12], i * 3);
    this.life[i] = life;
    this.size[i] = size;
    this.floor[i] = floorY;
    this.mesh.setColorAt(i, color);
  }

  private swap(from: number, to: number): void {
    for (let k = 0; k < 3; k++) {
      this.pos[to * 3 + k] = this.pos[from * 3 + k] as number;
      this.vel[to * 3 + k] = this.vel[from * 3 + k] as number;
      this.rot[to * 3 + k] = this.rot[from * 3 + k] as number;
      this.spin[to * 3 + k] = this.spin[from * 3 + k] as number;
    }
    this.life[to] = this.life[from] as number;
    this.size[to] = this.size[from] as number;
    this.floor[to] = this.floor[from] as number;
    this.mesh.getColorAt(from, _c2);
    this.mesh.setColorAt(to, _c2);
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.count) {
      const l = (this.life[i] as number) - dt;
      if (l <= 0) {
        this.count--;
        if (i !== this.count) this.swap(this.count, i);
        continue;
      }
      this.life[i] = l;
      const b = i * 3;
      this.vel[b + 1] = (this.vel[b + 1] as number) - 22 * dt;
      for (let k = 0; k < 3; k++) {
        this.pos[b + k] = (this.pos[b + k] as number) + (this.vel[b + k] as number) * dt;
        this.rot[b + k] = (this.rot[b + k] as number) + (this.spin[b + k] as number) * dt;
      }
      const fl = this.floor[i] as number;
      if ((this.pos[b + 1] as number) < fl) {
        this.pos[b + 1] = fl;
        this.vel[b + 1] = -(this.vel[b + 1] as number) * 0.35;
        this.vel[b] = (this.vel[b] as number) * 0.6;
        this.vel[b + 2] = (this.vel[b + 2] as number) * 0.6;
        for (let k = 0; k < 3; k++) this.spin[b + k] = (this.spin[b + k] as number) * 0.5;
      }
      const shrink = Math.min(1, l / 0.4);
      this.p.set(this.pos[b] as number, this.pos[b + 1] as number, this.pos[b + 2] as number);
      this.axis.set(this.rot[b] as number, this.rot[b + 1] as number, this.rot[b + 2] as number);
      const ang = this.axis.length();
      this.q.setFromAxisAngle(ang > 0 ? this.axis.normalize() : this.axis.set(0, 1, 0), ang);
      this.s.setScalar((this.size[i] as number) * shrink);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      i++;
    }
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear(): void {
    this.count = 0;
    this.mesh.count = 0;
  }
}

/**
 * High level particle facade: glow (additive), smoke/dust (alpha) and debris chunks.
 * Budgets are scaled by the AdaptiveQualityManager.
 */
export class ParticleManager {
  readonly glow: PointSystem;
  readonly smoke: PointSystem;
  readonly debris: DebrisSystem;
  private budgetScale = 1;

  constructor(scene: Scene) {
    this.glow = new PointSystem(3000, true);
    this.smoke = new PointSystem(1400, false);
    this.debris = new DebrisSystem(360);
    scene.add(this.glow.points, this.smoke.points, this.debris.mesh);
  }

  setBudgetScale(s: number): void {
    this.budgetScale = s;
    this.glow.budget = Math.floor(this.glow.capacity * s);
    this.smoke.budget = Math.floor(this.smoke.capacity * s);
    this.debris.budget = Math.floor(this.debris.capacity * Math.max(0.35, s));
  }

  setViewportHeight(px: number): void {
    this.glow.setScale(px);
    this.smoke.setScale(px);
  }

  /** Count scaled by the quality budget. */
  n(count: number): number {
    return Math.max(1, Math.round(count * this.budgetScale));
  }

  private emit(sys: PointSystem, pos: Vector3, o: BurstOptions): void {
    const count = this.n(o.count);
    const dir = o.dir;
    const spread = o.spread ?? 1;
    for (let i = 0; i < count; i++) {
      // random direction in a cone around dir
      _v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      if (_v.lengthSq() < 0.0001) _v.set(0, 1, 0);
      _v.normalize();
      if (dir) _v.lerp(dir, 1 - spread).normalize();
      const sp = o.speed * (1 + (Math.random() * 2 - 1) * (o.speedVar ?? 0.4));
      const r = o.radius ?? 0;
      _c.setHex(o.color);
      if (o.colorVar) _c.lerp(_c2.setHex(o.colorVar), Math.random());
      const life = o.life * (1 + (Math.random() * 2 - 1) * (o.lifeVar ?? 0.3));
      sys.spawn(
        pos.x + (Math.random() * 2 - 1) * r,
        pos.y + (Math.random() * 2 - 1) * r * 0.5,
        pos.z + (Math.random() * 2 - 1) * r,
        _v.x * sp,
        _v.y * sp,
        _v.z * sp,
        _c,
        life,
        o.size,
        o.sizeEnd ?? o.size * 0.2,
        o.gravity ?? 0,
        o.drag ?? 1.5,
        o.alpha ?? 1,
      );
    }
  }

  burst(pos: Vector3, o: BurstOptions): void {
    this.emit(this.glow, pos, o);
  }

  puff(pos: Vector3, o: BurstOptions): void {
    this.emit(this.smoke, pos, o);
  }

  single(additive: boolean, x: number, y: number, z: number, vx: number, vy: number, vz: number, color: Color, life: number, size: number, sizeEnd: number, gravity = 0, drag = 1, alpha = 1): void {
    (additive ? this.glow : this.smoke).spawn(x, y, z, vx, vy, vz, color, life, size, sizeEnd, gravity, drag, alpha);
  }

  chunks(pos: Vector3, count: number, color: number, size: number, speed: number, floorY: number): void {
    const n = this.n(count);
    _c.setHex(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.5 + Math.random());
      _c2.copy(_c).multiplyScalar(0.7 + Math.random() * 0.5);
      this.debris.spawn(pos.x, pos.y, pos.z, Math.cos(a) * s, speed * (0.6 + Math.random() * 0.9), Math.sin(a) * s, size * (0.5 + Math.random()), _c2, 1.4 + Math.random(), floorY);
    }
  }

  update(dt: number): void {
    this.glow.update(dt);
    this.smoke.update(dt);
    this.debris.update(dt);
  }

  clear(): void {
    this.glow.clear();
    this.smoke.clear();
    this.debris.clear();
  }

  get liveCount(): number {
    return this.glow.count + this.smoke.count;
  }
}
