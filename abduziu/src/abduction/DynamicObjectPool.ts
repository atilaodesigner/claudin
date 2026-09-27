import { Color, Mesh, type BufferGeometry, type Scene, type Texture } from 'three';
import { createWorldMaterial, type WorldMaterialUniforms } from '../rendering/WorldMaterial';

export interface DynamicMesh {
  mesh: Mesh;
  fx: WorldMaterialUniforms;
  inUse: boolean;
}

/**
 * Standalone meshes used while an object is being simulated (shaking, lifted, orbiting).
 * Every mesh owns a material instance sharing the same shader program so it can glow,
 * flash and keep its paint independently.
 */
export class DynamicObjectPool {
  private readonly items: DynamicMesh[] = [];
  private readonly free: number[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly atlas: Texture,
    size: number,
  ) {
    for (let i = 0; i < size; i++) this.grow();
  }

  private grow(): number {
    const mat = createWorldMaterial({ map: this.atlas, name: 'dynamic' });
    const mesh = new Mesh(undefined, mat);
    mesh.visible = false;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.matrixAutoUpdate = true;
    this.scene.add(mesh);
    this.items.push({ mesh, fx: mat.fx, inUse: false });
    this.free.push(this.items.length - 1);
    return this.items.length - 1;
  }

  acquire(geometry: BufferGeometry, paint: number): number {
    if (this.free.length === 0) this.grow();
    const idx = this.free.pop() as number;
    const it = this.items[idx] as DynamicMesh;
    it.inUse = true;
    it.mesh.geometry = geometry;
    it.mesh.visible = true;
    it.mesh.scale.setScalar(1);
    it.fx.uTint.value.setHex(paint);
    it.fx.uFlash.value.setRGB(0, 0, 0);
    it.fx.uRim.value = 0;
    return idx;
  }

  get(idx: number): DynamicMesh {
    return this.items[idx] as DynamicMesh;
  }

  release(idx: number): void {
    const it = this.items[idx];
    if (!it || !it.inUse) return;
    it.inUse = false;
    it.mesh.visible = false;
    this.free.push(idx);
  }

  setRimColor(c: Color): void {
    for (const it of this.items) it.fx.uRimColor.value.copy(c);
  }

  get inUse(): number {
    return this.items.length - this.free.length;
  }

  releaseAll(): void {
    this.items.forEach((_, i) => this.release(i));
  }
}
