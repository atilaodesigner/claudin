// Fitas K7 espalhadas pela quebrada (coletáveis com "sinal") e rachas
// (corridas de checkpoint contra o relógio).

import * as THREE from 'three';
import { mulberry32 } from '../utils/rng';
import { BALAO, EXTENT, NODES, PITCH, ROAD, type City, inBalao, nodePos } from './city';

export interface Fita {
  x: number;
  z: number;
  got: boolean;
  mesh: THREE.Group;
}

export interface Racha {
  name: string;
  start: { x: number; z: number };
  checkpoints: { x: number; z: number }[];
  limit: number; // segundos
  best: number | null;
  done: boolean;
}

export type MissionEvent =
  | { type: 'fita'; left: number; total: number }
  | { type: 'rachaStart'; racha: Racha; index: number }
  | { type: 'countdown'; n: number }
  | { type: 'go' }
  | { type: 'checkpoint'; n: number; total: number }
  | { type: 'rachaWin'; time: number; best: boolean; racha: Racha }
  | { type: 'rachaFail'; racha: Racha };

const RACHA_NAMES = ['RACHA DA HÉLIO PRATES', 'VOLTA NO BALÃO', 'CORRE DA FEIRA', 'TRAÇADO DO TERRÃO', 'MADRUGADA NA QNN'];

function beamTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 128, 0, 0);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.2, 'rgba(255,255,255,0.4)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function k7Texture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffd21a';
  g.beginPath();
  g.roundRect(4, 4, 248, 152, 14);
  g.fill();
  g.fillStyle = '#1a1a1a';
  g.fillRect(28, 26, 200, 70);
  g.fillStyle = '#ffd21a';
  g.beginPath();
  g.arc(84, 61, 20, 0, Math.PI * 2);
  g.arc(172, 61, 20, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1a1a1a';
  g.beginPath();
  g.arc(84, 61, 9, 0, Math.PI * 2);
  g.arc(172, 61, 9, 0, Math.PI * 2);
  g.fill();
  g.font = 'bold 26px Anton, Impact, sans-serif';
  g.textAlign = 'center';
  g.fillText('GRAVE 61', 128, 136);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Missions {
  readonly group = new THREE.Group();
  readonly fitas: Fita[] = [];
  readonly rachas: Racha[] = [];
  private startMarkers: THREE.Group[] = [];
  private gate: THREE.Group;
  private t = 0;

  // estado do racha em andamento
  active: Racha | null = null;
  activeIndex = -1;
  cp = 0;
  raceTime = 0;
  countdown = 0;
  private cooldown = 0;

  constructor(city: City, saved: { fitas: number[]; rachas: (number | null)[] }) {
    const rnd = mulberry32(2026);
    const beam = beamTexture();
    const k7 = k7Texture();
    const beamGeo = new THREE.CylinderGeometry(2.2, 2.2, 7, 24, 1, true);
    beamGeo.translate(0, 3.5, 0);
    const yellow = new THREE.MeshBasicMaterial({ map: beam, color: new THREE.Color(2.2, 1.7, 0.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const cyan = new THREE.MeshBasicMaterial({ map: beam, color: new THREE.Color(0.2, 1.6, 2.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const k7Mat = new THREE.MeshBasicMaterial({ map: k7, color: new THREE.Color(1.6, 1.6, 1.6), side: THREE.DoubleSide, transparent: true });
    const ringGeo = new THREE.TorusGeometry(2.2, 0.06, 6, 40);
    ringGeo.rotateX(Math.PI / 2);

    // ---------- fitas: pelas ruas + pontos especiais ----------
    const spots: { x: number; z: number }[] = [];
    for (const b of city.blocks) {
      if (b.kind === 'terrao') spots.push({ x: b.x + 12, z: b.z - 10 });
      if (b.kind === 'feira') spots.push({ x: b.x, z: b.z - 5 });
      if (b.kind === 'posto') spots.push({ x: b.x, z: b.z + 15 });
      if (b.kind === 'praca') spots.push({ x: b.x - 24, z: b.z + 24 });
    }
    spots.push({ x: BALAO.ring - 8, z: 0 });
    let guard = 0;
    while (spots.length < 30 && guard++ < 2000) {
      const vertical = rnd() < 0.5;
      const c = nodePos(Math.floor(rnd() * NODES));
      const t = (rnd() * 2 - 1) * EXTENT;
      const off = (rnd() * 2 - 1) * (ROAD / 2 - 3);
      const x = vertical ? c + off : t, z = vertical ? t : c + off;
      if (inBalao(x, z, 6)) continue;
      if (Math.abs(z) < 2.5 && !vertical) continue; // canteiro
      if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 70)) continue;
      spots.push({ x, z });
    }
    spots.forEach((s, i) => {
      const g = new THREE.Group();
      g.position.set(s.x, 0.15, s.z);
      g.add(new THREE.Mesh(beamGeo, yellow));
      const ring = new THREE.Mesh(ringGeo, yellow);
      ring.position.y = 0.05;
      g.add(ring);
      const tape = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.94), k7Mat);
      tape.position.y = 2;
      tape.name = 'tape';
      g.add(tape);
      const got = saved.fitas.includes(i);
      g.visible = !got;
      this.group.add(g);
      this.fitas.push({ x: s.x, z: s.z, got, mesh: g });
    });

    // ---------- rachas: caminhada aleatória pela malha ----------
    const starts: [number, number, number][] = [[1, 4, 0], [4, 1, 1], [2, 6, 0], [6, 2, 1], [3, 7, 0]];
    starts.forEach(([i0, j0, d0], r) => {
      const cps: { x: number; z: number }[] = [];
      let i = i0, j = j0, dir = d0;
      const dirs: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
      const visited = new Set<string>([`${i},${j}`]);
      let len = 0;
      for (let k = 0; k < 7 + r; k++) {
        const opts = [dir, (dir + 1) % 4, (dir + 3) % 4].filter((d) => {
          const ni = i + dirs[d]![0], nj = j + dirs[d]![1];
          return ni >= 0 && nj >= 0 && ni < NODES && nj < NODES && !visited.has(`${ni},${nj}`);
        });
        if (!opts.length) break;
        dir = rnd() < 0.5 && opts.includes(dir) ? dir : opts[Math.floor(rnd() * opts.length)]!;
        i += dirs[dir]![0];
        j += dirs[dir]![1];
        visited.add(`${i},${j}`);
        const onBalao = inBalao(nodePos(i), nodePos(j), 1);
        cps.push({ x: nodePos(i) + (onBalao ? BALAO.ring - 10 : 0), z: nodePos(j) });
        len += PITCH;
      }
      const start = { x: nodePos(i0), z: nodePos(j0) };
      this.rachas.push({
        name: RACHA_NAMES[r]!,
        start,
        checkpoints: cps,
        limit: Math.round(len / 21 + 6),
        best: saved.rachas[r] ?? null,
        done: saved.rachas[r] != null,
      });
      const m = new THREE.Group();
      m.position.set(start.x, 0.15, start.z);
      const big = new THREE.Mesh(beamGeo, cyan);
      big.scale.set(2.2, 1.4, 2.2);
      m.add(big);
      const rr = new THREE.Mesh(ringGeo, cyan);
      rr.scale.setScalar(2.2);
      m.add(rr);
      this.group.add(m);
      this.startMarkers.push(m);
    });

    // portal do checkpoint atual
    this.gate = new THREE.Group();
    const gBeam = new THREE.Mesh(beamGeo, cyan);
    gBeam.scale.set(3, 2.2, 3);
    this.gate.add(gBeam);
    const gRing = new THREE.Mesh(ringGeo, cyan);
    gRing.scale.setScalar(3);
    this.gate.add(gRing);
    this.gate.visible = false;
    this.group.add(this.gate);
  }

  get fitasLeft(): number {
    return this.fitas.filter((f) => !f.got).length;
  }

  /** alvo da bússola: próximo checkpoint no racha, senão a fita mais perto */
  target(x: number, z: number): { x: number; z: number; label: string } | null {
    if (this.active) {
      const c = this.countdown > 0 ? this.active.start : this.active.checkpoints[this.cp];
      if (c) return { ...c, label: this.countdown > 0 ? 'LARGADA' : `CHECKPOINT ${this.cp + 1}/${this.active.checkpoints.length}` };
    }
    let best: Fita | null = null, bd = Infinity;
    for (const f of this.fitas) {
      if (f.got) continue;
      const d = Math.hypot(f.x - x, f.z - z);
      if (d < bd) { bd = d; best = f; }
    }
    return best ? { x: best.x, z: best.z, label: 'SINAL DA FITA' } : null;
  }

  cancelRace(): void {
    this.active = null;
    this.activeIndex = -1;
    this.gate.visible = false;
    this.cooldown = 3;
    this.startMarkers.forEach((m) => (m.visible = true));
  }

  update(dt: number, x: number, z: number, speed: number): MissionEvent[] {
    const ev: MissionEvent[] = [];
    this.t += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (const f of this.fitas) {
      if (f.got) continue;
      const tape = f.mesh.getObjectByName('tape')!;
      tape.rotation.y = this.t * 2;
      tape.position.y = 2 + Math.sin(this.t * 2.5 + f.x) * 0.25;
      if (Math.hypot(f.x - x, f.z - z) < 3.4) {
        f.got = true;
        f.mesh.visible = false;
        ev.push({ type: 'fita', left: this.fitasLeft, total: this.fitas.length });
      }
    }

    if (!this.active) {
      if (this.cooldown <= 0) {
        this.rachas.forEach((r, i) => {
          if (!this.active && Math.hypot(r.start.x - x, r.start.z - z) < 5 && speed < 25) {
            this.active = r;
            this.activeIndex = i;
            this.cp = 0;
            this.raceTime = 0;
            this.countdown = 3.99;
            this.startMarkers.forEach((m) => (m.visible = false));
            ev.push({ type: 'rachaStart', racha: r, index: i });
            ev.push({ type: 'countdown', n: 3 });
          }
        });
      }
      return ev;
    }

    const r = this.active;
    if (this.countdown > 0) {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown);
      if (this.countdown <= 0) ev.push({ type: 'go' });
      else if (after !== before) ev.push({ type: 'countdown', n: after });
    } else {
      this.raceTime += dt;
      const c = r.checkpoints[this.cp]!;
      if (Math.hypot(c.x - x, c.z - z) < 9) {
        this.cp++;
        if (this.cp >= r.checkpoints.length) {
          const t = this.raceTime;
          const isBest = r.best === null || t < r.best;
          if (isBest) r.best = t;
          r.done = true;
          ev.push({ type: 'rachaWin', time: t, best: isBest, racha: r });
          this.cancelRace();
          return ev;
        }
        ev.push({ type: 'checkpoint', n: this.cp, total: r.checkpoints.length });
      }
      if (this.raceTime > r.limit) {
        ev.push({ type: 'rachaFail', racha: r });
        this.cancelRace();
        return ev;
      }
    }
    const next = this.countdown > 0 ? r.checkpoints[0]! : r.checkpoints[this.cp]!;
    this.gate.visible = true;
    this.gate.position.set(next.x, 0.15, next.z);
    this.gate.rotation.y = this.t;
    return ev;
  }

  savedState(): { fitas: number[]; rachas: (number | null)[] } {
    return {
      fitas: this.fitas.flatMap((f, i) => (f.got ? [i] : [])),
      rachas: this.rachas.map((r) => r.best),
    };
  }
}
