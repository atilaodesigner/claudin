// Orquestra tudo: renderer, pós-processamento, física em passo fixo,
// colisões, pontuação, missões, tráfego, efeitos, câmera, áudio e HUD.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

import { CAR, CarPhysics } from './physics/car';
import { SpatialGrid, collide, rect, resolve, type Shape } from './physics/collide';
import { DriftScorer } from './score/drift';
import { buildCity, nearestLane, surfaceAt, type City } from './world/city';
import { buildCityMeshes, type CityMeshes } from './world/cityMesh';
import { makeTextures } from './world/textures';
import { buildSky } from './world/sky';
import { Missions } from './world/missions';
import { buildMustang, WHEEL_POS, type MustangRig } from './car/mustang';
import { Traffic } from './traffic/traffic';
import { Particles, DustMotes } from './fx/particles';
import { LightTrail, SkidMarks } from './fx/trails';
import { WetReflection, NO_REFLECT } from './fx/wet';
import { Rain, buildLightCones } from './fx/rain';
import { buildNeon } from './world/neon';
import { buildProps } from './world/props';
import type { Assets } from './assets';
import { AudioSystem } from './audio/audio';
import { Radio } from './audio/radio';
import { Input, type Action } from './input';
import { Hud, fmt } from './ui/hud';

const STEP = 1 / 120;
const SAVE_KEY = 'bsbass-drift-save-v1';
type CamMode = 'chase' | 'far' | 'hood';
const CAM_NAMES: Record<CamMode, string> = { chase: 'CÂMERA PERTO', far: 'CÂMERA LONGE', hood: 'CÂMERA CAPÔ' };

interface Save {
  total: number;
  best: number;
  fitas: number[];
  rachas: (number | null)[];
  cam: CamMode;
  station: number;
  vol: { car: number; music: number };
}

function loadSave(): Save {
  const def: Save = { total: 0, best: 0, fitas: [], rachas: [], cam: 'chase', station: 1, vol: { car: 0.8, music: 0.7 } };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return def;
    return { ...def, ...JSON.parse(raw) };
  } catch {
    return def;
  }
}

