import { CanvasTexture, Group, Mesh, MeshStandardMaterial, RepeatWrapping, Scene, SRGBColorSpace, Vector3 } from 'three';
import type { ModelLibrary } from '../assets/ModelLibrary';
import type { CityDef } from '../config/cities';
import { DISTRICTS, type DistrictId } from '../config/districts';
import { getObjectDef, type ObjectDef, type Rarity } from '../config/objects';
import { createWorldMaterial } from '../rendering/WorldMaterial';
import type { TextureAtlas } from '../rendering/TextureAtlas';
import { createCalcadaTexture } from '../rendering/TextureAtlas';
import { SpatialHash } from '../utils/SpatialHash';
import { Abductable, AState } from './Abductable';
import type { CityGrid } from './CityGrid';
import { HeightField } from './HeightField';
import { Wires } from './Wires';
import { WorldBatch } from './WorldBatch';
import type { GenResult } from './WorldGenerator';

const STRUCTURAL_MIN_HEIGHT = 1.4;
/** Models that can appear in the living (moving) batch: NPCs, animals and traffic. */
export const LIVING_MODELS = ['person', 'person_up', 'dog', 'chicken', 'cow', 'hatch', 'sedan', 'taxi', 'beetle', 'kombi', 'bus', 'van', 'pickup', 'moto', 'mototaxi', 'truck'];

/** Shared across cities: soft wave streaks the water material scrolls. */
let waterTex: CanvasTexture | null = null;
function waterTexture(): CanvasTexture {
  if (waterTex) return waterTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = '#e2e2e2';
  ctx.fillRect(0, 0, 128, 128);
  // soft wavelets, not stripes: short curved glints at scattered positions
  for (let i = 0; i < 70; i++) {
    const x = (i * 37 + (i % 7) * 11) % 128;
    const y = (i * 53 + (i % 5) * 17) % 128;
    const w = 5 + (i % 4) * 3;
    ctx.strokeStyle = i % 3 ? 'rgba(255,255,255,0.35)' : 'rgba(160,160,160,0.25)';
    ctx.lineWidth = 1;
    for (const ox of [0, -128, 128]) {
      ctx.beginPath();
      ctx.moveTo(x + ox, y);
      ctx.quadraticCurveTo(x + ox + w / 2, y - 1.5, x + ox + w, y);
      ctx.stroke();
    }
  }
  waterTex = new CanvasTexture(c);
  waterTex.wrapS = waterTex.wrapT = RepeatWrapping;
  waterTex.colorSpace = SRGBColorSpace;
  return waterTex;
}

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
  readonly grid: CityGrid;
  readonly city: CityDef;
  private readonly water: Mesh | null = null;
  private readonly waterMat: MeshStandardMaterial | null = null;
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
    this.grid = gen.grid;
    this.city = gen.grid.city;
    this.halfW = this.grid.halfW;
    this.halfH = this.grid.halfH;

    this.material = createWorldMaterial({ map: atlas.texture, name: 'city' });
    this.groundMaterial = createWorldMaterial({ map: atlas.texture, grit: 1, roughness: 0.92, name: 'ground' });

    const w = gen.bounds.maxX - gen.bounds.minX + 200;
    const d = gen.bounds.maxZ - gen.bounds.minZ + 200;
    this.heightField = new HeightField(gen.bounds.minX - 100, gen.bounds.minZ - 100, w, d, 2);

    // size batches from the generated content (+ headroom for runtime spawns)
    let totalVerts = 0;
    for (const key of lib.keys()) if (!key.startsWith('bd_')) totalVerts += lib.get(key).vertexCount;
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
    if (gen.water) {
      const map = waterTexture();
      // polygon offset keeps the thin water sheet from z-fighting the ground far away
      this.waterMat = new MeshStandardMaterial({ vertexColors: true, map, roughness: 0.22, metalness: 0.1, name: 'water', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
      this.water = new Mesh(gen.water, this.waterMat);
      this.water.receiveShadow = true;
      this.water.name = 'water';
      this.root.add(this.water);
    }
    // scenery beyond the play area (Pão de Açúcar, skyline, forest...)
    for (const bd of gen.backdrop) {
      const m = new Mesh(lib.get(bd.model).geometry, this.material);
      m.position.set(bd.x, 0, bd.z);
      m.rotation.y = bd.rotY;
      m.scale.setScalar(bd.scale);
      m.name = `backdrop:${bd.model}`;
      m.userData.shared = true;
      this.root.add(m);
    }
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
    return this.grid.cell(this.grid.colAt(x), this.grid.rowAt(z)) ?? (this.grid.isWaterAt(x, z) ? 'W' : 'U');
  }

  districtName(x: number, z: number): string {
    const col = this.grid.colAt(x);
    const row = this.grid.rowAt(z);
    const named = this.city.blockNames?.[`${col},${row}`];
    if (named) return named;
    const d = this.districtAt(x, z);
    return this.city.names[d] ?? DISTRICTS[d].name;
  }

  groundAt(x: number, z: number): number {
    return this.grid.groundAt(x, z);
  }

  isOnRoad(x: number, z: number): boolean {
    return this.grid.isRoadAt(x, z);
  }

  isRoadAt(x: number, z: number): boolean {
    return this.grid.isRoadAt(x, z);
  }

  /** Scrolls the water streaks. */
  update(time: number): void {
    const map = this.waterMat?.map;
    if (map) map.offset.set(time * 0.012, time * 0.006);
  }

  clampToBounds(v: Vector3, margin = 0): void {
    v.x = Math.max(this.bounds.minX + margin, Math.min(this.bounds.maxX - margin, v.x));
    v.z = Math.max(this.bounds.minZ + margin, Math.min(this.bounds.maxZ - margin, v.z));
  }

  randomRoadPoint(rand: () => number): Vector3 {
    for (let tries = 0; ; tries++) {
      const alongX = rand() < 0.5;
      const v = alongX
        ? new Vector3((rand() * 2 - 1) * this.halfW, 0.02, this.roadLines.zs[Math.floor(rand() * this.roadLines.zs.length)] as number)
        : new Vector3(this.roadLines.xs[Math.floor(rand() * this.roadLines.xs.length)] as number, 0.02, (rand() * 2 - 1) * this.halfH);
      if (tries > 30 || this.grid.isRoadAt(v.x, v.z)) return v;
    }
  }

  /** Frees GPU buffers of this city (the model library is shared and kept). */
  dispose(): void {
    this.root.removeFromParent();
    this.staticBatch.mesh.dispose();
    this.livingBatch.mesh.dispose();
    this.root.traverse((o) => {
      const m = o as { isMesh?: boolean; isLineSegments?: boolean; geometry?: { dispose(): void } };
      if ((m.isMesh || m.isLineSegments) && m.geometry && o !== this.staticBatch.mesh && o !== this.livingBatch.mesh && !o.userData.shared) m.geometry.dispose();
    });
    this.waterMat?.dispose();
    this.hash.clear();
  }

  get halfSize(): { w: number; h: number } {
    return { w: this.halfW, h: this.halfH };
  }
}

const UP = new Vector3(0, 1, 0);
