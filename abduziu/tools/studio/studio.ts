/*
 * ABDUZIU studio: renders game objects and the Tripo characters on a transparent background,
 * with the game's own models, materials and tone mapping (for trailers / showreels).
 *   await studio.object('kombi', { size: 900, yaw: 0.6 })        -> PNG data URL
 *   await studio.character(url, { clip, t, rig, yaw, size })     -> PNG data URL
 */
import {
  AmbientLight,
  AnimationMixer,
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ACESFilmicToneMapping,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type AnimationClip,
  type Bone,
  CylinderGeometry,
  type Object3D,
  type SkinnedMesh,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ModelLibrary } from '../../src/assets/ModelLibrary';
import { getObjectDef } from '../../src/config/objects';
import { createNoiseTexture, TextureAtlas } from '../../src/rendering/TextureAtlas';
import { createWorldMaterial, worldUniforms } from '../../src/rendering/WorldMaterial';

const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

worldUniforms.uCloudTex.value = createNoiseTexture();
worldUniforms.uCloudParams.value.y = 0; // no cloud shadows in the studio
const atlas = new TextureAtlas();
const lib = new ModelLibrary(atlas);

function lights(scene: Scene): void {
  scene.add(new HemisphereLight(0xdcecff, 0x6b5a48, 1.25));
  const sun = new DirectionalLight(0xfff0d8, 2.6);
  sun.position.set(4, 7, 5);
  scene.add(sun);
  const rim = new DirectionalLight(0x9fd8ff, 1.2);
  rim.position.set(-5, 3, -6);
  scene.add(rim);
}

function frame(cam: PerspectiveCamera, box: Box3, yaw: number, pitch: number, fill = 1.15): void {
  const c = box.getCenter(new Vector3());
  const s = box.getSize(new Vector3());
  const r = Math.max(s.x, s.y, s.z) * 0.5 * fill;
  const tv = Math.tan((cam.fov * Math.PI) / 360);
  const d = Math.max(r / tv, r / (tv * cam.aspect));
  cam.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * d, c.y + Math.sin(pitch) * d, c.z + Math.cos(yaw) * Math.cos(pitch) * d);
  cam.lookAt(c);
  cam.near = d * 0.05;
  cam.far = d * 10;
  cam.updateProjectionMatrix();
}

async function object(id: string, o: { size?: number; yaw?: number; pitch?: number; paint?: number; fill?: number } = {}): Promise<string> {
  const size = o.size ?? 800;
  renderer.setSize(size, size);
  const def = getObjectDef(id);
  const model = lib.get(def.model);
  const mat = createWorldMaterial({ map: atlas.texture, name: 'studio' });
  mat.fx.uTint.value.setHex(o.paint ?? def.paints?.[0] ?? 0xffffff);
  const scene = new Scene();
  lights(scene);
  const mesh = new Mesh(model.geometry, mat);
  scene.add(mesh);
  const cam = new PerspectiveCamera(30, 1, 0.1, 1000);
  frame(cam, new Box3().setFromObject(mesh), o.yaw ?? 0.65, o.pitch ?? 0.38, o.fill ?? 1.1);
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/png');
}

const loader = new GLTFLoader();
const gltfs = new Map<string, Promise<{ scene: Object3D; animations: AnimationClip[] }>>();
function gltf(url: string) {
  if (!gltfs.has(url)) gltfs.set(url, loader.loadAsync(url));
  return gltfs.get(url)!;
}

/** Bones as glowing sticks + joint dots (the rig as graphic language). */
function rigBones(sk: SkinnedMesh): Bone[] {
  return sk.skeleton.bones.filter((b) => !/Hand(Thumb|Index|Middle|Ring|Pinky)|_End|end$/i.test(b.name));
}

