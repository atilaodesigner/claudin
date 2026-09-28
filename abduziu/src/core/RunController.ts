import { AdditiveBlending, CylinderGeometry, Mesh, MeshBasicMaterial, SphereGeometry, TorusGeometry, Vector3, type Scene } from 'three';
import { DISTRICTS } from '../config/districts';
import { CITIES, getCity, type CityDef } from '../config/cities';
import { MODES, type GameMode } from '../config/modes';
import type { ChallengeKind } from '../config/challenges';
import { ENEMIES, type EnemyKind } from '../config/enemies';
import { EVENT_VALUES } from '../config/events';
import { BALANCE } from '../config/gameBalance';
import { OBJECTS, RARITY_INFO, TIER_NAMES } from '../config/objects';
import { UPGRADE_VALUES } from '../config/upgrades';
import { ChallengeSystem } from '../progression/ChallengeSystem';
import { ComboSystem } from '../progression/ComboSystem';
import { EventDirector, type ActiveEvent } from '../progression/EventDirector';
import { HighlightManager } from '../progression/HighlightManager';
import { matterForTier, RunProgression } from '../progression/RunProgression';
import { computeCores, extractionMultiplierAt, nextExtractionTier, objectScore } from '../progression/ScoreSystem';
import { ThreatSystem } from '../progression/ThreatSystem';
import { formatInt, formatTime } from '../utils/math';
import { Rng } from '../utils/rng';
import { AState, type Abductable } from '../world/Abductable';
import type { Game } from './Game';

export interface RunStats {
  score: number;
  objects: number;
  massKg: number;
  enemiesDestroyed: number;
  jetsCaptured: number;
  discoveries: number;
  maxAlert: number;
  bonusCores: number;
  bossDefeated: boolean;
}

interface Meteor {
  mesh: Mesh;
  from: Vector3;
  to: Vector3;
  t: number;
  dur: number;
  active: boolean;
}

const _v = new Vector3();
const SECRET_IDS = OBJECTS.filter((o) => o.secret).map((o) => o.id);
const CITY_SECRETS = new Set(CITIES.map((c) => c.secret));
const CASUAL_SKIP = new Set<ChallengeKind>(['destroy_enemy', 'capture_jet', 'survive_max_alert', 'reach_alert', 'perfect_dodge', 'no_damage_streak']);

/** Gameplay rules of a single invasion (run). */
export class RunController {
  readonly progression = new RunProgression();
  readonly combo = new ComboSystem();
  readonly threat = new ThreatSystem();
  readonly challenges = new ChallengeSystem();
  readonly highlights: HighlightManager;
  readonly director: EventDirector;
  stats: RunStats = this.freshStats();
  time = 0;
  daily = false;
  mode: GameMode = 'campanha';
  city: CityDef = getCity('nova_aurora');
  /** Seed of the current run (ranked submissions carry it). */
  seed = 0;
  rng = new Rng(1);
  chainStacks = 0;
  private chainTimer = 0;
  perfectDodgeTimer = 0;
  lastTier = 1;
  extractionOffered = 0;
  channeling = 0;
  beamOffline = 0;
  private strainHintShown = false;
  private enemyHintShown = false;
  private missileHintShown = false;
  private lastDistrict = '';
  private readonly eventObjects: Abductable[] = [];
  eventMarker: Vector3 | null = null;
  private readonly beacon: Mesh;
  private readonly portal: Mesh;
  readonly portalPos = new Vector3();
  private readonly meteors: Meteor[] = [];
  private meteorTimer = 0;
  private stormTimer = 0;
  private legendary: Abductable | null = null;
  bestComboRecord = 0;
  private rareScanTimer = 0;
  private readonly rareScratch: Abductable[] = [];

  constructor(
    private readonly game: Game,
    scene: Scene,
  ) {
    this.highlights = new HighlightManager(game.bus);
    this.director = new EventDirector(this.rng);
    this.director.onStart = (e) => this.onEventStart(e);
    this.director.onEnd = (e, ok) => this.onEventEnd(e, ok);
    this.director.onTick = (e, dt) => this.onEventTick(e, dt);
    this.challenges.onComplete = (i, c) => {
      if (this.mode === 'campanha') game.hud.toast('★ ESTRELA CONQUISTADA', c.title, 'gold', 2.8);
      else game.hud.toast('DESAFIO CONCLUÍDO', `${c.title} · +${c.reward} CORES`, 'gold', 2.6);
      game.audio.ui('buy');
      game.bus.emit('challenge:complete', { index: i, title: c.title, reward: c.reward });
    };

    this.beacon = new Mesh(new CylinderGeometry(1.2, 1.2, 160, 12, 1, true), new MeshBasicMaterial({ color: 0xffcf3f, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false }));
    this.beacon.visible = false;
    this.beacon.frustumCulled = false;
    scene.add(this.beacon);
    this.portal = new Mesh(new TorusGeometry(18, 1.6, 12, 64), new MeshBasicMaterial({ color: 0xeafff6, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }));
    const inner = new Mesh(new SphereGeometry(16, 24, 12), new MeshBasicMaterial({ color: 0x9dffd0, transparent: true, opacity: 0.18, blending: AdditiveBlending, depthWrite: false }));
    inner.scale.set(1, 1, 0.12);
    this.portal.add(inner);
    this.portal.visible = false;
    scene.add(this.portal);
    const meteorMat = new MeshBasicMaterial({ color: 0xffa040, blending: AdditiveBlending, transparent: true, depthWrite: false });
    for (let i = 0; i < 6; i++) {
      const m = new Mesh(new SphereGeometry(1.4, 10, 8), meteorMat);
      m.visible = false;
      scene.add(m);
      this.meteors.push({ mesh: m, from: new Vector3(), to: new Vector3(), t: 0, dur: 1, active: false });
    }
  }

