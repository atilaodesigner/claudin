import { Vector3, type Mesh } from 'three';
import { dampAngle } from '../utils/math';
import { noise1 } from '../utils/noise';
import { Enemy, type EnemyContext } from './Enemy';
import type { EnemyAssets } from './EnemyAssets';

const _target = new Vector3();
const _muzzle = new Vector3();
const _dir = new Vector3();

/** Beija-Flor helicopter: circle-strafes below the saucer, bursts and missiles. Can be caught in the beam. */
export class HelicopterController extends Enemy {
  private angle = Math.random() * Math.PI * 2;
  private readonly spinDir = Math.random() < 0.5 ? 1 : -1;
  private readonly rotor: Mesh;
  private readonly tailRotor: Mesh;
  private readonly seed = Math.random() * 50;
  /** 0..1 how strongly the beam grips it (tug of war). */
  grip = 0;
  entering = 3;

  constructor(id: number, assets: EnemyAssets) {
    super(id, 'helicopter');
    this.group.add(assets.model('helicopter'));
    this.rotor = assets.rotor(5.2);
    this.rotor.position.y = 3.42;
    this.group.add(this.rotor);
    this.tailRotor = assets.rotor(0.8);
    this.tailRotor.rotation.set(0, Math.PI / 2, 0);
    this.tailRotor.position.set(0.2, 2.9, -5.2);
    this.group.add(this.tailRotor);
  }

  get flying(): boolean {
    return true;
  }

  override get radius(): number {
    return 3.6;
  }

  update(ctx: EnemyContext): void {
    const dt = ctx.dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
    this.rotor.rotation.z += dt * 30;
    this.tailRotor.rotation.z += dt * 40;
    if (this.disabled > 0) {
      this.wrecked = true;
      return;
    }
    this.entering = Math.max(0, this.entering - dt);
    const r = ctx.playerRadius;
    const orbit = 34 + r * 3;
    this.angle += this.spinDir * dt * 0.22;
    const altitude = Math.max(16, ctx.player.y * 0.62);
    _target.set(ctx.player.x + Math.cos(this.angle) * orbit, altitude + noise1(ctx.time * 0.3 + this.seed) * 3, ctx.player.z + Math.sin(this.angle) * orbit);
    const roof = ctx.world.heightField.maxInRadius(this.pos.x, this.pos.z, 6);
    _target.y = Math.max(_target.y, roof + 8);

    // beam grip: pulled toward the beam axis and upward, fighting back
    const hx = this.pos.x - ctx.player.x;
    const hz = this.pos.z - ctx.player.z;
    const inBeam = ctx.beamActive && Math.hypot(hx, hz) < ctx.beamRadius + 2 && this.pos.y < ctx.player.y;
    this.grip += ((inBeam ? 1 : 0) - this.grip) * Math.min(1, dt * 4);

    const maxSpeed = this.stats.speed * (this.entering > 0 ? 2 : 1);
    _dir.copy(_target).sub(this.pos);
    const dist = _dir.length();
    if (dist > 0.01) _dir.multiplyScalar(Math.min(maxSpeed, dist * 0.8) / dist);
    if (this.grip > 0.05) {
      _dir.x += (ctx.player.x - this.pos.x) * 2 * this.grip;
      _dir.z += (ctx.player.z - this.pos.z) * 2 * this.grip;
      _dir.y += 3 * this.grip;
    }
    this.vel.lerp(_dir, Math.min(1, dt * 1.2));
    this.pos.addScaledVector(this.vel, dt);

    const face = Math.atan2(ctx.player.x - this.pos.x, ctx.player.z - this.pos.z);
    this.heading = dampAngle(this.heading, face, 1.8, dt);
    this.group.position.copy(this.pos);
    const wobble = this.grip * Math.sin(ctx.time * 20) * 0.15;
    this.group.rotation.set(0.12 + this.vel.length() * 0.008 + wobble, this.heading, -this.vel.x * 0.01 + wobble);

    _muzzle.set(this.pos.x, this.pos.y + 1.4, this.pos.z);
    const inRange = this.pos.distanceTo(ctx.player) < this.stats.range + r * 2 && this.entering <= 0 && this.grip < 0.5;
    this.updateGun(ctx, inRange, _muzzle, 1.1, true);
    _dir.copy(ctx.player).sub(_muzzle).normalize();
    this.updateMissiles(ctx, inRange, _muzzle, _dir, 1.25);
  }
}
