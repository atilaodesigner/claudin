/**
 * The match simulation: players, ball, contacts and rules, one fixed tick at a time.
 *
 * Runs identically on the server (authority), in the client's prediction and in local
 * games (training / bot). No DOM, audio, clocks or Math.random here. The full state is
 * plain data (`MatchState`), so `snapshot()`/`restore()` are exact copies.
 *
 * Tick order (PLANO.md §7.2, refined in B1): inputs by slot → players move and advance
 * actions → ball physics → at most one contact, swept along the ball's path of this
 * tick (the ball is moved back to the contact point) → rally detection → phase timers.
 */

import { Btn, moveAxis } from './input';
import { BALL, CONTACT, COURT, DT, MATCH, PARTS, PLAYER, SHOT, TIMING, type ActionTiming } from './params';
import { BallPhysics } from './physics';
import { nextRandom } from './rng';

// Available in Node ≥ 17 and every target browser; declared here so the package needs no DOM lib.
declare function structuredClone<T>(value: T): T;

export type Team = 0 | 1;
export type Dir = -1 | 0 | 1;
export type ActKind = 'touch' | 'attack' | 'serve';
export type Part = 'foot' | 'thigh' | 'chest' | 'head';
export type Grade = 'perfect' | 'good' | 'ok';
export type Reason = 'ground' | 'out' | 'fourTouches' | 'double' | 'serveInvalid' | 'forfeit';
export type Phase = 'idle' | 'countdown' | 'prep' | 'serve' | 'rally' | 'pending' | 'point' | 'void' | 'paused' | 'resume' | 'over';

export interface ActionState {
  kind: ActKind;
  /** Ticks since the action started (1 on its first tick). */
  t: number;
  air: boolean;
  /** Intent relative to the net: +1 toward it ("frente"), -1 away ("trás"). */
  dir: Dir;
  hit: boolean;
}

export interface PlayerState {
  slot: number;
  team: Team;
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  act: ActionState | null;
  /** Recovery ticks left (no new action, slow movement). */
  lock: number;
  /** Set when an air action ends before landing: recovery applied on touchdown. */
  airLock: number;
  squat: number;
  jumpBuf: number;
  actBuf: number;
  actBufKind: ActKind;
  actBufDir: Dir;
  cooldown: number;
  /** After a contact the ball must leave this player's reach before they can touch it again. */
  mustClear: boolean;
  prev: number;
  /** Last contact, for animation. */
  lastPart: Part | '';
  lastTick: number;
}

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  held: boolean;
}

export interface MatchState {
  tick: number;
  phase: Phase;
  phaseT: number;
  score: [number, number];
  serveTeam: Team;
  serverSlot: number;
  /** Index (within the team's slots) of who serves when the team gets the serve. */
  teamServer: [number, number];
  /** Side the ball is on. */
  side: Team;
  possession: Team;
  touches: number;
  lastTouchTeam: Team;
  lastTouchSlot: number;
  serveInFlight: boolean;
  netT: number;
  stuckT: number;
  rallyT: number;
  pendingWinner: -1 | Team;
  pendingReason: Reason | '';
  winner: -1 | Team;
  endReason: Reason | 'score' | '';
  pausedFrom: Phase | '';
  rng: number;
  evSeq: number;
  rallyContacts: number;
  crossings: number;
  ball: BallState;
  players: PlayerState[];
}

export type SimEventBody =
  | { k: 'contact'; slot: number; team: Team; kind: ActKind; part: Part; grade: Grade; n: number; speed: number; x: number; y: number }
  | { k: 'net'; x: number; y: number }
  | { k: 'cross'; to: Team }
  | { k: 'ground'; x: number; inside: boolean }
  | { k: 'out'; x: number }
  | { k: 'fault'; reason: Reason; winner: Team }
  | { k: 'point'; winner: Team; reason: Reason; score: [number, number] }
  | { k: 'void'; why: 'stuck' | 'long' | 'reconnect' }
  | { k: 'phase'; phase: Phase }
  | { k: 'autoServe'; slot: number }
  | { k: 'jump'; slot: number }
  | { k: 'over'; winner: Team; reason: Reason | 'score' };

export type SimEvent = SimEventBody & { id: number; tick: number };

export interface MatchConfig {
  /** 2 (1v1) or 4 (2v2). Slot s plays for team s % 2. */
  players: 2 | 4;
  seed: number;
}

