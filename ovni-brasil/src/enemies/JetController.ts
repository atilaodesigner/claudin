import { Vector3, type Mesh } from 'three';
import { clamp, damp, wrapAngle } from '../utils/math';
import { Enemy, type EnemyContext } from './Enemy';
import type { EnemyAssets } from './EnemyAssets';

const _muzzle = new Vector3();
const _dir = new Vector3();

type JetState = 'flyby' | 'approach' | 'pass' | 'turn';

/** Carcará fighter: fly-bys, strafing runs, missile locks and wide banking turns. */
export class JetController extends Enemy {
  state: JetState = 'approach';
  private stateTime = 0;
  private yawRate = 0;
  private roll = 0;
  private pitch = 0;
  private readonly flame: Mesh;
  private readonly shadow: Mesh;
  /** Lateral offset for formation flying. */
  sideOffset = 0;
  private strafed = false;

  constructor(id: number, assets: EnemyAssets) {
    super(id, 'jet');
    this.group.add(assets.model('jet'));
    this.flame = assets.glow(assets.glowOrange, 0.7);
    this.flame.position.set(0, 1.2, -6.2);
    this.flame.scale.set(0.6, 0.6, 1.6);
    this.group.add(this.flame);
    this.shadow = assets.fakeShadow(5.5, 7);
  }

  get flying(): boolean {
    return true;
  }

  override get radius(): number {
    return 4.5;
  }

  get shadowMesh(): Mesh {
    return this.shadow;
  }

  /** Scripted high-speed pass right over the player (the dramatic entrance). */
  startFlyby(player: Vector3, fromAngle: number, altitude: number): void {
    const d = 260;
    this.pos.set(player.x + Math.sin(fromAngle) * d, altitude, player.z + Math.cos(fromAngle) * d);
    this.heading = wrapAngle(fromAngle + Math.PI);
    this.state = 'flyby';
    this.stateTime = 0;
  }

  spawnApproach(player: Vector3, fromAngle: number, altitude: number): void {
    const d = 240;
    this.pos.set(player.x + Math.sin(fromAngle) * d, altitude, player.z + Math.cos(fromAngle) * d);
    this.heading = wrapAngle(fromAngle + Math.PI);
    this.state = 'approach';
    this.stateTime = 0;
  }

  update(ctx: EnemyContext): void {
    const dt = ctx.dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
    if (this.disabled > 0) {
      this.wrecked = true;
      return;
    }
    this.stateTime += dt;
    const r = ctx.playerRadius;
    const speed = this.stats.speed * (this.state === 'flyby' ? 1.35 : 1);
    const toX = ctx.player.x + ctx.playerVel.x * 1.2 - this.pos.x + Math.cos(this.heading) * this.sideOffset;
    const toZ = ctx.player.z + ctx.playerVel.z * 1.2 - this.pos.z - Math.sin(this.heading) * this.sideOffset;
    const dist = Math.hypot(toX, toZ);
    const desired = Math.atan2(toX, toZ);
    const err = wrapAngle(desired - this.heading);
    let targetYawRate = 0;
    let targetAlt = ctx.player.y + 10 + r * 1.2;

    switch (this.state) {
      case 'flyby':
        targetAlt = ctx.player.y + 6 + r;
        if (this.stateTime > 7) this.enter('pass');
        break;
      case 'approach':
        targetYawRate = clamp(err * 1.6, -0.9, 0.9);
        if (dist < 90) targetAlt = ctx.player.y + 3 + r * 0.8;
        if (dist < 22 + r) this.enter('pass');
        break;
      case 'pass':
        targetYawRate = 0;
        if (this.stateTime > 2.4) this.enter('turn');
        break;
      case 'turn':
        targetYawRate = (err >= 0 ? 1 : -1) * 0.85;
        if (Math.abs(err) < 0.25 && this.stateTime > 1) this.enter('approach');
        break;
    }
    this.yawRate = damp(this.yawRate, targetYawRate, 3, dt);
    this.heading = wrapAngle(this.heading + this.yawRate * dt);
    const roof = ctx.world.heightField.maxInRadius(this.pos.x, this.pos.z, 8);
    targetAlt = Math.max(targetAlt, roof + 10);
    const newY = damp(this.pos.y, targetAlt, 0.9, dt);
    this.vel.set(Math.sin(this.heading) * speed, (newY - this.pos.y) / Math.max(dt, 1e-4), Math.cos(this.heading) * speed);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y = newY;

    this.roll = damp(this.roll, -this.yawRate * 0.95, 4, dt);
    this.pitch = damp(this.pitch, clamp(-this.vel.y * 0.02, -0.3, 0.3), 4, dt);
    this.group.position.copy(this.pos);
    this.group.rotation.set(this.pitch, this.heading, this.roll, 'YXZ');
    this.flame.scale.z = 1.4 + Math.random() * 0.5;
    this.shadow.position.set(this.pos.x, ctx.world.groundAt(this.pos.x, this.pos.z) + 0.12, this.pos.z);
    this.shadow.rotation.z = -this.heading;
    (this.shadow.material as { opacity: number }).opacity = clamp(0.35 - (this.pos.y - ctx.player.y) * 0.003, 0.12, 0.35);

    // weapons: gun strafe when lined up, missiles from mid range
    const facing = Math.abs(err) < 0.3;
    _muzzle.copy(this.pos).addScaledVector(_dir.set(Math.sin(this.heading), 0, Math.cos(this.heading)), 6);
    const strafing = this.state === 'approach' && facing && dist < 95;
    if (strafing && !this.strafed) {
      this.burstLeft = this.stats.burst;
      this.burstTimer = 0;
      this.strafed = true;
    }
    this.updateGun(ctx, false, _muzzle, 1.2, true);
    _dir.copy(ctx.player).sub(_muzzle).normalize();
    this.updateMissiles(ctx, (this.state === 'approach' || this.state === 'turn') && dist > 60 && dist < 190 && Math.abs(err) < 0.6, _muzzle, _dir, 1.25);
  }

  private enter(s: JetState): void {
    this.state = s;
    this.stateTime = 0;
    if (s === 'approach') this.strafed = false;
  }

  override dispose(): void {
    super.dispose();
    this.shadow.removeFromParent();
  }
}