  private freshStats(): RunStats {
    return { score: 0, objects: 0, massKg: 0, enemiesDestroyed: 0, jetsCaptured: 0, discoveries: 0, maxAlert: 0, bonusCores: 0, bossDefeated: false };
  }

  start(seed: number, mode: GameMode, city: CityDef): void {
    this.rng = new Rng(seed);
    this.seed = seed;
    this.mode = mode;
    this.city = city;
    this.daily = mode === 'diaria';
    this.progression.reset();
    // the whole city as it stands when the stage starts
    this.cityTotal = Math.max(1, this.countCity(99).alive);
    this.cityTimer = 0.5;
    this.noLiftTimer = 0;
    this.cityMilestone = 0;
    this.cityCleared = 0;
    this.cityDone = false;
    this.autoExtract = -1;
    this.combo.reset();
    this.threat.reset();
    this.highlights.reset();
    this.director.reset(this.rng.fork(99));
    this.director.blocked = new Set(MODES[mode].enemies ? [] : ['invasao_militar']);
    if (mode === 'campanha') this.challenges.setFixed(city.stars);
    else this.challenges.roll(this.rng.fork(7), 3, MODES[mode].enemies ? new Set() : CASUAL_SKIP);
    this.stats = this.freshStats();
    this.time = 0;
    this.chainStacks = 0;
    this.chainTimer = 0;
    this.perfectDodgeTimer = 0;
    this.lastTier = 1;
    this.extractionOffered = 0;
    this.channeling = 0;
    this.beamOffline = 0;
    this.strainHintShown = false;
    this.enemyHintShown = false;
    this.missileHintShown = false;
    this.lastDistrict = '';
    this.eventObjects.length = 0;
    this.eventMarker = null;
    this.beacon.visible = false;
    this.portal.visible = false;
    this.legendary = null;
    this.tierHint = null;
    this.tierHintTimer = 0;
    for (const m of this.meteors) {
      m.active = false;
      m.mesh.visible = false;
    }
    this.bestComboRecord = this.game.save.get().records.bestCombo;
    this.game.hud.setObjectives(this.challenges.active, this.mode === 'campanha', this.objectiveHeading);
  }

  // ─── city cleared: nothing left to abduct ends the stage (no idle wait for the portal)
  private cityTotal = 0;
  private cityTimer = 0;
  private noLiftTimer = 0;
  private cityMilestone = 0;
  /** Share of the city already abducted (0..1). */
  cityCleared = 0;
  /** The city ran out: the portal opens right away. */
  cityDone = false;

  get extractionMultiplier(): number {
    // arena rounds end on the clock: no portal
    if (this.mode === 'arena' || this.mode === 'online') return 0;
    const t = extractionMultiplierAt(this.time);
    return this.cityDone ? Math.max(1, t) : t;
  }

  /** Objects of the city itself (enemy wrecks don't count). */
  private countCity(liftTier: number): { alive: number; liftable: number } {
    let alive = 0;
    let liftable = 0;
    for (const o of this.game.world.objects) {
      if (!o.alive || o.enemyKind) continue;
      alive++;
      if (o.tier <= liftTier) liftable++;
    }
    return { alive, liftable };
  }

  private updateCityClear(dt: number): void {
    if (this.mode === 'arena' || this.mode === 'online' || this.cityDone) return;
    this.cityTimer -= dt;
    if (this.cityTimer > 0) return;
    this.cityTimer = 1;
    const g = this.game;
    const { alive, liftable } = this.countCity(Math.floor(g.stats.baseBeamTier + 0.5));
    if (this.cityTotal <= 0) this.cityTotal = Math.max(1, alive);
    this.cityCleared = Math.max(0, Math.min(1, 1 - alive / this.cityTotal));
    for (const m of [0.5, 0.75, 0.9]) {
      if (this.cityCleared >= m && this.cityMilestone < m) {
        this.cityMilestone = m;
        g.hud.toast(`${Math.round(m * 100)}% DA CIDADE ABDUZIDA`, m >= 0.9 ? 'Quase limpa! Pegue o que sobrou.' : '', 'gold', 2.4);
      }
    }
    // what's left is too heavy for the beam: don't make the player hover around waiting
    this.noLiftTimer = liftable === 0 ? this.noLiftTimer + 1 : 0;
    if (this.cityCleared >= 0.97 || this.noLiftTimer >= 8) this.finishCity();
  }