async function character(
  url: string,
  o: { clip?: string; t?: number; rig?: number; ghost?: number; yaw?: number; pitch?: number; size?: [number, number]; extra?: string; fill?: number } = {},
): Promise<string> {
  const [w, h] = o.size ?? [720, 960];
  renderer.setSize(w, h);
  const g = await gltf(url);
  const scene = new Scene();
  lights(scene);
  scene.add(new AmbientLight(0xffffff, 0.2));
  scene.add(g.scene);
  let sk: SkinnedMesh | null = null;
  g.scene.traverse((x) => {
    if ((x as SkinnedMesh).isSkinnedMesh && !sk) sk = x as SkinnedMesh;
  });
  const skin = sk as unknown as SkinnedMesh;
  skin.skeleton.pose();
  g.scene.updateMatrixWorld(true);
  // rest framing (bind-pose box) so the camera does not breathe with the pose
  const box = new Box3().setFromObject(g.scene);
  const hips = skin.skeleton.bones.find((b) => /hips$/i.test(b.name));
  const rest = hips ? hips.position.clone() : null;
  let clips = g.animations;
  if (o.extra) clips = clips.concat((await gltf(o.extra)).animations);
  const mixer = new AnimationMixer(g.scene);
  if (o.clip) {
    const clip = clips.find((c) => c.name.replace(/\.\d+$/, '').toLowerCase() === o.clip);
    if (clip) {
      mixer.clipAction(clip).play();
      mixer.setTime(((o.t ?? 0) % clip.duration + clip.duration) % clip.duration);
      // running in place: drop the root motion on the ground plane
      if (hips && rest) {
        hips.position.x = rest.x;
        hips.position[Math.abs(rest.z) > Math.abs(rest.y) ? 'y' : 'z'] = rest[Math.abs(rest.z) > Math.abs(rest.y) ? 'y' : 'z'];
      }
    }
  }
  g.scene.updateMatrixWorld(true);
  const mat = skin.material as MeshStandardMaterial;
  const extras: Object3D[] = [];
  const ghost = o.ghost ?? 0;
  mat.transparent = ghost > 0;
  mat.opacity = 1 - ghost;
  mat.depthWrite = ghost < 0.5;
  if ((o.rig ?? 0) > 0) {
    const bones = rigBones(skin);
    const hgt = box.max.y - box.min.y;
    const k = o.rig ?? 1;
    const stick = new MeshBasicMaterial({ color: 0x5dffa0, depthTest: false, transparent: true, opacity: Math.min(1, k) });
    const dot = new MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: Math.min(1, k) });
    const a = new Vector3();
    const b = new Vector3();
    for (const bone of bones) {
      bone.getWorldPosition(a);
      const j = new Mesh(new SphereGeometry(hgt * 0.013, 14, 10), dot);
      j.position.copy(a);
      j.renderOrder = 12;
      extras.push(j);
      const parent = bone.parent as Bone;
      if (!parent || !parent.isBone) continue;
      parent.getWorldPosition(b);
      const len = a.distanceTo(b);
      if (len < 1e-4) continue;
      const c = new Mesh(new CylinderGeometry(hgt * 0.0055, hgt * 0.0055, len, 8), stick);
      c.position.copy(a).add(b).multiplyScalar(0.5);
      c.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize());
      c.renderOrder = 11;
      extras.push(c);
    }
    scene.add(...extras);
  }
  const cam = new PerspectiveCamera(28, w / h, 0.01, 100);
  frame(cam, box, o.yaw ?? 0.35, o.pitch ?? 0.12, o.fill ?? 1.05);
  renderer.render(scene, cam);
  const out = renderer.domElement.toDataURL('image/png');
  mixer.stopAllAction();
  mixer.uncacheRoot(g.scene);
  scene.remove(g.scene);
  mat.transparent = false;
  mat.opacity = 1;
  mat.depthWrite = true;
  return out;
}

(window as unknown as { studio: unknown }).studio = { object, character, Color };
(window as unknown as { studioReady: boolean }).studioReady = true;
