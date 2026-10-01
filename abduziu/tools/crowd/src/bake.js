/*
 * Step 2 (in a browser, driven by bake.mjs): turns a rigged, decimated GLB into an ABDUZIU crowd asset.
 *
 *  - every clip is sampled into bone matrices (game space: person height, feet on y=0, facing +Z) and
 *    stored as 3×4 rows in one float texture: the game skins every pedestrian on the GPU from it;
 *  - finger bones are folded into the hand (invisible at crowd scale) and unused bones dropped;
 *  - clips missing from a character are borrowed from another one (same Mixamo skeleton);
 *  - root motion is removed (pedestrians move in code); its speed is kept so feet don't slide;
 *  - a second, lighter index buffer (LOD1) over the same vertices for far pedestrians;
 *  - the texture is shrunk to WebP.
 *
 *   await window.preview({ file, extra, clips, frames })                -> contact sheet (PNG data URL)
 *   await window.bake({ id, file, extra, clips, height, texSize, lod1 }) -> { bin, webp, info }
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptSimplifier } from '../node_modules/meshoptimizer/meshopt_simplifier.js';

const loader = new GLTFLoader();
const cache = new Map();
const norm = (n) => n.replace(/\.\d+$/, '').toLowerCase();

function skinnedOf(root) {
  let mesh = null;
  root.traverse((o) => {
    if (o.isSkinnedMesh && !mesh) mesh = o;
  });
  return mesh;
}
const hipsOf = (mesh) => mesh.skeleton.bones.find((b) => /hips$/i.test(b.name));

/** Loads once; remembers the rest hip position before anything animates the skeleton. */
function load(url) {
  if (!cache.has(url)) {
    cache.set(
      url,
      loader.loadAsync(url).then((g) => {
        const hips = hipsOf(skinnedOf(g.scene));
        g.userData.restHips = hips ? hips.position.clone() : null;
        return g;
      }),
    );
  }
  return cache.get(url);
}

/** All clips available to this character, own first, then borrowed (hip height rescaled). */
async function clipSet(file, extra) {
  const own = await load(file);
  const mesh = skinnedOf(own.scene);
  const hips = hipsOf(mesh);
  const out = new Map();
  for (const c of own.animations) out.set(norm(c.name), { clip: c, from: file, scale: 1 });
  for (const f of extra) {
    const g = await load(f);
    const a = own.userData.restHips;
    const b = g.userData.restHips;
    const scale = a && b && b.y ? a.y / b.y : 1;
    for (const c of g.animations) if (!out.has(norm(c.name))) out.set(norm(c.name), { clip: c, from: f, scale });
  }
  return { gltf: own, mesh, hips, clips: out };
}

/** In-place copy of a clip: hips drift removed (X/Z end where they start), hip height rescaled. */
function inPlace(entry, hipsName) {
  const clip = entry.clip.clone();
  let travel = 0;
  for (const t of clip.tracks) {
    if (!t.name.endsWith('.position') || !t.name.startsWith(hipsName)) continue;
    const v = t.values;
    const n = t.times.length;
    if (n < 2) continue;
    const T = t.times[n - 1] - t.times[0] || 1;
    const dx = v[(n - 1) * 3] - v[0];
    const dz = v[(n - 1) * 3 + 2] - v[2];
    travel = Math.hypot(dx, dz) * entry.scale;
    for (let i = 0; i < n; i++) {
      const k = (t.times[i] - t.times[0]) / T;
      v[i * 3] -= dx * k;
      v[i * 3 + 2] -= dz * k;
      v[i * 3] *= entry.scale;
      v[i * 3 + 1] *= entry.scale;
      v[i * 3 + 2] *= entry.scale;
    }
  }
  return { clip, travel };
}

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

function stage() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2f3a);
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x5a4a3a, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  return scene;
}

