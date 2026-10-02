// Monta o rig do jogador (e as luzes do tráfego) em cima de um carro GLB
// normalizado: rodas fora da carroceria (a carroceria inclina, as rodas não),
// lanternas/faróis acendendo, escapamento, sombra de contato e neon por baixo.

import * as THREE from 'three';
import { makeSoftTexture, type MustangRig } from './mustang';
import type { PreparedCar } from './gltfCar';

const TAIL_RE = /tail.?light|tail.?lamp|rear.?light|back.?light|brake.?light|stop.?light|lanterna|luz.?tras|rear.?lamp|farol.?tras/i;
const HEAD_RE = /head.?light|headlamp|front.?light|farol|head_lamp|frontlamp|tungsten/i;
// carcaça, cromado, vidro, pinça de freio...: não acendem (senão o farol inteiro estoura no bloom)
/** peças de dentro do carro (painel, botões, mostradores) */
const INTERIOR_RE = /interior|int_|dash|gauge|display|button|digital|selfillum/i;
// ("aro_"/"rim" só como palavra: "Camaro_" e "trim" não são roda)
const NOT_LAMP_RE = /housing|chrome|chome|caliper|calliper|disc|glass|vidro|plastic|paint|shadow|interior|misc|filler|pneu|tire|tyre|wheel|(?<![a-z])aro_|(?<![a-z])rim(?![a-z])/i;
/** lente de vidro da lanterna/farol: serve quando o modelo não tem a peça acesa com nome claro */
const LENS_RE = /glass|vidro|lens|lente/i;
const REVERSE_RE = /reverse|backup.?light|luz.?de.?re/i;

/** ponto da superfície do carro visto de frente (+1) ou de trás (-1) numa altura/lado */
function probe(p: PreparedCar, dir: 1 | -1, x: number, y: number): THREE.Vector3 {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, y, dir * (p.halfL + 2)), new THREE.Vector3(0, 0, -dir), 0, p.halfL * 2 + 4);
  const hit = ray.intersectObject(p.root, true).find((h) => (h.object as THREE.Mesh).isMesh);
  return hit ? hit.point.clone() : new THREE.Vector3(x, y, dir * p.halfL);
}

export interface LightSpots {
  tails: THREE.Vector3[];
  heads: THREE.Vector3[];
  exhausts: THREE.Vector3[];
  /** o modelo tinha material de lanterna/farol com nome reconhecível */
  namedTail: THREE.Mesh[];
  namedHead: THREE.Mesh[];
  /** luz de ré do modelo (acende dando ré) */
  namedReverse: THREE.Mesh[];
}

export function findLights(p: PreparedCar): LightSpots {
  const namedTail: THREE.Mesh[] = [];
  const namedHead: THREE.Mesh[] = [];
  const namedReverse: THREE.Mesh[] = [];
  const lensTail: THREE.Mesh[] = [];
  const lensHead: THREE.Mesh[] = [];
  const redRear: THREE.Mesh[] = [];
  p.root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(p.root.matrixWorld).invert();
  const box = new THREE.Box3();
  p.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    if (mats.length !== 1) return; // malha com vários materiais: não troca o material inteiro
    const n = `${m.name} ${mats[0]!.name}`;
    if (REVERSE_RE.test(n) && !NOT_LAMP_RE.test(n)) {
      namedReverse.push(m);
      return;
    }
    if (NOT_LAMP_RE.test(n)) {
      // sem peça acesa com nome claro, a lente de vidro da lanterna/farol serve
      if (LENS_RE.test(n) && !/chrome|chome|housing/i.test(n)) {
        if (TAIL_RE.test(n)) lensTail.push(m);
        else if (HEAD_RE.test(n)) lensHead.push(m);
        else {
          // vidro vermelho na traseira (lanterna sem nome)
          const c = (mats[0] as THREE.MeshStandardMaterial).color;
          if (c && (c.r > 0.4 && c.g < 0.12 && c.b < 0.12) || /red|verm/i.test(n)) {
            if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
            box.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld).applyMatrix4(inv);
            if ((box.min.z + box.max.z) / 2 < -p.halfL * 0.55) redRear.push(m);
          }
        }
      }
      return;
    }
    // "farol traseiro" é lanterna: testa a traseira antes do farol
    if (TAIL_RE.test(n)) namedTail.push(m);
    else if (HEAD_RE.test(n)) namedHead.push(m);
  });
  if (!namedTail.length) namedTail.push(...(lensTail.length ? lensTail : redRear));
  if (!namedHead.length) namedHead.push(...lensHead);
  const w = p.halfW, h = p.height;
  // com farol/lanterna de verdade no modelo, a luz vai no centro dele (de cada lado);
  // senão chuta pela superfície do carro numa altura fixa
  const fromMeshes = (list: THREE.Mesh[], front: boolean): THREE.Vector3[] | null => {
    if (!list.length) return null;
    // pelos vértices (uma peça pode ter os dois faróis): centro de cada lado
    const acc = [1, -1].map(() => ({ x: 0, y: 0, n: 0, z: front ? -Infinity : Infinity }));
    const v = new THREE.Vector3();
    const mtx = new THREE.Matrix4();
    for (const m of list) {
      const pos = m.geometry.attributes.position;
      if (!pos) continue;
      mtx.multiplyMatrices(inv, m.matrixWorld);
      const step = Math.max(1, Math.floor(pos.count / 400));
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mtx);
        if (Math.abs(v.x) < w * 0.12) continue;
        const a = acc[v.x > 0 ? 0 : 1]!;
        a.x += v.x;
        a.y += v.y;
        a.n++;
        a.z = front ? Math.max(a.z, v.z) : Math.min(a.z, v.z);
      }
    }
    if (acc.some((a) => !a.n)) return null;
    return acc.map((a) => new THREE.Vector3(a.x / a.n, a.y / a.n, a.z));
  };
  const tails = fromMeshes(namedTail, false) ?? [1, -1].map((s) => probe(p, -1, s * w * 0.62, h * 0.58));
  const heads = fromMeshes(namedHead, true) ?? [1, -1].map((s) => probe(p, 1, s * w * 0.6, h * 0.5));
  const exhausts = [1, -1].map((s) => {
    const q = probe(p, -1, s * w * 0.45, h * 0.2);
    q.z -= 0.05;
    return q;
  });
  return { tails, heads, exhausts, namedTail, namedHead, namedReverse };
}

