// Carros do bonde (Rolê, Lâmina, Tanque) como carro do jogador no mundo
// aberto: mesmo modelo, contorno e pintura do BSBASS THE GAME, com as luzes
// e o escapamento que o jogo precisa. Também monta as versões paradas (sem
// farol aceso) que ficam estacionadas no ferro-velho.

import * as THREE from 'three';
import { BSB as K } from './core.js';
import { MODELS, makeCharacter, makeModel, makePaintMat, setPaint, shadowTex, type CampaignModel, type WheelNode } from './models';
import { findLights } from '../car/gltfRig';
import type { MustangRig } from '../car/mustang';
import type { PreparedCar } from '../car/gltfCar';

export interface SiteRig extends MustangRig {
  /** gira as rodas (os carros do bonde não esterçam a roda) */
  update(dt: number, speed: number): void;
  wid: number;
  len: number;
  hgt: number;
  paintMat: THREE.Material;
  setDriver(pilotId: string | null): void;
}

const _q = new THREE.Quaternion(), _v = new THREE.Vector3();

function spinWheels(wheels: WheelNode[], dt: number, v: number): void {
  if (!wheels.length) return;
  const cap = Math.min(26, (0.42 * ((Math.PI * 2) / 10)) / Math.max(1 / 120, dt));
  const om = Math.max(-cap, Math.min(v / (wheels[0]!.r || 0.4), cap));
  for (const w of wheels) {
    w.ang += w.sign * om * dt;
    if (w.ang > 1e4 || w.ang < -1e4) w.ang %= Math.PI * 2;
    w.node.quaternion.copy(w.q0).multiply(_q.setFromAxisAngle(w.ax3, w.ang));
    if (w.cS) w.node.position.copy(w.base).add(w.cS).sub(_v.copy(w.cS).applyQuaternion(_q));
  }
}

function card(mat: THREE.Material, w: number, h: number, pos: THREE.Vector3, back: boolean): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.copy(pos);
  m.position.z += back ? -0.015 : 0.015;
  if (back) m.rotation.y = Math.PI;
  m.renderOrder = 4;
  return m;
}

/** carro do bonde pra dirigir */
export function buildSiteRig(key: string, paint: string | null): SiteRig | null {
  const def = K.CARS[key];
  if (!def || !MODELS[def.model as CampaignModel]) return null;
  const M = MODELS[def.model as CampaignModel]!;
  const mat = makePaintMat(M);
  setPaint(mat, paint);
  const m = makeModel(def.model as CampaignModel, def.len, mat, def.frontZ);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(m.wrap);
  m.wrap.updateMatrixWorld(true);
  // luzes: cartões na superfície do modelo (mesmo método dos carros GLB)
  const prep = { root: m.wrap, wheels: [], paintMats: [], halfW: m.w / 2, halfL: m.l / 2, height: m.h, wheelR: 0.33 } as unknown as PreparedCar;
  const L = findLights(prep);
  const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 0.07, 0.04) });
  const brakeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.02, 0.02), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  const reverseMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.15, 0.15, 0.15), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.1, 2.9) });
  const lw = (m.w / 2) * 0.34;
  for (const t of L.tails) {
    body.add(card(tailMat, lw, 0.07, t, true));
    body.add(card(brakeMat, lw * 1.1, 0.12, t.clone().setY(t.y - 0.02), true));
    body.add(card(reverseMat, 0.1, 0.05, t.clone().setX(t.x * 0.55).setY(t.y - 0.1), true));
  }
  for (const h of L.heads) body.add(card(headMat, (m.w / 2) * 0.3, 0.06, h, false));
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(m.w * 1.35, def.len * 1.15).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, color: 0x000000, opacity: 0.75 }));
  shadow.position.y = 0.04;
  root.add(shadow);
  const underglow = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  underglow.visible = false;
  root.add(underglow);
  const heads: THREE.SpotLight[] = [];
  for (const h of L.heads) {
    const l = new THREE.SpotLight(0xf2f0ff, 45, 70, 0.44, 0.6, 1.4);
    l.position.copy(h).add(new THREE.Vector3(0, 0, -0.1));
    l.target.position.set(h.x * 1.5, 0, 22);
    root.add(l, l.target);
    heads.push(l);
  }
  const ex = L.exhausts;
  let driver: THREE.Group | null = null;
  const rig: SiteRig = {
    root,
    body,
    wheels: [],
    tailMat,
    brakeMat,
    reverseMat,
    headMat,
    underglow,
    heads,
    exhausts: [ex[0]!, ex[0]!.clone(), ex[1]!, ex[1]!.clone()],
    tailLocal: L.tails.map((t) => t.clone().setZ(t.z - 0.05)),
    paint: new THREE.MeshPhysicalMaterial(),
    paintMat: mat,
    wid: m.w,
    len: def.len,
    hgt: m.h,
    update(dt: number, speed: number) {
      spinWheels(m.wheels, dt, speed);
    },
    setDriver(pilotId: string | null) {
      if (driver) body.remove(driver);
      driver = null;
      const pl = pilotId ? K.PILOTS.find((p) => p.id === pilotId) : null;
      if (!pl) return;
      driver = makeCharacter(pl.model as CampaignModel, 1.64);
      if (!driver) return;
      driver.position.set(m.w * 0.2, m.h - 0.16 - 1.64, -def.len * 0.04);
      body.add(driver);
    },
  };
  return rig;
}

/** carro parado no pátio (sem farol aceso, sem luz de verdade) */
export function buildParkedSiteCar(key: string, paint: string | null): { root: THREE.Group; mat: THREE.Material; wid: number; len: number } | null {
  const def = K.CARS[key];
  if (!def || !MODELS[def.model as CampaignModel]) return null;
  const mat = makePaintMat(MODELS[def.model as CampaignModel]!);
  setPaint(mat, paint);
  const m = makeModel(def.model as CampaignModel, def.len, mat, def.frontZ);
  const root = new THREE.Group();
  root.add(m.wrap);
  m.wrap.position.y = 0.02;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(m.w * 1.35, def.len * 1.15).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, color: 0x000000, opacity: 0.75 }));
  shadow.position.y = 0.04;
  root.add(shadow);
  return { root, mat, wid: m.w, len: def.len };
}
