// Monta o rig do jogador (e as luzes do tráfego) em cima de um carro GLB
// normalizado: rodas fora da carroceria (a carroceria inclina, as rodas não),
// lanternas/faróis acendendo, escapamento, sombra de contato e neon por baixo.

import * as THREE from 'three';
import { makeSoftTexture, type MustangRig } from './mustang';
import type { PreparedCar } from './gltfCar';

const TAIL_RE = /tail.?light|tail.?lamp|rear.?light|back.?light|brake.?light|stop.?light|lanterna|luz.?tras|rear.?lamp|farol.?tras/i;
const HEAD_RE = /head.?light|headlamp|front.?light|farol|head_lamp|frontlamp|tungsten/i;
// carcaça, cromado, vidro, pinça de freio...: não acendem (senão o farol inteiro estoura no bloom)
const NOT_LAMP_RE = /housing|chrome|chome|caliper|calliper|disc|glass|vidro|plastic|paint|shadow|interior|misc|filler|pneu|tire|tyre|wheel|aro_|rim/i;

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
}

export function findLights(p: PreparedCar): LightSpots {
  const namedTail: THREE.Mesh[] = [];
  const namedHead: THREE.Mesh[] = [];
  p.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    if (mats.length !== 1) return; // malha com vários materiais: não troca o material inteiro
    const n = `${m.name} ${mats[0]!.name}`;
    if (NOT_LAMP_RE.test(n)) return;
    // "farol traseiro" é lanterna: testa a traseira antes do farol
    if (TAIL_RE.test(n)) namedTail.push(m);
    else if (HEAD_RE.test(n)) namedHead.push(m);
  });
  const w = p.halfW, h = p.height;
  const tails = [1, -1].map((s) => probe(p, -1, s * w * 0.62, h * 0.58));
  const heads = [1, -1].map((s) => probe(p, 1, s * w * 0.6, h * 0.5));
  const exhausts = [1, -1].map((s) => {
    const q = probe(p, -1, s * w * 0.45, h * 0.2);
    q.z -= 0.05;
    return q;
  });
  return { tails, heads, exhausts, namedTail, namedHead };
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
      sm.envMapIntensity = 1.2;
      // vidro e cromado espelhados viram pontinho estourado com as luzes: tira um pouco do espelho
      sm.roughness = Math.max(sm.roughness, sm.metalness > 0.5 ? 0.3 : 0.22);
    }
  });
  for (const w of p.wheels) w.steer.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      const sm = mat as THREE.MeshStandardMaterial;
      if (sm.isMeshStandardMaterial) { sm.envMap = env; sm.envMapIntensity = 1.2; sm.roughness = Math.max(sm.roughness, sm.metalness > 0.5 ? 0.3 : 0.22); }
    }
  });
  const paint = new THREE.MeshPhysicalMaterial({
    color: paintColor, metalness: 0.45, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.3, envMap: env, envMapIntensity: 1.8,
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
    if (m.isMesh && !Array.isArray(m.material) && (m.material as THREE.MeshPhysicalMaterial).clearcoat === 1) paintRef = m.material as THREE.MeshPhysicalMaterial;
  });

  // ---------- luzes ----------
  const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 0.05, 0.03) });
  const brakeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.02, 0.02), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  const reverseMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.15, 0.15, 0.15), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.45, 1.35) });
  const L = findLights(p);
  for (const m of L.namedTail) m.material = tailMat;
  for (const m of L.namedHead) m.material = headMat;
  const lw = p.halfW * 0.34;
  for (const t of L.tails) {
    if (!L.namedTail.length) holder.add(card(tailMat, lw, 0.07, t, true));
    holder.add(card(brakeMat, lw * 1.1, 0.12, t.clone().setY(t.y - 0.02), true));
    holder.add(card(reverseMat, 0.1, 0.05, t.clone().setX(t.x * 0.55).setY(t.y - 0.1), true));
  }
  if (!L.namedHead.length) for (const hpos of L.heads) holder.add(card(headMat, p.halfW * 0.3, 0.06, hpos, false));

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

  // farol aceso em qualquer qualidade (o BAIXA não tem bloom): brilho nas lentes e mancha de luz no asfalto
  const glowMat = new THREE.MeshBasicMaterial({ map: soft, color: new THREE.Color(0.8, 0.75, 0.66), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const hpos of L.heads) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.26), glowMat);
    g.position.copy(hpos).setZ(hpos.z + 0.05);
    g.renderOrder = 5;
    root.add(g);
  }
  const roadLight = new THREE.Mesh(
    new THREE.PlaneGeometry(p.halfW * 2 + 1.8, 13),
    new THREE.MeshBasicMaterial({ map: soft, color: new THREE.Color(0.75, 0.7, 0.58), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  roadLight.rotation.x = -Math.PI / 2;
  roadLight.position.set(0, 0.035, p.halfL + 8.5);
  roadLight.renderOrder = 3;
  root.add(roadLight);

  const heads: THREE.SpotLight[] = [];
  for (const hpos of L.heads) {
    const l = new THREE.SpotLight(0xf2f0ff, 45, 70, 0.44, 0.6, 1.4);
    l.position.copy(hpos).add(new THREE.Vector3(0, 0, -0.1));
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
  const head = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.35, 1.28, 1.1) });
  for (const m of L.namedTail) m.material = tail;
  for (const m of L.namedHead) m.material = head;
  if (!L.namedTail.length) for (const t of L.tails) g.add(card(tail, p.halfW * 0.3, 0.09, t, true));
  if (!L.namedHead.length) for (const h of L.heads) g.add(card(head, p.halfW * 0.28, 0.08, h, false));
  return g;
}
