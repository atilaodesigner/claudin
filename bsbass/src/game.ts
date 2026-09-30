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
import { makeCloudAtlas, Particles, DustMotes } from './fx/particles';
import { LightTrail, SkidMarks } from './fx/trails';
import { Doodle, Doodles } from './fx/doodles';
import { WetReflection, NO_REFLECT } from './fx/wet';
import { GuideLine, offsetRight } from './fx/guide';
import { worldAt } from './campaign/routes';
import { prepareCar } from './car/gltfCar';
import { buildGltfRig, trafficLights } from './car/gltfRig';
import { CONE_VERTS, Rain, buildLightCones } from './fx/rain';
import { Breakables } from './world/breakables';
import { PRESETS, autoPreset, loadSettings, lowerPreset, saveSettings, type Preset, type Settings } from './settings';
import { buildNeon } from './world/neon';
import { buildProps } from './world/props';
import { buildTrees } from './world/trees';
import type { Assets } from './assets';
import { AudioSystem } from './audio/audio';
import { Radio } from './audio/radio';
import { Input, type Action } from './input';
import { Hud, fmt, type MapMarker } from './ui/hud';
import { Campaign, type OwnCar } from './campaign/campaign';

/** cor de fábrica, apelido e jeito de cada carro do jogador (id do manifesto) */
const OWN_LOOK: Record<string, { color: string; tag: string; mods?: OwnCar['mods'] }> = {
  corvette: { color: '#b3121c', tag: 'Motor central, V8', mods: { power: 1.12, drag: 0.95, grip: 1.04 } },
  camaro: { color: '#101f52', tag: 'Muscle car, torque bruto', mods: { power: 1.18, drag: 1.02, grip: 0.95 } },
  porsche: { color: '#f2c200', tag: 'Traseira colada, precisão', mods: { power: 1.06, drag: 0.97, grip: 1.12 } },
};
const ownOrder = (id: string) => {
  const i = Object.keys(OWN_LOOK).indexOf(id);
  return i < 0 ? 99 : i;
};
import { MODELS as CAMPAIGN_MODELS, REAL as REAL_MODELS } from './campaign/models';
import type { SiteRig } from './campaign/siteRig';