export const teamOf = (slot: number): Team => (slot % 2) as Team;
/** +1 if the team's "forward" (toward the net) is +x. */
export const facing = (team: Team): 1 | -1 => (team === 0 ? 1 : -1);
const sideOf = (x: number, fallback: Team): Team => (x < 0 ? 0 : x > 0 ? 1 : fallback);
const approach = (v: number, target: number, step: number): number => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

function timingOf(a: ActionState): ActionTiming {
  if (a.kind === 'serve') return TIMING.serve;
  if (a.kind === 'touch') return a.air ? TIMING.touchAir : TIMING.touchGround;
  return a.air ? TIMING.attackAir : TIMING.attackGround;
}

export function isActive(a: ActionState): boolean {
  const tm = timingOf(a);
  return a.t > tm.startup && a.t <= tm.startup + tm.active;
}

/** Scoring: first to 7 with a 2-point lead, capped at 11 (so 10×10 → next point wins). */
export function isWinningScore(mine: number, theirs: number): boolean {
  return mine >= MATCH.cap || (mine >= MATCH.target && mine - theirs >= MATCH.winBy);
}

function newPlayer(slot: number): PlayerState {
  return {
    slot,
    team: teamOf(slot),
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    grounded: true,
    act: null,
    lock: 0,
    airLock: 0,
    squat: 0,
    jumpBuf: 0,
    actBuf: 0,
    actBufKind: 'touch',
    actBufDir: 0,
    cooldown: 0,
    mustClear: false,
    prev: 0,
    lastPart: '',
    lastTick: -1,
  };
}

export function createMatchState(cfg: MatchConfig): MatchState {
  const players = Array.from({ length: cfg.players }, (_, i) => newPlayer(i));
  const s: MatchState = {
    tick: 0,
    phase: 'idle',
    phaseT: 0,
    score: [0, 0],
    serveTeam: 0,
    serverSlot: 0,
    teamServer: [0, 0],
    side: 0,
    possession: 0,
    touches: 0,
    lastTouchTeam: 0,
    lastTouchSlot: -1,
    serveInFlight: false,
    netT: 0,
    stuckT: 0,
    rallyT: 0,
    pendingWinner: -1,
    pendingReason: '',
    winner: -1,
    endReason: '',
    pausedFrom: '',
    rng: cfg.seed | 0,
    evSeq: 0,
    rallyContacts: 0,
    crossings: 0,
    ball: { x: 0, y: BALL.radius, vx: 0, vy: 0, held: true },
    players,
  };
  resetPositions(s);
  return s;
}

function teamSlots(s: MatchState, team: Team): PlayerState[] {
  return s.players.filter((p) => p.team === team);
}

function resetPositions(s: MatchState): void {
  const size = s.players.length / 2;
  for (const p of s.players) {
    const f = facing(p.team);
    const idx = teamSlots(s, p.team).indexOf(p);
    const depth = size === 1 ? 0.5 : idx === 0 ? 0.3 : 0.7;
    Object.assign(p, {
      x: -f * COURT.half * depth,
      y: 0,
      vx: 0,
      vy: 0,
      grounded: true,
      act: null,
      lock: 0,
      airLock: 0,
      squat: 0,
      jumpBuf: 0,
      actBuf: 0,
      cooldown: 0,
      mustClear: false,
    });
  }
  const server = s.players[s.serverSlot]!;
  const f = facing(server.team);
  server.x = -f * (COURT.half + 0.6);
  s.ball = { x: server.x + f * 0.45, y: BALL.radius, vx: 0, vy: 0, held: true };
  s.side = server.team;
  s.possession = server.team;
  s.touches = 0;
  s.lastTouchSlot = -1;
  s.lastTouchTeam = server.team;
  s.serveInFlight = false;
  s.stuckT = 0;
  s.rallyT = 0;
  s.netT = 0;
  s.rallyContacts = 0;
  s.crossings = 0;
}

/** Depth target on the opponent side of `team` (world x). */
function oppTarget(team: Team, dir: Dir): number {
  const d = dir === 1 ? COURT.half - SHOT.depthDeepFromBase : dir === -1 ? SHOT.depthShort : COURT.half * SHOT.depthMid;
  return facing(team) * d;
}

