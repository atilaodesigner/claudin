/**
 * Online match client (PLANO.md §7).
 *
 * - Clock: ping/pong → median offset to the server tick, RTT and jitter.
 * - The client simulates ahead of the server by ~RTT/2 + margin ("lead"), so its inputs
 *   arrive just in time for their tick.
 * - Own avatar: predicted with the shared simulation and reconciled on every snapshot
 *   (restore + replay of unacknowledged inputs), corrections smoothed.
 * - Opponent: interpolated between snapshots, ~2 snapshots in the past.
 * - Ball, two timelines: near you it is shown in YOUR predicted present (where it will be
 *   when your input lands); near the opponent, in the interpolated past, lined up with
 *   the foot that will touch it. The display time blends as it crosses the net.
 * - Own contacts are predicted (animation, sound, trajectory) and confirmed by the
 *   server event; unconfirmed ones are counted as rejected (debug panel).
 */

import {
  Bot,
  Match,
  SNAPSHOT_EVERY,
  TICK_HZ,
  type LobbyMsg,
  type MatchState,
  type SimEvent,
  type SnapMsg,
} from '@ginga/shared';
import { session } from '../app/storage';
import { createRoom, joinRoom, resumeRoom, type NetRoom } from '../net/NetRoom';
import type { Controls } from '../input/Controls';
import { toWorld } from '../input/Controls';
import { viewFromState, type Game, type View } from './types';

const TICK_MS = 1000 / TICK_HZ;

export interface NetHandlers {
  onLobby(m: LobbyMsg): void;
  onDrop(): void;
  onReconnect(): void;
  onLeave(code: number, reason?: string): void;
}

export interface NetStats {
  rtt: number;
  jitter: number;
  lead: number;
  interp: number;
  corrections: number;
  bigCorrections: number;
  predicted: number;
  confirmed: number;
  rejected: number;
  snapsPerSec: number;
  lastCorrection: number;
  /** Ball corrections (m) measured while the ball was on the local side (for p95). */
  ballCorrections: number[];
  /** Own touches first seen while replaying after a snapshot (the ball arrived fast). */
  lateFound: number;
  ballP95: number;
}

