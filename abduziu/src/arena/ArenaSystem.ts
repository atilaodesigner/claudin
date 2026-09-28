import { Vector3, type Scene, type Texture } from 'three';
import { BALANCE } from '../config/gameBalance';
import { getObjectDef } from '../config/objects';
import { levelFromXp, matterForTier, tierFromMatter } from '../progression/RunProgression';
import { h } from '../ui/dom';
import type { RadarBlip } from '../ui/HUD';
import { clamp, damp, formatInt } from '../utils/math';
import { AState, type Abductable } from '../world/Abductable';
import { TractorBeam } from '../ufo/TractorBeam';
import { UFOVisuals } from '../ufo/UFOVisuals';
import type { Game } from '../core/Game';

/** Round length (seconds). */
export const ARENA_ROUND = 240;
/** A ship swallows another when it is at least this many mass tiers above it. */
export const EAT_MARGIN = 0.6;
/** Seconds a ship must hold another bot under its beam to swallow it. */
const EAT_HOLD = 1.0;
/** Seconds a bot needs to swallow the player (bots are good at this). */
const EAT_HOLD_PLAYER = 0.85;
/** Share of the loser's matter the winner keeps (the rest drops as loot). */
const EAT_GAIN = 0.6;
/** Bigger bots leave the player alone for the first seconds of the round. */
const GRACE = 8;
const RESPAWN = 3.5;
const FOOD_CAP = 170;
/** Hunting burst: short sprint when the prey is almost under the beam. */
const SPRINT_TIME = 0.8;
const SPRINT_COOLDOWN = 5;

const NAMES = [
  'Pastel Voador', 'Caramelo_ET', 'Coxinha Orbital', 'Rapadura 3000', 'Vovó Galáctica', 'Brisa Cósmica',
  'Zé do Disco', 'Marcianinho', 'Tia do Óvni', 'Cometa Lindo', 'Neblina', 'Seu Alienígena', 'Pão de Queijo X',
  'Açaí Estelar', 'Bate-Latinha', 'Dona Nave', 'Capitão Farofa', 'Kombi Sideral', 'Tapioca Turbo', 'Guaraná Nebular',
];
const ACCENTS = [0xff5ad1, 0xffb020, 0x4dc9ff, 0xff4d5e, 0xc28bff, 0xfff05a, 0x5affea, 0xff8a3d, 0x8aff5a, 0x5a7bff, 0xff7ab8, 0xffffff, 0xffd166, 0x06d6a0, 0xef476f, 0x9b5de5];
const FOOD: ReadonlyArray<readonly string[]> = [
  ['lata', 'garrafa', 'chinelo', 'bola', 'isopor', 'engradado'],
  ['cadeira', 'mesa_bar', 'caixa_som'],
  ['moto', 'carrinho_pipoca', 'orelhao', 'placa_rua', 'barraca_feira'],
  ['hatch', 'seda', 'taxi', 'banca'],
];

const _v = new Vector3();
const _vis = new Vector3();
const _near: Abductable[] = [];

export interface ArenaEntry {
  name: string;
  matter: number;
  player: boolean;
  color: number;
}

/** A computer-controlled saucer. Uses the same size/speed curves as the player. */
class Bot {
  readonly visuals: UFOVisuals;
  readonly beam: TractorBeam;
  /** Canonical position inside the city tile. */
  readonly pos = new Vector3();
  /** Where it is drawn: the copy of the tile nearest to the player. */
  readonly vis = new Vector3();
  readonly vel = new Vector3();
  readonly goal = new Vector3();
  readonly label: HTMLDivElement;
  matter = 0;
  alive = true;
  respawn = 0;
  think = 0;
  eatCd = 0;
  altitude = 10;
  /** 0..1 capture progress held by whoever is swallowing this ship. */
  held = 0;
  captor: Bot | 'player' | null = null;
  /** Swallow animation (seconds left) once captured. */
  dying = 0;
  mode: 'food' | 'hunt' | 'flee' | 'wander' = 'wander';
  target: Bot | 'player' | null = null;
  chaseTime = 0;
  restTime = 0;
  sprint = 0;
  sprintCd = 0;
  /** Personality: how brave/greedy this bot plays. */
  readonly bold: number;
  wobble = Math.random() * 10;