/** Launch to reach `apex`, then come back down to height `ret` at x = tx. */
function arcTo(bx: number, by: number, tx: number, apex: number, ret: number): [number, number] {
  const g = BALL.gravity;
  const H = Math.max(apex, by + 0.4);
  const vy = Math.sqrt(2 * g * (H - by));
  const t = vy / g + Math.sqrt((2 * Math.max(H - ret, 0.05)) / g);
  return [(tx - bx) / t, vy];
}

/**
 * Attack: horizontal speed `speed`, landing at tx. If that line can't clear the net,
 * the speed drops to the fastest one that passes through the clearance point
 * (closed form: the parabola through the net-top point and the landing point).
 */
function attackTo(bx: number, by: number, tx: number, speed: number): [number, number] {
  const g = BALL.gravity;
  const dirX = tx >= bx ? 1 : -1;
  const clear = COURT.netTop + BALL.radius + SHOT.netMargin;
  const a = Math.max(Math.abs(bx), 0.05);
  const D = Math.max(Math.abs(tx - bx), a + 0.1);
  const k2 = (2 * ((clear * D) / (D - a) - by)) / (g * a * D);
  const sp = k2 > 0 ? Math.min(speed, 1 / Math.sqrt(k2)) : speed;
  const t2 = D / sp;
  const vy = ((g * t2 * t2) / 2 - by) / t2;
  return [dirX * sp, vy];
}

/** The player's contact volume (world x0, x1, y0, y1), without the tolerance. */
function reachBox(p: PlayerState): [number, number, number, number] {
  const f = facing(p.team);
  const x0 = f > 0 ? p.x - CONTACT.back : p.x - CONTACT.front;
  const x1 = f > 0 ? p.x + CONTACT.front : p.x + CONTACT.back;
  return [x0, x1, p.y, p.y + CONTACT.top];
}

function inReach(p: PlayerState, x: number, y: number): boolean {
  const [x0, x1, y0, y1] = reachBox(p);
  const reach = BALL.radius + CONTACT.grace;
  const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
  const dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
  return dx * dx + dy * dy <= reach * reach;
}

export class Match {
  state: MatchState;
  private readonly phys = new BallPhysics();
  private events: SimEvent[] = [];

  constructor(cfg: MatchConfig, state?: MatchState) {
    this.state = state ? structuredClone(state) : createMatchState(cfg);
    this.syncBall();
  }

  snapshot(): MatchState {
    return structuredClone(this.state);
  }

  restore(s: MatchState): void {
    this.state = structuredClone(s);
    this.syncBall();
  }

  dispose(): void {
    this.phys.free();
  }

  /** Coin toss ("chinelo ao alto") and countdown. */
  start(): SimEvent[] {
    this.events = [];
    const s = this.state;
    const [r, next] = nextRandom(s.rng);
    s.rng = next;
    s.serveTeam = r < 0.5 ? 0 : 1;
    s.teamServer = [0, 0];
    s.serverSlot = teamSlots(s, s.serveTeam)[0]!.slot;
    s.score = [0, 0];
    s.winner = -1;
    s.endReason = '';
    resetPositions(s);
    this.syncBall();
    this.setPhase('countdown');
    return this.events;
  }

  /** Connection drop: the match clock stops. A pending fault is scored first (no escaping a point by dropping). */
  pause(): SimEvent[] {
    this.events = [];
    const s = this.state;
    if (s.phase === 'paused' || s.phase === 'over' || s.phase === 'idle') return this.events;
    if (s.phase === 'pending') this.awardPoint();
    s.pausedFrom = s.phase;
    this.setPhase('paused');
    return this.events;
  }

  resume(): SimEvent[] {
    this.events = [];
    if (this.state.phase === 'paused') this.setPhase('resume');
    return this.events;
  }

  forfeit(loser: Team): SimEvent[] {
    this.events = [];
    const s = this.state;
    if (s.phase === 'over') return this.events;
    s.winner = (1 - loser) as Team;
    s.endReason = 'forfeit';
    this.setPhase('over');
    this.emit({ k: 'over', winner: s.winner, reason: 'forfeit' });
    return this.events;
  }

