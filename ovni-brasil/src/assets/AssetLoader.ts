import { BufferAttribute, BufferGeometry, Color, Mesh, type Material, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ModelLibrary } from './ModelLibrary';

/**
 * Optional GLB overrides for procedural placeholders.
 *
 *   MODEL_OVERRIDES = { hatch: 'models/hatch.glb' }
 *
 * Files live in `public/models/`. Meshes are merged into one geometry and their
 * material colors are baked into vertex colors so the model still renders inside the
 * single-material city batch (paint mask = 1 on meshes whose name contains "paint").
 */
export const MODEL_OVERRIDES: Record<string, string> = {};

export async function loadModelOverrides(lib: ModelLibrary, onProgress?: (p: number) => void): Promise<number> {
  const entries = Object.entries(MODEL_OVERRIDES);
  if (entries.length === 0) return 0;
  // loaded lazily so the GLTF loader never weighs on the default bundle
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  let done = 0;
  for (const [key, url] of entries) {
    try {
      const gltf = await loader.loadAsync(url);
      const geo = bakeToPaletteGeometry(gltf.scene);
      if (geo) lib.setOverride(key, geo);
    } catch (err) {
      console.warn(`[AssetLoader] could not load ${url}, keeping procedural "${key}"`, err);
    }
    onProgress?.(++done / entries.length);
  }
  return done;
}

const _c = new Color();

export function bakeToPaletteGeometry(root: Object3D): BufferGeometry | null {
  const parts: BufferGeometry[] = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    let g = mesh.geometry.clone();
    g.applyMatrix4(mesh.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    const count = g.getAttribute('position').count;
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as Material & { color?: Color; emissiveIntensity?: number };
    _c.copy(mat.color ?? new Color(0xffffff));
    const colors = new Float32Array(count * 3);
    const fx = new Float32Array(count * 2);
    const paint = /paint/i.test(mesh.name) ? 1 : 0;
    const emit = (mat.emissiveIntensity ?? 0) > 0.5 ? 1 : 0;
    for (let i = 0; i < count; i++) {
      colors.set([_c.r, _c.g, _c.b], i * 3);
      fx.set([paint, emit], i * 2);
    }
    const clean = new BufferGeometry();
    clean.setAttribute('position', g.getAttribute('position'));
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    clean.setAttribute('normal', g.getAttribute('normal'));
    clean.setAttribute('color', new BufferAttribute(colors, 3));
    // point every vertex at the white texel of the city atlas
    const uv = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) uv.set([0.015, 0.985], i * 2);
    clean.setAttribute('uv', new BufferAttribute(uv, 2));
    clean.setAttribute('aFx', new BufferAttribute(fx, 2));
    parts.push(clean);
  });
  if (parts.length === 0) return null;
  const merged = mergeGeometries(parts, false);
  merged?.computeBoundingBox();
  merged?.computeBoundingSphere();
  return merged;
}