/** Contact sheet: one row per clip, `frames` evenly spaced poses, 3/4 front view (camera on +Z). */
window.preview = async ({ file, extra = [], clips, frames = 6, cell = 220, yaw = 0.5 }) => {
  const set = await clipSet(file, extra);
  const { gltf, mesh, hips } = set;
  const names = clips ?? [...set.clips.keys()];
  renderer.setSize(cell * frames, cell * names.length);
  const scene = stage();
  scene.add(gltf.scene);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  mesh.skeleton.pose();
  gltf.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const h = box.max.y - box.min.y;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  renderer.setScissorTest(true);
  names.forEach((name, row) => {
    const e = set.clips.get(name);
    if (!e) return;
    mixer.stopAllAction();
    mesh.skeleton.pose();
    const { clip } = inPlace(e, hips.name);
    mixer.clipAction(clip).reset().play();
    for (let f = 0; f < frames; f++) {
      mixer.setTime((clip.duration * f) / frames);
      gltf.scene.updateMatrixWorld(true);
      const x = f * cell;
      const y = (names.length - 1 - row) * cell;
      renderer.setViewport(x, y, cell, cell);
      renderer.setScissor(x, y, cell, cell);
      const d = h * 2.4;
      cam.position.set(Math.sin(yaw) * d, h * 0.75, Math.cos(yaw) * d);
      cam.lookAt(0, h * 0.5, 0);
      renderer.render(scene, cam);
    }
    mixer.uncacheClip(clip);
  });
  renderer.setScissorTest(false);
  const info = names.map((n) => {
    const e = set.clips.get(n);
    return e ? `${n}: ${e.clip.duration.toFixed(2)}s from ${e.from.split('/').pop()}${e.scale !== 1 ? ` hip×${e.scale.toFixed(3)}` : ''}` : `${n}: missing`;
  });
  scene.remove(gltf.scene);
  mesh.skeleton.pose();
  return { png: renderer.domElement.toDataURL('image/png'), info, bones: mesh.skeleton.bones.length, height: h };
};

