import { Vector3 } from 'three';
import { BALANCE } from '../config/gameBalance';
import { EVENT_VALUES, RANDOM_EVENTS, type RandomEventDef, type RandomEventId } from '../config/events';
import type { Rng } from '../utils/rng';

export interface DirectorState {
  time: number;
  tier: number;
  alert: number;
}

export interface ActiveEvent {
  def: RandomEventDef;
  remaining: number;
  position: Vector3 | null;
  data: Record<string, number>;
}

/**
 * Pacing director: never lets more than ~30 seconds pass without something new
 * (enemy, object class, power, event, district or threat change).
 */
export class EventDirector {
  active: ActiveEvent | null = null;
  private lastNovelty = 0;
  private cooldownUntil = 0;
  private readonly lastRun = new Map<RandomEventId, number>();
  onStart: ((e: ActiveEvent) => void) | null = null;
  onEnd: ((e: ActiveEvent, success: boolean) => void) | null = null;
  onTick: ((e: ActiveEvent, dt: number) => void) | null = null;

  constructor(private rng: Rng) {}

  reset(rng: Rng): void {
    this.rng = rng;
    this.active = null;
    this.lastNovelty = 0;
    this.cooldownUntil = BALANCE.pacing.firstEventAt;
    this.lastRun.clear();
  }

  /** Anything new happened (level up, new enemy, tier...). */
  markNovelty(time: number): void {
    this.lastNovelty = time;
  }

  update(dt: number, s: DirectorState): void {
    if (this.active) {
      this.active.remaining -= dt;
      this.onTick?.(this.active, dt);
      if (this.active.remaining <= 0) this.finish(false);
      return;
    }
    const stale = s.time - this.lastNovelty > BALANCE.pacing.noveltyInterval;
    if (s.time < this.cooldownUntil && !(stale && s.time > BALANCE.pacing.firstEventAt * 0.6)) return;
    if (!stale && this.rng.next() > dt * 0.02) return;
    const candidates = RANDOM_EVENTS.filter((e) => s.time >= e.minTime && s.tier >= e.minTier && s.alert >= e.minAlert && s.time - (this.lastRun.get(e.id) ?? -9999) > e.cooldown);
    if (candidates.length === 0) return;
    const def = this.rng.weighted(candidates.map((c) => ({ item: c, weight: c.weight })));
    this.begin(def, s.time);
  }

  begin(def: RandomEventDef, time: number): void {
    this.active = { def, remaining: def.duration, position: null, data: {} };
    this.lastRun.set(def.id, time);
    this.cooldownUntil = time + BALANCE.pacing.eventCooldown;
    this.lastNovelty = time;
    this.onStart?.(this.active);
  }

  forceStart(id: RandomEventId, time: number): void {
    const def = RANDOM_EVENTS.find((e) => e.id === id);
    if (!def) return;
    if (this.active) this.finish(false);
    this.begin(def, time);
  }

  finish(success: boolean): void {
    const e = this.active;
    if (!e) return;
    this.active = null;
    this.onEnd?.(e, success);
  }

  static values = EVENT_VALUES;
}
