import { AdditiveBlending, BoxGeometry, Color, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3, type Scene } from 'three';

export interface Bullet {
  pos: Vector3;
  vel: Vector3;
  life: number;
  damage: number;
  ownerId: number;
  reflected: boolean;
  homing: boolean;
  flak: boolean;
  active: boolean;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _z = new Vector3(0, 0, 1);
const _d = new Vector3();

/** Pooled glowing tracers, one instanced draw call. */
export class BulletSystem {
  readonly bullets: Bullet[] = [];
  private readonly mesh: InstancedMesh;
  private readonly enemyColor = new Color(0xffc15a);
  private readonly reflectColor = new Color(0x6ff4ff);
  private readonly flakColor = new Color(0xff6a3a);

  constructor(scene: Scene, capacity = 260) {
    const mat = new MeshBasicMaterial({ color: 0xffffff, blending: AdditiveBlending, transparent: true, depthWrite: false });
    this.mesh = new InstancedMesh(new BoxGeometry(0.16, 0.16, 1), mat, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 6;
    for (let i = 0; i < capacity; i++) {
      this.bullets.push({ pos: new Vector3(), vel: new Vector3(), life: 0, damage: 0, ownerId: -1, reflected: false, homing: false, flak: false, active: false });
      this.mesh.setColorAt(i, this.enemyColor);
    }
    scene.add(this.mesh);
  }

  fire(from: Vector3, dir: Vector3, speed: number, damage: number, ownerId: number, flak = false): Bullet | null {
    const b = this.bullets.find((x) => !x.active);
    if (!b) return null;
    b.active = true;
    b.pos.copy(from);
    b.vel.copy(dir).normalize().multiplyScalar(speed);
    b.life = flak ? 1.6 : 2.6;
    b.damage = damage;
    b.ownerId = ownerId;
    b.reflected = false;
    b.homing = false;
    b.flak = flak;
    return b;
  }

  /**
   * @param slowCenter/slowRadius/slowFactor CAMPO TEMPORAL
   * @param hitTest returns true if the bullet hit something (then it's consumed)
   */
  update(dt: number, slowCenter: Vector3, slowRadius: number, slowFactor: number, hitTest: (b: Bullet) => boolean): void {
    let n = 0;
    for (const b of this.bullets) {
      if (!b.active) continue;
      b.life -= dt;
      if (b.life <= 0 || b.pos.y < -1) {
        b.active = false;
        continue;
      }
      let mult = 1;
      if (slowFactor > 0 && !b.reflected && b.pos.distanceToSquared(slowCenter) < slowRadius * slowRadius) mult = 1 - slowFactor;
      b.pos.addScaledVector(b.vel, dt * mult);
      if (hitTest(b)) {
        b.active = false;
        continue;
      }
      _d.copy(b.vel).normalize();
      _q.setFromUnitVectors(_z, _d);
      const len = Math.min(3.2, b.vel.length() * 0.035) * (b.flak ? 0.6 : 1);
      _s.set(b.flak ? 2.2 : 1, b.flak ? 2.2 : 1, len);
      _m.compose(b.pos, _q, _s);
      this.mesh.setMatrixAt(n, _m);
      this.mesh.setColorAt(n, b.reflected ? this.reflectColor : b.flak ? this.flakColor : this.enemyColor);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clearWithin(center: Vector3, radius: number): number {
    let c = 0;
    for (const b of this.bullets) {
      if (b.active && b.pos.distanceToSquared(center) < radius * radius) {
        b.active = false;
        c++;
      }
    }
    return c;
  }

  clear(): void {
    for (const b of this.bullets) b.active = false;
    this.mesh.count = 0;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }

  get activeCount(): number {
    let c = 0;
    for (const b of this.bullets) if (b.active) c++;
    return c;
  }
}
