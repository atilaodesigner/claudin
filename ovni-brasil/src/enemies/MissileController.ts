import { AdditiveBlending, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3, type Scene } from 'three';
import { MISSILE } from '../config/enemies';

export interface Missile {
  id: number;
  group: Group;
  pos: Vector3;
  vel: Vector3;
  life: number;
  damage: number;
  ownerId: number;
  /** Target: player unless redirected. */
  targetEnemyId: number;
  active: boolean;
  disabled: boolean;
  closest: number;
  dodgeArmed: boolean;
  trailTimer: number;
  age: number;
}

const _q = new Quaternion();
const _y = new Vector3(0, 1, 0);
const _d = new Vector3();
const _t = new Vector3();

/** Homing missiles with limited turn rate: dodgeable, redirectable, EMP-able. Pooled. */
export class MissileSystem {
  readonly missiles: Missile[] = [];
  private nextId = 1;

  constructor(scene: Scene, capacity = 16) {
    const bodyMat = new MeshStandardMaterial({ color: 0xe8e8e8, metalness: 0.4, roughness: 0.4 });
    const tipMat = new MeshStandardMaterial({ color: 0xd62828, roughness: 0.5 });
    const flameMat = new MeshBasicMaterial({ color: 0xffb04a, blending: AdditiveBlending, transparent: true, depthWrite: false });
    const glowMat = new MeshBasicMaterial({ color: 0xff3b30, blending: AdditiveBlending, transparent: true, depthWrite: false });
    for (let i = 0; i < capacity; i++) {
      const g = new Group();
      const body = new Mesh(new CylinderGeometry(0.16, 0.16, 1.8, 8), bodyMat);
      const tip = new Mesh(new ConeGeometry(0.16, 0.5, 8), tipMat);
      tip.position.y = 1.15;
      const flame = new Mesh(new ConeGeometry(0.2, 1.1, 8), flameMat);
      flame.position.y = -1.4;
      flame.rotation.x = Math.PI;
      const glow = new Mesh(new SphereGeometry(0.5, 8, 6), glowMat);
      glow.position.y = -1.0;
      g.add(body, tip, flame, glow);
      g.visible = false;
      scene.add(g);
      this.missiles.push({
        id: 0,
        group: g,
        pos: new Vector3(),
        vel: new Vector3(),
        life: 0,
        damage: 0,
        ownerId: -1,
        targetEnemyId: -1,
        active: false,
        disabled: false,
        closest: Infinity,
        dodgeArmed: false,
        trailTimer: 0,
        age: 0,
      });
    }
  }

  launch(from: Vector3, dir: Vector3, damage: number, ownerId: number): Missile | null {
    const m = this.missiles.find((x) => !x.active);
    if (!m) return null;
    m.id = this.nextId++;
    m.active = true;
    m.disabled = false;
    m.pos.copy(from);
    m.vel.copy(dir).normalize().multiplyScalar(MISSILE.speed);
    m.life = MISSILE.lifetime;
    m.damage = damage;
    m.ownerId = ownerId;
    m.targetEnemyId = -1;
    m.closest = Infinity;
    m.dodgeArmed = true;
    m.age = 0;
    m.group.visible = true;
    return m;
  }

  /** Steering toward a point. */
  steer(m: Missile, target: Vector3, dt: number, turnMult = 1): void {
    if (m.disabled) {
      m.vel.y -= 16 * dt;
      m.vel.multiplyScalar(1 - dt * 0.2);
      return;
    }
    const speed = Math.min(MISSILE.maxSpeed, m.vel.length() + MISSILE.accel * dt);
    _d.copy(m.vel).normalize();
    _t.copy(target).sub(m.pos).normalize();
    const maxTurn = MISSILE.turnRate * turnMult * dt;
    const angle = _d.angleTo(_t);
    if (angle > 1e-4) {
      const t = Math.min(1, maxTurn / angle);
      _d.lerp(_t, t).normalize();
    }
    m.vel.copy(_d).multiplyScalar(speed);
  }

  integrate(m: Missile, dt: number): void {
    m.age += dt;
    m.life -= dt;
    m.pos.addScaledVector(m.vel, dt);
    m.group.position.copy(m.pos);
    _d.copy(m.vel).normalize();
    _q.setFromUnitVectors(_y, _d);
    m.group.quaternion.copy(_q);
    const flicker = 0.8 + Math.random() * 0.5;
    const flame = m.group.children[2] as Mesh;
    flame.scale.set(1, m.disabled ? 0.1 : flicker, 1);
    (m.group.children[3] as Mesh).visible = !m.disabled && Math.floor(m.age * 8) % 2 === 0;
  }

  kill(m: Missile): void {
    m.active = false;
    m.group.visible = false;
  }

  clear(): void {
    for (const m of this.missiles) this.kill(m);
  }

  dispose(): void {
    for (const m of this.missiles) m.group.removeFromParent();
  }

  get activeCount(): number {
    let c = 0;
    for (const m of this.missiles) if (m.active) c++;
    return c;
  }
}
