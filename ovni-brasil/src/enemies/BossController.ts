import { Vector3, type Mesh } from 'three';
import { BOSS } from '../config/enemies';
import { ShieldSystem } from '../combat/ShieldSystem';
import { clamp, damp, wrapAngle } from '../utils/math';
import { Enemy, type EnemyContext } from './Enemy';
import type { EnemyAssets } from './EnemyAssets';

const _muzzle = new Vector3();
const _dir = new Vector3();

type BossPhase = 'intro' | 'circle' | 'strafe' | 'emp' | 'retreat';

/**
 * PROJETO TUCANO NEGRO. A shielded experimental flying wing. Its shield falls to EMP
 * and redirected missiles; when exposed it can be gripped by the beam (tug of war).
 * Defeated, it falls — and can be abducted.
 */
export class BossController extends Enemy {
  phase: BossPhase = 'intro';
  private phaseTime = 0;
  shieldHp: number = BOSS.shieldHp;
  shieldDown = 0;
  private shieldRegen = 0;
  readonly shieldFx = new ShieldSystem();
  private angle = 0;
  private empCharge = 0;
  empFired = false;
  droneWaveReady = false;
  private droneTimer = BOSS.droneWaveInterval * 0.5;
  private empTimer = BOSS.empPulseInterval * 0.6;
  grip = 0;
  private readonly engines: Mesh[] = [];
  private readonly shadow: Mesh;

  constructor(id: number, assets: EnemyAssets) {
    super(id, 'boss');
    this.group.add(assets.model('boss'));
    for (const s of [1, -1]) {
      const g = assets.glow(assets.glowOrange, 1.3);
      g.position.set(s * 7, 2.5, -7.8);
      g.scale.set(1.1, 1.1, 2.2);
      this.engines.push(g);
      this.group.add(g);
    }
    this.shadow = assets.fakeShadow(20, 12);
    this.shieldFx.reset(BOSS.shieldHp);
  }

  get flying(): boolean {
    return true;
  }

  override get radius(): number {
    return 14;
  }

  get shadowMesh(): Mesh {
    return this.shadow;
  }

  get shieldFraction(): number {
    return this.shieldHp / BOSS.shieldHp;
  }

  get hullFraction(): number {
    return this.hp / this.stats.hp;
  }

  spawn(player: Vector3): void {
    this.angle = Math.random() * Math.PI * 2;
    this.pos.set(player.x + Math.sin(this.angle) * 320, BOSS.altitudeHigh, player.z + Math.cos(this.angle) * 320);
    this.heading = wrapAngle(this.angle + Math.PI);
    this.phase = 'intro';
    this.phaseTime = 0;
  }

  /** Shield-aware damage. Returns true if destroyed. */
  hit(amount: number, kind: 'emp' | 'missile' | 'grip' | 'debris'): boolean {
    if (!this.alive) return false;
    if (this.shieldHp > 0 && kind !== 'grip') {
      const dmg = kind === 'emp' ? BOSS.empShieldDamage : kind === 'missile' ? BOSS.missileShieldDamage : BOSS.debrisDamage;
      this.shieldHp = Math.max(0, this.shieldHp - dmg);
      this.shieldFx.absorb(dmg, null, this.pos);
      this.shieldRegen = BOSS.shieldRegenDelay;
      if (this.shieldHp <= 0) this.shieldDown = BOSS.shieldDownTime;
      this.hitFlash = 0.5;
      return false;
    }
    if (this.shieldHp > 0) return false;
    const dmg = kind === 'missile' ? BOSS.missileHullDamage : kind === 'debris' ? BOSS.debrisDamage : amount;
    return this.damage(dmg);
  }

  override emp(_duration: number): void {
    this.hit(0, 'emp');
  }

  update(ctx: EnemyContext): void {
    const dt = ctx.dt;
    this.phaseTime += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 3);

    // shield logic
    if (this.shieldDown > 0) {
      this.shieldDown -= dt;
      if (this.shieldDown <= 0) this.shieldHp = BOSS.shieldHp * 0.6;
    } else if (this.shieldHp < BOSS.shieldHp) {
      this.shieldRegen -= dt;
      if (this.shieldRegen <= 0) this.shieldHp = Math.min(BOSS.shieldHp, this.shieldHp + 12 * dt);
    }
    this.shieldFx.value = this.shieldHp;
    this.shieldFx.broken = this.shieldHp <= 0;
    this.shieldFx.update(dt, this.pos, 13, BOSS.shieldHp, 0);

