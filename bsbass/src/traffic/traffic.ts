// Tráfego: carros andam na mão (direita), escolhem direção nos cruzamentos,
// contornam o balão no sentido certo, freiam atrás de outro carro/do jogador
// e saem rodando quando levam uma pancada.

import * as THREE from 'three';
import { BALAO, EXTENT, LANE, NODES, ROAD, nodePos } from '../world/city';
import { rect, type Rect } from '../physics/collide';
import { buildVehicle, PAINTS } from './vehicles';
import { prepareCar, repaint, type CarEntry } from '../car/gltfCar';
import { trafficLights } from '../car/gltfRig';

const DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // +X +Z -X -Z
const BALAO_NODE = (NODES - 1) / 2;

function right(d: number): [number, number] {
  // direita de quem anda em (dx,dz): heading h -> frente (sin h, cos h), esquerda (cos h, -sin h)
  const [dx, dz] = DIRS[d]!;
  return [-dz, dx];
}

function isBalao(i: number, j: number): boolean {
  return i === BALAO_NODE && j === BALAO_NODE;
}

function nodeGap(i: number, j: number): number {
  return isBalao(i, j) ? BALAO.ring + 3 : ROAD / 2 + 3;
}

export interface TrafficCar {
  group: THREE.Group;
  lightsMat: THREE.MeshBasicMaterial;
  model: number;
  halfW: number;
  halfL: number;
  mass: number;
  x: number;
  z: number;
  heading: number;
  speed: number;
  cruise: number;
  path: number[];
  seg: number;
  segT: number;
  i: number; // nó de destino
  j: number;
  dir: number;
  knocked: boolean;
  vx: number;
  vz: number;
  yawRate: number;
  still: number;
  nearMissCd: number;
  honkCd: number;
  rect: Rect;
}

export class Traffic {
  readonly group = new THREE.Group();
  readonly cars: TrafficCar[] = [];
  honks: TrafficCar[] = [];
  private rnd: () => number;