  /** Advances one tick. `buttons[slot]` is that player's input for this tick. */
  step(buttons: ArrayLike<number>): SimEvent[] {
    this.events = [];
    const s = this.state;
    s.tick++;
    if (s.phase === 'paused') {
      this.holdBallIfNeeded();
      return this.events;
    }
    s.phaseT++;

    const prevBall = { ...s.ball };
    for (const p of s.players) this.updatePlayer(p, buttons[p.slot] ?? 0);
    if (s.ball.held) this.holdBallIfNeeded();
    else {
      const b = this.phys.step();
      s.ball.x = b.x;
      s.ball.y = b.y;
      s.ball.vx = b.vx;
      s.ball.vy = b.vy;
    }
    const touched = this.resolveContact(prevBall);
    for (const p of s.players) {
      this.finishAction(p);
      if (p.mustClear && !touched && !inReach(p, s.ball.x, s.ball.y)) p.mustClear = false;
    }
    if (s.phase === 'rally' && !touched) this.detectRally(prevBall);
    this.advancePhase();
    return this.events;
  }

  // ── players ────────────────────────────────────────────────────────────────

  private updatePlayer(p: PlayerState, buttons: number): void {
    const s = this.state;
    const ph = s.phase;
    const f = facing(p.team);
    const isServer = p.slot === s.serverSlot;
    const canMove = (ph === 'serve' && !isServer) || ph === 'rally' || ph === 'pending' || ph === 'point' || ph === 'over' || ph === 'idle';
    const canAct = ph === 'rally' || (ph === 'serve' && isServer);

    const pressed = buttons & ~p.prev;
    p.prev = buttons;
    const axis = canMove ? moveAxis(buttons) : 0;
    const dirToNet = (axis * f) as Dir;

    if (pressed & Btn.Jump) p.jumpBuf = PLAYER.jumpBuffer;
    else if (p.jumpBuf > 0) p.jumpBuf--;
    if (pressed & (Btn.Touch | Btn.Attack)) {
      p.actBuf = CONTACT.buffer;
      p.actBufKind = pressed & Btn.Attack ? 'attack' : 'touch';
      p.actBufDir = dirToNet;
    } else if (p.actBuf > 0) p.actBuf--;
    if (!canAct) p.actBuf = 0;
    if (p.cooldown > 0) p.cooldown--;
    if (p.lock > 0) p.lock--;

    // start an action (the serve replaces whatever button the server pressed)
    if (canAct && p.act === null && p.lock === 0 && p.squat === 0 && p.actBuf > 0) {
      const kind: ActKind = ph === 'serve' ? 'serve' : p.actBufKind;
      p.act = { kind, t: 0, air: !p.grounded, dir: axis !== 0 ? dirToNet : p.actBufDir, hit: false };
      p.actBuf = 0;
    }

    // jump (cancels a ground touch that is still winding up)
    const cancellable = p.act !== null && p.act.kind === 'touch' && !p.act.air && p.act.t < TIMING.touchGround.startup;
    if (canMove && p.grounded && p.jumpBuf > 0 && p.squat === 0 && p.lock === 0 && (p.act === null || cancellable)) {
      p.act = null;
      p.squat = PLAYER.jumpSquat;
      p.jumpBuf = 0;
    }
    if (p.squat > 0) {
      p.squat--;
      if (p.squat === 0) {
        p.vy = PLAYER.jumpSpeed;
        p.grounded = false;
        this.emit({ k: 'jump', slot: p.slot });
      }
    }

    // horizontal
    const mult = p.act ? PLAYER.moveInAction : p.lock > 0 ? PLAYER.moveInRecovery : 1;
    const target = axis * PLAYER.runSpeed * (p.grounded ? mult : 1);
    let acc: number = PLAYER.accelAir;
    if (p.grounded) acc = Math.abs(target) > Math.abs(p.vx) && target * p.vx >= 0 ? PLAYER.accelGround : PLAYER.decelGround;
    p.vx = approach(p.vx, target, acc * DT);

    // vertical
    if (!p.grounded) p.vy -= PLAYER.gravity * DT;
    p.x += p.vx * DT;
    p.y += p.vy * DT;
    if (!p.grounded && p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.grounded = true;
      if (p.act && p.act.air) {
        // landed mid air-action: it ends here
        const tm = timingOf(p.act);
        p.lock = p.act.hit ? tm.recover : tm.whiff;
        p.act = null;
      } else if (p.airLock > 0) {
        p.lock = p.airLock;
        p.airLock = 0;
      } else p.lock = Math.max(p.lock, PLAYER.landLag);
    }

    // own side only
    const lo = p.team === 0 ? -(COURT.half + COURT.freeZone) : COURT.netGap;
    const hi = p.team === 0 ? -COURT.netGap : COURT.half + COURT.freeZone;
    const cx = clamp(p.x, lo, hi);
    if (cx !== p.x) {
      p.x = cx;
      p.vx = 0;
    }

    if (p.act) p.act.t++;
  }

