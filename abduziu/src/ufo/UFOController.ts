import { Vector2, Vector3 } from 'three';
import { BALANCE } from '../config/gameBalance';
import { clamp, damp, dampAngle } from '../utils/math';
import { noise1 } from '../utils/noise';
import type { World } from '../world/World';
import type { UFOStats } from './UFOStats';
import type { UFOVisuals } from './UFOVisuals';

/**
 * Floating, guided flight: velocity eases toward the input with inertia, the saucer
 * banks into turns, bobs, rises above rooftops and reacts to the beam's strain.
 */
export class UFOController {
  readonly position = new Vector3();
  readonly velocity = new Vector3();
  altitude: number = BALANCE.ufo.baseAltitude;
  private roll = 0;
  private pitch = 0;
  private time = 0;
  private tug = 0;
  private recoil = 0;
  private jitter = 0;
  dashTimer = 0;
  private readonly dashDir = new Vector3();
  /** 0 when moving at full speed, 1 when hovering still (beam bonus). */
  stillFactor = 0;
  /** Scripted control (intro/extraction). */
  frozen = false;
  /** Beam disabled (boss EMP). */
  controlsLocked = 0;
  readonly lastMoveDir = new Vector3(0, 0, -1);

  constructor(
    private readonly visuals: UFOVisuals,
    private world: World,
  ) {}

  setWorld(world: World): void {
    this.world = world;
  }

  spawnAt(x: number, z: number, altitude: number): void {
    this.position.set(x, altitude, z);
    this.velocity.set(0, 0, 0);
    this.altitude = altitude;
  }

  /** Pull toward the ground from a heavy object that resists. */
  addTug(amount: number): void {
    this.tug = Math.max(this.tug, amount);
    this.jitter = Math.max(this.jitter, amount);
  }

  addRecoil(amount: number): void {
    this.recoil = Math.min(2, this.recoil + amount);
  }

  dash(dirHint: Vector2): boolean {
    if (this.dashTimer > 0) return false;
    if (dirHint.lengthSq() > 0.01) this.dashDir.set(dirHint.x, 0, -dirHint.y).normalize();
    else if (this.velocity.lengthSq() > 0.5) this.dashDir.copy(this.velocity).setY(0).normalize();
    else this.dashDir.copy(this.lastMoveDir);
    this.dashTimer = BALANCE.player.dashDuration;
    return true;
  }

  update(dt: number, move: Vector2, stats: UFOStats, minAltitude = 0): void {
    this.time += dt;
    const B = BALANCE.ufo;
    const maxSpeed = stats.speed;
    const lockMul = this.controlsLocked > 0 ? 0.35 : 1;
    this.controlsLocked = Math.max(0, this.controlsLocked - dt);

    if (!this.frozen) {
      const tx = move.x * maxSpeed * lockMul;
      const tz = -move.y * maxSpeed * lockMul;
      const hasInput = move.lengthSq() > 0.0004;
      const rate = hasInput ? stats.acceleration : B.deceleration;
      this.velocity.x = damp(this.velocity.x, tx, rate, dt);
      this.velocity.z = damp(this.velocity.z, tz, rate, dt);
      if (hasInput) this.lastMoveDir.set(move.x, 0, -move.y).normalize();
      if (this.dashTimer > 0) {
        this.dashTimer -= dt;
        const k = BALANCE.player.dashImpulse * Math.pow(stats.scale, 0.5);
        this.velocity.x = this.dashDir.x * k;
        this.velocity.z = this.dashDir.z * k;
      }
      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;
      this.world.clampToBounds(this.position, 5);
    }

    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const stillTarget = 1 - clamp(speed / (BALANCE.beam.stillSpeedThreshold * Math.pow(stats.scale, 0.5)), 0, 1);
    this.stillFactor = damp(this.stillFactor, stillTarget, 4, dt);

    // altitude: hover height, but always above rooftops under the hull
    const clearance = B.clearance * stats.scale;
    const roof = this.world.heightField.maxInRadius(this.position.x, this.position.z, stats.radius * 1.3);
    const targetAlt = Math.max(stats.altitude, roof + clearance + stats.radius * 0.4, minAltitude);
    this.altitude = damp(this.altitude, targetAlt, targetAlt > this.altitude ? 5 : 1.5, dt);

    this.tug = Math.max(0, this.tug - dt * 3);
    this.recoil = Math.max(0, this.recoil - dt * 4);
    this.jitter = Math.max(0, this.jitter - dt * 3);
    const bob = Math.sin(this.time * 1.7) * 0.12 * stats.scale + Math.sin(this.time * 0.63) * 0.08 * stats.scale;
    this.position.y = this.altitude + bob - this.tug * 0.35 * stats.scale - this.recoil * 0.3 * stats.scale;

    // banking & tilt
    const inv = 1 / Math.max(1, maxSpeed);
    const targetRoll = -this.velocity.x * inv * B.maxTilt;
    const targetPitch = this.velocity.z * inv * B.maxTilt;
    this.roll = dampAngle(this.roll, targetRoll, 5, dt);
    this.pitch = dampAngle(this.pitch, targetPitch, 5, dt);
    const j = this.jitter * 0.06;

    const root = this.visuals.root;
    root.position.copy(this.position);
    root.scale.setScalar(stats.radius);
    const body = this.visuals.body;
    body.rotation.set(this.pitch + noise1(this.time * 30) * j, 0, this.roll + noise1(this.time * 30 + 9) * j);
  }

  get speed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  get isDashing(): boolean {
    return this.dashTimer > 0;
  }
}