  private finishCity(): void {
    const g = this.game;
    this.cityDone = true;
    const bonus = Math.round(20000 + this.cityCleared * 30000);
    this.stats.score += bonus;
    this.stats.bonusCores += 60;
    const clean = this.cityCleared >= 0.97;
    g.hud.showBanner(clean ? 'CIDADE LIMPA!' : 'NADA MAIS PRA ABDUZIR', `BÔNUS +${bonus.toLocaleString('pt-BR')} · EXTRAINDO...`, 'var(--gold)');
    g.audio.levelUp();
    g.bus.emit('extraction:available', { multiplier: this.extractionMultiplier });
    this.autoExtract = 2.6;
  }

  /** Seconds until the automatic extraction after the city is cleared (<0 = off). */
  autoExtract = -1;

  // ───────────────────────────────────────────── reward pipeline

  onAbsorbed(obj: Abductable): void {
    const g = this.game;
    const def = obj.def;
    const tier = def.tier;
    const rarity = RARITY_INFO[obj.rarity];
    const district = DISTRICTS[obj.district];
    const frenzy = this.combo.frenzy;

    let matter = matterForTier(tier, def.matterMult ?? 1) * g.stats.matterMult * district.matterMult * (1 + (rarity.mult - 1) * 0.5);
    if (frenzy) matter *= 1.25;
    const res = this.combo.register(tier);
    let score = objectScore({
      massKg: def.massKg,
      comboMultiplier: this.combo.multiplier,
      alert: this.threat.alert,
      riskMultiplier: Math.max(1, this.extractionMultiplier),
      rarityMultiplier: rarity.mult,
    });
    let threat = matter * BALANCE.threat.perMatter * district.threatMult;
    const enemyKind = obj.enemyKind as EnemyKind | null;
    if (enemyKind && obj.eventTag !== 'counted') {
      const es = ENEMIES[enemyKind];
      score += es.scoreOnDestroy;
      threat += es.threatOnDestroy;
      this.stats.enemiesDestroyed++;
      this.challenges.onEnemyDestroyed(enemyKind === 'heavydrone' ? 'drone' : enemyKind);
    }
    this.stats.score += score;
    this.stats.objects++;
    this.stats.massKg += def.massKg;
    this.addThreat(threat);

    // COLHEITA EM CADEIA
    const chainLvl = g.upgrades.level('colheita_cadeia');
    if (chainLvl > 0) {
      this.chainStacks = Math.min(chainLvl * UPGRADE_VALUES.colheita_cadeia.maxStacksPerLevel, this.chainStacks + 1);
      this.chainTimer = UPGRADE_VALUES.colheita_cadeia.duration;
    }

    const levels = this.progression.addMatter(matter);
    if (levels > 0) g.onLevelsGained(levels);

    // audio / vfx
    g.audio.abductPop(tier, this.combo.count, obj.rarity !== 'normal', obj.pos.x, obj.pos.z);
    g.vfx.absorb(g.ufo.position, tier, g.stats.radius, this.combo.count, obj.rarity !== 'normal', obj.rarity !== 'normal' ? rarity.color : 0x7dffb0);
    g.beam.onAbsorb();
    g.ufoVisuals.damageFlash = 0;
    if (tier >= 5 || obj.rarity !== 'normal' || enemyKind) {
      g.hud.floatText(_v.copy(g.ufo.position).setY(g.ufo.position.y + g.stats.radius), `+${formatInt(score)}`, obj.rarity !== 'normal' ? `#${rarity.color.toString(16).padStart(6, '0')}` : 'var(--alien-green)', 16 + Math.min(10, tier * 1.2));
    }

    if (res.milestone) {
      g.audio.comboMilestone(res.milestone);
      if (res.milestone >= 10) g.hud.floatText(_v.copy(g.ufo.position).setY(g.ufo.position.y + g.stats.radius * 1.6), `COMBO x${res.milestone}!`, 'var(--gold)', 26, 1.2);
    }
    if (res.frenzyStarted) this.startFrenzy();
    this.challenges.onCombo(this.combo.count);
    if (this.combo.count > this.bestComboRecord && this.bestComboRecord >= 10 && this.combo.count === this.bestComboRecord + 1) {
      g.hud.toast('NOVO RECORDE DE COMBO!', `x${this.combo.count}`, 'gold');
      this.highlights.record({ kind: 'combo_record', label: `COMBO RECORDE x${this.combo.count}`, score: this.combo.count * 1000, time: this.time });
    }

    // dex + discovery
    const save = g.save.get();
    const isNew = !save.dex[def.id];
    const combo = this.combo.count;
    g.save.update((d) => {
      const e = d.dex[def.id] ?? { count: 0, firstCaptureAt: Date.now(), bestCombo: 0 };
      e.count++;
      e.bestCombo = Math.max(e.bestCombo, combo);
      d.dex[def.id] = e;
    });
    if (isNew) {
      this.stats.discoveries++;
      g.hud.toast('NOVO OBJETO DESCOBERTO', `#${def.dex.toString().padStart(3, '0')} · ${def.name}`, def.secret ? 'alien' : 'info', 2.6);
      g.audio.discovery();
      if (tier >= 1 || def.secret) g.vfx.discovery(g.ufo.position, def.secret ? RARITY_INFO[obj.rarity].color : 0x3ee8ff);
      g.bus.emit('object:discovered', { defId: def.id, name: def.name, dexNumber: def.dex });
    }

    // highlights (clip moments)
    if (enemyKind === 'jet') {
      this.stats.jetsCaptured++;
      this.stats.score += 50000;
      this.highlights.record({ kind: 'jet_capture', label: 'AIR FORCE ABDUCTION', score: 50000, time: this.time, position: obj.pos.clone() });
      g.hud.showBanner('AIR FORCE ABDUCTION', '+50.000', 'var(--energy-cyan)');
      g.time.slowMo(0.25, 0.7);
      g.post.flashScreen(0.3, 0xb8f7ff);
      g.cameraCtl.dramatic(0.85, 0.8);
      g.haptics.strong();
    } else if (enemyKind === 'boss') {
      this.stats.score += 250000;
      this.stats.bossDefeated = true;
      this.highlights.record({ kind: 'boss', label: 'TUCANO NEGRO ABDUZIDO', score: 250000, time: this.time, position: obj.pos.clone() });
      g.hud.showBanner('TUCANO NEGRO ABDUZIDO', '+250.000', '#ff9f1c');
      g.time.slowMo(0.2, 0.8);
      g.post.flashScreen(0.6, 0xffe0b0);
      g.vfx.frenzy(g.ufo.position, g.stats.radius);
      this.stats.bonusCores += 300;
    } else if (tier >= 8) {
      this.highlights.record({ kind: 'building_abduction', label: def.name.toUpperCase(), score, time: this.time, position: obj.pos.clone() });
      g.hud.showBanner('PRÉDIO INTEIRO!', def.name.toUpperCase(), 'var(--gold)');
      g.time.slowMo(0.3, 0.6);
      g.cameraCtl.addTrauma(0.5);
    } else if (def.secret) {
      this.highlights.record({ kind: 'legendary', label: def.name.toUpperCase(), score, time: this.time });
      g.hud.showBanner('OBJETO LENDÁRIO', def.name.toUpperCase(), 'var(--frenzy-violet)');
      this.stats.bonusCores += 40;
    }
    if (obj === this.legendary) {
      this.legendary = null;
      this.beacon.visible = false;
      this.eventMarker = null;
    }
    if (obj.eventTag === 'carro_forte' && this.director.active?.def.id === 'carro_forte') {
      this.stats.bonusCores += EVENT_VALUES.carroForte.coreBonus;
      g.hud.toast('CARRO-FORTE CAPTURADO!', `+${EVENT_VALUES.carroForte.coreBonus} ALIEN CORES`, 'gold');
      this.director.finish(true);
    }

    this.challenges.onAbduct(def.tags, def.massKg, def.id);
    if (def.tags.includes('radar')) g.hud.toast('RADAR NEUTRALIZADO', 'A base está cega', 'warn');
    g.bus.emit('object:abduct:complete', {
      uid: obj.uid,
      defId: def.id,
      tier,
      massKg: def.massKg,
      rarity: obj.rarity,
      position: obj.pos,
      isEnemy: !!enemyKind,
      enemyKind: enemyKind ?? undefined,
      score,
      matter,
      combo: this.combo.count,
    });
    g.onTutorialAbduct();
  }

