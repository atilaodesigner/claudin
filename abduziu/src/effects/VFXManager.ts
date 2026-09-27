import { Color, Vector3, type Scene } from 'three';
import type { Haptics } from '../audio/Haptics';
import type { Time } from '../core/Time';
import type { CameraController } from '../rendering/CameraController';
import type { PostProcessing } from '../rendering/PostProcessing';
import { ParticleManager } from './ParticleManager';
import { RingEffects } from './RingEffects';

const UP = new Vector3(0, 1, 0);
const _v = new Vector3();
const _c = new Color();

/**
 * JUICE recipes. Every important action combines motion, VFX, camera, time and
 * haptics — with intensity proportional to how important the event is.
 */
export class VFXManager {
  readonly particles: ParticleManager;
  readonly rings: RingEffects;
  private trailTimer = 0;

  constructor(
    scene: Scene,
    private readonly camera: CameraController,
    private readonly post: PostProcessing,
    private readonly time: Time,
    private readonly haptics: Haptics,
  ) {
    this.particles = new ParticleManager(scene);
    this.rings = new RingEffects(scene);
  }

  update(dt: number): void {
    this.particles.update(dt);
    this.rings.update(dt);
  }

  clear(): void {
    this.particles.clear();
    this.rings.clear();
  }

  absorb(pos: Vector3, tier: number, ufoRadius: number, combo: number, rare: boolean, color: number): void {
    const big = tier >= 5;
    this.camera.impulse(0.05 + tier * 0.03);
    if (tier >= 3) this.camera.addTrauma(0.05 + tier * 0.025);
    if (big) {
      this.rings.spawn(_v.copy(pos).setY(pos.y - ufoRadius * 0.3), color, ufoRadius * 0.5, ufoRadius * 3.2, 0.6, { sphere: true });
      this.post.pulseChroma(0.004 + tier * 0.0008);
      this.time.hitStop(0.03 + Math.min(0.06, (tier - 5) * 0.015));
    }
    if (rare) {
      this.post.flashScreen(0.18, color);
      this.particles.burst(pos, { count: 40, color, colorVar: 0xffffff, speed: 8, life: 1, size: 0.5 + ufoRadius * 0.1, sizeEnd: 0.05, drag: 2 });
    }
    if (combo > 0 && combo % 10 === 0) this.rings.spawn(pos, color, ufoRadius, ufoRadius * 2.4, 0.45, { sphere: true });
    if (tier >= 3) this.haptics.light();
  }

  tierUp(pos: Vector3, ufoRadius: number): void {
    this.rings.spawn(pos, 0x7dffb0, ufoRadius, ufoRadius * 6, 1.2, { sphere: true });
    this.rings.spawn(_v.set(pos.x, 0.3, pos.z), 0x7dffb0, 1, ufoRadius * 10, 1.4, { thickness: 0.03 });
    this.camera.addTrauma(0.35);
    this.camera.dramatic(1.18, 1.4);
    this.post.flashScreen(0.25, 0xb6ffd6);
    this.post.pulseChroma(0.01);
    this.time.slowMo(0.35, 0.6);
    this.haptics.medium();
  }

  levelUp(pos: Vector3, ufoRadius: number): void {
    this.rings.spawn(pos, 0x5dffa0, ufoRadius * 0.8, ufoRadius * 4, 0.8, { sphere: true });
    this.particles.burst(pos, { count: 60, color: 0x5dffa0, colorVar: 0x3ee8ff, speed: 6 + ufoRadius, spread: 1, life: 1.1, size: 0.4 + ufoRadius * 0.08, sizeEnd: 0.02, drag: 1.6 });
    this.post.pulseChroma(0.012);
    this.haptics.medium();
  }

  frenzy(pos: Vector3, ufoRadius: number): void {
    this.rings.spawn(pos, 0xb36bff, ufoRadius, ufoRadius * 8, 1.0, { sphere: true });
    this.rings.spawn(_v.set(pos.x, 0.3, pos.z), 0x3ee8ff, 2, ufoRadius * 12, 1.2, { thickness: 0.04 });
    this.post.flashScreen(0.3, 0xd6b3ff);
    this.post.pulseChroma(0.02);
    this.camera.addTrauma(0.4);
    this.camera.dramatic(1.3, 8);
    this.time.slowMo(0.3, 0.55);
    this.haptics.strong();
  }

