// Modelos do BSBASS THE GAME (carros do bonde, viatura, caminhão, personagens
// e peças do ferro-velho) com o mesmo visual de lá: material toon de 4 faixas
// com a textura também como emissiva e contorno escuro de espessura fixa em
// pixels. Funções copiadas do original, só atualizadas pra three.js atual.

import * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const BIN_SUFFIX: string = import.meta.env.VITE_BIN_SUFFIX || '';

export const CAMPAIGN_MODELS = [
  'car1', 'car3', 'car3b', 'police', 'truck2', 'chDuck', 'chDiey', 'chBella', 'chBozo',
  'jCrane', 'jTow1', 'jCont0', 'jTirePile', 'jFence', 'jStacked', 'jCrushStack', 'jGate1',
] as const;
export type CampaignModel = (typeof CAMPAIGN_MODELS)[number];

export interface ModelEntry {
  scene: THREE.Group;
  map: THREE.Texture | null;
}

export const MODELS: Partial<Record<CampaignModel | 'graffiti', ModelEntry>> = {};
export let FLAG_IMAGE: HTMLImageElement | null = null;

export const toonGrad = (() => {
  const d = new Uint8Array([150, 150, 150, 255, 192, 192, 192, 255, 226, 226, 226, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const glowTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
});

export const shadowTex = canvasTex(64, 128, (g) => {
  g.translate(32, 64);
  g.scale(1, 2);
  const r = g.createRadialGradient(0, 0, 2, 0, 0, 31);
  r.addColorStop(0, 'rgba(0,0,0,.9)');
  r.addColorStop(0.55, 'rgba(0,0,0,.55)');
  r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r;
  g.fillRect(-32, -32, 64, 64);
});
shadowTex.colorSpace = THREE.NoColorSpace;

export const beamTex = canvasTex(64, 128, (g, w, h) => {
  const lg = g.createLinearGradient(0, h, 0, 0);
  lg.addColorStop(0, 'rgba(255,255,255,.9)');
  lg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = lg;
  g.beginPath();
  g.moveTo(w * 0.38, h);
  g.lineTo(w * 0.62, h);
  g.lineTo(w, 0);
  g.lineTo(0, 0);
  g.closePath();
  g.fill();
});

export async function loadCampaignModels(loader: GLTFLoader, onEach?: () => void): Promise<void> {
  const tl = new THREE.TextureLoader();
  const tex = (url: string): Promise<THREE.Texture | null> =>
    new Promise((res) => {
      tl.load(
        url,
        (t) => {
          t.flipY = false;
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = 8;
          res(t);
        },
        undefined,
        () => res(null),
      );
    });
  await Promise.all(
    CAMPAIGN_MODELS.map(async (k) => {
      try {
        const [g, map] = await Promise.all([loader.loadAsync(`./campaign/models/${k}.glb${BIN_SUFFIX}`), k === 'police' ? null : tex(`./campaign/tex/${k}.webp`)]); // a viatura usa só as cores do material, igual ao site
        MODELS[k] = { scene: g.scene, map };
      } catch {
        /* sem esse modelo: a parte que usa ele fica de fora */
      }
      onEach?.();
    }),
  );
  MODELS.graffiti = { scene: new THREE.Group(), map: await tex('./campaign/tex/graffiti.webp') };
  FLAG_IMAGE = await new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = './campaign/bsbass.webp';
  });
}

export function makeMat(M: ModelEntry, tint?: THREE.ColorRepresentation, map?: THREE.Texture | null): THREE.MeshToonMaterial {
  const t = map || M.map;
  const m = new THREE.MeshToonMaterial({ map: t, gradientMap: toonGrad, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.13 });
  if (tint) m.color.set(tint);
  return m;
}

const outlineMat = new THREE.MeshBasicMaterial({ color: 0x0c0a10, side: THREE.BackSide });
export const OUT_U = { uRes: { value: new THREE.Vector2(innerWidth, innerHeight) } };

function smoothNormals(geo: THREE.BufferGeometry): void {
  if (geo.attributes.outlineNormal) return;
  const pa = geo.attributes.position!, N = pa.count;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const nn = geo.attributes.normal!, map = new Map<string, number>(), acc: number[] = [], ids = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    const k = Math.round(pa.getX(i) * 1e4) + '_' + Math.round(pa.getY(i) * 1e4) + '_' + Math.round(pa.getZ(i) * 1e4);
    let id = map.get(k);
    if (id === undefined) {
      id = acc.length / 3;
      map.set(k, id);
      acc.push(0, 0, 0);
    }
    ids[i] = id;
    acc[id * 3]! += nn.getX(i);
    acc[id * 3 + 1]! += nn.getY(i);
    acc[id * 3 + 2]! += nn.getZ(i);
  }
  const out = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const id = ids[i]!;
    const x = acc[id * 3]!, y = acc[id * 3 + 1]!, z = acc[id * 3 + 2]!;
    const l = Math.hypot(x, y, z) || 1;
    out[i * 3] = x / l;
    out[i * 3 + 1] = y / l;
    out[i * 3 + 2] = z / l;
  }
  geo.setAttribute('outlineNormal', new THREE.BufferAttribute(out, 3));
}

