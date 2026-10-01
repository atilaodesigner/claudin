// Carros de verdade (GLB baixados do Sketchfab, CC-BY): normaliza qualquer
// modelo pro sistema do jogo (frente em +Z, esquerda em +X, chão em y = 0,
// comprimento real em metros), acha as rodas pra girar/esterçar, acha a
// pintura pra trocar a cor e marca onde ficam faróis, lanternas e escapamento.

import * as THREE from 'three';

export interface CarEntry {
  id: string;
  file: string;
  role: 'player' | 'traffic' | 'truck';
  name: string;
  /** comprimento real (m) */
  length: number;
  /** giro extra (graus) pra frente do modelo cair em +Z; o eixo mais comprido já é detectado sozinho */
  yaw?: number;
  /** a detecção automática de frente/trás errou neste modelo: vira 180° depois dela */
  flip?: boolean;
  /** regex (sem barras) pros nomes de material da pintura; senão pega o material colorido de maior área */
  paint?: string;
  /** false = mantém a cor original (ônibus com pintura de empresa, por exemplo) */
  recolor?: boolean;
  /** peso no sorteio do tráfego */
  weight?: number;
  /** tipo pro tráfego: 4 = ônibus (anda mais devagar, mais pesado) */
  bus?: boolean;
  credit: string;
  license: string;
  url: string;
}

export interface WheelRig {
  steer: THREE.Group;
  spin: THREE.Group;
}

export interface PreparedCar {
  /** carro normalizado; as rodas detectadas viram grupos steer/spin dentro dele */
  root: THREE.Group;
  wheels: WheelRig[]; // DE, DD, TE, TD quando achou as quatro
  paintMats: THREE.MeshStandardMaterial[];
  halfW: number;
  halfL: number;
  height: number;
  wheelR: number;
}

// "rim" só como palavra própria (senão pega "Trim", o acabamento do interior)
const WHEEL_RE = /wheel|tire|tyre|(?<![a-z])rim|roda|pneu|llanta|rueda|felge|reifen/i;
const NOT_WHEEL_RE = /steering|volante|spare|estepe|arch|well|fender|interior|door|porta/i;
const PAINT_RE = /paint|body|carpaint|car_paint|exterior|lataria|pintura|carroceria|color|colour/i;
const NOT_PAINT_RE = /glass|window|vidro|chrome|cromo|tire|tyre|rubber|light|lamp|lens|interior|seat|plastic|black|grill|rim|wheel/i;

function meshMaterials(m: THREE.Mesh): THREE.Material[] {
  return Array.isArray(m.material) ? m.material : [m.material];
}

/** nome do nó ou de algum pai até a raiz do modelo */
function chainName(o: THREE.Object3D, stop: THREE.Object3D): string {
  let s = '';
  for (let p: THREE.Object3D | null = o; p && p !== stop; p = p.parent) s += ` ${p.name}`;
  return s;
}

function areaOf(g: THREE.BufferGeometry): number {
  g.computeBoundingBox();
  const s = g.boundingBox!.getSize(new THREE.Vector3());
  return s.x * s.y + s.y * s.z + s.x * s.z;
}

/**
 * Descobre se o modelo está de ré (frente em -Z). Primeiro pelos nomes de
 * farol/lanterna; senão pelo teto: em quase todo carro a cabine fica mais pra
 * trás (capô mais comprido que o porta-malas).
 */
function frontIsBack(model: THREE.Object3D, box: THREE.Box3): boolean {
  let head = 0, tail = 0, nh = 0, nt = 0;
  const v = new THREE.Vector3();
  const tb = new THREE.Box3();
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const n = `${m.name} ${(Array.isArray(m.material) ? m.material : [m.material]).map((x) => x.name).join(' ')}`;
    const isHead = /head.?light|headlamp|farol|front.?light/i.test(n);
    const isTail = /tail.?light|taillamp|rear.?light|lanterna|brake.?light/i.test(n);
    if (!isHead && !isTail) return;
    tb.setFromObject(m);
    const z = tb.getCenter(v).z;
    if (isHead) { head += z; nh++; } else { tail += z; nt++; }
  });
  if (nh && nt) return head / nh < tail / nt;
  // teto: média z dos vértices no quarto de cima
  const yCut = box.min.y + (box.max.y - box.min.y) * 0.8;
  let sz = 0, n = 0;
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute('position');
    const step = Math.max(1, Math.floor(pos.count / 400));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (v.y > yCut) { sz += v.z; n++; }
    }
  });
  const len = box.max.z - box.min.z;
  return n > 0 && sz / n > len * 0.03;
}