  explosion(pos: Vector3, size: number, groundY: number): void {
    const s = size;
    this.particles.burst(pos, { count: 24 + s * 8, color: 0xffd08a, colorVar: 0xff5a1f, speed: 5 + s * 3, spread: 1, life: 0.55, size: 1 + s * 0.8, sizeEnd: 0.1, drag: 3, radius: s * 0.3 });
    this.particles.burst(pos, { count: 10 + s * 4, color: 0xffffff, speed: 2 + s, spread: 1, life: 0.25, size: 2 + s * 1.2, sizeEnd: 0.4, drag: 4 });
    this.particles.puff(pos, { count: 10 + s * 5, color: 0x3a3a3e, colorVar: 0x6b6b70, speed: 2 + s * 1.2, dir: UP, spread: 0.7, life: 1.6 + s * 0.2, size: 1.2 + s * 0.8, sizeEnd: 3 + s * 1.5, drag: 1.8, alpha: 0.75, radius: s * 0.4 });
    this.particles.chunks(pos, 6 + s * 3, 0x3b3b40, 0.25 + s * 0.08, 6 + s * 2, groundY);
    this.rings.spawn(_v.set(pos.x, Math.max(groundY + 0.2, pos.y), pos.z), 0xffb35a, 0.5, 4 + s * 3, 0.45, { sphere: true });
    const dist = pos.distanceTo(this.camera.focus);
    const falloff = Math.max(0, 1 - dist / (60 + s * 20));
    this.camera.addTrauma((0.12 + s * 0.08) * falloff);
    if (s >= 3) this.post.flashScreen(0.12 * falloff, 0xffd9a8);
    if (falloff > 0.4) this.haptics.strong();
  }

  missileTrail(pos: Vector3): void {
    this.particles.single(false, pos.x, pos.y, pos.z, (Math.random() - 0.5) * 0.6, 0.4, (Math.random() - 0.5) * 0.6, _c.setHex(0xd9d9d9), 1.2, 0.5, 2.2, -0.3, 1.2, 0.6);
    this.particles.single(true, pos.x, pos.y, pos.z, 0, 0, 0, _c.setHex(0xffa040), 0.12, 0.8, 0.2, 0, 0, 1);
  }

  smokeTrail(pos: Vector3, dark = true): void {
    this.particles.single(false, pos.x, pos.y, pos.z, (Math.random() - 0.5), 1.2, (Math.random() - 0.5), _c.setHex(dark ? 0x2b2b2e : 0x9a9a9a), 1.6, 0.8, 3.5, -0.4, 1, 0.7);
    if (Math.random() < 0.4) this.particles.single(true, pos.x, pos.y, pos.z, 0, 0.5, 0, _c.setHex(0xff7a2a), 0.25, 1.2, 0.2, 0, 0, 0.9);
  }

  ufoTrail(pos: Vector3, vel: Vector3, radius: number, color: Color, dt: number): void {
    const speed = Math.hypot(vel.x, vel.z);
    if (speed < 3) return;
    this.trailTimer += dt * speed * 1.2;
    while (this.trailTimer > 1) {
      this.trailTimer -= 1;
      const a = Math.random() * Math.PI * 2;
      this.particles.single(true, pos.x + Math.cos(a) * radius * 0.9, pos.y - radius * 0.05, pos.z + Math.sin(a) * radius * 0.9, -vel.x * 0.05, -0.2, -vel.z * 0.05, color, 0.5, 0.25 + radius * 0.06, 0.02, 0, 1, 0.8);
    }
  }

