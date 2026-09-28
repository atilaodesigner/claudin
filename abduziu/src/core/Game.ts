import { Color, PerspectiveCamera, Scene, Vector3, type Texture } from 'three';
import { AbductionSystem } from '../abduction/AbductionSystem';
import { ArenaSystem } from '../arena/ArenaSystem';
import { OnlineArena } from '../arena/OnlineArena';
import { ArenaNet } from '../online/ArenaNet';
import { DynamicObjectPool } from '../abduction/DynamicObjectPool';
import { loadModelOverrides } from '../assets/AssetLoader';
import { ModelLibrary } from '../assets/ModelLibrary';
import { AudioManager } from '../audio/AudioManager';
import { Haptics } from '../audio/Haptics';
import { DamageSystem } from '../combat/DamageSystem';
import { EMPSystem } from '../combat/EMPSystem';
import { ShieldSystem } from '../combat/ShieldSystem';
import { CAMPAIGN, getCity, type CityDef, type CityId } from '../config/cities';
import { BALANCE } from '../config/gameBalance';
import { META_BY_ID } from '../config/meta';
import { dailySetup, MODES, weekKey, weeklySetup, type GameMode } from '../config/modes';
import { getObjectDef, TIER_NAMES } from '../config/objects';
import { SYNERGY_BY_ID } from '../config/upgrades';
import { VFXManager } from '../effects/VFXManager';
import { WaterFX } from '../effects/WaterFX';
import { BossController } from '../enemies/BossController';
import { EnemyManager, type PlayerSnapshot } from '../enemies/EnemyManager';
import type { Missile } from '../enemies/MissileController';
import { InputManager } from '../input/InputManager';
import { AdaptiveQualityManager, detectDevice, type QualityLevel } from '../performance/AdaptiveQualityManager';
import { applyCampaignRun, isUnlocked } from '../progression/CampaignSystem';
import { MetaProgression } from '../progression/MetaProgression';
import { applyRp, divisionFor, rpDelta } from '../progression/RankSystem';
import { matterForTierThreshold } from '../progression/RunProgression';
import type { UpgradeOffer } from '../progression/UpgradeSystem';
import { UpgradeSystem } from '../progression/UpgradeSystem';
import { CameraController } from '../rendering/CameraController';
import { createEnvironmentMap } from '../rendering/Environment';
import { Lighting } from '../rendering/Lighting';
import { PostProcessing } from '../rendering/PostProcessing';
import { Renderer } from '../rendering/Renderer';
import { Clouds, Sky } from '../rendering/Sky';
import { createNoiseTexture, TextureAtlas } from '../rendering/TextureAtlas';
import { worldUniforms } from '../rendering/WorldMaterial';
import { LocalStorageBackend, MemoryBackend } from '../save/SaveBackend';
import { cloudWins, migrate, SaveService, type Settings } from '../save/SaveService';
import { TractorBeam } from '../ufo/TractorBeam';
import { UFOController } from '../ufo/UFOController';
import { UFOStats } from '../ufo/UFOStats';
import { UFOVisuals } from '../ufo/UFOVisuals';
import { friendlyError, Online } from '../online/Online';
import { AccountScreen } from '../ui/AccountScreen';
import { DebugPanel } from '../ui/DebugPanel';
import { DexScreen } from '../ui/DexScreen';
import { h } from '../ui/dom';
import { HUD, type RadarBlip } from '../ui/HUD';
import { IntroOverlay } from '../ui/IntroOverlay';
import { LoadingScreen } from '../ui/LoadingScreen';
import { MainMenu, type MenuAction } from '../ui/MainMenu';
import { MetaScreen } from '../ui/MetaScreen';
import { CityMapScreen, ModeScreen, RankScreen } from '../ui/ModeScreens';
import { PauseMenu } from '../ui/PauseMenu';
import { RecordsScreen } from '../ui/RecordsScreen';
import { ResultsScreen } from '../ui/ResultsScreen';
import { SettingsScreen } from '../ui/SettingsScreen';
import { Thumbnails } from '../ui/Thumbnails';
import { EvolutionDock } from '../ui/EvolutionDock';
import { clamp, damp, formatInt } from '../utils/math';
import { dailyKey, dailySeed } from '../utils/rng';
import { AState } from '../world/Abductable';
import { BirdSystem } from '../world/BirdSystem';
import { ChunkManager } from '../world/ChunkManager';
import { NPCSystem } from '../world/NPCSystem';
import { TrafficSystem } from '../world/TrafficSystem';
import { World } from '../world/World';
import { WorldGenerator } from '../world/WorldGenerator';
import { EventBus } from './EventBus';
import { GameLoop } from './GameLoop';
import { RunController } from './RunController';
import { Time } from './Time';
import { Rng } from '../utils/rng';

export type GameState = 'loading' | 'menu' | 'intro' | 'playing' | 'paused' | 'extracting' | 'dying' | 'results';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const _v = new Vector3();
const _v2 = new Vector3();

/**
 * Composition root and state machine. Owns every service and runs the frame.
 */
export class Game {
  readonly bus = new EventBus();
  readonly time = new Time();
  readonly scene = new Scene();
  readonly renderer: Renderer;
  readonly post: PostProcessing;
  readonly cameraCtl = new CameraController();
  readonly input: InputManager;
  readonly loop: GameLoop;
  readonly save: SaveService;
  readonly meta: MetaProgression;
  readonly audio = new AudioManager();
  readonly haptics = new Haptics();
  readonly quality: AdaptiveQualityManager;
  readonly stats = new UFOStats();
  readonly upgrades = new UpgradeSystem();
  readonly shield = new ShieldSystem();
  readonly damage: DamageSystem;
  readonly emp = new EMPSystem();
  readonly debug = new URLSearchParams(location.search).has('debug');
  state: GameState = 'loading';

  // assets & rendering
  private atlas!: TextureAtlas;
  private noise!: Texture;
  private envMap: Texture | null = null;
  /** ABDUZIU.io round (created on the first arena run). */
  arena: ArenaSystem | null = null;
  /** ARENA ONLINE (PvP room on the server). */
  pvp: OnlineArena | null = null;
  private pendingNet: ArenaNet | null = null;
  private arenaEndTimer = -1;
  lib!: ModelLibrary;
  sky!: Sky;
  clouds!: Clouds;
  lighting!: Lighting;
  vfx!: VFXManager;
  waterFx!: WaterFX;

  // per-run world
  world!: World;
  npcs!: NPCSystem;
  traffic!: TrafficSystem;
  abduction!: AbductionSystem;
  enemies!: EnemyManager;
  chunks!: ChunkManager;
  birds!: BirdSystem;
  private dynPool!: DynamicObjectPool;
  private worldDirty = false;

  // player
  ufoVisuals!: UFOVisuals;
  ufo!: UFOController;
  beam!: TractorBeam;
  run!: RunController;

  // ui
  readonly ui: HTMLElement;
  readonly hud: HUD;
  private readonly loading: LoadingScreen;
  private readonly menu: MainMenu;
  private readonly evoDock: EvolutionDock;
  private readonly results: ResultsScreen;
  private metaScreen!: MetaScreen;
  private dexScreen!: DexScreen;
  private readonly recordsScreen: RecordsScreen;
  private readonly settingsScreen: SettingsScreen;
  private readonly pauseMenu: PauseMenu;
  private readonly intro: IntroOverlay;
  private readonly modeScreen: ModeScreen;
  private readonly mapScreen: CityMapScreen;
  private readonly rankScreen: RankScreen;
  private readonly accountScreen: AccountScreen;
  readonly online = new Online();
  /** Cloud push is armed only after the first pull decided which save wins. */
  private cloudReady = false;
  private cloudTimer: ReturnType<typeof setTimeout> | null = null;
  private debugPanel: DebugPanel | null = null;
  private thumbs!: Thumbnails;
  private readonly fpsMeter: HTMLDivElement;

  private introTime = 0;
  private introSkippable = false;
  private levelUpDelay = -1;
  private endTimer = 0;
  private tutorialPhase = -1;
  private tutorialMoved = 0;
  private tutorialAbducts = 0;
  private tutorialTimer = 0;
  private settingsReturn: 'menu' | 'pause' = 'menu';
  private menuAngle = 0;
  private readonly missileScratch: Missile[] = [];
  private readonly blips: RadarBlip[] = [];
  private readonly accent = new Color(0x5dffa0);
  private godMode = false;
  private maxBeam = false;
  private autoEmpAccumulator = 0;
  private strainShownTime = 0;
  private wasDashReady = true;
  private coordsTimer = 0;
  /** Landmarks the current objectives ask for (radar markers). */
  private landmarkTargets: Array<{ alive: boolean; pos: Vector3 }> = [];
  /** City the current world was generated for. */
  private city: CityDef = getCity('nova_aurora');

