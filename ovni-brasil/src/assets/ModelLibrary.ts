import { Box3, type BufferGeometry } from 'three';
import type { TextureAtlas } from '../rendering/TextureAtlas';
import { ModelBuilder } from './ModelBuilder';
import { BUILDING_MODELS, MODEL_VARIANTS } from './models/buildings';
import { MILITARY_MODELS } from './models/military';
import { NATURE_MODELS } from './models/nature';
import { PROP_MODELS } from './models/props';
import { SPECIAL_MODELS } from './models/special';
import type { ModelFn } from './models/types';
import { VEHICLE_MODELS } from './models/vehicles';

export interface ModelInfo {
  key: string;
  geometry: BufferGeometry;
  /** Half extents of the bounding box footprint. */
  halfX: number;
  halfZ: number;
  height: number;
  /** Horizontal bounding radius. */
  radius: number;
  vertexCount: number;
}

const ALL_MODELS: Record<string, ModelFn> = {
  ...PROP_MODELS,
  ...VEHICLE_MODELS,
  ...BUILDING_MODELS,
  ...NATURE_MODELS,
  ...MILITARY_MODELS,
  ...SPECIAL_MODELS,
};

/**
 * Model registry. Procedural builders by default; any key can be overridden with a
 * geometry loaded from a .glb (see AssetLoader) before the world is generated.
 */
export class ModelLibrary {
  private readonly cache = new Map<string, ModelInfo>();
  private readonly overrides = new Map<string, BufferGeometry>();

  constructor(private readonly atlas: TextureAtlas) {}

  has(key: string): boolean {
    return key in ALL_MODELS || this.overrides.has(key);
  }

  variantCount(model: string): number {
    return MODEL_VARIANTS[model] ?? 1;
  }

  /** Resolves "shop" → "shop:3" etc. */
  variantKey(model: string, variant: number): string {
    const n = this.variantCount(model);
    return n > 1 ? `${model}:${((variant % n) + n) % n}` : model;
  }

  setOverride(key: string, geometry: BufferGeometry): void {
    this.overrides.set(key, geometry);
    this.cache.delete(key);
  }

  get(key: string): ModelInfo {
    const cached = this.cache.get(key);
    if (cached) return cached;
    let geometry = this.overrides.get(key);
    if (!geometry) {
      const fn = ALL_MODELS[key];
      if (!fn) throw new Error(`Model "${key}" not found`);
      const b = new ModelBuilder(this.atlas.white);
      fn(b, { atlas: this.atlas });
      geometry = b.build();
    }
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox as Box3;
    const halfX = Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x));
    const halfZ = Math.max(Math.abs(bb.min.z), Math.abs(bb.max.z));
    const info: ModelInfo = {
      key,
      geometry,
      halfX,
      halfZ,
      height: bb.max.y,
      radius: Math.sqrt(halfX * halfX + halfZ * halfZ),
      vertexCount: geometry.getAttribute('position').count,
    };
    this.cache.set(key, info);
    return info;
  }

  keys(): string[] {
    return Object.keys(ALL_MODELS);
  }

  loadedModels(): ModelInfo[] {
    return [...this.cache.values()];
  }
}
