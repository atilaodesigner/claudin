import { Vector3, type Mesh } from 'three';
import type { EnemyKind } from '../config/enemies';
import { dampAngle } from '../utils/math';
import { noise1 } from '../utils/noise';
import { Enemy, type EnemyContext } from './Enemy';
import type { EnemyAssets } from './EnemyAssets';

const _target = new Vector3();
const _muzzle = new Vector3();
const _dir = new Vector3();

/** Sentinela drones: swarm around the saucer at its altitude and pepper it. */
export class DroneController extends Enemy {
  private orbitAngle = Math.random() * Math.PI * 2;
  private readonly orbitDir = Math.random() < 0.5 ? 1 : -1;
  private readonly seed = Math.random() * 100;
  private readonly body: Mesh;
  private readonly light: Mesh;
  private readonly heavy: boolean;

  constructor(id: number, assets: EnemyAssets, kind: EnemyKind = 'drone') {
    super(id, kind);
    this.heavy = kind === 'heavydrone';
    this.body = assets.model('drone');
    if (this.heavy) this.body.scale.setScalar(1.8);
    this.group.add(this.body);
    this.light = assets.glow(assets.glowRed, this.heavy ? 0.35 : 0.22);
    this.light.position.set(0, 0.45 * (this.heavy ? 1.8 : 1), 0.6 * (this.heavy ? 1.8 : 1));
    this.group.add(this.light);
  }

  get flying(): boolean {
    return true;
  }

  override get radius(): number {
    return this.heavy ? 2.4 : 1.5;
  }

  update(ctx: EnemyContext): void {
    const dt = ctx.dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
    if (this.disabled > 0) {
      // EMP: the drone dies in the air and becomes a falling wreck
      this.wrecked = true;
      return;
    }
    const r = ctx.playerRadius;
    const orbit = (this.heavy ? 22 : 15) + r * 3.5;
    this.orbitAngle += this.orbitDir * dt * (this.heavy ? 0.35 : 0.6);
    _target.set(
      ctx.player.x + Math.cos(this.orbitAngle) * orbit,
      ctx.player.y + 1 + noise1(ctx.time * 0.4 + this.seed) * 4 + r * 0.3,
      ctx.player.z + Math.sin(this.orbitAngle) * orbit,
    );
    // steering with limited accel (cheap, no physics)
    const maxSpeed = this.stats.speed * (1 + r * 0.05);
    _dir.copy(_target).sub(this.pos);
    const dist = _dir.length();
    if (dist > 0.01) _dir.multiplyScalar(Math.min(maxSpeed, dist * 1.4) / dist);
    this.vel.lerp(_dir, Math.min(1, dt * 2.2));
    this.pos.addScaledVector(this.vel, dt);
    const roof = ctx.world.heightField.heightAt(this.pos.x, this.pos.z);
    if (this.pos.y < roof + 3) this.pos.y = roof + 3;

    const face = Math.atan2(ctx.player.x - this.pos.x, ctx.player.z - this.pos.z);
    this.heading = dampAngle(this.heading, face, 5, dt);
    this.group.position.copy(this.pos);
    this.group.rotation.set(this.vel.z * 0.03, this.heading, -this.vel.x * 0.03);
    this.light.visible = Math.floor(ctx.time * 4 + this.seed) % 2 === 0;
    _muzzle.copy(this.pos).y -= 0.2;
    const inRange = this.pos.distanceTo(ctx.player) < this.stats.range + r * 2;
    this.updateGun(ctx, inRange, _muzzle, 1.3);
    if (this.heavy) {
      _dir.copy(ctx.player).sub(this.pos).normalize();
      this.updateMissiles(ctx, inRange, _muzzle, _dir, 1.4);
    }
  }
}