  constructor(
    readonly name: string,
    readonly color: number,
    env: Texture | null,
    noise: Texture,
    parent: HTMLElement,
  ) {
    this.visuals = new UFOVisuals(env);
    this.visuals.setAccent(color);
    this.beam = new TractorBeam(noise);
    this.beam.setColor(color);
    this.beam.setActive(true);
    this.label = h('div', 'arena-tag');
    this.label.style.setProperty('--c', `#${color.toString(16).padStart(6, '0')}`);
    parent.appendChild(this.label);
    this.bold = 0.8 + Math.random() * 0.7;
  }

  get tier(): number {
    return tierFromMatter(this.matter);
  }
  get scale(): number {
    const B = BALANCE.ufo;
    return Math.min(B.maxScale, Math.pow(B.scaleBase, Math.max(0, this.tier - 1)));
  }
  get radius(): number {
    return BALANCE.ufo.baseRadius * this.scale;
  }
  get beamRadius(): number {
    return BALANCE.beam.baseRadius * this.scale;
  }
  get speed(): number {
    return BALANCE.ufo.baseSpeed * Math.pow(this.scale, 0.4);
  }
}

/**
 * ABDUZIU.io: an arena round against bots on an endless (wrapping) city. Everyone grows
 * by abducting; a ship clearly bigger than another can hold it under its beam and
 * swallow it whole.
 */
export class ArenaSystem {
  private readonly bots: Bot[] = [];
  private readonly panel: HTMLDivElement;
  private readonly clock: HTMLDivElement;
  private readonly rows: HTMLDivElement;
  private readonly warn: HTMLDivElement;
  private readonly warnBar: HTMLDivElement;
  private readonly foodIds = new Set<number>();
  private foodTimer = 0;
  private boardTimer = 0;
  time = 0;
  active = false;
  /** Seconds the player has been held by a bigger ship. */
  playerHeld = 0;
  playerCaptor: Bot | null = null;
  finished = false;
  playerName = 'VOCÊ';
  /** Final placement, set when the round ends or the player is swallowed. */
  place = 0;
  /** Name of the ship that swallowed the player, if any. */
  eatenBy: string | null = null;
  onPlayerEaten: ((by: string) => void) | null = null;
  onRoundEnd: ((place: number, total: number) => void) | null = null;

  constructor(
    private readonly g: Game,
    private readonly scene: Scene,
    private readonly env: Texture | null,
    private readonly noise: Texture,
  ) {
    const root = g.hud.root;
    this.panel = h('div', 'arena-panel');
    this.clock = h('div', 'arena-clock', '4:00');
    this.rows = h('div', 'arena-rows');
    this.panel.append(this.clock, this.rows);
    this.panel.style.display = 'none';
    // lives in the top-right column, under the radar
    (root.querySelector('.tr') ?? root).appendChild(this.panel);
    this.warn = h('div', 'arena-warn');
    this.warn.appendChild(h('div', 't', 'VOCÊ ESTÁ SENDO ABDUZIDO · FUJA!'));
    this.warnBar = h('div', 'bar');
    this.warnBar.appendChild(h('i'));
    this.warn.appendChild(this.warnBar);
    root.appendChild(this.warn);
  }

  get total(): number {
    return this.bots.length + 1;
  }

  /** Torus-aware offset from a to b. */
  private ox(a: Vector3, b: Vector3): number {
    return this.g.world.dx(a.x, b.x);
  }
  private oz(a: Vector3, b: Vector3): number {
    return this.g.world.dz(a.z, b.z);
  }
  private dist(a: Vector3, b: Vector3): number {
    return Math.hypot(this.ox(a, b), this.oz(a, b));
  }

  /** Sets up a fresh round: bots spread over the city, far from the player. */
  start(lowQuality: boolean): void {
    this.clear();
    this.active = true;
    this.finished = false;
    this.time = 0;
    this.place = 0;
    this.eatenBy = null;
    this.playerHeld = 0;
    this.playerCaptor = null;
    this.foodTimer = 0;
    this.g.hud.root.classList.add('arena');
    const count = lowQuality ? 9 : 15;
    const names = [...NAMES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < count; i++) {
      const b = new Bot(names[i % names.length] as string, ACCENTS[i % ACCENTS.length] as number, this.env, this.noise, this.g.hud.root);
      this.scene.add(b.visuals.root);
      this.scene.add(b.beam.group);
      // bots "joined" at different times: some are already big and hungry
      const r = Math.random();
      b.matter = r < 0.2 ? 150 + Math.random() * 270 : r < 0.6 ? 30 + Math.random() * 90 : Math.random() * 25;
      this.place_(b, true);
      this.bots.push(b);
    }
    this.panel.style.display = '';
    this.renderBoard();
  }

