/*
 * Step 0 for generic pedestrians (in a browser, driven by bake.mjs prep): turns a rigged low-poly
 * character (Quaternius "Ultimate Modular" rig: Body/Hips/Abdomen/Torso/Chest/Neck/Head, UpperArm/
 * LowerArm/Wrist, UpperLeg/LowerLeg and IK-driven Foot bones under Root) into a crowd-ready GLB:
 *
 *  - every primitive merged into one skinned mesh; flat material colours become a small palette
 *    texture (one cell per material), vertices welded and smooth-shaded;
 *  - the four crowd clips are authored here with a pose system that aims each limb segment at a
 *    direction in the body frame (left, up, forward), so it works whatever the bones' local axes are:
 *      run    the pack's run cycle with the arms thrown up in panic, plus root motion measured
 *             from the planted foot (the game scales playback to the pedestrian's speed);
 *      afraid crouched, arms shielding the head, trembling;
 *      freaky hopping in place, arms flailing overhead, head shaking;
 *      swim   being abducted: arched back, arms reaching and waving, legs kicking (the baker
 *             turns it belly-up);
 *  - the IK feet (children of Root, not of the shins) are moved to the shin tips every frame.
 *
 *   await window.prep({ file, height })            -> { glb (base64), info }
 *   await window.sheet({ file, clips, frames })    -> PNG contact sheet of the prepared clips
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const loader = new GLTFLoader();
const TAU = Math.PI * 2;
const FPS = 30;

// props some characters carry (the suit has a pistol): not for pedestrians
const PROP = /(pistol|gun|rifle|sword|axe|knife|shield|bow|staff|weapon)/i;
function skinnedMeshes(root) {
  const all = [];
  root.traverse((o) => o.isSkinnedMesh && all.push(o));
  const isProp = (o) => {
    for (let p = o; p; p = p.parent) if (PROP.test(p.name)) return true;
    return false;
  };
  const props = all.filter(isProp);
  for (const o of props) o.parent.remove(o);
  return all.filter((o) => !props.includes(o));
}

/** One skinned mesh, palette texture instead of flat materials, welded + smooth normals. */
function mergeCharacter(gltf) {
  const meshes = skinnedMeshes(gltf.scene);
  const m0 = meshes[0];
  const mats = [];
  for (const m of meshes) if (!mats.includes(m.material)) mats.push(m.material);
  const grid = mats.length <= 16 ? 4 : 8;
  const cell = 256 / grid;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  mats.forEach((mat, k) => {
    ctx.fillStyle = '#' + mat.color.getHexString();
    ctx.fillRect((k % grid) * cell, Math.floor(k / grid) * cell, cell, cell);
  });
  const inv0 = m0.bindMatrix.clone().invert();
  const P = [];
  const SI = [];
  const SW = [];
  const UV = [];
  const v = new THREE.Vector3();
  for (const m of meshes) {
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    const M = new THREE.Matrix4().multiplyMatrices(inv0, m.bindMatrix);
    const k = mats.indexOf(m.material);
    const u = ((k % grid) + 0.5) / grid;
    const w = (Math.floor(k / grid) + 0.5) / grid;
    const pos = g.getAttribute('position');
    const si = g.getAttribute('skinIndex');
    const sw = g.getAttribute('skinWeight');
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(M);
      P.push(v.x, v.y, v.z);
      SI.push(si.getX(i), si.getY(i), si.getZ(i), si.getW(i));
      SW.push(sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i));
      UV.push(u, w);
    }
  }
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  geo = mergeVertices(geo, 1e-4);
  geo.computeVertexNormals();
  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
  mesh.name = 'Character';
  const skeleton = new THREE.Skeleton(m0.skeleton.bones, m0.skeleton.boneInverses.map((b) => b.clone()));
  const parent = m0.parent;
  for (const m of meshes) m.parent.remove(m);
  parent.add(mesh);
  mesh.position.copy(m0.position);
  mesh.quaternion.copy(m0.quaternion);
  mesh.scale.copy(m0.scale);
  gltf.scene.updateMatrixWorld(true);
  mesh.bind(skeleton, m0.bindMatrix);
  return { mesh, materials: mats.length, vertices: geo.getAttribute('position').count, triangles: geo.index.count / 3 };
}

