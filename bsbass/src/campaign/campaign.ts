// Campanha no mundo aberto: os 5 capítulos do BSBASS THE GAME viram pontos
// fixos na cidade (feixe de luz na cor do estado + círculo com o número) e o
// ferro-velho vira lugar de verdade (base do bonde). Tudo se ativa parando
// no lugar e segurando o botão de ação ~1 s; nada liga só de encostar.

import * as THREE from 'three';
import { BSB as K, type SaveStore } from './core.js';
import { createMission, type Mission, type MissionResult } from './mission.js';
import { MissionHud } from './missionHud';
import { ROUTES, RHALF, buildRoute, frameAt, type Route } from './routes';
import { Yard } from './yard';
import { buildParkedSiteCar, buildSiteRig, type SiteRig } from './siteRig';
import { makeCharacter, setPaint, type CampaignModel } from './models';
import { rect, type Shape, type SpatialGrid } from '../physics/collide';
import type { CarPhysics } from '../physics/car';
import type { AudioSystem } from '../audio/audio';
import type { MustangRig } from '../car/mustang';
import { blockKind } from '../world/city';

const SAVE_KEY = 'bsbass-drift-campaign-v1';
const GARAGE_KEY = 'bsbass-drift-garage-v1';
/** raio do círculo de ativação e do cartão */
const CIRCLE_R = 6.5;
const CARD_R = 25;
const HOLD_T = 1.0;
const STOP_SPEED = 1.6; // m/s
const MUSTANG_BLUE = '#16338a';

export type DriveKey = 'mustang' | 'role' | 'lamina' | 'tanque';
export const DRIVE_KEYS: DriveKey[] = ['mustang', 'role', 'lamina', 'tanque'];
const DRIVE_NAMES: Record<DriveKey, string> = { mustang: 'Mustang', role: 'Rolê', lamina: 'Lâmina', tanque: 'Tanque' };

export interface CampaignHost {
  scene: THREE.Scene;
  car: CarPhysics;
  audio: AudioSystem;
  camera: THREE.PerspectiveCamera;
  grid: SpatialGrid<Shape>;
  ui: HTMLElement;
  touch: boolean;
  mustangRig: MustangRig;
  barrierModel: THREE.Group | null;
  getRig(): MustangRig;
  setRig(rig: MustangRig): void;
  /** mundo aberto pausado/escondido durante a missão (tráfego, fitas, rachas) */
  setOpenWorld(on: boolean): void;
  banner(title: string, sub: string, time?: number, cls?: string): void;
  reduceFx(): boolean;
  particles(): number;
  input(): { throttle: number; handbrake: boolean; act: boolean; map: boolean; digit: number };
  emitFire(p: THREE.Vector3): void;
  resetCamera(heading: number): void;
  /** largada de racha perto do carro (os rachas do mundo aberto) */
  racha(): { idx: number; name: string; limit: number; cps: number; best: number | null } | null;
  startRacha(i: number): void;
}

interface Point {
  idx: number;
  route: Route;
  group: THREE.Group;
  beam: THREE.Mesh;
  ring: THREE.Mesh;
  disc: THREE.Mesh;
  beamMat: THREE.MeshBasicMaterial;
  ringMat: THREE.MeshBasicMaterial;
  discMat: THREE.MeshBasicMaterial;
  icon: THREE.Mesh;
  iconMat: THREE.MeshBasicMaterial;
}

type Interact =
  | { kind: 'chapter'; idx: number }
  | { kind: 'car'; key: DriveKey }
  | { kind: 'pilot'; id: string }
  | { kind: 'paint' }
  | { kind: 'racha'; idx: number }
  | null;

function beamTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 256, 0, 0);
  grd.addColorStop(0, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.08, 'rgba(255,255,255,0.45)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.16)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function numberTexture(n: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#fff';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(128, 128, 118, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([18, 14]);
  g.lineWidth = 5;
  g.beginPath();
  g.arc(128, 128, 98, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = '#fff';
  g.font = '150px Anton, Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), 128, 138);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * ícone de cada capítulo, girando no meio do feixe:
 * 1 Na Mira = mira · 2 O Corre = setas de velocidade · 3 A Carga = caminhão ·
 * 4 No Retrovisor = sirene · 5 Sumir na Noite = lua
 */
function iconTexture(idx: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(11,11,15,0.72)';
  g.beginPath();
  g.arc(128, 128, 118, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineWidth = 9;
  g.beginPath();
  g.arc(128, 128, 114, 0, Math.PI * 2);
  g.stroke();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (idx === 0) {
    g.lineWidth = 12;
    g.beginPath();
    g.arc(128, 128, 56, 0, Math.PI * 2);
    g.stroke();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      g.beginPath();
      g.moveTo(128 + dx * 34, 128 + dy * 34);
      g.lineTo(128 + dx * 84, 128 + dy * 84);
      g.stroke();
    }
    g.beginPath();
    g.arc(128, 128, 10, 0, Math.PI * 2);
    g.fill();
  } else if (idx === 1) {
    g.lineWidth = 16;
    for (const x of [72, 118, 164]) {
      g.beginPath();
      g.moveTo(x - 16, 84);
      g.lineTo(x + 22, 128);
      g.lineTo(x - 16, 172);
      g.stroke();
    }
  } else if (idx === 2) {
    g.fillRect(52, 88, 96, 62); // baú
    g.beginPath(); // cabine
    g.moveTo(154, 104); g.lineTo(186, 104); g.lineTo(206, 128); g.lineTo(206, 150); g.lineTo(154, 150);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(11,11,15,1)';
    g.fillRect(166, 112, 20, 14); // vidro
    for (const x of [80, 126, 184]) {
      g.beginPath();
      g.arc(x, 158, 15, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#fff';
    for (const x of [80, 126, 184]) {
      g.beginPath();
      g.arc(x, 158, 9, 0, Math.PI * 2);
      g.fill();
    }
  } else if (idx === 3) {
    g.beginPath(); // cúpula da sirene
    g.moveTo(84, 168);
    g.lineTo(84, 124);
    g.arc(128, 124, 44, Math.PI, 0);
    g.lineTo(172, 168);
    g.closePath();
    g.fill();
    g.fillRect(70, 170, 116, 18);
    g.lineWidth = 11;
    for (const [a0, len] of [[-2.6, 26], [-1.57, 26], [-0.55, 26]] as const) {
      g.beginPath();
      g.moveTo(128 + Math.cos(a0) * 64, 118 + Math.sin(a0) * 64);
      g.lineTo(128 + Math.cos(a0) * (64 + len), 118 + Math.sin(a0) * (64 + len));
      g.stroke();
    }
  } else {
    g.beginPath(); // lua crescente
    g.arc(118, 128, 64, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.arc(146, 112, 56, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    for (const [x, y, rr] of [[176, 150, 8], [168, 84, 6], [196, 116, 5]] as const) {
      g.beginPath();
      g.arc(x, y, rr, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** cor do ícone por estado (sem estourar no bloom) */
const ICON_COL = {
  open: new THREE.Color('#ffb14a'),
  done: new THREE.Color('#3ddc84'),
  locked: new THREE.Color('#6b6b72'),
};
/** o feixe fica bem mais fraco que o chão (não estoura a tela) */
const BEAM_K = 0.12;

const COL = {
  open: new THREE.Color(1.7, 0.95, 0.22),
  done: new THREE.Color(0.25, 1.45, 0.65),
  locked: new THREE.Color(0.22, 0.22, 0.24),
};

export class Campaign {
  readonly save: SaveStore;
  readonly routes: Route[];
  readonly yard: Yard;
  readonly hud: MissionHud;
  readonly mission: Mission;
  drive: DriveKey = 'mustang';
  /** 'orig' = o azul-escuro de fábrica do Mustang */
  mustangPaint = 'orig';
  mode: 'free' | 'mission' = 'free';
  inYard = false;
  private points: Point[] = [];
  private barrierGroup = new THREE.Group();
  private barrierShapes: Shape[] = [];
  private gateIn = false;
  private rigs: Partial<Record<DriveKey, MustangRig>> = {};
  private parked: Partial<Record<DriveKey, { root: THREE.Object3D; x: number; z: number; h: number; mat?: THREE.Material }>> = {};
  private crew: Record<string, THREE.Group> = {};
  private hold = 0;
  private holdKey = '';
  private t = 0;
  private paintSel: string | null = null;
  private lastResult: MissionResult | null = null;
  private chapterIdx = 0;

  constructor(private host: CampaignHost) {
    this.save = K.SaveStore(safeStorage(), SAVE_KEY);
    this.loadGarage();
    this.routes = ROUTES.map((d) => buildRoute(d, blockKind));
    this.hud = new MissionHud(host.ui);
    this.hud.onRetry = () => this.retry();
    this.hud.onLeave = () => this.leave();
    this.hud.onSwatch = (id) => this.previewPaint(id);
    // ---------- ferro-velho ----------
    this.yard = new Yard();
    host.scene.add(this.yard.group);
    this.yard.setLights(true);
    for (const c of this.yard.colliders) host.grid.insert(c);
    // ---------- pontos dos capítulos ----------
    const beamTex = beamTexture();
    const beamGeo = new THREE.CylinderGeometry(1.9, 1.9, 70, 24, 1, true);
    beamGeo.translate(0, 35, 0);
    const ringGeo = new THREE.RingGeometry(CIRCLE_R - 0.35, CIRCLE_R, 48).rotateX(-Math.PI / 2);
    this.routes.forEach((r, idx) => {
      const g = new THREE.Group();
      g.position.set(r.point.x, 0.06, r.point.z);
      g.rotation.y = r.point.heading + Math.PI;
      const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, color: COL.open.clone(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.layers.set(1);
      const ringMat = new THREE.MeshBasicMaterial({ color: COL.open.clone(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.layers.set(1);
      const discMat = new THREE.MeshBasicMaterial({ map: numberTexture(idx + 1), color: COL.open.clone(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const disc = new THREE.Mesh(new THREE.PlaneGeometry(CIRCLE_R * 1.7, CIRCLE_R * 1.7).rotateX(-Math.PI / 2), discMat);
      disc.position.y = 0.01;
      disc.layers.set(1);
      const iconMat = new THREE.MeshBasicMaterial({ map: iconTexture(idx), color: ICON_COL.open.clone(), transparent: true, side: THREE.DoubleSide, depthWrite: false });
      const icon = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), iconMat);
      icon.position.y = 3.4;
      icon.renderOrder = 3;
      icon.layers.set(1);
      g.add(beam, ring, disc, icon);
      host.scene.add(g);
      this.points.push({ idx, route: r, group: g, beam, ring, disc, beamMat, ringMat, discMat, icon, iconMat });
    });
    host.scene.add(this.barrierGroup);
    this.barrierGroup.visible = false;
    // ---------- missão ----------
    this.mission = createMission({
      scene: host.scene,
      car: host.car,
      audio: host.audio,
      hud: this.hud,
      save: this.save,
      playerRoot: () => host.getRig().root,
      playerBody: () => host.getRig().body,
      playerDims: () => {
        const r = host.getRig() as Partial<SiteRig>;
        return { wid: r.wid ?? 1.96, len: r.len ?? 4.84, hgt: r.hgt ?? 1.35 };
      },
      playerStats: () => ({ hp: K.CARS.role!.hp, maxSlip: K.CARS.role!.maxSlip }),
      carKey: () => this.drive,
      reduceFx: () => host.reduceFx(),
      quality: () => host.particles(),
      touch: () => host.touch,
      input: () => host.input(),
      onResult: (r) => this.onResult(r),
    });
    // ---------- carros do jogador e bonde no pátio ----------
    this.rigs.mustang = host.mustangRig;
    host.mustangRig.paint.color.set(this.paintOf('mustang') ?? MUSTANG_BLUE);
    this.placeGarage(true);
    this.placeCrew();
    this.applyCarMods();
    this.refreshPoints();
  }

  // ================= garagem (carro que dirige, pintura do Mustang) =================
  private loadGarage(): void {
    try {
      const g = JSON.parse(safeStorage()?.getItem(GARAGE_KEY) || '{}') as { drive?: string; mustangPaint?: string };
      if (g.drive && (DRIVE_KEYS as string[]).includes(g.drive)) this.drive = g.drive as DriveKey;
      if (g.mustangPaint && K.PAINTS.some((p) => p.id === g.mustangPaint)) this.mustangPaint = g.mustangPaint;
    } catch {
      /* sem storage */
    }
    if (this.drive !== 'mustang' && !this.owned(this.drive)) this.drive = 'mustang';
  }
  private saveGarage(): void {
    try {
      safeStorage()?.setItem(GARAGE_KEY, JSON.stringify({ drive: this.drive, mustangPaint: this.mustangPaint }));
    } catch {
      /* sem storage */
    }
  }
  private owned(k: DriveKey): boolean {
    return k === 'mustang' || this.save.data.unlockedCars.includes(k);
  }
  private paintOf(k: DriveKey): string | null {
    const id = k === 'mustang' ? this.mustangPaint : this.save.data.paints[k] || 'orig';
    if (k === 'mustang' && id === 'orig') return MUSTANG_BLUE;
    return K.PAINTS.find((p) => p.id === id)?.color ?? null;
  }

  /** rig do carro que o jogador dirige (constrói na primeira vez) */
  private rigFor(k: DriveKey): MustangRig {
    let r = this.rigs[k];
    if (!r) {
      r = buildSiteRig(k, this.paintOf(k)) ?? this.host.mustangRig;
      this.rigs[k] = r;
    }
    return r;
  }

  /** carros estacionados nas vagas do pátio (todos menos o que o jogador dirige) */
  private placeGarage(first: boolean): void {
    const spots = this.yard.spots;
    let si = 1;
    for (const k of DRIVE_KEYS) {
      if (k === this.drive) {
        const p = this.parked[k];
        if (p) {
          this.host.scene.remove(p.root);
          delete this.parked[k];
        }
        continue;
      }
      if (!this.parked[k]) {
        const sp = spots[si++ % spots.length]!;
        const vis = this.buildParked(k);
        if (!vis) continue;
        this.parked[k] = { root: vis.root, x: sp.pos.x, z: sp.pos.z, h: sp.h, mat: vis.mat };
        this.host.scene.add(vis.root);
      }
      const p = this.parked[k]!;
      p.root.position.set(p.x, 0, p.z);
      p.root.rotation.y = p.h;
    }
    if (first) {
      // o jogador começa no pátio, na vaga do meio, de frente pro portão
      const home = spots[0]!;
      this.host.setRig(this.rigFor(this.drive));
      this.host.car.reset(home.pos.x, home.pos.z, home.h);
      this.host.resetCamera(home.h);
      this.setDriverModel();
    }
  }
  private buildParked(k: DriveKey): { root: THREE.Object3D; mat?: THREE.Material } | null {
    if (k === 'mustang') {
      // cópia do Mustang sem as luzes de verdade
      const root = this.host.mustangRig.root.clone(true);
      root.traverse((o) => {
        if ((o as THREE.Light).isLight) o.visible = false;
      });
      root.position.set(0, 0, 0);
      root.rotation.set(0, 0, 0);
      return { root };
    }
    return buildParkedSiteCar(k, this.paintOf(k));
  }

  private setDriverModel(): void {
    const r = this.host.getRig() as Partial<SiteRig>;
    r.setDriver?.(this.save.data.pilot);
  }

  /** personagens do bonde: o escolhido perto da vaga, os outros em volta do fogo */
  private placeCrew(): void {
    const d = this.save.data;
    let fi = 0;
    for (const pl of K.PILOTS) {
      let g = this.crew[pl.id];
      if (!g) {
        const m = makeCharacter(pl.model as CampaignModel, pl.id === 'bozo' ? 1.82 : pl.id === 'bella' ? 1.7 : 1.78);
        if (!m) continue;
        g = m;
        g.userData.ph = Math.random() * 6;
        this.crew[pl.id] = g;
        this.host.scene.add(g);
      }
      if (!K.pilotUnlocked(d, pl)) {
        g.visible = false;
        continue;
      }
      g.visible = true;
      if (pl.id === d.pilot) {
        g.position.copy(this.yard.crewSel.pos);
        g.rotation.set(0, this.yard.crewSel.h, 0);
      } else {
        const s = this.yard.crewFire[fi++ % this.yard.crewFire.length]!;
        g.position.copy(s);
        g.rotation.set(0, Math.atan2(this.yard.fireAt.x - s.x, this.yard.fireAt.z - s.z), 0);
      }
    }
  }

  /** força/arrasto/aderência do carro e do piloto na física do mundo aberto */
  private applyCarMods(): void {
    const mods = this.host.car.mods;
    mods.power = mods.drag = mods.grip = 1;
    const def = K.CARS[this.drive];
    if (def) {
      mods.power = def.accel / 19;
      mods.drag = (55 / def.maxSpeed) ** 2;
      mods.grip = (def.gripRear / 8.5) ** 0.3;
    }
    const pm = K.pilotById(this.save.data.pilot).mods;
    if (pm.accel) mods.power *= pm.accel;
    if (pm.gripRecovery) mods.grip *= 1 + (pm.gripRecovery - 1) * 0.1;
    if (pm.maxSlip) mods.grip *= 1 - pm.maxSlip * 0.004;
  }

  // ================= pontos =================
  private stateOf(idx: number): 'open' | 'done' | 'locked' {
    const d = this.save.data;
    if (!K.chapterUnlocked(d, idx)) return 'locked';
    return d.chapters[K.CHAPTERS[idx]!.id]?.done ? 'done' : 'open';
  }
  private refreshPoints(): void {
    for (const p of this.points) {
      const st = this.stateOf(p.idx);
      const c = COL[st];
      p.beamMat.color.copy(c).multiplyScalar(BEAM_K);
      p.iconMat.color.copy(ICON_COL[st]);
      p.ringMat.color.copy(c).multiplyScalar(0.55);
      p.discMat.color.copy(c).multiplyScalar(0.55);
    }
  }

  /** alvo da seta: disponível mais perto; segurando o mapa, o ferro-velho */
  target(x: number, z: number, map: boolean): { x: number; z: number; label: string } | null {
    if (this.mode === 'mission') return null;
    if (map) {
      const g = this.yard.pt(0, 24);
      return { x: g.x, z: g.z, label: 'FERRO-VELHO' };
    }
    let best: Point | null = null, bd = Infinity;
    for (const p of this.points) {
      if (this.stateOf(p.idx) !== 'open') continue;
      const d = Math.hypot(p.route.point.x - x, p.route.point.z - z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (!best) best = this.points.find((p) => this.stateOf(p.idx) === 'locked') ?? null;
    if (!best) return null;
    const st = this.stateOf(best.idx);
    return { x: best.route.point.x, z: best.route.point.z, label: `CAP. ${best.idx + 1}${st === 'locked' ? ' (TRANCADO)' : ''}` };
  }

  /** marcadores do minimapa / mapa: pontos na cor do estado + ícone do ferro-velho */
  markers(): { x: number; z: number; c: string; shape?: 'dot' | 'yard' | 'beam'; label?: string }[] {
    const out: { x: number; z: number; c: string; shape?: 'dot' | 'yard' | 'beam'; label?: string }[] = [];
    if (this.mode === 'mission') return out;
    for (const p of this.points) {
      const st = this.stateOf(p.idx);
      out.push({ x: p.route.point.x, z: p.route.point.z, c: st === 'open' ? '#ffb14a' : st === 'done' ? '#3ddc84' : '#6b6b72', shape: 'beam', label: String(p.idx + 1) });
    }
    out.push({ x: this.yard.C.x, z: this.yard.C.z, c: '#f20d24', shape: 'yard' });
    return out;
  }

  /** linha da rota da missão pro minimapa */
  routeLine(): Float32Array | null {
    return this.mode === 'mission' ? this.routes[this.chapterIdx]!.P : null;
  }

  // ================= a cada quadro =================
  /** mundo aberto: portão, bandeira, pontos, interação. Chamado com dt real. */
  update(dt: number): void {
    this.t += dt;
    const car = this.host.car;
    // ferro-velho
    this.yard.lowQuality = this.host.particles() < 0.6;
    this.yard.update(dt, car.x, car.z, (p) => this.host.emitFire(p));
    const closed = this.yard.gateClosed;
    if (closed && !this.gateIn) {
      this.host.grid.insert(this.yard.gateCollider);
      this.gateIn = true;
    } else if (!closed && this.gateIn) {
      this.host.grid.remove(this.yard.gateCollider);
      this.gateIn = false;
    }
    for (const k in this.crew) {
      const g = this.crew[k]!;
      if (g.visible) g.scale.y = 1 + Math.sin(this.t * 1.8 + (g.userData.ph || 0)) * 0.006;
    }
    const wasIn = this.inYard;
    this.inYard = this.mode === 'free' && this.yard.inside(car.x, car.z, 2);
    this.host.audio.setMusicDuck(this.inYard ? 0.35 : 1);
    if (this.inYard && !wasIn) this.host.banner('FERRO-VELHO', 'BASE DO BONDE · LUGAR SEGURO', 1.8);
    if (this.mode !== 'free') {
      this.hud.card(null);
      this.hud.hold(null);
      this.hud.panel(null);
      return;
    }
    // pontos pulsando; o feixe some quando a câmera entra nele (senão estoura a tela)
    const cam = this.host.camera.position;
    for (const p of this.points) {
      const d = Math.hypot(p.route.point.x - car.x, p.route.point.z - car.z);
      const locked = this.stateOf(p.idx) === 'locked';
      const near = d < CARD_R && !locked;
      const k = near ? 1 + Math.sin(this.t * 6) * 0.25 : 1;
      p.beam.scale.set(k, 1, k);
      p.ringMat.opacity = near ? 0.6 + Math.sin(this.t * 6) * 0.4 : 0.85;
      const dc = Math.hypot(p.route.point.x - cam.x, p.route.point.z - cam.z);
      const fade = THREE.MathUtils.smoothstep(dc, 10, 36);
      p.beamMat.opacity = (locked ? 0.35 : 1) * fade * (near ? 0.8 + Math.sin(this.t * 6) * 0.2 : 1);
      // ícone do capítulo girando e flutuando no meio do feixe
      p.icon.rotation.y = this.t * 1.6 + p.idx;
      p.icon.position.y = 3.4 + Math.sin(this.t * 2 + p.idx) * 0.25;
      p.iconMat.opacity = locked ? 0.55 : 1;
    }
    this.interact(dt);
  }

  private interact(dt: number): void {
    const car = this.host.car;
    const inp = this.host.input();
    const stopped = car.speed < STOP_SPEED;
    let it: Interact = null;
    let label = '';
    let card: Parameters<MissionHud['card']>[0] = null;
    let panel: Parameters<MissionHud['panel']>[0] = null;
    // ---------- capítulo mais perto ----------
    let near: Point | null = null, nd = Infinity;
    for (const p of this.points) {
      const d = Math.hypot(p.route.point.x - car.x, p.route.point.z - car.z);
      if (d < nd) {
        nd = d;
        near = p;
      }
    }
    if (near && nd < CARD_R) {
      const ch = K.CHAPTERS[near.idx]!;
      const st = this.stateOf(near.idx);
      const s = this.save.data.chapters[ch.id];
      const inCircle = nd < CIRCLE_R;
      card = {
        num: near.idx + 1,
        title: st === 'locked' ? ch.title : ch.title,
        line: st === 'locked' ? `Conclua o Capítulo ${near.idx}` : ch.objective,
        best: st === 'locked' ? '' : s && s.best ? `Melhor: ${Math.round(s.best).toLocaleString('pt-BR')} · ${s.stars.map((x) => (x ? '★' : '☆')).join('')}` : 'Primeira vez',
        stars: s ? s.stars : [false, false, false],
        state: st,
        action: st === 'locked' ? 'TRANCADO' : inCircle ? (stopped ? '' : 'PARA NO CÍRCULO') : 'ENTRA NO CÍRCULO',
      };
      if (st !== 'locked' && inCircle && stopped) {
        it = { kind: 'chapter', idx: near.idx };
        label = st === 'done' ? 'JOGAR DE NOVO' : 'COMEÇAR';
      }
    }
    // ---------- racha (mesma regra: para no círculo e segura) ----------
    const rc = !it ? this.host.racha() : null;
    if (rc && !card) {
      panel = { tag: 'RACHA', title: rc.name, body: `${rc.cps} checkpoints · ${rc.limit}s${rc.best != null ? ` · melhor ${rc.best.toFixed(2)}s` : ''}`, action: stopped ? null : 'PARA NO CÍRCULO' };
      if (stopped) {
        it = { kind: 'racha', idx: rc.idx };
        label = 'LARGAR';
      }
    }
    // ---------- ferro-velho ----------
    if (this.inYard) {
      // carro parado: chegar perto e segurar pra trocar
      let bestK: DriveKey | null = null, bd = 4.6;
      for (const k of DRIVE_KEYS) {
        const p = this.parked[k];
        if (!p) continue;
        const d = Math.hypot(p.x - car.x, p.z - car.z);
        if (d < bd) {
          bd = d;
          bestK = k;
        }
      }
      if (bestK) {
        const def = K.CARS[bestK];
        const st = bestK === 'mustang' ? { owned: true } : K.carUnlockState(this.save.data, bestK);
        const stats = def ? K.carStats(def) : null;
        const bars = stats
          ? `<div class="stat-bars">${[['Velocidade', stats.velocidade], ['Resposta', stats.resposta], ['Drift', stats.drift], ['Resistência', stats.resistencia]]
              .map(([n, v]) => `<span>${n}<i><b style="width:${Math.round((v as number) * 100)}%">.</b></i></span>`)
              .join('')}</div>`
          : '<div>O Mustang azul da madrugada.</div>';
        let action: string | null = null;
        if (st.owned) {
          if (stopped) {
            it = { kind: 'car', key: bestK };
            label = `TROCAR PRO ${DRIVE_NAMES[bestK].toUpperCase()}`;
          } else action = 'PARA DO LADO PRA TROCAR';
        } else if (!st.requirementMet) action = `BLOQUEADO: ${(st.label || '').toUpperCase()}`;
        else if (!st.affordable) action = `FALTAM MOEDAS · ${st.coins} (VOCÊ TEM ${this.save.data.coins})`;
        else if (stopped) {
          it = { kind: 'car', key: bestK };
          label = `DESBLOQUEAR · ${st.coins} MOEDAS`;
        }
        panel = { tag: 'CARRO DO BONDE', title: def ? `${def.name}` : 'Mustang', body: (def ? def.tag : 'Carro de sempre') + bars, action };
      }
      // personagem do bonde
      if (!panel) {
        let bestP: string | null = null, bp = 3.2;
        for (const id in this.crew) {
          const g = this.crew[id]!;
          if (!g.visible || id === this.save.data.pilot) continue;
          const d = Math.hypot(g.position.x - car.x, g.position.z - car.z);
          if (d < bp) {
            bp = d;
            bestP = id;
          }
        }
        // o piloto atual fica do lado da vaga: mostra quem é
        const sel = this.crew[this.save.data.pilot];
        if (!bestP && sel && Math.hypot(sel.position.x - car.x, sel.position.z - car.z) < 3.2) {
          const pl = K.pilotById(this.save.data.pilot);
          panel = { tag: 'PILOTANDO', title: pl.name, body: pl.perk, action: null };
        }
        if (bestP) {
          const pl = K.pilotById(bestP);
          panel = { tag: 'PILOTO', title: pl.name, body: `${pl.tag}. ${pl.perk}`, action: stopped ? null : 'PARA DO LADO PRA ESCOLHER' };
          if (stopped) {
            it = { kind: 'pilot', id: bestP };
            label = `PILOTAR COM ${pl.name.split(' ')[0]!.toUpperCase()}`;
          }
        }
      }
      // pintura: em frente ao contêiner do grafite
      if (!panel) {
        const ps = this.yard.pt(0, -10.5);
        if (Math.hypot(ps.x - car.x, ps.z - car.z) < 4.5) {
          const cur = this.drive === 'mustang' ? this.mustangPaint : this.save.data.paints[this.drive] || 'orig';
          if (this.paintSel === null) this.paintSel = cur;
          if (inp.digit >= 1 && inp.digit <= K.PAINTS.length) this.previewPaint(K.PAINTS[inp.digit - 1]!.id);
          const swatches = K.PAINTS.map((p) => ({ id: p.id, color: p.color, name: p.name, locked: !K.paintUnlocked(this.save.data, p), sel: p.id === this.paintSel }));
          const pn = K.PAINTS.find((p) => p.id === this.paintSel);
          panel = {
            tag: 'PINTURA',
            title: `${DRIVE_NAMES[this.drive]} · ${pn?.name ?? ''}`,
            body: this.host.touch ? 'Toca na cor pra ver no carro.' : 'Toca na cor ou aperta 1 a 6 pra ver no carro.',
            action: this.paintSel === cur ? 'PINTURA ATUAL' : stopped ? null : 'PARA PRA PINTAR',
            swatches,
          };
          if (stopped && this.paintSel !== cur) {
            it = { kind: 'paint' };
            label = 'PINTAR';
          }
        } else if (this.paintSel !== null) {
          // saiu da cabine de pintura sem confirmar: volta a cor
          this.paintSel = null;
          this.applyPaint(this.drive === 'mustang' ? this.mustangPaint : this.save.data.paints[this.drive] || 'orig');
        }
      }
    }
    this.hud.card(panel ? null : card);
    this.hud.panel(panel);
    // ---------- segurar ----------
    const key = it ? JSON.stringify(it) : '';
    if (key !== this.holdKey) {
      this.holdKey = key;
      this.hold = 0;
    }
    const held = inp.act || this.hud.actHeld;
    if (it && held) this.hold += dt / HOLD_T;
    else this.hold = Math.max(0, this.hold - dt * 3);
    this.hud.hold(it ? Math.min(1, this.hold) : null, label, 'E');
    if (it && this.hold >= 1) {
      this.hold = 0;
      this.holdKey = '';
      this.activate(it);
    }
  }

  private activate(it: NonNullable<Interact>): void {
    if (it.kind === 'chapter') this.startChapter(it.idx);
    else if (it.kind === 'racha') this.host.startRacha(it.idx);
    else if (it.kind === 'car') this.swapCar(it.key);
    else if (it.kind === 'pilot') {
      this.save.data.pilot = it.id;
      this.save.save();
      this.placeCrew();
      this.setDriverModel();
      this.applyCarMods();
      this.host.banner(K.pilotById(it.id).name.toUpperCase(), K.pilotById(it.id).perk.toUpperCase(), 2.2);
    } else if (it.kind === 'paint' && this.paintSel) {
      if (this.drive === 'mustang') this.mustangPaint = this.paintSel;
      else this.save.data.paints[this.drive] = this.paintSel;
      this.save.save();
      this.saveGarage();
      this.host.banner('PINTADO', (K.PAINTS.find((p) => p.id === this.paintSel)?.name ?? '').toUpperCase(), 1.6);
    }
  }

  private previewPaint(id: string): void {
    const p = K.PAINTS.find((q) => q.id === id);
    if (!p || !K.paintUnlocked(this.save.data, p)) return;
    this.paintSel = id;
    this.applyPaint(id);
  }
  private applyPaint(id: string): void {
    const p = K.PAINTS.find((q) => q.id === id);
    const rig = this.host.getRig() as Partial<SiteRig> & MustangRig;
    if (rig.paintMat) setPaint(rig.paintMat, p?.color ?? null);
    else rig.paint.color.set(p?.color ?? MUSTANG_BLUE);
  }

  /** troca: o carro escolhido vira o do jogador e o atual fica parado onde estava */
  private swapCar(k: DriveKey): void {
    if (k !== 'mustang' && !this.save.data.unlockedCars.includes(k)) {
      if (!K.buyCar(this.save.data, k)) return;
      this.save.save();
      this.host.banner('DESBLOQUEADO', `${DRIVE_NAMES[k].toUpperCase()} NO BONDE`, 2.2);
    }
    const car = this.host.car;
    const old = this.drive;
    const tgt = this.parked[k]!;
    // o atual estaciona onde está
    const vis = this.buildParked(old);
    if (vis) {
      this.parked[old] = { root: vis.root, x: car.x, z: car.z, h: car.heading, mat: vis.mat };
      vis.root.position.set(car.x, 0, car.z);
      vis.root.rotation.y = car.heading;
      this.host.scene.add(vis.root);
    }
    this.host.scene.remove(tgt.root);
    delete this.parked[k];
    this.drive = k;
    this.saveGarage();
    if (K.CARS[k]) {
      this.save.data.equipped = k;
      this.save.save();
    }
    this.host.setRig(this.rigFor(k));
    car.reset(tgt.x, tgt.z, tgt.h);
    this.host.resetCamera(tgt.h);
    this.setDriverModel();
    this.applyCarMods();
    this.paintSel = null;
    this.host.banner(DRIVE_NAMES[k].toUpperCase(), 'BORA PRO ROLÊ', 1.6);
  }

  // ================= missão =================
  private setBarriers(route: Route | null): void {
    for (const s of this.barrierShapes) this.host.grid.remove(s);
    this.barrierShapes = [];
    this.barrierGroup.clear();
    this.barrierGroup.visible = !!route;
    if (!route) return;
    const src = this.host.barrierModel;
    let geo: THREE.BufferGeometry | null = null, mat: THREE.Material | null = null, unit = 2.8;
    if (src) {
      src.updateMatrixWorld(true);
      src.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !geo) {
          geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
          mat = m.material as THREE.Material;
        }
      });
      if (geo) {
        const g = geo as THREE.BufferGeometry;
        g.computeBoundingBox();
        const b = g.boundingBox!;
        g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
        unit = Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
        // comprido no eixo X
        if (b.max.z - b.min.z > b.max.x - b.min.x) g.rotateY(Math.PI / 2);
      }
    }
    if (!geo) {
      geo = new THREE.BoxGeometry(2.8, 0.9, 0.6).translate(0, 0.45, 0);
      mat = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.8 });
    }
    const list: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    for (const b of route.barriers) {
      const shape = rect(b.x, b.z, b.hx, b.hz);
      this.host.grid.insert(shape);
      this.barrierShapes.push(shape);
      const alongX = b.hx > b.hz;
      const len = (alongX ? b.hx : b.hz) * 2;
      const n = Math.max(1, Math.round(len / (unit * 1.02)));
      q.setFromAxisAngle(Y, alongX ? 0 : Math.PI / 2);
      for (let i = 0; i < n; i++) {
        const t = -len / 2 + (len * (i + 0.5)) / n;
        pos.set(b.x + (alongX ? t : 0), 0, b.z + (alongX ? 0 : t));
        list.push(new THREE.Matrix4().compose(pos, q, sc));
      }
    }
    const im = new THREE.InstancedMesh(geo, mat!, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    this.barrierGroup.add(im);
  }

  startChapter(idx: number): void {
    if (!K.chapterUnlocked(this.save.data, idx)) return;
    this.chapterIdx = idx;
    this.mode = 'mission';
    this.inYard = false;
    this.hud.card(null);
    this.hud.hold(null);
    this.hud.panel(null);
    for (const p of this.points) p.group.visible = false;
    this.setBarriers(this.routes[idx]!);
    this.host.setOpenWorld(false);
    this.hud.mission(true);
    this.host.audio.setMusicDuck(1);
    this.mission.start(idx, this.routes[idx]!);
  }

  private onResult(r: MissionResult): void {
    this.lastResult = r;
    const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');
    const res = r.res, ap = r.ap;
    this.hud.showResult({
      win: r.win,
      title: r.title,
      sub: r.sub,
      chapterLine: `${r.index + 1}. ${r.chapter.title}  ·  ${Math.floor(res.driftTime)}s em drift  ·  nota ${res.grade}`,
      score: fmt(res.score),
      record: ap.record && res.score > 0 ? 'Novo recorde!' : 'Recorde ' + fmt(Math.max(ap.prevBest || 0, res.score)),
      recordNew: !!(ap.record && res.score > 0),
      stars: r.chapter.challenges.map((c, i) => ({ label: c.label, got: !!r.stars[i] })),
      stats: [
        ['Melhor combo', fmt(res.bestCombo) + (res.bestMult > 1 ? ' (x' + res.bestMult + ')' : '')],
        ['Tempo em drift', res.driftTime.toFixed(1) + ' s'],
        ['Condução', res.grade],
        ['Moedas', '+' + ap.coins + '  (total ' + fmt(this.save.data.coins) + ')'],
      ],
    });
  }

  /** reinicia ali mesmo, sem carregar nada */
  retry(): void {
    this.hud.hideResult();
    this.mission.end();
    this.mission.start(this.chapterIdx, this.routes[this.chapterIdx]!);
  }

  /** volta pro mundo aberto do lado do ponto, parado e apontado pra rua */
  leave(): void {
    const idx = this.chapterIdx;
    const r = this.lastResult;
    this.hud.hideResult();
    this.mission.end();
    this.hud.mission(false);
    this.setBarriers(null);
    this.host.setOpenWorld(true);
    this.mode = 'free';
    for (const p of this.points) p.group.visible = true;
    const route = this.routes[idx]!;
    const f = { x: 0, z: 0, fx: 0, fz: 1, rx: -1, rz: 0 };
    frameAt(route, 0, f);
    const lat = RHALF - 1.7; // fora do círculo, encostado no meio-fio
    const x = f.x + f.rx * lat, z = f.z + f.rz * lat, h = Math.atan2(f.fx, f.fz);
    this.host.car.reset(x, z, h);
    this.host.resetCamera(h);
    this.refreshPoints();
    // desbloqueou o próximo? avisa qual e a quantos metros
    if (r && r.win && r.ap.firstClear && idx + 1 < K.CHAPTERS.length) {
      const next = this.routes[idx + 1]!;
      const d = Math.hypot(next.point.x - x, next.point.z - z);
      this.host.banner(`CAPÍTULO ${idx + 2} DESTRANCADO`, `${K.CHAPTERS[idx + 1]!.title.toUpperCase()} · ${Math.round(d)} M`, 4, 'gold');
    } else if (r && r.win && r.ap.firstClear) this.host.banner('CAMPANHA CONCLUÍDA', 'O BONDE SUMIU NA NOITE', 4, 'gold');
    this.lastResult = null;
    this.placeCrew();
  }

  /** "Abandonar missão" na pausa: volta sem penalidade */
  abandon(): void {
    this.lastResult = null;
    this.leave();
  }

  get missionActive(): boolean {
    return this.mode === 'mission';
  }
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