  /** Removes bots, labels and loot bookkeeping. */
  clear(): void {
    for (const b of this.bots) {
      this.scene.remove(b.visuals.root);
      this.scene.remove(b.beam.group);
      b.label.remove();
    }
    this.bots.length = 0;
    this.foodIds.clear();
    this.active = false;
    this.panel.style.display = 'none';
    this.warn.classList.remove('on');
    this.g.hud.root.classList.remove('arena');
  }

  private place_(b: Bot, far: boolean): void {
    const w = this.g.world;
    const p = this.g.ufo.position;
    let best = w.randomRoadPoint(Math.random);
    if (far) {
      for (let k = 0; k < 8; k++) {
        const c = w.randomRoadPoint(Math.random);
        if (this.dist(c, p) > this.dist(best, p)) best = c;
        if (this.dist(best, p) > 140) break;
      }
    }
    b.pos.set(best.x, 0, best.z);
    b.vel.set(0, 0, 0);
    b.altitude = BALANCE.ufo.baseAltitude * Math.pow(b.scale, BALANCE.ufo.altitudeScaleExp) + 6;
    b.pos.y = b.altitude;
    b.goal.copy(b.pos);
    b.alive = true;
    b.dying = 0;
    b.held = 0;
    b.captor = null;
    b.target = null;
    b.chaseTime = 0;
    b.restTime = 0;
    b.sprint = 0;
    b.visuals.root.visible = true;
    b.visuals.setLevel(levelFromXp(b.matter));
    b.visuals.body.rotation.set(0, 0, 0);
    this.updateVis(b);
    b.visuals.root.position.copy(b.vis);
    b.visuals.root.scale.setScalar(b.radius);
    b.beam.setActive(true);
    b.label.style.display = 'none';
  }

  private updateVis(b: Bot): void {
    const p = this.g.ufo.position;
    b.vis.set(p.x + this.ox(p, b.pos), b.pos.y, p.z + this.oz(p, b.pos));
  }

  /** Player's mass tier as used for eating decisions. */
  private get playerTier(): number {
    return this.g.stats.baseBeamTier;
  }

  get playerMatter(): number {
    return this.g.run.progression.matter;
  }

  /** Current standings, biggest first. */
  standings(): ArenaEntry[] {
    const list: ArenaEntry[] = this.bots.map((b) => ({ name: b.name, matter: b.alive ? b.matter : 0, player: false, color: b.color }));
    list.push({ name: this.playerName, matter: this.playerMatter, player: true, color: 0x5dffa0 });
    list.sort((a, b) => b.matter - a.matter);
    return list;
  }

  playerPlace(): number {
    return this.standings().findIndex((e) => e.player) + 1;
  }

  /** Typical bot size right now (respawns come back at a fraction of it). */
  private medianMatter(): number {
    const m = this.bots.filter((b) => b.alive).map((b) => b.matter).sort((a, b) => a - b);
    return m.length ? (m[Math.floor(m.length / 2)] as number) : 0;
  }

