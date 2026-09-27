import { Group, Vector3 } from 'three';
import type { AudioManager } from '../audio/AudioManager';
import { ENEMIES, type EnemyKind, type EnemyStats } from '../config/enemies';
import type { VFXManager } from '../effects/VFXManager';
import type { World } from '../world/World';
import type { BulletSystem } from './BulletSystem';
import type { MissileSystem } from './MissileController';

export interface EnemyContext {
  dt: number;
  time: number;
  player: Vector3;
  playerVel: Vector3;
  playerRadius: number;
  beamRadius: number;
  beamTier: number;
  beamActive: boolean;
  alert: number;
  world: World;
  bullets: BulletSystem;
  missiles: MissileSystem;
  vfx: VFXManager;
  audio: AudioManager;
  /** Called when a missile lock starts/stops (HUD + audio). */
  onLock: (enemy: Enemy, active: boolean) => void;
}

const _aim = new Vector3();
const _from = new Vector3();

/** Base class for every hostile unit of the Força Sentinela / Patrulha Aurora. */
export abstract class Enemy {
  readonly stats: EnemyStats;
  readonly group = new Group();
  readonly pos = new Vector3();
  readonly vel = new Vector3();
  hp: number;
  alive = true;
  /** Seconds remaining disabled by EMP. */
  disabled = 0;
  heading = 0;
  fireTimer: number;
  burstLeft = 0;
  burstTimer = 0;
  missileTimer: number;
  lockTimer = 0;
  locking = false;
  hitFlash = 0;
  /** Set when the enemy should be converted into a falling wreck by the manager. */
  wrecked = false;
  /** Set when the manager must remove it without a wreck (captured, despawned). */
  removed = false;
  killedBy: 'missile' | 'emp' | 'beam' | 'reflect' | null = null;

  constructor(
    readonly id: number,
    readonly kind: EnemyKind,
  ) {
    this.stats = ENEMIES[kind];
    this.hp = this.stats.hp;
    this.fireTimer = this.stats.fireInterval * (0.6 + Math.random() * 0.8);
    this.missileTimer = (this.stats.missileInterval ?? 999) * (0.6 + Math.random() * 0.6);
  }

  abstract get flying(): boolean;
  abstract update(ctx: EnemyContext): void;

  /** Hit radius for bullets/missiles/proximity. */
  get radius(): number {
    return 2;
  }

  damage(amount: number): boolean {
    if (!this.alive) return false;
    this.hp -= amount;
    this.hitFlash = 1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.wrecked = true;
      return true;
    }
    return false;
  }

  emp(duration: number): void {
    this.disabled = Math.max(this.disabled, duration);
    this.locking = false;
    this.lockTimer = 0;
  }

  /** Shoots a tracer at the player with lead and spread. */
  protected shoot(ctx: EnemyContext, muzzle: Vector3, spread: number, heavy = false): void {
    const s = this.stats;
    const dist = muzzle.distanceTo(ctx.player);
    const t = dist / s.bulletSpeed;
    _aim.copy(ctx.player).addScaledVector(ctx.playerVel, t * 0.75);
    _aim.x += (Math.random() - 0.5) * spread * ctx.playerRadius * 2;
    _aim.y += (Math.random() - 0.5) * spread * ctx.playerRadius;
    _aim.z += (Math.random() - 0.5) * spread * ctx.playerRadius * 2;
    _from.copy(muzzle);
    ctx.bullets.fire(_from, _aim.sub(_from), s.bulletSpeed, s.bulletDamage, this.id);
    ctx.audio.gunshot(muzzle.x, muzzle.z, heavy);
  }

  /** Burst fire helper; returns true while a burst is running. */
  protected updateGun(ctx: EnemyContext, canFire: boolean, muzzle: Vector3, spread: number, heavy = false): void {
    const s = this.stats;
    if (this.burstLeft > 0) {
      this.burstTimer -= ctx.dt;
      if (this.burstTimer <= 0) {
        this.shoot(ctx, muzzle, spread, heavy);
        this.burstLeft--;
        this.burstTimer = s.burstGap;
      }
      return;
    }
    this.fireTimer -= ctx.dt;
    if (this.fireTimer <= 0 && canFire) {
      this.burstLeft = s.burst;
      this.burstTimer = 0;
      this.fireTimer = s.fireInterval * (0.8 + Math.random() * 0.5);
    }
  }

  /** Lock-on then launch. Lock gives the player time to react. */
  protected updateMissiles(ctx: EnemyContext, canFire: boolean, muzzle: Vector3, dir: Vector3, lockTime: number): void {
    if (this.stats.missileInterval === undefined) return;
    if (this.locking) {
      this.lockTimer += ctx.dt;
      if (!canFire) {
        this.locking = false;
        ctx.onLock(this, false);
        return;
      }
      if (this.lockTimer >= lockTime) {
        this.locking = false;
        ctx.onLock(this, false);
        const m = ctx.missiles.launch(muzzle, dir, this.stats.missileDamage ?? 12, this.id);
        if (m) ctx.audio.missileLaunch(muzzle.x, muzzle.z);
        this.missileTimer = this.stats.missileInterval * (0.8 + Math.random() * 0.4);
      }
      return;
    }
    this.missileTimer -= ctx.dt;
    if (this.missileTimer <= 0 && canFire) {
      this.locking = true;
      this.lockTimer = 0;
      ctx.onLock(this, true);
    }
  }

  dispose(): void {
    this.group.removeFromParent();
  }
}
