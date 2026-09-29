// Assets externos (todos CC0): texturas de ambientCG e modelos do Poly Haven.
// Se algum não carregar, o jogo segue com a versão procedural.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const MODEL_NAMES = [
  'barrel_03', 'Barrel_02', 'old_tyre', 'covered_car', 'exterior_aircon_unit', 'fire_hydrant',
  'metal_trash_can', 'utility_box_01', 'concrete_road_barrier', 'cement_bag', 'cardboard_box_01', 'boombox',
] as const;
export type ModelName = (typeof MODEL_NAMES)[number];

// a versão publicada como artifact serve os .glb com outra extensão (ver README)
const MODEL_EXT: string = import.meta.env.VITE_MODEL_EXT || '.glb';

export const PHOTO_NAMES = ['plaster', 'brick', 'concrete'] as const;
export type PhotoName = (typeof PHOTO_NAMES)[number];

export interface Assets {
  photos: Partial<Record<PhotoName, HTMLImageElement>>;
  tex: Partial<Record<'asphalt' | 'asphalt_n' | 'asphalt_r' | 'sidewalk' | 'sidewalk_n' | 'dirt' | 'dirt_n', THREE.Texture>>;
  models: Partial<Record<ModelName, THREE.Group>>;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function loadAssets(onProgress?: (done: number, total: number) => void): Promise<Assets> {
  const assets: Assets = { photos: {}, tex: {}, models: {} };
  const texLoader = new THREE.TextureLoader();
  const gltf = new GLTFLoader();
  const texNames = ['asphalt', 'asphalt_n', 'asphalt_r', 'sidewalk', 'sidewalk_n', 'dirt', 'dirt_n'] as const;
  const total = PHOTO_NAMES.length + texNames.length + MODEL_NAMES.length;
  let done = 0;
  const tick = () => onProgress?.(++done, total);

  const jobs: Promise<void>[] = [];
  for (const n of PHOTO_NAMES) {
    jobs.push(loadImage(`./tex/${n}.jpg`).then((img) => {
      if (img) assets.photos[n] = img;
      tick();
    }));
  }
  for (const n of texNames) {
    jobs.push(
      texLoader
        .loadAsync(`./tex/${n}.jpg`)
        .then((t) => {
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.anisotropy = 8;
          t.colorSpace = n.endsWith('_n') || n.endsWith('_r') ? THREE.NoColorSpace : THREE.SRGBColorSpace;
          assets.tex[n] = t;
        })
        .catch(() => undefined)
        .finally(tick),
    );
  }
  for (const n of MODEL_NAMES) {
    jobs.push(
      gltf
        .loadAsync(`./models/${n}${MODEL_EXT}`)
        .then((g) => {
          assets.models[n] = g.scene;
        })
        .catch(() => undefined)
        .finally(tick),
    );
  }
  await Promise.all(jobs);
  return assets;
}