/** separa uma malha em duas (x > 0 e x < 0 no espaço do carro) pelo centro de cada triângulo */
function splitBySide(m: THREE.Mesh, holder: THREE.Object3D): THREE.Mesh[] | null {
  const g = m.geometry;
  const pos = g.attributes.position;
  if (!pos || Array.isArray(m.material) || g.groups.length > 1) return null;
  holder.updateMatrixWorld(true);
  const toCar = new THREE.Matrix4().copy(holder.matrixWorld).invert().multiply(m.matrixWorld);
  const idx = g.index ? Array.from(g.index.array as ArrayLike<number>) : Array.from({ length: pos.count }, (_, i) => i);
  const v = new THREE.Vector3();
  const sides: number[][] = [[], []];
  for (let t = 0; t + 2 < idx.length; t += 3) {
    let x = 0;
    for (let k = 0; k < 3; k++) x += v.fromBufferAttribute(pos, idx[t + k]!).applyMatrix4(toCar).x;
    sides[x > 0 ? 0 : 1]!.push(idx[t]!, idx[t + 1]!, idx[t + 2]!);
  }
  if (!sides[0]!.length || !sides[1]!.length) return null;
  const out = sides.map((list, i) => {
    const ig = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(g.attributes)) ig.setAttribute(k, a);
    ig.setIndex(list);
    // só os vértices usados (senão a caixa da metade seria a do eixo inteiro)
    const ng = ig.toNonIndexed();
    const nm = new THREE.Mesh(ng, m.material);
    nm.name = `${m.name}_${i ? 'dir' : 'esq'}`;
    nm.position.copy(m.position);
    nm.quaternion.copy(m.quaternion);
    nm.scale.copy(m.scale);
    m.parent!.add(nm);
    return nm;
  });
  m.parent!.remove(m);
  return out;
}