  constructor(container: HTMLElement) {
    this.renderer = new Renderer(container.querySelector('#stage') as HTMLElement, {
      onContextLost: () => {
        this.loop.stop();
        this.audio.suspend();
      },
      onContextRestored: () => {
        this.loop.start();
        this.audio.resume();
      },
    });
    this.post = new PostProcessing(this.renderer.gl, this.renderer.supportsHalfFloatRT);
    this.input = new InputManager(container.querySelector('#input-layer') as HTMLElement, container.querySelector('#joystick') as HTMLElement);
    this.loop = new GameLoop((dt, now) => this.frame(dt, now));
    this.save = new SaveService(LocalStorageBackend.isAvailable() ? new LocalStorageBackend() : new MemoryBackend());
    this.meta = new MetaProgression(this.save);
    this.damage = new DamageSystem(this.shield, this.bus);
    const device = detectDevice(this.renderer.supportsMultiDraw, this.renderer.isSoftware);
    this.quality = new AdaptiveQualityManager(device);
    this.quality.onApply = (q, scale, changed) => this.applyQuality(q, scale, changed);

    this.ui = container.querySelector('#ui') as HTMLElement;
    this.hud = new HUD(this.ui);
    this.evoDock = new EvolutionDock(this.hud.root);
    this.loading = new LoadingScreen(this.ui);
    this.menu = new MainMenu(this.ui);
    this.results = new ResultsScreen(this.ui);
    this.recordsScreen = new RecordsScreen(this.ui);
    this.settingsScreen = new SettingsScreen(this.ui);
    this.pauseMenu = new PauseMenu(this.ui);
    this.intro = new IntroOverlay(this.ui);
    this.modeScreen = new ModeScreen(this.ui);
    this.mapScreen = new CityMapScreen(this.ui);
    this.rankScreen = new RankScreen(this.ui, this.online);
    this.accountScreen = new AccountScreen(this.ui, this.online);
    this.fpsMeter = h('div', 'fps-meter');
    this.ui.appendChild(this.fpsMeter);

    this.renderer.onResize((w, hgt) => {
      this.cameraCtl.resize(w, hgt);
      this.post.setSize(w, hgt, this.renderer.pixelRatio);
      this.vfx?.particles.setViewportHeight(hgt * this.renderer.pixelRatio);
      this.input.touch.setRadius(Math.max(46, Math.min(80, Math.min(w, hgt) * 0.13)));
    });
    this.wireUI();
    this.wireOnline();
    this.bus.on('object:destroyed', (e) => this.onObjectDestroyed(e.uid));
    this.applySettings(this.save.get().settings, false);
    this.renderer.resize();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.save.flush();
        if (this.state === 'playing') this.pause();
        this.audio.suspend();
      } else if (this.state !== 'loading') this.audio.resume();
    });
    window.addEventListener('pagehide', () => this.save.flush());
  }

  // ───────────────────────────────────────────── boot

  async init(): Promise<void> {
    this.loading.start();
    this.loop.start();
    await document.fonts.ready.catch(() => undefined);
    this.loading.progress(0.05);
    this.noise = createNoiseTexture();
    worldUniforms.uCloudTex.value = this.noise;
    this.atlas = new TextureAtlas();
    this.lib = new ModelLibrary(this.atlas);
    await loadModelOverrides(this.lib);
    const keys = this.lib.keys();
    for (let i = 0; i < keys.length; i++) {
      this.lib.get(keys[i] as string);
      if (i % 12 === 0) {
        this.loading.progress(0.05 + (i / keys.length) * 0.45);
        await nextFrame();
      }
    }
    this.loading.progress(0.5, 'MONTANDO A CIDADE...');
    await nextFrame();

    this.sky = new Sky(this.noise);
    this.scene.add(this.sky.mesh);
    this.clouds = new Clouds();
    this.scene.add(this.clouds.group);
    this.lighting = new Lighting(this.scene, this.sky, this.post);
    this.vfx = new VFXManager(this.scene, this.cameraCtl, this.post, this.time, this.haptics);
    this.vfx.particles.setViewportHeight(this.renderer.height * this.renderer.pixelRatio);
    this.waterFx = new WaterFX(this.noise, this.vfx.particles);
    this.scene.add(this.waterFx.group);
    const env = createEnvironmentMap(this.renderer.gl);
    this.envMap = env;
    this.ufoVisuals = new UFOVisuals(env);
    this.scene.add(this.ufoVisuals.root);
    this.beam = new TractorBeam(this.noise);
    this.scene.add(this.beam.group);
    this.scene.add(this.shield.mesh);
    this.dynPool = new DynamicObjectPool(this.scene, this.atlas.texture, 90);
    this.run = new RunController(this, this.scene);
    this.post.prePass = () => this.renderWrapCopies();
    this.thumbs = new Thumbnails(this.renderer.gl, this.lib, this.atlas);

    const params = new URLSearchParams(location.search);
    const saved = this.save.get().last.city;
    this.buildWorld(1234 + Math.floor(Math.random() * 9999), getCity(params.get('city') ?? (isUnlocked(this.save.get().campaign, saved as CityId) ? saved : 'nova_aurora')));
    this.loading.progress(0.8, 'SINCRONIZANDO SATÉLITES...');
    await nextFrame();
    this.computeStats(0);
    this.ufo.spawnAt(this.world.start.x, this.world.start.z, this.stats.altitude);
    this.cameraCtl.snapTo(this.ufo.position, this.stats.scale);
    this.quality.setPreset(this.save.get().settings.quality);

    // warm up shaders so the first abduction doesn't hitch
    try {
      await this.renderer.gl.compileAsync(this.scene, this.cameraCtl.camera);
    } catch {
      /* compileAsync may be unavailable: first frames compile instead */
    }
    this.loading.progress(1, 'SINAL LOCALIZADO');
    if (this.debug) this.createDebug();
    await nextFrame();
    // the boot motion plays its outro over the menu, which is already alive behind it
    void this.loading.finish();
    this.enterMenu();
    // restore a session / finish a login redirect without holding the boot
    if (Online.shouldBootEagerly()) void this.online.init();
    if (params.has('autostart')) void this.startRun((params.get('mode') as GameMode | null) ?? 'campanha', params.get('city') as CityId | null);
  }

  private buildWorld(seed: number, city: CityDef = this.city, wrap = false): void {
    this.city = city;
    this.atlas.applyCity(city.signs, city.billboards, city.labels);
    this.lighting.setCity(city.look);
    this.waterFx?.setWaterColor(city.look.water[1]);
    this.waterFx?.clear();
    if (this.world) {
      this.abduction.reset();
      this.enemies.dispose();
      this.birds.dispose();
      this.world.dispose();
    }
    const gen = new WorldGenerator(this.lib, this.atlas, seed, city, wrap).generate();
    this.world = new World(this.scene, this.lib, this.atlas, gen);
    this.chunks = new ChunkManager(this.world);
    this.world.onSpawn = (o) => this.chunks.register(o);
    this.birds = new BirdSystem(this.scene, this.world);
    this.birds.onFlee = (x, z) => this.audio.flutter(x, z);
    const q = this.quality.current;
    const npcSpawns = gen.npcs.filter((_, i) => q.npcDensity >= 1 || i % Math.round(1 / q.npcDensity) === 0);
    this.npcs = new NPCSystem(this.world, npcSpawns);
    this.npcs.onReact = (_k, x, z, what) => this.audio.animal(what, x, z);
    this.traffic = new TrafficSystem(this.world, new Rng(seed + 5), Math.round(26 * city.trafficMult * Math.max(0.6, q.npcDensity)));
    this.traffic.onHonk = (x, z) => this.audio.honk(x, z);
    this.abduction = new AbductionSystem(this.world, this.dynPool, this.vfx.particles, this.bus);
    this.abduction.onAbsorbed = (o) => this.run.onAbsorbed(o);
    this.abduction.onCaptureStart = (o) => {
      this.audio.liftStart(o.tier);
      if (o.def.tags.includes('carro') && Math.random() < 0.5) this.audio.carAlarm(o.pos.x, o.pos.z);
    };
    if (!this.ufo) this.ufo = new UFOController(this.ufoVisuals, this.world);
    else this.ufo.setWorld(this.world);
    this.enemies = new EnemyManager(this.scene, this.world, this.abduction, this.vfx, this.audio, this.bus, {
      onPlayerHit: (dmg, point) => this.applyPlayerDamage(dmg, point),
      onEnemyDestroyed: (e, byMissile) => this.run.onEnemyKilled(e.kind, byMissile, e.pos),
      onPerfectDodge: (pos) => this.run.onPerfectDodge(pos),
      onBossEmp: () => {
        this.run.beamOffline = 2.2;
        this.abduction.dropAll();
        this.applyPlayerDamage(12, null);
        this.hud.toast('PULSO EMP INIMIGO', 'Feixe offline!', 'danger', 1.8);
      },
      onJetIntro: (stage) => this.onJetIntro(stage),
      onLock: (active) => {
        this.hud.setLock(active);
        if (active) this.audio.lockBeep(false);
      },
      onBuildingHit: (pos) => this.onMissileHitsBuilding(pos),
    });
    this.worldDirty = false;
  }

  /** Enemy wrecks that hit the ground explode (and count as kills if not yet counted). */
  private onObjectDestroyed(uid: number): void {
    const o = this.world.objects[uid];
    if (!o || !o.enemyKind) return;
    const size = o.enemyKind === 'boss' ? 6 : o.enemyKind === 'jet' ? 3.2 : o.enemyKind === 'helicopter' ? 2.6 : o.enemyKind === 'police' ? 1.5 : 1;
    this.vfx.explosion(o.pos, size, this.world.groundAt(o.pos.x, o.pos.z));
    this.audio.explosion(size, o.pos.x, o.pos.z);
    if (o.eventTag !== 'counted' && this.state === 'playing') {
      o.eventTag = 'counted';
      this.run.onEnemyKilled(o.enemyKind, false, o.pos);
    }
  }

  // ───────────────────────────────────────────── UI wiring

  private wireUI(): void {
    this.menu.onAction = (a) => this.onMenuAction(a);
    this.evoDock.onPick = (o) => this.onUpgradePicked(o);
    this.evoDock.onHover = () => this.audio.ui('hover');
    this.evoDock.canPick = () => this.state === 'playing';
    this.results.onAgain = () => {
      this.audio.ui('tap');
      this.results.hide();
      if (this.run.mode === 'online') void this.joinOnline();
      else void this.startRun(this.run.mode, this.run.city.id);
    };
    this.results.onMeta = () => {
      this.audio.ui('tap');
      this.results.hide();
      this.enterMenu();
      this.metaScreen.open();
    };
    this.results.onMenu = () => {
      this.audio.ui('back');
      this.results.hide();
      this.enterMenu();
    };
    this.recordsScreen.onClose = () => {
      this.audio.ui('back');
      this.recordsScreen.hide();
    };
    this.settingsScreen.onChange = (s) => this.applySettings(s, true);
    this.settingsScreen.onClose = () => {
      this.audio.ui('back');
      this.settingsScreen.hide();
      if (this.settingsReturn === 'pause') this.pauseMenu.show();
    };
    this.settingsScreen.onReset = () => {
      this.save.reset();
      this.applySettings(this.save.get().settings, false);
      this.refreshMenu();
    };
    this.pauseMenu.onResume = () => this.resume();
    this.pauseMenu.onSettings = () => {
      this.settingsReturn = 'pause';
      this.pauseMenu.hide();
      this.settingsScreen.open(this.save.get().settings);
    };
    this.pauseMenu.onQuit = () => {
      this.pauseMenu.hide();
      this.time.paused = false;
      this.endRun('quit');
    };
    this.intro.onSkip = () => {
      if (this.introSkippable) this.introTime = Math.max(this.introTime, 99);
    };
    this.hud.onPause = () => this.pause();
    this.hud.onEMP = () => this.input.trigger('emp');
    this.hud.onDash = () => this.input.trigger('dash');
    this.hud.onExtract = () => this.input.trigger('extract');
    this.modeScreen.onClose = () => {
      this.audio.ui('back');
      this.modeScreen.hide();
    };
    this.modeScreen.onPick = (m) => {
      this.audio.ui('pick');
      this.modeScreen.hide();
      if (m === 'ranqueada') this.openRank();
      else if (m === 'arena') {
        // arena drops you in a random city: the round is about the other ships
        const pool = CAMPAIGN.filter((c) => isUnlocked(this.save.get().campaign, c.id));
        const city = (pool[Math.floor(Math.random() * pool.length)] ?? CAMPAIGN[0]) as CityDef;
        void this.startRun('arena', city.id);
      } else if (m === 'online') void this.joinOnline();
      else this.mapScreen.open(m, this.save.get());
    };
    this.mapScreen.onClose = () => {
      this.audio.ui('back');
      this.mapScreen.hide();
      this.modeScreen.open(this.save.get());
    };
    this.mapScreen.onHover = () => this.audio.ui('hover');
    this.mapScreen.onStart = (m, city) => {
      this.mapScreen.hide();
      void this.startRun(m, city);
    };
    this.rankScreen.onClose = () => {
      this.audio.ui('back');
      this.rankScreen.hide();
      this.modeScreen.open(this.save.get());
    };
    this.rankScreen.onStart = (m) => {
      this.rankScreen.hide();
      void this.startRun(m, null);
    };
  }

  // ───────────────────────────────────────────── online (login, ranking, cloud save)

  private wireOnline(): void {
    this.accountScreen.onClose = () => {
      this.audio.ui('back');
      this.accountScreen.hide();
    };
    this.rankScreen.onAccount = () => {
      this.audio.ui('tap');
      this.accountScreen.open();
    };
    this.online.subscribe(() => this.refreshAccountChip());
    this.online.onSignedIn = () => void this.syncCloud();
    this.save.onFlush = () => this.scheduleCloudPush();
    this.refreshAccountChip();
  }

  private refreshAccountChip(): void {
    const o = this.online;
    if (!o.enabled) {
      this.menu.setAccount('OFFLINE', 'VERSÃO DEMO', null);
      return;
    }
    if (o.signedIn && o.profile) {
      const d = divisionFor(o.profile.rp).division;
      this.menu.setAccount(o.profile.nickname, `${d.name} · ${formatInt(o.profile.rp)} RP`, d.color);
    } else if (o.signedIn) this.menu.setAccount('CONECTADO', 'CARREGANDO PERFIL', 'var(--alien-green)');
    else if (o.status === 'loading') this.menu.setAccount('CONECTANDO', 'RANKING ONLINE', null);
    else this.menu.setAccount('ENTRAR', 'RANKING ONLINE', null);
    if (!o.signedIn) {
      this.cloudReady = false;
      return;
    }
    // online RP is the source of truth while signed in
    const p = o.profile;
    if (p && this.save.get().rank.rp !== p.rp && this.state !== 'playing') {
      this.save.update((d) => {
        d.rank.rp = p.rp;
        d.rank.peak = Math.max(d.rank.peak, p.peak_rp);
      });
    }
  }

  /** First sync after sign-in: the more progressed save wins, then pushes are armed. */
  private async syncCloud(): Promise<void> {
    this.cloudReady = false;
    try {
      const cloud = await this.online.pullSave();
      const local = this.save.get();
      if (cloud && cloudWins(local, migrate(cloud.data))) {
        this.save.adopt(cloud.data);
        this.applySettings(this.save.get().settings, false);
        if (this.state === 'menu') this.refreshMenu();
        this.hud.toast('PROGRESSO DA NUVEM', 'Seu save foi carregado', 'info', 2.5);
      } else {
        await this.online.pushSave(this.save.export());
      }
      this.cloudReady = true;
      this.accountScreen.lastSync = Date.now();
      this.refreshAccountChip();
    } catch (err) {
      console.warn('[online] save', friendlyError(err));
    }
  }

  private scheduleCloudPush(): void {
    if (!this.cloudReady || !this.online.signedIn) return;
    if (this.cloudTimer) clearTimeout(this.cloudTimer);
    this.cloudTimer = setTimeout(() => {
      this.cloudTimer = null;
      if (!this.cloudReady) return;
      this.online
        .pushSave(this.save.export())
        .then(() => (this.accountScreen.lastSync = Date.now()))
        .catch((err: unknown) => console.warn('[online] push', friendlyError(err)));
    }, 4000);
  }

  private submitRankedOnline(run: { city: string; seed: number; score: number; objects: number; duration: number; extracted: boolean }): void {
    if (!this.online.signedIn) {
      this.results.setOnline(this.online.enabled ? 'SEM CONTA: ESSE RP FICOU SÓ NESTE APARELHO' : '');
      return;
    }
    this.results.setOnline('ENVIANDO PRO RANKING ONLINE...');
    this.online
      .submitRanked({ week: weekKey(), ...run })
      .then((res) => {
        this.save.update((d) => {
          d.rank.rp = res.rp;
          d.rank.peak = Math.max(d.rank.peak, res.rp);
          d.rank.lastDelta = res.delta;
        }, true);
        this.results.setOnline(res.weekPos ? `RANKING DA SEMANA: #${res.weekPos} DE ${formatInt(res.players ?? res.weekPos)}` : 'PARTIDA REGISTRADA NO RANKING', 'ok');
      })
      .catch((err: unknown) => this.results.setOnline(friendlyError(err).toUpperCase(), 'bad'));
  }

  private openRank(): void {
    const s = this.save.get();
    const daily = s.daily[dailyKey()];
    this.rankScreen.open(s, weeklySetup().city, dailySetup(dailySeed()).city, daily ? daily.bestScore : null);
  }

  private onMenuAction(a: MenuAction): void {
    this.audio.unlock();
    this.audio.ui('tap');
    switch (a) {
      case 'play':
        this.modeScreen.open(this.save.get());
        break;
      case 'daily':
        void this.startRun('diaria', null);
        break;
      case 'meta':
        this.metaScreen.open();
        break;
      case 'dex':
        this.dexScreen.open(this.save.get().dex);
        break;
      case 'records':
        this.recordsScreen.open(this.save.get());
        break;
      case 'settings':
        this.settingsReturn = 'menu';
        this.settingsScreen.open(this.save.get().settings);
        break;
      case 'account':
        this.accountScreen.open();
        break;
    }
  }

  private ensureLateScreens(): void {
    if (!this.metaScreen) {
      this.metaScreen = new MetaScreen(this.ui, this.meta);
      this.metaScreen.onClose = () => {
        this.audio.ui('back');
        this.metaScreen.hide();
        this.refreshMenu();
      };
      this.metaScreen.onBuy = (ok) => this.audio.ui(ok ? 'buy' : 'deny');
    }
    if (!this.dexScreen) {
      this.dexScreen = new DexScreen(this.ui, this.thumbs);
      this.dexScreen.onClose = () => {
        this.audio.ui('back');
        this.dexScreen.hide();
      };
    }
  }

  applySettings(s: Settings, persist: boolean): void {
    if (persist) this.save.update((d) => (d.settings = s));
    this.audio.setVolumes(s.masterVolume, s.musicVolume, s.sfxVolume);
    this.haptics.enabled = s.haptics;
    this.cameraCtl.shakeScale = s.reduceShake ? 0.25 : 1;
    this.post.reduceFlashes = s.reduceFlashes;
    this.time.setReduceMotion(s.reduceFlashes);
    document.documentElement.style.setProperty('--ui-scale', `${s.uiScale}`);
    this.fpsMeter.style.display = s.showFps ? '' : 'none';
    if (this.quality.preset !== s.quality && this.state !== 'loading') this.quality.setPreset(s.quality);
  }

  private applyQuality(q: QualityLevel, scale: number, changed: boolean): void {
    this.renderer.maxDpr = q.maxDpr;
    this.renderer.renderScale = scale;
    this.renderer.applyPixelRatio();
    if (!changed) return;
    this.post.enabled = q.post && this.renderer.supportsHalfFloatRT;
    this.post.bloomEnabled = q.bloom;
    this.post.setMsaa(q.msaa);
    this.renderer.setPostProcessingEnabled(this.post.enabled);
    this.post.setSize(this.renderer.width, this.renderer.height, this.renderer.pixelRatio);
    this.lighting?.setShadowQuality(q.shadows, q.shadowMap);
    this.vfx?.particles.setBudgetScale(q.particles);
    this.beam?.setLowQuality(q.particles < 0.5);
    this.cameraCtl.camera.far = q.renderDistance * 3;
    this.bus.emit('quality:changed', { level: this.quality.level, renderScale: scale });
  }

  // ───────────────────────────────────────────── states

  private enterMenu(): void {
    this.state = 'menu';
    this.arena?.clear();
    this.pvp?.clear();
    this.pendingNet?.close();
    this.pendingNet = null;
    this.arenaEndTimer = -1;
    this.hud.show(false);
    this.intro.hideNow();
    this.intro.setBlackout(false);
    this.ensureLateScreens();
    this.refreshMenu();
    this.menu.setLocation(this.city.name, this.city.uf, this.city.lat, this.city.lon);
    this.menu.show();
    this.ufoVisuals.root.visible = true;
    this.input.enabled = false;
    this.time.paused = false;
    this.run.hidePortal();
    this.beam.setActive(true);
    this.audio.setMusic({ mode: 'menu', alert: 0, combo: 0, frenzy: false, boss: false });
    this.audio.setBeam(false, 0, 0, false);
    this.audio.setStrain(0);
    this.audio.setHelicopter(0);
    this.audio.setSiren(0);
    this.ufo.frozen = true;
    if (this.state === 'menu' && this.run.time > 0) {
      // back from a run: a fresh small saucer hovering over the start district
      this.run.progression.reset();
      this.upgrades.reset();
      this.computeStats(0);
      this.ufo.spawnAt(this.world.start.x, this.world.start.z, this.stats.altitude);
      this.ufoVisuals.body.rotation.set(0, 0, 0);
      this.ufoVisuals.setLevel(1);
      this.vfx.clear();
      this.enemies.reset();
      this.shield.mesh.visible = false;
    }
    this.cameraCtl.override = (cam, dt) => {
      this.menuAngle += dt * 0.05;
      const p = this.ufo.position;
      const portrait = this.renderer.width < this.renderer.height;
      const d = portrait ? 19 : 15;
      const a = this.menuAngle;
      cam.position.set(p.x + Math.sin(a) * d, p.y + 3.2, p.z + Math.cos(a) * d);
      if (portrait) {
        // portrait: saucer centered in the upper half, logo below
        cam.lookAt(p.x - Math.sin(a) * 4, p.y - 4.5, p.z - Math.cos(a) * 4);
      } else {
        // look slightly to the side so the saucer sits in the right third, city behind
        cam.lookAt(p.x - Math.cos(a) * 5.5 - Math.sin(a) * 4, p.y - 2.2, p.z + Math.sin(a) * 5.5 - Math.cos(a) * 4);
      }
      cam.fov = portrait ? 62 : 50;
      cam.updateProjectionMatrix();
    };
  }

  private refreshMenu(): void {
    const s = this.save.get();
    const daily = s.daily[dailyKey()];
    const goal = this.meta.nextGoal();
    this.menu.refresh(s.cores, daily ? daily.bestScore : null, !!goal && goal.missing <= 0);
  }

  /** Resolves mode + city into a concrete run (ranked/daily maps are the same for everyone). */
  async startRun(mode: GameMode, cityId: CityId | null, seedOverride?: number): Promise<void> {
    this.audio.unlock();
    this.requestFullscreen();
    this.menu.hide();
    this.results.hide();
    const setup =
      mode === 'ranqueada'
        ? weeklySetup()
        : mode === 'diaria'
          ? dailySetup(dailySeed())
          : { mode, city: cityId ?? (this.save.get().last.city as CityId), seed: seedOverride ?? (Math.random() * 1e9) | 0 };
    const city = getCity(setup.city);
    // online rooms: everyone must build exactly the same city
    const seeded = mode === 'ranqueada' || mode === 'diaria' || mode === 'online';
    const wrap = mode === 'arena' || mode === 'online';
    if (this.worldDirty || seeded || city.id !== this.city.id || wrap !== !!this.world.wrap) {
      this.intro.setBlackout(true);
      await nextFrame();
      this.buildWorld(setup.seed, city, wrap);
    }
    this.worldDirty = true;
    this.save.update((d) => {
      d.last = { mode, city: city.id };
    });
    this.resetRunState(setup.seed, mode, city);
    this.beginIntro();
  }

  private requestFullscreen(): void {
    if (!this.input.isTouchDevice) return;
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    try {
      if (!document.fullscreenElement && el.requestFullscreen) {
        void el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
          const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
          o.lock?.('landscape').catch(() => undefined);
        }).catch(() => undefined);
      }
    } catch {
      /* iOS Safari: no fullscreen API for non-video elements */
    }
  }

  private resetRunState(seed: number, mode: GameMode, city: CityDef): void {
    this.upgrades.reset();
    this.run.start(seed, mode, city);
    const wanted = new Set(this.run.challenges.active.filter((c) => c.kind === 'abduct_id' && c.goal === 1).map((c) => c.template.objectId));
    this.landmarkTargets = this.world.objects.filter((o) => wanted.has(o.def.id));
    this.time.resetRun();
    this.emp.reset();
    this.vfx.clear();
    this.enemies.reset();
    this.abduction.reset();
    this.maxBeam = false;
    this.computeStats(0);
    this.shield.reset(this.stats.maxShield);
    this.damage.reset(this.stats.maxHull);
    this.damage.god = this.godMode || !MODES[mode].damage;
    this.ufo.dashTimer = 0;
    this.dashCooldown = 0;
    this.ufoVisuals.setLevel(1);
    this.levelUpDelay = -1;
    this.evoDock.close();
    this.hud.setBoss(false, 0, 0);
    this.hud.setLock(false);
    this.hud.setTutorial(null);
    this.bus.emit('run:start', { daily: mode === 'diaria' });
  }

  private beginIntro(): void {
    const s = this.save.get();
    this.state = 'intro';
    this.introTime = s.settings.skipIntro || new URLSearchParams(location.search).has('skipintro') ? 4.2 : 0;
    this.introSkippable = s.flags.introSeen;
    this.intro.setSkippable(this.introSkippable);
    this.intro.show();
    this.intro.setBlackout(!s.settings.skipIntro);
    this.intro.showLocate(false);
    this.intro.clearRadio();
    this.hud.show(false);
    this.input.enabled = false;
    this.ufo.frozen = true;
    this.beam.setActive(false);
    this.audio.setMusic({ mode: 'run', alert: 0, combo: 0, frenzy: false, boss: false });
    const start = this.world.start;
    this.ufo.spawnAt(start.x, start.z, 150);
    this.introStep = 0;
    if (this.run.mode === 'arena') this.startArena();
    else this.arena?.clear();
    if (this.run.mode === 'online') this.startPvp();
    else this.pvp?.clear();
  }

  private introStep = 0;

  private updateIntro(dt: number): void {
    this.introTime += this.time.realDelta;
    const t = this.introTime;
    const start = this.world.start;
    if (this.introStep === 0 && t >= 0) {
      this.introStep = 1;
      if (t < 1) {
        this.audio.radio();
        this.audio.staticBurst(1.2);
        this.intro.say(...this.city.radio[0]);
      }
    }
    if (this.introStep === 1 && t >= 1.9) {
      this.introStep = 2;
      if (t < 3) {
        this.audio.radio();
        this.intro.say(...this.city.radio[1]);
      }
    }
    if (this.introStep === 2 && t >= 2.4) {
      this.introStep = 3;
      this.intro.setBlackout(false);
    }
    // descent through the clouds
    const d = clamp((t - 2.4) / 2.8, 0, 1);
    const e = 1 - Math.pow(1 - d, 3);
    const hover = this.stats.altitude;
    const y = 150 + (hover - 150) * e;
    this.ufo.position.set(start.x, y, start.z);
    this.ufo.altitude = y;
    this.ufoVisuals.root.position.copy(this.ufo.position);
    this.ufoVisuals.root.scale.setScalar(this.stats.radius);
    this.ufoVisuals.body.rotation.set(Math.sin(t * 2) * 0.1 * (1 - d), 0, Math.cos(t * 1.7) * 0.1 * (1 - d));
    this.cameraCtl.override = (cam) => {
      // from a high shot looking down through the clouds into the gameplay framing
      const camDist = 21 + (1 - e) * 26;
      const pitch = 0.94 + (1 - e) * 0.5;
      const fy = y * 0.58;
      cam.position.set(start.x, fy + Math.sin(pitch) * camDist, start.z + Math.cos(pitch) * camDist);
      cam.lookAt(start.x, fy, start.z);
      cam.fov = 50 + (1 - e) * 10;
      cam.updateProjectionMatrix();
    };
    if (this.introStep === 3 && t >= 4.3) {
      this.introStep = 4;
      this.intro.showLocate(true);
      this.audio.ui('pick');
    }
    if (t >= 5.6) this.finishIntro();
    void dt;
  }

  private finishIntro(): void {
    this.intro.hide();
    this.intro.setBlackout(false);
    this.intro.showLocate(false);
    this.intro.clearRadio();
    this.cameraCtl.override = null;
    this.ufo.frozen = false;
    this.ufo.spawnAt(this.world.start.x, this.world.start.z, this.stats.altitude);
    this.cameraCtl.snapTo(this.ufo.position, this.stats.scale);
    this.beam.setActive(true);
    this.save.update((d) => (d.flags.introSeen = true));
    this.state = 'playing';
    this.input.enabled = true;
    this.hud.show(true);
    this.hud.setObjectives(this.run.challenges.active, this.run.mode === 'campanha', this.run.objectiveHeading);
    const tut = !this.save.get().flags.tutorialDone;
    this.tutorialPhase = tut ? 0 : -1;
    this.tutorialMoved = 0;
    this.tutorialAbducts = 0;
    this.tutorialTimer = 0;
    if (tut) this.hud.setTutorial(this.input.isTouchDevice ? 'ARRASTE PARA PILOTAR' : 'ARRASTE OU USE WASD PARA PILOTAR', true);
    else this.hud.toast(MODES[this.run.mode].name, `${this.run.city.name.toUpperCase()} · ${this.run.city.uf}`, 'good', 2.2);
  }

  private pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.time.paused = true;
    this.input.enabled = false;
    this.pauseMenu.setObjectives(this.run.challenges.active);
    this.pauseMenu.casual = this.run.mode === 'casual';
    this.pauseMenu.show();
    this.audio.ui('tap');
    this.audio.setBeam(false, 0, 0, false);
    this.audio.setStrain(0);
  }

  private resume(): void {
    if (this.state !== 'paused') return;
    this.pauseMenu.hide();
    this.state = 'playing';
    this.time.paused = false;
    this.input.enabled = true;
    this.audio.ui('tap');
  }

  // ───────────────────────────────────────────── level up

  onLevelsGained(_levels: number): void {
    this.run.director.markNovelty(this.run.time);
    if (this.levelUpDelay < 0) this.triggerLevelUpFx();
  }

  private triggerLevelUpFx(): void {
    // no pause: a quick burst of juice, then the evolution chips slide in
    this.levelUpDelay = 0.35;
    this.vfx.levelUp(this.ufo.position, this.stats.radius);
    this.audio.levelUp();
    this.haptics.light();
    this.hud.floatText(this.ufo.position, `NÍVEL ${this.run.progression.level}`, 'var(--alien-green)', 30);
    this.bus.emit('player:levelup', { level: this.run.progression.level });
    const revealed = this.ufoVisuals.setLevel(this.run.progression.level);
    if (revealed) this.hud.toast('A NAVE EVOLUIU', 'Novo módulo alienígena acoplado', 'alien', 2.2);
  }

  private openEvolutionChoices(): void {
    const pr = this.run.progression;
    if (pr.pendingLevelUps <= 0) {
      this.evoDock.close();
      return;
    }
    const offers = this.upgrades.rollOffers(this.run.rng, pr.level, 3, 0.08 + this.stats.rarityBonus * 0.1);
    if (offers.length === 0) {
      pr.pendingLevelUps = 0;
      this.evoDock.close();
      return;
    }
    const levelShown = pr.level - pr.pendingLevelUps + 1;
    this.evoDock.open(levelShown, offers, this.upgrades.levels, pr.pendingLevelUps - 1);
    if (this.tutorialPhase >= 0 && levelShown === 2) this.hud.toast('EVOLUA SEM PARAR', this.input.isTouchDevice ? 'Toque num poder lá embaixo' : 'Clique num poder ou use 1, 2, 3', 'info', 3.2);
  }

  private onUpgradePicked(o: UpgradeOffer): void {
    const res = this.upgrades.apply(o);
    this.audio.ui('pick');
    this.haptics.medium();
    this.bus.emit('upgrade:chosen', { id: o.id, level: res.level });
    this.run.progression.pendingLevelUps = Math.max(0, this.run.progression.pendingLevelUps - 1);
    const prevMaxHull = this.stats.maxHull;
    this.computeStats(0);
    if (o.id === 'casco') {
      this.damage.setMaxHull(this.stats.maxHull);
      this.damage.heal(this.stats.maxHull);
    } else if (this.stats.maxHull !== prevMaxHull) this.damage.setMaxHull(this.stats.maxHull);
    this.hud.floatText(this.ufo.position, o.def.name, 'var(--energy-cyan)', 20);
    for (const s of res.newSynergies) {
      const syn = SYNERGY_BY_ID.get(s);
      if (!syn) continue;
      setTimeout(() => {
        this.hud.showBanner(`SINERGIA: ${syn.name}`, syn.description.toUpperCase(), 'var(--frenzy-violet)');
        this.audio.frenzy();
      }, 350);
      this.bus.emit('synergy:unlocked', { id: s });
    }
    // let the pick animation play, then roll the next set (or tuck the dock away)
    setTimeout(() => {
      if (this.state !== 'playing' && this.state !== 'paused') return;
      if (this.run.progression.pendingLevelUps > 0) this.openEvolutionChoices();
      else this.evoDock.close();
    }, 300);
  }

  // ───────────────────────────────────────────── gameplay helpers

  private dashCooldown = 0;

  computeStats(_dt: number): void {
    const r = this.run;
    this.stats.compute({
      upgrades: this.upgrades,
      meta: this.save.get().meta,
      matterTier: r ? r.progression.tier : 1,
      frenzy: r ? r.combo.frenzy : false,
      chainStacks: r ? r.chainStacks : 0,
      perfectDodgeBuff: r ? r.perfectDodgeTimer > 0 : false,
      stillFactor: this.ufo ? this.ufo.stillFactor : 0,
      maxBeam: this.maxBeam,
    });
  }

  playerSnapshot(): PlayerSnapshot {
    return {
      pos: this.ufo.position,
      vel: this.ufo.velocity,
      radius: this.stats.radius,
      beamRadius: this.stats.beamRadius,
      beamTier: this.stats.beamTier,
      beamActive: this.beamActive,
      dashing: this.ufo.isDashing,
      reflectChance: this.stats.reflectChance,
      mirror: this.upgrades.has('espelho_quantico'),
      slowRadius: this.stats.timeFieldSlow > 0 ? 16 + this.stats.radius * 2 : 0,
      slowFactor: this.stats.timeFieldSlow,
    };
  }

  get beamActive(): boolean {
    return this.state === 'playing' && this.run.beamOffline <= 0 && this.run.channeling <= 0;
  }

  /** Returns true if the projectile was consumed. */
  applyPlayerDamage(amount: number, point: Vector3 | null): boolean {
    if (this.state !== 'playing') return true;
    const hitPoint = point ? _v2.copy(point) : null;
    const res = this.damage.apply(amount, hitPoint, this.ufo.position, this.ufo.isDashing);
    if (res === 'none') return false;
    if (res === 'shield') {
      this.audio.shieldHit();
      if (point) this.vfx.shieldHit(point);
      if (this.upgrades.has('tempestade_magnetica') && this.autoEmpAccumulator <= 0) {
        this.autoEmpAccumulator = 4;
        this.emp.forceBlast(0.6);
      }
    } else {
      this.audio.damage();
      this.vfx.hullDamage(amount);
      this.ufoVisuals.damageFlash = 1;
      this.run.onDamaged();
    }
    return true;
  }

  private onJetIntro(stage: 'radio' | 'rumble' | 'flyby'): void {
    if (stage === 'radio') {
      this.audio.radio();
      this.hud.toast('RÁDIO', 'AQUI É CARCARÁ LÍDER. ALVO À VISTA.', 'warn', 2.4);
    } else if (stage === 'rumble') {
      this.audio.distantRumble();
      this.cameraCtl.addTrauma(0.15);
    } else {
      this.cameraCtl.addTrauma(0.6);
      this.post.pulseChroma(0.012);
      this.time.slowMo(0.45, 0.35);
      this.hud.showBanner('AMEAÇA AÉREA DETECTADA', 'CAÇAS DA FORÇA SENTINELA', 'var(--warning-red)');
      this.run.director.markNovelty(this.run.time);
      this.haptics.strong();
    }
  }

  private onMissileHitsBuilding(pos: Vector3): void {
    // blasts rooftop parts off the building: the emergent "missile hit the tower" moment
    const list = this.world.query(pos.x, pos.z, 6, []);
    let n = 0;
    for (const o of list) {
      if (o.state !== AState.Static || o.tier > 3 || Math.abs(o.home.y - pos.y) > 8) continue;
      this.world.kill(o);
      this.vfx.particles.chunks(o.pos, 4, 0x8f8778, 0.3, 7, this.world.groundAt(o.pos.x, o.pos.z));
      if (++n > 4) break;
    }
    this.vfx.particles.chunks(pos, 10, 0xbdb7aa, 0.4, 8, this.world.groundAt(pos.x, pos.z));
    this.run.stats.score += 1500;
  }

  onTutorialAbduct(): void {
    if (this.tutorialPhase < 0) return;
    this.tutorialAbducts++;
    if (this.tutorialPhase === 1) {
      this.tutorialPhase = 2;
      this.tutorialTimer = 0;
      this.hud.setTutorial('ABSORVA MAIS', false);
    } else if (this.tutorialPhase === 2 && this.tutorialAbducts >= 6) this.finishTutorial();
  }

  private finishTutorial(): void {
    this.tutorialPhase = -1;
    this.hud.setTutorial(null);
    this.save.update((d) => (d.flags.tutorialDone = true));
  }

  private updateTutorial(dt: number): void {
    if (this.tutorialPhase < 0) return;
    this.tutorialTimer += dt;
    if (this.tutorialPhase === 0) {
      this.tutorialMoved += this.ufo.speed * dt;
      if (this.tutorialMoved > 4) {
        this.tutorialPhase = 1;
        this.tutorialTimer = 0;
        this.hud.setTutorial('POSICIONE O FEIXE SOBRE OBJETOS', false);
      }
    } else if (this.tutorialPhase === 2 && this.tutorialTimer > 9) this.finishTutorial();
  }

  // ───────────────────────────────────────────── end of run

  private startExtraction(): void {
    if (this.run.extractionMultiplier <= 0 || this.run.channeling > 0) return;
    this.run.channeling = BALANCE.extraction.channelTime;
    this.state = 'extracting';
    this.evoDock.close();
    this.abduction.dropAll();
    this.input.enabled = false;
    this.audio.extraction();
    this.hud.toast('EXTRAINDO', 'Segure firme...', 'info', 2);
    this.bus.emit('extraction:start', {});
  }

  private arenaSwallowed = false;

  private shiftFollowers(dx: number, dz: number): void {
    this.cameraCtl.shift(dx, dz);
    for (const o of this.abduction.active) {
      o.pos.x += dx;
      o.pos.z += dz;
      o.home.x += dx;
      o.home.z += dz;
      o.localOffset.x += dx;
      o.localOffset.z += dz;
    }
  }

  /**
   * Endless arena: the city tile is drawn again on the sides the camera can see, so the
   * seam never shows. Only the city itself is repeated (one draw per batch).
   */
  private renderWrapCopies(): void {
    const w = this.world;
    const wrap = w?.wrap;
    if (!wrap) return;
    const f = this.cameraCtl.focus;
    const b = w.bounds;
    const reach = 260 + this.cameraCtl.distance * 3;
    const gl = this.renderer.gl;
    const cam = this.cameraCtl.camera;
    let hidden: Array<{ visible: boolean }> | null = null;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (i === 0 && j === 0) continue;
        const ox = i * wrap.w;
        const oz = j * wrap.h;
        // distance from the camera focus to that neighbour tile
        const ddx = Math.max(b.minX + ox - f.x, 0, f.x - (b.maxX + ox));
        const ddz = Math.max(b.minZ + oz - f.z, 0, f.z - (b.maxZ + oz));
        if (Math.hypot(ddx, ddz) > reach) continue;
        if (!hidden) {
          hidden = [];
          for (const c of this.scene.children) {
            if (c === w.root || !c.visible || (c as { isLight?: boolean }).isLight) continue;
            c.visible = false;
            hidden.push(c);
          }
          gl.autoClear = false;
          gl.shadowMap.autoUpdate = false;
        }
        w.root.position.set(ox, 0, oz);
        w.root.updateMatrixWorld(true);
        gl.render(this.scene, cam);
      }
    }
    if (!hidden) return;
    w.root.position.set(0, 0, 0);
    w.root.updateMatrixWorld(true);
    for (const c of hidden) c.visible = true;
    gl.shadowMap.autoUpdate = true;
  }

  /** ABDUZIU.io: bots spawn around the city once the saucer arrives. */
  private startArena(): void {
    if (!this.arena) {
      this.arena = new ArenaSystem(this, this.scene, this.envMap, this.noise);
      this.arena.onPlayerEaten = (by) => {
        if (this.state !== 'playing') return;
        this.state = 'dying';
        this.arenaSwallowed = true;
        this.evoDock.close();
        this.endTimer = 1.4;
        this.input.enabled = false;
        this.abduction.dropAll();
        this.audio.crash();
        this.haptics.light();
        this.time.slowMo(0.4, 0.6);
        this.hud.showBanner('ABDUZIDO!', `${by.toUpperCase()} ENGOLIU SUA NAVE`, 'var(--warning-red)');
      };
      this.arena.onRoundEnd = (place, total) => {
        this.arenaEndTimer = 2.4;
        this.input.enabled = false;
        this.evoDock.close();
        this.abduction.dropAll();
        this.audio.levelUp();
        this.hud.showBanner('FIM DA RODADA', `VOCÊ FICOU EM #${place} DE ${total}`, place === 1 ? 'var(--gold)' : 'var(--alien-green)');
      };
    }
    this.arenaSwallowed = false;
    this.arenaEndTimer = -1;
    this.arena.playerName = this.online.profile?.nickname ?? 'VOCÊ';
    this.arena.start(this.quality.level <= 1);
  }

  /** ARENA ONLINE: joins a room first (the room decides the city and its seed). */
  private async joinOnline(): Promise<void> {
    const note = this.netNotice('CONECTANDO À ARENA ONLINE...');
    const net = new ArenaNet();
    const name = this.online.profile?.nickname ?? `Visitante${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      const w = await net.connect(name, 0x5dffa0);
      note.remove();
      this.pendingNet = net;
      void this.startRun('online', w.city as CityId, w.seed);
    } catch {
      net.close();
      note.textContent = 'ARENA ONLINE INDISPONÍVEL AGORA. TENTE A ARENA CONTRA BOTS.';
      note.classList.add('bad');
      setTimeout(() => note.remove(), 3500);
      this.modeScreen.open(this.save.get());
    }
  }

  private netNotice(text: string): HTMLDivElement {
    const el = h('div', 'net-notice', text);
    this.ui.appendChild(el);
    return el;
  }

  private startPvp(): void {
    const net = this.pendingNet;
    this.pendingNet = null;
    if (!net) return;
    if (!this.pvp) {
      this.pvp = new OnlineArena(this, this.scene, this.envMap, this.noise);
      this.pvp.onPlayerEaten = (by) => {
        if (this.state !== 'playing' && this.state !== 'intro') return;
        this.state = 'dying';
        this.arenaSwallowed = true;
        this.evoDock.close();
        this.endTimer = 1.4;
        this.input.enabled = false;
        this.abduction.dropAll();
        this.audio.crash();
        this.haptics.light();
        this.time.slowMo(0.4, 0.6);
        this.hud.showBanner('ABDUZIDO!', `${by.toUpperCase()} ENGOLIU SUA NAVE`, 'var(--warning-red)');
      };
      this.pvp.onDisconnect = () => {
        if (this.state !== 'playing') return;
        this.hud.showBanner('CONEXÃO PERDIDA', 'VOLTANDO PRO MENU', 'var(--warning-orange)');
        setTimeout(() => {
          if (this.state === 'playing') this.endRun('quit');
        }, 1800);
      };
    }
    this.arenaSwallowed = false;
    this.pvp.playerName = this.online.profile?.nickname ?? 'VOCÊ';
    this.pvp.start(net);
    this.hud.toast('PROTEÇÃO DE CHEGADA', '10 segundos sem poder ser engolido', 'info', 2.6);
  }

  private endRun(reason: 'extracted' | 'destroyed' | 'quit'): void {
    this.state = 'results';
    this.evoDock.close();
    this.input.enabled = false;
    this.hud.show(false);
    this.hud.setTutorial(null);
    this.hud.setLock(false);
    this.audio.setBeam(false, 0, 0, false);
    this.audio.setStrain(0);
    this.audio.setHelicopter(0);
    this.audio.setSiren(0);
    this.audio.setMusic({ mode: 'menu', alert: 0, combo: 0, frenzy: false, boss: false });
    this.bus.emit('run:end', { reason });

    const r = this.run;
    r.stats.maxAlert = Math.max(r.stats.maxAlert, r.threat.alert);
    // casual can't fail: ending the passeio counts as a clean extraction
    const extracted = reason === 'extracted' || (reason === 'quit' && r.mode === 'casual');
    if (extracted) r.challenges.onExtracted();
    const modeInfo = MODES[r.mode];
    let arenaInfo: { place: number; total: number; eatenBy: string | null } | undefined;
    if (r.mode === 'arena' && this.arena) {
      arenaInfo = { place: this.arena.place || this.arena.playerPlace(), total: this.arena.total, eatenBy: this.arena.eatenBy };
      this.arena.clear();
    } else if (r.mode === 'online' && this.pvp) {
      arenaInfo = { place: this.pvp.place || this.pvp.playerPlace(), total: this.pvp.total, eatenBy: this.pvp.eatenBy };
      this.pvp.clear();
    }
    this.arenaEndTimer = -1;
    this.arenaSwallowed = false;
    const raw = r.computeResults(extracted);
    const cores = { ...raw, total: Math.round(raw.total * modeInfo.coreMult) };
    // campaign stars / ranked points
    let campaign: ReturnType<typeof applyCampaignRun> | null = null;
    let rank: { delta: number; rp: number; before: number } | null = null;
    const save0 = this.save.get();
    if (r.mode === 'campanha') {
      campaign = applyCampaignRun(save0.campaign, r.city.id, r.challenges.active.map((c) => c.done), r.stats.score, extracted);
      cores.total += campaign.bonusCores;
    } else if (r.mode === 'ranqueada') {
      const before = save0.rank.rp;
      const delta = rpDelta(before, r.stats.score, extracted);
      rank = { delta, rp: applyRp(before, delta), before };
    }
    this.shield.mesh.visible = false;
    this.ufoVisuals.root.visible = reason === 'quit';
    this.beam.setActive(false);
    this.meta.addCores(cores.total);
    const s = r.stats;
    const prevBest = this.save.get().records.bestScore;
    this.save.update((d) => {
      const rec = d.records;
      rec.bestScore = Math.max(rec.bestScore, s.score);
      rec.bestCombo = Math.max(rec.bestCombo, r.combo.best);
      rec.bestMassKg = Math.max(rec.bestMassKg, s.massKg);
      rec.bestAlert = Math.max(rec.bestAlert, s.maxAlert);
      if (r.threat.timeReachedMax !== null) rec.fastestMaxAlert = rec.fastestMaxAlert === null ? r.threat.timeReachedMax : Math.min(rec.fastestMaxAlert, r.threat.timeReachedMax);
      rec.totalAbducted += s.objects;
      rec.totalRuns++;
      rec.jetsCaptured += s.jetsCaptured;
      if (s.bossDefeated) rec.bossesDefeated++;
      rec.longestRun = Math.max(rec.longestRun, r.time);
      if (r.daily) {
        const k = dailyKey();
        const day = d.daily[k] ?? { bestScore: 0, attempts: 0 };
        day.bestScore = Math.max(day.bestScore, s.score);
        day.attempts++;
        d.daily[k] = day;
      }
      if (campaign) d.campaign[r.city.id] = campaign.progress;
      if (rank) {
        const wk = weekKey();
        if (d.rank.week !== wk) {
          d.rank.week = wk;
          d.rank.weekBest = 0;
        }
        d.rank.weekBest = Math.max(d.rank.weekBest, s.score);
        d.rank.rp = rank.rp;
        d.rank.peak = Math.max(d.rank.peak, rank.rp);
        d.rank.games++;
        d.rank.lastDelta = rank.delta;
      }
      d.flags.firstRunDone = true;
      d.history.push({ date: Date.now(), score: s.score, objects: s.objects, massKg: s.massKg, bestCombo: r.combo.best, maxAlert: s.maxAlert, duration: r.time, cores: cores.total, extracted, daily: r.daily, mode: r.mode, city: r.city.id, rpDelta: rank?.delta });
      if (d.history.length > 30) d.history.shift();
    }, true);
    const goal = this.meta.nextGoal();
    this.results.open({
      extracted,
      quit: reason === 'quit',
      score: s.score,
      objects: s.objects,
      massKg: s.massKg,
      bestCombo: r.combo.best,
      jets: s.jetsCaptured,
      enemies: s.enemiesDestroyed,
      discoveries: s.discoveries,
      maxAlert: s.maxAlert,
      duration: r.time,
      level: r.progression.level,
      coresBase: cores.base,
      coresTotal: cores.total,
      multiplier: cores.multiplier,
      challenges: r.challenges.active.map((c) => ({ title: c.title, done: c.done, reward: c.reward })),
      highlights: r.highlights.top(4),
      goal: goal ? { name: goal.node.name, missing: goal.missing, cost: goal.cost, level: goal.nextLevel } : null,
      newRecord: s.score > prevBest && prevBest > 0,
      daily: r.daily,
      modeName: modeInfo.name,
      arena: arenaInfo,
      cityName: r.city.name.toUpperCase(),
      campaign: campaign
        ? { stars: campaign.progress.stars, earnedNow: r.challenges.active.map((c) => c.done), newStars: campaign.newStars, unlocked: campaign.unlocked ? campaign.unlocked.name.toUpperCase() : null, bonusCores: campaign.bonusCores }
        : null,
      rank: rank
        ? (() => {
            const a = divisionFor(rank.before).division;
            const b = divisionFor(rank.rp);
            return { delta: rank.delta, rp: rank.rp, division: b.division.name, color: b.division.color, promoted: b.division.min > a.min, demoted: b.division.min < a.min, progress: b.progress };
          })()
        : null,
    });
    if (rank) this.submitRankedOnline({ city: r.city.id, seed: r.seed, score: s.score, objects: s.objects, duration: r.time, extracted });
    // cinematic: the city shrinks below the departing saucer
    const from = this.ufo.position.clone();
    this.cameraCtl.override = (cam, dt) => {
      from.y += dt * (extracted ? 30 : 4);
      cam.position.set(from.x + 40, from.y + 70, from.z + 90);
      cam.lookAt(from.x, Math.max(0, from.y - 60), from.z - 20);
      cam.fov = 50;
      cam.updateProjectionMatrix();
    };
    this.ufo.frozen = true;
    this.run.hidePortal();
  }

  // ───────────────────────────────────────────── frame

  private frame(rawDt: number, now: number): void {
    this.time.tick(rawDt);
    const dt = this.time.delta;
    const rdt = this.time.realDelta;
    this.quality.sample(rdt, this.state === 'menu' || this.state === 'results' || this.state === 'loading');
    if (this.state === 'loading') {
      return;
    }
    this.input.update(now);

    switch (this.state) {
      case 'menu':
        this.updateMenu(dt);
        break;
      case 'intro':
        this.computeStats(dt);
        this.updateIntro(dt);
        break;
      case 'playing':
      case 'extracting':
      case 'dying':
        this.updatePlaying(dt);
        break;
      case 'results':
        this.updateAmbient(dt);
        break;
      default:
        break;
    }
    if (this.levelUpDelay >= 0 && this.state === 'playing') {
      this.levelUpDelay -= rdt;
      if (this.levelUpDelay < 0 && !this.evoDock.isOpen) this.openEvolutionChoices();
    }
    this.evoDock.update(this.run.progression.pendingLevelUps - 1);
    this.world.update(now / 1000);
    this.renderFrame(dt, rdt);
    if (this.debugPanel) this.updateDebug(rdt);
    if (this.save.get().settings.showFps) this.fpsMeter.textContent = `${this.quality.fps.toFixed(0)} FPS · ${this.quality.current.name}`;
  }

  private updateMenu(dt: number): void {
    this.computeStats(dt);
    this.ufo.update(dt, this.input.move, this.stats);
    this.updateAmbient(dt);
    this.npcs.update(dt, this.ufo.position, this.stats.radius, 0, this.cameraCtl.focus);
  }

  /** Background life that runs in menus/results as well. */
  private updateAmbient(dt: number): void {
    this.traffic.update(dt, this.ufo.position, this.stats.radius);
    this.ufoVisuals.update(dt, 0.15);
  }

  private updatePlaying(dt: number): void {
    const r = this.run;
    const playing = this.state === 'playing';
    if (playing) r.update(dt);
    if (this.state === 'extracting') r.channeling = Math.max(0, r.channeling - dt);
    this.computeStats(dt);
    this.shield.max = this.stats.maxShield;
    this.damage.setMaxHull(this.stats.maxHull);
    this.damage.god = this.godMode || !MODES[r.mode].damage;
    this.damage.update(dt);

    // input actions
    if (this.input.consume('pause')) this.pause();
    if (playing && this.input.consume('emp') && this.emp.trigger(this.stats.empCooldown)) {
      this.audio.empCharge();
      this.vfx.empCharge(this.ufo.position, this.stats.radius);
    }
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (playing && this.input.consume('dash') && this.stats.dashUnlocked && this.dashCooldown <= 0) {
      if (this.ufo.dash(this.input.move)) {
        this.dashCooldown = this.stats.dashCooldown;
        this.audio.dash();
        this.vfx.dash(this.ufo.position, this.stats.radius);
        this.bus.emit('player:dash', {});
      }
    }
    if (playing && this.input.consume('extract')) this.startExtraction();

    // EMP
    this.autoEmpAccumulator = Math.max(0, this.autoEmpAccumulator - dt);
    this.emp.update(dt, playing ? this.stats.autoEmpPeriod : 0);
    if (this.emp.pendingBlast > 0) this.fireEMP(this.emp.pendingBlast);

    // movement
    if (this.state === 'extracting') {
      _v.copy(r.portalPos).sub(this.ufo.position);
      this.ufo.position.addScaledVector(_v, Math.min(1, dt * 1.6));
      this.ufo.altitude = this.ufo.position.y;
      this.ufoVisuals.root.position.copy(this.ufo.position);
      this.ufoVisuals.root.scale.setScalar(this.stats.radius * (0.6 + 0.4 * (r.channeling / BALANCE.extraction.channelTime)));
      this.ufoVisuals.body.rotation.y += dt * 8;
      if (r.channeling <= 0) {
        this.vfx.extraction(this.ufo.position, this.stats.radius);
        this.endRun('extracted');
        return;
      }
    } else if (this.state === 'dying' && this.arenaSwallowed) {
      // swallowed by a bigger ship: dragged up into its hatch, shrinking
      this.endTimer -= dt;
      const c = this.run.mode === 'online' ? this.pvp?.captorPosition : this.arena?.captorPosition;
      if (c) this.ufo.position.lerp(c, 1 - Math.exp(-4 * dt));
      this.ufoVisuals.root.position.copy(this.ufo.position);
      this.ufoVisuals.root.scale.setScalar(this.stats.radius * Math.max(0.02, this.endTimer / 1.4));
      this.ufoVisuals.body.rotation.y += dt * 12;
      if (this.endTimer <= 0) {
        this.ufoVisuals.root.visible = false;
        this.endRun('destroyed');
        return;
      }
    } else if (this.state === 'dying') {
      this.endTimer -= dt;
      this.ufo.position.y = Math.max(this.world.groundAt(this.ufo.position.x, this.ufo.position.z) + 1, this.ufo.position.y - dt * (6 + (2 - this.endTimer) * 12));
      this.ufoVisuals.root.position.copy(this.ufo.position);
      this.ufoVisuals.body.rotation.z += dt * 3;
      this.ufoVisuals.body.rotation.x += dt * 2;
      this.vfx.smokeTrail(this.ufo.position, true);
      if (this.endTimer <= 0) {
        this.vfx.explosion(this.ufo.position, 5, this.world.groundAt(this.ufo.position.x, this.ufo.position.z));
        this.audio.explosion(5, this.ufo.position.x, this.ufo.position.z);
        this.endRun('destroyed');
        return;
      }
    } else {
      this.ufo.controlsLocked = r.beamOffline > 0 ? 0.1 : 0;
      const px = this.ufo.position.x;
      const pz = this.ufo.position.z;
      this.ufo.update(dt, this.input.move, this.stats, this.abduction.minUfoAltitude);
      const wrap = this.world.wrap;
      if (wrap) {
        // crossed the seam of the endless arena: everything that follows the saucer jumps with it
        const sx = Math.abs(this.ufo.position.x - px) > wrap.w / 2 ? Math.sign(this.ufo.position.x - px) * wrap.w : 0;
        const sz = Math.abs(this.ufo.position.z - pz) > wrap.h / 2 ? Math.sign(this.ufo.position.z - pz) * wrap.h : 0;
        if (sx || sz) this.shiftFollowers(sx, sz);
      }
    }

    const beamOn = this.beamActive;
    this.beam.setActive(beamOn);

    // abduction
    const orbitMode = this.stats.orbitAlways || r.combo.count >= BALANCE.combo.orbitFromCombo || r.combo.frenzy;
    this.abduction.update(dt, {
      ufoPos: this.ufo.position,
      ufoVel: this.ufo.velocity,
      ufoRadius: this.stats.radius,
      beamRadius: this.stats.beamRadius,
      beamTier: this.stats.beamTier,
      capacity: this.stats.capacity,
      absorbSpeed: this.stats.absorbSpeed,
      satellites: this.stats.satellites,
      satRadius: this.stats.beamRadius * this.stats.satelliteRadiusMult,
      satPositions: this.beam.satellitePositions,
      pullRadius: this.stats.pullRadiusMult * this.stats.beamRadius,
      pullStrength: this.stats.pullStrength,
      orbitMode,
      orbitTime: r.combo.frenzy ? 1.4 : this.stats.orbitAlways ? 1.6 : 0.8,
      beamActive: beamOn,
      frenzy: r.combo.frenzy,
    });
    if (this.abduction.strainLevel > 0.05) {
      this.ufo.addTug(this.abduction.strainLevel * 0.6);
      this.cameraCtl.addTrauma(this.abduction.strainLevel * dt * 0.8);
      if (this.abduction.strainTarget && this.strainShownTime <= 0) r.onStrain();
      this.strainShownTime = 0.3;
    }
    this.strainShownTime = Math.max(0, this.strainShownTime - dt);
    r.checkTierUp(this.stats.baseBeamTier);

    // life
    this.npcs.update(dt, this.ufo.position, this.stats.radius, r.threat.alert, this.cameraCtl.focus);
    this.traffic.update(dt, this.ufo.position, this.stats.radius);
    this.enemies.spawningEnabled = playing && MODES[this.run.mode].enemies;
    this.enemies.update(dt, r.time, this.playerSnapshot(), r.threat.alert);
    if (this.pvp?.active) this.pvp.update(dt, playing, beamOn);
    if (this.arena?.active) {
      this.arena.update(dt, playing && this.arenaEndTimer < 0, beamOn);
      if (this.arenaEndTimer >= 0) {
        this.arenaEndTimer -= dt;
        if (this.arenaEndTimer < 0) {
          this.endRun('extracted');
          return;
        }
      }
    }

    // shield / hull
    if (this.shield.update(dt, this.ufo.position, this.stats.radius, this.stats.maxShield, this.stats.shieldRegen)) {
      this.hud.toast('ESCUDO RESTAURADO', '', 'info', 1.4);
      this.bus.emit('shield:restored', {});
    }
    if (this.damage.dead && this.state === 'playing') {
      this.state = 'dying';
      this.evoDock.close();
      this.endTimer = 2;
      this.input.enabled = false;
      this.abduction.dropAll();
      this.audio.crash();
      this.time.slowMo(0.3, 0.8);
      this.hud.showBanner('NAVE ATINGIDA', 'PERDENDO ALTITUDE', 'var(--warning-red)');
    }

    this.updateTutorial(dt);
    this.updateAudioState(dt);
    this.updateHUD(dt);
    this.ufoVisuals.setAccent(r.combo.frenzy ? 0xc28bff : this.state === 'extracting' ? 0xffffff : 0x5dffa0);
    this.beam.setColor(r.combo.frenzy ? 0xb36bff : this.state === 'extracting' ? 0xffffff : 0x4dffa0);
    this.ufoVisuals.update(dt, this.abduction.load + (r.combo.frenzy ? 0.6 : 0));
  }

  private fireEMP(mult: number): void {
    const radius = this.stats.empRadius * mult;
    const n = this.enemies.applyEMP(this.ufo.position, radius);
    this.vfx.empWave(this.ufo.position, radius);
    this.audio.empBlast();
    this.lighting.pulseFlicker(1);
    worldUniforms.uEmitStrength.value = 0;
    this.bus.emit('emp:fired', { position: this.ufo.position, radius });
    if (n >= 3) this.hud.floatText(this.ufo.position, `EMP x${n}`, 'var(--energy-cyan)', 26);
  }

  private updateAudioState(_dt: number): void {
    const r = this.run;
    this.audio.listenerX = this.cameraCtl.focus.x;
    this.audio.listenerZ = this.cameraCtl.focus.z;
    this.audio.listenerRange = 40 + this.cameraCtl.distance * 1.2;
    this.audio.setBeam(this.beamActive, this.abduction.load, r.combo.count, r.combo.frenzy);
    this.audio.setStrain(this.state === 'playing' ? this.abduction.strainLevel : 0);
    this.audio.setMusic({ mode: 'run', alert: r.threat.alert, combo: r.combo.count, frenzy: r.combo.frenzy, boss: !!this.enemies.boss && this.enemies.boss.alive });
    if (this.enemies.lockActive) this.audio.lockBeep(true);
  }

  private updateHUD(dt: number): void {
    const r = this.run;
    const hud = this.hud;
    const pr = r.progression;
    hud.setLevel(pr.level, pr.levelProgress);
    const baseTier = this.stats.baseBeamTier;
    const tierFloor = Math.floor(baseTier + 1e-4);
    hud.setMassClass(tierFloor, baseTier - tierFloor);
    hud.setScore(r.stats.score);
    hud.setCombo(r.combo.count, r.combo.timerFraction, r.combo.frenzy, this.time.realDelta);
    hud.setAlert(r.threat.alert, r.threat.progress);
    hud.setHull(this.damage.fraction, this.damage.hull);
    hud.setShield(this.shield.fraction);
    hud.setTimer(r.time);
    hud.setEMP(this.emp.fraction, this.emp.ready);
    hud.setDash(this.stats.dashUnlocked, this.stats.dashCooldown > 0 ? 1 - this.dashCooldown / this.stats.dashCooldown : 1);
    const dashReady = this.dashCooldown <= 0;
    if (dashReady && !this.wasDashReady && this.stats.dashUnlocked) this.haptics.light();
    this.wasDashReady = dashReady;
    const p = this.ufo.position;
    this.coordsTimer -= dt;
    if (this.coordsTimer <= 0) {
      this.coordsTimer = 0.4;
      hud.setCoords(`${this.world.districtName(p.x, p.z).toUpperCase()} · ${(this.city.lat - p.z * 0.00009).toFixed(4)}° ${(this.city.lon + p.x * 0.0001).toFixed(4)}°`);
    }
    hud.showDistrict('', '', this.time.realDelta);

    // strain widget: anchored above the object that resists
    const st = this.abduction.strainTarget;
    if (st && this.abduction.strainLevel > 0.08) {
      _v.copy(st.pos).setY(st.pos.y + st.model.height * st.scale + 1).project(this.cameraCtl.camera);
      const sx = (_v.x * 0.5 + 0.5) * this.renderer.width;
      const sy = (-_v.y * 0.5 + 0.5) * this.renderer.height;
      const required = st.tier;
      const prog = clamp(this.stats.beamTier - (required - 1), 0, 0.99);
      const matterNeeded = Math.max(0, matterForTierThreshold(required) - pr.matter);
      hud.setStrain(true, sx, sy, prog, `CLASSE ${required} · ${TIER_NAMES[required] ?? ''}${matterNeeded > 0 ? ` · FALTAM ${formatInt(matterNeeded)} DE MATÉRIA` : ''}`);
      this.bus.emit('object:strain', { uid: st.uid, defId: st.def.id, progress: prog, requiredTier: required, position: st.pos });
    } else hud.setStrain(false, 0, 0, 0, '');

    // incoming missiles
    this.enemies.incomingMissiles(p, this.missileScratch);
    const points: Array<{ x: number; y: number; angle: number; close: boolean }> = [];
    const w = this.renderer.width;
    const hh = this.renderer.height;
    for (const m of this.missileScratch) {
      _v.copy(m.pos).project(this.cameraCtl.camera);
      let sx = (_v.x * 0.5 + 0.5) * w;
      let sy = (-_v.y * 0.5 + 0.5) * hh;
      const behind = _v.z > 1;
      const cx = w / 2;
      const cy = hh / 2;
      let dx = sx - cx;
      let dy = sy - cy;
      if (behind) {
        dx = -dx;
        dy = -dy;
      }
      const margin = 34;
      const k = Math.min((w / 2 - margin) / Math.max(1e-3, Math.abs(dx)), (hh / 2 - margin) / Math.max(1e-3, Math.abs(dy)), 1);
      sx = cx + dx * k;
      sy = cy + dy * k;
      const angle = Math.atan2(dy, dx) + Math.PI / 2;
      points.push({ x: sx, y: sy, angle, close: m.pos.distanceTo(p) < 40 + this.stats.radius * 2 });
      if (points.length >= 6) break;
    }
    hud.setMissiles(points);

    const boss = this.enemies.boss;
    hud.setBoss(!!boss && boss.alive, boss ? boss.shieldFraction : 0, boss ? boss.hullFraction : 0);

    // radar
    this.blips.length = 0;
    for (const e of this.enemies.enemies) if (e.alive) this.blips.push({ x: e.pos.x, z: e.pos.z, kind: e instanceof BossController ? 'boss' : 'enemy' });
    for (const m of this.missileScratch) this.blips.push({ x: m.pos.x, z: m.pos.z, kind: 'missile' });
    if (r.eventMarker) this.blips.push({ x: r.eventMarker.x, z: r.eventMarker.z, kind: 'event' });
    const hint = r.tierHintTarget;
    if (hint) this.blips.push({ x: hint.pos.x, z: hint.pos.z, kind: 'rare' });
    // landmark objectives always show on the radar
    for (const o of this.landmarkTargets) if (o.alive) this.blips.push({ x: o.pos.x, z: o.pos.z, kind: 'event' });
    this.arena?.blips(this.blips);
    this.pvp?.blips(this.blips);
    hud.drawRadar(dt, p.x, p.z, 110 + this.stats.radius * 10, this.blips, this.time.realElapsed);
    hud.updateFloats(this.time.realDelta, this.cameraCtl.camera, w, hh);
  }

  private renderFrame(dt: number, rdt: number): void {
    const r = this.run;
    const focus = this.state === 'menu' ? this.ufo.position : this.cameraCtl.focus;
    const frenzy = !!r && r.combo.frenzy && this.state === 'playing';
    const extraZoom = frenzy ? 1.18 : 1;
    const fovBoost = (this.ufo?.isDashing ? 9 : 0) + (frenzy ? 5 : 0);
    this.cameraCtl.update(rdt, this.ufo.position, this.ufo.velocity, this.stats.scale, this.stats.speed, extraZoom, fovBoost);
    const cam = this.cameraCtl.camera;
    this.sky.follow(cam.position);
    this.sky.uniforms.uTime.value += dt;
    this.clouds.update(dt, this.cameraCtl.camera.position, this.ufo.position);

    // world shader uniforms
    worldUniforms.uTime.value += dt;
    worldUniforms.uCloudOffset.value.set(worldUniforms.uTime.value * 0.004, worldUniforms.uTime.value * 0.0016);
    worldUniforms.uEmitStrength.value = damp(worldUniforms.uEmitStrength.value, 1, 1.2, rdt) * (Math.random() < 0.02 && worldUniforms.uEmitStrength.value < 0.9 ? 0.3 : 1);
    const ground = this.world.groundAt(this.ufo.position.x, this.ufo.position.z);
    worldUniforms.uBeamSpot.value.set(this.ufo.position.x, this.ufo.position.y, this.ufo.position.z);
    worldUniforms.uBeamRadius.value = this.stats.beamRadius;
    worldUniforms.uBeamIntensity.value = this.beam.intensity * (0.45 + (this.abduction?.load ?? 0) * 0.3);
    worldUniforms.uBeamColor.value.copy(this.beam.color);
    this.world.wires.uniforms.uTime.value += dt;
    this.world.wires.uniforms.uUfo.value.copy(this.ufo.position);
    this.world.wires.uniforms.uWind.value = this.stats.scale * 0.3 + (this.abduction?.load ?? 0);

    const beamPower = (r ? Math.min(3, r.combo.count / 15) : 0) + (this.ufo.stillFactor ?? 0) * 0.8 + (frenzy ? 2 : 0);
    this.beam.update(dt, this.ufo.position, ground, this.stats.radius, this.stats.beamRadius, beamPower, this.stats.satellites, this.stats.beamRadius * this.stats.satelliteRadiusMult, (x, z) => this.world.groundAt(x, z));
    // flying over the sea/river: ripples, wake and a column of water in the beam
    const up = this.ufo.position;
    const overWater = this.state !== 'results' && this.ufoVisuals.root.visible && this.world.grid.isWaterAt(up.x, up.z);
    this.waterFx.update(dt, overWater, up, this.ufo.velocity, this.stats.radius, this.stats.beamRadius, this.beam.intensity > 0.3);
    if (this.beam.intensity > 0.2 && (this.state === 'playing' || this.state === 'menu')) {
      this.vfx.beamParticles(this.ufo.position, ground, this.ufo.position.y - this.stats.radius * 0.3, this.stats.beamRadius, this.beam.color, 14 + this.stats.beamRadius * 3 + (this.abduction?.load ?? 0) * 25, dt);
      // anticipation: dust converging into the beam
      if (Math.random() < dt * (6 + this.stats.beamRadius)) {
        const a = Math.random() * Math.PI * 2;
        const rr = this.stats.beamRadius * (1.1 + Math.random() * 0.8);
        _v.set(this.ufo.position.x + Math.cos(a) * rr, ground + 0.2, this.ufo.position.z + Math.sin(a) * rr);
        this.vfx.particles.single(false, _v.x, _v.y, _v.z, -Math.cos(a) * rr * 0.8, 0.8, -Math.sin(a) * rr * 0.8, _c.setHex(0xd9ccb0), 1.1, 0.4 + this.stats.radius * 0.1, 1, -0.2, 1.5, 0.45);
      }
    }
    if (this.state === 'playing') this.vfx.ufoTrail(this.ufo.position, this.ufo.velocity, this.stats.radius, this.beam.color, dt);
    this.vfx.update(dt);
    this.accent.copy(this.beam.color);
    this.dynPool.setRimColor(this.accent);
    this.abduction?.setRimColor(this.accent.getHex());

    this.chunks.detailDistance = Math.max(80, this.cameraCtl.distance * 4.2) * (this.quality.level <= 1 ? 0.75 : 1);
    this.chunks.update(rdt, focus);
    this.birds.update(dt, this.ufo.position, this.stats.radius);
    this.npcs.detailDistance = this.chunks.detailDistance * 1.1;
    const alert = r && this.state !== 'menu' ? r.threat.alert : 0;
    this.lighting.update(rdt, focus, this.cameraCtl.distance, alert, frenzy, this.state === 'extracting');
    this.post.update(rdt);
    const gl = this.renderer.gl;
    gl.info.reset();
    this.post.render(this.scene, cam, this.time.realElapsed);
  }

  // ───────────────────────────────────────────── debug

  private createDebug(): void {
    const give = (matter: number) => {
      const lv = this.run.progression.addMatter(matter);
      if (lv > 0) this.onLevelsGained(lv);
    };
    this.debugPanel = new DebugPanel(this.ui, {
      '+XP': () => give(Math.max(20, this.run.progression.matter * 0.5)),
      '+Level': () => give(Math.max(10, this.run.progression.matter * 0.3 + 10)),
      '+Threat': () => this.run.addThreat(Math.max(15, this.run.threat.threat * 0.8)),
      'Alert +1': () => {
        const l = this.run.threat.setAlert(this.run.threat.alert + 1, this.run.time);
        if (l !== null) this.run.addThreat(0.01);
      },
      'Spawn Jet': () => this.enemies.spawn('jet', this.playerSnapshot()),
      'Jet Intro': () => this.enemies.startJetIntro(),
      'Spawn Heli': () => this.enemies.spawn('helicopter', this.playerSnapshot()),
      'Spawn Drone': () => this.enemies.spawn('drone', this.playerSnapshot()),
      'Spawn Police': () => this.enemies.spawn('police', this.playerSnapshot()),
      'Spawn Car': () => this.world.spawn('hatch', this.ufo.position.x + 3, -1, this.ufo.position.z, 0),
      'Spawn Bus': () => this.world.spawn('onibus', this.ufo.position.x + 5, -1, this.ufo.position.z, 0),
      'Spawn Boss': () => this.enemies.spawn('boss', this.playerSnapshot()),
      'God Mode': () => {
        this.godMode = !this.godMode;
        this.hud.toast(`GOD MODE ${this.godMode ? 'ON' : 'OFF'}`, '', 'info', 1);
      },
      'Max Beam': () => {
        this.maxBeam = !this.maxBeam;
        this.hud.toast(`MAX BEAM ${this.maxBeam ? 'ON' : 'OFF'}`, '', 'info', 1);
      },
      Frenzy: () => this.run.combo.forceFrenzy(),
      'Max Upgr.': () => this.upgrades.maxAll(),
      Event: () => this.run.director.forceStart(['festa_rua', 'carro_forte', 'meteoros', 'lendario', 'carreta', 'invasao_militar'][Math.floor(Math.random() * 6)] as 'festa_rua', this.run.time),
      '+5 min': () => {
        this.run.time += 300;
      },
      Extract: () => {
        if (this.run.time < 300) this.run.time = 300;
        this.startExtraction();
      },
      Kill: () => this.applyPlayerDamage(9999, null),
      '+1000 cores': () => {
        this.meta.addCores(1000);
        this.refreshMenu();
      },
      Quality: () => this.quality.setPreset((['baixa', 'media', 'alta', 'auto'] as const)[(this.quality.level + 1) % 4] ?? 'auto'),
    });
  }

  private updateDebug(rdt: number): void {
    const info = this.renderer.gl.info;
    this.debugPanel?.update(rdt, {
      fps: this.quality.fps,
      frameMs: 1000 / Math.max(1, this.quality.fps),
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      objects: this.world.aliveCount,
      dynamic: this.abduction.active.length,
      npcs: this.npcs.activeCount,
      enemies: this.enemies.activeCount,
      bullets: this.enemies.bullets.activeCount,
      missiles: this.enemies.missiles.activeCount,
      particles: this.vfx.particles.liveCount,
      threat: this.run.threat.threat,
      alert: this.run.threat.alert,
      tier: this.run.progression.tier,
      beamTier: this.stats.beamTier,
      level: this.run.progression.level,
      capacity: this.stats.capacity,
      beamRadius: this.stats.beamRadius,
      scale: this.stats.scale,
      quality: this.quality.current.name,
      renderScale: this.renderer.renderScale,
      multiDraw: this.renderer.supportsMultiDraw,
      time: this.run.time,
    });
  }

  /** Test hook: meta node info for tooling. */
  metaName(id: string): string {
    return META_BY_ID.get(id as never)?.name ?? id;
  }

  objectName(id: string): string {
    return getObjectDef(id).name;
  }

  get camera(): PerspectiveCamera {
    return this.cameraCtl.camera;
  }
}

const _c = new Color();
