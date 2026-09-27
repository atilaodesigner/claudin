import { Vector3, type Scene } from 'three';
import type { AbductionSystem } from '../abduction/AbductionSystem';
import type { AudioManager } from '../audio/AudioManager';
import { ALERT_BUDGETS, BOSS, ENEMIES, MISSILE, SPAWN_INTERVALS, type EnemyKind } from '../config/enemies';
import { getObjectDef } from '../config/objects';
import type { EventBus } from '../core/EventBus';
import type { VFXManager } from '../effects/VFXManager';
import { AState, type Abductable } from '../world/Abductable';
import type { World } from '../world/World';
import { BossController } from './BossController';
import { BulletSystem, type Bullet } from './BulletSystem';
import { DroneController } from './DroneController';
import type { Enemy, EnemyContext } from './Enemy';
import { EnemyAssets } from './EnemyAssets';
import { HelicopterController } from './HelicopterController';
import { JetController } from './JetController';
import { MissileSystem, type Missile } from './MissileController';
import { PoliceCarController } from './PoliceCarController';

export interface EnemyHooks {
  onPlayerHit: (damage: number, point: Vector3, reflectable: boolean, bullet: Bullet | null) => boolean;
  onEnemyDestroyed: (e: Enemy, byMissile: boolean) => void;
  onPerfectDodge: (pos: Vector3) => void;
  onBossEmp: () => void;
  onJetIntro: (stage: 'radio' | 'rumble' | 'flyby') => void;
  onLock: (active: boolean) => void;
  onBuildingHit: (pos: Vector3) => void;
}

export interface PlayerSnapshot {
  pos: Vector3;
  vel: Vector3;
  radius: number;
  beamRadius: number;
  beamTier: number;
  beamActive: boolean;
  dashing: boolean;
  reflectChance: number;
  mirror: boolean;
  slowRadius: number;
  slowFactor: number;
}

const _v = new Vector3();
const _v2 = new Vector3();

/** Spawns and runs every enemy, projectile and anti-air turret. */
export class EnemyManager {
  readonly enemies: Enemy[] = [];
  readonly bullets: BulletSystem;
  readonly missiles: MissileSystem;
  readonly assets: EnemyAssets;
  boss: BossController | null = null;
  private nextId = 1;
  private readonly spawnTimers: Partial<Record<EnemyKind, number>> = {};
  private readonly policeProxies = new Map<number, Abductable>();
  readonly wrecks: Abductable[] = [];
  private jetIntroDone = false;
  private jetIntroTimer = -1;
  private jetIntroFlybyPlayed = false;
  private introJet: JetController | null = null;
  private aaTimer = 0;
  private readonly aaCooldown = new Map<number, number>();
  private readonly aaScratch: Abductable[] = [];
  private locks = 0;
  spawningEnabled = true;
  maxAlertTime = 0;
  bossDefeated = false;
  bossSpawned = false;
  private ctx: EnemyContext;

  constructor(
    private readonly scene: Scene,
    private readonly world: World,
    private readonly abduction: AbductionSystem,
    private readonly vfx: VFXManager,
    private readonly audio: AudioManager,
    private readonly bus: EventBus,
    private readonly hooks: EnemyHooks,
  ) {
    this.assets = new EnemyAssets(world.lib, world.material);
    this.bullets = new BulletSystem(scene);
    this.missiles = new MissileSystem(scene);
    this.ctx = {
      dt: 0,
      time: 0,
      player: new Vector3(),
      playerVel: new Vector3(),
      playerRadius: 1,
      beamRadius: 1,
      beamTier: 1,
      beamActive: true,
      alert: 0,
      world,
      bullets: this.bullets,
      missiles: this.missiles,
      vfx,
      audio,
      onLock: (_e, active) => {
        this.locks = Math.max(0, this.locks + (active ? 1 : -1));
        hooks.onLock(this.locks > 0);
      },
    };
    const prevDetach = world.livingDetach;
    world.livingDetach = (obj) => {
      if (obj.living?.system === 'enemy') this.onProxyCaptured(obj);
      else prevDetach?.(obj);
    };
  }