export function prepareCar(src: THREE.Object3D, entry: CarEntry): PreparedCar {
  const model = src.clone(true);
  // materiais próprios por cópia (a pintura de cada carro é independente)
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
    m.castShadow = m.receiveShadow = false;
  });

  // ---------- orientação e escala ----------
  const holder = new THREE.Group();
  holder.add(model);
  holder.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  let size = box.getSize(new THREE.Vector3());
  // eixo mais comprido no plano = frente/trás; se for o X, gira 90°
  let yaw = THREE.MathUtils.degToRad(entry.yaw ?? 0);
  if (size.x > size.z) yaw += Math.PI / 2;
  model.rotation.y += yaw;
  holder.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  size = box.getSize(new THREE.Vector3());
  const k = entry.length / size.z;
  model.scale.multiplyScalar(k);
  holder.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  model.position.x -= c.x;
  model.position.z -= c.z;
  model.position.y -= box.min.y;
  holder.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  if (entry.yaw === undefined && frontIsBack(model, box) !== !!entry.flip) {
    model.rotation.y += Math.PI;
    holder.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model);
    const c2 = box.getCenter(new THREE.Vector3());
    model.position.x -= c2.x;
    model.position.z -= c2.z;
    holder.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model);
  }
  size = box.getSize(new THREE.Vector3());
  const halfW = size.x / 2, halfL = size.z / 2;

  // ---------- rodas ----------
  const wheelMeshes: THREE.Mesh[] = [];
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const names = chainName(m, holder) + meshMaterials(m).map((x) => ` ${x.name}`).join('');
    if (WHEEL_RE.test(names) && !NOT_WHEEL_RE.test(names)) wheelMeshes.push(m);
  });
  const quads: THREE.Mesh[][] = [[], [], [], []];
  const tmp = new THREE.Box3();
  // eixo inteiro numa malha só (as duas rodas de trás juntas): divide pelo lado
  for (const m of [...wheelMeshes]) {
    tmp.setFromObject(m);
    if (tmp.min.x < -size.x * 0.15 && tmp.max.x > size.x * 0.15) {
      const halves = splitBySide(m, holder);
      if (halves) wheelMeshes.splice(wheelMeshes.indexOf(m), 1, ...halves);
    }
  }
  holder.updateMatrixWorld(true);
  for (const m of wheelMeshes) {
    tmp.setFromObject(m);
    const wc = tmp.getCenter(new THREE.Vector3());
    const ws = tmp.getSize(new THREE.Vector3());
    // malha grande demais (as quatro rodas juntas numa malha só) não dá pra girar separado
    if (ws.z > size.z * 0.4 || ws.x > size.x * 0.6) continue;
    const q = (wc.z > 0 ? 0 : 2) + (wc.x > 0 ? 0 : 1);
    quads[q]!.push(m);
  }
  const wheels: WheelRig[] = [];
  let wheelR = 0.33;
  if (quads.every((q) => q.length > 0)) {
    const radii: number[] = [];
    quads.forEach((list) => {
      const b = new THREE.Box3();
      for (const m of list) b.expandByObject(m);
      const wc = b.getCenter(new THREE.Vector3());
      const ws = b.getSize(new THREE.Vector3());
      radii.push(Math.max(ws.y, ws.z) / 2);
      const steer = new THREE.Group();
      steer.position.copy(wc);
      const spin = new THREE.Group();
      steer.add(spin);
      holder.add(steer);
      holder.updateMatrixWorld(true);
      for (const m of list) spin.attach(m);
      wheels.push({ steer, spin });
    });
    wheelR = radii.reduce((a, b) => a + b, 0) / radii.length;
  }

  // ---------- pintura ----------
  const byMat = new Map<THREE.MeshStandardMaterial, number>();
  const custom = entry.paint ? new RegExp(entry.paint, 'i') : null;
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of meshMaterials(m)) {
      const sm = mat as THREE.MeshStandardMaterial;
      if (!sm.isMeshStandardMaterial) continue;
      byMat.set(sm, (byMat.get(sm) ?? 0) + areaOf(m.geometry) * k * k);
    }
  });
  let paintMats = [...byMat.keys()].filter((m) => (custom ? custom.test(m.name) : PAINT_RE.test(m.name) && !NOT_PAINT_RE.test(m.name)));
  if (!paintMats.length && !custom) {
    // sem nome útil: o material de maior área que não é preto/cinza escuro nem transparente
    const cand = [...byMat.entries()]
      .filter(([m]) => !m.transparent && !NOT_PAINT_RE.test(m.name) && m.color.getHSL({ h: 0, s: 0, l: 0 }).l > 0.08)
      .sort((a, b) => b[1] - a[1]);
    if (cand[0]) paintMats = [cand[0][0]];
  }

  holder.updateMatrixWorld(true);
  return { root: holder, wheels, paintMats, halfW, halfL, height: size.y, wheelR };
}

/** troca a cor da lataria mantendo reflexo de verniz */
export function repaint(p: PreparedCar, color: THREE.ColorRepresentation, env: THREE.Texture | null, envIntensity = 1): void {
  for (const m of p.paintMats) {
    m.color.set(color);
    m.map = null; // textura de cor original brigaria com a cor nova
    m.metalness = 0.55;
    m.roughness = 0.3;
    if (env) m.envMap = env;
    m.envMapIntensity = envIntensity;
    m.needsUpdate = true;
  }
}

/** ajusta o reflexo de todos os materiais do carro */
export function setEnv(root: THREE.Object3D, env: THREE.Texture | null, intensity: number): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of meshMaterials(m)) {
      const sm = mat as THREE.MeshStandardMaterial;
      if (!sm.isMeshStandardMaterial) continue;
      if (env) sm.envMap = env;
      sm.envMapIntensity = intensity;
    }
  });
}