  /**
   * @param playing false while the player's ship is dying/extracting: bots keep living.
   */
  update(dt: number, playing: boolean, beamOn: boolean): void {
    if (!this.active) return;
    const g = this.g;
    if (playing && !this.finished) {
      this.time += dt;
      if (this.time >= ARENA_ROUND) {
        this.finished = true;
        this.place = this.playerPlace();
        this.onRoundEnd?.(this.place, this.total);
      }
    }
    this.updateFood(dt);
    const ptier = this.playerTier;
    const pp = g.ufo.position;
    let heldBy: Bot | null = null;

    for (const b of this.bots) {
      if (!b.alive) {
        if (b.dying > 0) {
          this.animateSwallow(b, dt);
          continue;
        }
        b.respawn -= dt;
        if (b.respawn <= 0) {
          b.matter = 5 + Math.random() * this.medianMatter() * 0.35;
          this.place_(b, true);
        }
        continue;
      }
      this.think(b, dt, ptier);
      this.move(b, dt);
      this.feed(b);
    }

    // ship vs ship: bots swallowing bots
    for (const a of this.bots) {
      if (!a.alive) continue;
      for (const b of this.bots) {
        if (a === b || !b.alive) continue;
        if (a.tier < b.tier + EAT_MARGIN) continue;
        if (this.dist(a.pos, b.pos) < a.beamRadius + b.radius * 0.2) {
          if (b.captor !== a) b.held = 0;
          b.captor = a;
          b.held += dt / EAT_HOLD;
          if (b.held >= 1) this.swallow(a, b);
        }
      }
    }

    // player vs bots
    for (const b of this.bots) {
      if (!b.alive) continue;
      const d = this.dist(pp, b.pos);
      // player swallowing a bot
      if (playing && beamOn && ptier >= b.tier + EAT_MARGIN && d < g.stats.beamRadius + b.radius * 0.2) {
        if (b.captor !== 'player') b.held = 0;
        b.captor = 'player';
        b.held += dt / EAT_HOLD;
        b.visuals.damageFlash = 0.6;
        if (b.held >= 1) this.swallow('player', b);
        continue;
      }
      // a bot swallowing the player
      if (playing && !this.finished && this.time > GRACE && b.tier >= ptier + EAT_MARGIN && d < b.beamRadius + g.stats.radius * 0.2 && !heldBy) heldBy = b;
    }
    // released ships slowly recover
    for (const b of this.bots) {
      if (!b.alive || !b.captor) continue;
      const c = b.captor;
      const cp = c === 'player' ? pp : c.pos;
      const cr = c === 'player' ? g.stats.beamRadius : c.alive ? c.beamRadius : 0;
      if (this.dist(cp, b.pos) > cr + b.radius * 0.2 || (c !== 'player' && !c.alive)) {
        b.held = Math.max(0, b.held - dt * 1.5);
        if (b.held <= 0) b.captor = null;
      }
    }

    if (heldBy) {
      if (this.playerCaptor !== heldBy) this.playerHeld = 0;
      this.playerCaptor = heldBy;
      this.playerHeld += dt;
      g.ufo.addTug(0.6);
      g.cameraCtl.addTrauma(dt * 0.9);
      if (this.playerHeld >= EAT_HOLD_PLAYER) {
        heldBy.matter += this.playerMatter * EAT_GAIN;
        heldBy.visuals.setLevel(levelFromXp(heldBy.matter));
        this.place = this.playerPlace();
        this.dropLoot(pp.x, pp.z, this.playerMatter * (1 - EAT_GAIN), tierFromMatter(this.playerMatter));
        this.eatenBy = heldBy.name;
        this.onPlayerEaten?.(heldBy.name);
      }
    } else {
      this.playerHeld = Math.max(0, this.playerHeld - dt * 1.5);
      if (this.playerHeld <= 0) this.playerCaptor = null;
    }
    this.warn.classList.toggle('on', this.playerHeld > 0.05 && playing);
    (this.warnBar.firstChild as HTMLElement).style.transform = `scaleX(${clamp(this.playerHeld / EAT_HOLD_PLAYER, 0, 1).toFixed(3)})`;

    for (const b of this.bots) {
      if (b.alive) this.visualize(b, dt);
    }
    this.updateLabels();
    this.boardTimer -= dt;
    if (this.boardTimer <= 0) {
      this.boardTimer = 0.25;
      this.renderBoard();
    }
  }

  /** Where the player is being dragged while swallowed (for the death animation). */
  get captorPosition(): Vector3 | null {
    if (!this.playerCaptor) return null;
    this.updateVis(this.playerCaptor);
    return this.playerCaptor.vis;
  }

