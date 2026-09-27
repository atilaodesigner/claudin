import { Vector3, type Mesh } from 'three';
import { GRID } from '../config/districts';
import { dampAngle } from '../utils/math';
import { Enemy, type EnemyContext } from './Enemy';
import type { EnemyAssets } from './EnemyAssets';

const _muzzle = new Vector3();
const LANE = 2.6;

/** Patrulha Aurora: drives the road grid toward the saucer, parks and shoots upward. */
export class PoliceCarController extends Enemy {
  axis: 'x' | 'z' = 'x';
  line = 0;
  dir: 1 | -1 = 1;
  s = 0;
  private readonly red: Mesh;
  private readonly blue: Mesh;
  private blink = 0;
  private stopped = false;

  constructor(id: number, assets: EnemyAssets) {
    super(id, 'police');
    this.group.add(assets.model('policecar'));
    this.red = assets.glow(assets.glowRed, 0.45);
    this.blue = assets.glow(assets.glowBlue, 0.45);
    this.red.position.set(0.35, 1.7, -0.1);
    this.blue.position.set(-0.35, 1.7, -0.1);
    this.group.add(this.red, this.blue);
  }

  get flying(): boolean {
    return false;
  }

  override get radius(): number {
    return 2.4;
  }

  placeOnRoad(axis: 'x' | 'z', line: number, s: number, dir: 1 | -1): void {
    this.axis = axis;
    this.line = line;
    this.s = s;
    this.dir = dir;
    this.syncPos();
  }

  private syncPos(): void {
    if (this.axis === 'x') this.pos.set(this.s, 0.02, this.line + this.dir * LANE);
    else this.pos.set(this.line - this.dir * LANE, 0.02, this.s);
  }

  update(ctx: EnemyContext): void {
    const dt = ctx.dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
    if (this.disabled > 0) {
      this.disabled -= dt;
      this.red.visible = this.blue.visible = false;
      this.group.position.copy(this.pos);
      return;
    }
    this.blink += dt * 7;
    const on = Math.floor(this.blink) % 2 === 0;
    this.red.visible = on;
    this.blue.visible = !on;

    const dx = ctx.player.x - this.pos.x;
    const dz = ctx.player.z - this.pos.z;
    const horiz = Math.hypot(dx, dz);
    const range = Math.min(this.stats.range, 22 + ctx.player.y * 0.6);
    this.stopped = horiz < range * 0.75;
    if (!this.stopped) {
      const prev = this.s;
      this.s += this.dir * this.stats.speed * dt;
      // at intersections, turn toward the target
      const B = GRID.blockSize;
      const lines = this.axis === 'x' ? ctx.world.roadLines.xs : ctx.world.roadLines.zs;
      for (const l of lines) {
        if ((prev - l) * (this.s - l) <= 0) {
          const along = this.axis === 'x' ? dx : dz;
          const across = this.axis === 'x' ? dz : dx;
          if (Math.abs(across) > Math.abs(along) + B * 0.25) {
            const oldLine = this.line;
            this.axis = this.axis === 'x' ? 'z' : 'x';
            this.line = l;
            this.s = oldLine;
            this.dir = across > 0 ? 1 : -1;
          } else if (along * this.dir < 0) {
            this.dir = this.dir > 0 ? -1 : 1;
          }
          break;
        }
      }
      // streets that end at the water: turn back
      const ahead = this.s + this.dir * 3;
      if (!(this.axis === 'x' ? ctx.world.isRoadAt(ahead, this.line) : ctx.world.isRoadAt(this.line, ahead))) {
        this.s = prev;
        this.dir = this.dir > 0 ? -1 : 1;
      }
      const half = this.axis === 'x' ? ctx.world.halfSize.w : ctx.world.halfSize.h;
      if (Math.abs(this.s) > half - 2) {
        this.dir = this.s > 0 ? -1 : 1;
        this.s = Math.max(-half + 2, Math.min(half - 2, this.s));
      }
      this.syncPos();
      const target = this.axis === 'x' ? (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : this.dir > 0 ? 0 : Math.PI;
      this.heading = dampAngle(this.heading, target, 8, dt);
    } else {
      this.heading = dampAngle(this.heading, Math.atan2(dx, dz), 3, dt);
    }
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    _muzzle.set(this.pos.x, this.pos.y + 1.6, this.pos.z);
    this.updateGun(ctx, this.stopped && horiz < range, _muzzle, 1.6);
  }
}
