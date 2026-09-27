import { Matrix4, Quaternion, Vector3 } from 'three';
import { GRID } from '../config/districts';
import { getObjectDef } from '../config/objects';
import { dampAngle } from '../utils/math';
import type { Rng } from '../utils/rng';
import { AState, type Abductable } from './Abductable';
import type { World } from './World';

interface Car {
  obj: Abductable;
  /** 'x': driving along a horizontal road (z = line). 'z': along a vertical road (x = line). */
  axis: 'x' | 'z';
  line: number;
  dir: 1 | -1;
  s: number;
  speed: number;
  baseSpeed: number;
  heading: number;
  batchId: number;
  gone: boolean;
  panic: number;
  nextTurnCheck: number;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3(1, 1, 1);
const UP = new Vector3(0, 1, 0);
const LANE = 2.6;

const TRAFFIC_TABLE = [
  { item: 'hatch', weight: 6 },
  { item: 'seda', weight: 4 },
  { item: 'taxi', weight: 2 },
  { item: 'besourinho', weight: 1.5 },
  { item: 'perua', weight: 1 },
  { item: 'onibus', weight: 1.4 },
  { item: 'van', weight: 1.2 },
  { item: 'caminhonete', weight: 1.2 },
  { item: 'moto', weight: 2.5 },
  { item: 'caminhao', weight: 0.7 },
];

/** Cars, motos and buses driving the road grid (right-hand traffic), fleeing the saucer. */
export class TrafficSystem {
  readonly cars: Car[] = [];
  private readonly xs: number[];
  private readonly zs: number[];
  private readonly B = GRID.blockSize;
  onHonk: ((x: number, z: number) => void) | null = null;

  constructor(
    private readonly world: World,
    private readonly rng: Rng,
    count: number,
  ) {
    this.xs = world.roadLines.xs;
    this.zs = world.roadLines.zs;
    const prevDetach = world.livingDetach;
    world.livingDetach = (obj) => {
      if (obj.living?.system === 'traffic') this.onDetach(obj);
      else prevDetach?.(obj);
    };
    for (let i = 0; i < count; i++) this.spawnCar();
  }

  spawnCar(defId?: string, at?: { axis: 'x' | 'z'; line: number; s: number; dir: 1 | -1 }, speedMult = 1): Car {
    const r = this.rng;
    const id = defId ?? r.weighted(TRAFFIC_TABLE);
    const def = getObjectDef(id);
    const model = this.world.lib.get(this.world.lib.variantKey(def.model, 0));
    const paint = def.paints && def.paints.length ? r.pick(def.paints) : 0xffffff;
    const obj = this.world.createObject(def, model.key, 'normal', 'C', paint);
    let axis = at?.axis ?? (r.chance(0.5) ? 'x' : 'z');
    let lines = axis === 'x' ? this.zs : this.xs;
    let half = axis === 'x' ? this.world.halfSize.w : this.world.halfSize.h;
    let line = at?.line ?? (lines[r.int(1, lines.length - 2)] as number);
    let s = at?.s ?? r.range(-half + 10, half - 10);
    // never spawn on water: retry a few spots on the real road network
    for (let tries = 0; !at && tries < 20 && !this.onRoad(axis, line, s); tries++) {
      axis = r.chance(0.5) ? 'x' : 'z';
      lines = axis === 'x' ? this.zs : this.xs;
      half = axis === 'x' ? this.world.halfSize.w : this.world.halfSize.h;
      line = lines[r.int(1, lines.length - 2)] as number;
      s = r.range(-half + 10, half - 10);
    }
    const dir: 1 | -1 = at?.dir ?? (r.chance(0.5) ? 1 : -1);
    const base = (id === 'onibus' || id === 'caminhao' ? 6.5 : id === 'moto' ? 10 : 8.5) * (0.85 + r.next() * 0.3) * speedMult;
    const car: Car = {
      obj,
      axis,
      line,
      dir,
      s,
      speed: base,
      baseSpeed: base,
      heading: 0,
      batchId: this.world.livingBatch.add(model, 0, 0, 0, 0, 1, paint),
      gone: false,
      panic: 0,
      nextTurnCheck: 0,
    };
    obj.slot = 'living';
    obj.living = { index: this.cars.length, system: 'traffic' };
    this.cars.push(car);
    this.place(car);
    return car;
  }

