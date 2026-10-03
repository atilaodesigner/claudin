import { Color, Quaternion, Vector3 } from 'three';
import { BALANCE } from '../config/gameBalance';
import { RARITY_INFO } from '../config/objects';
import type { EventBus } from '../core/EventBus';
import type { ParticleManager } from '../effects/ParticleManager';
import { easeInCubic } from '../utils/easing';
import { clamp, TAU } from '../utils/math';
import { noise1 } from '../utils/noise';
import { Abductable, AState } from '../world/Abductable';
import type { World } from '../world/World';
import type { DynamicObjectPool } from './DynamicObjectPool';

export interface AbductionContext {
  ufoPos: Vector3;
  ufoVel: Vector3;
  ufoRadius: number;
  beamRadius: number;
  beamTier: number;
  capacity: number;
  absorbSpeed: number;
  satellites: number;
  satRadius: number;
  satPositions: readonly Vector3[];
  pullRadius: number;
  pullStrength: number;
  orbitMode: boolean;
  orbitTime: number;
  beamActive: boolean;
  frenzy: boolean;
}

interface Zone {
  x: number;
  z: number;
  r: number;
}

const _v = new Vector3();
const _v2 = new Vector3();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _axis = new Vector3();
const _pv = new Vector3();
const _c = new Color();
const UP = new Vector3(0, 1, 0);

/**
 * The heart of the game. Fake physics state machine that makes every object feel
 * physically captured: vibrate → lose grip → lift → spiral → accelerate → orbit →
 * shrink into the hatch → burst. Heavy objects lag, resist and fight back.
 */
export class AbductionSystem {
  readonly active: Abductable[] = [];
  private readonly candidates: Abductable[] = [];
  private readonly zones: Zone[] = [];
  /** 0..1 how busy the beam is (drives audio/visual energy). */
  load = 0;
  /** Strongest resistance this frame (0..1) for audio/HUD. */
  strainLevel = 0;
  strainTarget: Abductable | null = null;
  liftingCount = 0;
  orbitingCount = 0;
  /** Lowest altitude the saucer may hover at so held objects never clip into it. */
  minUfoAltitude = 0;
  private time = 0;
  private dustTimer = 0;
  private anticipateCount = 0;
  onAbsorbed: ((obj: Abductable) => void) | null = null;
  onCaptureStart: ((obj: Abductable) => void) | null = null;
  private readonly rimColor = new Color(0x5dffa0);

  constructor(
    private readonly world: World,
    private readonly pool: DynamicObjectPool,
    private readonly particles: ParticleManager,
    private readonly bus: EventBus,
  ) {}

  setRimColor(hex: number): void {
    this.rimColor.setHex(hex);
  }

  reset(): void {
    for (const o of this.active) {
      if (o.dynamicIndex >= 0) this.pool.release(o.dynamicIndex);
      o.dynamicIndex = -1;
    }
    this.active.length = 0;
    this.load = 0;
    this.strainLevel = 0;
    this.strainTarget = null;
  }

  // ───────────────────────────────────────────── activation helpers

  private activate(o: Abductable): boolean {
    if (o.dynamicIndex >= 0) return true;
    this.world.detach(o);
    const idx = this.pool.acquire(o.model.geometry, o.paint);
    o.dynamicIndex = idx;
    // crowd characters keep being drawn (and animated) by the crowd renderer
    if (o.crowd >= 0) this.pool.get(idx).mesh.visible = false;
    o.pos.copy(o.home);
    o.quat.setFromAxisAngle(UP, o.homeRotY);
    o.vel.set(0, 0, 0);
    o.angVel.set(0, 0, 0);
    o.visualScale = o.scale;
    o.strain = 0;
    o.anticipation = 0;
    this.active.push(o);
    this.syncMesh(o);
    return true;
  }

  private deactivate(o: Abductable, reattach: boolean): void {
    if (o.dynamicIndex >= 0) this.pool.release(o.dynamicIndex);
    o.dynamicIndex = -1;
    const i = this.active.indexOf(o);
    if (i >= 0) {
      this.active[i] = this.active[this.active.length - 1] as Abductable;
      this.active.pop();
    }
    if (reattach && o.alive) {
      o.pos.y = o.home.y;
      this.world.reattach(o);
    }
  }

  /**
   * Meme close-up (MemeHunt): other carried things crossing the line from the lens to the face are
   * hidden for the shot, so a flying palm tree never fills the frame.
   */
  cineClear: { from: Vector3; to: Vector3; keep: Abductable } | null = null;
  private readonly cineHidden = new Set<Abductable>();