const THEME_LABEL = '<b>ABERTURA</b> Um Grave Romance — tribo da periferia';
const STEP = 1 / 120;
const SAVE_KEY = 'bsbass-drift-save-v1';
/** gotas de chuva: base (preset alto) e máximo alocado (ultra) */
const RAIN_BASE = 3600;
const RAIN_MAX = 4800;
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
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAberr: { value: 0.0015 }, uVignette: { value: 0.55 }, uGrain: { value: 0.045 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uAberr; uniform float uVignette; uniform float uGrain;
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
      col += (hash(vUv * 1024.0 + fract(uTime) * 91.0) - 0.5) * uGrain;
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
  /** linha guia no chão (missão e racha) */
  private guide = new GuideLine();
  readonly traffic: Traffic;
  private smoke: Particles;
  private sparks: Particles;
  private dust: DustMotes;
  private skids = new SkidMarks();
  private trails: LightTrail[] = [];
  private headTrails: LightTrail[] = [];
  readonly doodles = new Doodles();
  private dT = { nitro: 0, speed: 0, drift: 0, wing: 0, burn: 0, color: 0 };
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
  // câmera livre: mouse mexendo (PC) ou dedo arrastando na tela (celular)
  private orbitYaw = 0;
  private orbitPitch = 0;
  private orbitIdle = 99;
  private dragId: number | null = null;
  private dragX = 0;
  private dragY = 0;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private shake = 0;
  private carY = 0;
  private roll = 0;
  private pitch = 0;
  private save: Save;
  private started = false;
  private crashCd = 0;
  private prevThrottle = 0;
  private prevGear = 1;
  private popFlash = 0;
  private autopilot: ((t: number) => Partial<import('./physics/car').CarInput>) | null = null;
  private frameTimes: number[] = [];
  private pixelRatio: number;
  private touch: boolean;
  settings: Settings;
  /** preset em uso (no modo auto, o que o ajuste automático escolheu) */
  preset: Preset;
  private cones: THREE.Mesh;
  /** poste, lixeira, hidrante... que o carro derruba */
  private breakables!: Breakables;
  private fpsAvg = 60;
  private lastSaveAt = 0;
  /** capítulos + ferro-velho (só existe se os modelos do BSBASS THE GAME carregaram) */
  campaign: Campaign | null = null;
  private mustangRig!: MustangRig;
  private ownCars: OwnCar[] = [];
  private camOverride = false;

  constructor(container: HTMLElement, hudParent: HTMLElement, assets: Assets = { photos: {}, tex: {}, models: {}, cars: [] }) {
    const touch = matchMedia('(pointer: coarse)').matches;
    this.touch = touch;
    this.settings = loadSettings();
    this.preset = this.settings.preset === 'auto' ? autoPreset(touch) : this.settings.preset;
    this.renderer = new THREE.WebGLRenderer({ antialias: !touch, powerPreference: 'high-performance' });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, PRESETS[this.preset].pixelRatio);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.bindOrbit(this.renderer.domElement);

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
    const realTrees = !!(assets.tex.bark && assets.tex.leaves);
    this.meshes = buildCityMeshes(this.city, tx, assets.tex, hasProps, realTrees);
    this.scene.add(this.meshes.group);
    if (realTrees) this.scene.add(buildTrees(this.city, assets.tex.bark!, assets.tex.leaves!));
    const props = hasProps ? buildProps(this.city, assets.models, this.preset === 'baixa') : null;
    if (props) {
      this.scene.add(props.group);
      for (const c of props.colliders) this.grid.insert(c);
    }

    // asfalto molhado com reflexo de verdade
    this.reflScale = PRESETS[this.preset].reflection || 0.3;
    this.wet = new WetReflection(this.reflScale);
    for (const name of ['asphalt', 'ground', 'sidewalk', 'marks', 'pools', 'lampPools', 'dirt']) {
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
    this.cones = buildLightCones(this.meshes.lampLights);
    this.cones.layers.set(NO_REFLECT);
    this.scene.add(this.cones);
    this.breakables = new Breakables(this.grid, (x, z) => surfaceAt(this.city, x, z).height, {
      sparks: (x, y, z, n) => {
        for (let i = 0; i < n; i++) {
          this.sparks.emit({
            x, y, z, vx: (Math.random() - 0.5) * 7, vy: Math.random() * 4, vz: (Math.random() - 0.5) * 7,
            life: 0.3 + Math.random() * 0.5, size: 0.12, grow: -0.1, r: 3, g: 1.7, b: 0.5, a: 1, drag: 1, gravity: 12,
          });
        }
      },
      water: (x, y, z) => {
        // hidrante estourado: jato d'água
        if (Math.random() < 0.6) {
          this.smoke.emit({
            x: x + (Math.random() - 0.5) * 0.15, y, z: z + (Math.random() - 0.5) * 0.15,
            vx: (Math.random() - 0.5) * 1.2, vy: 5.5 + Math.random() * 2, vz: (Math.random() - 0.5) * 1.2,
            life: 0.9 + Math.random() * 0.4, size: 0.16, grow: 0.45, r: 0.7, g: 0.8, b: 0.9, a: 0.22, drag: 0.4, gravity: 9,
          });
        }
      },
      sound: (v) => this.audio.crash(v),
    });
    this.breakables.addLamps(this.meshes.lampInst, this.meshes.lampLights.length, this.meshes.wires);
    if (props) this.breakables.addProps(props.breakables, props.parts);
    this.breakables.setCones(this.cones, CONE_VERTS);
    this.rain = new Rain(RAIN_MAX);
    this.rain.lines.layers.set(NO_REFLECT);
    this.scene.add(this.rain.lines);

    // ---------- carro ----------
    let env: THREE.Texture;
    if (assets.env) {
      // HDRI de verdade (rua à noite com luz de sódio) pros reflexos
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      env = pmrem.fromEquirectangular(assets.env).texture;
      pmrem.dispose();
      this.scene.environment = env;
      this.scene.environmentIntensity = 0.05;
    } else {
      env = this.makeEnvMap();
    }
    // carros do jogador (GLB do manifesto); sem eles, o Mustang procedural
    this.ownCars = assets.cars
      .filter((c) => c.entry.role === 'player')
      .map((c) => {
        const look = OWN_LOOK[c.entry.id] ?? { color: '#16338a', tag: 'Esportivo' };
        return { id: c.entry.id, name: c.entry.name, tag: look.tag, color: look.color, mods: look.mods, rig: buildGltfRig(prepareCar(c.scene, c.entry), env, look.color) };
      })
      .sort((a, b) => ownOrder(a.id) - ownOrder(b.id));
    this.rig = this.ownCars[0]?.rig ?? buildMustang(env);
    if (assets.env) {
      // o HDRI real é bem mais forte que o ambiente sintético
      for (const r of this.ownCars.length ? this.ownCars.map((c) => c.rig) : [this.rig]) {
        r.root.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] | undefined;
          for (const mm of Array.isArray(m) ? m : m ? [m] : []) if (mm.envMap) mm.envMapIntensity *= 0.22;
        });
      }
    }
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
    this.guide.mesh.layers.set(NO_REFLECT);
    this.scene.add(this.guide.mesh);
    this.traffic = new Traffic(touch ? 22 : 30, 7, assets.cars.filter((c) => c.entry.role === 'traffic'));
    this.scene.add(this.traffic.group);
    // fumaça de pneu, poeira e batida: nuvens "brócolis" de desenho
    this.smoke = new Particles(900, makeCloudAtlas(), false, true);
    this.sparks = new Particles(400, tx.glow, true);
    this.dust = new DustMotes(tx.glow);
    this.scene.add(this.smoke.points, this.sparks.points, this.dust.points, this.skids.mesh);
    for (const o of [this.smoke.points, this.dust.points, this.skids.mesh]) o.layers.set(NO_REFLECT);
    for (let i = 0; i < 2; i++) {
      // rastro longo das lanternas (estilo Unbound) e dos faróis
      const t = new LightTrail(44, new THREE.Color(2.2, 0.06, 0.04), 0.055);
      this.trails.push(t);
      this.scene.add(t.mesh);
      const h = new LightTrail(30, new THREE.Color(1.4, 1.45, 1.8), 0.045);
      this.headTrails.push(h);
      this.scene.add(h.mesh);
    }
    this.scene.add(this.doodles.points);
    this.doodles.points.layers.set(NO_REFLECT);
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
      // a música de abertura continua na partida; a rádio espera ela acabar
      if (this.themePlaying()) {
        this.radio.on = false;
        this.hud.themeLabel = THEME_LABEL;
      }
      this.radio.start();
      this.hud.renderRadio();
    };
    this.hud.onPauseChange = (p) => {
      this.input.enabled = !p;
    };
    this.hud.onVolumes = (car, music) => {
      this.audio.setVolumes(car, music);
      if (this.theme) this.theme.volume = music;
      this.save.vol = { car, music };
      this.persist();
    };
    this.hud.onMute = (m) => {
      this.audio.setMuted(m);
      if (this.theme) this.theme.muted = m;
    };
    this.hud.onRestart = () => {
      try { localStorage.removeItem(SAVE_KEY); } catch { /* sem storage */ }
      location.reload();
    };
    this.hud.setCarCredits(assets.cars.map((c) => c.entry));
    this.hud.settings = this.settings;
    this.hud.onControl = async (c) => {
      if (c === 'buttons') {
        this.input.disableTilt();
        return true;
      }
      if (!(await this.input.enableTilt())) return false;
      // sem leitura do sensor em 1,2 s (PC, aparelho sem giroscópio): desiste
      for (let t = 0; t < 12 && !this.input.tiltAlive; t++) await new Promise((r) => setTimeout(r, 100));
      if (!this.input.tiltAlive) this.input.disableTilt();
      return this.input.tiltAlive;
    };
    // escolheu girar antes: no Android liga direto (no iPhone espera o toque do BORA!)
    if (this.settings.control === 'tilt' && matchMedia('(pointer: coarse)').matches) void this.input.enableTilt();
    this.hud.camMode = this.camMode;
    this.hud.onCamera = (m) => this.setCam(m as CamMode);
    this.hud.setVolumeBar('car', this.save.vol.car);
    this.hud.setVolumeBar('music', this.save.vol.music);
    this.hud.activePreset = this.preset;
    this.hud.onSettings = (st) => {
      this.settings = st;
      saveSettings(st);
      if (st.preset !== 'auto') this.preset = st.preset;
      else this.preset = autoPreset(this.touch);
      this.applySettings();
    };
    this.applySettings();
    this.refreshObjectives();
    this.input.on((a) => this.onAction(a));
    this.mustangRig = this.rig;
    // caminhão das missões: Scania com carreta (GLB) no lugar do de desenho
    const truck = assets.cars.find((c) => c.entry.role === 'truck');
    if (truck) {
      const p = prepareCar(truck.scene, truck.entry);
      p.root.add(trafficLights(p));
      REAL_MODELS.truck = p.root;
    }
    if (CAMPAIGN_MODELS.car1 && CAMPAIGN_MODELS.jCrane) this.buildCampaign(hudParent, assets);

    window.addEventListener('resize', () => this.resize());
    this.resize();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.hud.started) this.hud.setPaused(true);
    });
  }

  private buildCampaign(hudParent: HTMLElement, assets: Assets): void {
    const digitKeys = new Map<string, number>();
    window.addEventListener('keydown', (e) => {
      const m = /^Digit([1-9])$/.exec(e.code);
      if (m) digitKeys.set('d', Number(m[1]));
    });
    this.campaign = new Campaign({
      scene: this.scene,
      car: this.car,
      audio: this.audio,
      camera: this.camera,
      grid: this.grid,
      ui: hudParent,
      touch: this.touch,
      mustangRig: this.mustangRig,
      ownCars: this.ownCars,
      barrierModel: assets.models.concrete_road_barrier ?? null,
      getRig: () => this.rig,
      setRig: (r) => this.setRig(r),
      setOpenWorld: (on) => {
        this.traffic.group.visible = on;
        this.missions.group.visible = on;
        if (!on && this.missions.active) {
          this.missions.cancelRace();
          this.hud.race(null);
        }
        this.hud.setMissionPause(!on);
      },
      banner: (t, sub, time, cls) => this.hud.banner(t, sub, time, cls),
      reduceFx: () => !this.settings.shake,
      particles: () => PRESETS[this.preset].particles,
      input: () => {
        const d = digitKeys.get('d') ?? 0;
        digitKeys.delete('d');
        return { throttle: this.input.state.throttle, handbrake: this.input.state.handbrake, act: this.input.actHeld, map: this.input.mapHeld, digit: d };
      },
      emitFire: (p) =>
        this.sparks.emit({
          x: p.x + (Math.random() - 0.5) * 0.4, y: p.y, z: p.z + (Math.random() - 0.5) * 0.4,
          vx: (Math.random() - 0.5) * 0.6, vy: 1.4 + Math.random(), vz: (Math.random() - 0.5) * 0.6,
          life: 0.35 + Math.random() * 0.3, size: 0.55, grow: -0.6, r: 3.2, g: 1.2 + Math.random() * 0.6, b: 0.2, a: 1, drag: 1,
        }),
      resetCamera: (h) => {
        this.camYaw = h;
        this.camPos.set(this.car.x - Math.sin(h) * 6, 2.2, this.car.z - Math.cos(h) * 6);
      },
      racha: () => {
        const i = this.missions.nearRacha(this.car.x, this.car.z);
        const r = i >= 0 ? this.missions.rachas[i] : null;
        return r ? { idx: i, name: r.name, limit: r.limit, cps: r.checkpoints.length, best: r.best } : null;
      },
      startRacha: (i) => this.missions.startRace(i),
    });
    this.hud.onAbandon = () => {
      this.hud.setPaused(false);
      this.campaign?.abandon();
    };
  }

  /** troca o carro que aparece (Mustang ou um dos carros do bonde) */
  private setRig(r: MustangRig): void {
    if (r === this.rig) return;
    this.scene.remove(this.rig.root);
    this.rig = r;
    this.scene.add(r.root);
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
      if (this.hud.closeSub()) return;
      if (this.campaign?.closeMenu()) return;
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
      if (this.theme) this.theme.muted = this.audio.muted;
      this.hud.popup(this.audio.muted ? 'SEM SOM' : 'SOM LIGADO');
      return;
    }
    if (a === 'radioNext' || a === 'radioPrev') {
      if (this.hud.started && this.themePlaying()) {
        // pular a abertura: entra a rádio na estação de sempre
        this.endTheme(true);
        const st = this.radio.current;
        this.hud.popup(`${st.freq} ${st.name}`);
        return;
      }
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
    if (a === 'reset' && !this.campaign?.missionActive) this.resetCar();
    if (a === 'help') this.hud.popup('ESPAÇO = FREIO DE MÃO');
  }

  private cycleCam(): void {
    const order: CamMode[] = ['chase', 'far', 'hood'];
    this.setCam(order[(order.indexOf(this.camMode) + 1) % order.length]!);
    this.hud.popup(CAM_NAMES[this.camMode]);
  }

  private setCam(m: CamMode): void {
    if (!(m in CAM_NAMES)) return;
    this.camMode = m;
    this.hud.camMode = m;
    this.save.cam = m;
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
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.composer.setPixelRatio(this.pixelRatio);
    this.bloom.resolution.set(Math.round(w / 2), Math.round(h / 2));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.wet?.setScale(this.reflScale, w * this.pixelRatio, h * this.pixelRatio);
    this.smoke.setViewportHeight(h * this.pixelRatio, this.camera.fov);
    this.sparks.setViewportHeight(h * this.pixelRatio, this.camera.fov);
    this.doodles.setViewportHeight(h * this.pixelRatio, this.camera.fov);
  }

  private theme: HTMLAudioElement | null = null;

  /** música da abertura: toca nas logos, no menu e na partida até acabar */
  setTheme(a: HTMLAudioElement): void {
    this.theme = a;
    a.muted = this.audio.muted;
    a.addEventListener('ended', () => this.endTheme(false));
  }

  private themePlaying(): boolean {
    const a = this.theme;
    return !!a && !a.ended && !a.dataset.skipped;
  }

  /** acabou (ou o jogador pulou): some a abertura e liga a rádio */
  private endTheme(skip: boolean): void {
    if (!this.theme) return;
    if (skip) this.fadeTheme();
    else this.theme = null;
    this.hud.themeLabel = null;
    if (this.hud.started && !this.radio.on) this.radio.toggle();
    else this.hud.renderRadio();
  }

  private fadeTheme(): void {
    const a = this.theme;
    if (!a) return;
    this.theme = null;
    a.dataset.skipped = '1';
    const v0 = a.volume;
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 1800);
      a.volume = v0 * (1 - k);
      if (k < 1) requestAnimationFrame(step);
      else a.pause();
    };
    step();
  }

  /**
   * Compila todos os shaders (cena, reflexo, pós) antes de mostrar o jogo,
   * pra não travar no primeiro frame nem quando um carro entra na tela.
   */
  async warmup(): Promise<void> {
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } catch {
      /* navegador sem compilação paralela: o primeiro frame compila */
    }
    this.frame(1 / 60);
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
    const cm = this.campaign;
    const inMission = !!cm && cm.missionActive;
    // câmera lenta das batidas/cinemáticas da missão vale pra física também
    const simDt = inMission && playing ? dt * cm!.mission.timeScale(dt) : dt;
    if ((inMission && !cm!.mission.controls()) || cm?.menuOpen) {
      input.throttle = input.brake = input.steer = 0;
      input.handbrake = input.nitro = false;
    }
    if (this.autopilot) Object.assign(input, { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false }, this.autopilot(this.time));
    if (!this.hud.started && !this.autopilot) {
      input.throttle = input.brake = input.steer = 0;
      input.handbrake = input.nitro = false;
    }

    if (playing || this.autopilot) {
      // na intro/cinemática da missão o carro é colocado pelo roteiro (sem física)
      const scripted = inMission && cm!.mission.state !== 'play' && !(cm!.mission.state === 'result' && cm!.mission.player.dead);
      this.acc += simDt;
      let steps = 0;
      while (this.acc >= STEP && steps < 8) {
        if (!scripted) this.physicsStep(input);
        else this.car.wheelRot += (this.car.vLong / 0.35) * STEP;
        this.acc -= STEP;
        steps++;
      }
      this.breakables.update(simDt, this.carRect, this.car.vx, this.car.vz);
      if (inMission) {
        cm!.mission.step(simDt, this.camera);
        if (cm!.mission.state === 'result' && !cm!.mission.player.dead) {
          // resultado: o carro para devagar onde estava
          this.car.vx *= Math.exp(-2 * dt);
          this.car.vz *= Math.exp(-2 * dt);
        }
      } else {
        this.gameplay(dt);
        this.traffic.update(dt, this.car, this.camera.position);
        this.trafficCollisions();
      }
      cm?.update(dt);
    }

    this.updateVisuals(dt, playing || !!this.autopilot);
    this.updateCamera(dt);
    this.updateLamps(dt);
    // ligou a rádio pelo player com a abertura tocando: a abertura dá lugar
    if (this.theme && this.hud.started && this.radio.on) this.endTheme(true);

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
    this.grade.uniforms.uAberr!.value = this.settings.lens ? 0.0012 + (this.car.nitroActive ? 0.004 : 0) + Math.min(0.004, this.shake * 0.01) : 0;
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
    this.fpsAvg = 1 / Math.max(avg, 1e-3);
    if (this.settings.fps) this.hud.setFps(this.fpsAvg, this.preset);
    // só o modo AUTO mexe sozinho; o jogador que escolheu preset manda
    if (this.settings.preset !== 'auto' || avg < 0.024) return;
    const lower = lowerPreset(this.preset);
    if (lower) {
      this.preset = lower;
      this.applySettings();
    } else if (this.pixelRatio > 0.6) {
      this.pixelRatio = Math.max(0.6, this.pixelRatio - 0.15);
      this.resize();
    }
  }

  /** aplica preset + opções sem recarregar a página */
  applySettings(): void {
    const q = PRESETS[this.preset];
    const st = this.settings;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, q.pixelRatio);
    this.wet.enabled = q.reflection > 0;
    if (q.reflection > 0) this.reflScale = q.reflection;
    else {
      // sem reflexo: limpa a imagem velha pro asfalto ficar só escuro/molhado
      this.renderer.setRenderTarget(this.wet.target);
      this.renderer.setClearColor(0x0a0810, 1);
      this.renderer.clear();
      this.renderer.setRenderTarget(null);
      this.renderer.setClearColor(0x000000, 1);
    }
    this.bloom.enabled = q.bloom;
    this.rain.lines.visible = st.rain;
    this.rain.setDensity((q.rain * RAIN_BASE) / RAIN_MAX);
    this.cones.visible = q.cones;
    this.smoke.density = this.sparks.density = q.particles;
    this.doodles.enabled = st.doodles;
    this.doodles.points.visible = st.doodles;
    for (const t of [...this.trails, ...this.headTrails]) t.mesh.visible = st.trails;
    this.grade.uniforms.uGrain!.value = st.lens ? 0.045 : 0;
    this.setLightPool(this.lampPool, q.lamps, () => new THREE.PointLight(0xff9a45, 0, 30, 1.6));
    this.setLightPool(this.neonPool, q.neon, () => new THREE.PointLight(0xffffff, 0, 16, 1.6));
    this.lampTimer = 0;
    this.lampTargets = [];
    this.hud.activePreset = this.preset;
    this.hud.showFps(st.fps);
    this.resize();
  }

  private setLightPool(pool: THREE.PointLight[], n: number, make: () => THREE.PointLight): void {
    while (pool.length > n) {
      const l = pool.pop()!;
      this.scene.remove(l);
      l.dispose();
    }
    while (pool.length < n) {
      const l = make();
      this.scene.add(l);
      pool.push(l);
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
      const br = this.breakables.get(sh);
      if (br) {
        // poste, lixeira, hidrante...: rápido o bastante, derruba e segue (perde só o impulso que o objeto leva)
        const vn = -(car.vx * c.nx + car.vz * c.nz);
        if (vn >= this.breakables.minV(sh)) {
          const impact = resolve(car, CAR.mass, CAR.inertia, c, 0, 0.1, this.breakables.massOf(sh));
          this.carRect.x = car.x;
          this.carRect.z = car.z;
          this.onBreak(sh, impact, c);
          continue;
        }
      }
      const impact = resolve(car, CAR.mass, CAR.inertia, c, 0.18, 0.4);
      this.carRect.x = car.x;
      this.carRect.z = car.z;
      if (impact > 0) this.onImpact(impact, c.px, c.pz);
    }
  }

  private onBreak(sh: Shape, v: number, c: { nx: number; nz: number; px: number; pz: number }): void {
    const lamp = this.breakables.isLamp(sh);
    this.breakables.hit(sh, this.car.vx, this.car.vz, c.nx, c.nz, v);
    if (lamp) {
      this.shake = Math.min(1, this.shake + 0.25);
      this.lampTimer = 0; // apaga a luz de verdade na hora
      // na missão o poste ainda amassa um pouco o carro (bem menos que parede)
      if (this.campaign?.missionActive) this.campaign.mission.contact(v * 0.35, 'wall');
    } else {
      this.shake = Math.min(1, this.shake + Math.min(0.12, v * 0.02));
    }
  }

  private onImpact(v: number, px: number, pz: number): void {
    if (this.campaign?.missionActive) this.campaign.mission.contact(v, 'wall');
    if (v < 2.5 || this.crashCd > 0) return;
    this.crashCd = 0.35;
    this.audio.crash(v);
    this.shake = Math.min(1, this.shake + v * 0.05);
    if (v > 5) this.burst('crash', px, 0.3, pz);
    for (let i = 0; i < Math.min(40, v * 3); i++) {
      this.sparks.emit({
        x: px, y: 0.5 + Math.random() * 0.4, z: pz,
        vx: (Math.random() - 0.5) * 8, vy: Math.random() * 5, vz: (Math.random() - 0.5) * 8,
        life: 0.3 + Math.random() * 0.4, size: 0.12, grow: -0.1, r: 3, g: 1.6, b: 0.4, a: 1, drag: 1, gravity: 12,
      });
    }
    if (v > 7 && !this.campaign?.missionActive) {
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
            this.burst('near', this.car.x, 0, this.car.z);
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
    // ferro-velho é lugar seguro: não conta ponto
    const safe = !!this.campaign?.inYard;
    const ev = this.scorer.update(dt, {
      speedKmh: safe ? 0 : kmh,
      angleDeg: Math.abs(car.slipAngle) * (180 / Math.PI),
      forward: car.vLong > 0,
      surface: car.surfaceGrip,
    });
    car.addNitro(this.scorer.nitroGain);
    for (const e of ev) {
      if (e.type === 'bank') {
        this.hud.bank(e.points, e.label);
        this.audio.bank(e.points > 5000);
        if (e.points > 1500) this.burst('bank', car.x, 0, car.z);
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
    (rig as Partial<SiteRig>).update?.(dt, car.vLong);
    if (this.campaign?.missionActive) {
      // perdeu o carro: capota no ar como no original
      const pl = this.campaign.mission.playerLift();
      rig.root.position.y += pl.lift;
      rig.body.rotation.z += pl.roll;
    }
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
      // pipoco no escapamento: tirou o pé em giro alto, ou troca de marcha no talo
      const lift = this.prevThrottle > 0.7 && car.throttle < 0.2 && car.rpm > 4200;
      const shift = car.gear > this.prevGear && car.throttle > 0.8;
      if (lift || shift) {
        const n = lift ? 2 + Math.floor(Math.random() * 3) : 1;
        this.audio.pops(n);
        this.popFlash = lift ? 0.35 : 0.12;
      }
      this.prevThrottle = car.throttle;
      this.prevGear = car.gear;
      if (this.popFlash > 0) {
        this.popFlash -= dt;
        if (Math.random() < 0.5) {
          for (const e of rig.exhausts) {
            toWorld(e.x, e.y, e.z, this.tmpV);
            this.sparks.emit({
              x: this.tmpV.x, y: this.tmpV.y, z: this.tmpV.z,
              vx: car.vx - s * 3, vy: 0.3, vz: car.vz - c * 3,
              life: 0.07, size: 0.32, grow: -1, r: 3.6, g: 1.5, b: 0.3, a: 1, drag: 4,
            });
          }
        }
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

    // rastros de luz: lanternas (vermelho) e faróis (branco)
    const trailBase = THREE.MathUtils.clamp((car.speed - 8) / 18, 0, 1) * (this.camMode === 'hood' ? 0 : 1);
    rig.tailLocal.forEach((p, i) => {
      toWorld(p.x, p.y, p.z, this.tmpV2);
      this.trails[i]!.update(this.tmpV2, this.camera, trailBase * 0.95);
    });
    const headBase = THREE.MathUtils.clamp((car.speed - 14) / 20, 0, 1) * (car.nitroActive || this.scorer.drifting ? 1 : 0.55) * (this.camMode === 'hood' ? 0 : 1);
    this.headTrails.forEach((t, i) => {
      toWorld(i === 0 ? 0.6 : -0.6, 0.72, 2.45, this.tmpV2);
      t.update(this.tmpV2, this.camera, headBase * 0.8);
    });

    if (active) this.emitDoodles(dt, toWorld, c, s);
    this.doodles.update(dt, this.time);
  }

  // cores chapadas (≤ 1): traço de desenho, sem brilho de bloom
  private dColors = [new THREE.Color(0.15, 0.8, 0.85), new THREE.Color(0.85, 0.2, 0.6), new THREE.Color(0.9, 0.75, 0.1)];
  private dWhite = new THREE.Color(0.85, 0.85, 0.85);
  private dTeal = new THREE.Color(0.2, 0.85, 0.75);
  private dYellow = new THREE.Color(0.9, 0.78, 0.1);

  /** rabiscos estilo Unbound: nitro, drift, patinada */
  private emitDoodles(dt: number, toWorld: (x: number, y: number, z: number, out: THREE.Vector3) => THREE.Vector3, c: number, s: number): void {
    const car = this.car;
    const T = this.dT;
    for (const k of Object.keys(T) as (keyof typeof T)[]) if (k !== 'color') T[k] -= dt;
    const fwdX = s, fwdZ = c;
    const v = this.tmpV;
    // nitro: chama rabiscada ciano nas ponteiras + linhas de velocidade
    if (car.nitroActive) {
      if (T.nitro <= 0) {
        T.nitro = 0.06;
        for (const e of [this.rig.exhausts[0]!, this.rig.exhausts[2]!]) {
          toWorld(e.x, e.y + 0.05, e.z - 0.35, v);
          this.doodles.emit(Doodle.Flame, v.x, v.y, v.z, car.vx * 0.6 - fwdX * 5, 0.2, car.vz * 0.6 - fwdZ * 5, 0.5, 0.26, this.dTeal, { rot: Math.PI + (Math.random() - 0.5) * 0.4, grow: 0.3 });
        }
      }
      if (T.speed <= 0) {
        T.speed = 0.11;
        const side = Math.random() < 0.5 ? -1 : 1;
        toWorld(side * (1.4 + Math.random() * 0.8), 0.6 + Math.random() * 0.9, -1 - Math.random() * 2, v);
        this.doodles.emit(Doodle.Speed, v.x, v.y, v.z, car.vx * 0.5 - fwdX * 8, 0, car.vz * 0.5 - fwdZ * 8, 0.85, 0.24, this.dWhite, { rot: (Math.random() - 0.5) * 0.3, alpha: 0.85 });
        if (Math.random() < 0.25) {
          toWorld(side * 1.2, 1.1, -2.6, v);
          this.doodles.emit(Doodle.Bolt, v.x, v.y, v.z, car.vx * 0.4, 0.3, car.vz * 0.4, 0.6, 0.3, this.dTeal, { rot: (Math.random() - 0.5) * 0.8 });
        }
      }
    }
    // drift: nuvens rabiscadas saindo da traseira + asa quando o ângulo é grande
    if (this.scorer.drifting && car.rearSlip > 0.35) {
      if (T.drift <= 0) {
        T.drift = 0.1;
        T.color = (T.color + 1) % 3;
        const wx = Math.random() < 0.5 ? 0.9 : -0.9;
        toWorld(wx, 0.5, -1.6, v);
        this.doodles.emit(Doodle.Cloud, v.x, v.y, v.z, car.vx * 0.25, 0.7, car.vz * 0.25, 0.6 + Math.random() * 0.25, 0.55, this.dColors[T.color]!, { grow: 0.9, spin: (Math.random() - 0.5) * 2 });
      }
      if (this.scorer.angle > 32 && T.wing <= 0) {
        T.wing = 0.45;
        const out = car.slipAngle > 0 ? -1 : 1; // lado de fora da curva
        toWorld(out * 1.6, 1.2, -0.4, v);
        this.doodles.emit(Doodle.Wing, v.x, v.y, v.z, car.vx * 0.85, 0.4, car.vz * 0.85, 1.05, 0.42, this.dWhite, { rot: out > 0 ? 0 : Math.PI, grow: 0.2 });
      }
    }
    // patinada / arrancada: espiral e estrelinhas nas rodas
    if (car.wheelSpin > 0.35 && car.speed < 14 && T.burn <= 0) {
      T.burn = 0.12;
      const wx = Math.random() < 0.5 ? 0.9 : -0.9;
      toWorld(wx, 0.4, -1.5, v);
      this.doodles.emit(Math.random() < 0.6 ? Doodle.Swirl : Doodle.Star, v.x, v.y, v.z, (Math.random() - 0.5) * 2, 1, (Math.random() - 0.5) * 2, 0.5, 0.45, this.dWhite, { spin: 4 });
    }
  }

  /** estouro de rabiscos num ponto (batida, raspada, combo) */
  burst(kind: 'crash' | 'near' | 'bank', x: number, y: number, z: number): void {
    const d = this.doodles;
    if (kind === 'crash') {
      d.emit(Doodle.Star, x, y + 0.6, z, 0, 1.2, 0, 0.8, 0.45, this.dYellow, { spin: 3 });
      d.emit(Doodle.Bolt, x + 0.4, y + 0.9, z, 0, 1, 0, 0.6, 0.4, this.dWhite);
    } else if (kind === 'near') {
      d.emit(Doodle.Ring, x, y + 1.8, z, 0, 0.6, 0, 0.7, 0.5, this.dYellow, { grow: 0.6 });
    } else {
      d.emit(Doodle.Ring, x, y + 2.4, z, 0, 1, 0, 1.3, 0.7, this.dYellow, { grow: 0.7 });
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        d.emit(Doodle.Star, x + Math.cos(a) * 1.5, y + 1.8, z + Math.sin(a) * 1.5, Math.cos(a) * 3, 2, Math.sin(a) * 3, 0.45, 0.6, this.dColors[k % 3]!, { spin: 5 });
      }
    }
  }

  private camTgtPos = new THREE.Vector3();
  private camTgtLook = new THREE.Vector3();

  /** girar a câmera em volta do carro: mexendo o mouse ou arrastando o dedo na tela */
  private bindOrbit(cv: HTMLCanvasElement): void {
    cv.style.touchAction = 'none';
    const can = () => this.settings.orbit && this.hud.started && !this.hud.paused && !this.camOverride;
    // mouse: só por cima da cena (em cima de botão do HUD não gira)
    window.addEventListener('mousemove', (e) => {
      if (e.target === cv && can()) this.orbitBy(e.movementX, e.movementY, 0.0042);
    });
    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || this.dragId !== null) return;
      this.dragId = e.pointerId;
      this.dragX = e.clientX;
      this.dragY = e.clientY;
    });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.dragId) return;
      const dx = e.clientX - this.dragX, dy = e.clientY - this.dragY;
      this.dragX = e.clientX;
      this.dragY = e.clientY;
      if (can()) this.orbitBy(dx, dy, 0.009);
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId === this.dragId) this.dragId = null;
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  private orbitBy(dx: number, dy: number, k: number): void {
    if (!dx && !dy) return;
    this.orbitYaw -= dx * k;
    if (this.orbitYaw > Math.PI) this.orbitYaw -= Math.PI * 2;
    if (this.orbitYaw < -Math.PI) this.orbitYaw += Math.PI * 2;
    this.orbitPitch = THREE.MathUtils.clamp(this.orbitPitch + dy * k * 0.6, -0.12, 0.75);
    this.orbitIdle = 0;
  }

  private updateCamera(dt: number): void {
    const car = this.car;
    const portrait = this.camera.aspect < 1;
    const cm = this.campaign;
    if (cm?.missionActive && cm.mission.cameraTarget(this.camTgtPos, this.camTgtLook)) {
      // cinemática do capítulo: câmera do roteiro original
      const k = 1 - Math.exp(-2 * dt);
      if (!this.camOverride) {
        this.camOverride = true;
      }
      this.camPos.lerp(this.camTgtPos, k);
      this.camLook.lerp(this.camTgtLook, 1 - Math.exp(-2.6 * dt));
      const sh = this.settings.shake ? cm.mission.shake * 0.35 : 0;
      cm.mission.shake = Math.max(0, cm.mission.shake - dt * 2.6);
      this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * sh, this.camPos.y + (Math.random() - 0.5) * sh, this.camPos.z + (Math.random() - 0.5) * sh);
      this.camera.lookAt(this.camLook);
      this.camYaw = Math.atan2(this.camLook.x - this.camPos.x, this.camLook.z - this.camPos.z);
      this.heroLight.position.set(car.x, this.carY + 3.2, car.z);
      this.updateHudOnly(dt);
      return;
    }
    if (this.camOverride) {
      this.camOverride = false;
      this.camYaw = car.heading;
    }
    if (cm?.missionActive && cm.mission.shake > 0) {
      this.shake = Math.max(this.shake, cm.mission.shake);
      cm.mission.shake = Math.max(0, cm.mission.shake - dt * 2.6);
    }
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

    // câmera livre volta sozinha pra trás do carro quando solta o mouse/dedo
    this.orbitIdle += dt;
    if (!this.hud.started || !this.settings.orbit) this.orbitYaw = this.orbitPitch = 0;
    else if (this.dragId === null && this.orbitIdle > (car.speed < 2 ? 3.5 : 1.1)) {
      const back = Math.exp(-(1.3 + Math.min(car.speed, 30) * 0.08) * dt);
      this.orbitYaw *= back;
      this.orbitPitch *= back;
    }
    const yaw = this.camYaw + this.orbitYaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
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
    const cp = Math.cos(this.orbitPitch), sp = Math.sin(this.orbitPitch);
    const want = this.tmpV.set(car.x - fx * dist * cp, this.carY + height + dist * sp, car.z - fz * dist * cp);
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
    if (this.camMode === 'hood') look.set(car.x + Math.sin(car.heading + this.orbitYaw) * lookAhead, this.carY + lookH - this.orbitPitch * 6, car.z + Math.cos(car.heading + this.orbitYaw) * lookAhead);
    this.camLook.lerp(look, this.camMode === 'hood' ? 1 : 1 - Math.exp(-14 * dt));

    // luz de destaque: atrás/acima da câmera, e uma quente do lado
    this.heroLight.position.set(car.x - fx * 3.5, this.carY + 3.2, car.z - fz * 3.5);
    this.heroFill.position.set(car.x + fz * 2.5, this.carY + 1.6, car.z - fx * 2.5);

    this.shake = Math.max(0, this.shake - dt * 1.8);
    const sh = this.settings.shake ? this.shake * this.shake * 0.35 : 0;
    this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * sh, this.camPos.y + (Math.random() - 0.5) * sh, this.camPos.z + (Math.random() - 0.5) * sh);
    this.camera.lookAt(this.camLook);
    if (this.camMode === 'hood') this.camera.rotateZ(-this.roll * 0.6);

    const baseFov = portrait ? 74 : 60;
    const fov = baseFov + speedK * 10 + (this.car.nitroActive ? 7 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3);
      this.camera.updateProjectionMatrix();
    }

    this.updateHudOnly(dt);
  }

  /** linha guia: rota do capítulo na missão, checkpoints no racha; no mundo livre some */
  private updateGuide(dt: number): void {
    const car = this.car;
    const g = this.guide;
    const cg = this.campaign?.guide();
    if (cg) {
      g.begin();
      for (let k = 0; !g.full; k++) {
        const d = k * 1.25;
        const w = Math.min(1, d / 14);
        const p = worldAt(cg.route, cg.s + d, cg.x * (1 - w * w * (3 - 2 * w)));
        g.push(p.x, p.z);
      }
      g.commit(dt, 0xffa640);
      return;
    }
    const m = this.missions;
    if (m.active) {
      const r = m.active;
      const counting = m.countdown > 0;
      const i = counting ? 0 : m.cp;
      const prev = i === 0 ? r.start : r.checkpoints[i - 1]!;
      const pts = [prev, ...r.checkpoints.slice(i, i + 4)];
      g.fromPolyline(offsetRight(pts, 3.3), car.x, car.z, `${m.activeIndex}:${i}`);
      g.commit(dt, 0x33e0ff);
      return;
    }
    g.hide();
  }

  private updateHudOnly(dt: number): void {
    this.updateGuide(dt);
    const car = this.car;
    const cm = this.campaign;
    const target = this.missions.active ? this.missions.target(car.x, car.z) : cm?.target(car.x, car.z, this.input.mapHeld) ?? this.missions.target(car.x, car.z);
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
      target: cm?.missionActive ? null : target,
      fitasGot: this.missions.fitas.length - this.missions.fitasLeft,
      fitasTotal: this.missions.fitas.length,
    }, cm?.missionActive ? [] : this.traffic.cars, this.mapMarkers(), cm?.routeLine() ?? null, this.input.mapHeld && !cm?.missionActive);
  }

  private markers: MapMarker[] = [];
  private mapMarkers(): MapMarker[] {
    this.markers.length = 0;
    if (this.campaign?.missionActive) return this.markers;
    if (this.campaign) this.markers.push(...this.campaign.markers());
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
      const dead = this.breakables.dead;
      for (let i = 0; i < lamps.length; i++) {
        if (dead[i]) continue;
        const p = lamps[i]!;
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