  onEnemyKilled(kind: EnemyKind, byMissile: boolean, pos: Vector3): void {
    const es = ENEMIES[kind];
    this.stats.enemiesDestroyed++;
    this.stats.score += es.scoreOnDestroy;
    this.addThreat(es.threatOnDestroy);
    this.challenges.onEnemyDestroyed(kind === 'heavydrone' ? 'drone' : kind);
    if (byMissile) {
      this.game.hud.floatText(pos, 'MÍSSIL AMIGO!', 'var(--warning-orange)', 22, 1.2);
      this.stats.score += 5000;
    }
    this.game.bus.emit('enemy:destroyed', { kind, id: -1, position: pos, byMissile, abducted: false });
  }

  addThreat(amount: number): void {
    const g = this.game;
    // casual: nobody is coming
    if (!MODES[this.mode].enemies) return;
    const mult = DISTRICTS[g.world.districtAt(g.ufo.position.x, g.ufo.position.z)].threatMult;
    const lvl = this.threat.add(amount * (mult > 1.5 ? 1.2 : 1) * this.city.threatMult, this.time);
    if (lvl !== null) this.onAlertUp(lvl);
  }

  private onAlertUp(level: number): void {
    const g = this.game;
    this.stats.maxAlert = Math.max(this.stats.maxAlert, level);
    this.director.markNovelty(this.time);
    this.challenges.onAlert(level);
    g.audio.alertUp(level);
    g.bus.emit('alert:changed', { level, previous: level - 1 });
    const names = ['', 'VIATURAS A CAMINHO', 'DRONES NO AR', 'HELICÓPTEROS SE APROXIMANDO', 'CAÇAS DA FORÇA SENTINELA', 'UNIDADES ESPECIAIS', 'PROTOCOLO CÉU VERMELHO'];
    if (level >= 6) {
      g.hud.showBanner('PROTOCOLO CÉU VERMELHO', 'TODO O ESPAÇO AÉREO CONTRA VOCÊ', 'var(--warning-red)');
      g.post.flashScreen(0.3, 0xff4d4d);
      g.cameraCtl.addTrauma(0.4);
    } else {
      g.hud.toast(`ALERTA ${level}`, names[level] ?? '', level >= 4 ? 'danger' : 'warn', 2.4);
    }
    if (level === 1 && !this.enemyHintShown) {
      this.enemyHintShown = true;
      setTimeout(() => g.hud.toast('A CIDADE PERCEBEU VOCÊ', 'Continue abduzindo. Use o EMP contra ameaças.', 'info', 3), 2600);
    }
  }