  constructor(count: number, seed = 7, models: { entry: CarEntry; scene: THREE.Group }[] = []) {
    let s = seed;
    const shadowTex = softShadow();
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, color: 0x000000, transparent: true, opacity: 0.7, depthWrite: false });
    this.rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < count; k++) {
      let model = k % 11 === 5 ? 4 : Math.floor(this.rnd() * 4);
      const paint = model === 4 ? [0x1d6fb8, 0x2a8a3a, 0xd8d8d0][k % 3]! : PAINTS[Math.floor(this.rnd() * PAINTS.length)]!;
      const g = new THREE.Group();
      const lightsMat = new THREE.MeshBasicMaterial({ vertexColors: true });
      let v: { halfW: number; halfL: number; mass: number };
      const pick = models.length ? this.pickModel(models, model === 4) : null;
      if (pick) {
        // carro brasileiro de verdade (GLB)
        const p = prepareCar(pick.scene, pick.entry);
        if (pick.entry.recolor !== false && !pick.entry.bus) repaint(p, paint, null, 0.35);
        g.add(p.root, trafficLights(p));
        const bus = !!pick.entry.bus;
        model = bus ? 4 : model === 4 ? 0 : model;
        const vol = p.halfW * p.halfL * p.height;
        v = { halfW: p.halfW, halfL: p.halfL, mass: bus ? 9000 : Math.round(THREE.MathUtils.clamp(vol * 220, 800, 2200)) };
      } else {
        const geo = buildVehicle(model, paint, true);
        g.add(new THREE.Mesh(geo.body, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.45 })));
        g.add(new THREE.Mesh(geo.lights, lightsMat));
        v = geo;
      }
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(v.halfW * 2 + 0.6, v.halfL * 2 + 0.8), shadowMat);
      sh.rotation.x = -Math.PI / 2;
      sh.position.y = 0.02;
      sh.renderOrder = 2;
      sh.layers.set(1);
      g.add(sh);
      this.group.add(g);
      const car: TrafficCar = {
        group: g, lightsMat, model, halfW: v.halfW, halfL: v.halfL, mass: v.mass,
        x: 0, z: 0, heading: 0, speed: 0, cruise: model === 4 ? 10 : 11 + this.rnd() * 5,
        path: [], seg: 0, segT: 0, i: 0, j: 0, dir: 0,
        knocked: false, vx: 0, vz: 0, yawRate: 0, still: 0, nearMissCd: 0, honkCd: 0,
        rect: rect(0, 0, v.halfW, v.halfL),
      };
      this.spawn(car, null);
      this.cars.push(car);
    }
  }

  /** sorteia um modelo GLB pelo peso; ônibus só na vaga de ônibus */
  private pickModel(models: { entry: CarEntry; scene: THREE.Group }[], bus: boolean): { entry: CarEntry; scene: THREE.Group } | null {
    const pool = models.filter((m) => !!m.entry.bus === bus);
    if (!pool.length) return null;
    const total = pool.reduce((a, m) => a + (m.entry.weight ?? 1), 0);
    let r = this.rnd() * total;
    for (const m of pool) {
      r -= m.entry.weight ?? 1;
      if (r <= 0) return m;
    }
    return pool[pool.length - 1]!;
  }

  /** coloca o carro no meio de uma rua aleatória (longe do ponto dado) */
  spawn(car: TrafficCar, avoid: { x: number; z: number } | null): void {
    for (let tries = 0; tries < 40; tries++) {
      const dir = Math.floor(this.rnd() * 4);
      const i = Math.floor(this.rnd() * NODES), j = Math.floor(this.rnd() * NODES);
      const [dx, dz] = DIRS[dir]!;
      const ti = i + dx, tj = j + dz;
      if (ti < 0 || tj < 0 || ti >= NODES || tj >= NODES) continue;
      const [rx, rz] = right(dir);
      const t = 0.3 + this.rnd() * 0.4;
      const x = nodePos(i) + dx * PITCH_T(t) + rx * LANE;
      const z = nodePos(j) + dz * PITCH_T(t) + rz * LANE;
      if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < 120) continue;
      if (this.cars.some((c) => c !== car && Math.hypot(c.x - x, c.z - z) < 12)) continue;
      car.x = x;
      car.z = z;
      car.i = ti;
      car.j = tj;
      car.dir = dir;
      car.heading = Math.atan2(dx, dz);
      car.speed = car.cruise;
      car.knocked = false;
      car.vx = car.vz = car.yawRate = 0;
      car.still = 0;
      const [ex, ez] = this.edgeEnd(ti, tj, dir);
      car.path = [x, z, ex, ez];
      car.seg = 0;
      car.segT = 0;
      car.group.rotation.set(0, car.heading, 0);
      return;
    }
  }

  private edgeEnd(i: number, j: number, dir: number): [number, number] {
    const [dx, dz] = DIRS[dir]!;
    const [rx, rz] = right(dir);
    const g = nodeGap(i, j);
    return [nodePos(i) - dx * g + rx * LANE, nodePos(j) - dz * g + rz * LANE];
  }

  private edgeStart(i: number, j: number, dir: number): [number, number] {
    const [dx, dz] = DIRS[dir]!;
    const [rx, rz] = right(dir);
    const g = nodeGap(i, j);
    return [nodePos(i) + dx * g + rx * LANE, nodePos(j) + dz * g + rz * LANE];
  }

  /** chegou no cruzamento (i,j) vindo em `dir`: escolhe a próxima rua e monta a curva */
  private nextLeg(car: TrafficCar): void {
    const { i, j, dir } = car;
    const options: number[] = [];
    for (let d = 0; d < 4; d++) {
      if (d === (dir + 2) % 4) continue;
      const [dx, dz] = DIRS[d]!;
      const ni = i + dx, nj = j + dz;
      if (ni < 0 || nj < 0 || ni >= NODES || nj >= NODES) continue;
      options.push(d);
    }
    let d2 = options.includes(dir) && this.rnd() < 0.55 ? dir : options[Math.floor(this.rnd() * options.length)]!;
    if (d2 === undefined) d2 = (dir + 2) % 4;
    const bx = nodePos(i), bz = nodePos(j);
    const [sx, sz] = [car.path[car.path.length - 2]!, car.path[car.path.length - 1]!];
    const [ox, oz] = this.edgeStart(i, j, d2);
    const pts: number[] = [sx, sz];

    if (isBalao(i, j)) {
      // contorna a ilha deixando ela à esquerda (ângulo decrescente)
      const R = BALAO.island + 8;
      const aIn = Math.atan2(sz - bz, sx - bx);
      const aOut = Math.atan2(oz - bz, ox - bx);
      let sweep = aIn - aOut;
      while (sweep <= 0.3) sweep += Math.PI * 2;
      const steps = Math.ceil(sweep / 0.2);
      for (let k = 0; k <= steps; k++) {
        const a = aIn - (sweep * k) / steps;
        pts.push(bx + Math.cos(a) * R, bz + Math.sin(a) * R);
      }
    } else {
      const [r1x, r1z] = right(dir);
      const [r2x, r2z] = right(d2);
      let cx: number, cz: number;
      if (d2 === dir) {
        cx = (sx + ox) / 2;
        cz = (sz + oz) / 2;
      } else {
        cx = bx + r1x * LANE + r2x * LANE;
        cz = bz + r1z * LANE + r2z * LANE;
      }
      for (let k = 1; k < 8; k++) {
        const t = k / 8, u = 1 - t;
        pts.push(u * u * sx + 2 * u * t * cx + t * t * ox, u * u * sz + 2 * u * t * cz + t * t * oz);
      }
    }
    pts.push(ox, oz);
    const [dx, dz] = DIRS[d2]!;
    const ni = i + dx, nj = j + dz;
    const [ex, ez] = this.edgeEnd(ni, nj, d2);
    pts.push(ex, ez);
    car.path = pts;
    car.seg = 0;
    car.segT = 0;
    car.i = ni;
    car.j = nj;
    car.dir = d2;
  }

  update(dt: number, player: { x: number; z: number; speed: number }, camPos: THREE.Vector3): void {
    this.honks.length = 0;
    for (const car of this.cars) {
      car.nearMissCd = Math.max(0, car.nearMissCd - dt);
      car.honkCd = Math.max(0, car.honkCd - dt);
      if (car.knocked) {
        // rodando depois da batida: atrito forte até parar
        const sp = Math.hypot(car.vx, car.vz);
        const dec = Math.min(sp, 7 * dt);
        if (sp > 0) {
          car.vx -= (car.vx / sp) * dec;
          car.vz -= (car.vz / sp) * dec;
        }
        car.yawRate *= Math.max(0, 1 - 2.5 * dt);
        car.x += car.vx * dt;
        car.z += car.vz * dt;
        car.heading += car.yawRate * dt;
        if (sp < 0.4) car.still += dt;
        // longe da vista? volta pro jogo em outro lugar
        if (car.still > 4 && Math.hypot(car.x - camPos.x, car.z - camPos.z) > 70) this.spawn(car, player);
      } else {
        // quem tá na frente?
        let target = car.cruise;
        const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
        const ahead = (x: number, z: number, range: number): number => {
          const dx = x - car.x, dz = z - car.z;
          const along = dx * fx + dz * fz;
          if (along < 0 || along > range) return Infinity;
          const lat = Math.abs(dx * fz - dz * fx);
          return lat < 2.2 ? along : Infinity;
        };
        for (const o of this.cars) {
          if (o === car) continue;
          const d = ahead(o.x, o.z, 16 + car.halfL);
          if (d < Infinity) target = Math.min(target, Math.max(0, (d - car.halfL - o.halfL - 2) * 0.9));
        }
        const dp = ahead(player.x, player.z, 18);
        if (dp < Infinity) {
          target = Math.min(target, Math.max(0, (dp - car.halfL - 4) * 0.8));
          if (dp < 12 && car.honkCd <= 0 && car.speed < 4) {
            this.honks.push(car);
            car.honkCd = 4 + Math.random() * 4;
          }
        }
        // desacelera nas curvas
        const turning = car.path.length > 4;
        if (turning && car.seg < car.path.length / 2 - 2) target = Math.min(target, car.model === 4 ? 6 : 8);
        car.speed += Math.max(-9 * dt, Math.min(3 * dt, target - car.speed));

        // anda pelo caminho
        let move = car.speed * dt;
        while (move > 0) {
          const k = car.seg * 2;
          if (k + 3 >= car.path.length) {
            this.nextLeg(car);
            continue;
          }
          const ax = car.path[k]!, az = car.path[k + 1]!, bx = car.path[k + 2]!, bz = car.path[k + 3]!;
          const len = Math.hypot(bx - ax, bz - az) || 0.001;
          const left = len - car.segT;
          if (move < left) {
            car.segT += move;
            move = 0;
          } else {
            move -= left;
            car.seg++;
            car.segT = 0;
          }
          const kk = car.seg * 2;
          if (kk + 3 < car.path.length) {
            const px = car.path[kk]!, pz = car.path[kk + 1]!, qx = car.path[kk + 2]!, qz = car.path[kk + 3]!;
            const l = Math.hypot(qx - px, qz - pz) || 0.001;
            const t = car.segT / l;
            car.x = px + (qx - px) * t;
            car.z = pz + (qz - pz) * t;
            const h = Math.atan2(qx - px, qz - pz);
            let dh = h - car.heading;
            while (dh > Math.PI) dh -= Math.PI * 2;
            while (dh < -Math.PI) dh += Math.PI * 2;
            car.heading += dh * Math.min(1, dt * 8);
          }
        }
        car.vx = fx * car.speed;
        car.vz = fz * car.speed;
      }
      car.rect.x = car.x;
      car.rect.z = car.z;
      car.rect.rot = car.heading;
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.heading;
      // saiu do mapa de algum jeito
      if (Math.abs(car.x) > EXTENT + 60 || Math.abs(car.z) > EXTENT + 60) this.spawn(car, player);
    }
  }

  knock(car: TrafficCar, jx: number, jz: number, px: number, pz: number): void {
    if (!car.knocked) {
      car.knocked = true;
      car.vx = Math.sin(car.heading) * car.speed;
      car.vz = Math.cos(car.heading) * car.speed;
      car.yawRate = 0;
      car.speed = 0;
    }
    car.still = 0;
    car.vx += jx / car.mass;
    car.vz += jz / car.mass;
    const rx = px - car.x, rz = pz - car.z;
    const inertia = car.mass * (car.halfL * car.halfL + car.halfW * car.halfW) / 3;
    car.yawRate += (rz * jx - rx * jz) / inertia;
  }
}

function softShadow(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function PITCH_T(t: number): number {
  return (nodePos(1) - nodePos(0)) * t;
}
