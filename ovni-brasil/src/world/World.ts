import { Group, Mesh, Scene, Vector3, type MeshStandardMaterial } from 'three';
import type { ModelLibrary } from '../assets/ModelLibrary';
import { CITY, DISTRICTS, type DistrictId } from '../config/districts';
import { getObjectDef, type ObjectDef, type Rarity } from '../config/objects';
import { createWorldMaterial } from '../rendering/WorldMaterial';
import type { TextureAtlas } from '../rendering/TextureAtlas';
import { createCalcadaTexture } from '../rendering/TextureAtlas';
import { SpatialHash } from '../utils/SpatialHash';
import { Abductable, AState } from './Abductable';
import { HeightField } from './HeightField';
import { Wires } from './Wires';
import { WorldBatch } from './WorldBatch';
import type { GenResult } from './WorldGenerator';

const STRUCTURAL_MIN_HEIGHT = 1.4;
/** Models that can appear in the living (moving) batch: NPCs, animals and traffic. */
export const LIVING_MODELS = ['person', 'person_up', 'dog', 'chicken', 'cow', 'hatch', 'sedan', 'taxi', 'beetle', 'kombi', 'bus', 'van', 'pickup', 'moto', 'mototaxi', 'truck'];
const B = CITY.blockSize;

/**
 * Owns the city: every abductable object, the render batches, the height field
 * and spatial queries.
 */
export class World {
  readonly root = new Group();
  readonly objects: Abductable[] = [];
  readonly hash = new SpatialHash(12);
  readonly heightField: HeightField;
  readonly staticBatch: WorldBatch;
  readonly livingBatch: WorldBatch;
  readonly material: MeshStandardMaterial;
  readonly groundMaterial: MeshStandardMaterial;
  readonly wires: Wires;
  readonly bounds: GenResult['bounds'];
  readonly start: GenResult['start'];
  readonly blocks: GenResult['blocks'];
  readonly roadLines: GenResult['roadLines'];
  aliveCount = 0;
  private readonly restampScratch: number[] = [];
  private readonly queryScratch: number[] = [];
  private readonly halfW: number;
  private readonly halfH: number;

  constructor(
    readonly scene: Scene,
    readonly lib: ModelLibrary,
    atlas: TextureAtlas,
    gen: GenResult,
  ) {
    this.bounds = gen.bounds;
    this.start = gen.start;
    this.blocks = gen.blocks;
    this.roadLines = gen.roadLines;
    const cols = (CITY.layout[0] as string).length;
    const rows = CITY.layout.length;
    this.halfW = (cols * B) / 2;
    this.halfH = (rows * B) / 2;

    this.material = createWorldMaterial({ map: atlas.texture, name: 'city' });
    this.groundMaterial = createWorldMaterial({ map: atlas.texture, grit: 1, roughness: 0.92, name: 'ground' });

    const w = gen.bounds.maxX - gen.bounds.minX + 200;
    const d = gen.bounds.maxZ - gen.bounds.minZ + 200;
    this.heightField = new HeightField(gen.bounds.minX - 100, gen.bounds.minZ - 100, w, d, 2);

    // size batches from the generated content (+ headroom for runtime spawns)
    let totalVerts = 0;
    for (const key of lib.keys()) totalVerts += lib.get(key).vertexCount;
    this.staticBatch = new WorldBatch(gen.placements.length + 900, totalVerts + 1000, this.material, 'city-static');
    let livingVerts = 0;
    for (const key of LIVING_MODELS) livingVerts += lib.get(key).vertexCount;
    this.livingBatch = new WorldBatch(gen.npcs.length + 160, livingVerts + 500, this.material, 'city-living');
    this.livingBatch.mesh.receiveShadow = false;

    for (const p of gen.placements) {
      const def = getObjectDef(p.defId);
      const obj = this.createObject(def, p.modelKey, p.rarity, p.district, p.paint);
      obj.home.set(p.x, p.y, p.z);
      obj.homeRotY = p.rotY;
      if (p.parent >= 0) {
        const parent = this.objects[p.parent] as Abductable;
        obj.parent = parent;
        parent.children.push(obj);
      }
      this.addToStatic(obj);
    }

    const ground = new Mesh(gen.ground, this.groundMaterial);
    ground.receiveShadow = true;
    ground.name = 'ground';
    const calcadaMat = createWorldMaterial({ map: createCalcadaTexture(), roughness: 0.85, name: 'calcada' });
    const calcada = new Mesh(gen.calcada, calcadaMat);
    calcada.receiveShadow = true;

    const wireData = gen.wires.map(([a, b]) => {
      const pa = this.objects[a] as Abductable;
      const pb = this.objects[b] as Abductable;
      return { a: new Vector3(pa.home.x, pa.home.y + 8.55, pa.home.z), b: new Vector3(pb.home.x, pb.home.y + 8.55, pb.home.z), poleA: a, poleB: b };
    });
    this.wires = new Wires(wireData);

    this.root.add(ground, calcada, this.staticBatch.mesh, this.livingBatch.mesh, this.wires.mesh);
    scene.add(this.root);
  }