  private startFrenzy(): void {
    const g = this.game;
    g.audio.frenzy();
    g.vfx.frenzy(g.ufo.position, g.stats.radius);
    g.hud.showBanner('ABDUCTION FRENZY', `COMBO x${this.combo.count}`, 'var(--frenzy-violet)');
    g.bus.emit('combo:frenzy', { active: true });
    this.highlights.record({ kind: 'frenzy', label: `FRENZY x${this.combo.count}`, score: this.combo.count * 500, time: this.time });
  }

  onPerfectDodge(pos: Vector3): void {
    const g = this.game;
    this.perfectDodgeTimer = BALANCE.player.perfectDodgeBuffTime;
    this.challenges.onPerfectDodge();
    this.stats.score += 2500;
    g.hud.floatText(pos, 'PERFECT DODGE', 'var(--gold)', 24, 1.1);
    g.vfx.perfectDodge(g.ufo.position);
    g.audio.perfectDodge();
    g.bus.emit('player:perfectDodge', { position: pos });
  }

  onDamaged(): void {
    this.challenges.onDamage();
    if (!this.missileHintShown && this.game.enemies.missiles.activeCount > 0) {
      this.missileHintShown = true;
      this.game.hud.toast('DESVIE DOS MÍSSEIS', 'Faça curvas, passe atrás de prédios ou use o EMP', 'info', 3);
    }
  }

  onStrain(): void {
    if (this.strainHintShown) return;
    this.strainHintShown = true;
    this.game.hud.toast('PODER INSUFICIENTE', 'Suba de nível para puxar objetos mais pesados', 'warn', 2.8);
  }

  checkTierUp(baseBeamTier: number): void {
    const t = Math.floor(baseBeamTier + 1e-4);
    if (t > this.lastTier) {
      const g = this.game;
      this.lastTier = t;
      this.director.markNovelty(this.time);
      g.hud.showBanner('NOVA CLASSE DE MASSA', `CLASSE ${t} · ${TIER_NAMES[Math.min(TIER_NAMES.length - 1, t)] ?? ''}`, 'var(--gold)');
      g.audio.tierUp();
      g.vfx.tierUp(g.ufo.position, g.stats.radius);
      g.bus.emit('player:tierup', { tier: t });
      this.showNewlyPossible(t);
    }
  }

