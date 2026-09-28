/**
 * ABDUZIU arena — room simulation shared by the Cloudflare Durable Object (server) and
 * the tests. Pure TypeScript: no Workers or DOM types in here.
 *
 * Model: players are authoritative for their own flight and the matter they farm from
 * their copy of the city; the room owns everything between ships: server bots, who is
 * holding whom under a beam and who gets swallowed.
 */

/** Wrapping tile: 8×8 blocks of 58 m + one 12 m road (same for every city). */
export const TILE = 8 * 58 + 12;
export const EAT_MARGIN = 0.6;
export const HOLD_BOT = 1.0;
export const HOLD_PLAYER = 0.85;
export const EAT_GAIN = 0.6;
export const ROOM_SHIPS = 12;
export const MAX_PLAYERS = 16;
/** Newcomers can't be swallowed (nor hunted) for their first seconds in the room. */
export const SPAWN_SHIELD = 10;
export const CITIES = ['nova_aurora', 'recife', 'salvador', 'rio', 'sao_paulo', 'brasilia', 'manaus'] as const;

const THRESHOLDS = [0, 0, 34, 95, 200, 390, 720, 1330, 2400, 4400, 8000, 14500];

/** Same curve as the game's RunProgression.tierFromMatter. */
export function tierFromMatter(matter: number): number {
  const th = THRESHOLDS;
  if (matter <= 0) return 1;
  for (let t = 1; t < th.length - 1; t++) {
    const lo = th[t] as number;
    const hi = th[t + 1] as number;
    if (matter < hi) return t + (matter - lo) / (hi - lo);
  }
  const last = th.length - 1;
  const lastTh = th[last] as number;
  const ratio = lastTh / (th[last - 1] as number);
  return last + Math.log(matter / lastTh) / Math.log(ratio);
}

export function shipScale(matter: number): number {
  return Math.min(9, Math.pow(1.215, Math.max(0, tierFromMatter(matter) - 1)));
}
export const shipRadius = (m: number) => 1.7 * shipScale(m);
/** Players carry beam upgrades: a little wider than the bare formula. */
export const beamRadius = (m: number, bot: boolean) => 2.2 * shipScale(m) * (bot ? 1 : 1.15);

/** Shortest signed offset on the torus. */
export function wrapDelta(d: number): number {
  return d - Math.round(d / TILE) * TILE;
}
export function wrapPos(v: number): number {
  const h = TILE / 2;
  return ((((v + h) % TILE) + TILE) % TILE) - h;
}

export interface Ship {
  id: string;
  name: string;
  color: number;
  bot: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  m: number;
  alive: boolean;
  /** Player's beam is on (bots always feed). */
  beam: boolean;
  held: number;
  heldBy: string | null;
  // bot brain
  skill: number;
  goalX: number;
  goalZ: number;
  think: number;
  respawn: number;
  /** Last state message from a player (ms). */
  seen: number;
  /** Room time when this ship (re)entered. */
  born: number;
  /** A player has sent its first state (left the intro). */
  flying?: boolean;
}

export type RoomEvent =
  | { k: 'eat'; a: string; b: string; gain: number }
  | { k: 'join'; id: string }
  | { k: 'leave'; id: string };

const BOT_NAMES = [
  'Pastel Voador', 'Caramelo_ET', 'Coxinha Orbital', 'Rapadura 3000', 'Vovó Galáctica', 'Brisa Cósmica', 'Zé do Disco',
  'Marcianinho', 'Tia do Óvni', 'Cometa Lindo', 'Neblina', 'Seu Alienígena', 'Pão de Queijo X', 'Açaí Estelar',
  'Bate-Latinha', 'Dona Nave', 'Capitão Farofa', 'Kombi Sideral', 'Tapioca Turbo', 'Guaraná Nebular',
];
const COLORS = [0xff5ad1, 0xffb020, 0x4dc9ff, 0xff4d5e, 0xc28bff, 0xfff05a, 0x5affea, 0xff8a3d, 0x8aff5a, 0x5a7bff, 0xff7ab8, 0xffd166, 0x06d6a0, 0xef476f, 0x9b5de5];

export class RoomSim {
  readonly ships = new Map<string, Ship>();
  time = 0;
  private botSeq = 0;
  private events: RoomEvent[] = [];

  constructor(private readonly rand: () => number = Math.random) {}

  get players(): Ship[] {
    return [...this.ships.values()].filter((s) => !s.bot);
  }

  addPlayer(id: string, name: string, color: number, now: number): Ship {
    const p = this.spawnPoint();
    const s: Ship = { id, name, color, bot: false, x: p.x, z: p.z, vx: 0, vz: 0, m: 0, alive: true, beam: true, held: 0, heldBy: null, skill: 1, goalX: 0, goalZ: 0, think: 0, respawn: 0, seen: now, born: this.time };
    this.ships.set(id, s);
    this.events.push({ k: 'join', id });
    return s;
  }

