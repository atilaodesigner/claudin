// Capítulos do BSBASS THE GAME rodando no mundo aberto.
//
// Porte das partes de corrida do bsbass/site/index.html (JOGADOR, POLÍCIA,
// BONDE / CAMINHÃO, CAPÍTULOS / FLUXO, CINEMÁTICAS, RESULTADO, partículas,
// efeitos de som). As regras, os números, a IA e os roteiros das cinemáticas
// são os mesmos; o que mudou:
//   - a "pista" é o circuito do capítulo pelas ruas da cidade (routes.ts);
//   - o carro do jogador é o carro do mundo aberto (física própria), então o
//     jogador é projetado na pista em vez de ser preso nela; as paredes são
//     as da cidade (casas + barreiras da missão) e a batida vem da colisão real;
//   - a largada é no ponto do capítulo (não sai mais do ferro-velho);
//   - o nitro é o do mundo aberto.
/* eslint-disable */
import * as THREE from 'three';
import { BSB as K } from './core.js';
import { MODELS, REAL, realModel, makeMat, makeModel, makeCharacter, makePaintMat, setPaint, glowTex, shadowTex, beamTex, canvasTex } from './models';
import { RHALF, LANES, frameAt, curvAt, wrapS as wrapRoute } from './routes';

const V3 = THREE.Vector3;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const rand = (a, b) => a + Math.random() * (b - a), pick = (a) => a[(Math.random() * a.length) | 0];
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const sign = (v) => (v < 0 ? -1 : 1);
const fmt = (n) => Math.round(n).toLocaleString('pt-BR');

const CFG = K.CONFIG;
const ROAD_HALF = RHALF;
const CAR_LEN = 4.6, TRUCK_LEN = 17;
const START_S = 0;
const ROLL_V = 13;
const SLOT_S = (i) => (i === 0 ? 0 : [-5, -5, -11][i - 1] || -14), SLOT_X = (i) => (i === 0 ? 0 : [-4.6, 4.6, 0][i - 1] || 0);
// escala lateral: a rua da cidade é mais estreita que a pista original (20 x 22 m)
const LX = RHALF / 11;
const AI_SKILL = { duckjay: { driftK: 0.0045, angle: 0.74, aggr: 1 }, diey: { driftK: 0.0056, angle: 0.6, aggr: 0.85 }, bella: { driftK: 0.0041, angle: 0.86, aggr: 1.1 }, bozo: { driftK: 0.0043, angle: 0.82, aggr: 1.15 } };
export const RESULT_TEXT = {
  lap: ['Rolê concluído', 'O bonde passou limpo.'],
  survive: ['Despistou a polícia', 'Ninguém ficou pra trás.'],
  intercept: ['Carga interceptada', 'O caminhão parou no bloqueio do bonde.'],
  escape: ['Sumiram na noite', 'O bonde sumiu no bairro.'],
  dead: ['Perdeu o carro', 'Bateu demais. Bora de novo?'],
  truck: ['O caminhão escapou', 'Faltou segurar atrás dele.'],
};

/**
 * host: {
 *   scene, car (CarPhysics), playerRoot() -> Object3D (rig do jogador), playerBody() -> Object3D,
 *   playerDims() -> {wid, len, hgt}, audio (Audio do jogo), hud (MissionHud), pilotId(), carKey(),
 *   reduceFx(), quality() (0..1 de partículas), onResult(r), onFinishIntro(), input() -> {throttle, handbrake}
 * }
 */