/** Rig wrapper: rest data + aim-based posing in the body frame. */
function rig(root, mesh) {
  const bone = (n) => {
    const b = mesh.skeleton.bones.find((x) => x.name === n);
    if (!b) throw new Error('bone ' + n);
    return b;
  };
  const B = {};
  for (const n of ['Root', 'Body', 'Hips', 'Abdomen', 'Torso', 'Chest', 'Neck', 'Head', 'UpperArmL', 'LowerArmL', 'WristL', 'UpperArmR', 'LowerArmR', 'WristR',
    'UpperLegL', 'LowerLegL', 'UpperLegR', 'LowerLegR', 'FootL', 'FootR', 'PTL', 'PTR']) B[n] = bone(n);
  mesh.skeleton.pose();
  root.updateMatrixWorld(true);
  const W = (b) => b.getWorldPosition(new THREE.Vector3());
  // body frame from the rest pose: up, forward (knee pole targets sit in front of the knees), left
  const U = new THREE.Vector3(0, 1, 0);
  const F = W(B.PTL).add(W(B.PTR)).multiplyScalar(0.5).sub(W(B.UpperLegL).add(W(B.UpperLegR)).multiplyScalar(0.5));
  F.y = 0;
  F.normalize();
  const L = new THREE.Vector3().crossVectors(U, F).normalize();
  const dir = (l, u, f) => new THREE.Vector3().addScaledVector(L, l).addScaledVector(U, u).addScaledVector(F, f).normalize();
  // segment tips in bone-local space (the next joint, or the IK foot for the shins)
  const TIP = {
    Abdomen: 'Torso', Torso: 'Chest', Chest: 'Neck', Neck: 'Head', UpperArmL: 'LowerArmL', LowerArmL: 'WristL', UpperArmR: 'LowerArmR', LowerArmR: 'WristR',
    UpperLegL: 'LowerLegL', LowerLegL: 'FootL', UpperLegR: 'LowerLegR', LowerLegR: 'FootR',
  };
  const tip = {};
  for (const [a, b] of Object.entries(TIP)) tip[a] = B[a].worldToLocal(W(B[b]));
  const rest = {
    q: new Map(mesh.skeleton.bones.map((b) => [b, b.quaternion.clone()])),
    p: new Map(mesh.skeleton.bones.map((b) => [b, b.position.clone()])),
    footY: Math.min(W(B.FootL).y, W(B.FootR).y),
    footQ: { L: B.FootL.getWorldQuaternion(new THREE.Quaternion()), R: B.FootR.getWorldQuaternion(new THREE.Quaternion()) },
    shinDir: {
      L: W(B.FootL).sub(W(B.LowerLegL)).normalize(),
      R: W(B.FootR).sub(W(B.LowerLegR)).normalize(),
    },
    height: 0,
  };
  const box = new THREE.Box3().setFromObject(mesh);
  rest.height = box.max.y - box.min.y;
  const _q = new THREE.Quaternion();
  const _pq = new THREE.Quaternion();
  const _wq = new THREE.Quaternion();
  /** Rotates bone `n` (in world space, minimal arc) so its segment points along world direction d. */
  function aim(n, d) {
    const b = B[n];
    b.updateWorldMatrix(true, false);
    const p = W(b);
    const cur = b.localToWorld(tip[n].clone()).sub(p).normalize();
    _q.setFromUnitVectors(cur, d);
    b.getWorldQuaternion(_wq);
    b.parent.getWorldQuaternion(_pq);
    b.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq)));
    b.updateMatrixWorld(true);
  }
  /** Moves a bone in world space. */
  function shiftWorld(b, off) {
    const wp = W(b).add(off);
    b.parent.updateWorldMatrix(true, false);
    b.position.copy(b.parent.worldToLocal(wp));
    b.updateMatrixWorld(true);
  }
  /** IK feet: glue each foot bone to its shin tip, turned with the shin. */
  function feet() {
    for (const s of ['L', 'R']) {
      const shin = B['LowerLeg' + s];
      const foot = B['Foot' + s];
      shin.updateWorldMatrix(true, false);
      const t = shin.localToWorld(tip['LowerLeg' + s].clone());
      foot.parent.updateWorldMatrix(true, false);
      foot.position.copy(foot.parent.worldToLocal(t.clone()));
      const sd = t.sub(W(shin)).normalize();
      const wq = new THREE.Quaternion().setFromUnitVectors(rest.shinDir[s], sd).multiply(rest.footQ[s]);
      foot.quaternion.copy(foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wq));
      foot.updateMatrixWorld(true);
    }
  }
  function reset() {
    for (const b of mesh.skeleton.bones) {
      b.quaternion.copy(rest.q.get(b));
      b.position.copy(rest.p.get(b));
    }
    root.updateMatrixWorld(true);
  }
  /** Lowest shin tip (world y). */
  function lowestTip() {
    let y = Infinity;
    for (const s of ['L', 'R']) y = Math.min(y, B['LowerLeg' + s].localToWorld(tip['LowerLeg' + s].clone()).y);
    return y;
  }
  return { B, U, F, L, dir, aim, shiftWorld, feet, reset, lowestTip, rest, W };
}