  /** Points at the nearest thing that was impossible a second ago (the "now I can!" moment). */
  private showNewlyPossible(tier: number): void {
    const g = this.game;
    const list: Abductable[] = [];
    g.world.query(g.ufo.position.x, g.ufo.position.z, 140, list);
    let best: Abductable | null = null;
    let bd = Infinity;
    for (const o of list) {
      if (o.tier !== tier || o.state !== AState.Static) continue;
      const d = o.pos.distanceToSquared(g.ufo.position);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    if (!best) return;
    this.tierHint = best;
    this.tierHintTimer = 9;
    setTimeout(() => {
      if (best && best.alive) g.hud.floatText(_v.copy(best.pos).setY(best.pos.y + best.model.height + 2), `AGORA DÁ: ${best.def.name.toUpperCase()}`, 'var(--gold)', 22, 2.6);
    }, 1900);
  }

  private tierHint: Abductable | null = null;
  private tierHintTimer = 0;

  get tierHintTarget(): Abductable | null {
    return this.tierHintTimer > 0 && this.tierHint && this.tierHint.alive ? this.tierHint : null;
  }

  // ───────────────────────────────────────────── per-frame

  update(dt: number): void {
    const g = this.game;
    this.time += dt;
    this.updateCityClear(dt);
    const cu = this.combo.update(dt);
    if (cu.endedWith > 0) g.bus.emit('combo:ended', { combo: cu.endedWith });
    if (cu.frenzyEnded) g.bus.emit('combo:frenzy', { active: false });
    const lvl = MODES[this.mode].enemies ? this.threat.update(dt, this.time) : null;
    if (lvl !== null) this.onAlertUp(lvl);
    this.challenges.onMaxAlertTime(this.threat.timeAtMaxAlert);
    if (this.chainTimer > 0) {
      this.chainTimer -= dt;
      if (this.chainTimer <= 0) this.chainStacks = 0;
    }
    this.perfectDodgeTimer = Math.max(0, this.perfectDodgeTimer - dt);
    this.tierHintTimer = Math.max(0, this.tierHintTimer - dt);
    this.beamOffline = Math.max(0, this.beamOffline - dt);

    // extraction portal
    const mult = this.extractionMultiplier;
    if (mult > this.extractionOffered) {
      this.extractionOffered = mult;
      this.director.markNovelty(this.time);
      g.hud.toast(mult === 1 ? 'PORTAL DE EXTRAÇÃO ABERTO' : `EXTRAÇÃO x${mult}`, mult === 1 ? 'Extrair agora ou arriscar mais?' : 'O risco aumentou. A recompensa também.', 'info', 3);
      g.audio.ui('pick');
      g.bus.emit('extraction:available', { multiplier: mult });
    }
    if (mult > 0) {
      this.portal.visible = true;
      const up = g.ufo.position;
      this.portalPos.set(up.x, up.y + 50 + g.stats.radius * 3, up.z - 90 - g.stats.radius * 4);
      this.portal.position.lerp(this.portalPos, this.portal.visible ? Math.min(1, dt * 2) : 1);
      this.portal.rotation.z += dt * 0.6;
      this.portal.lookAt(up);
      const next = nextExtractionTier(this.time);
      const hint = this.cityDone ? 'CIDADE LIMPA · SAINDO SOZINHO' : next ? `PRÓXIMO x${next.multiplier} EM ${formatTime(next.time - this.time)}` : 'MULTIPLICADOR MÁXIMO';
      g.hud.setExtraction(mult, hint, this.channeling > 0);
    } else {
      g.hud.setExtraction(0, '', false);
    }

    // district announcements (heat zones)
    const dname = g.world.districtName(g.ufo.position.x, g.ufo.position.z);
    if (dname !== this.lastDistrict) {
      const d = DISTRICTS[g.world.districtAt(g.ufo.position.x, g.ufo.position.z)];
      if (this.lastDistrict !== '') {
        g.hud.showDistrict(d.name.toUpperCase(), d.threatMult >= 1.5 ? `ZONA QUENTE · AMEAÇA +${Math.round((d.threatMult - 1) * 100)}% · MATÉRIA +${Math.round((d.matterMult - 1) * 100)}%` : d.threatMult > 1 ? `AMEAÇA +${Math.round((d.threatMult - 1) * 100)}%` : '');
        if (d.threatMult >= 1.5) this.director.markNovelty(this.time);
      }
      this.lastDistrict = dname;
    }

    this.director.update(dt, { time: this.time, tier: g.stats.baseBeamTier, alert: this.threat.alert });
    this.updateMeteors(dt);
    this.updateRareSparkles(dt);
    if (this.legendary && this.legendary.alive) {
      this.beacon.position.set(this.legendary.pos.x, 80, this.legendary.pos.z);
      (this.beacon.material as MeshBasicMaterial).opacity = 0.25 + Math.sin(this.time * 4) * 0.1;
    }
    this.objectivesTimer -= dt;
    if (this.objectivesTimer <= 0) {
      this.objectivesTimer = 0.25;
      g.hud.setObjectives(this.challenges.active, this.mode === 'campanha', this.objectiveHeading);
    }
  }

  private objectivesTimer = 0;

  get objectiveHeading(): string {
    return this.mode === 'campanha' ? `ESTRELAS · ${this.city.name.toUpperCase()}` : 'OBJETIVOS';
  }

  private updateRareSparkles(dt: number): void {
    this.rareScanTimer -= dt;
    if (this.rareScanTimer > 0) return;
    this.rareScanTimer = 0.12;
    const g = this.game;
    g.world.query(g.ufo.position.x, g.ufo.position.z, 70, this.rareScratch);
    let n = 0;
    for (const o of this.rareScratch) {
      if (o.rarity === 'normal' || o.state !== AState.Static) continue;
      if (Math.random() < (o.rarity === 'incomum' ? 0.25 : 0.7)) g.vfx.rareSparkle(o.pos, RARITY_INFO[o.rarity].color, Math.max(1, o.model.height));
      if (++n > 12) break;
    }
  }

  // ───────────────────────────────────────────── random events

  private nearbyRoadPoint(minD: number, maxD: number): Vector3 {
    const g = this.game;
    for (let i = 0; i < 30; i++) {
      const p = g.world.randomRoadPoint(() => this.rng.next());
      const d = Math.hypot(p.x - g.ufo.position.x, p.z - g.ufo.position.z);
      if (d >= minD && d <= maxD) return p;
    }
    const a = this.rng.range(0, Math.PI * 2);
    const p = new Vector3(g.ufo.position.x + Math.cos(a) * minD, 0, g.ufo.position.z + Math.sin(a) * minD);
    g.world.clampToBounds(p, 20);
    return p;
  }

  private onEventStart(e: ActiveEvent): void {
    const g = this.game;
    const r = this.rng;
    this.eventObjects.length = 0;
    switch (e.def.id) {
      case 'festa_rua': {
        const p = this.nearbyRoadPoint(28, 60);
        e.position = p;
        const props = ['lata', 'lata', 'garrafa', 'cadeira', 'cadeira', 'mesa_bar', 'isopor', 'engradado', 'caixa_som', 'guarda_sol', 'churrasqueira', 'bola', 'chinelo'];
        const V = EVENT_VALUES.festaRua;
        for (let i = 0; i < V.props; i++) {
          const a = r.range(0, Math.PI * 2);
          const d = Math.sqrt(r.next()) * V.radius;
          const o = g.world.spawn(r.pick(props), p.x + Math.cos(a) * d, -1, p.z + Math.sin(a) * d, r.range(0, 6));
          o.eventTag = 'festa';
          this.eventObjects.push(o);
        }
        for (let i = 0; i < V.people; i++) {
          const a = r.range(0, Math.PI * 2);
          const d = Math.sqrt(r.next()) * V.radius * 0.8;
          g.npcs.add({ kind: 'person', x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d, rotY: r.range(0, 6), persona: r.chance(0.5) ? 'pointer' : 'filmer', paint: r.pick([0xffd166, 0x06d6a0, 0xef476f, 0x118ab2, 0xffffff]), district: 'R', roam: 3 });
        }
        this.eventMarker = p;
        break;
      }
      case 'carro_forte': {
        const p = this.nearbyRoadPoint(35, 70);
        const onX = g.world.roadLines.zs.some((z) => Math.abs(z - p.z) < 0.5);
        const car = g.traffic.spawnCar('carro_forte', { axis: onX ? 'x' : 'z', line: onX ? p.z : p.x, s: onX ? p.x : p.z, dir: r.chance(0.5) ? 1 : -1 }, 1.25);
        car.obj.eventTag = 'carro_forte';
        car.obj.tierOverride = Math.max(2, Math.min(car.obj.def.tier, Math.floor(g.stats.baseBeamTier)));
        this.eventObjects.push(car.obj);
        this.eventMarker = car.obj.pos;
        break;
      }
      case 'carreta': {
        const p = this.nearbyRoadPoint(40, 80);
        const onX = g.world.roadLines.zs.some((z) => Math.abs(z - p.z) < 0.5);
        const car = g.traffic.spawnCar('carreta', { axis: onX ? 'x' : 'z', line: onX ? p.z : p.x, s: onX ? p.x : p.z, dir: 1 }, 0.45);
        car.obj.eventTag = 'carreta';
        this.eventObjects.push(car.obj);
        this.eventMarker = car.obj.pos;
        break;
      }
      case 'meteoros':
        this.stormTimer = EVENT_VALUES.meteoros.count;
        this.meteorTimer = 0.5;
        g.audio.distantRumble();
        break;
      case 'invasao_militar': {
        const V = EVENT_VALUES.invasao;
        const snap = g.playerSnapshot();
        for (let i = 0; i < V.drones; i++) g.enemies.spawn('drone', snap);
        for (let i = 0; i < V.helicopters; i++) g.enemies.spawn('helicopter', snap);
        g.audio.radio();
        break;
      }
      case 'lendario': {
        // global secrets plus this city's own (a boto on the asphalt would be too much)
        const available = [...SECRET_IDS.filter((id) => id !== 'estatua' && !CITY_SECRETS.has(id)), this.city.secret];
        const id = r.pick(available);
        const p = this.nearbyRoadPoint(45, 95);
        p.x += r.range(-4, 4);
        const o = g.world.spawn(id, p.x, -1, p.z, r.range(0, 6));
        o.eventTag = 'lendario';
        this.legendary = o;
        this.eventMarker = o.pos;
        this.beacon.visible = true;
        break;
      }
    }
    g.hud.toast(e.def.title, e.def.subtitle, e.def.id === 'invasao_militar' ? 'danger' : e.def.id === 'lendario' ? 'alien' : 'gold', 3);
    g.audio.ui('pick');
    g.bus.emit('event:start', { id: e.def.id, title: e.def.title, subtitle: e.def.subtitle, position: e.position ?? undefined });
  }

  private onEventTick(e: ActiveEvent, _dt: number): void {
    if (e.def.id === 'carro_forte') {
      const o = this.eventObjects[0];
      if (!o || !o.alive) return;
      this.eventMarker = o.pos;
    }
  }

  private onEventEnd(e: ActiveEvent, success: boolean): void {
    const g = this.game;
    if (e.def.id === 'carro_forte' && !success) {
      const o = this.eventObjects[0];
      if (o && o.alive && o.state === AState.Static) {
        g.world.kill(o);
        g.hud.toast('O CARRO-FORTE ESCAPOU', 'Fica pra próxima', 'warn');
      }
    }
    if (e.def.id === 'lendario' && this.legendary?.alive) {
      // the legendary signal fades but the object stays in the city
      this.beacon.visible = false;
    }
    if (e.def.id !== 'lendario') this.eventMarker = null;
    g.bus.emit('event:end', { id: e.def.id, success });
  }

  private updateMeteors(dt: number): void {
    const g = this.game;
    if (this.stormTimer > 0 && this.director.active?.def.id === 'meteoros') {
      this.meteorTimer -= dt;
      if (this.meteorTimer <= 0) {
        this.meteorTimer = EVENT_VALUES.meteoros.interval * (0.6 + Math.random() * 0.8);
        const m = this.meteors.find((x) => !x.active);
        if (m) {
          this.stormTimer--;
          const a = Math.random() * Math.PI * 2;
          const d = 12 + Math.random() * 55;
          m.to.set(g.ufo.position.x + Math.cos(a) * d, 0, g.ufo.position.z + Math.sin(a) * d);
          g.world.clampToBounds(m.to, 20);
          m.to.y = g.world.groundAt(m.to.x, m.to.z);
          m.from.set(m.to.x - 60, 190, m.to.z - 30);
          m.t = 0;
          m.dur = 1.6;
          m.active = true;
          m.mesh.visible = true;
        }
      }
    }
    for (const m of this.meteors) {
      if (!m.active) continue;
      m.t += dt;
      const t = Math.min(1, m.t / m.dur);
      m.mesh.position.lerpVectors(m.from, m.to, t * t);
      m.mesh.scale.setScalar(1 + t);
      g.vfx.smokeTrail(m.mesh.position, true);
      g.vfx.particles.single(true, m.mesh.position.x, m.mesh.position.y, m.mesh.position.z, 0, 0, 0, g.beam.color.clone().setHex(0xffc060), 0.3, 3, 0.5);
      if (t >= 1) {
        m.active = false;
        m.mesh.visible = false;
        this.meteorImpact(m.to);
      }
    }
  }

  private meteorImpact(p: Vector3): void {
    const g = this.game;
    const V = EVENT_VALUES.meteoros;
    g.vfx.explosion(p, 3.5, p.y);
    g.audio.explosion(3.5, p.x, p.z);
    const list: Abductable[] = [];
    g.world.query(p.x, p.z, V.damageRadius, list);
    for (const o of list) {
      if (o.tier <= 2 && o.state === AState.Static && !o.enemyKind) {
        g.vfx.particles.chunks(o.pos, 3, 0x6b6b70, 0.25, 6, o.home.y);
        g.world.kill(o);
      }
    }
    if (Math.hypot(p.x - g.ufo.position.x, p.z - g.ufo.position.z) < V.damageRadius + g.stats.radius && g.ufo.position.y < 30) {
      g.applyPlayerDamage(V.playerDamage, p);
    }
    if (Math.random() < 0.55) {
      const o = g.world.spawn('meteorito', p.x, -1, p.z, Math.random() * 6, { rarity: 'raro' });
      o.eventTag = 'meteoro';
    }
  }

  // ───────────────────────────────────────────── end of run

  computeResults(extracted: boolean): { base: number; total: number; multiplier: number } {
    return computeCores({
      matter: this.progression.matter,
      discoveries: this.stats.discoveries,
      enemiesDestroyed: this.stats.enemiesDestroyed,
      challengeRewards: this.challenges.completedRewards,
      extracted,
      extractionMultiplier: this.extractionMultiplier,
      metaCoreBonus: this.game.stats.coreBonus,
      bonusCores: this.stats.bonusCores,
    });
  }

  hidePortal(): void {
    this.portal.visible = false;
    this.beacon.visible = false;
  }

  get portalMesh(): Mesh {
    return this.portal;
  }
}