  private onDetach(obj: Abductable): void {
    const car = obj.living ? this.cars[obj.living.index] : undefined;
    if (!car) return;
    car.gone = true;
    this.world.livingBatch.setVisible(car.batchId, false);
    obj.living = null;
  }

  private place(car: Car): void {
    let x: number;
    let z: number;
    if (car.axis === 'x') {
      x = car.s;
      z = car.line + car.dir * LANE;
      car.heading = dampAngle(car.heading, car.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 8, 1 / 60);
    } else {
      x = car.line - car.dir * LANE;
      z = car.s;
      car.heading = dampAngle(car.heading, car.dir > 0 ? 0 : Math.PI, 8, 1 / 60);
    }
    const o = car.obj;
    o.home.set(x, 0.02, z);
    o.pos.copy(o.home);
    o.homeRotY = car.heading;
    _p.set(x, 0.02, z);
    _q.setFromAxisAngle(UP, car.heading);
    _m.compose(_p, _q, _s);
    this.world.livingBatch.setMatrix(car.batchId, _m);
    this.world.hash.insert(o.uid, x, z);
  }

  private onRoad(axis: 'x' | 'z', line: number, s: number): boolean {
    return axis === 'x' ? this.world.isRoadAt(s, line) : this.world.isRoadAt(line, s);
  }

  private nearestIntersection(s: number, axis: 'x' | 'z'): number {
    const lines = axis === 'x' ? this.xs : this.zs;
    let best = lines[0] as number;
    for (const l of lines) if (Math.abs(l - s) < Math.abs(best - s)) best = l;
    return best;
  }

  update(dt: number, ufo: Vector3, ufoRadius: number): void {
    const fear = 18 + ufoRadius * 4;
    for (const car of this.cars) {
      if (car.gone || !car.obj.alive || car.obj.state !== AState.Static) continue;
      const o = car.obj;
      const d = Math.hypot(o.pos.x - ufo.x, o.pos.z - ufo.z);
      if (d < fear) {
        if (car.panic <= 0 && Math.random() < 0.4) this.onHonk?.(o.pos.x, o.pos.z);
        car.panic = 2.5;
      }
      car.panic -= dt;
      const target = car.panic > 0 ? car.baseSpeed * 1.7 : car.baseSpeed;
      car.speed += (target - car.speed) * Math.min(1, dt * 2);
      const prevS = car.s;
      car.s += car.dir * car.speed * dt;
      // road ends at the water (no bridge): U-turn
      if (!this.onRoad(car.axis, car.line, car.s + car.dir * 3)) {
        car.s = prevS;
        car.dir = car.dir > 0 ? -1 : 1;
        this.place(car);
        continue;
      }
      // intersection crossing → maybe turn
      const inter = this.nearestIntersection(car.s, car.axis);
      const crossed = (prevS - inter) * (car.s - inter) <= 0;
      const half = car.axis === 'x' ? this.world.halfSize.w : this.world.halfSize.h;
      const atEdge = Math.abs(car.s) > half - 2;
      if ((crossed && Math.random() < 0.38) || atEdge) {
        const lines = car.axis === 'x' ? this.zs : this.xs;
        const lineIdx = lines.indexOf(car.line);
        const newAxis = car.axis === 'x' ? 'z' : 'x';
        const newLine = inter;
        // pick a direction that keeps us inside
        const otherHalf = newAxis === 'x' ? this.world.halfSize.w : this.world.halfSize.h;
        let newDir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
        if (car.line + newDir * 5 > otherHalf || lineIdx === lines.length - 1) newDir = -1;
        if (car.line + newDir * 5 < -otherHalf || lineIdx === 0) newDir = 1;
        // don't turn into a street that ends in the water
        if (!this.onRoad(newAxis, newLine, car.line + newDir * 8)) newDir = newDir > 0 ? -1 : 1;
        const canTurn = this.onRoad(newAxis, newLine, car.line + newDir * 8);
        if (atEdge && !crossed) {
          car.dir = car.dir > 0 ? -1 : 1;
          car.s = Math.max(-half + 2, Math.min(half - 2, car.s));
        } else if (canTurn) {
          car.axis = newAxis;
          car.s = car.line;
          car.line = newLine;
          car.dir = newDir;
        }
      }
      this.place(car);
    }
  }

  get activeCount(): number {
    let c = 0;
    for (const car of this.cars) if (!car.gone && car.obj.alive) c++;
    return c;
  }

  static readonly blockSize = GRID.blockSize;
  get block(): number {
    return this.B;
  }
}