  beamParticles(center: Vector3, groundY: number, topY: number, radius: number, color: Color, rate: number, dt: number): void {
    const n = this.particles.n(Math.floor(rate * dt + Math.random()));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius * 0.95;
      const y = groundY + Math.random() * (topY - groundY) * 0.3;
      const speed = 3 + (topY - groundY) * 0.35;
      this.particles.single(true, center.x + Math.cos(a) * r, y, center.z + Math.sin(a) * r, -Math.cos(a) * r * 0.25, speed * (0.6 + Math.random() * 0.8), -Math.sin(a) * r * 0.25, color, (topY - groundY) / speed, 0.18 + radius * 0.03, 0.05, 0, 0.2, 0.7);
    }
  }

  shieldHit(pos: Vector3): void {
    this.particles.burst(pos, { count: 14, color: 0x7ff7ff, colorVar: 0xffffff, speed: 6, spread: 1, life: 0.35, size: 0.4, sizeEnd: 0.02, drag: 3 });
    this.camera.addTrauma(0.1);
    this.haptics.light();
  }

  shieldBreak(pos: Vector3, radius: number): void {
    this.rings.spawn(pos, 0x7ff7ff, radius, radius * 3.2, 0.5, { sphere: true });
    this.particles.burst(pos, { count: 70, color: 0x7ff7ff, colorVar: 0xffffff, speed: 10 + radius, spread: 1, life: 0.8, size: 0.4 + radius * 0.1, sizeEnd: 0.02, drag: 2 });
    this.post.flashScreen(0.3, 0x9ff8ff);
    this.post.pulseChroma(0.015);
    this.camera.addTrauma(0.45);
    this.time.slowMo(0.35, 0.45);
    this.haptics.strong();
  }

  hullDamage(amount: number): void {
    this.post.damage = Math.min(1, this.post.damage + 0.25 + amount * 0.03);
    this.camera.addTrauma(0.15 + amount * 0.02);
    this.haptics.medium();
  }

  empWave(pos: Vector3, radius: number): void {
    this.rings.spawn(_v.set(pos.x, 0.4, pos.z), 0x3ee8ff, 1, radius, 0.8, { thickness: 0.05 });
    this.rings.spawn(pos, 0x9ff8ff, 1, radius * 0.9, 0.6, { sphere: true });
    this.rings.spawn(pos, 0x3ee8ff, 1, radius * 0.6, 0.9, { tilt: true, thickness: 0.03 });
    this.particles.burst(pos, { count: 80, color: 0x3ee8ff, colorVar: 0xffffff, speed: radius * 1.2, spread: 1, life: 0.6, size: 0.6, sizeEnd: 0.05, drag: 2.5 });
    this.post.flashScreen(0.35, 0xb8f7ff);
    this.post.pulseChroma(0.02);
    this.camera.addTrauma(0.35);
    this.camera.impulse(0.4);
    this.haptics.strong();
  }

  empCharge(pos: Vector3, radius: number): void {
    this.rings.spawn(pos, 0x3ee8ff, radius * 3, radius * 0.6, 0.35, { sphere: true });
  }

  perfectDodge(pos: Vector3): void {
    this.rings.spawn(pos, 0xffcf3f, 1, 8, 0.4, { sphere: true });
    this.time.slowMo(0.4, 0.4);
    this.post.pulseChroma(0.01);
  }

  dash(pos: Vector3, radius: number): void {
    this.rings.spawn(pos, 0x5dffa0, radius, radius * 2.2, 0.3, { sphere: true });
    this.camera.impulse(0.3);
    this.haptics.light();
  }

  discovery(pos: Vector3, color: number): void {
    this.particles.burst(pos, { count: 36, color, colorVar: 0xffffff, speed: 7, spread: 1, life: 1.2, size: 0.5, sizeEnd: 0.05, drag: 1.8 });
    this.time.slowMo(0.45, 0.45);
  }

  rareSparkle(pos: Vector3, color: number, height: number): void {
    this.particles.single(true, pos.x + (Math.random() - 0.5) * 1.5, pos.y + Math.random() * height, pos.z + (Math.random() - 0.5) * 1.5, 0, 1.2, 0, _c.setHex(color), 0.9, 0.35, 0.02, 0, 0.5, 1);
  }

  extraction(pos: Vector3, radius: number): void {
    this.rings.spawn(pos, 0xffffff, radius, radius * 10, 1.5, { sphere: true });
    this.post.flashScreen(0.6, 0xffffff);
    this.camera.addTrauma(0.3);
    this.haptics.strong();
  }
}
