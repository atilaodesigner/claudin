import type { Vector3 } from 'three';
import { BALANCE } from '../config/gameBalance';
import type { EventBus } from '../core/EventBus';
import type { ShieldSystem } from './ShieldSystem';

/** Player hull / damage rules: shield first, short invulnerability after hits, god mode. */
export class DamageSystem {
  hull = 100;
  maxHull = 100;
  invuln = 0;
  god = false;
  dead = false;
  totalTaken = 0;
  /** Called on a lethal hit: returns the hull to survive with (0 = the ship goes down). */
  rescue: (() => number) | null = null;

  constructor(
    private readonly shield: ShieldSystem,
    private readonly bus: EventBus,
  ) {}

  reset(maxHull: number): void {
    this.maxHull = maxHull;
    this.hull = maxHull;
    this.invuln = 0;
    this.dead = false;
    this.totalTaken = 0;
  }

  setMaxHull(max: number): void {
    if (max > this.maxHull) this.hull += max - this.maxHull;
    this.maxHull = max;
    this.hull = Math.min(this.hull, max);
  }

  heal(amount: number): void {
    this.hull = Math.min(this.maxHull, this.hull + amount);
  }

  /** Returns 'shield' | 'hull' | 'none' depending on what took the hit. */
  apply(amount: number, hitPoint: Vector3 | null, center: Vector3, dashing: boolean): 'shield' | 'hull' | 'none' {
    if (this.dead || this.god || dashing) return 'none';
    const wasBroken = this.shield.broken;
    const overflow = this.shield.absorb(amount, hitPoint, center);
    let result: 'shield' | 'hull' | 'none' = 'shield';
    if (overflow > 0) {
      if (this.invuln > 0) return wasBroken ? 'none' : 'shield';
      this.hull -= overflow;
      this.totalTaken += overflow;
      this.invuln = BALANCE.player.invulnAfterHit;
      result = 'hull';
    }
    if (!wasBroken && this.shield.broken) this.bus.emit('shield:break', {});
    this.bus.emit('player:damage', { amount, hull: this.hull, shield: this.shield.value, source: hitPoint });
    if (this.hull <= 0) {
      const saved = this.rescue?.() ?? 0;
      if (saved > 0) {
        this.hull = Math.min(this.maxHull, saved);
        this.invuln = Math.max(this.invuln, 2);
        return result;
      }
      this.hull = 0;
      this.dead = true;
      this.bus.emit('player:death', {});
    }
    return result;
  }

  update(dt: number): void {
    this.invuln = Math.max(0, this.invuln - dt);
  }

  get fraction(): number {
    return this.maxHull > 0 ? this.hull / this.maxHull : 0;
  }
}