  private think(b: Bot, dt: number, ptier: number): void {
    b.think -= dt;
    b.eatCd = Math.max(0, b.eatCd - dt);
    b.sprintCd = Math.max(0, b.sprintCd - dt);
    b.restTime = Math.max(0, b.restTime - dt);
    if (b.think > 0 && b.mode !== 'hunt') return;
    if (b.think <= 0) b.think = 0.2 + Math.random() * 0.15;
    const g = this.g;
    const pp = g.ufo.position;
    const t = b.tier;
    const sight = 80 + b.radius * 9;
    const playerAround = g.state === 'playing';

    // threats first
    let threat: Vector3 | null = null;
    let threatD = Infinity;
    const consider = (p: Vector3, tier: number) => {
      if (tier < t + EAT_MARGIN) return;
      const d = this.dist(b.pos, p);
      if (d < (sight * 0.5) / b.bold && d < threatD) {
        threat = p;
        threatD = d;
      }
    };
    if (playerAround) consider(pp, ptier);
    for (const o of this.bots) if (o !== b && o.alive) consider(o.pos, o.tier);
    if (threat) {
      const tp = threat as Vector3;
      b.mode = 'flee';
      _v.set(-this.ox(b.pos, tp), 0, -this.oz(b.pos, tp)).normalize();
      // flee at an angle so they don't run in straight, predictable lines
      const side = Math.sin(b.wobble + this.time) * 0.6;
      b.goal.set(b.pos.x + (_v.x - _v.z * side) * 40, 0, b.pos.z + (_v.z + _v.x * side) * 40);
      return;
    }

    // prey: the player is the favourite target
    let prey: Bot | 'player' | null = null;
    let preyD = Infinity;
    if (playerAround && this.time > GRACE && t >= ptier + EAT_MARGIN && b.restTime <= 0) {
      const d = this.dist(b.pos, pp);
      if (d < sight * 1.3 * b.bold) {
        prey = 'player';
        preyD = d * 0.6;
      }
    }
    for (const o of this.bots) {
      if (o === b || !o.alive || t < o.tier + EAT_MARGIN) continue;
      const d = this.dist(b.pos, o.pos);
      if (d < sight * b.bold && d < preyD) {
        prey = o;
        preyD = d;
      }
    }
    const limit = prey === 'player' ? 12 : 9;
    if (prey && b.chaseTime < limit) {
      if (b.target !== prey) b.chaseTime = 0;
      b.mode = 'hunt';
      b.target = prey;
      b.chaseTime += dt;
      const p = prey === 'player' ? pp : prey.pos;
      const v = prey === 'player' ? g.ufo.velocity : prey.vel;
      // lead the target
      b.goal.set(b.pos.x + this.ox(b.pos, p) + v.x * 0.45, 0, b.pos.z + this.oz(b.pos, p) + v.z * 0.45);
      const d = this.dist(b.pos, p);
      if (b.sprintCd <= 0 && d < b.beamRadius * 4 && d > b.beamRadius * 0.6) {
        b.sprint = SPRINT_TIME;
        b.sprintCd = SPRINT_COOLDOWN;
      }
      return;
    }
    if (prey && b.chaseTime >= limit) {
      // gave up: graze for a while before trying again
      b.chaseTime = 0;
      b.restTime = 3 + Math.random() * 3;
    }
    b.target = null;

    // food
    const floor = Math.floor(t + 1e-4);
    g.world.query(b.pos.x, b.pos.z, 28 + b.radius * 3, _near);
    let food: Abductable | null = null;
    let score = -Infinity;
    for (const o of _near) {
      if (o.slot !== 'static' || o.state !== AState.Static || o.tier > floor) continue;
      const d = Math.hypot(o.pos.x - b.pos.x, o.pos.z - b.pos.z);
      const s = o.tier * 7 - d;
      if (s > score) {
        score = s;
        food = o;
      }
    }
    if (food) {
      b.mode = 'food';
      b.goal.set(food.pos.x, 0, food.pos.z);
      return;
    }
    if (b.mode !== 'wander' || Math.hypot(b.goal.x - b.pos.x, b.goal.z - b.pos.z) < 6) {
      b.mode = 'wander';
      // bold bots roam toward smaller ships (or the player); the rest graze around the city
      const others = this.bots.filter((o) => o !== b && o.alive && t >= o.tier + EAT_MARGIN);
      if (playerAround && t >= ptier + EAT_MARGIN && Math.random() < 0.35 * b.bold) {
        b.goal.set(b.pos.x + this.ox(b.pos, pp) + (Math.random() - 0.5) * 40, 0, b.pos.z + this.oz(b.pos, pp) + (Math.random() - 0.5) * 40);
      } else if (others.length && Math.random() < 0.5 * b.bold) {
        const o = others[Math.floor(Math.random() * others.length)] as Bot;
        b.goal.set(b.pos.x + this.ox(b.pos, o.pos) + (Math.random() - 0.5) * 30, 0, b.pos.z + this.oz(b.pos, o.pos) + (Math.random() - 0.5) * 30);
      } else {
        const p = g.world.randomRoadPoint(Math.random);
        b.goal.set(p.x, 0, p.z);
      }
    }
  }