const GRADE_SHADER = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAberr: { value: 0.0015 }, uVignette: { value: 0.55 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uAberr; uniform float uVignette;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      float r = dot(d, d);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + d * uAberr * (1.0 + r * 4.0)).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - d * uAberr * (1.0 + r * 4.0)).b;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      // sombras puxam pro azul-petróleo, altas pro âmbar do sódio
      col += vec3(-0.012, 0.004, 0.028) * (1.0 - smoothstep(0.0, 0.35, l));
      col *= mix(vec3(1.0), vec3(1.05, 0.99, 0.9), smoothstep(0.35, 1.0, l));
      col *= 1.0 - uVignette * r * 1.5;
      col += (hash(vUv * 1024.0 + fract(uTime) * 91.0) - 0.5) * 0.045;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 3200);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private grade: ShaderPass;

  readonly city: City;
  private meshes: CityMeshes;
  private grid = new SpatialGrid<Shape>(16);
  readonly car = new CarPhysics();
  private rig: MustangRig;
  readonly scorer = new DriftScorer();
  readonly missions: Missions;
  readonly traffic: Traffic;
  private smoke: Particles;
  private sparks: Particles;
  private dust: DustMotes;
  private skids = new SkidMarks();
  private trails: LightTrail[] = [];
  readonly audio = new AudioSystem();
  readonly radio: Radio;
  readonly input = new Input();
  readonly hud: Hud;
  private lampPool: THREE.PointLight[] = [];
  private neonPool: THREE.PointLight[] = [];
  private neonLights: { x: number; y: number; z: number; color: THREE.Color }[] = [];
  private wet: WetReflection;
  private rain: Rain;
  private reflScale: number;
  private heroLight: THREE.PointLight;
  private heroFill: THREE.PointLight;
  private lampTimer = 0;
  private lampTargets: { p: THREE.Vector3; w: number }[] = [];

  private acc = 0;
  time = 0;
  private camMode: CamMode = 'chase';
  private camYaw = 0;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private shake = 0;
  private carY = 0;
  private roll = 0;
  private pitch = 0;
  private save: Save;
  private started = false;
  private crashCd = 0;
  private autopilot: ((t: number) => Partial<import('./physics/car').CarInput>) | null = null;
  private frameTimes: number[] = [];
  private pixelRatio: number;
  private lastSaveAt = 0;

  constructor(container: HTMLElement, hudParent: HTMLElement, assets: Assets = { photos: {}, tex: {}, models: {} }) {
    const touch = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: !touch, powerPreference: 'high-performance' });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, touch ? 1.6 : 1.75);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.save = loadSave();
    this.camMode = this.save.cam;

    // ---------- mundo ----------
    this.scene.fog = new THREE.FogExp2(0x1c1320, 0.0085);
    this.scene.background = new THREE.Color(0x07060a);
    this.scene.add(buildSky());
    const hemi = new THREE.HemisphereLight(0x55508a, 0x3a1a0c, 0.95);
    this.scene.add(hemi);
    const moon = new THREE.DirectionalLight(0x8aa0d8, 0.35);
    moon.position.set(-300, 400, 200);
    this.scene.add(moon);

    const tx = makeTextures(assets.photos);
    this.city = buildCity();
    for (const c of this.city.colliders) this.grid.insert(c);
    const hasProps = Object.keys(assets.models).length > 0;
    this.meshes = buildCityMeshes(this.city, tx, assets.tex, hasProps);
    this.scene.add(this.meshes.group);
    if (hasProps) {
      const props = buildProps(this.city, assets.models);
      this.scene.add(props.group);
      for (const c of props.colliders) this.grid.insert(c);
    }

    // asfalto molhado com reflexo de verdade
    this.reflScale = touch ? 0.32 : 0.5;
    this.wet = new WetReflection(this.reflScale);
    for (const name of ['asphalt', 'ground', 'sidewalk', 'marks', 'pools', 'dirt']) {
      const m = this.meshes.group.getObjectByName(name) as THREE.Mesh | undefined;
      if (!m) continue;
      m.layers.set(NO_REFLECT);
      if (name === 'asphalt') this.wet.patch(m.material as THREE.MeshStandardMaterial, 1.0, 1.0);
      if (name === 'sidewalk') this.wet.patch(m.material as THREE.MeshStandardMaterial, 0.45, 0.25);
      if (name === 'marks') this.wet.patch(m.material as THREE.MeshStandardMaterial, 0.6, 0.0);
    }
    this.camera.layers.enable(NO_REFLECT);
    const neon = buildNeon(this.city);
    this.scene.add(neon.group);
    this.neonLights = neon.lights;
    const cones = buildLightCones(this.meshes.lampLights);
    cones.layers.set(NO_REFLECT);
    this.scene.add(cones);
    this.rain = new Rain(touch ? 2200 : 3600);
    this.rain.lines.layers.set(NO_REFLECT);
    this.scene.add(this.rain.lines);
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 16, 1.6);
      this.scene.add(l);
      this.neonPool.push(l);
    }

    for (let i = 0; i < 7; i++) {
      const l = new THREE.PointLight(0xff9a45, 0, 30, 1.6);
      this.scene.add(l);
      this.lampPool.push(l);
    }

    // ---------- carro ----------
    const env = this.makeEnvMap();
    this.rig = buildMustang(env);
    this.scene.add(this.rig.root);
    // luz de "estúdio" que segue o carro (senão ele vira silhueta contra a luz de sódio)
    this.heroLight = new THREE.PointLight(0xbfd0ff, 14, 14, 1.4);
    this.scene.add(this.heroLight);
    this.heroFill = new THREE.PointLight(0xff9a50, 8, 10, 1.4);
    this.scene.add(this.heroFill);
    const spawn = nearestLane(-260, 5);
    this.car.reset(spawn.x, spawn.z, spawn.heading);
    this.camYaw = spawn.heading;

    // ---------- missões / tráfego / efeitos ----------
    this.missions = new Missions(this.city, { fitas: this.save.fitas, rachas: this.save.rachas });
    this.scene.add(this.missions.group);
    this.traffic = new Traffic(touch ? 22 : 30);
    this.scene.add(this.traffic.group);
    this.smoke = new Particles(900, tx.puff, false);
    this.sparks = new Particles(400, tx.glow, true);
    this.dust = new DustMotes(tx.glow);
    this.scene.add(this.smoke.points, this.sparks.points, this.dust.points, this.skids.mesh);
    for (const o of [this.smoke.points, this.dust.points, this.skids.mesh]) o.layers.set(NO_REFLECT);
    for (let i = 0; i < 2; i++) {
      const t = new LightTrail();
      this.trails.push(t);
      this.scene.add(t.mesh);
    }
    this.scorer.total = this.save.total;
    this.scorer.best = this.save.best;

    // ---------- pós ----------
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.5, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GRADE_SHADER);
    this.composer.addPass(this.grade);

    // ---------- áudio + HUD ----------
    this.radio = new Radio(this.audio);
    this.radio.station = this.save.station;
    this.audio.carVolume = this.save.vol.car;
    this.audio.musicVolume = this.save.vol.music;
    this.hud = new Hud(hudParent, this.input, this.radio, this.city);
    this.hud.vol = { ...this.save.vol };
    this.hud.onStart = () => {
      this.audio.start();
      this.radio.start();
      this.hud.renderRadio();
    };
    this.hud.onPauseChange = (p) => {
      this.input.enabled = !p;
    };
    this.hud.onVolumes = (car, music) => {
      this.audio.setVolumes(car, music);
      this.save.vol = { car, music };
      this.persist();
    };
    this.hud.onMute = (m) => this.audio.setMuted(m);
    this.hud.onRestart = () => {
      try { localStorage.removeItem(SAVE_KEY); } catch { /* sem storage */ }
      location.reload();
    };
    this.refreshObjectives();
    this.input.on((a) => this.onAction(a));

    window.addEventListener('resize', () => this.resize());
    this.resize();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.hud.started) this.hud.setPaused(true);
    });
  }

  private makeEnvMap(): THREE.Texture {
    // ambiente pro reflexo da pintura: céu escuro com faixas de luz de sódio e neon
    const envScene = new THREE.Scene();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ color: 0x0a0a14, side: THREE.BackSide }));
    envScene.add(sky);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: 0x1a0e08 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -3;
    envScene.add(ground);
    const strip = (color: number, x: number, y: number, z: number, w: number, h: number, k: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      envScene.add(m);
    };
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      strip(0xff9a40, Math.cos(a) * 30, 12, Math.sin(a) * 30, 6, 1.5, 3.5);
    }
    strip(0x33e0ff, 25, 4, -20, 10, 1, 3);
    strip(0xff3b8a, -28, 5, 12, 8, 1.2, 3);
    strip(0xffffff, 0, 40, 0, 30, 30, 0.25);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const rt = pmrem.fromScene(envScene, 0.02);
    pmrem.dispose();
    return rt.texture;
  }

  private onAction(a: Action): void {
    if (a === 'pause') {
      if (!this.hud.started) return;
      this.hud.setPaused(!this.hud.paused);
      return;
    }
    if (a === 'radioPanel') {
      this.hud.toggleRadio();
      return;
    }
    if (a === 'mute') {
      this.audio.setMuted(!this.audio.muted);
      this.hud.popup(this.audio.muted ? 'SEM SOM' : 'SOM LIGADO');
      return;
    }
    if (a === 'radioNext' || a === 'radioPrev') {
      if (a === 'radioNext') this.radio.nextStation(1);
      else this.radio.nextStation(-1);
      const st = this.radio.current;
      this.hud.popup(`${st.freq} ${st.name}`);
      this.save.station = this.radio.station;
      this.persist();
      return;
    }
    if (!this.hud.started || this.hud.paused) {
      if (a === 'cam' && this.hud.paused) this.cycleCam();
      return;
    }
    if (a === 'cam') this.cycleCam();
    if (a === 'reset') this.resetCar();
    if (a === 'help') this.hud.popup('ESPAÇO = FREIO DE MÃO');
  }

  private cycleCam(): void {
    const order: CamMode[] = ['chase', 'far', 'hood'];
    this.camMode = order[(order.indexOf(this.camMode) + 1) % order.length]!;
    this.hud.popup(CAM_NAMES[this.camMode]);
    this.save.cam = this.camMode;
    this.persist();
  }

  resetCar(): void {
    const p = nearestLane(this.car.x, this.car.z);
    this.car.reset(p.x, p.z, p.heading);
    this.camYaw = p.heading;
    const e = this.scorer.crash();
    if (e && e.type === 'lost') this.hud.lost(e.points);
    if (this.missions.active) {
      this.missions.cancelRace();
      this.hud.race(null);
      this.hud.banner('RACHA CANCELADO', '', 1.6, 'red');
    }
  }

  private persist(): void {
    this.save.total = this.scorer.total;
    this.save.best = this.scorer.best;
    const m = this.missions.savedState();
    this.save.fitas = m.fitas;
    this.save.rachas = m.rachas;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch { /* sem storage */ }
  }

  private refreshObjectives(): void {
    const done = this.missions.rachas.filter((r) => r.done).length;
    this.hud.setObjectives({
      fitas: `${this.missions.fitas.length - this.missions.fitasLeft}/${this.missions.fitas.length}`,
      rachas: `${done}/${this.missions.rachas.length}`,
      best: fmt(this.scorer.best),
      total: fmt(this.scorer.total),
    });
  }

  resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.composer.setPixelRatio(this.pixelRatio);
    this.bloom.resolution.set(Math.round(w / 2), Math.round(h / 2));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.wet?.setSize(w * this.pixelRatio, h * this.pixelRatio);
    this.smoke.setViewportHeight(h * this.pixelRatio, this.camera.fov);
    this.sparks.setViewportHeight(h * this.pixelRatio, this.camera.fov);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** pra testes/screenshot: dirige sozinho */
  setAutopilot(fn: ((t: number) => Partial<import('./physics/car').CarInput>) | null): void {
    this.autopilot = fn;
  }

  frame(dt: number, render = true): void {
    this.time += dt;
    const playing = this.hud.started && !this.hud.paused;
    const input = this.input.update(dt);
    if (this.autopilot) Object.assign(input, { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false }, this.autopilot(this.time));
    if (!this.hud.started && !this.autopilot) {
      input.throttle = input.brake = input.steer = 0;
      input.handbrake = input.nitro = false;
    }

    if (playing || this.autopilot) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 8) {
        this.physicsStep(input);
        this.acc -= STEP;
        steps++;
      }
      this.gameplay(dt);
      this.traffic.update(dt, this.car, this.camera.position);
      this.trafficCollisions();
    }

    this.updateVisuals(dt, playing || !!this.autopilot);
    this.updateCamera(dt);
    this.updateLamps(dt);

    this.audio.updateCar(this.car.rpm, this.car.throttle, this.car.rearSlip, this.car.speed, this.car.nitroActive, this.car.surfaceGrip < 0.9, !playing);
    this.radio.update(dt);
    for (const c of this.traffic.honks) {
      const d = Math.hypot(c.x - this.car.x, c.z - this.car.z);
      if (d < 40) this.audio.horn((c.x - this.car.x) / 20);
    }

    // paredão pulsando com o grave + luz da caixa d'água
    const b = this.radio.bassLevel;
    this.meshes.paredaoLeds.color.setRGB(0.2 + b * 2.4, 0.9 + b * 3, 2.4 + b * 4);
    const blink = Math.sin(this.time * 3) > 0.2 ? 3 : 0.2;
    this.meshes.beacon.color.setRGB(blink, 0.1, 0.05);

    this.grade.uniforms.uTime!.value = this.time;
    this.grade.uniforms.uAberr!.value = 0.0012 + (this.car.nitroActive ? 0.004 : 0) + Math.min(0.004, this.shake * 0.01);
    if (!render) return;
    this.rain.update(this.time, this.camera.position, this.car.vx, this.car.vz);
    this.wet.render(this.renderer, this.scene, this.camera);
    this.composer.render(dt);
    this.adaptQuality(dt);

    if (this.time - this.lastSaveAt > 5 && playing) {
      this.lastSaveAt = this.time;
      this.persist();
    }
  }

  private adaptQuality(dt: number): void {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    if (avg > 0.024 && this.reflScale > 0.26) {
      // primeiro abaixa a resolução do reflexo, depois a da tela
      this.reflScale = Math.max(0.25, this.reflScale - 0.12);
      this.wet.setScale(this.reflScale, window.innerWidth * this.pixelRatio, window.innerHeight * this.pixelRatio);
    } else if (avg > 0.024 && this.pixelRatio > 0.7) {
      this.pixelRatio = Math.max(0.7, this.pixelRatio - 0.2);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.resize();
    }
  }

  private nearShapes: Shape[] = [];
  private carRect = rect(0, 0, CAR.halfWidth, CAR.halfLength);

  private physicsStep(input: import('./physics/car').CarInput): void {
    const car = this.car;
    const s = surfaceAt(this.city, car.x, car.z);
    car.surfaceGrip = s.grip;
    car.step(STEP, input);

    // colisão com o mundo estático
    this.carRect.x = car.x;
    this.carRect.z = car.z;
    this.carRect.rot = car.heading;
    this.grid.near(car.x - 4, car.z - 4, car.x + 4, car.z + 4, this.nearShapes);
    for (const sh of this.nearShapes) {
      const c = collide(this.carRect, sh);
      if (!c) continue;
      const impact = resolve(car, CAR.mass, CAR.inertia, c, 0.18, 0.4);
      this.carRect.x = car.x;
      this.carRect.z = car.z;
      if (impact > 0) this.onImpact(impact, c.px, c.pz);
    }
  }

  private onImpact(v: number, px: number, pz: number): void {
    if (v < 2.5 || this.crashCd > 0) return;
    this.crashCd = 0.35;
    this.audio.crash(v);
    this.shake = Math.min(1, this.shake + v * 0.05);
    for (let i = 0; i < Math.min(40, v * 3); i++) {
      this.sparks.emit({
        x: px, y: 0.5 + Math.random() * 0.4, z: pz,
        vx: (Math.random() - 0.5) * 8, vy: Math.random() * 5, vz: (Math.random() - 0.5) * 8,
        life: 0.3 + Math.random() * 0.4, size: 0.12, grow: -0.1, r: 3, g: 1.6, b: 0.4, a: 1, drag: 1, gravity: 12,
      });
    }
    if (v > 7) {
      const e = this.scorer.crash();
      if (e && e.type === 'lost') {
        this.hud.lost(e.points);
        this.audio.lost();
      }
    }
  }

  private trafficCollisions(): void {
    const out = { jx: 0, jz: 0 };
    for (const t of this.traffic.cars) {
      const dx = t.x - this.car.x, dz = t.z - this.car.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 144) continue;
      this.carRect.x = this.car.x;
      this.carRect.z = this.car.z;
      this.carRect.rot = this.car.heading;
      const c = collide(this.carRect, t.rect);
      if (c) {
        // velocidade relativa: resolve no referencial do carro de tráfego
        const body = { x: this.car.x, z: this.car.z, vx: this.car.vx - t.vx, vz: this.car.vz - t.vz, yawRate: this.car.yawRate };
        const impact = resolve(body, CAR.mass, CAR.inertia, c, 0.3, 0.3, t.mass, out);
        this.car.x = body.x;
        this.car.z = body.z;
        this.car.vx = body.vx + t.vx;
        this.car.vz = body.vz + t.vz;
        this.car.yawRate = body.yawRate;
        if (impact > 0) {
          this.traffic.knock(t, out.jx, out.jz, c.px, c.pz);
          this.onImpact(impact, c.px, c.pz);
        }
        continue;
      }
      // passou raspando?
      if (t.nearMissCd <= 0 && this.scorer.active && d2 < 30) {
        const rel = Math.hypot(this.car.vx - t.vx, this.car.vz - t.vz);
        const inflated = rect(this.car.x, this.car.z, CAR.halfWidth + 1.4, CAR.halfLength + 0.8, this.car.heading);
        if (rel > 7 && collide(inflated, t.rect)) {
          t.nearMissCd = 4;
          const e = this.scorer.nearMiss();
          if (e && e.type === 'nearMiss') {
            this.hud.popup(`RASPANDO! +${fmt(e.points)}`, 'gold');
            this.audio.nearMiss();
            this.car.addNitro(0.08);
          }
        }
      }
    }
    // carros batidos também batem nas paredes
    for (const t of this.traffic.cars) {
      if (!t.knocked) continue;
      this.grid.near(t.x - 6, t.z - 6, t.x + 6, t.z + 6, this.nearShapes);
      for (const sh of this.nearShapes) {
        const c = collide(t.rect, sh);
        if (!c) continue;
        const body = { x: t.x, z: t.z, vx: t.vx, vz: t.vz, yawRate: t.yawRate };
        resolve(body, t.mass, t.mass * 2, c, 0.1, 0.5);
        Object.assign(t, body);
        t.rect.x = t.x;
        t.rect.z = t.z;
      }
    }
  }

  private gameplay(dt: number): void {
    const car = this.car;
    this.crashCd = Math.max(0, this.crashCd - dt);
    const kmh = car.speed * 3.6;
    const ev = this.scorer.update(dt, {
      speedKmh: kmh,
      angleDeg: Math.abs(car.slipAngle) * (180 / Math.PI),
      forward: car.vLong > 0,
      surface: car.surfaceGrip,
    });
    car.addNitro(this.scorer.nitroGain);
    for (const e of ev) {
      if (e.type === 'bank') {
        this.hud.bank(e.points, e.label);
        this.audio.bank(e.points > 5000);
        this.refreshObjectives();
        this.persist();
      } else if (e.type === 'mult') {
        this.audio.mult();
      }
    }

    for (const e of this.missions.update(dt, car.x, car.z, kmh)) {
      switch (e.type) {
        case 'fita':
          this.scorer.total += 500;
          car.addNitro(0.3);
          this.audio.pickup();
          this.hud.banner(`FITA ${e.total - e.left}/${e.total}`, '+500 · NITRO CHEIO DE GRAVE', 1.8);
          this.refreshObjectives();
          this.persist();
          if (e.left === 0) this.hud.banner('TODAS AS FITAS!', 'O GRAVE É TEU', 3);
          break;
        case 'rachaStart':
          this.hud.banner(e.racha.name, `${e.racha.checkpoints.length} CHECKPOINTS · ${e.racha.limit}s`, 2.4, 'cyan');
          break;
        case 'countdown':
          this.hud.popup(String(e.n));
          this.audio.countdown(false);
          break;
        case 'go':
          this.hud.popup('VAI!', 'gold');
          this.audio.countdown(true);
          break;
        case 'checkpoint':
          this.audio.blip([880, 1320], 0.06, 'square', 0.1);
          break;
        case 'rachaWin': {
          const bonus = Math.max(1000, Math.round((e.racha.limit - e.time) * 400));
          this.scorer.total += bonus;
          this.hud.banner(e.best ? 'RECORDE!' : 'CHEGOU!', `${e.time.toFixed(2)}s · +${fmt(bonus)}`, 3, 'cyan');
          this.audio.bank(true);
          this.hud.race(null);
          this.refreshObjectives();
          this.persist();
          break;
        }
        case 'rachaFail':
          this.hud.banner('TEMPO ESGOTADO', 'VOLTA NO PONTO AZUL E TENTA DE NOVO', 2.6, 'red');
          this.audio.lost();
          this.hud.race(null);
          break;
      }
    }
    const m = this.missions;
    if (m.active) {
      const left = Math.max(0, m.active.limit - m.raceTime);
      this.hud.race(
        m.countdown > 0
          ? `<b>${m.active.name}</b><br/>SE PREPARA...`
          : `<b>${m.active.name}</b><br/>CP ${m.cp + 1}/${m.active.checkpoints.length} · ${m.raceTime.toFixed(1)}s · FALTAM ${left.toFixed(1)}s`,
      );
      // durante a contagem o carro fica preso na largada
      if (m.countdown > 0) {
        car.vx *= 0.8;
        car.vz *= 0.8;
      }
    }
  }

  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();

  private updateVisuals(dt: number, active: boolean): void {
    const car = this.car;
    const rig = this.rig;
    const surf = surfaceAt(this.city, car.x, car.z);
    this.carY += (surf.height - this.carY) * Math.min(1, dt * 12);
    rig.root.position.set(car.x, this.carY, car.z);
    rig.root.rotation.y = car.heading;
    const tr = THREE.MathUtils.clamp(-car.accelLat * 0.011, -0.07, 0.07);
    const tp = THREE.MathUtils.clamp(car.accelLong * 0.007, -0.05, 0.05);
    this.roll += (tr - this.roll) * Math.min(1, dt * 6);
    this.pitch += (tp - this.pitch) * Math.min(1, dt * 6);
    rig.body.rotation.set(this.pitch, 0, this.roll);
    rig.body.position.y = surf.dirt ? Math.sin(this.time * 30) * 0.01 * Math.min(1, car.speed / 20) : 0;
    rig.wheels.forEach((w, i) => {
      if (i < 2) w.steer.rotation.y = car.steerAngle;
      w.spin.rotation.x = car.wheelRot;
    });

    // luzes
    const braking = car.braking && car.speed > 0.5;
    rig.brakeMat.color.setRGB(braking ? 4 : 0.5, braking ? 0.1 : 0.02, braking ? 0.06 : 0.02);
    rig.tailMat.color.setRGB(braking ? 3.6 : 2, 0.07, 0.04);
    rig.reverseMat.color.setRGB(car.reversing ? 3 : 0.15, car.reversing ? 3 : 0.15, car.reversing ? 3 : 0.15);
    const glow = 0.85 + Math.sin(this.time * 2.2) * 0.1;
    (rig.underglow.material as THREE.MeshBasicMaterial).color.setRGB(0.04 * glow, 0.22 * glow, 0.9 * glow);

    // ---------- fumaça / poeira ----------
    const c = Math.cos(car.heading), s = Math.sin(car.heading);
    const toWorld = (lx: number, ly: number, lz: number, out: THREE.Vector3) =>
      out.set(car.x + lx * c + lz * s, this.carY + ly, car.z - lx * s + lz * c);
    if (active) {
      for (let wi = 2; wi < 4; wi++) {
        const [wx, wz] = WHEEL_POS[wi]!;
        toWorld(wx, 0.1, wz, this.tmpV);
        const slip = car.rearSlip;
        if (surf.dirt) {
          const n = (car.speed > 4 ? 0.25 + slip * 1.5 : slip) * dt * 60;
          for (let k = 0; k < n; k++) {
            if (Math.random() > n - k) break;
            this.smoke.emit({
              x: this.tmpV.x, y: 0.3, z: this.tmpV.z,
              vx: car.vx * 0.3 + (Math.random() - 0.5) * 3, vy: 0.6 + Math.random() * 1.2, vz: car.vz * 0.3 + (Math.random() - 0.5) * 3,
              life: 1.4 + Math.random() * 1.2, size: 1.1, grow: 2.4, r: 0.62, g: 0.3, b: 0.17, a: 0.4, drag: 1.4,
            });
          }
        } else if (slip > 0.22 && car.speed > 2) {
          const n = (slip - 0.2) * 1.6 * dt * 60;
          for (let k = 0; k < n; k++) {
            if (Math.random() > n - k) break;
            this.smoke.emit({
              x: this.tmpV.x + (Math.random() - 0.5) * 0.4, y: 0.25, z: this.tmpV.z + (Math.random() - 0.5) * 0.4,
              vx: car.vx * 0.15 + (Math.random() - 0.5) * 2, vy: 0.5 + Math.random() * 0.8, vz: car.vz * 0.15 + (Math.random() - 0.5) * 2,
              life: 0.9 + Math.random() * 1.0, size: 0.8, grow: 2.0, r: 0.7, g: 0.66, b: 0.66, a: 0.2 * Math.min(1, slip * 1.4), drag: 1.3,
            });
          }
        }
        this.skids.add(wi, this.tmpV.x, this.carY, this.tmpV.z, surf.dirt ? Math.min(0.5, car.speed / 25) : slip > 0.35 ? slip : 0, surf.dirt);
      }
      // nitro: chama azul nas 4 ponteiras
      if (car.nitroActive) {
        for (const e of rig.exhausts) {
          toWorld(e.x, e.y, e.z, this.tmpV);
          for (let k = 0; k < 2; k++) {
            const core = k === 0;
            this.sparks.emit({
              x: this.tmpV.x, y: this.tmpV.y, z: this.tmpV.z,
              vx: car.vx - s * (4 + Math.random() * 4), vy: Math.random() * 0.5, vz: car.vz - c * (4 + Math.random() * 4),
              life: core ? 0.1 + Math.random() * 0.06 : 0.16 + Math.random() * 0.12,
              size: core ? 0.28 : 0.5, grow: core ? -1.2 : -1.6,
              r: core ? 0.6 : 3.4, g: core ? 1.4 : 1.1, b: core ? 3.4 : 0.25, a: 1, drag: 3,
            });
          }
        }
        this.shake = Math.max(this.shake, 0.12);
      }
    }
    this.smoke.update(dt);
    this.sparks.update(dt);
    this.dust.update(dt, this.camera.position.x, this.camera.position.z);

    // rastros das lanternas
    const trailStrength = THREE.MathUtils.clamp((car.speed - 16) / 30, 0, 0.7) * (1 - Math.min(1, Math.abs(car.slipAngle) * 1.5)) * (this.camMode === 'hood' ? 0 : 1);
    rig.tailLocal.forEach((p, i) => {
      toWorld(p.x, p.y, p.z, this.tmpV2);
      this.trails[i]!.update(this.tmpV2, this.camera, trailStrength);
    });
  }

  private updateCamera(dt: number): void {
    const car = this.car;
    const portrait = this.camera.aspect < 1;
    // em drift a câmera acompanha a direção do movimento (mostra o carro de lado)
    let targetYaw = car.heading;
    if (car.speed > 4 && car.vLong > -1) {
      const velYaw = Math.atan2(car.vx, car.vz);
      let d = velYaw - car.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      targetYaw = car.heading + d * 0.62;
    }
    if (!this.hud.started && !this.autopilot) targetYaw = car.heading + Math.PI * 0.85 + Math.sin(this.time * 0.15) * 0.8;
    let dy = targetYaw - this.camYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const yawRate = this.camMode === 'hood' ? 14 : 4.2;
    this.camYaw += dy * (1 - Math.exp(-yawRate * dt));

    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    const speedK = Math.min(1, car.speed / 60);
    let dist: number, height: number, lookAhead: number, lookH: number;
    if (this.camMode === 'far') {
      dist = portrait ? 10 : 9; height = portrait ? 3.6 : 3.3; lookAhead = 5; lookH = 1;
    } else if (this.camMode === 'hood') {
      dist = -0.2; height = 1.25; lookAhead = 20; lookH = 0.9;
    } else {
      dist = portrait ? 6.6 : 5.8; height = portrait ? 2.25 : 2.0; lookAhead = 4; lookH = 1.05;
    }
    if (!this.hud.started && !this.autopilot) {
      dist = 7.5; height = 1.6;
    }
    dist += speedK * (this.camMode === 'hood' ? 0 : 1.2);
    const want = this.tmpV.set(car.x - fx * dist, this.carY + height, car.z - fz * dist);
    if (this.camMode === 'hood') {
      const hc = Math.cos(car.heading), hs = Math.sin(car.heading);
      want.set(car.x + hs * 0.35, this.carY + 1.22, car.z + hc * 0.35);
      this.camPos.copy(want);
    } else {
      const k = 1 - Math.exp(-10 * dt);
      this.camPos.lerp(want, k);
      // nunca muito longe do alvo (teleporte / reset)
      if (this.camPos.distanceTo(want) > 30) this.camPos.copy(want);
    }
    const look = this.tmpV2.set(car.x + fx * lookAhead, this.carY + lookH, car.z + fz * lookAhead);
    if (this.camMode === 'hood') look.set(car.x + Math.sin(car.heading) * lookAhead, this.carY + lookH, car.z + Math.cos(car.heading) * lookAhead);
    this.camLook.lerp(look, this.camMode === 'hood' ? 1 : 1 - Math.exp(-14 * dt));

    // luz de destaque: atrás/acima da câmera, e uma quente do lado
    this.heroLight.position.set(car.x - fx * 3.5, this.carY + 3.2, car.z - fz * 3.5);
    this.heroFill.position.set(car.x + fz * 2.5, this.carY + 1.6, car.z - fx * 2.5);

    this.shake = Math.max(0, this.shake - dt * 1.8);
    const sh = this.shake * this.shake * 0.35;
    this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * sh, this.camPos.y + (Math.random() - 0.5) * sh, this.camPos.z + (Math.random() - 0.5) * sh);
    this.camera.lookAt(this.camLook);
    if (this.camMode === 'hood') this.camera.rotateZ(-this.roll * 0.6);

    const baseFov = portrait ? 74 : 60;
    const fov = baseFov + speedK * 10 + (this.car.nitroActive ? 7 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3);
      this.camera.updateProjectionMatrix();
    }

    this.hud.update(dt, {
      speedKmh: car.speed * 3.6,
      gear: car.reversing ? 'R' : String(car.gear),
      rpm: car.rpm,
      nitro: car.nitro,
      nitroOn: car.nitroActive,
      tcs: car.wheelSpin > 0.3,
      abs: car.braking && car.speed > 5,
      esc: car.driftTarget > 0 && Math.abs(car.slipAngle) > car.driftTarget - 0.05,
      total: this.scorer.total,
      best: this.scorer.best,
      chain: this.scorer.chainValue,
      mult: this.scorer.mult,
      angle: this.scorer.angle,
      drifting: this.scorer.drifting,
      grace: this.scorer.grace / 1.8,
      heading: this.camYaw,
      x: car.x,
      z: car.z,
      carHeading: car.heading,
      target: this.missions.target(car.x, car.z),
      fitasGot: this.missions.fitas.length - this.missions.fitasLeft,
      fitasTotal: this.missions.fitas.length,
    }, this.traffic.cars, this.mapMarkers());
  }

  private markers: { x: number; z: number; c: string }[] = [];
  private mapMarkers(): { x: number; z: number; c: string }[] {
    this.markers.length = 0;
    for (const f of this.missions.fitas) if (!f.got) this.markers.push({ x: f.x, z: f.z, c: '#ffd21a' });
    const m = this.missions;
    if (m.active) {
      const cp = m.active.checkpoints[m.cp];
      if (cp) this.markers.push({ x: cp.x, z: cp.z, c: '#33e0ff' });
    } else {
      for (const r of m.rachas) this.markers.push({ x: r.start.x, z: r.start.z, c: r.done ? '#2a8aa0' : '#33e0ff' });
    }
    return this.markers;
  }

  private updateLamps(dt: number): void {
    this.lampTimer -= dt;
    const car = this.car;
    if (this.lampTimer <= 0) {
      this.lampTimer = 0.2;
      const fx = car.x + Math.sin(car.heading) * 14, fz = car.z + Math.cos(car.heading) * 14;
      const lamps = this.meshes.lampLights;
      const n = this.lampPool.length;
      const best: { p: THREE.Vector3; d: number }[] = [];
      for (const p of lamps) {
        const d = (p.x - fx) ** 2 + (p.z - fz) ** 2;
        if (best.length < n + 1 || d < best[best.length - 1]!.d) {
          best.push({ p, d });
          best.sort((a, b) => a.d - b.d);
          if (best.length > n + 1) best.pop();
        }
      }
      const cut = Math.sqrt(best[n]?.d ?? 1e6);
      this.lampTargets = best.slice(0, n).map((b) => ({ p: b.p, w: THREE.MathUtils.clamp((cut - Math.sqrt(b.d)) / (cut * 0.35), 0, 1) }));
      this.lampTargets.forEach((t, i) => this.lampPool[i]!.position.copy(t.p));
    }
    this.lampTargets.forEach((t, i) => {
      const l = this.lampPool[i]!;
      l.intensity += (t.w * 55 - l.intensity) * Math.min(1, dt * 8);
    });
    // neon mais perto pinta o carro e o chão molhado de cor
    const near = this.neonLights
      .map((n) => ({ n, d: Math.hypot(n.x - car.x, n.z - car.z) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.neonPool.length + 1);
    const cutN = near[this.neonPool.length]?.d ?? 40;
    this.neonPool.forEach((l, i) => {
      const t = near[i];
      if (!t) { l.intensity = 0; return; }
      if (l.userData.id !== t.n) {
        l.userData.id = t.n;
        l.position.set(t.n.x, t.n.y, t.n.z);
        l.color.copy(t.n.color);
        l.intensity = 0;
      }
      const w = THREE.MathUtils.clamp((cutN - t.d) / (cutN * 0.4), 0, 1) * THREE.MathUtils.clamp((28 - t.d) / 10, 0, 1);
      l.intensity += (w * 22 - l.intensity) * Math.min(1, dt * 6);
    });
  }
}
