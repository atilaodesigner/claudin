// Coisas da rua que o carro derruba em vez de parar nelas: poste de calçada,
// lixeira, tambor, caixa de papelão, hidrante e caixa de energia.
// Na batida o colisor sai da grade, o carro perde só o impulso que o objeto
// "leva" (colisão com massa finita) e o objeto vira um corpo solto: o poste
// tomba pela base e apaga, o resto voa, quica, rola e para deitado.
// Longe do jogador e depois de um tempo, tudo volta pro lugar.

import * as THREE from 'three';
import { SpatialGrid, collide, rect, type Shape } from '../physics/collide';
import type { LampInstances } from './cityMesh';
import type { Lamp } from './city';

export interface BreakSpec {
  /** massa efetiva na batida (kg) */
  mass: number;
  /** velocidade normal mínima pra derrubar (m/s); abaixo disso é sólido */
  minV: number;
  fx?: 'water' | 'sparks';
}

export interface PropPart {
  im: THREE.InstancedMesh;
  /** matriz da malha dentro do modelo */
  local: THREE.Matrix4;
  /** instância própria dessa peça (senão a do objeto) */
  index?: number;
  /** some enquanto o objeto está solto (sombra de contato no chão) */
  hideOnHit?: boolean;
}

export interface BreakFx {
  sparks(x: number, y: number, z: number, n: number): void;
  water(x: number, y: number, z: number): void;
  sound(strength: number): void;
}

type State = 'idle' | 'fly' | 'rest' | 'sink' | 'gone';

interface Item {
  lamp: number; // índice em LampInstances (ou -1)
  shape: Shape;
  spec: BreakSpec;
  parts: PropPart[];
  index: number;
  scale: number;
  h: number;
  r: number;
  p0: THREE.Vector3;
  q0: THREE.Quaternion;
  state: State;
  t: number;
  fxT: number;
  kickCd: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  q: THREE.Quaternion;
  w: THREE.Vector3;
  // poste tombando pela base
  axis: THREE.Vector3;
  ang: number;
  angV: number;
  landed: boolean;
}

const G = 9.8;
const UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const RESPAWN_DIST = 90;
/** daqui pra cima (kg) é carro: voa menos, gira devagar, faz barulho de batida */
const HEAVY = 500;
const LAMP_REST = 0.02; // folga do chão quando deita (braço e cabeça)

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _s = new THREE.Vector3();
const _v = new THREE.Vector3(), _u = new THREE.Vector3(), _ax = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();

export class Breakables {
  private items: Item[] = [];
  private byShape = new Map<Shape, Item>();
  private active: Item[] = [];
  private dirty = new Set<THREE.InstancedMesh>();
  private near: Shape[] = [];
  private probe = rect(0, 0, 0.3, 0.3);
  private lampInst: LampInstances | null = null;
  private wireRanges: { a: Lamp; b: Lamp; start: number; end: number }[] = [];
  private wireAttr: THREE.BufferAttribute | null = null;
  private wireOrig: Float32Array | null = null;
  private coneAttr: THREE.BufferAttribute | null = null;
  private coneOrig: Float32Array | null = null;
  private coneVerts = 0;
  /** 1 = cabeça de poste apagada (índice de lampLights) */
  dead = new Uint8Array(0);

  constructor(
    private grid: SpatialGrid<Shape>,
    private ground: (x: number, z: number) => number,
    private fx: BreakFx,
  ) {}

  private make(lamp: number, shape: Shape, spec: BreakSpec, parts: PropPart[], index: number, base: THREE.Matrix4, h: number, r: number): Item {
    const p0 = new THREE.Vector3(), q0 = new THREE.Quaternion();
    base.decompose(p0, q0, _s);
    const it: Item = {
      lamp, shape, spec, parts, index, scale: _s.x, h, r, p0, q0,
      state: 'idle', t: 0, fxT: 0, kickCd: 0,
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(),
      axis: new THREE.Vector3(), ang: 0, angV: 0, landed: false,
    };
    this.items.push(it);
    this.byShape.set(shape, it);
    return it;
  }

