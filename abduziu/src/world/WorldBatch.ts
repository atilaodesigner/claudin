import { BatchedMesh, Color, Matrix4, Quaternion, Vector3, type Material } from 'three';
import type { ModelInfo } from '../assets/ModelLibrary';

const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();
const _up = new Vector3(0, 1, 0);
const _c = new Color();

/**
 * One BatchedMesh that can hold every model of the game. With WEBGL_multi_draw this
 * renders the whole city in a single draw call with per-object frustum culling.
 */
export class WorldBatch {
  readonly mesh: BatchedMesh;
  private readonly geometryIds = new Map<string, number>();
  private readonly models = new Map<number, ModelInfo>();
  private instanceModel: Int32Array;

  constructor(maxInstances: number, maxVertices: number, material: Material, name: string) {
    this.mesh = new BatchedMesh(maxInstances, maxVertices, maxVertices, material);
    this.mesh.name = name;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.perObjectFrustumCulled = true;
    this.mesh.sortObjects = false;
    this.instanceModel = new Int32Array(maxInstances).fill(-1);
  }

  ensureGeometry(model: ModelInfo): number {
    let id = this.geometryIds.get(model.key);
    if (id === undefined) {
      id = this.mesh.addGeometry(model.geometry);
      this.geometryIds.set(model.key, id);
      this.models.set(id, model);
    }
    return id;
  }

  add(model: ModelInfo, x: number, y: number, z: number, rotY: number, scale: number, paint: number): number {
    const geoId = this.ensureGeometry(model);
    const id = this.mesh.addInstance(geoId);
    this.instanceModel[id] = geoId;
    this.setTransform(id, x, y, z, rotY, scale);
    this.mesh.setColorAt(id, _c.setHex(paint));
    return id;
  }

  setTransform(id: number, x: number, y: number, z: number, rotY: number, scale = 1): void {
    _q.setFromAxisAngle(_up, rotY);
    _s.setScalar(scale);
    _p.set(x, y, z);
    _m.compose(_p, _q, _s);
    this.mesh.setMatrixAt(id, _m);
  }

  setMatrix(id: number, m: Matrix4): void {
    this.mesh.setMatrixAt(id, m);
  }

  setGeometry(id: number, model: ModelInfo): void {
    const geoId = this.ensureGeometry(model);
    if (this.instanceModel[id] === geoId) return;
    this.instanceModel[id] = geoId;
    this.mesh.setGeometryIdAt(id, geoId);
  }

  setVisible(id: number, visible: boolean): void {
    this.mesh.setVisibleAt(id, visible);
  }

  setColor(id: number, color: number): void {
    this.mesh.setColorAt(id, _c.setHex(color));
  }

  remove(id: number): void {
    this.mesh.deleteInstance(id);
    this.instanceModel[id] = -1;
  }

  get instanceCount(): number {
    return this.mesh.instanceCount;
  }
}