// ─── poses: t = time in the loop, P = loop length; each returns { dirs, ground, lift }
const S = (t, P, k = 1, ph = 0) => Math.sin((TAU * k * t) / P + ph);
const C = (t, P, k = 1, ph = 0) => Math.cos((TAU * k * t) / P + ph);
const POSES = {
  // crouched, shielding the head, trembling
  afraid: { P: 1.2, pose: (t, P, d) => {
    const j = (k, ph) => 0.035 * S(t, P, k, ph);
    return { ground: true, lift: 0, dirs: {
      Abdomen: d(j(11, 0), 0.96, 0.28), Torso: d(0, 0.94, 0.33), Chest: d(j(13, 1), 0.92, 0.38), Neck: d(j(17, 2), 0.78, 0.62 + j(9, 0)),
      UpperArmL: d(0.42, 0.42 + j(14, 0), 0.8), LowerArmL: d(-0.62 + j(12, 1), 0.74, 0.22), UpperArmR: d(-0.42, 0.42 + j(14, 2), 0.8), LowerArmR: d(0.62 + j(12, 3), 0.74, 0.22),
      UpperLegL: d(0.16, -0.86, 0.42), LowerLegL: d(0.06, -0.95, -0.24), UpperLegR: d(-0.16, -0.86, 0.42), LowerLegR: d(-0.06, -0.95, -0.24),
    } };
  } },
  // hopping in place, arms flailing overhead, head shaking
  freaky: { P: 0.8, pose: (t, P, d) => {
    const a = S(t, P);
    const hop = Math.max(0, S(t, P, 2));
    return { ground: true, lift: 0.07 * hop, dirs: {
      Abdomen: d(0.12 * a, 0.98, 0.05), Chest: d(0.25 * a, 0.95, 0.12), Neck: d(0.45 * S(t, P, 3), 0.9, 0.2),
      UpperArmL: d(0.6 + 0.5 * a, 0.7, 0.35 * C(t, P)), LowerArmL: d(0.1 + 0.8 * S(t, P, 2, 0.6), 0.85, 0.35 * C(t, P, 2)),
      UpperArmR: d(-0.6 + 0.5 * a, 0.7, -0.35 * C(t, P)), LowerArmR: d(-0.1 + 0.8 * S(t, P, 2, 2.2), 0.85, 0.35 * C(t, P, 2, 1)),
      UpperLegL: d(0.12, -0.9, 0.45 * Math.max(0, a)), LowerLegL: d(0.05, -0.94, -0.55 * Math.max(0, a)),
      UpperLegR: d(-0.12, -0.9, 0.45 * Math.max(0, -a)), LowerLegR: d(-0.05, -0.94, -0.55 * Math.max(0, -a)),
    } };
  } },
  // abducted: arched, arms reaching and waving, legs kicking (baked belly-up later)
  swim: { P: 1.6, pose: (t, P, d) => {
    const a = S(t, P);
    const b = S(t, P, 1, Math.PI);
    return { ground: false, lift: 0, dirs: {
      Abdomen: d(0.06 * a, 0.97, -0.18), Chest: d(0.08 * a, 0.95, -0.24), Neck: d(0.2 * S(t, P, 1, 1), 0.82, -0.45),
      UpperArmL: d(0.55, 0.5 + 0.35 * a, 0.55 + 0.3 * C(t, P)), LowerArmL: d(0.35, 0.65 + 0.3 * S(t, P, 1, 0.9), 0.55),
      UpperArmR: d(-0.55, 0.5 + 0.35 * b, 0.55 + 0.3 * C(t, P, 1, Math.PI)), LowerArmR: d(-0.35, 0.65 + 0.3 * S(t, P, 1, 0.9 + Math.PI), 0.55),
      UpperLegL: d(0.14, -0.88, 0.22 + 0.35 * S(t, P, 2)), LowerLegL: d(0.08, -0.9, -0.15 - 0.35 * (0.5 + 0.5 * S(t, P, 2, 1.1))),
      UpperLegR: d(-0.14, -0.88, 0.22 + 0.35 * S(t, P, 2, Math.PI)), LowerLegR: d(-0.08, -0.9, -0.15 - 0.35 * (0.5 + 0.5 * S(t, P, 2, 1.1 + Math.PI))),
    } };
  } },
};
// the run keeps the pack's legs and body; only the arms go up in panic
const RUN_ARMS = (t, P, d) => ({
  UpperArmL: d(0.48, 0.72, 0.35 + 0.2 * S(t, P)), LowerArmL: d(0.1 + 0.25 * S(t, P, 2), 0.95, 0.2),
  UpperArmR: d(-0.48, 0.72, 0.35 - 0.2 * S(t, P)), LowerArmR: d(-0.1 - 0.25 * S(t, P, 2, 1), 0.95, 0.2),
  Neck: d(0, 0.85, 0.45),
});
const ORDER = ['Abdomen', 'Torso', 'Chest', 'Neck', 'UpperArmL', 'LowerArmL', 'UpperArmR', 'LowerArmR', 'UpperLegL', 'LowerLegL', 'UpperLegR', 'LowerLegR'];