  addLamps(li: LampInstances | null, lightCount: number, wires: { mesh: THREE.LineSegments; ranges: { a: Lamp; b: Lamp; start: number; end: number }[] }): void {
    this.dead = new Uint8Array(lightCount);
    this.wireRanges = wires.ranges;
    this.wireAttr = wires.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.wireOrig = (this.wireAttr.array as Float32Array).slice();
    if (!li) return;
    this.lampInst = li;
    const parts = li.body.map((v) => v.map((im) => ({ im, local: new THREE.Matrix4() })));
    li.lamps.forEach((l, i) => {
      if (!l.shape) return;
      // cruzeta/isoladores ficam em grupos por pedaço da cidade, com instância própria
      const own = parts[li.variant[i]!]!;
      const d = li.detail[i];
      this.make(i, l.shape, { mass: 380, minV: 4 }, d ? [...own, { im: d.im, local: new THREE.Matrix4(), index: d.slot }] : own, li.slot[i]!, li.base[i]!, 4.5, 0.15);
    });
  }

  addProps(list: { index: number; shape: Shape; base: THREE.Matrix4; h: number; r: number; spec: BreakSpec; name: string }[], parts: Map<string, PropPart[][]>): void {
    for (const b of list) {
      const p = parts.get(b.name)?.[b.index];
      if (p) this.make(-1, b.shape, b.spec, p, b.index, b.base, b.h, b.r);
    }
  }

  /** cones de luz dos postes (um trecho de vértices por cabeça, na ordem de lampLights) */
  setCones(mesh: THREE.Mesh | null, vertsPerHead: number): void {
    if (!mesh) return;
    this.coneAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.coneOrig = (this.coneAttr.array as Float32Array).slice();
    this.coneVerts = vertsPerHead;
  }

  get(shape: Shape): Item | undefined {
    return this.byShape.get(shape);
  }

  minV(shape: Shape): number {
    return this.byShape.get(shape)?.spec.minV ?? Infinity;
  }

  massOf(shape: Shape): number {
    return this.byShape.get(shape)?.spec.mass ?? Infinity;
  }

  isLamp(shape: Shape): boolean {
    return (this.byShape.get(shape)?.lamp ?? -1) >= 0;
  }

