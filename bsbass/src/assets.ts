// Assets externos (todos CC0): texturas de ambientCG e modelos do Poly Haven.
// Se algum não carregar, o jogo segue com a versão procedural.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { CarEntry } from './car/gltfCar';
import { CAMPAIGN_MODELS, loadCampaignModels } from './campaign/models';

export const MODEL_NAMES = [
  'barrel_03', 'Barrel_02', 'old_tyre', 'covered_car', 'exterior_aircon_unit', 'fire_hydrant',
  'metal_trash_can', 'utility_box_01', 'concrete_road_barrier', 'cement_bag', 'cardboard_box_01', 'boombox',
  'plastic_monobloc_chair_01', 'plastic_crate_02', 'propane_tank', 'trashbag', 'wooden_crate_01',
  'utility_pole_a', 'utility_pole_b',
] as const;
export type ModelName = (typeof MODEL_NAMES)[number];

// a versão publicada como artifact serve .glb/.hdr com um sufixo a mais (ver README)
const BIN_SUFFIX: string = import.meta.env.VITE_BIN_SUFFIX || '';

export const PHOTO_NAMES = ['plaster', 'brick', 'concrete', 'rebar', 'plates', 'painted', 'corrugated'] as const;
export type PhotoName = (typeof PHOTO_NAMES)[number];

export interface Assets {
  photos: Partial<Record<PhotoName, HTMLImageElement>>;
  tex: Partial<Record<'asphalt' | 'asphalt_n' | 'asphalt_r' | 'sidewalk' | 'sidewalk_n' | 'dirt' | 'dirt_n' | 'conc' | 'rebar' | 'metal' | 'bark' | 'leaves', THREE.Texture>>;
  models: Partial<Record<ModelName, THREE.Group>>;
  /** HDRI de rua à noite (Poly Haven) pros reflexos */
  env?: THREE.DataTexture;
  /** carros de verdade (models/cars/manifest.json) */
  cars: { entry: CarEntry; scene: THREE.Group }[];
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
  const assets: Assets = { photos: {}, tex: {}, models: {}, cars: [] };
  const texLoader = new THREE.TextureLoader();
  const gltf = new GLTFLoader();
  gltf.setMeshoptDecoder(MeshoptDecoder);
  const texNames = ['asphalt', 'asphalt_n', 'asphalt_r', 'sidewalk', 'sidewalk_n', 'dirt', 'dirt_n', 'conc', 'rebar', 'metal', 'bark', 'leaves'] as const;
  const total = PHOTO_NAMES.length + texNames.length + MODEL_NAMES.length + CAMPAIGN_MODELS.length + 1;
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
        .loadAsync(`./tex/${n}.${n === 'leaves' ? 'png' : 'jpg'}`)
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
        .loadAsync(`./models/${n}.glb${BIN_SUFFIX}`)
        .then((g) => {
          assets.models[n] = g.scene;
        })
        .catch(() => undefined)
        .finally(tick),
    );
  }
  jobs.push(
    new HDRLoader()
      .loadAsync(`./tex/night.hdr${BIN_SUFFIX}`)
      .then((t) => {
        t.mapping = THREE.EquirectangularReflectionMapping;
        assets.env = t;
      })
      .catch(() => undefined)
      .finally(tick),
  );
  // carros: o manifesto lista o que foi baixado (scripts/fetch-cars.mjs); sem ele, carros procedurais
  jobs.push(
    fetch('./models/cars/manifest.json')
      .then((r) => (r.ok ? (r.json() as Promise<CarEntry[]>) : []))
      .catch(() => [] as CarEntry[])
      .then((list) =>
        Promise.all(
          list.map((entry) =>
            gltf
              .loadAsync(`./models/cars/${entry.file}${BIN_SUFFIX}`)
              .then((g) => {
                assets.cars.push({ entry, scene: g.scene });
              })
              .catch(() => undefined),
          ),
        ),
      )
      .then(() => undefined),
  );
  // capítulos e ferro-velho do BSBASS THE GAME
  jobs.push(loadCampaignModels(gltf, tick));
  await Promise.all(jobs);
  // ordem estável (o carregamento termina em ordem aleatória)
  assets.cars.sort((a, b) => a.entry.id.localeCompare(b.entry.id));
  return assets;
}