/** Samples a pose function into a looping clip (quaternions of the posed bones + Body/Hips/feet positions). */
function author(name, root, R, P, frame) {
  const n = Math.round(P * FPS);
  const tracked = [...new Set([...ORDER, 'Body', 'Hips', 'FootL', 'FootR'])].map((k) => R.B[k]);
  const times = [];
  const qv = new Map(tracked.map((b) => [b, []]));
  const pv = new Map(tracked.map((b) => [b, []]));
  for (let f = 0; f <= n; f++) {
    const t = (P * (f % n)) / n;
    times.push((P * f) / n);
    frame(t);
    for (const b of tracked) {
      qv.get(b).push(...b.quaternion.toArray());
      pv.get(b).push(...b.position.toArray());
    }
  }
  const tracks = [];
  for (const b of tracked) {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, qv.get(b)));
    tracks.push(new THREE.VectorKeyframeTrack(`${b.name}.position`, times, pv.get(b)));
  }
  return new THREE.AnimationClip(name, P, tracks);
}

async function build(file) {
  const gltf = await loader.loadAsync(file);
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const merged = mergeCharacter(gltf);
  const R = rig(root, merged.mesh);
  const posed = (dirs) => {
    for (const k of ORDER) if (dirs[k]) R.aim(k, dirs[k]);
  };
  const clips = [];
  // authored clips
  for (const [name, { P, pose }] of Object.entries(POSES)) {
    clips.push(author(name, root, R, P, (t) => {
      R.reset();
      const { dirs, ground, lift } = pose(t, P, R.dir);
      posed(dirs);
      if (ground) {
        const dy = R.rest.footY + lift * R.rest.height - R.lowestTip();
        R.shiftWorld(R.B.Body, new THREE.Vector3(0, dy, 0));
      }
      R.feet();
    }));
  }
  // run: the pack's cycle, arms in panic, root motion from the planted foot
  const src = gltf.animations.find((a) => a.name === 'Run');
  const mixer = new THREE.AnimationMixer(root);
  const act = mixer.clipAction(src).play();
  const Pr = src.duration;
  // ground speed: planted foot (lowest third of its height) slides back at the body's speed
  let sum = 0;
  let cnt = 0;
  const N = 48;
  let minY = Infinity;
  let maxY = -Infinity;
  const samples = [];
  for (let f = 0; f <= N; f++) {
    R.reset();
    mixer.setTime((Pr * f) / N);
    root.updateMatrixWorld(true);
    const s = { L: R.W(R.B.FootL), R: R.W(R.B.FootR) };
    samples.push(s);
    for (const k of ['L', 'R']) {
      minY = Math.min(minY, s[k].y);
      maxY = Math.max(maxY, s[k].y);
    }
  }
  for (let f = 1; f <= N; f++) {
    for (const k of ['L', 'R']) {
      const a = samples[f - 1][k];
      const b = samples[f][k];
      if (b.y < minY + (maxY - minY) * 0.25 && a.y < minY + (maxY - minY) * 0.25) {
        sum += -b.clone().sub(a).dot(R.F) / (Pr / N);
        cnt++;
      }
    }
  }
  const speed = cnt ? Math.max(0.5, sum / cnt) : 2.5;
  const fwdLocal = (() => {
    R.reset();
    const h = R.B.Hips;
    h.parent.updateWorldMatrix(true, false);
    const a = h.parent.worldToLocal(R.W(h));
    const b = h.parent.worldToLocal(R.W(h).add(R.F));
    return b.sub(a);
  })();
  clips.push(author('run', root, R, Pr, (t) => {
    R.reset();
    mixer.setTime(t);
    root.updateMatrixWorld(true);
    posed(RUN_ARMS(t, Pr, R.dir));
    // root motion, so the baker can measure the speed (it removes the drift again)
    R.B.Hips.position.addScaledVector(fwdLocal, speed * t);
    R.B.Hips.updateMatrixWorld(true);
  }));
  // the last key of the run is the loop end: drift must keep going, not jump back
  const runClip = clips[clips.length - 1];
  for (const tr of runClip.tracks) {
    if (tr.name !== `${R.B.Hips.name}.position`) continue;
    const n = tr.times.length;
    const base = new THREE.Vector3().fromArray(tr.values, 0);
    const end = base.clone().addScaledVector(fwdLocal, speed * Pr);
    end.y = tr.values[(n - 1) * 3 + 1];
    tr.values[(n - 1) * 3] = end.x;
    tr.values[(n - 1) * 3 + 2] = end.z;
  }
  act.stop();
  R.reset();
  root.animations = clips;
  return { gltf, root, mesh: merged.mesh, R, clips, info: { ...merged, speed: +speed.toFixed(3), height: +R.rest.height.toFixed(3), clips: clips.map((c) => `${c.name} ${c.duration.toFixed(2)}s`) } };
}

