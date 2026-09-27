import type { Vector3 } from 'three';
import { CITY } from '../config/districts';
import { AState, type Abductable } from './Abductable';
import type { World } from './World';

interface Chunk {
  cx: number;
  cz: number;
  detail: Abductable[];
  visible: boolean;
}

/**
 * Streams detail in and out per city block. Small props (cans, chairs, bikes…) are
 * invisible from far away anyway, so whole chunks of them are hidden beyond the
 * detail distance. Big structures stay for the skyline (fog handles the horizon).
 */
export class ChunkManager {
  private readonly chunks = new Map<number, Chunk>();
  private timer = 0;
  private readonly size = CITY.blockSize;
  detailDistance = 110;

  constructor(private readonly world: World) {
    for (const o of world.objects) this.register(o);
  }

  private key(x: number, z: number): number {
    return ((Math.floor(x / this.size) + 512) << 10) | (Math.floor(z / this.size) + 512);
  }

  static isDetail(o: Abductable): boolean {
    return o.model.height * o.scale < 1.7 && o.model.radius * o.scale < 1.3;
  }

  register(o: Abductable): void {
    if (o.slot !== 'static' || !ChunkManager.isDetail(o)) return;
    const k = this.key(o.home.x, o.home.z);
    let c = this.chunks.get(k);
    if (!c) {
      c = { cx: (Math.floor(o.home.x / this.size) + 0.5) * this.size, cz: (Math.floor(o.home.z / this.size) + 0.5) * this.size, detail: [], visible: true };
      this.chunks.set(k, c);
    }
    c.detail.push(o);
  }

  update(dt: number, focus: Vector3): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.3;
    const batch = this.world.staticBatch;
    const reach = this.detailDistance + this.size * 0.71;
    for (const c of this.chunks.values()) {
      const want = Math.hypot(c.cx - focus.x, c.cz - focus.z) < reach;
      if (want === c.visible) continue;
      c.visible = want;
      for (const o of c.detail) {
        if (!o.alive || o.slot !== 'static' || o.state !== AState.Static || o.batchId < 0) continue;
        batch.setVisible(o.batchId, want);
      }
    }
  }

  /** Makes everything visible again (e.g. before a panoramic shot). */
  showAll(): void {
    const batch = this.world.staticBatch;
    for (const c of this.chunks.values()) {
      if (c.visible) continue;
      c.visible = true;
      for (const o of c.detail) if (o.alive && o.slot === 'static' && o.batchId >= 0) batch.setVisible(o.batchId, true);
    }
  }
}