  private finishAction(p: PlayerState): void {
    const a = p.act;
    if (!a) return;
    const tm = timingOf(a);
    if (a.t < tm.startup + tm.active) return;
    if (a.air && !p.grounded) p.airLock = a.hit ? tm.recover : tm.whiff;
    else p.lock = a.hit ? tm.recover : tm.whiff;
    p.act = null;
  }

  // ── contact ────────────────────────────────────────────────────────────────

  /** Returns true if the ball was touched this tick. */
  private resolveContact(prev: BallState): boolean {
    const s = this.state;
    const b = s.ball;
    const r = BALL.radius;
    let best: { p: PlayerState; cx: number; cy: number; dx: number } | null = null;
    for (const p of s.players) {
      const a = p.act;
      if (!a || a.hit || !isActive(a) || p.cooldown > 0) continue;
      if (a.kind === 'serve') {
        if (s.phase === 'serve' && p.slot === s.serverSlot) {
          this.launchServe(p);
          return true;
        }
        continue;
      }
      if (s.phase !== 'rally' || p.team !== s.side || b.held || p.mustClear) continue;
      const f = facing(p.team);
      const [x0, x1, y0, y1] = reachBox(p);
      // sweep the ball's path over this tick (so fast balls can't skip the volume);
      // the contact happens where the ball first comes within reach
      const reach = r + CONTACT.grace;
      let hit = false;
      let cx = b.x;
      let cy = b.y;
      for (let i = 0; i <= 4 && !hit; i++) {
        const u = i / 4;
        const px = prev.x + (b.x - prev.x) * u;
        const py = prev.y + (b.y - prev.y) * u;
        const ddx = px < x0 ? x0 - px : px > x1 ? px - x1 : 0;
        const ddy = py < y0 ? y0 - py : py > y1 ? py - y1 : 0;
        if (ddx * ddx + ddy * ddy <= reach * reach) {
          hit = true;
          cx = px;
          cy = py;
        }
      }
      if (!hit) continue;
      if (sideOf(cx, s.side) !== p.team) continue;
      const dx = cx - (p.x + f * CONTACT.ideal);
      if (!best || Math.abs(dx) < Math.abs(best.dx) || (Math.abs(dx) === Math.abs(best.dx) && p.slot < best.p.slot)) best = { p, cx, cy, dx };
    }
    if (!best) return false;
    this.applyContact(best.p, best.cx, best.cy, best.dx);
    return true;
  }

  private launchServe(p: PlayerState): void {
    const s = this.state;
    const a = p.act!;
    const b = s.ball;
    const [vx, vy] = arcTo(b.x, b.y, oppTarget(p.team, a.dir), SHOT.serveApex, BALL.radius);
    a.hit = true;
    p.cooldown = CONTACT.cooldown;
    p.lastPart = 'foot';
    p.lastTick = s.tick;
    b.held = false;
    b.vx = vx;
    b.vy = vy;
    this.phys.set(b.x, b.y, vx, vy);
    s.possession = p.team;
    s.touches = 1;
    s.lastTouchTeam = p.team;
    s.lastTouchSlot = p.slot;
    s.serveInFlight = true;
    s.rallyContacts = 1;
    this.emit({ k: 'contact', slot: p.slot, team: p.team, kind: 'serve', part: 'foot', grade: 'good', n: 1, speed: Math.sqrt(vx * vx + vy * vy), x: b.x, y: b.y });
    this.setPhase('rally');
  }