  private move(b: Bot, dt: number): void {
    const g = this.g;
    const held = b.held > 0 && b.captor;
    b.sprint = Math.max(0, b.sprint - dt);
    const sprint = b.sprint > 0 ? 1.5 : 1;
    let max = b.speed * (b.mode === 'hunt' ? 1.3 : b.mode === 'flee' ? 1.05 : 1) * sprint * (held ? 0.7 : 1);
    // a player who keeps flying can get away, but only if they are paying attention
    if (b.mode === 'hunt' && b.target === 'player') max = Math.min(max, g.stats.speed * (b.sprint > 0 ? 1.35 : 1));
    _v.set(g.world.dx(b.pos.x, b.goal.x), 0, g.world.dz(b.pos.z, b.goal.z));
    const d = _v.length();
    const slow = b.mode === 'food' ? clamp(d / 6, 0.15, 1) : 1;
    if (d > 0.01) _v.multiplyScalar((max * slow) / d);
    const acc = BALANCE.ufo.acceleration * (b.sprint > 0 ? 1.4 : 0.9);
    b.vel.x = damp(b.vel.x, _v.x, acc, dt);
    b.vel.z = damp(b.vel.z, _v.z, acc, dt);
    b.pos.x += b.vel.x * dt;
    b.pos.z += b.vel.z * dt;
    g.world.clampToBounds(b.pos, 5);
    const s = b.scale;
    const roof = g.world.heightField.maxInRadius(b.pos.x, b.pos.z, b.radius * 1.3);
    const target = Math.max(BALANCE.ufo.baseAltitude * Math.pow(s, BALANCE.ufo.altitudeScaleExp), roof + BALANCE.ufo.clearance * s + b.radius * 0.4);
    b.altitude = damp(b.altitude, target, target > b.altitude ? 5 : 1.5, dt);
    b.wobble += dt;
    b.pos.y = b.altitude + Math.sin(b.wobble * 1.7) * 0.12 * s;
  }

  /** Bots abduct whatever fits under their beam; they get hungrier as the round goes on. */
  private feed(b: Bot): void {
    if (b.eatCd > 0) return;
    const g = this.g;
    const floor = Math.floor(b.tier + 1e-4);
    g.world.query(b.pos.x, b.pos.z, b.beamRadius, _near);
    for (const o of _near) {
      if (o.slot !== 'static' || o.state !== AState.Static || o.tier > floor) continue;
      const tier = o.tier;
      g.world.kill(o);
      this.foodIds.delete(o.uid);
      const before = levelFromXp(b.matter);
      b.matter += matterForTier(tier, o.def.matterMult ?? 1) * 1.5 * (1 + (0.6 * this.time) / ARENA_ROUND);
      const after = levelFromXp(b.matter);
      if (after !== before) b.visuals.setLevel(after);
      b.beam.onAbsorb();
      this.updateVis(b);
      if (this.dist(b.pos, g.ufo.position) < 120) g.vfx.absorb(b.vis, tier, b.radius, 0, false, b.color);
      b.eatCd = 0.16 + tier * 0.04;
      return;
    }
  }