export function createMission(host) {
  const scene = host.scene;
  const H = host.hud;
  let TR = null;
  const FP = new V3(), FF = new V3(), FR = new V3(), FU = new V3(0, 1, 0), FL = new V3();
  const _fr = { x: 0, z: 0, fx: 0, fz: 1, rx: -1, rz: 0 };
  function frame(s) {
    frameAt(TR, s, _fr);
    FP.set(_fr.x, 0, _fr.z);
    FF.set(_fr.fx, 0, _fr.fz);
    FR.set(_fr.rx, 0, _fr.rz);
    FL.copy(FR).negate();
  }
  const wrapS = (s) => wrapRoute(TR, s);
  const curv = (s) => curvAt(TR, s);
  function wpos(s, x, y, out) {
    frame(s);
    out.copy(FP).addScaledVector(FR, x);
    out.y += y;
    return out;
  }
  const QF = () => host.quality();

  // ---------------- partículas (copiadas do original) ----------------
  const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _S = new V3(), _P = new V3(), _C = new THREE.Color(), _AX = new V3(0.3, 1, 0.2).normalize();
  class Puffs {
    constructor(n, geo, mat) {
      this.n = n;
      this.mesh = new THREE.InstancedMesh(geo, mat, n);
      this.mesh.frustumCulled = false;
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
      this.p = new Float32Array(n * 3);
      this.v = new Float32Array(n * 3);
      this.age = new Float32Array(n).fill(99);
      this.life = new Float32Array(n).fill(1);
      this.s0 = new Float32Array(n);
      this.s1 = new Float32Array(n);
      this.dead = new Uint8Array(n);
      this.i = 0;
      this.drag = 1;
      this.grav = 0;
      _M.makeScale(0, 0, 0);
      for (let i = 0; i < n; i++) this.mesh.setMatrixAt(i, _M);
      this.mesh.layers.set(1);
      scene.add(this.mesh);
    }
    emit(p, vx, vy, vz, life, s0, s1, col) {
      const i = this.i;
      this.i = (i + 1) % this.n;
      this.p[i * 3] = p.x;
      this.p[i * 3 + 1] = p.y;
      this.p[i * 3 + 2] = p.z;
      this.v[i * 3] = vx;
      this.v[i * 3 + 1] = vy;
      this.v[i * 3 + 2] = vz;
      this.age[i] = 0;
      this.life[i] = life;
      this.s0[i] = s0;
      this.s1[i] = s1;
      this.dead[i] = 0;
      this.mesh.setColorAt(i, col);
      this.mesh.instanceColor.needsUpdate = true;
    }
    update(dt) {
      const d = Math.exp(-this.drag * dt);
      for (let i = 0; i < this.n; i++) {
        if (this.age[i] >= this.life[i]) {
          if (!this.dead[i]) {
            this.dead[i] = 1;
            _M.makeScale(0, 0, 0);
            this.mesh.setMatrixAt(i, _M);
          }
          continue;
        }
        this.age[i] += dt;
        const k = Math.min(1, this.age[i] / this.life[i]);
        const o = i * 3;
        this.v[o] *= d;
        this.v[o + 1] = this.v[o + 1] * d + this.grav * dt;
        this.v[o + 2] *= d;
        this.p[o] += this.v[o] * dt;
        this.p[o + 1] += this.v[o + 1] * dt;
        this.p[o + 2] += this.v[o + 2] * dt;
        let sc = this.s0[i] + (this.s1[i] - this.s0[i]) * (1 - (1 - k) * (1 - k));
        if (k > 0.72) sc *= (1 - k) / 0.28;
        _Q.setFromAxisAngle(_AX, i * 1.7 + this.age[i] * 1.3);
        _S.set(sc, sc, sc);
        _P.set(this.p[o], this.p[o + 1], this.p[o + 2]);
        _M.compose(_P, _Q, _S);
        this.mesh.setMatrixAt(i, _M);
      }
      this.mesh.instanceMatrix.needsUpdate = true;
    }
    clear() {
      this.age.fill(99);
    }
  }
  const smoke = new Puffs(380, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0xcfcfd4, flatShading: true, emissive: 0x16161c, transparent: true, opacity: 0.5, depthWrite: false }));
  smoke.drag = 2.2;
  smoke.grav = 0.9;
  const fire = new Puffs(220, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  fire.drag = 2.2;
  fire.grav = 3;
  const sparks = new Puffs(260, new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  sparks.drag = 0.6;
  sparks.grav = -22;
  const SKN = 900;
  const skids = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.36, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    SKN,
  );
  skids.frustumCulled = false;
  _M.makeScale(0, 0, 0);
  for (let i = 0; i < SKN; i++) skids.setMatrixAt(i, _M);
  skids.layers.set(1);
  scene.add(skids);
  let skidI = 0;
  function skidAt(p, q) {
    _S.set(1, 1, 1);
    _M.compose(p, q, _S);
    skids.setMatrixAt(skidI, _M);
    skidI = (skidI + 1) % SKN;
    skids.instanceMatrix.needsUpdate = true;
  }
  function clearSkids() {
    _M.makeScale(0, 0, 0);
    for (let i = 0; i < SKN; i++) skids.setMatrixAt(i, _M);
    skids.instanceMatrix.needsUpdate = true;
  }

  // ---------------- luzes da missão (só ligadas durante o capítulo) ----------------
  const sirenLights = [0, 1].map(() => {
    const l = new THREE.PointLight(0xff2020, 0, 26, 1.5);
    l.visible = false;
    scene.add(l);
    return l;
  });
  const truckLight = new THREE.PointLight(0xff1a1a, 0, 34, 1.3);
  truckLight.visible = false;
  scene.add(truckLight);
  const boomLight = new THREE.PointLight(0xff8a2a, 0, 40, 1.5);
  boomLight.visible = false;
  scene.add(boomLight);
  // o original usa luz "legada"; no renderizador físico precisa de mais intensidade
  const LK = 9;

  function smokeCol(p, base = 0.88) {
    _C.setRGB(base, base, base * 1.02);
    const dT = p.distanceTo(TRUCK.g.position);
    if (TRUCK.g.visible && dT < 40) {
      const k = (1 - dT / 40) * 0.6;
      _C.r = lerp(_C.r, 1, k);
      _C.g = lerp(_C.g, 0.25, k);
      _C.b = lerp(_C.b, 0.25, k);
    }
    for (const l of sirenLights) {
      if (l.intensity <= 0) continue;
      const d = p.distanceTo(l.position);
      if (d < 22) {
        const k = (1 - d / 22) * 0.55;
        _C.r = lerp(_C.r, l.color.r, k);
        _C.g = lerp(_C.g, l.color.g, k);
        _C.b = lerp(_C.b, l.color.b, k);
      }
    }
    return _C;
  }
  function explode(p, big = 1) {
    for (let i = 0; i < 26 * big; i++) {
      _C.setHSL(rand(0.02, 0.11), 1, rand(0.5, 0.65));
      fire.emit(p, rand(-7, 7), rand(2, 11), rand(-7, 7), rand(0.35, 0.8), rand(0.6, 1.2) * big, rand(1.6, 2.8) * big, _C);
    }
    for (let i = 0; i < 8 * big; i++) {
      const c = rand(0.08, 0.2);
      _C.setRGB(c, c, c * 1.1);
      smoke.emit(p, rand(-5, 5), rand(3, 9), rand(-5, 5), rand(0.9, 1.5), rand(0.5, 0.8) * big, rand(1.2, 2) * big, _C);
    }
    for (let i = 0; i < 34 * big; i++) {
      _C.setHSL(rand(0.05, 0.12), 1, 0.6);
      sparks.emit(p, rand(-16, 16), rand(6, 20), rand(-16, 16), rand(0.5, 1.1), 0.2, 0.12, _C);
    }
    boomLight.position.copy(p).y += 3;
    boomLight.intensity = 9 * big * LK;
  }
  function sparkBurst(p, n = 10, col = 0xffc060) {
    _C.set(col);
    for (let i = 0; i < n; i++) sparks.emit(p, rand(-9, 9), rand(3, 10), rand(-9, 9), rand(0.25, 0.6), 0.16, 0.1, _C);
  }

  // ---------------- som (efeitos do original, no contexto de áudio do jogo) ----------------
  const AU = {
    nb: null,
    ctx() {
      const c = host.audio.ctx;
      return c && c.state === 'running' ? c : null;
    },
    out() {
      return host.audio.carBus;
    },
    env(n, t, a, p, r) {
      n.gain.setValueAtTime(0, t);
      n.gain.linearRampToValueAtTime(p, t + a);
      n.gain.exponentialRampToValueAtTime(0.0001, t + a + r);
    },
    noise(t, dur, type, freq, peak, q = 1, to) {
      const c = this.ctx();
      if (!this.nb) {
        const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.nb = nb;
      }
      const s = c.createBufferSource();
      s.buffer = this.nb;
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.setValueAtTime(freq, t);
      f.Q.value = q;
      if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
      const g = c.createGain();
      this.env(g, t, 0.003, peak, dur);
      s.connect(f);
      f.connect(g);
      g.connect(this.out());
      s.start(t, Math.random() * 1.5);
      s.stop(t + dur + 0.05);
    },
    tone(t, type, f0, f1, dur, peak) {
      const c = this.ctx(), o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = c.createGain();
      this.env(g, t, 0.004, peak, dur);
      o.connect(g);
      g.connect(this.out());
      o.start(t);
      o.stop(t + dur + 0.05);
    },
    shot() { const c = this.ctx(); if (!c) return; const t = c.currentTime; this.noise(t, 0.09, 'highpass', 1200, 0.3); this.tone(t, 'square', 1300, 240, 0.08, 0.07); },
    boom(k = 1) { const c = this.ctx(); if (!c) return; const t = c.currentTime; this.noise(t, 0.8 * k, 'lowpass', 1300, 0.8, 1, 70); this.tone(t, 'sine', 95, 30, 0.6, 0.8); },
    thud(k = 1) { const c = this.ctx(); if (!c) return; const t = c.currentTime; this.tone(t, 'sine', 150, 48, 0.16, 0.6 * k); this.noise(t, 0.12, 'lowpass', 700, 0.35 * k); },
    shutter() { const c = this.ctx(); if (!c) return; const t = c.currentTime; this.noise(t, 0.05, 'highpass', 2600, 0.5); this.tone(t, 'square', 1800, 700, 0.04, 0.09); this.noise(t + 0.06, 0.09, 'bandpass', 900, 0.32, 1.4); },
    ding(hi) { const c = this.ctx(); if (!c) return; const t = c.currentTime; this.tone(t, 'square', hi ? 990 : 660, null, 0.1, 0.1); if (hi) this.tone(t + 0.08, 'square', 1320, null, 0.14, 0.1); },
    blip(hi) { const c = this.ctx(); if (!c) return; const t = c.currentTime; this.tone(t, 'square', hi ? 1320 : 660, null, hi ? 0.4 : 0.16, 0.12); },
    siren: null,
    sirenLevel(v) {
      const c = this.ctx();
      if (!c) return;
      if (!this.siren) {
        const si = c.createOscillator();
        si.type = 'triangle';
        si.frequency.value = 820;
        const lfo = c.createOscillator();
        lfo.frequency.value = 1.6;
        const lg = c.createGain();
        lg.gain.value = 240;
        lfo.connect(lg);
        lg.connect(si.frequency);
        const g = c.createGain();
        g.gain.value = 0;
        si.connect(g);
        g.connect(this.out());
        si.start();
        lfo.start();
        this.siren = g;
      }
      this.siren.gain.setTargetAtTime(v, c.currentTime, 0.25);
    },
  };

  // ---------------- carros (classe do original) ----------------
  const headMat = new THREE.MeshBasicMaterial({ map: beamTex, color: 0xfff0d6, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false });
  const _W1 = new V3(), _W2 = new V3(), _Qy = new THREE.Quaternion(), _Qt = new THREE.Quaternion(), UPV = new V3(0, 1, 0), _WQ = new THREE.Quaternion(), _WV = new V3();
  const _MB = new THREE.Matrix4();
  class Car {
    constructor(key, len, mat, frontZ, opts = {}) {
      this.g = new THREE.Group();
      this.body = new THREE.Group();
      this.g.add(this.body);
      const m = key === 'truck2' && REAL.truck ? realModel(REAL.truck) : makeModel(key, len, mat, frontZ);
      this.model = m.wrap;
      this.body.add(m.wrap);
      this.len = len;
      this.wid = m.w;
      this.hgt = m.h;
      this.mat = mat;
      this.wheelNodes = m.wheels || [];
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(m.w * 1.35, len * 1.15).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, color: 0x000000, opacity: 0.75 }));
      sh.position.y = 0.04;
      this.g.add(sh);
      this.shadow = sh;
      if (opts.head !== false) {
        const h = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), headMat);
        h.scale.set(7, 1, 14);
        h.position.set(0, 0.06, len / 2 + 6.6);
        h.rotation.y = Math.PI;
        this.body.add(h);
        this.head = h;
      }
      this.g.visible = false;
      scene.add(this.g);
      Object.assign(this, { s: 0, x: 0, v: 0, vx: 0, yaw: 0, roll: 0, pitch: 0, lift: 0, skid: 0, active: true });
    }
    place() {
      frame(this.s);
      _MB.makeBasis(FL, FU, FF);
      this.g.quaternion.setFromRotationMatrix(_MB);
      this.g.position.copy(FP).addScaledVector(FR, this.x);
      this.g.position.y += this.lift;
      this.body.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
      this.settle();
      this.g.updateMatrixWorld(true);
    }
    settle(y0 = 0.02) {
      this.body.position.y = y0 + this.wid * 0.5 * Math.abs(Math.sin(this.roll || 0)) + this.len * 0.5 * Math.abs(Math.sin(this.pitch || 0));
    }
    local(x, y, z, out) {
      return out.set(x, y, z).applyMatrix4(this.body.matrixWorld);
    }
    spin(dt, v) {
      if (!this.wheelNodes.length) return;
      const cap = Math.min(26, (0.42 * ((Math.PI * 2) / 10)) / Math.max(1 / 120, dt));
      const om = Math.min(v / (this.wheelNodes[0].r || 0.4), cap);
      for (const w of this.wheelNodes) {
        w.ang += w.sign * om * dt;
        if (w.ang > 1e4 || w.ang < -1e4) w.ang %= Math.PI * 2;
        w.node.quaternion.copy(w.q0).multiply(_WQ.setFromAxisAngle(w.ax3, w.ang));
        if (w.cS) w.node.position.copy(w.base).add(w.cS).sub(_WV.copy(w.cS).applyQuaternion(_WQ));
      }
    }
    wheels(fn) {
      const hw = this.wid * 0.36, rz = -this.len * 0.33;
      fn(this.local(hw, 0.25, rz, _W1));
      fn(this.local(-hw, 0.25, rz, _W1));
    }
  }
  function driftFX(c, dt, rate, base) {
    c.wheels((p) => {
      rate *= QF();
      const n = Math.random() < rate * dt ? 1 : 0;
      for (let i = 0; i < n + (Math.random() < rate * dt * 0.5 ? 1 : 0); i++) {
        const col = smokeCol(p, base);
        smoke.emit(p, rand(-0.8, 0.8), rand(0.5, 1.2), rand(-0.8, 0.8), rand(0.45, 0.7), rand(0.18, 0.3), rand(0.55, 0.95), col);
      }
    });
    c.skid += c.v * dt;
    if (c.skid > 0.55) {
      c.skid = 0;
      _Qy.copy(c.g.quaternion).multiply(_Qt.setFromAxisAngle(UPV, c.yaw * 0.8));
      c.wheels((p) => {
        _W2.copy(p);
        _W2.y = c.g.position.y - c.lift + 0.035;
        skidAt(_W2, _Qy);
      });
    }
  }
  function prepAlpha(root) {
    root.traverse((m) => {
      if (!m.isMesh && !m.isSprite) return;
      const M = m.material;
      if (!M || M.userData.op0 != null) return;
      M.userData.op0 = M.opacity;
      if (M.blending === THREE.NormalBlending && !M.transparent) {
        M.transparent = true;
        M.depthWrite = true;
      }
    });
  }
  function setCarAlpha(c, a) {
    c.g.traverse((m) => {
      const M = m.material;
      if (M && M.userData.op0 != null) M.opacity = M.userData.op0 * a;
    });
  }

  // ---------------- atores ----------------
  const CARS3 = {};
  for (const k of K.CAR_ORDER) {
    const c = K.CARS[k];
    if (!MODELS[c.model]) continue;
    CARS3[k] = new Car(c.model, c.len, makePaintMat(MODELS[c.model]), c.frontZ);
    CARS3[k].key = k;
  }
  if (MODELS.car1) {
    CARS3.extra = new Car('car1', K.CARS.role.len, makePaintMat(MODELS.car1), true);
    CARS3.extra.key = 'extra';
  }
  // caminhão: o Scania com carreta de verdade quando carregou, senão o de desenho
  const TRUCK = REAL.truck || MODELS.truck2 ? new Car('truck2', TRUCK_LEN, MODELS.truck2 ? makeMat(MODELS.truck2) : null, true, { head: false }) : null;
  if (TRUCK)
    for (const sd of [-1, 1]) {
      const t = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff2020, blending: THREE.AdditiveBlending, depthWrite: false }));
      t.scale.set(2.2, 2.2, 1);
      t.position.set(sd * TRUCK.wid * 0.4, 1.3, -TRUCK.len / 2 - 0.2);
      TRUCK.body.add(t);
    }
  const COPS = [];
  if (MODELS.police)
    for (let i = 0; i < 6; i++) {
      const c = new Car('police', CAR_LEN, makeMat(MODELS.police), true);
      c.sir = [0xff2020, 0x2f6bff].map((col, k) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, blending: THREE.AdditiveBlending, depthWrite: false }));
        s.scale.set(2, 2, 1);
        s.position.set(k ? -0.45 : 0.45, c.hgt + 0.05, -0.1);
        c.body.add(s);
        return s;
      });
      c.g.visible = false;
      c.active = false;
      c.id = 'cop' + i;
      COPS.push(c);
    }
  const DRIVERS = {};
  for (const pl of K.PILOTS) {
    const g = makeCharacter(pl.model, 1.64);
    if (g) {
      g.visible = false;
      DRIVERS[pl.id] = g;
    }
  }
  for (const k in CARS3) prepAlpha(CARS3[k].g);
  for (const k in DRIVERS) prepAlpha(DRIVERS[k]);
  // marcador do carro do jogador (leitura em < 1 s)
  const mt = canvasTex(128, 128, (g) => {
    g.strokeStyle = '#F20D24';
    g.lineWidth = 9;
    g.beginPath();
    g.arc(64, 64, 52, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#F20D24';
    g.beginPath();
    g.moveTo(64, 2);
    g.lineTo(80, 26);
    g.lineTo(48, 26);
    g.closePath();
    g.fill();
  });
  const MARKER = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: mt, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  MARKER.scale.set(5.6, 1, 5.6);
  MARKER.position.y = 0.06;
  MARKER.visible = false;
  // traçante: núcleo quase branco + halo laranja + ponta brilhante
  const BULLETS = [], FLASHES = [], LASERS = [], KITS = [];
  {
    const tc = new THREE.BoxGeometry(0.07, 0.07, 5.2), tg = new THREE.BoxGeometry(0.34, 0.34, 5.8);
    const mC = new THREE.MeshBasicMaterial({ color: 0xfff7d6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const mG = new THREE.MeshBasicMaterial({ color: 0xff8a1a, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 30; i++) {
      const m = new THREE.Group();
      m.add(new THREE.Mesh(tc, mC), new THREE.Mesh(tg, mG));
      const hd = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd27a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      hd.scale.set(1.6, 1.6, 1);
      hd.position.z = 2.6;
      m.add(hd);
      m.visible = false;
      scene.add(m);
      BULLETS.push({ m, on: false });
    }
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc050, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      f.visible = false;
      scene.add(f);
      FLASHES.push({ s: f, t: 0 });
    }
    const lm = new THREE.MeshBasicMaterial({ color: 0xff1e1e, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lm.clone());
      m.visible = false;
      scene.add(m);
      LASERS.push(m);
    }
    const kg = new THREE.OctahedronGeometry(0.8, 0), km = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.1, emissive: 0xf3f0e8, emissiveIntensity: 0.6 });
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group(), core = new THREE.Mesh(kg, km);
      g.add(core);
      const x1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.26), new THREE.MeshBasicMaterial({ color: 0xf20d24 }));
      x1.position.y = 1.9;
      const x2 = x1.clone();
      x2.scale.set(0.28, 3.6, 1);
      g.add(x1, x2);
      g.visible = false;
      scene.add(g);
      KITS.push({ g, core, on: false, s: 0, x: 0 });
    }
  }

  // ---------------- estado ----------------
  const G = { state: 'idle', t: 0, simT: 0, slowT: 0, slowK: 0.35, shake: 0, fovKick: 0, ch: 0, chapter: null, runT: 0, left: 0, gauge: 0, runId: '', spawnCD: 0, queue: [], blockCD: 0, fin: null, result: null, speedMul: 1, hints: {}, tutStep: 0, kitAt: 0, dmg: {}, grazeT: 0, grazeMsg: 0, cueT: 0, cueDir: 0, introT: 0, countStep: -1 };
  let SCORER = null, CARP = null, PM = {}, ALLIES = [];
  const MSG = K.MessageQueue();
  const save = host.save; // SaveStore do BSBASS THE GAME
  const PLAYER = {
    s: 0, x: 0, v: 0, progress: 0, life: 100, maxLife: 100, dead: false, deadT: 0, vy: 0, dspin: 0, lift: 0, roll: 0, pitch: 0,
    contactCD: 0, invulnT: 0, lastHitT: -9, stuckT: 0, slipDeg: 0, drift: false, wasDrift: false, driftT: 0, wallT: -9, near: null,
    wid: 2, len: 4.8, hgt: 1.4, g: new THREE.Object3D(),
    local(x, y, z, out) {
      return out.set(x, y, z).applyMatrix4(host.playerBody().matrixWorld);
    },
  };
  const hurtState = { a: 0 };

  function message(type, text, prio, dur) {
    MSG.push(type, text, prio, dur);
  }
  function hint(key, text, dur = 4) {
    if (G.hints[key]) return;
    G.hints[key] = 1;
    H.hint(text, dur);
  }

  function equip() {
    const key = host.carKey();
    CARP = K.pilotCar(K.CARS[key] ? key : 'role', save.data.pilot);
    if (!K.CARS[key]) CARP = Object.assign({}, CARP, host.playerStats());
    PM = K.pilotById(save.data.pilot).mods;
    ALLIES = K.CAR_ORDER.filter((k) => k !== key && CARS3[k]).map((k) => CARS3[k]);
    if (CARS3.extra) ALLIES.push(CARS3.extra);
    ALLIES = ALLIES.slice(0, 3);
    const pp = K.CARS[key] ? save.data.paints[key] : 'blue';
    const bonde = ['gold', 'blue', 'white', 'black'].filter((x) => x !== pp);
    ALLIES.forEach((a, i) => {
      const p = K.PAINTS.find((q) => q.id === bonde[i % bonde.length]);
      setPaint(a.mat, p ? p.color : null);
      a.laneX = ([-4.4, 4.4, 0][i] || 0) * LX;
      a.off = [-4, -6, -12][i] || -8;
    });
    const d = host.playerDims();
    PLAYER.wid = d.wid;
    PLAYER.len = d.len;
    PLAYER.hgt = d.hgt;
  }
  // bonde leva os outros três pilotos, cada um no banco do motorista
  function assignDrivers() {
    const sel = save.data.pilot, rest = K.PILOTS.map((p) => p.id).filter((id) => id !== sel);
    for (const id in DRIVERS) {
      const d = DRIVERS[id];
      if (d.parent) d.parent.remove(d);
      d.visible = false;
    }
    ALLIES.forEach((c, i) => {
      c.pilot = rest[i % rest.length];
      const d = DRIVERS[c.pilot];
      if (!d) return;
      c.body.add(d);
      d.position.set(c.wid * 0.2, c.hgt - 0.16 - 1.64, -c.len * 0.04);
      d.rotation.set(0, 0, 0);
      d.visible = true;
    });
  }

  // ---------------- jogador (carro do mundo aberto projetado na pista) ----------------
  function projectPlayer() {
    const c = host.car;
    let s = PLAYER.s;
    for (let i = 0; i < 3; i++) {
      frame(s);
      s += (c.x - FP.x) * FF.x + (c.z - FP.z) * FF.z;
    }
    frame(s);
    PLAYER.s = s;
    PLAYER.x = (c.x - FP.x) * FR.x + (c.z - FP.z) * FR.z;
  }
  /** coloca o carro do jogo na pista (largada, reposição, cinemática) */
  function posePlayer(s, x, yaw, speed) {
    frame(s);
    const h = Math.atan2(FF.x, FF.z) + yaw;
    const c = host.car;
    c.x = FP.x + FR.x * x;
    c.z = FP.z + FR.z * x;
    c.heading = h;
    c.vx = Math.sin(h) * speed;
    c.vz = Math.cos(h) * speed;
    c.yawRate = 0;
    c.steerAngle = 0;
    c.speed = Math.abs(speed);
    c.vLong = speed;
    c.vLat = 0;
    c.slipAngle = 0;
    PLAYER.s = s;
    PLAYER.x = x;
    PLAYER.v = speed;
  }
  function spawnPlayer(s, x, speed) {
    posePlayer(s, x, 0, speed);
    host.car.wheelRot = host.car.wheelRot || 0;
    Object.assign(PLAYER, { maxLife: CARP.hp, life: CARP.hp, contactCD: 0, invulnT: 0, lastHitT: -9, stuckT: 0, dead: false, deadT: 0, vy: 0, dspin: 0, lift: 0, roll: 0, pitch: 0, slipDeg: 0, wasDrift: false, drift: false, progress: 0, driftT: 0, v: speed });
  }
  function hurt(d, src) {
    const p = PLAYER;
    if (p.dead || G.state !== 'play') return;
    if (src === 'bullet' && p.invulnT > 0) return;
    d *= (G.chapter.dmgMul || 1) * (PM.damage || 1);
    G.dmg[src] = (G.dmg[src] || 0) + d;
    p.life -= d;
    p.invulnT = 0.3;
    p.lastHitT = G.simT;
    if (!host.reduceFx()) {
      hurtState.a = Math.min(0.7, hurtState.a + 0.4);
      G.shake = Math.max(G.shake, 0.4);
    }
    if (p.life <= 0) playerDie();
  }
  function playerDie() {
    const p = PLAYER;
    p.dead = true;
    p.deadT = 0;
    p.vy = 9;
    p.dspin = rand(4, 6) * pick([-1, 1]);
    explode(host.playerRoot().position.clone().setY(1), 1.3);
    AU.boom(1.3);
    G.slowT = 1;
    G.shake = 1.2;
    message('dead', 'Perdeu o carro', 4, 1.6);
  }
  /** batida no mundo (casa, barreira, poste): chamada pela colisão do jogo */
  function contact(impact, src) {
    const p = PLAYER;
    if (G.state !== 'play') return;
    p.wallT = G.simT;
    if (p.contactCD > 0) return;
    const r = SCORER.hit(impact);
    if (impact >= CFG.damage.wallMin) {
      hurt(2 + (impact - CFG.damage.wallMin) * CFG.damage.wallPerMS, src);
      p.contactCD = CFG.damage.contactCooldown;
      AU.thud(clamp(impact / 12, 0.4, 1));
    } else if (r === 'light') p.contactCD = 0.25;
  }
  function stepPlayer(dt) {
    const p = PLAYER, c = host.car;
    p.contactCD -= dt;
    p.invulnT -= dt;
    if (p.dead) {
      p.deadT += dt;
      p.lift += p.vy * dt;
      p.vy -= 24 * dt;
      if (p.lift < 0) {
        p.lift = 0;
        p.vy = Math.abs(p.vy) * 0.25;
      }
      p.roll += p.dspin * dt;
      p.dspin *= Math.exp(-1.2 * dt);
      c.vx *= Math.exp(-1.5 * dt);
      c.vz *= Math.exp(-1.5 * dt);
      projectPlayer();
      if (p.deadT > 1.1 && G.state === 'play') startCinematic('dead');
      return;
    }
    const sPrev = p.s;
    projectPlayer();
    p.progress = (p.s - sPrev) / dt;
    p.v = Math.max(0, c.vLong);
    const inp = host.input();
    // travado (ou fora da rota) → reposiciona sem premiar
    const lost = Math.abs(p.x) > ROAD_HALF + 14;
    if ((p.progress < CFG.damage.stuckSpeed && inp.throttle > 0) || lost) p.stuckT += dt;
    else p.stuckT = 0;
    if (p.stuckT > CFG.damage.stuckTime) {
      SCORER.hit(99);
      message('reset', lost ? 'De volta à rota' : 'Reposicionado', 2, 0.9);
      const keep = p.life;
      spawnPlayer(p.s, 0, 14);
      p.life = keep;
      return;
    }
    p.slipDeg = K.slipDeg({ vx: c.vx, vz: c.vz, h: c.heading });
    const speed = Math.hypot(c.vx, c.vz);
    const wasDrift = p.drift, cueOpen = G.cueT && G.simT - G.cueT < 0.4;
    p.drift = (inp.handbrake && speed > 8) || (p.slipDeg >= 14 && speed > CFG.control.driftMinSpeed * 0.8);
    if (p.drift) p.driftT += dt;
    if (!wasDrift && p.drift && cueOpen) {
      message('tim', 'Na hora!', 2, 1.1);
      SCORER.nearMiss('curva' + ((wrapS(p.s) / 40) | 0));
      G.fovKick = 0.6;
    }
    if (wasDrift && !p.drift) p.driftT = 0;
    // drift colado no muro: câmera fecha e o tempo abre um pouco
    {
      const edge = ROAD_HALF + 3.4 - Math.abs(p.x);
      const wallContact = G.simT - p.wallT < 0.12;
      if (p.drift && p.slipDeg > 16 && edge < 2.4 && edge > 0 && speed > 24 && !wallContact) {
        G.grazeT = Math.min(0.9, (G.grazeT || 0) + dt * 2.2);
        if (!G.grazeMsg || G.simT - G.grazeMsg > 2.4) {
          G.grazeMsg = G.simT;
          message('graze', 'Raspando o muro!', 2, 0.9);
          SCORER.nearMiss('muro' + ((wrapS(p.s) / 40) | 0));
          if (!host.reduceFx()) {
            G.slowT = Math.max(G.slowT, 0.5);
            G.slowK = 0.72;
            G.fovKick = 1;
          }
        }
        if (Math.random() < 0.5 * QF()) sparkBurst(p.local(-sign(p.x) * p.wid * 0.5, 0.35, rand(-1, 1), _W2), 3);
      } else G.grazeT = Math.max(0, (G.grazeT || 0) - dt * 1.6);
      H.graze(G.grazeT > 0.15 && !host.reduceFx());
    }
    const cid = TR.curveId[wrapS(p.s) | 0];
    let zone = cid < 0 ? 0.5 : TR.zone[wrapS(p.s) | 0];
    for (const a of ALLIES)
      if (Math.abs(a.s - p.s) < 9 && Math.abs(a.x - p.x) < 6) {
        zone *= 1.15;
        break;
      }
    const colliding = p.contactCD > 0 && G.simT - p.wallT < 0.12;
    SCORER.update({ dt, speed, slip: p.slipDeg, grounded: true, progress: p.progress, colliding, curveId: cid, dir: p.drift ? sign(c.yawRate) : 0, lap: Math.floor((p.s - START_S) / TR.n), zone });
    // viaturas
    for (const cp of COPS) {
      if (!cp.active || cp.state === 'dying' || cp.hitCD > 0) continue;
      const ds = cp.s - p.s, dx = cp.x - p.x;
      if (Math.abs(ds) < (p.len + cp.len) * 0.46 && Math.abs(dx) < (p.wid + cp.wid) * 0.47) {
        cp.hitCD = 1;
        const sd = sign(dx || rand(-1, 1));
        const mid = host.playerRoot().position.clone().lerp(cp.g.position, 0.5);
        mid.y += 0.8;
        frame(p.s);
        if (p.v - (cp.v || 0) > 10) {
          hitCop(cp, 2, 'player');
          cp.vx = sd * 14;
          cp.knock = 0.6;
          sparkBurst(mid, 18);
          AU.thud();
          if (!host.reduceFx()) {
            G.slowT = Math.max(G.slowT, 0.14);
            G.slowK = 0.2;
            G.fovKick = 1;
          }
          G.shake = Math.max(G.shake, 0.6);
        } else {
          hurt(CFG.damage.copBump * (1 + Math.max(0, p.v - 35) / 25), 'cop');
          c.vx -= FR.x * sd * 6;
          c.vz -= FR.z * sd * 6;
          cp.vx = sd * 8;
          cp.knock = 0.3;
          sparkBurst(mid, 10);
          AU.thud(0.7);
          SCORER.hit(10);
        }
        cp.near = null;
      }
    }
    if (TRUCK && TRUCK.g.visible) {
      const ds = TRUCK.s - p.s, dx = TRUCK.x - p.x, ov = (TRUCK.len + p.len) / 2 - Math.abs(ds);
      if (ov > 0 && Math.abs(dx) < (TRUCK.wid + p.wid) / 2 - 0.1) {
        frame(p.s);
        const sd = ds > 0 ? -1 : 1;
        c.x += FF.x * ov * sd;
        c.z += FF.z * ov * sd;
        p.s += ov * sd;
        const vr = c.vx * FF.x + c.vz * FF.z - TRUCK.v;
        if (vr > 0 && ds > 0) {
          c.vx -= FF.x * vr * 1.3;
          c.vz -= FF.z * vr * 1.3;
          contact(vr, 'truck');
        }
      }
    }
    nearMisses();
    // kits de vida
    for (const Kt of KITS) {
      if (!Kt.on) continue;
      if (Kt.s < p.s - 20) {
        Kt.on = false;
        Kt.g.visible = false;
        continue;
      }
      wpos(Kt.s, Kt.x, 1 + Math.sin(G.simT * 3) * 0.25, Kt.g.position);
      Kt.core.rotation.y += dt * 2;
      if (Math.abs(Kt.s - p.s) < 2.8 && Math.abs(Kt.x - p.x) < 2) {
        Kt.on = false;
        Kt.g.visible = false;
        p.life = Math.min(p.maxLife, p.life + p.maxLife * 0.18);
        AU.ding(true);
        message('kit', '+vida', 1, 0.8);
      }
    }
    if (p.s > G.kitAt) {
      G.kitAt = p.s + rand(320, 440);
      const Kt = KITS.find((k) => !k.on);
      if (Kt) {
        Kt.on = true;
        Kt.g.visible = true;
        Kt.s = p.s + 140;
        Kt.x = pick(LANES);
      }
    }
  }
  function nearMisses() {
    const p = PLAYER, sp = Math.hypot(host.car.vx, host.car.vz);
    if (sp < 15) return;
    const check = (o, id, len, wid) => {
      const ds = o.s - p.s, gap = Math.abs(o.x - p.x) - (wid + p.wid) / 2;
      if (Math.abs(ds) < (len + p.len) / 2) {
        if (gap > 0.15 && gap < 1.4) o.near = o.near || 'close';
      } else if (o.near === 'close' && ds < 0) {
        o.near = null;
        SCORER.nearMiss(id);
      } else if (ds < -(len + p.len)) o.near = null;
    };
    for (const c of COPS) if (c.active && c.state !== 'dying') check(c, c.id, c.len, c.wid);
    if (TRUCK && TRUCK.g.visible) check(TRUCK, 'truck', TRUCK.len, TRUCK.wid);
  }

  // ---------------- polícia ----------------
  function spawnCop(type, mode) {
    const c = COPS.find((c) => !c.active);
    if (!c) return null;
    const p = PLAYER;
    c.type = type;
    c.active = true;
    c.state = mode || 'chase';
    c.g.visible = true;
    c.hp = type === 'swat' ? 5 : 2;
    const ahead = mode !== 'block' && (type === 'inter' || Math.random() < 0.15);
    c.s = mode === 'block' ? p.s + 150 : ahead ? p.s + rand(55, 70) : p.s - rand(38, 46);
    c.x = pick(LANES);
    c.v = mode === 'block' ? 0 : p.v + (ahead ? -6 : 10);
    c.vx = 0;
    c.slot = type === 'inter' ? rand(13, 19) : pick([-9, -6, 5, 8]);
    c.side = pick([-1, 1]);
    c.fireCD = rand(2, 3);
    c.aim = null;
    c.hitCD = 0;
    c.flash = 0;
    c.lift = 0;
    c.yaw = 0;
    c.roll = 0;
    c.pitch = 0;
    c.knock = 0;
    c.slotT = rand(3, 6);
    c.near = null;
    c.model.scale.setScalar(type === 'swat' ? 1.18 : 1);
    c.mat.color.set(type === 'swat' ? 0x6b7080 : 0xffffff);
    c.mat.emissiveIntensity = 0.14;
    c.place();
    return c;
  }
  function hitCop(c, dmg, src) {
    if (c.state === 'dying') return;
    c.hp -= dmg;
    c.flash = 1;
    if (src === 'ally' && c.hp < 1) c.hp = 1;
    if (c.hp <= 0) killCop(c, src);
  }
  function killCop(c, src) {
    c.state = 'dying';
    c.dieT = 0;
    c.vy = 10;
    c.spinV = rand(4, 7) * pick([-1, 1]);
    c.aim = null;
    explode(c.g.position.clone().setY(c.g.position.y + 1), c.type === 'swat' ? 1.2 : 0.9);
    AU.boom(1);
    if (!host.reduceFx()) G.shake = Math.max(G.shake, 0.8);
    if (src === 'player') {
      const b = SCORER.copKill();
      G.slowT = 0.22;
      message('cop', b > 0 ? 'Viatura fora! +' + b : 'Viatura fora!', 2, 1);
    }
  }
  function fireCop(c) {
    const p = PLAYER, shots = c.type === 'inter' ? [-3, 0, 3] : c.type === 'swat' ? [-1.2, 1.2] : [0];
    for (const off of shots) {
      const b = BULLETS.find((b) => !b.on);
      if (!b) break;
      const tx = clamp(c.aim.x + off * LX, -ROAD_HALF + 0.5, ROAD_HALF - 0.5), ts = p.s + p.v * 0.34, T = 0.36;
      Object.assign(b, { on: true, s: c.s + sign(ts - c.s) * 2.4, x: c.x, y: 1.1, vs: (ts - c.s) / T, vx: (tx - c.x) / T, life: 1.2, hit: false, dmg: CFG.damage.bullet });
      b.m.visible = true;
    }
    {
      const f = FLASHES.find((f) => f.t <= 0);
      if (f) {
        c.local(0, c.hgt * 0.7, c.len * 0.1, f.s.position);
        f.t = 0.09;
        f.s.visible = true;
        f.s.scale.setScalar(rand(2.6, 3.6));
      }
    }
    AU.shot();
  }
  function stepCops(dt) {
    const p = PLAYER;
    for (const c of COPS) {
      if (!c.active) continue;
      if (c.state === 'dying') {
        c.dieT += dt;
        c.lift += c.vy * dt;
        c.vy -= 24 * dt;
        if (c.lift < 0) {
          c.lift = 0;
          c.vy = Math.abs(c.vy) * 0.3;
        }
        c.roll += c.spinV * dt;
        c.pitch += c.spinV * 0.4 * dt;
        c.s += c.v * dt;
        c.v = damp(c.v, p.v * 0.4, 1.5, dt);
        if (Math.random() < dt * 14 * QF()) {
          const q = c.g.position.clone();
          q.y += 1;
          const k = rand(0.08, 0.18);
          _C.setRGB(k, k, k);
          smoke.emit(q, rand(-1, 1), rand(2, 4), rand(-1, 1), 0.9, 0.6, 1.5, _C);
        }
        if (c.dieT > 1.5) {
          c.active = false;
          c.g.visible = false;
        }
        c.place();
        continue;
      }
      c.hitCD -= dt;
      c.flash = Math.max(0, c.flash - dt * 4);
      c.mat.emissiveIntensity = 0.14 + c.flash * 1.2;
      const ph = (G.simT * 6 + c.s * 0.01) % 2 < 1;
      c.sir[0].material.opacity = ph ? 1 : 0.15;
      c.sir[1].material.opacity = ph ? 0.15 : 1;
      if (c.state === 'block') {
        c.v = 0;
        c.yaw = (Math.PI / 2) * c.side;
        if (p.s - c.s > 35) {
          c.state = 'chase';
          c.v = p.v - 4;
          c.yaw = 0;
        }
        c.place();
        continue;
      }
      c.slotT -= dt;
      if (c.slotT <= 0) {
        c.slotT = rand(3, 6);
        if (c.type !== 'inter') c.slot = pick([-9, -6, 5, 8]);
        c.side = pick([-1, 1]);
      }
      const ds = c.s - p.s;
      if (ds < -95) c.s = p.s - 45;
      if (ds > 130) c.s = p.s + 60;
      c.v = damp(c.v, p.v + clamp((p.s + c.slot - c.s) * 0.9, -12, 14), 2, dt);
      // justiça: não bate por trás sem o jogador ver, e não fecha a lateral colada
      if (ds < 0 && ds > -9 && Math.abs(c.x - p.x) < 2.8) c.v = Math.min(c.v, p.v - 2);
      c.s += c.v * dt;
      const side = 5.6 * LX, lane = ROAD_HALF - 2.2;
      let tx = c.type === 'inter' ? p.x : clamp(p.x + c.side * side, -lane, lane);
      if (Math.abs(p.x + c.side * side) > lane + 0.2 && c.type !== 'inter') tx = p.x - c.side * side;
      if (Math.abs(c.s - p.s) < (c.len + p.len) * 0.55 && c.knock <= 0) {
        const gap = c.x - p.x;
        if (Math.abs(gap) < 3.3) tx = p.x + sign(gap || c.side) * 3.4;
      }
      c.vx = damp(c.vx, (tx - c.x) * 1.2, c.knock > 0 ? 0.4 : 2.6, dt);
      c.knock -= dt;
      c.x += c.vx * dt;
      const lim = ROAD_HALF - c.wid * 0.55;
      if (Math.abs(c.x) > lim) {
        const into = c.vx * sign(c.x);
        c.x = sign(c.x) * lim;
        if (into > 8 && c.knock > 0) {
          hitCop(c, 1, 'wall');
          sparkBurst(c.g.position.clone().setY(0.6), 12);
        }
        c.vx = -c.vx * 0.3;
      }
      c.yaw = damp(c.yaw, -c.vx * 0.03, 6, dt);
      // mira telegrafada 0,8 s → tiro
      if (G.state === 'play' && Math.abs(ds) < 36 && !p.dead) {
        if (c.aim) {
          c.aim.t -= dt;
          if (c.aim.t <= 0) {
            fireCop(c);
            c.aim = null;
            c.fireCD = rand(3.2, 4.6);
          }
        } else {
          c.fireCD -= dt;
          if (c.fireCD <= 0) c.aim = { x: p.x, t: 0.8 };
        }
      } else c.aim = null;
      c.place();
    }
  }
  function drawLasers() {
    const p = PLAYER;
    let li = 0;
    for (const c of COPS) {
      if (!c.active || !c.aim) continue;
      const offs = c.type === 'inter' ? [-3, 0, 3] : c.type === 'swat' ? [-1.2, 1.2] : [0];
      for (const off of offs) {
        if (li >= LASERS.length) break;
        const L = LASERS[li++];
        const a = wpos(c.s, c.x, 1.2, _W1), b = wpos(p.s + p.v * 0.2, clamp(c.aim.x + off * LX, -7.5 * LX, 7.5 * LX), 0.9, _W2);
        L.visible = true;
        L.position.copy(a).add(b).multiplyScalar(0.5);
        L.lookAt(b);
        L.scale.set(0.13, 0.13, a.distanceTo(b));
        L.material.opacity = c.aim.t < 0.25 ? (Math.sin(G.t * 50) > 0 ? 0.95 : 0.3) : 0.5;
      }
    }
    for (; li < LASERS.length; li++) LASERS[li].visible = false;
  }
  function stepBullets(dt) {
    for (const f of FLASHES)
      if (f.t > 0) {
        f.t -= dt;
        f.s.material.opacity = Math.max(0, f.t / 0.09);
        if (f.t <= 0) f.s.visible = false;
      }
    const p = PLAYER;
    for (const b of BULLETS) {
      if (!b.on) continue;
      b.life -= dt;
      b.s += b.vs * dt;
      b.x += b.vx * dt;
      if (b.life <= 0 || Math.abs(b.x) > ROAD_HALF + 1) {
        b.on = false;
        b.m.visible = false;
        continue;
      }
      wpos(b.s, b.x, b.y, b.m.position);
      wpos(b.s + b.vs * 0.02, b.x + b.vx * 0.02, b.y, _W1);
      b.m.lookAt(_W1);
      if (!b.hit && !p.dead && Math.abs(b.s - p.s) < p.len * 0.5 && Math.abs(b.x - p.x) < p.wid * 0.55) {
        b.hit = true;
        b.on = false;
        b.m.visible = false;
        if (p.drift && p.slipDeg >= 18) message('graze', 'Raspou!', 1, 0.8);
        else {
          hurt(b.dmg, 'bullet');
          sparkBurst(host.playerRoot().position.clone().setY(0.8), 8);
        }
      }
    }
  }

  // ---------------- bonde / caminhão ----------------
  function placeAI(a) {
    const c = a.ph;
    a.roll = damp(a.roll || 0, clamp(c.omega * 0.05, -0.07, 0.07), 6, 1 / 60);
    a.g.position.set(c.px, 0, c.pz);
    a.g.rotation.set(0, c.h, 0);
    a.body.rotation.set(0, 0, a.roll, 'YXZ');
    a.pitch = 0;
    a.settle();
    a.g.updateMatrixWorld(true);
  }
  function projectAI(a) {
    let s = a.s;
    for (let i = 0; i < 3; i++) {
      frame(s);
      s += (a.ph.px - FP.x) * FF.x + (a.ph.pz - FP.z) * FF.z;
    }
    frame(s);
    a.s = s;
    a.x = (a.ph.px - FP.x) * FR.x + (a.ph.pz - FP.z) * FR.z;
  }
  function spawnAI(a, s, x, v) {
    frame(s);
    a.s = s;
    a.x = x;
    a.ph = K.newCarState(FP.x + FR.x * x, FP.z + FR.z * x, Math.atan2(FF.x, FF.z), v || 0);
    a.P = K.pilotCar(K.CARS[a.key] ? a.key : 'role', a.pilot || 'duckjay');
    a.skill = AI_SKILL[a.pilot] || AI_SKILL.duckjay;
    a.v = v || 0;
    a.slipDeg = 0;
    a.stuck = 0;
    placeAI(a);
  }
  function aiWalls(a) {
    const c = a.ph, lim = ROAD_HALF - a.wid * 0.5;
    a.wallContact = false;
    if (Math.abs(a.x) <= lim) return;
    const sd = sign(a.x), pen = Math.abs(a.x) - lim;
    frame(a.s);
    const nx = FR.x * sd, nz = FR.z * sd;
    c.px -= nx * pen;
    c.pz -= nz * pen;
    a.x = sd * lim;
    a.wallContact = true;
    const vn = c.vx * nx + c.vz * nz;
    if (vn > 0) {
      c.vx -= nx * vn * 1.2;
      c.vz -= nz * vn * 1.2;
      const k = 1 - clamp(vn * 0.03, 0, 0.3);
      c.vx *= k;
      c.vz *= k;
      c.h += K.wrapAng(Math.atan2(FF.x, FF.z) - c.h) * 0.22;
      c.omega *= 0.5;
      if (vn > 5 && Math.random() < 0.4) sparkBurst(a.local(-sd * a.wid * 0.5, 0.5, 0, _W2), 6);
    }
  }
  function aiInput(a) {
    const p = PLAYER, cs = a.ph, sk = a.skill;
    let xt = a.target ? a.target.x : a.laneX + Math.sin(G.simT * 0.35 + a.off) * 1.2 * LX;
    const obs = [p, ...ALLIES.filter((o) => !o.scripted), ...COPS.filter((c) => c.active && c.state !== 'dying' && c !== a.target)];
    if (TRUCK && TRUCK.g.visible) obs.push(TRUCK);
    let brake = false;
    for (const o of obs) {
      if (o === a) continue;
      const ds = o.s - a.s, need = ((o.wid || 2.2) + a.wid) * 0.55 + 0.5;
      if (ds > 0 && ds < 10 + a.v * 0.35 && Math.abs(o.x - xt) < need) {
        xt = o.x + (xt >= o.x ? need + 0.3 : -need - 0.3);
        if (ds < 6 && Math.abs(o.x - a.x) < need * 0.8 && (o.v || 0) < a.v - 3) brake = true;
      }
    }
    xt = clamp(xt, -(ROAD_HALF - 1.9), ROAD_HALF - 1.9);
    const la = 8 + a.v * 0.3;
    frame(a.s + la);
    const th = Math.atan2(FF.x, FF.z);
    let e = K.wrapAng(th + (a.x - xt) * 0.05 - cs.h), steer = clamp(-e * 3.2, -1, 1), hand = false;
    const k = curv(a.s + 10);
    const outside = (k > 0 && a.x > 3.8 * LX) || (k < 0 && a.x < -3.8 * LX);
    if (!a.target && !outside && Math.abs(k) > sk.driftK && a.v > 14) {
      steer = -Math.sign(k) * sk.angle;
      hand = !cs.drift || a.slipDeg < 16;
      if ((k > 0 && a.x > 2.5 * LX) || (k < 0 && a.x < -2.5 * LX)) steer *= 0.75;
    }
    if (a.wallContact) hand = false;
    if (outside && cs.drift) steer = clamp(steer, -0.28, 0.28);
    const gap = p.s + a.off - a.s;
    let thr = gap > 4 ? 1 : gap < -18 ? 0.35 : 0.85;
    if (a.target) thr = 1;
    let kmax = 0;
    for (let d = 10; d <= 60; d += 6) kmax = Math.max(kmax, Math.abs(curv(a.s + d + a.v * 0.3)));
    const vSafe = kmax > 1e-4 ? Math.sqrt((11 * sk.aggr) / kmax) : 1e9;
    if (a.v > vSafe * 1.1) {
      thr = 0;
      brake = true;
    } else if (a.v > vSafe) thr = Math.min(thr, 0.2);
    return { steer, throttle: thr, brake: brake || gap < -40, handbrake: hand };
  }
  function stepAllies(dt) {
    const p = PLAYER;
    ALLIES.forEach((a, i) => {
      if (!a.ph) spawnAI(a, p.s + (a.off || -6), a.laneX || 0, p.v);
      const cs = a.ph;
      a.cd = (a.cd ?? rand(7, 10)) - dt;
      if (!a.target && a.cd <= 0 && G.state === 'play') {
        const c = COPS.find((c) => c.active && c.state === 'chase' && Math.abs(c.s - a.s) < 30);
        if (c) a.target = c;
        else a.cd = 1.5;
      }
      if (a.target && (!a.target.active || a.target.state !== 'chase')) a.target = null;
      const inp = aiInput(a);
      frame(a.s + 4);
      const th = Math.atan2(FF.x, FF.z);
      cs.speedMul = G.speedMul;
      const gap = p.s + a.off - a.s;
      cs.powerMul = gap > 60 ? 3 : gap > 25 ? 2.2 : gap > 10 ? 1.4 : gap < -20 ? 0.55 : 1;
      K.stepCar(cs, inp, dt, a.P, { h: th, k: curv(a.s + 6), x: a.x });
      const s0 = a.s;
      projectAI(a);
      a.progress = (a.s - s0) / dt;
      a.v = Math.max(0, cs.vf);
      aiWalls(a);
      // bonde fantasma: amigo não colide com amigo; quem se sobrepõe fica translúcido
      {
        let near = false;
        for (const o of [p, ...ALLIES]) {
          if (o === a || (o !== p && !o.ph)) continue;
          if (Math.abs(o.s - a.s) < (a.len + o.len) * 0.55 + 1.5 && Math.abs(o.x - a.x) < (a.wid + o.wid) * 0.5 + 0.8) {
            near = true;
            break;
          }
        }
        a.ghost = damp(a.ghost ?? 1, near ? 0.3 : 1, 9, dt);
        if (Math.abs((a.ghostShown ?? 1) - a.ghost) > 0.02) {
          a.ghostShown = a.ghost;
          setCarAlpha(a, a.ghost);
        }
      }
      // fechar a viatura
      if (a.target) {
        const c = a.target;
        if (Math.abs(c.s - a.s) < 4.4 && Math.abs(c.x - a.x) < 2.3) {
          const sd = sign(c.x - a.x || 1);
          c.vx = sd * 14;
          c.knock = 0.6;
          hitCop(c, 1, 'ally');
          frame(a.s);
          a.ph.vx -= FR.x * sd * 5;
          a.ph.vz -= FR.z * sd * 5;
          a.target = null;
          a.cd = rand(8, 12);
          sparkBurst(a.g.position.clone().lerp(c.g.position, 0.5).setY(0.8), 12);
        }
      }
      a.slipDeg = K.slipDeg(cs);
      placeAI(a);
      a.spin(dt, Math.abs(cs.vf));
      const sm = clamp((a.slipDeg - 10) / 35, 0, 1);
      if (sm > 0) driftFX(a, dt, 22 * sm, 0.88);
      if (cs.boostT > 0 && Math.random() < 0.5 * QF()) {
        const q = a.local(0, 0.5, -a.len / 2, _W1);
        _C.setHSL(rand(0, 0.05), 1, 0.55);
        fire.emit(q, rand(-1, 1), rand(0, 1), rand(-1, 1), 0.16, 0.4, 0.12, _C);
      }
      if (a.progress < 2 && G.runT > 3) a.stuck += dt;
      else a.stuck = 0;
      if (a.stuck > 2.2 || a.s < p.s - 95) spawnAI(a, p.s - 26 - i * 6, a.laneX, Math.max(10, p.v * 0.85));
    });
  }
  function stepTruck(dt) {
    const T = TRUCK, p = PLAYER, m = G.chapter.truck;
    if (!T || !m || !T.g.visible) return;
    if (m.mode === 'intercept') {
      let km = 0;
      for (let d = 0; d <= 70; d += 10) km = Math.max(km, Math.abs(curv(T.s + d)));
      const vC = km > 1e-4 ? Math.sqrt(5.2 / km) : 1e9, gap = T.s - p.s, band = gap > 170 ? 0.7 : gap > 100 ? 0.85 : 1;
      T.v = damp(T.v, Math.min(30, vC) * band, 1.1, dt);
    } else {
      const gap = 70;
      T.v = damp(T.v, p.v + clamp((p.s + gap - T.s) * 0.6, -8, 8), 1.2, dt);
    }
    T.s += T.v * dt;
    T.x = damp(T.x, Math.sin(G.simT * 0.3) * 2 * LX, 1, dt);
    T.place();
    T.spin(dt, T.v);
    truckLight.position.copy(T.local(0, 1.4, -T.len / 2 - 2.5, _W1));
  }

  // ---------------- capítulos / fluxo ----------------
  function resetWorld() {
    for (const c of COPS) {
      c.active = false;
      c.g.visible = false;
    }
    for (const b of BULLETS) {
      b.on = false;
      b.m.visible = false;
    }
    for (const L of LASERS) L.visible = false;
    for (const Kt of KITS) {
      Kt.on = false;
      Kt.g.visible = false;
    }
    smoke.clear();
    fire.clear();
    sparks.clear();
    clearSkids();
  }
  function setLights(on) {
    for (const l of [...sirenLights, truckLight, boomLight]) {
      l.visible = on;
      l.intensity = 0;
    }
  }
  function startChapter(idx, route) {
    TR = route;
    const ch = K.CHAPTERS[idx];
    G.ch = idx;
    G.chapter = ch;
    G.speedMul = ch.speed;
    equip();
    resetWorld();
    setLights(true);
    spawnPlayer(START_S, 0, 0);
    assignDrivers();
    host.playerRoot().add(MARKER);
    MARKER.visible = true;
    ALLIES.forEach((a, i) => {
      a.g.visible = true;
      a.scripted = false;
      Object.assign(a, { yaw: 0, roll: 0, lift: 0, target: null, cd: rand(7, 10), ph: null, ghost: 1, ghostShown: 1 });
      setCarAlpha(a, 1);
      spawnAI(a, START_S + ([-5, -5, -11][i] || -14), ([-4.6, 4.6, 0][i] || 0) * LX, 0);
    });
    for (const k in CARS3) if (!ALLIES.includes(CARS3[k])) CARS3[k].g.visible = false;
    if (TRUCK) {
      TRUCK.g.visible = !!ch.truck;
      truckLight.intensity = ch.truck ? 3.2 * LK : 0;
      if (ch.truck) {
        Object.assign(TRUCK, { s: ch.truck.mode === 'intercept' ? 150 : 85, x: 0, v: 20 });
        TRUCK.place();
      }
    }
    G.queue = ch.cops.queue.slice();
    G.spawnCD = ch.cops.start || 8;
    G.blockCD = ch.blocks ? 18 : 1e9;
    G.left = ch.win.time || 0;
    G.gauge = 0;
    G.result = null;
    G.dmg = {};
    G.runT = 0;
    G.simT = 0;
    G.kitAt = 300;
    G.fin = null;
    G.slowT = 0;
    G.shake = 0;
    G.grazeT = 0;
    SCORER = K.DriftScorer(K.pilotScoring(save.data.pilot));
    G.runId = ch.id + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    MSG.q.current = null;
    G.hints = {};
    G.tutStep = 0;
    H.reset();
    H.finale(null);
    G.state = 'intro';
    G.introT = 0;
    G.countStep = -1;
    H.cine(true);
    H.story(`<b>${idx + 1}. ${ch.title}</b><span>${ch.intro.join(' ')}</span><em>${ch.objective}</em>`);
  }
  function stepIntro(dt) {
    G.introT += dt;
    const T = 4.0, t = G.introT;
    ALLIES.forEach((c, j) => {
      const i = j + 1;
      if (!c.ph) return;
      frame(START_S + SLOT_S(i) - ROLL_V * (T - t));
      const x = SLOT_X(i) * LX;
      c.ph.px = FP.x + FR.x * x;
      c.ph.pz = FP.z + FR.z * x;
      c.ph.h = Math.atan2(FF.x, FF.z);
      c.ph.vx = FF.x * ROLL_V;
      c.ph.vz = FF.z * ROLL_V;
      c.s = START_S + SLOT_S(i) - ROLL_V * (T - t);
      c.x = x;
      c.v = ROLL_V;
      placeAI(c);
      c.spin(dt, ROLL_V);
    });
    posePlayer(START_S - ROLL_V * (T - t), 0, 0, ROLL_V);
    if (t >= 1.6) countdown(t - 1.6);
    if (t >= T && G.state === 'intro') goRace(ROLL_V);
  }
  function countdown(cd) {
    const step = Math.floor(cd / 0.8);
    if (step !== G.countStep && step <= 3) {
      G.countStep = step;
      H.count(step < 3 ? String(3 - step) : 'Vai!');
      AU.blip(step === 3);
    }
  }
  function goRace(v) {
    spawnPlayer(START_S, 0, v);
    ALLIES.forEach((a, i) => spawnAI(a, START_S + SLOT_S(i + 1), SLOT_X(i + 1) * LX, v));
    G.state = 'play';
    H.cine(false);
    H.story(null);
    if (G.chapter.tutorial && !save.data.tutorialDone) hint('t1', host.touch() ? 'Segura GÁS pra acelerar e ◀ ▶ pra virar. DRIFT é o freio de mão' : 'W acelera, A/D vira, S freia. Espaço é o freio de mão', 4.5);
  }
  function stepFlow(dt) {
    const ch = G.chapter, p = PLAYER;
    G.runT += dt;
    if (G.runT > 0.7) H.count(null);
    if (ch.cops.max > 0) {
      G.spawnCD -= dt;
      let active = 0;
      for (const c of COPS) if (c.active && c.state !== 'block') active++;
      const cmax = ch.cops.ramp && G.runT >= ch.cops.ramp.at ? ch.cops.ramp.max : ch.cops.max;
      if (G.spawnCD <= 0 && active < cmax) {
        if (!G.queue.length && (ch.win.type === 'survive' || ch.win.type === 'escape')) G.queue = ch.cops.queue.slice();
        if (G.queue.length && spawnCop(G.queue[0])) {
          G.queue.shift();
          G.spawnCD = rand(3, 5);
          if (!G.hints.cop) hint('cop', 'Linha vermelha é a mira. Em drift o tiro só raspa.', 4);
        }
      }
    }
    if (ch.blocks) {
      G.blockCD -= dt;
      if (G.blockCD <= 0 && COPS.filter((c) => !c.active).length >= 2) {
        G.blockCD = rand(20, 26);
        spawnBlock();
      }
    }
    if (ch.tutorial && !save.data.tutorialDone) {
      const ahead = TR.curveId[wrapS(p.s + 45) | 0];
      if (G.tutStep === 0 && ahead >= 0) {
        G.tutStep = 1;
        hint('t2', host.touch() ? 'Curva! Segura DRIFT e vira pro lado dela' : 'Curva! Segura espaço e vira pro lado dela', 4.5);
      }
      if (G.tutStep === 1 && SCORER.state.driftTime > 1.2) {
        G.tutStep = 2;
        hint('t3', host.touch() ? 'Isso! Solta o DRIFT pra recuperar e acelera fundo na saída' : 'Isso! Solta o espaço pra recuperar e acelera fundo na saída', 4.5);
      }
    }
    if (p.dead) return;
    const w = ch.win;
    if (w.type === 'lap' && p.s >= START_S + TR.n * w.laps) startCinematic('lapwin');
    else if (w.type === 'escape' && p.s >= START_S + TR.n * w.laps) startCinematic('escape');
    else if (w.type === 'survive') {
      G.left -= dt;
      if (G.left <= 0) startCinematic('survive');
    } else if (w.type === 'intercept') {
      G.left -= dt;
      const d = TRUCK.s - TRUCK.len / 2 - p.s;
      if (d > -TRUCK.len - 4 && d < 30 && Math.abs(p.x - TRUCK.x) < 9.5 * LX) {
        G.gauge = Math.min(100, G.gauge + dt * (host.car.nitroActive ? 11 : p.drift ? 8.5 : 6.5));
        if (!G.hints.zone) hint('zone', 'Na zona! Fica colado no caminhão', 3);
      } else G.gauge = Math.max(0, G.gauge - dt * 3);
      if (G.gauge >= 100) startCinematic('intercept');
      else if (G.left <= 0) startCinematic('truckgone');
    }
  }
  function spawnBlock() {
    const p = PLAYER, gapLeft = Math.random() < 0.5;
    const lanes = gapLeft ? [2.6 * LX, 8.2 * LX] : [-8.2 * LX, -2.6 * LX];
    lanes.forEach((x, i) => {
      const c = spawnCop('patrol', 'block');
      if (c) {
        c.s = p.s + 150 + i * 1.5;
        c.x = x;
        c.side = i ? 1 : -1;
        c.place();
      }
    });
    message('block', 'Bloqueio! Passa pela ' + (gapLeft ? 'esquerda' : 'direita'), 4, 2.2);
    AU.blip(true);
  }

  // ---------------- cinemáticas ----------------
  function hermite(p0, m0, p1, t) {
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1;
  }
  // o jogador vira um "carro de roteiro" em espaço de pista
  const PC = { s: 0, x: 0, v: 0, yaw: 0, cv: 0, cx0: 0, yaw0: 0 };
  function startCinematic(kind) {
    G.state = 'cinematic';
    H.cine(true);
    H.hint(null);
    for (const b of BULLETS) {
      b.on = false;
      b.m.visible = false;
    }
    for (const L of LASERS) L.visible = false;
    const p = PLAYER, car = host.car;
    G.fin = { kind, t: 0, ph: kind === 'intercept' ? 'pass' : 'go', s0: p.s };
    frame(p.s);
    const th = Math.atan2(FF.x, FF.z);
    G.fin.a0 = Math.atan2(-FF.x, -FF.z);
    PC.s = p.s;
    PC.x = p.x;
    PC.v = p.v;
    PC.cv = Math.max(p.v || 0, 8);
    PC.cx0 = p.x;
    PC.yaw0 = K.wrapAng(car.heading - th);
    PC.yaw = PC.yaw0;
    for (const c of ALLIES) {
      c.cv = Math.max(c.v || 0, 8);
      c.cx0 = c.x;
      c.yaw0 = c.ph ? K.wrapAng(c.ph.h - th) : 0;
      c.yaw = c.yaw0;
      c.roll = 0;
    }
    if (kind === 'lapwin') {
      G.fin.lanes = [-2.4, -7.4, 7.4, 2.4].map((x) => x * LX);
      G.fin.dsg = [1, -1, 1, -1];
      G.fin.sOff = [0, -2.5, -2.5, -6.5];
    }
    if (kind === 'survive')
      G.fin.cops = COPS.filter((c) => c.active && c.state !== 'dying').map((c) => {
        c.spinV = rand(3.5, 6) * pick([-1, 1]);
        c.aim = null;
        return c;
      });
    if (kind === 'intercept') message('fin', 'Fecha o caminhão!', 4, 1.4);
    else if (kind === 'escape') message('fin', 'Some com o bonde!', 4, 1.4);
  }
  function placeScripted(c) {
    if (c === PC) {
      posePlayer(PC.s, PC.x, PC.yaw, PC.v);
      PLAYER.s = PC.s;
      PLAYER.x = PC.x;
      return;
    }
    c.place();
  }
  function spinScripted(c, dt, v) {
    if (c === PC) {
      host.car.wheelRot += (v / 0.35) * dt;
      return;
    }
    c.spin(dt, v);
  }
  function fxScripted(c, dt, rate, base) {
    if (c === PC) return;
    driftFX(c, dt, rate, base);
  }
  function stepCinematic(dt) {
    const F = G.fin, T = TRUCK, cars = [PC, ...ALLIES];
    F.t += dt;
    const lanesX = (arr) => arr.map((x) => x * LX);
    if (F.kind === 'lapwin') {
      const e = ease(Math.min(1, F.t / 2.8)), el = ease(Math.min(1, F.t / 1.6)), ey = ease(Math.min(1, F.t / 1.4));
      cars.forEach((c, i) => {
        const v = c.cv * (1 - e);
        c.s += v * dt;
        c.v = v;
        if (i > 0) c.s = damp(c.s, PC.s + (F.sOff[i] || -4), 2.4, dt);
        c.x = lerp(c.cx0, F.lanes[i] || 0, el);
        c.yaw = lerp(c.yaw0, (F.dsg[i] || 1) * 1.2, ey);
        c.roll = 0;
        c.lift = 0;
        placeScripted(c);
        spinScripted(c, dt, v);
        if (v > 3) fxScripted(c, dt, 30, 0.9);
      });
      for (const c of COPS)
        if (c.active && c.state !== 'dying') {
          c.v = damp(c.v, 0, 1.5, dt);
          c.s += c.v * dt;
          c.place();
        }
      if (F.t > 1 && !F.shown) {
        F.shown = 1;
        H.finale(RESULT_TEXT.lap[0], false);
        AU.ding(true);
      }
      if (F.t > 3.8 && G.state === 'cinematic') finishRace(true, 'lap');
      return;
    }
    if (F.kind === 'survive') {
      const L = lanesX([0, -4.6, 4.6, 1.8]);
      cars.forEach((c, i) => {
        c.v = damp(c.v, Math.max(c.cv, 30), 1, dt);
        c.s += c.v * dt;
        c.x = damp(c.x, L[i], 1.5, dt);
        c.yaw = damp(c.yaw, 0, 4, dt);
        placeScripted(c);
        spinScripted(c, dt, c.v);
      });
      for (const c of F.cops) {
        if (!c.active) continue;
        c.v = damp(c.v, 0, 1.4, dt);
        c.s += c.v * dt;
        c.yaw += c.spinV * dt;
        c.spinV *= Math.exp(-1.1 * dt);
        c.place();
        c.spin(dt, c.v);
        if (c.v > 2) driftFX(c, dt, 26, 0.85);
        const o = Math.max(0.04, 1 - F.t * 0.45);
        c.sir[0].material.opacity = o;
        c.sir[1].material.opacity = o;
      }
      if (F.t > 1 && !F.shown) {
        F.shown = 1;
        H.finale(RESULT_TEXT.survive[0], false);
        AU.ding(true);
      }
      if (F.t > 3.8 && G.state === 'cinematic') finishRace(true, 'survive');
      return;
    }
    if (F.kind === 'truckgone') {
      const e = ease(Math.min(1, F.t / 2.2)), L = lanesX([0, -4.6, 4.6, 1.8]);
      cars.forEach((c, i) => {
        const v = c.cv * (1 - e);
        c.s += v * dt;
        c.v = v;
        c.x = damp(c.x, L[i], 1.5, dt);
        c.yaw = damp(c.yaw, 0, 4, dt);
        placeScripted(c);
        spinScripted(c, dt, v);
      });
      if (T.g.visible) {
        T.v = damp(T.v, 50, 0.8, dt);
        T.s += T.v * dt;
        T.place();
        truckLight.position.copy(T.local(0, 1.4, -T.len / 2 - 2.5, _W1));
      }
      if (F.t > 0.8 && !F.shown) {
        F.shown = 1;
        H.finale(RESULT_TEXT.truck[0], true);
      }
      if (F.t > 3.6 && G.state === 'cinematic') finishRace(false, 'truck');
      return;
    }
    if (F.kind === 'dead') {
      stepPlayer(dt);
      if (F.t > 0.6 && !F.shown) {
        F.shown = 1;
        H.finale(RESULT_TEXT.dead[0], true);
      }
      if (F.t > 3.4 && G.state === 'cinematic') finishRace(false, 'dead');
      return;
    }
    if (F.kind === 'escape') {
      const L = lanesX([0, -4.4, 4.4, 1.9]);
      cars.forEach((c, i) => {
        c.v = damp(c.v || 30, 62, 1.2, dt);
        c.s += c.v * dt;
        spinScripted(c, dt, c.v);
        c.x = damp(c.x, L[i], 2, dt);
        c.yaw = damp(c.yaw, 0, 4, dt);
        c.roll = 0;
        placeScripted(c);
        if (c !== PC) {
          const q = c.local(0, 0.5, -c.len / 2, _W1);
          _C.setHSL(rand(0, 0.05), 1, 0.55);
          if (Math.random() < 0.5) fire.emit(q, 0, 0.4, 0, 0.14, 0.4, 0.1, _C);
        }
      });
      for (const c of COPS)
        if (c.active && c.state !== 'dying') {
          c.v = damp(c.v, 0, 1.2, dt);
          c.s += c.v * dt;
          c.place();
        }
      if (F.t > 1.4 && !F.shown) {
        F.shown = 1;
        H.finale(RESULT_TEXT.escape[0], false);
      }
      if (F.t > 3.6 && G.state === 'cinematic') finishRace(true, 'escape');
      return;
    }
    // interceptação: o bonde passa o caminhão e fecha a rua na frente dele
    if (F.ph === 'pass') {
      T.v = damp(T.v, 28, 1, dt);
      T.s += T.v * dt;
      T.x = damp(T.x, 0, 2, dt);
      const lanes = lanesX([PC.x <= 0 ? -8.6 : 8.6, -8.6, 8.6, 0]);
      cars.forEach((c, i) => {
        c.v = damp(c.v, T.v + (i ? 26 : 29), 2.2, dt);
        c.s += c.v * dt;
        c.x = damp(c.x, lanes[i], 2.4, dt);
        c.yaw = damp(c.yaw, 0, 5, dt);
        c.roll = 0;
      });
      if (Math.min(...cars.map((c) => c.s)) > T.s + T.len / 2 + 6) {
        F.ph = 'block';
        F.t = 0;
        const aS = cars.reduce((a, c) => a + c.s, 0) / cars.length, aV = cars.reduce((a, c) => a + c.v, 0) / cars.length;
        F.Dc = 2.1;
        F.Dt = 2.7;
        F.sF = aS + aV * F.Dc * 0.5 + 4;
        F.c0 = cars.map((c) => ({ s: c.s, v: c.v, x: c.x }));
        F.t0 = { s: T.s, v: T.v, x: T.x };
        F.fx = lanesX([-2.9, -8.4, 8.4, 2.9]);
        G.slowT = 1;
        G.slowK = 0.35;
      }
    } else {
      const tc = Math.min(1, F.t / F.Dc), tt = Math.min(1, F.t / F.Dt);
      cars.forEach((c, i) => {
        const o = F.c0[i];
        const ns = hermite(o.s, o.v * F.Dc, F.sF - (i ? 1.2 : 0), tc);
        c.v = clamp((ns - c.s) / dt, 0, 90);
        c.s = ns;
        c.x = lerp(o.x, F.fx[i], ease(tc));
        c.yaw = lerp(0, Math.PI / 2 + 0.08, ease(Math.min(1, tc * 1.35))) + Math.sin(tc * Math.PI) * 0.25;
        if (tc < 1) fxScripted(c, dt, 30, 0.92);
      });
      const nts = hermite(F.t0.s, F.t0.v * F.Dt, F.sF - T.len / 2 - 8.5, tt);
      T.v = clamp((nts - T.s) / dt, 0, 90);
      T.s = nts;
      T.x = lerp(F.t0.x, 0, ease(tt));
      if (F.ph === 'block' && F.t > F.Dt + 0.3) {
        F.ph = 'end';
        F.t = 0;
        AU.boom(0.5);
        H.finale(RESULT_TEXT.intercept[0], false);
      }
      if (F.ph === 'end' && F.t > 2.6 && G.state === 'cinematic') finishRace(true, 'intercept');
    }
    cars.forEach((c) => {
      spinScripted(c, dt, Math.abs(c.v));
      placeScripted(c);
    });
    T.place();
    truckLight.position.copy(T.local(0, 1.4, -T.len / 2 - 2.5, _W1));
  }

  // ---------------- resultado ----------------
  function finishRace(win, why) {
    if (G.state === 'result') return;
    G.state = 'result';
    H.cine(true);
    const sum = SCORER.finish();
    const res = Object.assign({ win }, sum);
    const ap = K.applyResult(save.data, G.ch, res, G.runId);
    if (win && G.chapter.tutorial) save.data.tutorialDone = true;
    save.save();
    G.result = { res, ap, why };
    AU.shutter();
    const [title, sub] = RESULT_TEXT[why] || ['Fim', ''];
    const ch = G.chapter, stars = ap.stars || K.evaluateChallenges(ch, res);
    host.onResult({ win, why, title, sub, res, ap, stars, chapter: ch, index: G.ch });
  }

  // ---------------- câmera (cinemáticas, como no original) ----------------
  const _cp = new V3(), _cl = new V3();
  function cameraTarget(outPos, outLook) {
    const F = G.fin;
    if (!F || (G.state !== 'cinematic' && G.state !== 'result')) return false;
    const p = PLAYER;
    if (F.kind === 'lapwin') {
      wpos(PC.s - 2, 0, 0.8, _cl);
      const a = F.a0 + F.t * 0.45;
      _cp.set(_cl.x + Math.sin(a) * 15, 6.5, _cl.z + Math.cos(a) * 15);
    } else if (F.kind === 'survive') {
      wpos(F.s0 + 34, 9 * LX, 3.2, _cp);
      const cp = (F.cops || []).filter((c) => c.active);
      if (cp.length) {
        let s = 0;
        for (const c of cp) s += c.s;
        wpos(s / cp.length, 0, 1, _cl);
      } else wpos(F.s0, 0, 1, _cl);
    } else if (F.kind === 'truckgone') {
      wpos(PC.s - 9, 0, 4.5, _cp);
      wpos(TRUCK.g.visible ? TRUCK.s : PC.s + 40, 0, 2, _cl);
    } else if (F.kind === 'dead') {
      const g = host.playerRoot().position, a = F.a0 + F.t * 0.6;
      _cl.set(g.x, 1, g.z);
      _cp.set(g.x + Math.sin(a) * 10, 4.5, g.z + Math.cos(a) * 10);
    } else if (F.kind === 'escape') {
      wpos(F.s0 + 8, 0, 5, _cp);
      wpos(PC.s, 0, 1.2, _cl);
    } else if (F.ph === 'pass') {
      wpos(PC.s - 10, 0, 6.5, _cp);
      wpos(PC.s + 12, 0, 1, _cl);
    } else {
      wpos(F.sF + 16, 0, 8.5, _cp);
      wpos(F.sF - 8, 0, 1, _cl);
    }
    void p;
    outPos.copy(_cp);
    outLook.copy(_cl);
    return true;
  }

  // ---------------- HUD ----------------
  function updateCue() {
    const p = PLAYER;
    let dir = 0, tt = 9;
    if (G.state === 'play' && p.v > 14 && !p.drift) {
      const reach = Math.min(90, 12 + p.v * 2.1);
      for (let d = 6; d < reach; d += 4) {
        const k = curv(p.s + d);
        if (Math.abs(k) > 0.0055) {
          dir = Math.sign(k);
          tt = d / Math.max(8, p.v);
          break;
        }
      }
    }
    const on = dir !== 0 && tt < 1.7;
    if (on) {
      let kmax = 0;
      for (let d = 0; d < 30; d += 3) kmax = Math.max(kmax, Math.abs(curv(p.s + p.v * Math.max(0.2, tt) + d)));
      const alvo = Math.round(Math.sqrt(10.5 / (kmax || 1e-4)) * 3.6);
      H.cue(true, dir > 0 ? 'l' : 'r', (host.touch() ? 'SEGURA DRIFT' : 'ESPAÇO + VOLANTE') + ' · ' + alvo + ' KM/H', 1 - clamp(tt / 1.7, 0, 1));
      G.cueT = G.simT;
      G.cueDir = dir;
    } else H.cue(false);
    H.slip(p.drift, clamp(p.slipDeg / (CARP.maxSlip + 8), 0, 1), p.slipDeg >= CFG.scoring.minSlip && p.slipDeg <= CARP.maxSlip * 0.92);
  }
  function updateHUD(dt, camera) {
    updateCue();
    const p = PLAYER, st = SCORER.state, ch = G.chapter;
    H.score(fmt(st.total));
    const best = (save.data.chapters[ch.id] || {}).best || 0;
    H.record(best > 0 ? 'Recorde ' + fmt(best) : 'Primeira vez');
    const w = ch.win;
    let lab = '', val = '';
    if (w.type === 'lap' || w.type === 'escape') {
      lab = 'Volta';
      const pr = clamp((p.s - START_S) / (TR.n * w.laps), 0, 1);
      val = Math.round(pr * 100) + '%';
    } else if (w.type === 'survive') {
      lab = 'Aguente';
      val = Math.ceil(Math.max(0, G.left)) + 's';
    } else if (w.type === 'intercept') {
      lab = 'Carga';
      val = Math.ceil(Math.max(0, G.left)) + 's';
    }
    H.objective(lab, val);
    H.gauge(w.type === 'intercept' ? G.gauge : null);
    H.life(clamp(p.life / p.maxLife, 0, 1));
    const show = st.active && st.pending > 1;
    const left = 1 - clamp(st.sinceValid / SCORER.S.consolidateAfter, 0, 1);
    H.combo(show, '+' + fmt(st.pending), 'x' + st.mult, left, left < 0.35);
    const cur = MSG.tick(dt);
    H.msg(cur);
    if (!host.reduceFx()) {
      hurtState.a = Math.max(0, hurtState.a - dt * 1.6);
      H.hurt(hurtState.a);
    }
    // viaturas atrás (setinha na borda de baixo)
    const xs = [];
    for (const c of COPS) {
      if (xs.length >= 3) break;
      if (!c.active || c.state === 'dying' || c.s > p.s) continue;
      _W1.copy(c.g.position).project(camera);
      if (!(_W1.z > 1 || _W1.y < -0.9)) continue;
      xs.push(clamp((_W1.z > 1 ? -_W1.x : _W1.x) * 0.5 + 0.5, 0.08, 0.92));
    }
    H.indicators(xs);
  }
  function flushScoreEvents() {
    for (const e of SCORER.drainEvents()) {
      if (e.type === 'combo' && e.points >= 40) {
        message('combo', '+' + fmt(e.points) + (e.mult > 1 ? '  x' + e.mult : ''), 3, 1.1);
        AU.ding(e.mult > 2);
      } else if (e.type === 'mult') message('mult', 'Combo x' + e.mult, 2, 0.8);
      else if (e.type === 'lost' && e.points > 30) message('lost', 'Combo perdido', 3, 1.1);
      else if (e.type === 'transition') message('trans', 'Transição!', 1, 0.7);
      else if (e.type === 'near') message('near', 'Passou raspando!', 1, 0.8);
    }
  }
  function updateLights() {
    const p = PLAYER;
    const cops = COPS.filter((c) => c.active && c.state !== 'dying').sort((a, b) => Math.abs(a.s - p.s) - Math.abs(b.s - p.s));
    sirenLights.forEach((L, i) => {
      const c = cops[i];
      if (c) {
        L.position.copy(c.g.position);
        L.position.y += c.hgt + 1;
        L.color.setHex((G.t * 6 + i) % 2 < 1 ? 0xff2020 : 0x2f6bff);
        L.intensity = 2.6 * LK;
      } else L.intensity = 0;
    });
    boomLight.intensity = host.reduceFx() ? 0 : Math.max(0, boomLight.intensity * 0.9 - 0.05 * LK);
    let nd = 999;
    for (const c of COPS) if (c.active && c.state !== 'dying') nd = Math.min(nd, Math.abs(c.s - p.s));
    AU.sirenLevel(G.state === 'play' ? Math.max(0, 1 - nd / 70) * 0.035 : 0);
  }

  // ---------------- API ----------------
  return {
    get state() {
      return G.state;
    },
    get chapterIndex() {
      return G.ch;
    },
    get player() {
      return PLAYER;
    },
    get shake() {
      return G.shake;
    },
    set shake(v) {
      G.shake = v;
    },
    get fovKick() {
      return G.fovKick;
    },
    /** velocidade do tempo (câmera lenta das batidas e das cinemáticas) */
    timeScale(realDt) {
      if (G.state === 'idle' || G.slowT <= 0) return 1;
      const k = G.slowK;
      G.slowT -= realDt;
      if (G.slowT <= 0) G.slowK = 0.35;
      return k;
    },
    /** o jogador controla o carro? */
    controls() {
      return G.state === 'play' && !PLAYER.dead;
    },
    start(idx, route) {
      startChapter(idx, route);
    },
    contact,
    /** avança a missão (dt já na escala de tempo) */
    step(dt, camera) {
      if (G.state === 'idle') return;
      G.t += dt;
      G.simT += dt;
      G.fovKick = Math.max(0, G.fovKick - dt * 0.8);
      if (G.state === 'intro') stepIntro(dt);
      else if (G.state === 'play') {
        stepPlayer(dt);
        stepAllies(dt);
        stepTruck(dt);
        stepCops(dt);
        stepBullets(dt);
        stepFlow(dt);
        flushScoreEvents();
      } else if (G.state === 'cinematic') {
        stepCinematic(dt);
        if (G.fin && (G.fin.kind === 'intercept' || G.fin.kind === 'escape')) stepCops(dt);
      } else if (G.state === 'result' && G.result && G.result.why === 'dead') stepPlayer(dt);
      smoke.update(dt);
      fire.update(dt);
      sparks.update(dt);
      if (G.state === 'play' || G.state === 'intro') {
        drawLasers();
        if (G.state === 'play') updateHUD(dt, camera);
      }
      updateLights();
    },
    cameraTarget,
    /** pose extra do carro (capotando quando perde) */
    playerLift() {
      return { lift: PLAYER.lift, roll: PLAYER.roll };
    },
    /** some com tudo da missão e volta ao mundo aberto */
    end() {
      G.state = 'idle';
      G.fin = null;
      resetWorld();
      setLights(false);
      for (const k in CARS3) CARS3[k].g.visible = false;
      if (TRUCK) TRUCK.g.visible = false;
      for (const id in DRIVERS) DRIVERS[id].visible = false;
      MARKER.visible = false;
      if (MARKER.parent) MARKER.parent.remove(MARKER);
      AU.sirenLevel(0);
      H.reset();
      H.finale(null);
      H.cine(false);
      PLAYER.lift = PLAYER.roll = 0;
    },
  };
}