  private cineBlocks(o: Abductable, x: number, y: number, z: number): boolean {
    const c = this.cineClear;
    if (!c || o === c.keep) return false;
    const ax = c.to.x - c.from.x;
    const ay = c.to.y - c.from.y;
    const az = c.to.z - c.from.z;
    const len2 = ax * ax + ay * ay + az * az || 1;
    const t = ((x - c.from.x) * ax + (y - c.from.y) * ay + (z - c.from.z) * az) / len2;
    // in front of the face, or right behind it (crowding the subject)
    if (t < -0.15 || t > 1.6) return false;
    const k = clamp(t, 0, 1.6);
    const dx = x - (c.from.x + ax * k);
    const dy = y - (c.from.y + ay * k);
    const dz = z - (c.from.z + az * k);
    // bounding sphere of the whole thing (a tumbling lamp post reaches far from its centre)
    const half = o.model.height * 0.5;
    const r = Math.hypot(o.model.radius, half) * o.visualScale * 0.85 + 0.5;
    return dx * dx + dy * dy + dz * dz < r * r;
  }

  private syncMesh(o: Abductable): void {
    if (o.dynamicIndex < 0) return;
    const dm = this.pool.get(o.dynamicIndex);
    // only touch what this hid (crowd characters keep their pool mesh hidden on their own)
    if (this.cineClear || this.cineHidden.has(o)) {
      const hide = this.cineBlocks(o, o.pos.x, o.pos.y + o.model.height * 0.5 * o.visualScale, o.pos.z);
      if (hide && dm.mesh.visible) {
        this.cineHidden.add(o);
        dm.mesh.visible = false;
      } else if (!hide && this.cineHidden.delete(o)) dm.mesh.visible = true;
    }
    // o.pos is the base pivot; spin around the object's center so tall things tumble naturally
    const hc = o.model.height * 0.5 * o.visualScale;
    _pv.set(0, hc, 0).applyQuaternion(o.quat);
    dm.mesh.position.set(o.pos.x, o.pos.y + hc, o.pos.z).sub(_pv);
    dm.mesh.quaternion.copy(o.quat);
    if (o.state !== AState.Straining) dm.mesh.scale.setScalar(o.visualScale);
  }