  private swallow(by: Bot | 'player', b: Bot): void {
    const g = this.g;
    const gain = b.matter * EAT_GAIN;
    const loot = b.matter - gain;
    const lootTier = b.tier;
    b.alive = false;
    b.dying = 0.7;
    b.respawn = RESPAWN;
    b.captor = by;
    b.label.style.display = 'none';
    b.beam.setActive(false);
    this.dropLoot(b.pos.x, b.pos.z, loot, lootTier);
    const near = this.dist(b.pos, g.ufo.position) < 140;
    if (by === 'player') {
      const r = g.run;
      const levels = r.progression.addMatter(gain * g.stats.matterMult);
      if (levels > 0) g.onLevelsGained(levels);
      const pts = Math.round(1500 + gain * 180);
      r.stats.score += pts;
      g.hud.floatText(_v.copy(g.ufo.position).setY(g.ufo.position.y + g.stats.radius * 1.5), `${b.name.toUpperCase()} ABDUZIDO!`, 'var(--gold)', 24, 1.4);
      g.hud.floatText(_v.copy(g.ufo.position).setY(g.ufo.position.y + g.stats.radius * 0.8), `+${formatInt(pts)}`, 'var(--alien-green)', 20);
      g.audio.comboMilestone(10);
      g.audio.abductPop(6, 10, true, g.ufo.position.x, g.ufo.position.z);
      g.vfx.absorb(g.ufo.position, 6, g.stats.radius, 10, true, b.color);
      g.cameraCtl.addTrauma(0.35);
      g.haptics.light();
      r.stats.enemiesDestroyed++;
    } else {
      by.matter += gain;
      by.visuals.setLevel(levelFromXp(by.matter));
      by.beam.onAbsorb();
      if (near) {
        this.updateVis(by);
        g.vfx.absorb(by.vis, 5, by.radius, 0, true, by.color);
        g.hud.toast(`${by.name} ABDUZIU ${b.name}`, '', 'info', 1.6);
      }
    }
  }

  private animateSwallow(b: Bot, dt: number): void {
    b.dying = Math.max(0, b.dying - dt);
    const c = b.captor;
    const target = c === 'player' ? this.g.ufo.position : c ? c.pos : b.pos;
    const k = 1 - Math.exp(-6 * dt);
    b.pos.x += this.ox(b.pos, target) * k;
    b.pos.z += this.oz(b.pos, target) * k;
    b.pos.y += (target.y - b.pos.y) * k;
    this.updateVis(b);
    const t = b.dying / 0.7;
    const root = b.visuals.root;
    root.position.copy(b.vis);
    root.scale.setScalar(Math.max(0.01, b.radius * t));
    b.visuals.body.rotation.y += dt * 14;
    b.visuals.update(dt, 1);
    b.beam.update(dt, b.vis, this.g.world.groundAt(b.pos.x, b.pos.z), b.radius * t, b.beamRadius * t, 0, 0, 0, () => 0);
    if (b.dying <= 0) root.visible = false;
  }

  /** Scatters props where a ship was swallowed: loot for whoever is small enough. */
  private dropLoot(x: number, z: number, matter: number, tier: number): void {
    const maxT = clamp(Math.floor(tier) - 1, 0, FOOD.length - 1);
    let left = matter;
    let n = 0;
    while (left > 0.3 && n < 24) {
      const t = Math.min(maxT, Math.floor(Math.random() * (maxT + 1)));
      const ids = FOOD[t] as readonly string[];
      const id = ids[Math.floor(Math.random() * ids.length)] as string;
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * (5 + tier * 1.5);
      if (this.spawnFood(id, x + Math.cos(a) * r, z + Math.sin(a) * r)) left -= matterForTier(t);
      n++;
    }
  }

  private spawnFood(id: string, x: number, z: number): boolean {
    const w = this.g.world;
    _v.set(x, 0, z);
    w.clampToBounds(_v, 8);
    if (w.heightField.maxInRadius(_v.x, _v.z, 1) > w.groundAt(_v.x, _v.z) + 0.5) return false;
    try {
      getObjectDef(id);
    } catch {
      return false;
    }
    const o = w.spawn(id, _v.x, -1, _v.z, Math.random() * Math.PI * 2);
    this.foodIds.add(o.uid);
    return true;
  }

  /** Keeps the streets stocked with snacks so the round never starves. */
  private updateFood(dt: number): void {
    this.foodTimer -= dt;
    if (this.foodTimer > 0) return;
    this.foodTimer = 0.3;
    const w = this.g.world;
    let alive = 0;
    for (const id of this.foodIds) {
      const o = w.objects[id];
      if (o && o.alive) alive++;
      else this.foodIds.delete(id);
    }
    if (alive >= FOOD_CAP) return;
    const p = w.randomRoadPoint(Math.random);
    const r = Math.random();
    const t = r < 0.5 ? 0 : r < 0.8 ? 1 : r < 0.95 ? 2 : 3;
    const ids = FOOD[t] as readonly string[];
    const cluster = t === 0 ? 3 : 1;
    for (let i = 0; i < cluster; i++) {
      this.spawnFood(ids[Math.floor(Math.random() * ids.length)] as string, p.x + (Math.random() - 0.5) * 6, p.z + (Math.random() - 0.5) * 6);
    }
  }