function b64(buf) {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

window.prep = async ({ file }) => {
  const { root, clips, info } = await build(file);
  const glb = await new GLTFExporter().parseAsync(root, { binary: true, animations: clips, onlyVisible: false });
  return { glb: b64(glb), info };
};

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

/** Contact sheet straight from the authored clips (before export), 3/4 front view. */
window.sheet = async ({ file, frames = 6, cell = 200, yaw = 0.6 }) => {
  const { root, clips, mesh, R } = await build(file);
  renderer.setSize(cell * frames, cell * clips.length);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2f3a);
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x5a4a3a, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  scene.add(root);
  const mixer = new THREE.AnimationMixer(root);
  const h = R.rest.height;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  renderer.setScissorTest(true);
  clips.forEach((clip, row) => {
    mixer.stopAllAction();
    R.reset();
    mixer.clipAction(clip).reset().play();
    for (let f = 0; f < frames; f++) {
      mixer.setTime((clip.duration * f) / frames);
      root.updateMatrixWorld(true);
      const hp = R.W(R.B.Hips);
      const x = f * cell;
      const y = (clips.length - 1 - row) * cell;
      renderer.setViewport(x, y, cell, cell);
      renderer.setScissor(x, y, cell, cell);
      const d = h * 2.6;
      const fx = R.F.x * Math.cos(yaw) - R.L.x * Math.sin(yaw);
      const fz = R.F.z * Math.cos(yaw) - R.L.z * Math.sin(yaw);
      cam.position.set(hp.x + fx * d, h * 0.7, hp.z + fz * d);
      cam.lookAt(hp.x, h * 0.5, hp.z);
      renderer.render(scene, cam);
    }
  });
  renderer.setScissorTest(false);
  void mesh;
  return { png: renderer.domElement.toDataURL('image/png') };
};
window.ready = true;