  /** External objects (enemy wrecks) join the simulation already detached and falling. */
  injectFalling(o: Abductable, vel: Vector3): void {
    this.activate(o);
    o.vel.copy(vel);
    o.angVel.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3);
    o.setState(AState.Falling, 999);
  }

  // ───────────────────────────────────────────── main update

  update(dt: number, ctx: AbductionContext): void {
    this.time += dt;
    this.strainLevel = 0;
    this.strainTarget = null;
    this.buildZones(ctx);

    let capacityUsed = 0;
    this.anticipateCount = 0;
    this.liftingCount = 0;
    this.orbitingCount = 0;
    for (const o of this.active) {
      if (o.state === AState.Shaking || o.state === AState.Lifting) capacityUsed++;
      if (o.state === AState.Anticipate) this.anticipateCount++;
      if (o.state === AState.Orbiting) this.orbitingCount++;
    }

    // ── scan the area around the UFO for new interactions
    if (ctx.beamActive) {
      const scanR = Math.max(ctx.beamRadius * BALANCE.beam.anticipationRing, ctx.pullRadius) + (ctx.satellites > 0 ? ctx.beamRadius + ctx.satRadius * 2.4 : 0);
      this.world.query(ctx.ufoPos.x, ctx.ufoPos.z, scanR, this.candidates);
      // nearest first so the closest things react first
      const ux = ctx.ufoPos.x;
      const uz = ctx.ufoPos.z;
      this.candidates.sort((a, b) => (a.pos.x - ux) ** 2 + (a.pos.z - uz) ** 2 - ((b.pos.x - ux) ** 2 + (b.pos.z - uz) ** 2));
      const liftable = Math.floor(ctx.beamTier + 1e-4);
      let strainAssigned = 0;
      for (const o of this.candidates) {
        if (!o.alive) continue;
        if (o.state !== AState.Static && o.state !== AState.Anticipate && o.state !== AState.Settling && o.state !== AState.Straining) continue;
        const zoneIdx = this.zoneOf(o);
        const tierOk = o.tier <= liftable;
        if (zoneIdx >= 0) {
          if (tierOk) {
            if (capacityUsed < ctx.capacity) {
              this.activate(o);
              o.beamIndex = zoneIdx;
              this.startShaking(o, ctx);
              capacityUsed++;
            } else if (o.state !== AState.Anticipate && this.anticipateCount < BALANCE.beam.maxAnticipating) {
              this.activate(o);
              o.setState(AState.Anticipate, 999);
              this.anticipateCount++;
            }
          } else if (strainAssigned < 3 && o.tier - ctx.beamTier < 3.5) {
            if (o.state !== AState.Straining) {
              this.activate(o);
              o.setState(AState.Straining, 999);
            }
            o.anticipation = 1;
            strainAssigned++;
          }
        } else {
          // outside the beam: light objects react (anticipation) or get dragged by BURACO NEGRO
          const d = Math.hypot(o.pos.x - ux, o.pos.z - uz);
          const inPull = ctx.pullRadius > 0 && d <= ctx.pullRadius && tierOk;
          const nearRing = d <= ctx.beamRadius * BALANCE.beam.anticipationRing && o.tier <= liftable && o.tier <= Math.max(1, liftable - 2);
          if ((inPull || nearRing) && o.state === AState.Static && this.anticipateCount < BALANCE.beam.maxAnticipating) {
            this.activate(o);
            o.setState(AState.Anticipate, 999);
            this.anticipateCount++;
          }
        }
      }
    }

    // ── simulate
    let loadSum = 0;
    let minAlt = 0;
    const clearance = BALANCE.ufo.clearance * (ctx.ufoRadius / BALANCE.ufo.baseRadius);
    for (let i = this.active.length - 1; i >= 0; i--) {
      const o = this.active[i] as Abductable;
      o.stateTime += dt;
      switch (o.state) {
        case AState.Anticipate:
          this.updateAnticipate(o, dt, ctx);
          break;
        case AState.Shaking:
          this.updateShaking(o, dt, ctx);
          loadSum += 0.6;
          break;
        case AState.Straining:
          this.updateStraining(o, dt, ctx);
          break;
        case AState.Lifting:
          this.updateLifting(o, dt, ctx);
          loadSum += 1;
          break;
        case AState.Orbiting:
          this.updateOrbiting(o, dt, ctx);
          loadSum += 0.5;
          break;
        case AState.Sucking:
          this.updateSucking(o, dt, ctx);
          loadSum += 1;
          break;
        case AState.Carried:
          this.updateCarried(o);
          break;
        case AState.Falling:
          this.updateFalling(o, dt, ctx);
          break;
        case AState.Settling:
          this.updateSettling(o, dt);
          break;
        default:
          break;
      }
      // keep the ship above whatever it is ripping out of the ground
      if (o.state === AState.Shaking || o.state === AState.Straining) {
        minAlt = Math.max(minAlt, o.home.y + o.model.height * o.scale + clearance + ctx.ufoRadius * 0.4);
      } else if (o.state === AState.Lifting) {
        // hold the altitude the ship had when the lift began: the object rises to it
        minAlt = Math.max(minAlt, o.liftHeight, o.startY + o.model.height * o.visualScale + ctx.ufoRadius * 0.45 + 1.2);
      }
      if (o.dynamicIndex >= 0) {
        const dm = this.pool.get(o.dynamicIndex);
        o.flash = Math.max(0, o.flash - dt * 3);
        dm.fx.uFlash.value.setRGB(o.flash * 0.9, o.flash, o.flash * 0.9);
        this.syncMesh(o);
      }
    }
    this.load = clamp(loadSum / Math.max(3, ctx.capacity), 0, 1.5);
    this.minUfoAltitude = minAlt;
  }

  private buildZones(ctx: AbductionContext): void {
    this.zones.length = 0;
    this.zones.push({ x: ctx.ufoPos.x, z: ctx.ufoPos.z, r: ctx.beamRadius });
    for (let i = 0; i < ctx.satellites; i++) {
      const p = ctx.satPositions[i];
      if (p) this.zones.push({ x: p.x, z: p.z, r: ctx.satRadius });
    }
  }

  private zoneOf(o: Abductable): number {
    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i] as Zone;
      const dx = o.pos.x - z.x;
      const dz = o.pos.z - z.z;
      const r = z.r + o.model.radius * o.scale * 0.35;
      if (dx * dx + dz * dz <= r * r) return i;
    }
    return -1;
  }

  private speedFactor(o: Abductable, ctx: AbductionContext): number {
    return ctx.absorbSpeed * clamp(0.62 + 0.5 * (ctx.beamTier - o.tier), 0.62, 2.2);
  }

  private startShaking(o: Abductable, ctx: AbductionContext): void {
    const B = BALANCE.beam;
    // rooftop parts ripped off on their own stop belonging to the building
    if (o.parent) {
      const siblings = o.parent.children;
      const i = siblings.indexOf(o);
      if (i >= 0) siblings.splice(i, 1);
      o.parent = null;
    }
    const dur = (B.breakBaseTime + o.tier * B.breakTimePerTier) / this.speedFactor(o, ctx);
    o.setState(AState.Shaking, dur);
    o.flash = 0.6;
    const dm = this.pool.get(o.dynamicIndex);
    dm.fx.uRimColor.value.copy(o.rarity !== 'normal' ? _c.setHex(RARITY_INFO[o.rarity].color) : this.rimColor);
    // tiny dust puff at the base as it loses grip
    _v.set(o.pos.x, o.home.y + 0.1, o.pos.z);
    const size = Math.max(0.5, o.model.radius * o.scale);
    this.particles.puff(_v, { count: 4 + Math.min(20, o.tier * 3), color: 0xd8cbb0, colorVar: 0xa89a80, speed: 1.2 + size * 0.5, dir: UP, spread: 0.9, life: 0.9, size: size * 0.9, sizeEnd: size * 2, drag: 2.5, radius: size * 0.7, alpha: 0.55 });
  }

  private beginLift(o: Abductable, ctx: AbductionContext): void {
    const B = BALANCE.beam;
    const zone = this.zones[o.beamIndex] ?? this.zones[0]!;
    const dx = o.pos.x - zone.x;
    const dz = o.pos.z - zone.z;
    o.orbitRadius = Math.hypot(dx, dz);
    o.orbitAngle = Math.atan2(dz, dx);
    o.orbitSpeed = (1.3 + o.seed * 1.2) * (o.seed > 0.5 ? 1 : -1) / (1 + o.tier * 0.12);
    o.startY = o.pos.y;
    o.liftHeight = o.model.height * o.scale > 6 ? ctx.ufoPos.y : 0;
    const dur = (B.liftBaseTime + o.tier * B.liftTimePerTier) / this.speedFactor(o, ctx);
    o.setState(AState.Lifting, dur);
    const tumble = 1.7 / (1 + o.tier * 0.4);
    o.angVel.set((o.seed - 0.5) * tumble, (noise1(o.seed * 50) + 0.4) * tumble * 1.5, (0.5 - o.seed * 0.7) * tumble);
    o.flash = 0.8;
    // children (roof, water tank, people on the slab) ride along
    for (const child of o.children) {
      if (!child.alive || child.state === AState.Carried || child.isCaptured) continue;
      this.activate(child);
      this.captureChild(child, o);
    }
    this.onCaptureStart?.(o);
    this.bus.emit('object:abduct:start', {
      uid: o.uid,
      defId: o.def.id,
      tier: o.tier,
      massKg: o.def.massKg,
      rarity: o.rarity,
      position: o.pos,
      isEnemy: o.enemyKind !== null,
      enemyKind: o.enemyKind ?? undefined,
    });
  }

  private captureChild(child: Abductable, parent: Abductable): void {
    // store offset in parent's local space
    _q.copy(parent.quat).invert();
    child.localOffset.copy(child.pos).sub(parent.pos).applyQuaternion(_q);
    child.setState(AState.Carried, 999);
    for (const g of child.children) {
      if (!g.alive) continue;
      this.activate(g);
      this.captureChild(g, child);
    }
  }

  // ───────────────────────────────────────────── states

  private updateAnticipate(o: Abductable, dt: number, ctx: AbductionContext): void {
    const zoneIdx = ctx.beamActive ? this.zoneOf(o) : -1;
    const d = Math.hypot(o.pos.x - ctx.ufoPos.x, o.pos.z - ctx.ufoPos.z);
    const ring = ctx.beamRadius * BALANCE.beam.anticipationRing;
    const influence = zoneIdx >= 0 ? 1 : Math.max(clamp(1 - (d - ctx.beamRadius) / Math.max(0.1, ring - ctx.beamRadius), 0, 1), ctx.pullRadius > 0 && d < ctx.pullRadius ? 0.4 : 0);
    o.anticipation += (influence - o.anticipation) * Math.min(1, dt * 6);
    if (!ctx.beamActive || (influence <= 0.01 && o.anticipation < 0.05)) {
      this.startSettling(o);
      return;
    }
    // BURACO NEGRO: drift toward the beam
    if (ctx.pullStrength > 0 && d > ctx.beamRadius * 0.6 && d < ctx.pullRadius) {
      const k = (ctx.pullStrength * (1 + ctx.beamTier - o.tier) * dt) / Math.max(1, d);
      o.home.x += (ctx.ufoPos.x - o.home.x) * Math.min(0.2, k);
      o.home.z += (ctx.ufoPos.z - o.home.z) * Math.min(0.2, k);
    }
    const a = o.anticipation;
    const size = o.model.radius * o.scale;
    const hop = Math.abs(Math.sin(this.time * (9 + o.seed * 6) + o.seed * 20)) * 0.12 * a * Math.min(1.5, 0.4 + size);
    o.pos.set(o.home.x + noise1(this.time * 7 + o.seed * 90) * 0.05 * a, o.home.y + hop, o.home.z + noise1(this.time * 7 + o.seed * 40) * 0.05 * a);
    _q.setFromAxisAngle(UP, o.homeRotY);
    _axis.set(noise1(this.time * 5 + o.seed * 11), 0, noise1(this.time * 5 + o.seed * 23));
    _q2.setFromAxisAngle(_axis.lengthSq() > 0 ? _axis.normalize() : UP, 0.12 * a);
    o.quat.copy(_q2).multiply(_q);
    if (Math.random() < a * dt * 2.5) {
      _v.set(o.pos.x, o.pos.y + 0.1, o.pos.z);
      this.particles.single(true, _v.x, _v.y, _v.z, 0, 2.5 + Math.random() * 2, 0, this.rimColor, 0.7, 0.25, 0.05, 0, 0.5, 0.7);
    }
  }

  private updateShaking(o: Abductable, dt: number, ctx: AbductionContext): void {
    o.progress = Math.min(1, o.stateTime / o.phaseDuration);
    const p = o.progress;
    const size = Math.max(0.3, o.model.radius * o.scale);
    const amp = (0.02 + p * 0.1) * Math.min(2.5, size);
    const t = this.time * (30 + o.seed * 10);
    o.pos.set(o.home.x + noise1(t) * amp, o.home.y + p * p * Math.min(0.5, o.model.height * 0.08) + Math.abs(noise1(t + 50)) * amp * 0.5, o.home.z + noise1(t + 100) * amp);
    _q.setFromAxisAngle(UP, o.homeRotY);
    _axis.set(noise1(t * 0.7 + 3), 0, noise1(t * 0.7 + 9));
    _q2.setFromAxisAngle(_axis.lengthSq() > 0 ? _axis.normalize() : UP, 0.05 * p);
    o.quat.copy(_q2).multiply(_q);
    o.visualScale = o.scale * (1 + Math.sin(t * 0.8) * 0.02 * p);
    if (o.dynamicIndex >= 0) this.pool.get(o.dynamicIndex).fx.uRim.value = p * 0.8;
    // dust at the base while it breaks free (bigger objects kick more)
    this.dustTimer += dt;
    if (o.tier >= 2 && Math.random() < dt * (4 + o.tier * 2)) {
      _v.set(o.pos.x + (Math.random() - 0.5) * size, o.home.y + 0.1, o.pos.z + (Math.random() - 0.5) * size);
      this.particles.puff(_v, { count: 2, color: 0xcfc2a5, speed: 1 + size * 0.3, dir: UP, spread: 1, life: 0.8, size: size * 0.6, sizeEnd: size * 1.5, drag: 3, alpha: 0.45 });
    }
    if (!ctx.beamActive) {
      this.startSettling(o);
      return;
    }
    if (p >= 1) this.beginLift(o, ctx);
  }

  private updateStraining(o: Abductable, dt: number, ctx: AbductionContext): void {
    const inBeam = ctx.beamActive && this.zoneOf(o) >= 0;
    const gap = o.tier - ctx.beamTier;
    const s = clamp(1 - gap / 3, 0.15, 1);
    o.strain += ((inBeam ? s : 0) - o.strain) * Math.min(1, dt * (inBeam ? 5 : 3));
    if (!inBeam && o.strain < 0.05) {
      this.startSettling(o);
      return;
    }
    const st = o.strain;
    const size = Math.max(0.5, o.model.radius * o.scale);
    const t = this.time * (24 + o.seed * 8);
    const lift = st * Math.min(0.45, 0.08 + size * 0.03) * (0.6 + 0.4 * Math.sin(this.time * 3.1 + o.seed * 7));
    o.pos.set(o.home.x + noise1(t) * 0.05 * st * Math.min(3, size), o.home.y + lift, o.home.z + noise1(t + 70) * 0.05 * st * Math.min(3, size));
    _q.setFromAxisAngle(UP, o.homeRotY);
    _axis.set(noise1(t * 0.3 + 5), 0, noise1(t * 0.3 + 15));
    _q2.setFromAxisAngle(_axis.lengthSq() > 0 ? _axis.normalize() : UP, 0.035 * st);
    o.quat.copy(_q2).multiply(_q);
    // squash & stretch deformation
    o.visualScale = o.scale * (1 + Math.sin(this.time * 19 + o.seed) * 0.018 * st);
    if (o.dynamicIndex >= 0) {
      const dm = this.pool.get(o.dynamicIndex);
      dm.fx.uRim.value = st * (0.5 + 0.5 * Math.sin(this.time * 14));
      dm.fx.uRimColor.value.setRGB(1.0, 0.45, 0.2);
      dm.mesh.scale.set(o.visualScale * (1 - 0.01 * st), o.visualScale * (1 + 0.025 * st * Math.sin(this.time * 17)), o.visualScale * (1 - 0.01 * st));
    }
    // chips, dust and cracks feeling
    if (inBeam && Math.random() < dt * (3 + 10 * st)) {
      _v.set(o.pos.x + (Math.random() - 0.5) * size * 1.4, o.home.y + Math.random() * Math.min(4, o.model.height * 0.5), o.pos.z + (Math.random() - 0.5) * size * 1.4);
      this.particles.chunks(_v, 2, 0x9a8f80, 0.12 + Math.min(0.35, size * 0.03), 3, o.home.y);
    }
    if (inBeam && Math.random() < dt * 6 * st) {
      _v.set(o.pos.x + (Math.random() - 0.5) * size * 1.5, o.home.y + 0.2, o.pos.z + (Math.random() - 0.5) * size * 1.5);
      this.particles.puff(_v, { count: 2, color: 0xcbbd9e, speed: 1.5, dir: UP, spread: 0.8, life: 1, size: size * 0.5, sizeEnd: size * 1.3, drag: 2, alpha: 0.4 });
    }
    if (inBeam && st > this.strainLevel) {
      this.strainLevel = st;
      this.strainTarget = o;
    }
  }

  private updateLifting(o: Abductable, dt: number, ctx: AbductionContext): void {
    if (!ctx.beamActive) {
      this.drop(o);
      return;
    }
    o.progress = Math.min(1, o.stateTime / o.phaseDuration);
    const p = o.progress;
    const main = this.zones[0]!;
    const zone = this.zones[o.beamIndex] ?? main;
    // satellite captures drift toward the main beam while rising
    const cx = zone.x + (main.x - zone.x) * p;
    const cz = zone.z + (main.z - zone.z) * p;
    const shrink = o.tier >= 7 ? 0.45 : o.tier >= 5 ? 0.3 : 0.18;
    const hangH = o.model.height * o.scale * (1 - shrink * p);
    // the whole object hangs below the hatch (tall buildings never clip through the saucer)
    const topY = ctx.ufoPos.y - ctx.ufoRadius * 0.4 - hangH - 0.2;
    const h = Math.pow(p, 1.6);
    o.orbitAngle += o.orbitSpeed * (1 + p * 3.2) * dt;
    const r = o.orbitRadius * (1 - easeInCubic(Math.min(1, p * 1.15))) * 0.9 + Math.sin(this.time * 2 + o.seed * 9) * 0.12 * (1 - p) * ctx.beamRadius * 0.2;
    _v.set(cx + Math.cos(o.orbitAngle) * r, o.startY + (topY - o.startY) * h, cz + Math.sin(o.orbitAngle) * r);
    _v.x += noise1(this.time * 1.7 + o.seed * 30) * 0.2 * (1 - p);
    _v.z += noise1(this.time * 1.7 + o.seed * 60) * 0.2 * (1 - p);
    // spring toward the target: heavy things lag behind the ship (weight!)
    const k = 60 / (1 + o.tier * 0.45);
    const damping = 2 * Math.sqrt(k) * 0.9;
    _v2.copy(_v).sub(o.pos).multiplyScalar(k).addScaledVector(o.vel, -damping);
    o.vel.addScaledVector(_v2, dt);
    o.pos.addScaledVector(o.vel, dt);
    // tumble accelerates
    this.integrateSpin(o, dt, 1 + p * 2.2);
    o.visualScale = o.scale * (1 - shrink * p);
    if (o.dynamicIndex >= 0) this.pool.get(o.dynamicIndex).fx.uRim.value = 0.6 + p * 0.9;
    // energy sparkles streaming off
    if (Math.random() < dt * (6 + o.tier)) {
      this.particles.single(true, o.pos.x, o.pos.y, o.pos.z, (Math.random() - 0.5) * 2, 2 + Math.random() * 3, (Math.random() - 0.5) * 2, this.rimColor, 0.6, 0.3 + o.tier * 0.05, 0.02, 0, 1, 0.8);
    }
    if (p >= 1) {
      if (ctx.orbitMode) {
        o.orbitAngle = Math.atan2(o.pos.z - ctx.ufoPos.z, o.pos.x - ctx.ufoPos.x);
        o.orbitRadius = ctx.ufoRadius * (1.25 + (this.orbitingCount % 4) * 0.28) + o.model.radius * o.scale * 0.6;
        o.orbitSpeed = (2.6 + o.seed) / Math.sqrt(1 + ctx.ufoRadius * 0.1);
        o.setState(AState.Orbiting, ctx.orbitTime * (0.7 + o.seed * 0.6));
        this.orbitingCount++;
      } else {
        o.setState(AState.Sucking, (BALANCE.beam.suckTime + o.tier * 0.035) / Math.max(0.5, ctx.absorbSpeed));
        o.startY = o.pos.y;
        o.localOffset.copy(o.pos);
      }
    }
  }

  private updateOrbiting(o: Abductable, dt: number, ctx: AbductionContext): void {
    o.progress = Math.min(1, o.stateTime / o.phaseDuration);
    o.orbitAngle += o.orbitSpeed * dt;
    const y = ctx.ufoPos.y + Math.sin(o.orbitAngle * 2 + o.seed * 10) * ctx.ufoRadius * 0.25;
    _v.set(ctx.ufoPos.x + Math.cos(o.orbitAngle) * o.orbitRadius, y, ctx.ufoPos.z + Math.sin(o.orbitAngle) * o.orbitRadius);
    const k = 40;
    _v2.copy(_v).sub(o.pos).multiplyScalar(k).addScaledVector(o.vel, -2 * Math.sqrt(k));
    o.vel.addScaledVector(_v2, dt);
    o.pos.addScaledVector(o.vel, dt);
    this.integrateSpin(o, dt, 2.5);
    o.visualScale = o.scale * 0.82;
    if (o.progress >= 1 || !ctx.beamActive) {
      if (!ctx.beamActive) {
        this.drop(o);
        return;
      }
      o.setState(AState.Sucking, BALANCE.beam.suckTime / Math.max(0.5, ctx.absorbSpeed));
      o.startY = o.pos.y;
      o.localOffset.copy(o.pos);
    }
  }

  private updateSucking(o: Abductable, _dt: number, ctx: AbductionContext): void {
    o.progress = Math.min(1, o.stateTime / o.phaseDuration);
    const p = easeInCubic(o.progress);
    const tx = ctx.ufoPos.x;
    const ty = ctx.ufoPos.y - ctx.ufoRadius * 0.2;
    const tz = ctx.ufoPos.z;
    // localOffset holds the start position of the suck
    o.pos.set(o.localOffset.x + (tx - o.localOffset.x) * p, o.localOffset.y + (ty - o.localOffset.y) * p, o.localOffset.z + (tz - o.localOffset.z) * p);
    this.integrateSpin(o, _dt, 4);
    o.visualScale = o.scale * 0.82 * (1 - p * 0.95);
    o.flash = Math.max(o.flash, p);
    if (o.dynamicIndex >= 0) this.pool.get(o.dynamicIndex).fx.uRim.value = 1.5 + p * 2;
    if (o.progress >= 1) this.absorb(o, ctx);
  }

  private updateCarried(o: Abductable): void {
    const parent = o.parent;
    if (!parent || !parent.alive || parent.dynamicIndex < 0) {
      // parent vanished (absorbed): the child follows it into the ship
      o.setState(AState.Sucking, 0.18);
      o.localOffset.copy(o.pos);
      return;
    }
    if (parent.state === AState.Falling || parent.state === AState.Settling) {
      o.parent = null;
      o.setState(AState.Falling, 999);
      o.vel.copy(parent.vel);
      return;
    }
    const k = parent.visualScale / Math.max(0.001, parent.scale);
    const hc = parent.model.height * 0.5 * parent.visualScale;
    _v.copy(o.localOffset).multiplyScalar(k);
    _v.y -= hc;
    _v.applyQuaternion(parent.quat);
    o.pos.copy(parent.pos).add(_v);
    o.pos.y += hc;
    o.quat.copy(parent.quat).multiply(_q.setFromAxisAngle(UP, o.homeRotY - parent.homeRotY));
    o.visualScale = o.scale * (parent.visualScale / Math.max(0.001, parent.scale));
  }

  private updateFalling(o: Abductable, dt: number, ctx: AbductionContext): void {
    // enemy wrecks / dropped objects can be caught mid-air by the beam
    if (ctx.beamActive && this.zoneOf(o) >= 0 && o.tier <= Math.floor(ctx.beamTier + 1e-4) && o.pos.y < ctx.ufoPos.y - 1) {
      o.home.copy(o.pos);
      o.beamIndex = this.zoneOf(o);
      this.beginLift(o, ctx);
      o.phaseDuration *= 0.6;
      return;
    }
    o.vel.y -= 18 * dt;
    o.vel.x *= 1 - dt * 0.3;
    o.vel.z *= 1 - dt * 0.3;
    o.pos.addScaledVector(o.vel, dt);
    this.integrateSpin(o, dt, 1);
    const ground = this.world.groundAt(o.pos.x, o.pos.z);
    if (o.pos.y <= ground) {
      o.pos.y = ground;
      const impact = Math.abs(o.vel.y);
      _v.set(o.pos.x, ground + 0.2, o.pos.z);
      const size = Math.max(0.5, o.model.radius * o.scale);
      this.particles.puff(_v, { count: 6 + Math.min(20, impact), color: 0xcfc2a5, speed: 2 + impact * 0.2, dir: UP, spread: 1, life: 1.1, size: size, sizeEnd: size * 2.5, drag: 2.5, alpha: 0.5, radius: size * 0.5 });
      if (impact > 6) this.particles.chunks(_v, 6, 0x8f8778, 0.2 + size * 0.05, 4, ground);
      this.bus.emit('object:destroyed', { uid: o.uid, defId: o.def.id, position: o.pos });
      o.home.set(o.pos.x, ground, o.pos.z);
      o.homeRotY = Math.atan2(2 * (o.quat.w * o.quat.y + o.quat.x * o.quat.z), 1 - 2 * (o.quat.y * o.quat.y + o.quat.z * o.quat.z));
      o.enemyKind = null;
      this.startSettling(o);
    }
  }

  private startSettling(o: Abductable): void {
    o.setState(AState.Settling, 0.45);
    o.vel.set(0, 0, 0);
    if (o.dynamicIndex >= 0) {
      const dm = this.pool.get(o.dynamicIndex);
      dm.fx.uRim.value = 0;
      dm.fx.uRimColor.value.copy(this.rimColor);
    }
  }

  private updateSettling(o: Abductable, _dt: number): void {
    o.progress = Math.min(1, o.stateTime / o.phaseDuration);
    const p = o.progress;
    const bounce = Math.sin(p * Math.PI * 2) * (1 - p) * 0.06;
    o.pos.x += (o.home.x - o.pos.x) * 0.3;
    o.pos.z += (o.home.z - o.pos.z) * 0.3;
    o.pos.y = o.home.y + Math.max(0, (o.pos.y - o.home.y) * 0.6) + Math.abs(bounce);
    _q.setFromAxisAngle(UP, o.homeRotY);
    o.quat.slerp(_q, 0.25);
    o.visualScale += (o.scale - o.visualScale) * 0.3;
    if (p >= 1) {
      o.pos.copy(o.home);
      o.quat.copy(_q);
      o.visualScale = o.scale;
      this.deactivate(o, true);
    }
  }

  private drop(o: Abductable): void {
    o.setState(AState.Falling, 999);
    o.parent = null;
  }

  private integrateSpin(o: Abductable, dt: number, mult: number): void {
    _axis.copy(o.angVel).multiplyScalar(mult * dt);
    const ang = _axis.length();
    if (ang > 1e-5) {
      _q.setFromAxisAngle(_axis.divideScalar(ang), ang);
      o.quat.premultiply(_q);
    }
  }

  private absorb(o: Abductable, ctx: AbductionContext): void {
    o.setState(AState.Absorbed, 1);
    // children still riding go in right after (each one scores!)
    for (const child of o.children) {
      if (child.alive && child.state === AState.Carried) {
        child.parent = null;
        child.setState(AState.Sucking, 0.12 + Math.random() * 0.2);
        child.localOffset.copy(child.pos);
      }
    }
    const hatch = _v.set(ctx.ufoPos.x, ctx.ufoPos.y - ctx.ufoRadius * 0.3, ctx.ufoPos.z);
    const big = o.tier >= 5;
    const rc = o.rarity !== 'normal' ? RARITY_INFO[o.rarity].color : 0x7dffb0;
    this.particles.burst(hatch, {
      count: 8 + Math.min(40, o.tier * 5),
      color: rc,
      colorVar: 0xeafff4,
      speed: 3 + o.tier * 0.8 + ctx.ufoRadius * 0.4,
      spread: 1,
      life: 0.55,
      size: 0.35 + ctx.ufoRadius * 0.12 + o.tier * 0.05,
      sizeEnd: 0.02,
      drag: 3.5,
      radius: ctx.ufoRadius * 0.2,
    });
    if (big) {
      this.particles.burst(hatch, { count: 30, color: 0xffffff, colorVar: rc, speed: 10 + o.tier * 1.5, spread: 1, life: 0.8, size: 0.6 + ctx.ufoRadius * 0.15, sizeEnd: 0.05, drag: 2.5 });
    }
    this.deactivate(o, false);
    this.world.kill(o);
    this.onAbsorbed?.(o);
  }

  /** Releases every lifted object (beam knocked out, extraction...). */
  dropAll(): void {
    for (const o of this.active) {
      if (o.state === AState.Lifting || o.state === AState.Orbiting || o.state === AState.Shaking) this.drop(o);
    }
  }

  get anticipating(): number {
    return this.anticipateCount;
  }

  static readonly TAU = TAU;
}