  private visualize(b: Bot, dt: number): void {
    this.updateVis(b);
    const root = b.visuals.root;
    root.position.copy(b.vis);
    root.scale.setScalar(b.radius);
    const sp = Math.hypot(b.vel.x, b.vel.z);
    const inv = 1 / Math.max(1, b.speed);
    const shake = b.held > 0 ? Math.sin(this.time * 60) * 0.06 * b.held : 0;
    const body = b.visuals.body;
    body.rotation.x = damp(body.rotation.x, b.vel.z * inv * BALANCE.ufo.maxTilt + shake, 5, dt);
    body.rotation.z = damp(body.rotation.z, -b.vel.x * inv * BALANCE.ufo.maxTilt, 5, dt);
    b.visuals.update(dt, b.sprint > 0 ? 1.2 : b.mode === 'hunt' ? 0.8 : sp > 1 ? 0.2 : 0.5);
    const ground = this.g.world.groundAt(b.pos.x, b.pos.z);
    b.beam.update(dt, b.vis, ground, b.radius, b.beamRadius, 1 + b.tier * 0.3, 0, 0, () => ground);
  }

  private updateLabels(): void {
    const g = this.g;
    const cam = g.cameraCtl.camera;
    const w = g.renderer.width;
    const hh = g.renderer.height;
    const pt = this.playerTier;
    for (const b of this.bots) {
      if (!b.alive) {
        b.label.style.display = 'none';
        continue;
      }
      _vis.copy(b.vis).setY(b.vis.y + b.radius * 0.9).project(cam);
      if (_vis.z > 1 || Math.abs(_vis.x) > 1.1 || Math.abs(_vis.y) > 1.1) {
        b.label.style.display = 'none';
        continue;
      }
      b.label.style.display = '';
      const x = (_vis.x * 0.5 + 0.5) * w;
      const y = (-_vis.y * 0.5 + 0.5) * hh;
      b.label.style.transform = `translate(-50%,-100%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      const danger = b.tier >= pt + EAT_MARGIN ? 'bad' : pt >= b.tier + EAT_MARGIN ? 'prey' : '';
      const text = `${b.name} · ${formatInt(b.matter)}`;
      if (b.label.textContent !== text) b.label.textContent = text;
      if (b.label.dataset.k !== danger) {
        b.label.dataset.k = danger;
        b.label.className = `arena-tag ${danger}`;
      }
    }
  }

  private renderBoard(): void {
    const list = this.standings();
    const left = Math.max(0, ARENA_ROUND - this.time);
    const m = Math.floor(left / 60);
    const s = Math.floor(left % 60);
    this.clock.textContent = `${m}:${String(s).padStart(2, '0')}`;
    this.clock.classList.toggle('late', left < 30);
    const me = list.findIndex((e) => e.player);
    const shown = list.slice(0, 5).map((e, i) => ({ e, i }));
    if (me >= 5) shown.push({ e: list[me] as ArenaEntry, i: me });
    this.rows.innerHTML = '';
    for (const { e, i } of shown) {
      const row = h('div', `arena-row${e.player ? ' me' : ''}`);
      row.style.setProperty('--c', `#${e.color.toString(16).padStart(6, '0')}`);
      row.append(h('span', 'n', `${i + 1}`), h('span', 'who', e.name), h('span', 'm', formatInt(e.matter)));
      this.rows.appendChild(row);
    }
  }

  /** Radar: bigger ships in red, edible ones in purple, even ones in yellow. */
  blips(out: RadarBlip[]): void {
    if (!this.active) return;
    const pt = this.playerTier;
    const p = this.g.ufo.position;
    for (const b of this.bots) {
      if (!b.alive) continue;
      const x = p.x + this.ox(p, b.pos);
      const z = p.z + this.oz(p, b.pos);
      if (b.tier >= pt + EAT_MARGIN) out.push({ x, z, kind: 'enemy' });
      else if (pt >= b.tier + EAT_MARGIN) out.push({ x, z, kind: 'rare' });
      else out.push({ x, z, kind: 'event' });
    }
  }
}