/** contorno com espessura constante em pixels (de perto e de longe) */
export function outlined(mesh: THREE.Mesh, px = 1.2): THREE.Mesh {
  smoothNormals(mesh.geometry);
  const m = outlineMat.clone();
  m.userData.px = { value: px };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPx = m.userData.px;
    sh.uniforms.uRes = OUT_U.uRes;
    sh.vertexShader =
      'attribute vec3 outlineNormal;\nuniform float uPx;\nuniform vec2 uRes;\n' +
      sh.vertexShader.replace(
        '#include <project_vertex>',
        'vec4 mvPosition=modelViewMatrix*vec4(transformed,1.0);gl_Position=projectionMatrix*mvPosition;\n' +
          'vec2 dd=(projectionMatrix*vec4(normalize(normalMatrix*outlineNormal),0.0)).xy;float ll=length(dd);if(ll>1e-5)dd/=ll;\n' +
          'gl_Position.xy+=dd*uPx*2.0/uRes*gl_Position.w;',
      );
  };
  m.customProgramCacheKey = () => 'outline-px';
  const o = new THREE.Mesh(mesh.geometry, m);
  o.renderOrder = -1;
  return o;
}

/** personagem de pé: altura real, pés no chão, contorno um pouco mais fino */
export function makeCharacter(key: CampaignModel, height = 1.78): THREE.Group | null {
  const M = MODELS[key];
  if (!M) return null;
  const obj = M.scene.clone(true), mat = makeMat(M);
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = mat;
  });
  const wrap = new THREE.Group();
  wrap.add(obj);
  wrap.updateMatrixWorld(true);
  let b = new THREE.Box3().setFromObject(wrap);
  obj.scale.multiplyScalar(height / (b.max.y - b.min.y));
  wrap.updateMatrixWorld(true);
  b = new THREE.Box3().setFromObject(wrap);
  const c = b.getCenter(new THREE.Vector3());
  obj.position.x -= c.x;
  obj.position.z -= c.z;
  obj.position.y -= b.min.y;
  wrap.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  meshes.forEach((ms) => {
    ms.updateWorldMatrix(true, false);
    ms.add(outlined(ms, 1.1));
  });
  return wrap;
}

export interface WheelNode {
  node: THREE.Object3D;
  sign: number;
  r: number;
  ax3: THREE.Vector3;
  q0: THREE.Quaternion;
  ang: number;
  cS: THREE.Vector3 | null;
  base: THREE.Vector3;
}

export function makeModel(key: CampaignModel, len: number, mat: THREE.Material, frontZ: boolean): { wrap: THREE.Group; w: number; h: number; l: number; wheels: WheelNode[] } {
  const obj = MODELS[key]!.scene.clone(true);
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = mat;
  });
  const wrap = new THREE.Group();
  if (!frontZ) obj.rotation.y = Math.PI / 2;
  wrap.add(obj);
  wrap.updateMatrixWorld(true);
  let b = new THREE.Box3().setFromObject(wrap), sz = b.getSize(new THREE.Vector3());
  obj.scale.multiplyScalar(len / sz.z);
  wrap.updateMatrixWorld(true);
  b = new THREE.Box3().setFromObject(wrap);
  const c = b.getCenter(new THREE.Vector3());
  obj.position.x -= c.x;
  obj.position.z -= c.z;
  obj.position.y -= b.min.y;
  wrap.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  meshes.forEach((ms) => {
    ms.updateWorldMatrix(true, false);
    ms.add(outlined(ms, ms.matrixWorld.getMaxScaleOnAxis()));
  });
  sz = new THREE.Box3().setFromObject(wrap).getSize(new THREE.Vector3());
  // rodas separadas na otimização: nome wheel_<eixo>_<n>
  const wheels: WheelNode[] = [];
  const _a = new THREE.Vector3(), _b = new THREE.Box3(), _s = new THREE.Vector3();
  obj.traverse((o) => {
    const m = /^wheel_([xz])_/.exec(o.name || '');
    if (!m) return;
    const ax = m[1];
    _a.set(ax === 'x' ? 1 : 0, 0, ax === 'z' ? 1 : 0).applyQuaternion(obj.quaternion);
    _b.setFromObject(o).getSize(_s);
    const r = Math.max(ax === 'x' ? _s.z : _s.x, _s.y) / 2;
    if (r > 0.05) {
      const axv = new THREE.Vector3(ax === 'x' ? 1 : 0, 0, ax === 'z' ? 1 : 0);
      const ms = (o as THREE.Mesh).isMesh ? (o as THREE.Mesh) : (o.children.find((q) => (q as THREE.Mesh).isMesh) as THREE.Mesh | undefined);
      let cS: THREE.Vector3 | null = null;
      if (ms) {
        ms.geometry.computeBoundingBox();
        const cg = ms.geometry.boundingBox!.getCenter(new THREE.Vector3());
        if (ax === 'x') cg.x = 0;
        else cg.z = 0;
        cS = cg.multiply(o.scale);
        if (cS.length() < 0.004) cS = null;
      }
      wheels.push({ node: o, sign: Math.sign(_a.x) || 1, r, ax3: axv, q0: o.quaternion.clone(), ang: 0, cS, base: o.position.clone() });
    }
  });
  return { wrap, w: sz.x, h: sz.y, l: sz.z, wheels };
}