const median = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};
const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class NetGame implements Game {
  readonly mode = 'online' as const;
  lobby: LobbyMsg | null = null;
  readonly stats: NetStats = { rtt: 0, jitter: 0, lead: 0, interp: 0, corrections: 0, bigCorrections: 0, predicted: 0, confirmed: 0, rejected: 0, snapsPerSec: 0, lastCorrection: 0, ballCorrections: [], ballP95: 0, lateFound: 0 };

  private predicted: Match | null = null;
  private snaps: MatchState[] = [];
  private latest: MatchState | null = null;
  private localTick = 0;
  private seq = 0;
  private readonly inputs = new Map<number, { seq: number; b: number }>();
  private readonly sent: Array<[number, number, number]> = [];
  private offsets: number[] = [];
  private rtts: number[] = [];
  private pingTimer = 0;
  private readonly seen = new Set<number>();
  private readonly seenOrder: number[] = [];
  private events: SimEvent[] = [];
  private readonly predictedContacts = new Map<number, number>(); // tick → local time
  private readonly confirmedTicks = new Set<number>();
  private ownPrev = { x: 0, y: 0 };
  private ownCur = { x: 0, y: 0 };
  private ballPrev = { x: 0, y: 0 };
  private ballCur = { x: 0, y: 0 };
  private ownOffset = { x: 0, y: 0 };
  private ballOffset = { x: 0, y: 0 };
  private snapTimes: number[] = [];
  private disposed = false;
  private frameMs = 16;
  /** Lab mode (?autobot=level): a bot plays through the exact same input path. */
  private autobot: Bot | null = null;

  private constructor(private readonly room: NetRoom, private readonly controls: Controls, handlers: NetHandlers) {
    session('reconnect', room.reconnectionToken);
    room.onMessage('lobby', (m: LobbyMsg) => {
      this.lobby = m;
      if (m.stage === 'lobby') this.resetMatch();
      const lvl = new URLSearchParams(location.search).get('autobot');
      if (lvl && !this.autobot) this.autobot = new Bot(m.you, (['easy', 'medium', 'hard'].includes(lvl) ? lvl : 'medium') as 'medium', m.you + 1);
      (window as unknown as { __ginga?: NetStats }).__ginga = this.stats;
      handlers.onLobby(m);
    });
    room.onMessage('snap', (m: SnapMsg) => this.onSnap(m));
    room.onMessage('ev', (m: { e: SimEvent[] }) => this.onServerEvents(m.e));
    room.onMessage('pong', (m: { c: number; t: number }) => this.onPong(m));
    room.onDrop(() => handlers.onDrop());
    room.onReconnect(() => {
      session('reconnect', room.reconnectionToken);
      this.inputs.clear();
      this.sent.length = 0;
      handlers.onReconnect();
    });
    room.onLeave((code, reason) => {
      session('reconnect', null);
      if (!this.disposed) handlers.onLeave(code, reason);
    });
    for (let i = 0; i < 5; i++) setTimeout(() => this.ping(), i * 120);
    this.pingTimer = window.setInterval(() => this.ping(), 1000);
  }

  static async create(name: string, controls: Controls, h: NetHandlers): Promise<NetGame> {
    return new NetGame(await createRoom(name), controls, h);
  }

  static async join(code: string, name: string, controls: Controls, h: NetHandlers): Promise<NetGame> {
    return new NetGame(await joinRoom(code.toUpperCase(), name), controls, h);
  }

  /** After a page reload inside the 15 s window. */
  static async resume(controls: Controls, h: NetHandlers): Promise<NetGame | null> {
    const token = session('reconnect');
    if (!token) return null;
    try {
      return new NetGame(await resumeRoom(token), controls, h);
    } catch {
      session('reconnect', null);
      return null;
    }
  }

  get code(): string {
    return this.room.roomId;
  }

  setReady(ready: boolean): void {
    this.room.send('ready', ready);
  }

  rematch(): void {
    this.room.send('rematch');
  }

  async leave(): Promise<void> {
    this.disposed = true;
    session('reconnect', null);
    try {
      await this.room.leave();
    } catch {
      /* already gone */
    }
  }

  // ── clock ──────────────────────────────────────────────────────────────────

  private ping(): void {
    if (this.room.isOpen) this.room.send('ping', { c: performance.now() });
  }

  private onPong(m: { c: number; t: number }): void {
    const now = performance.now();
    const rtt = now - m.c;
    this.rtts.push(rtt);
    if (this.rtts.length > 9) this.rtts.shift();
    this.offsets.push(m.t + rtt / 2 / TICK_MS - now / TICK_MS);
    if (this.offsets.length > 9) this.offsets.shift();
    const med = median(this.rtts);
    this.stats.rtt = med;
    this.stats.jitter = this.rtts.reduce((a, r) => a + Math.abs(r - med), 0) / this.rtts.length;
  }

  private serverTickNow(now: number): number {
    return now / TICK_MS + median(this.offsets);
  }

  // ── snapshots ──────────────────────────────────────────────────────────────

  private resetMatch(): void {
    this.predicted?.dispose();
    this.predicted = null;
    this.snaps = [];
    this.latest = null;
    this.localTick = 0;
    this.inputs.clear();
    this.sent.length = 0;
  }

  private get mySlot(): number {
    return this.lobby?.you ?? -1;
  }

  private buttonsFor(t: number, s: MatchState): number[] {
    return s.players.map((p) => (p.slot === this.mySlot ? (this.inputs.get(t)?.b ?? 0) : p.prev));
  }

  private onSnap(m: SnapMsg): void {
    const s = m.s;
    const now = performance.now();
    this.snapTimes.push(now);
    while (this.snapTimes.length && now - this.snapTimes[0]! > 1000) this.snapTimes.shift();
    this.stats.snapsPerSec = this.snapTimes.length;
    this.snaps.push(s);
    if (this.snaps.length > 40) this.snaps.shift();
    this.latest = s;
    for (const [t, v] of this.inputs) if (v.seq <= m.ack) this.inputs.delete(t);

    if (!this.predicted) {
      this.predicted = new Match({ players: 2, seed: 0 }, s);
      this.localTick = s.tick;
      return;
    }
    if (s.tick >= this.localTick) {
      // we fell behind the server: jump
      this.predicted.restore(s);
      this.localTick = s.tick;
      return;
    }
    // reconcile: restore authority, replay our unacknowledged inputs up to the present
    const me = this.mySlot;
    const before = this.predicted.state;
    const oldOwn = before.players[me] ? { x: before.players[me]!.x, y: before.players[me]!.y } : null;
    const oldBall = { x: before.ball.x, y: before.ball.y };
    this.predicted.restore(s);
    for (let t = s.tick + 1; t <= this.localTick; t++) {
      for (const e of this.predicted.step(this.buttonsFor(t, this.predicted.state))) {
        // a touch that only shows up now (the ball's new path reached us within the
        // replayed ticks): it is still a prediction, show it now and track it
        if (e.k !== 'contact' || e.slot !== me || this.confirmedTicks.has(e.tick)) continue;
        let known = false;
        for (const k of this.predictedContacts.keys()) if (Math.abs(k - e.tick) <= 2) known = true;
        if (known) continue;
        this.predictedContacts.set(e.tick, performance.now());
        this.stats.predicted++;
        this.stats.lateFound++;
        this.events.push(e);
      }
    }
    const after = this.predicted.state;
    if (oldOwn && after.players[me]) {
      const dx = oldOwn.x - after.players[me]!.x;
      const dy = oldOwn.y - after.players[me]!.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.05) this.stats.corrections++;
      this.stats.lastCorrection = d;
      if (d > 1.5) {
        this.stats.bigCorrections++;
        this.ownOffset = { x: 0, y: 0 };
      } else {
        this.ownOffset.x += dx;
        this.ownOffset.y += dy;
      }
    }
    const bdx = oldBall.x - after.ball.x;
    const bdy = oldBall.y - after.ball.y;
    const myTeam = after.players[me]?.team ?? 0;
    if (after.phase === 'rally' && after.ball.x * (myTeam === 0 ? -1 : 1) > 0) {
      const bc = this.stats.ballCorrections;
      bc.push(Math.hypot(bdx, bdy));
      if (bc.length > 2000) bc.shift();
      const sorted = [...bc].sort((x, y) => x - y);
      this.stats.ballP95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    }
    if (Math.hypot(bdx, bdy) > 1.5) this.ballOffset = { x: 0, y: 0 };
    else {
      this.ballOffset.x += bdx;
      this.ballOffset.y += bdy;
    }
    this.ownCur = this.ownPos();
    this.ballCur = { x: after.ball.x, y: after.ball.y };
  }

  private onServerEvents(list: SimEvent[]): void {
    for (const e of list) {
      if (this.seen.has(e.id)) continue;
      this.seen.add(e.id);
      this.seenOrder.push(e.id);
      if (this.seenOrder.length > 256) this.seen.delete(this.seenOrder.shift()!);
      if (e.k === 'phase' && (e.phase === 'countdown' || e.phase === 'idle')) this.predictedContacts.clear();
      if (e.k === 'contact' && e.slot === this.mySlot) {
        // already shown when we predicted it?
        let matched = -1;
        for (const t of this.predictedContacts.keys()) if (Math.abs(t - e.tick) <= 8) matched = t;
        if (matched >= 0) {
          this.predictedContacts.delete(matched);
          this.confirmedTicks.add(e.tick);
          if (this.confirmedTicks.size > 64) this.confirmedTicks.delete(this.confirmedTicks.values().next().value!);
          this.stats.confirmed++;
          continue;
        }
      }
      this.events.push(e);
    }
  }

  // ── frame ──────────────────────────────────────────────────────────────────

  private ownPos(): { x: number; y: number } {
    const p = this.predicted?.state.players[this.mySlot];
    return p ? { x: p.x, y: p.y } : { x: 0, y: 0 };
  }

  private sendInputs(count: number): void {
    if (!this.room.isOpen) return;
    this.room.send('in', { f: this.sent.slice(-count) });
  }

  frame(now: number, dt: number): View | null {
    const s0 = this.latest;
    const m = this.predicted;
    if (!s0 || !m || !this.lobby) return null;
    const me = this.mySlot;
    const flip = s0.players[me]?.team === 1;

    // how far ahead of the server we simulate
    // Inputs leave once per rendered frame, so a slow frame delays them: the lead covers
    // RTT/2, jitter, one frame and the server's catch-up bursts.
    this.frameMs += (Math.min(250, dt * 1000) - this.frameMs) * 0.1;
    const leadMs = this.stats.rtt / 2 + 2 * this.stats.jitter + this.frameMs + 20;
    const lead = Math.min(30, Math.max(3, Math.ceil(leadMs / TICK_MS) + 1));
    this.stats.lead = lead;
    const ideal = this.serverTickNow(now) + lead;
    const target = Math.floor(ideal);
    let steps = target - this.localTick;
    if (steps > 30) {
      // a long hitch (hidden tab, freeze): jump to the authoritative present without inputs
      m.restore(this.snaps[this.snaps.length - 1]!);
      this.localTick = m.state.tick;
      const n = Math.min(40, target - this.localTick);
      for (let i = 0; i < n; i++) {
        this.localTick++;
        m.step(this.buttonsFor(this.localTick, m.state));
      }
      steps = 0;
    }
    // slow frames just run several ticks: every tick still reads input
    for (let i = 0; i < steps; i++) {
      const t = this.localTick + 1;
      const b = this.autobot ? this.autobot.think(m.state) : toWorld(this.controls.sample(), flip);
      this.seq++;
      this.inputs.set(t, { seq: this.seq, b });
      this.sent.push([this.seq, t, b]);
      if (this.sent.length > 8) this.sent.shift();
      this.ownPrev = this.ownPos();
      this.ballPrev = { x: m.state.ball.x, y: m.state.ball.y };
      for (const e of m.step(this.buttonsFor(t, m.state))) {
        if (e.k === 'contact' && e.slot === me) {
          this.predictedContacts.set(t, now);
          this.stats.predicted++;
          this.events.push(e);
        }
        if (e.k === 'jump' && e.slot === me) this.events.push(e);
      }
      this.localTick = t;
      this.ownCur = this.ownPos();
      this.ballCur = { x: m.state.ball.x, y: m.state.ball.y };
    }
    // one message per frame: the new frames plus a couple of repeats (redundancy)
    if (steps > 0) this.sendInputs(Math.min(8, steps + 2));
    for (const [t, at] of this.predictedContacts) {
      if (now - at > Math.max(600, this.stats.rtt * 3)) {
        this.predictedContacts.delete(t);
        this.stats.rejected++;
      }
    }
    const alpha = Math.max(0, Math.min(1, ideal - target));

    // opponent + past ball: interpolate snapshots around renderTick
    const interp = SNAPSHOT_EVERY * 2 + Math.ceil((2 * this.stats.jitter) / TICK_MS);
    this.stats.interp = interp;
    const renderTick = this.serverTickNow(now) - interp;
    let a = this.snaps[0]!;
    let b = this.snaps[this.snaps.length - 1]!;
    for (let i = this.snaps.length - 1; i > 0; i--) {
      if (this.snaps[i - 1]!.tick <= renderTick) {
        a = this.snaps[i - 1]!;
        b = this.snaps[i]!;
        break;
      }
    }
    const span = Math.max(1, b.tick - a.tick);
    const k = Math.max(0, Math.min(1.25, (renderTick - a.tick) / span)); // ≤ 25 % extrapolation
    const L = (x: number, y: number) => x + (y - x) * k;

    const names = s0.players.map((p) => this.lobby!.seats.find((x) => x.slot === p.slot)?.name ?? `Jogador ${p.slot + 1}`);
    const view = viewFromState(s0, names, me, [false, false]);
    const decay = Math.exp(-dt / 0.1);
    this.ownOffset.x *= decay;
    this.ownOffset.y *= decay;
    this.ballOffset.x *= decay;
    this.ballOffset.y *= decay;

    view.players = view.players.map((p) => {
      if (p.slot === me) {
        const q = m.state.players[me]!;
        return {
          ...p,
          x: this.ownPrev.x + (this.ownCur.x - this.ownPrev.x) * alpha + this.ownOffset.x,
          y: Math.max(0, this.ownPrev.y + (this.ownCur.y - this.ownPrev.y) * alpha + this.ownOffset.y),
          vx: q.vx,
          grounded: q.grounded,
          act: q.act ? { ...q.act } : null,
          lastPart: q.lastPart,
          lastTick: q.lastTick - (this.localTick - s0.tick),
        };
      }
      const pa = a.players[p.slot]!;
      const pb = b.players[p.slot]!;
      return { ...p, x: L(pa.x, pb.x), y: L(pa.y, pb.y), vx: pb.vx, grounded: pb.grounded, act: pb.act ? { ...pb.act } : null, lastPart: pb.lastPart, lastTick: pb.lastTick };
    });

    const pastBall = { x: L(a.ball.x, b.ball.x), y: L(a.ball.y, b.ball.y) };
    const inRally = s0.phase === 'rally' || s0.phase === 'pending';
    if (inRally && !m.state.ball.held) {
      const pred = {
        x: this.ballPrev.x + (this.ballCur.x - this.ballPrev.x) * alpha + this.ballOffset.x,
        y: this.ballPrev.y + (this.ballCur.y - this.ballPrev.y) * alpha + this.ballOffset.y,
      };
      const myTeam = s0.players[me]?.team ?? 0;
      const dLocal = pred.x * (myTeam === 0 ? -1 : 1); // > 0 on my side
      const w = smoothstep(-3, 0.5, dLocal);
      view.ball = { ...m.state.ball, x: pastBall.x + (pred.x - pastBall.x) * w, y: pastBall.y + (pred.y - pastBall.y) * w };
    } else {
      view.ball = { ...b.ball, x: pastBall.x, y: pastBall.y };
    }
    view.flip = flip;
    return view;
  }

  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  dispose(): void {
    this.disposed = true;
    clearInterval(this.pingTimer);
    this.predicted?.dispose();
    this.predicted = null;
  }
}