  createObject(def: ObjectDef, modelKey: string, rarity: Rarity, district: DistrictId, paint: number): Abductable {
    const model = this.lib.get(modelKey);
    const obj = new Abductable(this.objects.length, def, model, rarity, district, paint);
    obj.structural = model.height >= STRUCTURAL_MIN_HEIGHT && def.tier >= 2;
    this.objects.push(obj);
    this.aliveCount++;
    return obj;
  }

  /** Puts an object at its home transform into the static batch, hash and heightfield. */
  addToStatic(obj: Abductable): void {
    obj.pos.copy(obj.home);
    obj.quat.setFromAxisAngle(UP, obj.homeRotY);
    obj.batchId = this.staticBatch.add(obj.model, obj.home.x, obj.home.y, obj.home.z, obj.homeRotY, obj.scale, obj.paint);
    obj.slot = 'static';
    obj.state = AState.Static;
    this.hash.insert(obj.uid, obj.home.x, obj.home.z);
    if (obj.structural) this.stamp(obj);
  }

  /** Runtime spawn (events, meteors, wrecks). */
  spawn(defId: string, x: number, y: number, z: number, rotY: number, opts: { rarity?: Rarity; paint?: number; variant?: number } = {}): Abductable {
    const def = getObjectDef(defId);
    const modelKey = this.lib.variantKey(def.model, opts.variant ?? Math.floor(Math.random() * 99));
    const paint = opts.paint ?? (def.paints && def.paints.length ? (def.paints[Math.floor(Math.random() * def.paints.length)] as number) : 0xffffff);
    const obj = this.createObject(def, modelKey, opts.rarity ?? def.rarity ?? 'normal', this.districtAt(x, z), paint);
    obj.home.set(x, y < 0 ? this.groundAt(x, z) : y, z);
    obj.homeRotY = rotY;
    this.addToStatic(obj);
    this.onSpawn?.(obj);
    return obj;
  }

  private footprint(obj: Abductable): { hx: number; hz: number } {
    const c = Math.abs(Math.cos(obj.homeRotY));
    const s = Math.abs(Math.sin(obj.homeRotY));
    const m = obj.model;
    return { hx: (m.halfX * c + m.halfZ * s) * obj.scale * 0.9, hz: (m.halfX * s + m.halfZ * c) * obj.scale * 0.9 };
  }

  private stamp(obj: Abductable): void {
    const f = this.footprint(obj);
    this.heightField.stamp(obj.uid, obj.home.x, obj.home.z, f.hx, f.hz, obj.home.y + obj.model.height * obj.scale);
  }

  /** Called for runtime spawns (chunk streaming registers them). */
  onSpawn: ((obj: Abductable) => void) | null = null;
  /** Hooks for NPC / traffic systems that own objects living in the moving batch. */
  livingDetach: ((obj: Abductable) => void) | null = null;
  livingReattach: ((obj: Abductable) => boolean) | null = null;

  /** Takes the object out of the static city (it becomes a dynamic, simulated object). */
  detach(obj: Abductable): void {
    if (obj.slot === 'static' && obj.batchId >= 0) {
      this.staticBatch.setVisible(obj.batchId, false);
      if (obj.structural) this.unstamp(obj);
      obj.slot = 'none';
    } else if (obj.slot === 'living') {
      this.livingDetach?.(obj);
      obj.slot = 'none';
    }
  }

  /** Puts a detached object back into the static city at its current transform. */
  reattach(obj: Abductable): void {
    if (obj.slot !== 'none' || !obj.alive) return;
    if (obj.living && this.livingReattach?.(obj)) return;
    if (obj.batchId < 0) {
      obj.home.copy(obj.pos);
      this.addToStatic(obj);
      return;
    }
    obj.home.copy(obj.pos);
    this.staticBatch.setTransform(obj.batchId, obj.home.x, obj.home.y, obj.home.z, obj.homeRotY, obj.scale);
    this.staticBatch.setVisible(obj.batchId, true);
    obj.slot = 'static';
    obj.state = AState.Static;
    this.hash.insert(obj.uid, obj.home.x, obj.home.z);
    if (obj.structural) this.stamp(obj);
  }