  /**
   * derruba o objeto do colisor `shape`. (vx, vz) = velocidade do carro depois
   * da batida, (nx, nz) = normal do contato (do objeto pro carro), `v` = impacto.
   */
  hit(shape: Shape, vx: number, vz: number, nx: number, nz: number, v: number): void {
    const it = this.byShape.get(shape);
    if (!it || it.state !== 'idle') return;
    this.grid.remove(it.shape);
    it.state = 'fly';
    it.t = 0;
    it.fxT = it.spec.fx ? 9 : 0;
    it.q.copy(it.q0);
    const speed = Math.hypot(vx, vz);
    if (it.lamp >= 0) {
      // tomba pra onde o carro empurrou
      _v.set(vx - nx * v * 0.5, 0, vz - nz * v * 0.5);
      if (_v.lengthSq() < 1e-4) _v.set(-nx, 0, -nz);
      _v.normalize();
      it.axis.crossVectors(UP, _v).normalize();
      it.ang = 0;
      it.angV = Math.min(2.4, 0.35 + (speed + v) * 0.05);
      it.landed = false;
      this.lampOff(it.lamp, true);
      const li = this.lampInst!;
      const l = li.lamps[it.lamp]!;
      this.fx.sparks(l.x + l.dirX * 2.2, 8.4, l.z + l.dirZ * 2.2, 18);
      this.fx.sound(Math.max(5, v));
    } else {
      // voa com o carro: quanto mais leve, mais acompanha (carro estacionado é arremessado, mas pesa)
      const heavy = it.spec.mass >= HEAVY;
      const k = it.spec.mass < 50 ? 1.15 : heavy ? 0.6 : 0.8;
      it.pos.copy(it.p0).y += it.h;
      it.vel.set(vx * k - nx * (1 + v * 0.35), 0, vz * k - nz * (1 + v * 0.35));
      const hs = Math.hypot(it.vel.x, it.vel.z);
      if (hs > 16) it.vel.multiplyScalar(16 / hs);
      it.vel.y = Math.min(7, 1.6 + (speed + v) * 0.12) * (it.spec.mass < 50 ? 1 : heavy ? 0.5 : 0.6);
      it.w.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.4, Math.random() - 0.5).normalize().multiplyScalar(heavy ? Math.min(5, 0.8 + (speed + v) * 0.16) : Math.min(14, 2 + (speed + v) * 0.45));
      if (it.spec.fx === 'sparks') this.fx.sparks(it.p0.x, it.p0.y + 0.6, it.p0.z, 26);
      this.fx.sound(it.spec.mass < 50 ? Math.min(3, 1 + v * 0.2) : heavy ? Math.max(7, v) : Math.max(4, v * 0.6));
      if (heavy) this.fx.sparks(it.pos.x, 0.5, it.pos.z, 20);
    }
    this.active.push(it);
  }

  private lampOff(i: number, off: boolean): void {
    const li = this.lampInst;
    if (!li) return;
    const light = li.light[i]!;
    this.dead[light] = off ? 1 : 0;
    li.pool.setMatrixAt(i, off ? ZERO : li.base[i]!);
    this.dirty.add(li.pool);
    // cone de luz
    if (this.coneAttr && this.coneOrig) {
      const a = this.coneAttr.array as Float32Array;
      const s = light * this.coneVerts * 3, e = s + this.coneVerts * 3;
      if (off) a.fill(0, s, e);
      else a.set(this.coneOrig.subarray(s, e), s);
      this.coneAttr.needsUpdate = true;
    }
    // fios que chegam nesse poste arrebentam (e voltam quando os dois estão em pé)
    if (this.wireAttr && this.wireOrig) {
      const a = this.wireAttr.array as Float32Array;
      const l = li.lamps[i]!;
      for (const w of this.wireRanges) {
        if (w.a !== l && w.b !== l) continue;
        if (off) a.fill(0, w.start, w.end);
        else if (!this.isDown(w.a) && !this.isDown(w.b)) a.set(this.wireOrig.subarray(w.start, w.end), w.start);
      }
      this.wireAttr.needsUpdate = true;
    }
  }

  private isDown(l: Lamp): boolean {
    const it = l.shape ? this.byShape.get(l.shape) : undefined;
    return !!it && it.state !== 'idle';
  }

  private write(it: Item, hidden = false): void {
    if (hidden) {
      for (const p of it.parts) {
        p.im.setMatrixAt(p.index ?? it.index, ZERO);
        this.dirty.add(p.im);
      }
      return;
    }
    // T(pos) · R(q) · T(0, -h, 0) · S(escala) · malha
    _m.compose(it.pos, it.q, _s.setScalar(it.scale));
    _m2.makeTranslation(0, -it.h / it.scale, 0);
    _m.multiply(_m2);
    const loose = it.state !== 'idle';
    for (const p of it.parts) {
      p.im.setMatrixAt(p.index ?? it.index, p.hideOnHit && loose ? ZERO : _m2.multiplyMatrices(_m, p.local));
      this.dirty.add(p.im);
    }
  }

  private restore(it: Item): void {
    it.state = 'idle';
    it.pos.copy(it.p0).y += it.h;
    it.q.copy(it.q0);
    this.write(it);
    this.grid.insert(it.shape);
    if (it.lamp >= 0) this.lampOff(it.lamp, false);
  }

  /** põe tudo de volta (ao reiniciar) */
  resetAll(): void {
    for (const it of this.active) this.restore(it);
    this.active.length = 0;
    this.flush();
  }

  /**
   * passo da simulação. car = retângulo do carro (pra chutar o que já está
   * no chão), (cvx, cvz) = velocidade dele.
   */
  update(dt: number, car: { x: number; z: number; rot: number; hw: number; hl: number }, cvx: number, cvz: number): void {
    if (!this.active.length) return;
    for (let k = this.active.length - 1; k >= 0; k--) {
      const it = this.active[k]!;
      it.t += dt;
      it.kickCd -= dt;
      if (it.fxT > 0) {
        it.fxT -= dt;
        if (it.spec.fx === 'water') this.fx.water(it.p0.x, it.p0.y + 0.3, it.p0.z);
        else if (Math.random() < dt * 6) this.fx.sparks(it.p0.x, it.p0.y + 0.4, it.p0.z, 6);
      }
      if (it.lamp >= 0) this.stepLamp(it, dt);
      else this.stepProp(it, dt, car, cvx, cvz);
      // volta pro lugar quando ninguém está vendo
      const far = Math.hypot(it.p0.x - car.x, it.p0.z - car.z) > RESPAWN_DIST;
      const ready = it.state === 'gone' || (it.lamp < 0 && it.t > (it.state === 'rest' ? 20 : 30));
      if (far && ready && it.fxT <= 0) {
        this.restore(it);
        this.active.splice(k, 1);
      }
    }
    this.flush();
  }

  private stepLamp(it: Item, dt: number): void {
    const top = Math.PI / 2 - LAMP_REST;
    if (it.state === 'fly') {
      it.angV += 1.63 * Math.sin(Math.max(0.05, it.ang)) * dt; // 3g/2L
      it.ang += it.angV * dt;
      if (it.ang >= top) {
        it.ang = top;
        if (!it.landed) {
          it.landed = true;
          const tip = _v.copy(it.p0).addScaledVector(_u.crossVectors(it.axis, UP), 8.4);
          this.fx.sparks(tip.x, 0.3, tip.z, 22);
          this.fx.sound(7);
        }
        it.angV = -it.angV * 0.18;
        if (Math.abs(it.angV) < 0.25) {
          it.state = 'rest';
          it.t = 0;
        }
      }
    } else if (it.state === 'rest' && it.t > 5) {
      it.state = 'sink';
      it.t = 0;
    }
    _qa.setFromAxisAngle(it.axis, it.ang);
    it.q.multiplyQuaternions(_qa, it.q0);
    it.pos.set(0, it.h, 0).applyQuaternion(_qa).add(it.p0);
    if (it.state === 'sink') {
      // afunda devagar no asfalto e some
      it.pos.y -= it.t * 0.5;
      if (it.t > 2) {
        it.state = 'gone';
        this.write(it, true);
        return;
      }
    }
    if (it.state !== 'gone') this.write(it);
  }

  private stepProp(it: Item, dt: number, car: { x: number; z: number; rot: number; hw: number; hl: number }, cvx: number, cvz: number): void {
    // carro passando por cima chuta de novo
    if (it.kickCd <= 0) {
      const cs = Math.hypot(cvx, cvz);
      _u.set(0, 1, 0).applyQuaternion(it.q);
      const low = it.pos.y - it.h * Math.abs(_u.y) < 0.9;
      if (cs > 1.5 && low) {
        this.probe.x = it.pos.x;
        this.probe.z = it.pos.z;
        this.probe.hw = this.probe.hl = it.r;
        this.probe.rot = 0;
        const c = collide(this.probe, { kind: 'rect', x: car.x, z: car.z, hw: car.hw, hl: car.hl, rot: car.rot });
        if (c) {
          // leve acompanha o carro; pesado (hidrante, caixa de energia) só é empurrado pro lado
          const k = it.spec.mass < 50 ? 1.1 : it.spec.mass >= HEAVY ? 0.35 : 0.55, side = it.spec.mass < 50 ? 2 : 3.5;
          it.vel.set(cvx * k + c.nx * side, Math.min(5, 1 + cs * 0.1) * (it.spec.mass < 50 ? 1 : 0.5), cvz * k + c.nz * side);
          it.w.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize().multiplyScalar(Math.min(12, 2 + cs * 0.4));
          it.state = 'fly';
          it.t = 0;
          it.kickCd = 0.3;
          this.fx.sound(Math.min(3, 1 + cs * 0.1));
        }
      }
    }
    if (it.state !== 'fly') return;

    it.vel.y -= G * dt;
    it.pos.addScaledVector(it.vel, dt);
    // gira
    const wl = it.w.length();
    if (wl > 1e-4) {
      _qb.setFromAxisAngle(_v.copy(it.w).divideScalar(wl), wl * dt);
      it.q.premultiply(_qb).normalize();
    }
    // paredes, muros e outros objetos
    this.probe.x = it.pos.x;
    this.probe.z = it.pos.z;
    this.probe.hw = this.probe.hl = it.r * 0.8;
    this.probe.rot = 0;
    this.grid.near(it.pos.x - 1, it.pos.z - 1, it.pos.x + 1, it.pos.z + 1, this.near);
    for (const sh of this.near) {
      const c = collide(this.probe, sh);
      if (!c) continue;
      const other = this.byShape.get(sh);
      const vn = it.vel.x * c.nx + it.vel.z * c.nz;
      if (other && other.state === 'idle' && -vn > other.spec.minV * 1.5 && it.spec.mass >= other.spec.mass * 0.3) {
        // derruba o vizinho (efeito dominó)
        this.hit(sh, it.vel.x * 0.7, it.vel.z * 0.7, c.nx, c.nz, -vn * 0.5);
        it.vel.multiplyScalar(0.6);
        continue;
      }
      it.pos.x += c.nx * c.depth;
      it.pos.z += c.nz * c.depth;
      this.probe.x = it.pos.x;
      this.probe.z = it.pos.z;
      if (vn < 0) {
        it.vel.x -= 1.35 * vn * c.nx;
        it.vel.z -= 1.35 * vn * c.nz;
      }
    }
    // chão: extensão vertical de um cilindro inclinado
    _u.set(0, 1, 0).applyQuaternion(it.q);
    const uy = Math.abs(_u.y);
    const ext = it.h * uy + it.r * Math.sqrt(Math.max(0, 1 - uy * uy));
    const g = this.ground(it.pos.x, it.pos.z);
    if (it.pos.y - ext <= g) {
      it.pos.y = g + ext;
      if (it.vel.y < 0) it.vel.y = it.vel.y < -1.2 ? -it.vel.y * 0.3 : 0;
      const f = Math.max(0, 1 - 3.2 * dt);
      it.vel.x *= f;
      it.vel.z *= f;
      it.w.multiplyScalar(Math.max(0, 1 - 2.6 * dt));
      // assenta: em pé se estava quase em pé, senão deitado
      const target = uy > 0.72 ? _v.set(0, Math.sign(_u.y), 0) : _v.set(_u.x, 0, _u.z).normalize();
      const ax = _ax.crossVectors(_u, target);
      it.w.addScaledVector(ax, 9 * dt);
      if (it.vel.lengthSq() < 0.03 && it.w.lengthSq() < 0.08 && ax.lengthSq() < 0.004) {
        it.state = 'rest';
        it.t = 0;
        it.vel.set(0, 0, 0);
        it.w.set(0, 0, 0);
      }
    }
    this.write(it);
  }

  private flush(): void {
    for (const im of this.dirty) im.instanceMatrix.needsUpdate = true;
    this.dirty.clear();
  }
}