  private applyContact(p: PlayerState, cx: number, cy: number, dx: number): void {
    const s = this.state;
    const a = p.act!;
    const b = s.ball;
    const f = facing(p.team);
    const h = cy - p.y;
    const part: Part = a.air ? (h > 1.5 ? 'head' : 'foot') : h < PARTS.foot ? 'foot' : h < PARTS.thigh ? 'thigh' : h < PARTS.chest ? 'chest' : 'head';

    // timing quality → deterministic, readable error (early = short, late = long)
    const incoming = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    let th: number = incoming > CONTACT.fastBall ? CONTACT.perfectFast : CONTACT.perfect;
    if (part === 'thigh') th += 0.06;
    if (part === 'head') th -= 0.05;
    const adx = Math.abs(dx);
    const grade: Grade = adx < th ? 'perfect' : adx < CONTACT.good ? 'good' : 'ok';
    let e = 0;
    if (grade !== 'perfect') {
      const mag = clamp((adx - th) / (CONTACT.front + CONTACT.grace - th), 0, 1);
      const approaching = b.vx * f < 0 || Math.abs(b.vx) < 0.5;
      const early = dx * f > 0 === approaching;
      e = (early ? -1 : 1) * (0.3 + 0.7 * mag);
    }

    // possession and touch count
    if (s.possession !== p.team) {
      s.possession = p.team;
      s.touches = 0;
      s.lastTouchSlot = -1;
    }
    s.touches++;
    const n = s.touches;
    const double = s.players.length > 2 && s.lastTouchSlot === p.slot;
    const serveTouch = s.serveInFlight && p.team === s.serveTeam;

    let vx: number;
    let vy: number;
    if (a.kind === 'touch' && n < MATCH.maxTouches) {
      const off = a.dir === 1 ? SHOT.setFront : a.dir === -1 ? SHOT.setBack : SHOT.setForward;
      const lim = f > 0 ? [-COURT.half, -SHOT.setNetMin] : [SHOT.setNetMin, COURT.half];
      const tx = clamp(p.x + f * off, lim[0]!, lim[1]!);
      [vx, vy] = arcTo(cx, cy, tx, SHOT.setApex - (part === 'chest' ? SHOT.setChestDrop : 0), SHOT.setReturn);
    } else if (a.kind === 'touch') {
      [vx, vy] = arcTo(cx, cy, oppTarget(p.team, a.dir), Math.max(SHOT.lobApex, cy + 1.2), BALL.radius);
    } else {
      const sp = a.air
        ? part === 'head'
          ? SHOT.attackAirHead
          : SHOT.attackAirFoot
        : part === 'foot'
          ? SHOT.attackKick
          : part === 'head'
            ? SHOT.attackHead
            : SHOT.attackVolley;
      [vx, vy] = attackTo(cx, cy, oppTarget(p.team, a.dir), sp);
    }
    vx *= 1 + e * CONTACT.errorGain;
    if (vy > BALL.maxLaunchVy) vy = BALL.maxLaunchVy;

    b.x = cx;
    b.y = Math.max(cy, BALL.radius);
    b.vx = vx;
    b.vy = vy;
    this.phys.set(b.x, b.y, vx, vy);

    a.hit = true;
    p.cooldown = CONTACT.cooldown;
    p.mustClear = true;
    p.lastPart = part;
    p.lastTick = s.tick;
    s.lastTouchTeam = p.team;
    s.lastTouchSlot = p.slot;
    s.rallyContacts++;
    s.stuckT = 0;
    this.emit({ k: 'contact', slot: p.slot, team: p.team, kind: a.kind, part, grade, n, speed: Math.sqrt(vx * vx + vy * vy), x: cx, y: cy });

    const other = (1 - p.team) as Team;
    if (serveTouch) this.fault('serveInvalid', other);
    else if (n > MATCH.maxTouches) this.fault('fourTouches', other);
    else if (double) this.fault('double', other);
  }

  // ── rally rules ────────────────────────────────────────────────────────────

  private detectRally(prev: BallState): void {
    const s = this.state;
    const b = s.ball;
    const r = BALL.radius;
    if (s.netT > 0) s.netT--;
    if (Math.abs(b.x) <= COURT.netHalf + r + 0.03 && b.y <= COURT.netTop + r + 0.03 && s.netT === 0) {
      s.netT = 10;
      this.emit({ k: 'net', x: b.x, y: b.y });
    }
    const side = sideOf(b.x, s.side);
    if (side !== s.side) {
      s.side = side;
      s.possession = side;
      s.touches = 0;
      s.lastTouchSlot = -1;
      s.serveInFlight = false;
      s.crossings++;
      this.emit({ k: 'cross', to: side });
    }
    const landed = prev.vy < 0 && b.y <= r + 0.02;
    if (landed) {
      const inside = Math.abs(b.x) <= COURT.half + r;
      this.emit({ k: 'ground', x: b.x, inside });
      if (inside) this.fault('ground', (1 - sideOf(b.x, s.side)) as Team);
      else this.fault('out', (1 - s.lastTouchTeam) as Team);
      return;
    }
    if (Math.abs(b.x) > COURT.half + COURT.freeZone) {
      this.emit({ k: 'out', x: b.x });
      this.fault('out', (1 - s.lastTouchTeam) as Team);
      return;
    }
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    s.stuckT = sp < BALL.stuckSpeed ? s.stuckT + 1 : 0;
    s.rallyT++;
    if (s.stuckT >= BALL.stuckTicks) this.voidRally('stuck');
    else if (s.rallyT >= MATCH.rallyMax) this.voidRally('long');
  }