  reset(): void {
    for (const e of this.enemies) this.removeEnemy(e);
    this.enemies.length = 0;
    this.bullets.clear();
    this.missiles.clear();
    this.boss = null;
    this.wrecks.length = 0;
    this.jetIntroDone = false;
    this.jetIntroTimer = -1;
    this.introJet = null;
    this.locks = 0;
    this.maxAlertTime = 0;
    this.bossDefeated = false;
    this.bossSpawned = false;
    for (const k of Object.keys(this.spawnTimers)) delete this.spawnTimers[k as EnemyKind];
  }

  dispose(): void {
    this.reset();
    this.bullets.dispose();
    this.missiles.dispose();
  }

  count(kind: EnemyKind): number {
    let c = 0;
    for (const e of this.enemies) if (e.kind === kind && e.alive) c++;
    return c;
  }

  get lockActive(): boolean {
    return this.locks > 0;
  }

  // ───────────────────────────────────────────── spawning

  spawn(kind: EnemyKind, p: PlayerSnapshot): Enemy | null {
    const id = this.nextId++;
    let e: Enemy;
    const a = Math.random() * Math.PI * 2;
    switch (kind) {
      case 'police': {
        const car = new PoliceCarController(id, this.assets);
        let best: Vector3 | null = null;
        for (let i = 0; i < 16; i++) {
          const rp = this.world.randomRoadPoint(Math.random);
          const d = Math.hypot(rp.x - p.pos.x, rp.z - p.pos.z);
          if (d > 55 && d < 120) {
            best = rp;
            break;
          }
        }
        if (!best) return null;
        const onX = this.world.roadLines.zs.some((z) => Math.abs(z - best.z) < 0.5);
        if (onX) car.placeOnRoad('x', best.z, best.x, best.x < p.pos.x ? 1 : -1);
        else car.placeOnRoad('z', best.x, best.z, best.z < p.pos.z ? 1 : -1);
        e = car;
        this.createProxy(car);
        break;
      }
      case 'drone':
      case 'heavydrone': {
        const d = new DroneController(id, this.assets, kind);
        d.pos.set(p.pos.x + Math.cos(a) * (60 + p.radius * 4), p.pos.y + 14, p.pos.z + Math.sin(a) * (60 + p.radius * 4));
        e = d;
        break;
      }
      case 'helicopter': {
        const h = new HelicopterController(id, this.assets);
        h.pos.set(p.pos.x + Math.cos(a) * 120, 34, p.pos.z + Math.sin(a) * 120);
        e = h;
        break;
      }
      case 'jet': {
        const j = new JetController(id, this.assets);
        j.spawnApproach(p.pos, a, p.pos.y + 16);
        this.scene.add(j.shadowMesh);
        e = j;
        if (this.count('jet') === 0 && Math.random() < 0.45) {
          // formation partner
          const w = new JetController(this.nextId++, this.assets);
          w.spawnApproach(p.pos, a, p.pos.y + 16);
          w.pos.x += Math.cos(a) * 16;
          w.pos.z -= Math.sin(a) * 16;
          w.sideOffset = 16;
          this.scene.add(w.shadowMesh);
          this.addEnemy(w);
        }
        break;
      }
      case 'boss': {
        const b = new BossController(id, this.assets);
        b.spawn(p.pos);
        this.scene.add(b.shadowMesh, b.shieldFx.mesh);
        this.boss = b;
        this.bossSpawned = true;
        e = b;
        this.bus.emit('boss:spawn', {});
        break;
      }
    }
    this.addEnemy(e);
    return e;
  }

  private addEnemy(e: Enemy): void {
    this.enemies.push(e);
    this.scene.add(e.group);
    e.group.position.copy(e.pos);
    this.bus.emit('enemy:spawn', { kind: e.kind, id: e.id, position: e.pos });
  }

