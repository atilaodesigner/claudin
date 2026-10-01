import {
  Box3,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  Scene,
  UnsignedByteType,
  Vector3,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import type { ModelLibrary } from '../assets/ModelLibrary';
import { getObjectDef } from '../config/objects';
import { createWorldMaterial } from '../rendering/WorldMaterial';
import type { TextureAtlas } from '../rendering/TextureAtlas';

const SIZE = 160;

/**
 * Renders a small 3D portrait of every dex object with the game renderer (offscreen,
 * lazily, a few per frame) and caches them as data URLs.
 */
export class Thumbnails {
  private readonly cache = new Map<string, string>();
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, 1, 0.1, 500);
  private readonly rt = new WebGLRenderTarget(SIZE, SIZE, { type: UnsignedByteType, samples: 4 });
  private readonly mat;
  private readonly mesh: Mesh;
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly pixels = new Uint8Array(SIZE * SIZE * 4);

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly lib: ModelLibrary,
    atlas: TextureAtlas,
  ) {
    this.mat = createWorldMaterial({ map: atlas.texture, name: 'thumb' });
    this.mesh = new Mesh(undefined, this.mat);
    this.scene.add(this.mesh);
    this.scene.add(new HemisphereLight(0xdfefff, 0x8a7a5a, 2.2));
    const sun = new DirectionalLight(0xfff1dc, 3.2);
    sun.position.set(-3, 5, 4);
    this.scene.add(sun);
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
  }

  get(defId: string): string | null {
    return this.cache.get(defId) ?? null;
  }

  render(defId: string): string {
    const cached = this.cache.get(defId);
    if (cached) return cached;
    const def = getObjectDef(defId);
    // crowd characters (memes) ship a pre-rendered portrait
    if (def.thumb) {
      this.cache.set(defId, def.thumb);
      return def.thumb;
    }
    const model = this.lib.get(this.lib.variantKey(def.model, 0));
    this.mesh.geometry = model.geometry;
    this.mat.fx.uTint.value.setHex(def.paints?.[0] ?? 0xffffff);
    const box = new Box3().setFromObject(this.mesh);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.62;
    const dist = radius / Math.tan((this.camera.fov * Math.PI) / 360);
    this.camera.position.set(center.x + dist * 0.62, center.y + dist * 0.5, center.z + dist * 0.62);
    this.camera.lookAt(center);
    this.camera.near = dist * 0.05;
    this.camera.far = dist * 4;
    this.camera.updateProjectionMatrix();

    const prevTarget = this.renderer.getRenderTarget();
    const prevClear = this.renderer.getClearAlpha();
    this.renderer.setClearAlpha(0);
    this.renderer.setRenderTarget(this.rt);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.readRenderTargetPixels(this.rt, 0, 0, SIZE, SIZE, this.pixels);
    this.renderer.setRenderTarget(prevTarget);
    this.renderer.setClearAlpha(prevClear);

    const img = this.ctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const src = ((SIZE - 1 - y) * SIZE + x) * 4;
        const dst = (y * SIZE + x) * 4;
        // linear → display (simple filmic-ish curve)
        for (let c = 0; c < 3; c++) {
          const v = (this.pixels[src + c] as number) / 255;
          const t = v / (v + 0.35) * 1.35;
          img.data[dst + c] = Math.round(Math.pow(Math.min(1, t), 1 / 2.2) * 255);
        }
        img.data[dst + 3] = this.pixels[src + 3] as number;
      }
    }
    this.ctx.putImageData(img, 0, 0);
    const url = this.canvas.toDataURL('image/png');
    this.cache.set(defId, url);
    return url;
  }
}