  private fault(reason: Reason, winner: Team): void {
    const s = this.state;
    if (s.phase !== 'rally') return;
    s.pendingWinner = winner;
    s.pendingReason = reason;
    this.emit({ k: 'fault', reason, winner });
    this.setPhase('pending');
  }

  private voidRally(why: 'stuck' | 'long' | 'reconnect'): void {
    this.emit({ k: 'void', why });
    this.setPhase('void');
  }

  private awardPoint(): void {
    const s = this.state;
    const w = s.pendingWinner;
    if (w === -1) return;
    const reason = s.pendingReason as Reason;
    s.pendingWinner = -1;
    s.pendingReason = '';
    s.score[w]++;
    if (w !== s.serveTeam) {
      // side out: the other partner of the winning team serves (2v2)
      const slots = teamSlots(s, w);
      s.teamServer[w] = (s.teamServer[w] + 1) % slots.length;
      s.serveTeam = w;
    }
    s.serverSlot = teamSlots(s, s.serveTeam)[s.teamServer[s.serveTeam]]!.slot;
    if (isWinningScore(s.score[w], s.score[(1 - w) as Team])) {
      s.winner = w;
      s.endReason = 'score';
    }
    this.emit({ k: 'point', winner: w, reason, score: [s.score[0], s.score[1]] });
    this.setPhase('point');
  }

  private advancePhase(): void {
    const s = this.state;
    switch (s.phase) {
      case 'countdown':
        if (s.phaseT >= MATCH.countdown) this.toPrep();
        break;
      case 'prep':
        if (s.phaseT >= MATCH.prep) this.setPhase('serve');
        break;
      case 'serve': {
        const server = s.players[s.serverSlot]!;
        if (s.phaseT >= MATCH.serveWindow && server.act === null) {
          server.act = { kind: 'serve', t: 0, air: false, dir: 0, hit: false };
          this.emit({ k: 'autoServe', slot: server.slot });
        }
        break;
      }
      case 'pending':
        if (s.phaseT >= MATCH.pending) this.awardPoint();
        break;
      case 'point':
        if (s.phaseT >= MATCH.point) {
          if (s.winner !== -1) {
            this.setPhase('over');
            this.emit({ k: 'over', winner: s.winner, reason: s.endReason as Reason | 'score' });
          } else this.toPrep();
        }
        break;
      case 'void':
        if (s.phaseT >= MATCH.void) this.toPrep();
        break;
      case 'resume':
        if (s.phaseT >= MATCH.resume) {
          const from = s.pausedFrom;
          s.pausedFrom = '';
          if (s.winner !== -1) {
            this.setPhase('over');
            this.emit({ k: 'over', winner: s.winner, reason: s.endReason as Reason | 'score' });
          } else {
            if (from === 'rally') this.emit({ k: 'void', why: 'reconnect' });
            this.toPrep();
          }
        }
        break;
      default:
        break;
    }
  }

  private toPrep(): void {
    resetPositions(this.state);
    this.syncBall();
    this.setPhase('prep');
  }

  private setPhase(p: Phase): void {
    this.state.phase = p;
    this.state.phaseT = 0;
    this.emit({ k: 'phase', phase: p });
  }

  private holdBallIfNeeded(): void {
    const b = this.state.ball;
    if (b.held) this.phys.set(b.x, b.y, 0, 0);
  }

  private syncBall(): void {
    const b = this.state.ball;
    this.phys.set(b.x, b.y, b.held ? 0 : b.vx, b.held ? 0 : b.vy);
  }

  private emit(e: SimEventBody): void {
    const s = this.state;
    s.evSeq++;
    this.events.push({ ...e, id: s.evSeq, tick: s.tick } as SimEvent);
  }
}