  private createProxy(car: PoliceCarController): void {
    const def = getObjectDef('viatura');
    const o = this.world.createObject(def, 'policecar', 'normal', 'C', 0xffffff);
    o.slot = 'living';
    o.living = { index: car.id, system: 'enemy' };
    o.enemyKind = 'police';
    o.enemyId = car.id;
    o.home.copy(car.pos);
    o.pos.copy(car.pos);
    this.world.hash.insert(o.uid, car.pos.x, car.pos.z);
    this.policeProxies.set(car.id, o);
  }

  private onProxyCaptured(obj: Abductable): void {
    const e = this.enemies.find((x) => x.id === obj.living?.index);
    if (e) {
      e.removed = true;
      e.alive = false;
      this.bus.emit('enemy:disabled', { kind: e.kind, id: e.id });
    }
    this.policeProxies.delete(obj.living?.index ?? -1);
    obj.living = null;
  }

  startJetIntro(): void {
    if (this.jetIntroDone || this.jetIntroTimer >= 0) return;
    this.jetIntroTimer = 0;
    this.jetIntroFlybyPlayed = false;
    this.hooks.onJetIntro('radio');
  }

  // ───────────────────────────────────────────── update

  update(dt: number, time: number, p: PlayerSnapshot, alert: number): void {
    const ctx = this.ctx;
    ctx.dt = dt;
    ctx.time = time;
    ctx.player.copy(p.pos);
    ctx.playerVel.copy(p.vel);
    ctx.playerRadius = p.radius;
    ctx.beamRadius = p.beamRadius;
    ctx.beamTier = p.beamTier;
    ctx.beamActive = p.beamActive;
    ctx.alert = alert;
    if (alert >= 6) this.maxAlertTime += dt;

    this.updateSpawning(dt, p, alert);
    this.updateJetIntro(dt, p);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i] as Enemy;
      if (e.removed) {
        this.removeEnemy(e);
        this.enemies.splice(i, 1);
        continue;
      }
      e.update(ctx);
      // police proxy follows the car
      const proxy = this.policeProxies.get(e.id);
      if (proxy && proxy.alive && proxy.slot === 'living') {
        proxy.home.copy(e.pos);
        proxy.pos.copy(e.pos);
        proxy.homeRotY = e.heading;
        proxy.tierOverride = e.disabled > 0 ? ENEMIES.police.disabledTier : null;
        this.world.hash.insert(proxy.uid, e.pos.x, e.pos.z);
      }
      if (e instanceof HelicopterController) this.updateHeliGrip(e, p);
      if (e === this.boss) this.updateBoss(e as BossController, p, dt);
      if (e.wrecked) {
        this.toWreck(e, e.hp <= 0);
        this.enemies.splice(i, 1);
      }
    }

    // helicopter rotor audio
    let heliNear = 0;
    let sirenNear = 0;
    for (const e of this.enemies) {
      const d = e.pos.distanceTo(p.pos);
      if (e.kind === 'helicopter') heliNear = Math.max(heliNear, 1 - d / 140);
      if (e.kind === 'police' && e.disabled <= 0) sirenNear = Math.max(sirenNear, 1 - d / 120);
    }
    this.audio.setHelicopter(Math.max(0, heliNear));
    this.audio.setSiren(Math.max(0, sirenNear));

    this.updateWrecks();
    this.updateAA(dt, p, alert);
    this.updateBullets(dt, p);
    this.updateMissiles(dt, p);
  }

  private updateSpawning(dt: number, p: PlayerSnapshot, alert: number): void {
    if (!this.spawningEnabled) return;
    const budget = ALERT_BUDGETS[Math.min(alert, ALERT_BUDGETS.length - 1)] ?? {};
    for (const [k, max] of Object.entries(budget) as [EnemyKind, number][]) {
      if (this.spawnTimers[k] === undefined) this.spawnTimers[k] = k === 'jet' ? 0.5 : 1.5;
      this.spawnTimers[k] = (this.spawnTimers[k] as number) - dt;
      if ((this.spawnTimers[k] as number) > 0) continue;
      this.spawnTimers[k] = SPAWN_INTERVALS[k] * (0.7 + Math.random() * 0.6);
      if (this.count(k) >= max) continue;
      if (k === 'jet' && !this.jetIntroDone) {
        this.startJetIntro();
        continue;
      }
      this.spawn(k, p);
    }
    // PROJETO TUCANO NEGRO after surviving the red sky for a while
    if (!this.bossSpawned && alert >= 6 && this.maxAlertTime > BOSS.spawnDelayAtMaxAlert) this.spawn('boss', p);
  }

  private updateJetIntro(dt: number, p: PlayerSnapshot): void {
    if (this.jetIntroTimer < 0) return;
    const prev = this.jetIntroTimer;
    this.jetIntroTimer += dt;
    const t = this.jetIntroTimer;
    if (prev < 1.3 && t >= 1.3) this.hooks.onJetIntro('rumble');
    if (prev < 2.2 && t >= 2.2) {
      const j = new JetController(this.nextId++, this.assets);
      j.startFlyby(p.pos, Math.random() * Math.PI * 2, p.pos.y + 7 + p.radius);
      this.scene.add(j.shadowMesh);
      this.addEnemy(j);
      this.introJet = j;
    }
    const j = this.introJet;
    if (j && !this.jetIntroFlybyPlayed) {
      const d = Math.hypot(j.pos.x - p.pos.x, j.pos.z - p.pos.z);
      if (d < 110) {
        this.jetIntroFlybyPlayed = true;
        this.audio.jetFlyby(j.pos.x < p.pos.x);
      }
    }
    if (j && this.jetIntroFlybyPlayed && Math.hypot(j.pos.x - p.pos.x, j.pos.z - p.pos.z) < 30 + p.radius) {
      this.hooks.onJetIntro('flyby');
      this.jetIntroTimer = -1;
      this.jetIntroDone = true;
      this.introJet = null;
    }
    if (t > 12) {
      this.jetIntroTimer = -1;
      this.jetIntroDone = true;
    }
  }

  private updateHeliGrip(h: HelicopterController, p: PlayerSnapshot): void {
    if (h.grip < 0.3 || !h.alive) return;
    if (p.beamTier >= getObjectDef('helicoptero').tier) {
      // strong enough: rip it out of the sky
      h.wrecked = true;
      h.disabled = 1;
      return;
    }
    // tug of war: the beam tears it apart
    if (h.damage(22 * this.ctx.dt * h.grip)) h.wrecked = true;
    if (Math.random() < this.ctx.dt * 6) this.vfx.particles.chunks(h.pos, 1, 0x39424e, 0.3, 4, 0);
  }

  private updateBoss(b: BossController, p: PlayerSnapshot, _dt: number): void {
    if (b.droneWaveReady) {
      b.droneWaveReady = false;
      for (let i = 0; i < 3; i++) {
        const d = this.spawn('drone', p) as DroneController | null;
        if (d) d.pos.copy(b.pos).add(_v.set((i - 1) * 8, -3, 0));
      }
    }
    if (b.empFired) {
      b.empFired = false;
      this.vfx.empWave(b.pos, BOSS.empPulseRadius);
      this.audio.empBlast();
      if (b.pos.distanceTo(p.pos) < BOSS.empPulseRadius + p.radius) this.hooks.onBossEmp();
    }
  }

  /** Converts an enemy into a falling wreck that can be abducted mid-air. */
  private toWreck(e: Enemy, destroyed: boolean): void {
    const stats = ENEMIES[e.kind];
    if (destroyed) {
      this.vfx.explosion(e.pos, e.kind === 'boss' ? 6 : e.kind === 'jet' ? 3 : e.kind === 'helicopter' ? 2.5 : 1.2, this.world.groundAt(e.pos.x, e.pos.z));
      this.audio.explosion(e.kind === 'boss' ? 6 : 2, e.pos.x, e.pos.z);
    }
    if (e.kind === 'police') {
      // police cars don't fall: they stay as a disabled, abductable wreck proxy
      const proxy = this.policeProxies.get(e.id);
      if (proxy) {
        proxy.living = null;
        proxy.slot = 'none';
        proxy.tierOverride = stats.disabledTier;
        this.world.reattach(proxy);
        this.policeProxies.delete(e.id);
      }
    } else {
      const o = this.world.spawn(stats.objectId, e.pos.x, e.pos.y, e.pos.z, e.heading, { variant: 0 });
      o.enemyKind = e.kind;
      o.enemyId = e.id;
      o.tierOverride = stats.disabledTier;
      _v.copy(e.vel).multiplyScalar(e.kind === 'jet' ? 0.45 : 0.6);
      this.abduction.injectFalling(o, _v);
      this.wrecks.push(o);
    }
    if (e === this.boss) {
      this.bossDefeated = true;
      this.bus.emit('boss:defeated', {});
    }
    this.hooks.onEnemyDestroyed(e, e.killedBy === 'missile');
    e.alive = false;
    this.removeEnemy(e);
  }

  private removeEnemy(e: Enemy): void {
    if (e.locking) this.ctx.onLock(e, false);
    e.locking = false;
    e.dispose();
    const proxy = this.policeProxies.get(e.id);
    if (proxy && proxy.alive && proxy.slot === 'living') {
      this.world.kill(proxy);
    }
    this.policeProxies.delete(e.id);
    if (e === this.boss && !this.bossDefeated) this.boss = null;
  }

  private updateWrecks(): void {
    for (let i = this.wrecks.length - 1; i >= 0; i--) {
      const o = this.wrecks[i] as Abductable;
      if (!o.alive || o.state !== AState.Falling) {
        this.wrecks.splice(i, 1);
        continue;
      }
      if (o.enemyKind !== 'drone') this.vfx.smokeTrail(o.pos, true);
    }
  }

  // ───────────────────────────────────────────── anti-air turrets (static world objects)

  private updateAA(dt: number, p: PlayerSnapshot, alert: number): void {
    this.aaTimer -= dt;
    if (this.aaTimer > 0) return;
    this.aaTimer = 0.25;
    const inBase = this.world.districtAt(p.pos.x, p.pos.z) === 'B';
    if (alert < 2 && !inBase) return;
    this.world.query(p.pos.x, p.pos.z, 85, this.aaScratch);
    for (const o of this.aaScratch) {
      if (o.def.id !== 'antiaereo' || o.state !== AState.Static || !o.alive) continue;
      const cd = (this.aaCooldown.get(o.uid) ?? 0) - 0.25;
      this.aaCooldown.set(o.uid, cd);
      if (cd > 0) continue;
      this.aaCooldown.set(o.uid, 1.6 + Math.random());
      _v.set(o.pos.x, o.pos.y + 4.5, o.pos.z);
      for (let k = 0; k < 3; k++) {
        _v2.copy(p.pos).addScaledVector(p.vel, 0.6);
        _v2.x += (Math.random() - 0.5) * p.radius * 3;
        _v2.z += (Math.random() - 0.5) * p.radius * 3;
        _v2.sub(_v);
        this.bullets.fire(_v, _v2, 55, 3.2, -99, true);
      }
      this.audio.gunshot(o.pos.x, o.pos.z, true);
    }
  }

  // ───────────────────────────────────────────── projectiles

  private updateBullets(dt: number, p: PlayerSnapshot): void {
    const hitR = p.radius * 1.25;
    this.bullets.update(dt, p.pos, p.slowRadius, p.slowFactor, (b) => {
      if (b.reflected) {
        for (const e of this.enemies) {
          if (!e.alive || !e.flying) continue;
          if (b.pos.distanceToSquared(e.pos) < e.radius * e.radius) {
            if (e === this.boss) (e as BossController).hit(0, 'debris');
            else if (e.damage(b.damage * (p.mirror ? 4 : 2))) {
              e.wrecked = true;
              e.killedBy = 'reflect';
            }
            this.vfx.particles.burst(b.pos, { count: 6, color: 0x6ff4ff, speed: 4, life: 0.3, size: 0.4 });
            return true;
          }
        }
        if (p.mirror) {
          // ESPELHO QUÂNTICO: reflected shots seek the nearest enemy
          let best: Enemy | null = null;
          let bd = 90 * 90;
          for (const e of this.enemies) {
            if (!e.alive || !e.flying) continue;
            const d = b.pos.distanceToSquared(e.pos);
            if (d < bd) {
              bd = d;
              best = e;
            }
          }
          if (best) {
            const speed = b.vel.length();
            _v.copy(best.pos).sub(b.pos).normalize().multiplyScalar(speed);
            b.vel.lerp(_v, Math.min(1, dt * 6));
          }
        }
        return false;
      }
      if (b.flak) {
        // flak bursts near the saucer
        if (b.pos.distanceToSquared(p.pos) < (hitR * 2.2) ** 2 || b.life < 0.1) {
          this.vfx.particles.burst(b.pos, { count: 10, color: 0xffa050, colorVar: 0x444444, speed: 5, life: 0.35, size: 1.2, sizeEnd: 0.2 });
          this.vfx.particles.puff(b.pos, { count: 3, color: 0x2f2f33, speed: 1, life: 1.2, size: 1.5, sizeEnd: 3, alpha: 0.6 });
          if (b.pos.distanceToSquared(p.pos) < (hitR * 2.2) ** 2) this.hooks.onPlayerHit(b.damage, b.pos, false, null);
          return true;
        }
        return false;
      }
      if (b.pos.distanceToSquared(p.pos) < hitR * hitR) {
        if (p.dashing) return false;
        const reflect = Math.random() < p.reflectChance;
        const consumed = this.hooks.onPlayerHit(b.damage, b.pos, reflect, b);
        if (reflect) {
          // RAIO REFLETOR: send it back to its owner
          const owner = this.enemies.find((e) => e.id === b.ownerId);
          const speed = b.vel.length();
          if (owner) b.vel.copy(owner.pos).sub(b.pos).normalize().multiplyScalar(speed * 1.2);
          else b.vel.multiplyScalar(-1);
          b.reflected = true;
          b.life = 2;
          return false;
        }
        return consumed;
      }
      // buildings stop bullets
      if (b.pos.y < this.world.heightField.heightAt(b.pos.x, b.pos.z)) return true;
      return false;
    });
  }

  private updateMissiles(dt: number, p: PlayerSnapshot): void {
    for (const m of this.missiles.missiles) {
      if (!m.active) continue;
      // retarget redirected missiles (hit by EMP-free reflection)
      let target = p.pos;
      if (m.targetEnemyId >= 0) {
        const te = this.enemies.find((e) => e.id === m.targetEnemyId && e.alive);
        if (te) target = te.pos;
        else m.targetEnemyId = -1;
      }
      this.missiles.steer(m, target, dt, p.slowFactor > 0 && m.pos.distanceTo(p.pos) < p.slowRadius ? 1 - p.slowFactor : 1);
      const slow = p.slowFactor > 0 && m.pos.distanceTo(p.pos) < p.slowRadius ? 1 - p.slowFactor : 1;
      this.missiles.integrate(m, dt * slow);
      m.trailTimer -= dt;
      if (m.trailTimer <= 0) {
        m.trailTimer = 0.03;
        this.vfx.missileTrail(m.pos);
      }
      if (this.checkMissile(m, p)) continue;
      if (m.life <= 0) this.explodeMissile(m, false);
    }
  }

  private checkMissile(m: Missile, p: PlayerSnapshot): boolean {
    const ground = this.world.groundAt(m.pos.x, m.pos.z);
    const roof = this.world.heightField.heightAt(m.pos.x, m.pos.z);
    if (m.pos.y <= ground + 0.3) {
      this.explodeMissile(m, false);
      return true;
    }
    if (m.pos.y < roof) {
      // the emergent moment: the missile slams into a building instead of you
      this.hooks.onBuildingHit(m.pos);
      this.explodeMissile(m, false);
      return true;
    }
    const armed = m.age > MISSILE.armTime;
    // enemies (proximity fuse) — missiles don't care whose aircraft it is
    if (armed) {
      for (const e of this.enemies) {
        if (!e.alive || !e.flying) continue;
        if (e.id === m.ownerId && m.age < 1.5 && m.targetEnemyId < 0) continue;
        if (m.pos.distanceToSquared(e.pos) < (e.radius + MISSILE.proximityFuse * 0.5) ** 2) {
          if (e === this.boss) {
            if ((e as BossController).hit(0, 'missile')) e.wrecked = true;
          } else if (e.damage(999)) e.wrecked = true;
          if (e.wrecked) e.killedBy = 'missile';
          this.explodeMissile(m, false);
          return true;
        }
      }
    }
    if (m.disabled) return false;
    const d = m.pos.distanceTo(p.pos);
    const hitR = p.radius * 1.2 + MISSILE.hitRadius;
    if (d < hitR && armed && m.targetEnemyId < 0) {
      if (p.dashing) return false;
      this.hooks.onPlayerHit(m.damage, m.pos, false, null);
      this.explodeMissile(m, true);
      return true;
    }
    // PERFECT DODGE: it passed really close and is now moving away
    if (m.targetEnemyId < 0) {
      if (d < m.closest) m.closest = d;
      else if (m.dodgeArmed && m.closest < hitR + 5 + p.radius && d > m.closest + 2) {
        m.dodgeArmed = false;
        this.hooks.onPerfectDodge(m.pos);
      }
    }
    return false;
  }

  private explodeMissile(m: Missile, hitPlayer: boolean): void {
    this.vfx.explosion(m.pos, 1.6, this.world.groundAt(m.pos.x, m.pos.z));
    this.audio.explosion(1.6, m.pos.x, m.pos.z);
    this.bus.emit('missile:explode', { position: m.pos, hitPlayer });
    this.missiles.kill(m);
  }

  // ───────────────────────────────────────────── EMP

  /** Returns how many hostiles were affected. */
  applyEMP(center: Vector3, radius: number): number {
    let n = 0;
    const r2 = radius * radius;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.pos.distanceToSquared(center) > (radius + e.radius) ** 2) continue;
      if (e === this.boss) (e as BossController).hit(0, 'emp');
      else e.emp(e.kind === 'police' ? 5 : 3);
      n++;
    }
    for (const m of this.missiles.missiles) {
      if (m.active && !m.disabled && m.pos.distanceToSquared(center) < r2) {
        m.disabled = true;
        n++;
      }
    }
    n += Math.min(5, this.bullets.clearWithin(center, radius));
    return n;
  }

  /** Redirect nearest missile to nearest enemy (used by perfect dodge + mirror synergy). */
  redirectMissile(m: Missile): void {
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || !e.flying) continue;
      const d = m.pos.distanceToSquared(e.pos);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (best) m.targetEnemyId = best.id;
  }

  /** Missiles currently threatening the player (for HUD indicators). */
  incomingMissiles(p: Vector3, out: Missile[]): Missile[] {
    out.length = 0;
    for (const m of this.missiles.missiles) if (m.active && !m.disabled && m.targetEnemyId < 0 && m.pos.distanceTo(p) < 170) out.push(m);
    return out;
  }

  get activeCount(): number {
    return this.enemies.length;
  }
}