  /** Object is gone for good (absorbed or destroyed). */
  kill(obj: Abductable): void {
    if (!obj.alive) return;
    obj.alive = false;
    this.aliveCount--;
    if (obj.slot === 'static' || obj.slot === 'living') this.detach(obj);
    this.hash.remove(obj.uid);
    if (obj.batchId >= 0) {
      this.staticBatch.remove(obj.batchId);
      obj.batchId = -1;
    }
    if (obj.def.id === 'poste') this.wires.snapPole(obj.uid);
  }

  private unstamp(obj: Abductable): void {
    const f = this.footprint(obj);
    const cells = this.heightField.clearOwner(obj.uid, obj.home.x, obj.home.z, f.hx, f.hz, this.restampScratch);
    if (cells.length === 0) return;
    // re-stamp any other structure overlapping the freed cells
    const ids = this.hash.query(obj.home.x, obj.home.z, Math.max(f.hx, f.hz) + 30, this.queryScratch);
    for (const id of ids) {
      const other = this.objects[id];
      if (!other || other === obj || !other.alive || !other.structural || other.slot !== 'static') continue;
      const of = this.footprint(other);
      const top = other.home.y + other.model.height * other.scale;
      for (const ci of cells) {
        const c = this.heightField.cellCenter(ci);
        if (Math.abs(c.x - other.home.x) <= of.hx && Math.abs(c.z - other.home.z) <= of.hz) this.heightField.setCell(ci, top, other.uid);
      }
    }
  }

  /** Alive objects within radius (by center). Reuses `out`. */
  query(x: number, z: number, radius: number, out: Abductable[]): Abductable[] {
    out.length = 0;
    const ids = this.hash.query(x, z, radius + 12, this.queryScratch);
    for (const id of ids) {
      const o = this.objects[id];
      if (!o || !o.alive) continue;
      const dx = o.pos.x - x;
      const dz = o.pos.z - z;
      const r = radius + o.model.radius * 0.35;
      if (dx * dx + dz * dz <= r * r) out.push(o);
    }
    return out;
  }

  districtAt(x: number, z: number): DistrictId {
    const col = Math.floor((x + this.halfW) / B);
    const row = Math.floor((z + this.halfH) / B);
    const line = CITY.layout[row];
    if (!line || col < 0 || col >= line.length) return 'U';
    return line[col] as DistrictId;
  }

  districtName(x: number, z: number): string {
    return DISTRICTS[this.districtAt(x, z)].name;
  }

  groundAt(x: number, z: number): number {
    const col = Math.floor((x + this.halfW) / B);
    const row = Math.floor((z + this.halfH) / B);
    const line = CITY.layout[row];
    if (!line || col < 0 || col >= line.length) return 0;
    const lx = Math.abs(x - (-this.halfW + (col + 0.5) * B));
    const lz = Math.abs(z - (-this.halfH + (row + 0.5) * B));
    const hb = (B - CITY.roadWidth) / 2;
    const hl = hb - CITY.sidewalk;
    if (line[col] === 'P' && lx <= hb && lz <= hb) return 0.24;
    if (lx <= hl && lz <= hl) return 0.23;
    if (lx <= hb && lz <= hb) return 0.18;
    return 0.02;
  }

  isOnRoad(x: number, z: number): boolean {
    return this.groundAt(x, z) < 0.1;
  }

  clampToBounds(v: Vector3, margin = 0): void {
    v.x = Math.max(this.bounds.minX + margin, Math.min(this.bounds.maxX - margin, v.x));
    v.z = Math.max(this.bounds.minZ + margin, Math.min(this.bounds.maxZ - margin, v.z));
  }

  randomRoadPoint(rand: () => number): Vector3 {
    const alongX = rand() < 0.5;
    if (alongX) {
      const z = this.roadLines.zs[Math.floor(rand() * this.roadLines.zs.length)] as number;
      return new Vector3((rand() * 2 - 1) * this.halfW, 0.02, z);
    }
    const x = this.roadLines.xs[Math.floor(rand() * this.roadLines.xs.length)] as number;
    return new Vector3(x, 0.02, (rand() * 2 - 1) * this.halfH);
  }

  /** Frees GPU buffers of this city (the model library is shared and kept). */
  dispose(): void {
    this.root.removeFromParent();
    this.staticBatch.mesh.dispose();
    this.livingBatch.mesh.dispose();
    this.root.traverse((o) => {
      const m = o as { isMesh?: boolean; isLineSegments?: boolean; geometry?: { dispose(): void } };
      if ((m.isMesh || m.isLineSegments) && m.geometry && o !== this.staticBatch.mesh && o !== this.livingBatch.mesh) m.geometry.dispose();
    });
    this.hash.clear();
  }

  get halfSize(): { w: number; h: number } {
    return { w: this.halfW, h: this.halfH };
  }
}

const UP = new Vector3(0, 1, 0);