// ---------------- peças de cenário (ferro-velho) ----------------
const PROP_SPEC: Record<string, { size: number; ax: 'x' | 'y' | 'xz' }> = {
  jCrane: { size: 16, ax: 'y' },
  jTow1: { size: 7, ax: 'y' },
  jCont0: { size: 4, ax: 'xz' },
  jTirePile: { size: 3.4, ax: 'xz' },
  jFence: { size: 9, ax: 'x' },
  jStacked: { size: 7.5, ax: 'y' },
  jCrushStack: { size: 6.5, ax: 'y' },
  jGate1: { size: 10, ax: 'x' },
};

export function propGeo(key: CampaignModel): THREE.BufferGeometry {
  const sc = MODELS[key]!.scene;
  sc.updateMatrixWorld(true);
  let geo: THREE.BufferGeometry | null = null;
  let mw: THREE.Matrix4 | null = null;
  sc.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !geo) {
      geo = (o as THREE.Mesh).geometry.clone();
      mw = o.matrixWorld;
    }
  });
  const g = geo as unknown as THREE.BufferGeometry;
  // atributos quantizados (meshopt) viram float, como no original
  for (const a of Object.keys(g.attributes)) {
    const at = g.attributes[a] as THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
    const isI = !!(at as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute;
    const A = isI ? (at as THREE.InterleavedBufferAttribute).data.array : (at as THREE.BufferAttribute).array;
    if (A instanceof Float32Array && !isI) continue;
    const st = isI ? (at as THREE.InterleavedBufferAttribute).data.stride : at.itemSize;
    const off = isI ? (at as THREE.InterleavedBufferAttribute).offset : 0;
    const is = at.itemSize, f = new Float32Array(at.count * is);
    const d = !at.normalized ? 1 : A instanceof Int16Array ? 32767 : A instanceof Uint16Array ? 65535 : A instanceof Int8Array ? 127 : A instanceof Uint8Array ? 255 : 1;
    for (let i = 0; i < at.count; i++) for (let j = 0; j < is; j++) f[i * is + j] = Math.max(-1, (A[i * st + off + j] as number) / d);
    g.setAttribute(a, new THREE.BufferAttribute(f, is));
  }
  g.applyMatrix4(mw as unknown as THREE.Matrix4);
  g.computeBoundingBox();
  const b = g.boundingBox!, sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  g.translate(-c.x, -b.min.y, -c.z);
  const sp = PROP_SPEC[key]!;
  const ref = sp.ax === 'y' ? sz.y : sp.ax === 'x' ? sz.x : Math.max(sz.x, sz.z);
  g.scale(sp.size / ref, sp.size / ref, sp.size / ref);
  if (!g.attributes.normal) g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}

export function propMat(key: CampaignModel): THREE.MeshToonMaterial {
  const M = MODELS[key]!;
  if (M.map) return new THREE.MeshToonMaterial({ map: M.map, gradientMap: toonGrad, emissive: 0xffffff, emissiveMap: M.map, emissiveIntensity: 0.1 });
  return new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGrad, emissive: 0x1e1a18 });
}

// ---------------- pintura (mesma lógica da garagem e da corrida) ----------------
export function makePaintMat(M: ModelEntry): THREE.MeshToonMaterial {
  const m = makeMat(M);
  m.userData.paint = { value: new THREE.Color(1, 1, 1) };
  m.userData.amt = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPaint = m.userData.paint;
    sh.uniforms.uAmt = m.userData.amt;
    sh.fragmentShader =
      'uniform vec3 uPaint;uniform float uAmt;float pMask=0.;float pL=0.;\n' +
      sh.fragmentShader
        .replace(
          '#include <map_fragment>',
          '#include <map_fragment>\n{vec3 c=diffuseColor.rgb;float mx=max(c.r,max(c.g,c.b)),mn=min(c.r,min(c.g,c.b));float sat=(mx-mn)/(mx+1e-4);pMask=smoothstep(.3,.55,sat)*smoothstep(.06,.18,mx)*uAmt;pL=dot(c,vec3(.3,.59,.11));diffuseColor.rgb=mix(c,uPaint*(.35+1.6*pL),pMask);}',
        )
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance=mix(totalEmissiveRadiance,uPaint*(.35+1.6*pL)*.14,pMask);');
  };
  m.customProgramCacheKey = () => 'paint';
  return m;
}

export function setPaint(mat: THREE.Material, color: string | null): void {
  const u = mat.userData as { amt?: { value: number }; paint?: { value: THREE.Color } };
  if (!u.amt || !u.paint) return;
  u.amt.value = color ? 1 : 0;
  if (color) u.paint.value.set(color);
}