function b64(buf) {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

// finger bones: Mixamo (LeftHandIndex1) or Quaternius (Index1.L, sanitised to Index1L by the loader)
const FINGER = /(Left|Right)Hand(Thumb|Index|Middle|Ring|Pinky)\d|(Thumb|Index|Middle|Ring|Pinky)\d(L|R)$/i;
const SIDE = { left: 'L', right: 'R', l: 'L', r: 'R' };

/**
 * Bakes one character. clips: [{ name, as?, fps? }] (`as` = name inside the game).
 * Binary ("ABCR"): u32 magic, u32 jsonLength, JSON (space padded to 4), then the buffers of json.layout.
 * anim: per frame, per (compacted) bone, 3 vec4 rows of the bone's 3×4 matrix.
 */
window.bake = async ({ id, file, extra = [], clips, height = 1.75, texSize = 512, lod1 = 1200, turn = 0 }) => {
  await MeshoptSimplifier.ready;
  const set = await clipSet(file, extra);
  const { gltf, mesh, hips } = set;
  const root = gltf.scene;
  root.position.set(0, 0, 0);
  root.rotation.set(0, turn, 0);
  root.scale.setScalar(1);
  mesh.skeleton.pose();
  root.updateMatrixWorld(true);
  const bones = mesh.skeleton.bones;
  const inv = mesh.skeleton.boneInverses;
  const g = mesh.geometry;
  const posAttr = g.getAttribute('position');
  const vc = posAttr.count;

  // rest pose bounds -> normalisation (feet on the ground, centred, game height)
  const rest = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < vc; i++) {
    mesh.getVertexPosition(i, v);
    rest.expandByPoint(v.applyMatrix4(mesh.matrixWorld));
  }
  const s = height / (rest.max.y - rest.min.y);
  const N = new THREE.Matrix4()
    .makeTranslation(-((rest.min.x + rest.max.x) / 2) * s, -rest.min.y * s, -((rest.min.z + rest.max.z) / 2) * s)
    .multiply(new THREE.Matrix4().makeScale(s, s, s));

  // fold fingers into the hand, keep only bones that actually move vertices
  const handOf = (side) => bones.findIndex((b) => new RegExp(`(${side === 'L' ? 'Left' : 'Right'}Hand|Wrist${side})$`, 'i').test(b.name));
  const remap = bones.map((b, i) => {
    const m = FINGER.exec(b.name);
    return m ? handOf(SIDE[(m[1] ?? m[4]).toLowerCase()]) : i;
  });
  const si = g.getAttribute('skinIndex');
  const sw = g.getAttribute('skinWeight');
  const used = new Set();
  for (let i = 0; i < vc; i++) for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > 1e-4) used.add(remap[si.getComponent(i, k)]);
  const table = [...used].sort((a, b) => a - b);
  const slot = new Map(table.map((b, i) => [b, i]));

  // bone rows per frame: N * boneWorld * boneInverse * bindMatrix (geometry space -> game space)
  const mixer = new THREE.AnimationMixer(root);
  const tmp = new THREE.Matrix4();
  const rows = [];
  const meta = [];
  for (const c of clips) {
    const e = set.clips.get(c.name);
    if (!e) throw new Error(`${id}: clip ${c.name} not found`);
    mixer.stopAllAction();
    mesh.skeleton.pose();
    const { clip, travel } = inPlace(e, hips.name);
    mixer.clipAction(clip).reset().play();
    const n = Math.max(2, Math.round(clip.duration * (c.fps ?? 30)));
    const start = rows.length;
    const pivot = new THREE.Vector3();
    // body frame landmarks (game space): spine axis (hips -> head) and shoulder line (right -> left)
    const head = bones.find((b) => /Head$/i.test(b.name));
    const lArm = bones.find((b) => /(LeftArm|UpperArmL)$/i.test(b.name));
    const rArm = bones.find((b) => /(RightArm|UpperArmR)$/i.test(b.name));
    const axis = new THREE.Vector3();
    const side = new THREE.Vector3();
    const w1 = new THREE.Vector3();
    const w2 = new THREE.Vector3();
    for (let f = 0; f < n; f++) {
      mixer.setTime((clip.duration * f) / n);
      root.updateMatrixWorld(true);
      const fr = new Float32Array(table.length * 12);
      table.forEach((b, k) => {
        tmp.multiplyMatrices(bones[b].matrixWorld, inv[b]).multiply(mesh.bindMatrix).premultiply(N);
        const e4 = tmp.elements; // column-major
        fr.set([e4[0], e4[4], e4[8], e4[12], e4[1], e4[5], e4[9], e4[13], e4[2], e4[6], e4[10], e4[14]], k * 12);
      });
      rows.push(fr);
      pivot.add(v.setFromMatrixPosition(hips.matrixWorld).applyMatrix4(N));
      if (head && lArm && rArm) {
        axis.add(w1.setFromMatrixPosition(head.matrixWorld).applyMatrix4(N).sub(w2.setFromMatrixPosition(hips.matrixWorld).applyMatrix4(N)));
        side.add(w1.setFromMatrixPosition(lArm.matrixWorld).applyMatrix4(N).sub(w2.setFromMatrixPosition(rArm.matrixWorld).applyMatrix4(N)));
      }
    }
    pivot.multiplyScalar(1 / n);
    // centre the clip over its own hips (X/Z), so the body sits on the pedestrian's position
    for (let f = start; f < rows.length; f++) {
      const fr = rows[f];
      for (let k = 0; k < table.length; k++) {
        fr[k * 12 + 3] -= pivot.x;
        fr[k * 12 + 11] -= pivot.z;
      }
    }
    pivot.x = 0;
    pivot.z = 0;
    let orient = null;
    if (c.bellyUp && axis.lengthSq() > 0) {
      // rotate the whole clip about its hips so the belly faces +Y and the head points +Z (direction of travel)
      const A = axis.normalize();
      let F = new THREE.Vector3().crossVectors(side.normalize(), A); // front (belly) of the body
      F.sub(A.clone().multiplyScalar(F.dot(A))).normalize();
      const S = new THREE.Vector3().crossVectors(F, A);
      const R = new THREE.Matrix4().makeBasis(S, F, A).transpose(); // rows S, F, A -> X, Y, Z
      const M = new THREE.Matrix4().multiplyMatrices(R, new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
      const B = new THREE.Matrix4();
      for (let f = start; f < rows.length; f++) {
        const fr = rows[f];
        for (let k = 0; k < table.length; k++) {
          const o = k * 12;
          B.set(fr[o], fr[o + 1], fr[o + 2], fr[o + 3], fr[o + 4], fr[o + 5], fr[o + 6], fr[o + 7], fr[o + 8], fr[o + 9], fr[o + 10], fr[o + 11], 0, 0, 0, 1);
          B.premultiply(M);
          const e = B.elements;
          fr.set([e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14]], o);
        }
      }
      orient = { belly: [F.x, F.y, F.z].map((x) => +x.toFixed(3)), head: [A.x, A.y, A.z].map((x) => +x.toFixed(3)) };
      pivot.set(0, 0, 0);
    }
    mixer.uncacheClip(clip);
    meta.push({
      name: c.as ?? c.name,
      source: c.name,
      from: e.from.split('/').pop(),
      start,
      frames: n,
      duration: clip.duration,
      // ground speed of the original root motion (game units / s): playback rate = speed / this
      speed: (travel * s) / clip.duration,
      // average hip position (game space): the swim clip pivots around it
      pivot: [pivot.x, pivot.y, pivot.z].map((x) => +x.toFixed(4)),
      // swim: already turned belly-up, head along +Z, centred on the hips
      bellyUp: !!orient,
      orient,
    });
  }
  mesh.skeleton.pose();
  const anim = new Float32Array(rows.length * table.length * 12);
  rows.forEach((r, i) => anim.set(r, i * r.length));

  // geometry
  const normal = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  const position = new Float32Array(vc * 3);
  const normals = new Float32Array(vc * 3);
  const uvs = new Float32Array(vc * 2);
  const joints = new Uint8Array(vc * 4);
  const weights = new Uint8Array(vc * 4);
  for (let i = 0; i < vc; i++) {
    position.set([posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)], i * 3);
    normals.set([normal.getX(i), normal.getY(i), normal.getZ(i)], i * 3);
    uvs.set([uv.getX(i), uv.getY(i)], i * 2);
    const w = [0, 1, 2, 3].map((k) => sw.getComponent(i, k));
    const sum = w.reduce((a, b) => a + b, 0) || 1;
    const q = w.map((x) => Math.round((x / sum) * 255));
    q[q.indexOf(Math.max(...q))] += 255 - q.reduce((a, b) => a + b, 0);
    for (let k = 0; k < 4; k++) joints[i * 4 + k] = q[k] > 0 ? slot.get(remap[si.getComponent(i, k)]) : 0;
    weights.set(q, i * 4);
  }
  const index = new Uint16Array(g.index.array);
  const [lodIdx] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(index), position, 3, uvs, 2, [0.5, 0.5], null, lod1 * 3, 0.2, ['Permissive']);
  const index1 = new Uint16Array(lodIdx);

  const parts = [
    ['position', position],
    ['normal', normals],
    ['uv', uvs],
    ['skinIndex', joints],
    ['skinWeight', weights],
    ['index', index],
    ['index1', index1],
    ['anim', anim],
  ];
  const layout = [];
  let off = 0;
  for (const [name, arr] of parts) {
    off = Math.ceil(off / 4) * 4;
    layout.push({ name, type: arr.constructor.name, offset: off, length: arr.length });
    off += arr.byteLength;
  }
  const header = {
    version: 1,
    id,
    vertexCount: vc,
    indexCount: index.length,
    lod1Count: index1.length,
    bones: table.length,
    boneNames: table.map((b) => bones[b].name.replace(/^mixamorig:?/, '')),
    frames: rows.length,
    height,
    clips: meta,
    layout,
  };
  const json = new TextEncoder().encode(JSON.stringify(header));
  const jlen = Math.ceil(json.length / 4) * 4;
  const out = new Uint8Array(8 + jlen + off);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x52434241, true); // "ABCR"
  dv.setUint32(4, jlen, true);
  out.set(json, 8);
  for (let i = json.length; i < jlen; i++) out[8 + i] = 0x20;
  parts.forEach(([, arr], i) => out.set(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), 8 + jlen + layout[i].offset));

  // texture -> small WebP (glTF UVs: no flip)
  const cv = document.createElement('canvas');
  cv.width = cv.height = texSize;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mesh.material.map.image, 0, 0, texSize, texSize);
  const webp = cv.toDataURL('image/webp', 0.86).split(',')[1];
  return { bin: b64(out.buffer), webp, info: { ...header, layout: undefined, bytes: out.length, scale: s } };
};
/** Dex portrait: one pose of the full-resolution character, transparent background, WebP. */
window.thumb = async ({ file, extra = [], clip = 'freaky', t = 0.3, size = 320, yaw = 0.45 }) => {
  const set = await clipSet(file, extra);
  const { gltf, mesh, hips } = set;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(size, size);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdcecff, 0x6b5a48, 1.3));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
  sun.position.set(3, 6, 5);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x9fd8ff, 1.4);
  rim.position.set(-4, 3, -5);
  scene.add(rim);
  scene.add(gltf.scene);
  mesh.skeleton.pose();
  gltf.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const e = set.clips.get(clip);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  if (e) {
    const { clip: c } = inPlace(e, hips.name);
    mixer.clipAction(c).play();
    mixer.setTime(c.duration * t);
  }
  gltf.scene.updateMatrixWorld(true);
  const h = box.max.y - box.min.y;
  // centre on the posed body (skinned bounds), keep the rest height for the zoom
  const c = new THREE.Box3().setFromObject(gltf.scene, true).getCenter(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(26, 1, 0.01, 100);
  const d = (h * 0.56) / Math.tan((26 * Math.PI) / 360);
  cam.position.set(c.x + Math.sin(yaw) * d, c.y + h * 0.08, c.z + Math.cos(yaw) * d);
  cam.lookAt(c.x, c.y, c.z);
  r.render(scene, cam);
  const webp = r.domElement.toDataURL('image/webp', 0.9).split(',')[1];
  mixer.stopAllAction();
  scene.remove(gltf.scene);
  mesh.skeleton.pose();
  r.dispose();
  return { webp };
};
window.ready = true;