function card(mat: THREE.Material, w: number, h: number, pos: THREE.Vector3, back: boolean): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.copy(pos);
  m.position.z += back ? -0.012 : 0.012;
  if (back) m.rotation.y = Math.PI;
  m.renderOrder = 4;
  return m;
}

export function buildGltfRig(p: PreparedCar, env: THREE.Texture | null, paintColor: THREE.ColorRepresentation): MustangRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const holder = p.root;
  // rodas vão pro root (não inclinam junto com a carroceria)
  for (const w of p.wheels) root.add(w.steer);
  body.add(holder);

  // pintura + reflexo (mesma escala do Mustang procedural; o jogo multiplica depois)
  holder.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      const sm = mat as THREE.MeshStandardMaterial;
      if (!sm.isMeshStandardMaterial) continue;
      sm.envMap = env;
      // painel/botões acesos de branco brilham pelo para-brisa como um ponto no capô
      if (sm.emissive && sm.emissive.getHex() && INTERIOR_RE.test(`${m.name} ${sm.name}`)) sm.emissiveIntensity = Math.min(sm.emissiveIntensity, 0.08);
      // seta (pisca) acesa de branco o tempo todo vira ponto no retrovisor: apagada; luz diurna mais fraca
      if (sm.emissive && sm.emissive.getHex() && /indicator|turn.?light|blinker|pisca/i.test(`${m.name} ${sm.name}`)) sm.emissiveIntensity = 0;
      if (sm.emissive && sm.emissive.getHex() && /day.?light|drl/i.test(`${m.name} ${sm.name}`)) sm.emissiveIntensity = Math.min(sm.emissiveIntensity, 0.5);
      // espelho/cromado refletindo o céu vira ponto estourado: reflexo mais fraco neles
      sm.envMapIntensity = sm.metalness > 0.5 ? 0.6 : 1.2;
      // vidro e cromado espelhados viram pontinho estourado com as luzes: tira um pouco do espelho
      sm.roughness = Math.max(sm.roughness, sm.metalness > 0.5 ? 0.45 : 0.38);
    }
  });
  for (const w of p.wheels) w.steer.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      const sm = mat as THREE.MeshStandardMaterial;
      if (sm.isMeshStandardMaterial) { sm.envMap = env; sm.envMapIntensity = 1.2; sm.roughness = Math.max(sm.roughness, sm.metalness > 0.5 ? 0.45 : 0.38); }
    }
  });
  const paint = new THREE.MeshPhysicalMaterial({
    color: paintColor, metalness: 0.4, roughness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.6, envMap: env, envMapIntensity: 1.6,
  });
  for (const pm of p.paintMats) {
    // troca o material da lataria pelo verniz azul do jogo, mantendo normal/AO do modelo
    holder.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const swap = (x: THREE.Material) => {
        if (x !== pm) return x;
        const np = paint.clone();
        // mesma Color em todas as peças: trocar a cor do rig pinta o carro inteiro
        np.color = paint.color;
        np.normalMap = pm.normalMap;
        np.aoMap = pm.aoMap;
        return np;
      };
      m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
    });
  }
  // o jogo mexe só na cor desse; usa um representante compartilhado
  let paintRef = paint;
  holder.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !Array.isArray(m.material) && (m.material as THREE.MeshPhysicalMaterial).clearcoat === 0.6) paintRef = m.material as THREE.MeshPhysicalMaterial;
  });

  // ---------- luzes ----------
  const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 0.05, 0.03) });
  const brakeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.02, 0.02), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  // luz de ré: a peça do próprio modelo (apagada até dar ré)
  const reverseMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.15, 0.15, 0.15) });
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.83, 0.78) });
  const L = findLights(p);
  // lanterna, freio e farol acendem na peça do próprio modelo (freio = a lanterna mais forte);
  // placa colada por fora só se o modelo não tiver lanterna nenhuma, e dentro da largura da lataria
  for (const m of L.namedTail) m.material = tailMat;
  for (const m of L.namedHead) m.material = headMat;
  for (const m of L.namedReverse) m.material = reverseMat;
  const bodyW = Math.min(p.halfW, bodyHalfWidth(p));
  const lw = bodyW * 0.3;
  if (!L.namedTail.length) for (const t of L.tails) holder.add(card(tailMat, lw, 0.07, t.clone().setX(Math.sign(t.x) * Math.min(Math.abs(t.x), bodyW - lw / 2 - 0.05)), true));
  if (!L.namedHead.length) for (const hpos of L.heads) holder.add(card(headMat, lw, 0.06, hpos.clone().setX(Math.sign(hpos.x) * Math.min(Math.abs(hpos.x), bodyW - lw / 2 - 0.05)), false));

  // ---------- sombra de contato + neon por baixo ----------
  const soft = makeSoftTexture();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(p.halfW * 2 + 0.55, p.halfL * 2 + 0.6), new THREE.MeshBasicMaterial({ map: soft, color: 0x000000, transparent: true, opacity: 0.75, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  shadow.renderOrder = 2;
  root.add(shadow);
  const underglow = new THREE.Mesh(
    new THREE.PlaneGeometry(p.halfW * 2 + 0.75, p.halfL * 2 + 0.6),
    new THREE.MeshBasicMaterial({ map: soft, color: new THREE.Color(0.1, 0.45, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.y = 0.03;
  underglow.renderOrder = 3;
  root.add(underglow);

  // farol aceso: a lente já é emissiva; só a mancha de luz no asfalto (plaquinha de brilho virava ponto estourado)
  const roadLight = new THREE.Mesh(
    new THREE.PlaneGeometry(p.halfW * 2 + 1.8, 13),
    new THREE.MeshBasicMaterial({ map: soft, color: new THREE.Color(0.42, 0.39, 0.32), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  roadLight.rotation.x = -Math.PI / 2;
  roadLight.position.set(0, 0.035, p.halfL + 8.5);
  roadLight.renderOrder = 3;
  root.add(roadLight);

  const heads: THREE.SpotLight[] = [];
  for (const hpos of L.heads) {
    const l = new THREE.SpotLight(0xf2f0ff, 45, 70, 0.44, 0.6, 1.4);
    // fora da lataria: luz forte colada na peça acendia o capô/para-choque num ponto estourado
    l.position.set(hpos.x, hpos.y, Math.max(hpos.z, p.halfL) + 0.35);
    l.target.position.set(hpos.x * 1.5, 0, 22);
    root.add(l, l.target);
    heads.push(l);
  }

  // escapamento: o jogo usa [0] e [2] (os dois lados)
  const ex = L.exhausts;
  const exhausts = [ex[0]!, ex[0]!.clone(), ex[1]!, ex[1]!.clone()];
  return {
    root, body, wheels: p.wheels, tailMat, brakeMat, reverseMat, headMat, underglow, heads,
    exhausts, tailLocal: L.tails.map((t) => t.clone().setZ(t.z - 0.05)), paint: paintRef,
  };
}

/** faróis e lanternas acesos pros carros do tráfego (cartões na superfície do modelo) */
export function trafficLights(p: PreparedCar): THREE.Group {
  const g = new THREE.Group();
  const L = findLights(p);
  const tail = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.05, 0.05, 0.03) });
  const head = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.8, 0.7) });
  for (const m of L.namedTail) m.material = tail;
  for (const m of L.namedHead) m.material = head;
  const bw = Math.min(p.halfW, bodyHalfWidth(p)), lw = bw * 0.3;
  const inside = (v: THREE.Vector3) => v.clone().setX(Math.sign(v.x) * Math.min(Math.abs(v.x), bw - lw / 2 - 0.05));
  if (!L.namedTail.length) for (const t of L.tails) g.add(card(tail, lw, 0.09, inside(t), true));
  if (!L.namedHead.length) for (const h of L.heads) g.add(card(head, lw, 0.08, inside(h), false));
  return g;
}

/** meia largura da lataria na altura das lanternas (sem retrovisor) */
function bodyHalfWidth(p: PreparedCar): number {
  p.root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(p.root.matrixWorld).invert();
  const v = new THREE.Vector3(), mtx = new THREE.Matrix4();
  let w = 0;
  p.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry.attributes.position) return;
    mtx.multiplyMatrices(inv, m.matrixWorld);
    const pos = m.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / 300));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mtx);
      // só a traseira/dianteira (onde ficam as luzes), longe dos retrovisores
      if (Math.abs(v.z) > p.halfL * 0.7 && v.y > p.height * 0.3) w = Math.max(w, Math.abs(v.x));
    }
  });
  return w || p.halfW;
}
