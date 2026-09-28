import type { Vector3 } from 'three';
import type { Abductable } from './Abductable';
import type { World } from './World';

interface Seed {
  defId: string;
  x: number;
  y: number;
  z: number;
  rot: number;
  paint: number;
  at: number;
}

/**
 * Arena maps grow back: every city object that gets abducted is re-planted at its spot
 * after a while, but only once the saucer is far enough that nobody sees it pop in.
 */
export class CityRegrowth {
  private queue: Seed[] = [];
  private world: World | null = null;
  private time = 0;
  private tick = 0;
  enabled = false;
  /** Seconds before an abducted object may come back. */
  minDelay = 20;
  maxDelay = 45;

  /** Hooks a freshly built world (its kill() records what disappears). */
  attach(world: World): void {
    this.world = world;
    this.queue = [];
    const kill = world.kill.bind(world);
    world.kill = (o: Abductable) => {
      if (this.enabled && o.alive) this.record(o);
      kill(o);
    };
  }

  reset(enabled: boolean): void {
    this.enabled = enabled;
    this.queue = [];
    this.time = 0;
  }

  private record(o: Abductable): void {
    // city props only: no people/cars driven by other systems, no enemy wrecks or event items
    if (o.living || o.enemyKind || o.eventTag || o.parent) return;
    this.queue.push({
      defId: o.def.id,
      x: o.home.x,
      y: o.home.y,
      z: o.home.z,
      rot: o.homeRotY,
      paint: o.paint,
      at: this.time + this.minDelay + Math.random() * (this.maxDelay - this.minDelay),
    });
  }

  /**
   * @param viewer where the camera looks from (objects regrow out of sight)
   * @param hideRadius nothing pops back inside this distance
   */
  update(dt: number, viewer: Vector3, hideRadius: number): void {
    const w = this.world;
    if (!this.enabled || !w || this.queue.length === 0) return;
    this.time += dt;
    this.tick -= dt;
    if (this.tick > 0) return;
    this.tick = 0.5;
    let planted = 0;
    for (let i = 0; i < this.queue.length && planted < 14; i++) {
      const s = this.queue[i] as Seed;
      if (s.at > this.time) continue;
      if (Math.hypot(w.dx(viewer.x, s.x), w.dz(viewer.z, s.z)) < hideRadius) {
        s.at = this.time + 5;
        continue;
      }
      try {
        w.spawn(s.defId, s.x, s.y, s.z, s.rot, { paint: s.paint });
      } catch {
        /* unknown def: drop it */
      }
      this.queue.splice(i, 1);
      i--;
      planted++;
    }
  }

  get pending(): number {
    return this.queue.length;
  }
}