  removeShip(id: string): void {
    if (this.ships.delete(id)) this.events.push({ k: 'leave', id });
  }

  /** A player's own report: position/velocity/matter. Matter growth is rate-limited. */
  playerState(id: string, x: number, z: number, vx: number, vz: number, m: number, beam: boolean, now: number): void {
    const s = this.ships.get(id);
    if (!s || s.bot || !s.alive) return;
    // the shield starts when the player is actually flying (after the intro)
    if (!s.flying) {
      s.flying = true;
      s.born = this.time;
      s.seen = now;
      this.recycleFry(3);
    }
    const dt = Math.max(0.05, (now - s.seen) / 1000);
    s.seen = now;
    s.x = wrapPos(Number.isFinite(x) ? x : s.x);
    s.z = wrapPos(Number.isFinite(z) ? z : s.z);
    const vmax = 80;
    s.vx = Math.max(-vmax, Math.min(vmax, vx || 0));
    s.vz = Math.max(-vmax, Math.min(vmax, vz || 0));
    // honest combos can snowball fast, but not teleport to the top
    const cap = s.m + Math.max(400, s.m * 0.6) * dt;
    if (Number.isFinite(m) && m >= 0) s.m = Math.min(m, cap);
    s.beam = !!beam;
  }

  private spawnPoint(): { x: number; z: number } {
    // far from the biggest ship
    let best = { x: 0, z: 0 };
    let bestD = -1;
    const big = [...this.ships.values()].filter((s) => s.alive).sort((a, b) => b.m - a.m)[0];
    for (let i = 0; i < 8; i++) {
      const c = { x: (this.rand() - 0.5) * TILE, z: (this.rand() - 0.5) * TILE };
      const d = big ? Math.hypot(wrapDelta(c.x - big.x), wrapDelta(c.z - big.z)) : 0;
      if (d > bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }

  private addBot(): void {
    const p = this.spawnPoint();
    const id = `b${++this.botSeq}`;
    const used = new Set([...this.ships.values()].map((s) => s.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Nave ${this.botSeq}`;
    const skills = [1.2, 1.05, 0.9, 0.75, 0.6, 0.45];
    const bots = [...this.ships.values()].filter((s) => s.bot).length;
    const skill = skills[bots] ?? 0.15 + this.rand() * 0.3;
    this.ships.set(id, {
      id, name, color: COLORS[this.botSeq % COLORS.length] as number, bot: true, x: p.x, z: p.z, vx: 0, vz: 0,
      m: 5 + this.rand() * this.paceFor(skill) * skill * 0.6, alive: true, beam: true, held: 0, heldBy: null,
      skill, goalX: p.x, goalZ: p.z, think: 0, respawn: 0, seen: 0, born: this.time,
    });
  }

  /**
   * Size a bot paces itself against: sharks follow the biggest player, the small fry
   * follow the smallest one, so a newcomer always finds both prey and threats.
   */
  private paceFor(skill: number): number {
    const ms = this.players.filter((p) => p.alive).map((p) => p.m);
    const top = Math.max(60, ...ms);
    const low = Math.max(40, ms.length ? Math.min(...ms) : 40);
    return skill >= 0.5 ? top : low * 2.2;
  }


  /** Advances the room; returns (and clears) what happened. */
  step(dt: number): RoomEvent[] {
    this.time += dt;
    const all = () => [...this.ships.values()];
    // keep the room lively: bots fill the empty seats
    const humans = this.players.length;
    const wantBots = Math.max(0, ROOM_SHIPS - humans);
    const bots = all().filter((s) => s.bot);
    if (bots.length < wantBots) this.addBot();
    else if (bots.length > wantBots) {
      const smallest = bots.sort((a, b) => a.m - b.m)[0];
      if (smallest) this.ships.delete(smallest.id);
    }

    for (const b of all()) {
      if (!b.bot) continue;
      const pace = this.paceFor(b.skill);
      if (!b.alive) {
        b.respawn -= dt;
        if (b.respawn <= 0) {
          const p = this.spawnPoint();
          Object.assign(b, { x: p.x, z: p.z, vx: 0, vz: 0, alive: true, held: 0, heldBy: null, m: 5 + this.rand() * pace * b.skill * 0.5, born: this.time });
        }
        continue;
      }
      this.brain(b, dt);
      // off-screen farming toward its pace
      const target = pace * b.skill + 30;
      if (b.m < target) b.m += (target - b.m) * Math.min(1, 0.05 * dt);
    }

    // beams: who holds whom
    const alive = all().filter((s) => s.alive);
    for (const v of alive) {
      if (this.shielded(v)) {
        v.held = 0;
        v.heldBy = null;
        continue;
      }
      let holder: Ship | null = null;
      const tv = tierFromMatter(v.m);
      for (const a of alive) {
        if (a === v || (!a.bot && !a.beam)) continue;
        if (tierFromMatter(a.m) < tv + EAT_MARGIN) continue;
        const d = Math.hypot(wrapDelta(a.x - v.x), wrapDelta(a.z - v.z));
        if (d < beamRadius(a.m, a.bot) + shipRadius(v.m) * 0.2 && (!holder || a.m > holder.m)) holder = a;
      }
      if (holder) {
        if (v.heldBy !== holder.id) v.held = 0;
        v.heldBy = holder.id;
        v.held += dt;
        if (v.held >= (v.bot ? HOLD_BOT : HOLD_PLAYER)) this.swallow(holder, v);
      } else {
        v.held = Math.max(0, v.held - dt * 1.5);
        if (v.held <= 0) v.heldBy = null;
      }
    }
    const out = this.events;
    this.events = [];
    return out;
  }

  /** A newcomer needs snacks: a few small-fry bots come back small somewhere else. */
  private recycleFry(n: number): void {
    const fry = [...this.ships.values()].filter((s) => s.bot && s.skill < 0.5).sort((a, b) => b.m - a.m);
    for (const b of fry.slice(0, n)) {
      const p = this.spawnPoint();
      Object.assign(b, { x: p.x, z: p.z, vx: 0, vz: 0, alive: true, held: 0, heldBy: null, m: 5 + this.rand() * 40, born: this.time, respawn: 0 });
    }
  }

  shielded(s: Ship): boolean {
    return !s.bot && (!s.flying || this.time - s.born < SPAWN_SHIELD);
  }

  private swallow(a: Ship, v: Ship): void {
    const gain = v.m * EAT_GAIN;
    if (a.bot) a.m = Math.min(a.m + gain, Math.max(a.m, (this.paceFor(a.skill) * a.skill + 30) * 1.2));
    else a.m += gain;
    v.alive = false;
    v.held = 0;
    v.heldBy = null;
    this.events.push({ k: 'eat', a: a.id, b: v.id, gain });
    if (v.bot) v.respawn = 3.5;
  }

  private brain(b: Ship, dt: number): void {
    b.think -= dt;
    const t = tierFromMatter(b.m);
    const r = shipRadius(b.m);
    const sight = 80 + r * 9;
    if (b.think <= 0) {
      b.think = 0.25 + this.rand() * 0.2;
      let flee: Ship | null = null;
      let prey: Ship | null = null;
      let fd = Infinity;
      let pd = Infinity;
      for (const o of this.ships.values()) {
        if (o === b || !o.alive || this.shielded(o)) continue;
        const d = Math.hypot(wrapDelta(o.x - b.x), wrapDelta(o.z - b.z));
        const to = tierFromMatter(o.m);
        if (to >= t + EAT_MARGIN && d < sight * 0.5 && d < fd) {
          flee = o;
          fd = d;
        } else if (t >= to + EAT_MARGIN && d < sight && (o.bot ? d : d * 0.6) < pd) {
          // players are the juiciest prey
          prey = o;
          pd = o.bot ? d : d * 0.6;
        }
      }
      if (flee) {
        b.goalX = b.x - wrapDelta(flee.x - b.x) * 2;
        b.goalZ = b.z - wrapDelta(flee.z - b.z) * 2;
      } else if (prey) {
        b.goalX = b.x + wrapDelta(prey.x - b.x) + prey.vx * 0.4;
        b.goalZ = b.z + wrapDelta(prey.z - b.z) + prey.vz * 0.4;
      } else if (Math.hypot(wrapDelta(b.goalX - b.x), wrapDelta(b.goalZ - b.z)) < 8) {
        b.goalX = (this.rand() - 0.5) * TILE;
        b.goalZ = (this.rand() - 0.5) * TILE;
      }
    }
    const speed = 10.5 * Math.pow(shipScale(b.m), 0.4) * (b.heldBy ? 0.7 : 1);
    const dx = wrapDelta(b.goalX - b.x);
    const dz = wrapDelta(b.goalZ - b.z);
    const d = Math.hypot(dx, dz) || 1;
    const k = 1 - Math.exp(-3.5 * dt);
    b.vx += ((dx / d) * speed - b.vx) * k;
    b.vz += ((dz / d) * speed - b.vz) * k;
    b.x = wrapPos(b.x + b.vx * dt);
    b.z = wrapPos(b.z + b.vz * dt);
  }

  /** Top of the room for the live leaderboard. */
  leaderboard(n = 10): Array<{ id: string; n: string; m: number; bot: boolean }> {
    return [...this.ships.values()]
      .filter((s) => s.alive)
      .sort((a, b) => b.m - a.m)
      .slice(0, n)
      .map((s) => ({ id: s.id, n: s.name, m: Math.round(s.m), bot: s.bot }));
  }
}