    const r = ctx.playerRadius;
    let targetAlt = BOSS.altitudeHigh + ctx.player.y * 0.3;
    let speed = this.stats.speed;
    const dx = ctx.player.x - this.pos.x;
    const dz = ctx.player.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    let desired = Math.atan2(dx, dz);

    switch (this.phase) {
      case 'intro':
        speed *= 1.6;
        if (this.phaseTime > 6) this.enterPhase('circle');
        break;
      case 'circle': {
        this.angle += dt * 0.28;
        const orbit = BOSS.orbitRadius + r * 2;
        const tx = ctx.player.x + Math.cos(this.angle) * orbit;
        const tz = ctx.player.z + Math.sin(this.angle) * orbit;
        desired = Math.atan2(tx - this.pos.x, tz - this.pos.z);
        this.droneTimer -= dt;
        if (this.droneTimer <= 0) {
          this.droneTimer = BOSS.droneWaveInterval;
          this.droneWaveReady = true;
        }
        this.empTimer -= dt;
        if (this.empTimer <= 0 && dist < BOSS.orbitRadius * 1.8) this.enterPhase('emp');
        else if (this.phaseTime > 14) this.enterPhase('strafe');
        break;
      }
      case 'strafe':
        // dives low right under the saucer: the window to grip it with the beam
        targetAlt = Math.max(BOSS.altitudeLow, ctx.player.y - 10 - r);
        speed *= 0.75;
        if (dist < 20 + r) speed *= 0.45;
        if (this.phaseTime > 9) this.enterPhase('retreat');
        break;
      case 'emp':
        speed *= 0.4;
        this.empCharge = Math.min(1, this.phaseTime / 2.2);
        if (this.phaseTime > 2.2 && !this.empFired) {
          this.empFired = true;
        }
        if (this.phaseTime > 3) {
          this.empTimer = BOSS.empPulseInterval;
          this.empCharge = 0;
          this.enterPhase('circle');
        }
        break;
      case 'retreat':
        desired = Math.atan2(-dx, -dz);
        if (this.phaseTime > 4) this.enterPhase('circle');
        break;
    }

    // beam grip (only matters with the shield down)
    const inBeam = ctx.beamActive && dist < ctx.beamRadius + 10 && this.pos.y < ctx.player.y;
    this.grip = damp(this.grip, inBeam ? 1 : 0, 4, dt);
    if (this.grip > 0.1 && this.shieldHp <= 0) {
      speed *= 1 - this.grip * 0.7;
      this.hit(BOSS.beamGripDps * dt * this.grip, 'grip');
      targetAlt += this.grip * 6;
    }

    const err = wrapAngle(desired - this.heading);
    this.heading = wrapAngle(this.heading + clamp(err * 1.2, -0.7, 0.7) * dt);
    this.pos.x += Math.sin(this.heading) * speed * dt;
    this.pos.z += Math.cos(this.heading) * speed * dt;
    const roof = ctx.world.heightField.maxInRadius(this.pos.x, this.pos.z, 16);
    this.pos.y = damp(this.pos.y, Math.max(targetAlt, roof + 12), 0.8, dt);
    this.vel.set(Math.sin(this.heading) * speed, 0, Math.cos(this.heading) * speed);
    this.group.position.copy(this.pos);
    const shake = this.grip * 0.05 * Math.sin(ctx.time * 30);
    this.group.rotation.set(shake, this.heading, clamp(-err, -0.5, 0.5) + shake, 'YXZ');
    for (const e of this.engines) e.scale.z = 2 + Math.random() * 0.8;
    this.shadow.position.set(this.pos.x, ctx.world.groundAt(this.pos.x, this.pos.z) + 0.14, this.pos.z);
    this.shadow.rotation.z = -this.heading;

    // weapons
    _muzzle.copy(this.pos);
    _muzzle.y -= 1;
    const canShoot = this.phase === 'circle' || this.phase === 'strafe';
    this.updateGun(ctx, canShoot && dist < this.stats.range, _muzzle, 1.4, true);
    _dir.copy(ctx.player).sub(_muzzle).normalize();
    this.updateMissiles(ctx, this.phase === 'circle' && dist < 180, _muzzle, _dir, 1.0);
  }

  get empChargeLevel(): number {
    return this.empCharge;
  }

  private enterPhase(p: BossPhase): void {
    this.phase = p;
    this.phaseTime = 0;
    if (p === 'emp') this.empFired = false;
  }

  override dispose(): void {
    super.dispose();
    this.shadow.removeFromParent();
    this.shieldFx.mesh.removeFromParent();
  }
}
