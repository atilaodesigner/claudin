/**
 * The authoritative room, independent of the transport and the platform.
 *
 * One room = one short code = one 1v1 match (and its rematches). It runs the shared
 * simulation at a fixed 60 Hz (the host calls `tick()`), consumes numbered inputs (bits
 * only), decides contacts, faults, score and result, and sends tick-stamped snapshots
 * (~20 Hz) plus events with ids. Clients may only send: inputs, ready, rematch, ping, leave.
 *
 * Hosts: `packages/server` (Node + Colyseus) and `packages/edge` (Cloudflare Durable
 * Object). Both only translate connections and messages; every rule lives here.
 *
 * Late contact (PLANO.md §7.6): a touch/attack press that arrives up to LATE_TICKS late is
 * applied at the tick it was meant for, re-simulating those few ticks, but only if nothing
 * that clients already saw could change (no contact, crossing, landing, fault or phase
 * change in between). Otherwise it is merged at the current tick, as before.
 */

import { Btn } from './input';
import { MATCH, TICK_HZ } from './params';
import { CODE_ALPHABET, CODE_LENGTH, ERR, INPUT_LIMITS, PROTOCOL_VERSION, SIM_VERSION, SNAPSHOT_EVERY, sanitizeName, type InputMsg, type JoinOptions, type LobbyMsg } from './protocol';
import { Match, teamOf, type MatchState, type SimEvent } from './sim';

// Available in Node ≥ 17, browsers and workerd.
declare function structuredClone<T>(value: T): T;

const ACTION_BITS = Btn.Jump | Btn.Touch | Btn.Attack;
/** How late (ticks) a press may be and still land on its own tick. */
export const LATE_TICKS = 8;
/** Events that, once broadcast, forbid rewriting the ticks around them. */
const VISIBLE = new Set<SimEvent['k']>(['contact', 'cross', 'ground', 'out', 'fault', 'point', 'void', 'phase', 'over', 'autoServe', 'net']);

export interface Conn {
  id: string;
  send(type: string, msg: unknown): void;
  close(code: number, reason?: string): void;
}

interface Seat {
  slot: number;
  conn: Conn | null;
  /** Connection id at the time of a drop (hosts reconnect by it). */
  lostId: string;
  name: string;
  ready: boolean;
  rematch: boolean;
  connected: boolean;
  queue: Map<number, [number, number]>;
  lastSeqSeen: number;
  ackSeq: number;
  lastButtons: number;
  tokens: number;
  violations: number[];
  drops: number;
  awayTicks: number;
  awaySince: number;
  stats: { late: number; lateDropped: number; frames: number; rewinds: number };
}

interface HistoryEntry {
  tick: number;
  before: MatchState;
  buttons: number[];
  events: SimEvent[];
}

export interface RoomStats {
  code: string;
  ticks: number;
  seats: Array<Seat['stats'] & { slot: number }>;
}

export function randomCode(rand: () => number): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return code;
}

export function checkJoin(options: Partial<JoinOptions> | undefined): { code: number; reason: string } | null {
  if (options?.pv !== PROTOCOL_VERSION || options?.sv !== SIM_VERSION) return { code: ERR.VERSION, reason: 'version mismatch' };
  return null;
}

export class RoomCore {
  readonly seats: Array<Seat | null> = [null, null];
  private stage: LobbyMsg['stage'] = 'lobby';
  private match: Match | null = null;
  private tickN = 0;
  private history: HistoryEntry[] = [];
  private log: { seed: number; startTick: number; inputs: Array<[number, number, number]> } | null = null;
  /** Called when a match ends, with its input log (hosts may persist it). */
  onMatchLog: ((log: { code: string; sim: string; seed: number; startTick: number; inputs: Array<[number, number, number]>; score: [number, number]; winner: number }) => void) | null = null;

  constructor(
    readonly code: string,
    private readonly rand: () => number,
  ) {}

  get tick(): number {
    return this.tickN;
  }

  get isFull(): boolean {
    return this.seats.every((s) => s !== null);
  }

  get isEmpty(): boolean {
    return this.seats.every((s) => s === null);
  }

  hasSeat(connId: string): boolean {
    return this.seatOf(connId) !== null;
  }

  stats(): RoomStats {
    return {
      code: this.code,
      ticks: this.tickN,
      seats: this.seats.filter((s): s is Seat => s !== null).map((s) => ({ slot: s.slot, ...s.stats })),
    };
  }

  dispose(): void {
    this.match?.dispose();
    this.match = null;
  }

  // ── connections ────────────────────────────────────────────────────────────

  /** Returns the slot, or an error for the host to reject the connection with. */
  join(conn: Conn, options: Partial<JoinOptions> | undefined): number | { code: number; reason: string } {
    const bad = checkJoin(options);
    if (bad) return bad;
    const slot = this.seats.findIndex((s) => s === null);
    if (slot < 0) return { code: ERR.FULL, reason: 'room full' };
    this.seats[slot] = {
      slot,
      conn,
      lostId: '',
      name: sanitizeName(options?.name),
      ready: false,
      rematch: false,
      connected: true,
      queue: new Map(),
      lastSeqSeen: -1,
      ackSeq: -1,
      lastButtons: 0,
      tokens: INPUT_LIMITS.burst,
      violations: [],
      drops: 0,
      awayTicks: 0,
      awaySince: 0,
      stats: { late: 0, lateDropped: 0, frames: 0, rewinds: 0 },
    };
    this.sendLobby();
    if (this.match) this.sendSnapshots();
    return slot;
  }

  /** Unexpected disconnect: keep the seat for MATCH.reconnectSeconds. */
  drop(connId: string): void {
    const seat = this.seatOf(connId);
    if (!seat) return;
    seat.connected = false;
    seat.lostId = connId;
    seat.conn = null;
    seat.awaySince = this.tickN;
    seat.drops++;
    if (this.stage === 'match' && this.match) {
      if (seat.drops > MATCH.maxDrops) this.broadcastEvents(this.match.forfeit(teamOf(seat.slot)));
      else this.broadcastEvents(this.match.pause());
    }
    this.sendLobby();
  }

  /** The dropped seat `oldId` comes back on a new connection. */
  reconnect(oldId: string, conn: Conn): number | null {
    const seat = this.seatOf(oldId) ?? this.seatOf(conn.id);
    if (!seat) return null;
    seat.connected = true;
    seat.conn = conn;
    seat.queue.clear();
    seat.lastSeqSeen = -1;
    if (this.match && this.stage === 'match' && this.seats.every((s) => s === null || s.connected)) this.broadcastEvents(this.match.resume());
    this.sendLobby();
    this.sendSnapshots();
    return seat.slot;
  }

  /** Consented leave, or the reconnection window ran out. */
  leave(connId: string): void {
    const seat = this.seatOf(connId);
    if (seat) this.removeSeat(seat);
  }

  private removeSeat(seat: Seat): void {
    this.seats[seat.slot] = null;
    if (this.stage === 'match' && this.match && this.match.state.phase !== 'over') {
      this.broadcastEvents(this.match.forfeit(teamOf(seat.slot)));
      this.finishMatch();
    }
    if (this.stage === 'result' || this.stage === 'match') this.backToLobby();
    this.sendLobby();
  }

  message(connId: string, type: string, data: unknown): void {
    const seat = this.seatOf(connId);
    if (!seat || !seat.connected) return;
    switch (type) {
      case 'in':
        this.onInput(seat, data as InputMsg);
        break;
      case 'ready':
        this.onReady(seat, data === true);
        break;
      case 'rematch':
        this.onRematch(seat);
        break;
      case 'ping': {
        const c = (data as { c?: unknown } | null)?.c;
        seat.conn?.send('pong', { c: typeof c === 'number' ? c : 0, t: this.tickN });
        break;
      }
      default:
        this.violation(seat);
    }
  }

  private seatOf(connId: string): Seat | null {
    return this.seats.find((s) => s !== null && (s.conn ? s.conn.id === connId : s.lostId === connId)) ?? null;
  }

  // ── messages ───────────────────────────────────────────────────────────────

  private violation(seat: Seat): void {
    const now = this.tickN;
    seat.violations = seat.violations.filter((t) => now - t < 60 * TICK_HZ);
    seat.violations.push(now);
    if (seat.violations.length > INPUT_LIMITS.maxViolations) seat.conn?.close(ERR.KICKED, 'too many invalid messages');
  }

  private onInput(seat: Seat, msg: InputMsg): void {
    const frames = msg?.f;
    if (!Array.isArray(frames) || frames.length === 0 || frames.length > INPUT_LIMITS.maxFramesPerMessage) {
      this.violation(seat);
      return;
    }
    for (const fr of frames) {
      if (!Array.isArray(fr) || fr.length !== 3) {
        this.violation(seat);
        return;
      }
      const [seq, tick, buttons] = fr as unknown[];
      if (!Number.isInteger(seq) || !Number.isInteger(tick) || typeof buttons !== 'number' || !Number.isInteger(buttons) || buttons < 0 || buttons > 31) {
        this.violation(seat);
        return;
      }
      const s = seq as number;
      const t = tick as number;
      if (s <= seat.lastSeqSeen) continue; // redundant copy of a frame we already have
      if (t > this.tickN + INPUT_LIMITS.futureTicks) {
        this.violation(seat);
        continue;
      }
      seat.lastSeqSeen = s;
      if (t <= this.tickN) {
        // already simulated: try to land a late press on its own tick
        if (t >= this.tickN - LATE_TICKS && this.rewindPress(seat, t, buttons)) {
          seat.ackSeq = Math.max(seat.ackSeq, s);
          continue;
        }
        if (t < this.tickN - INPUT_LIMITS.pastTicks) {
          seat.stats.lateDropped++;
          seat.ackSeq = Math.max(seat.ackSeq, s);
          continue;
        }
      }
      if (seat.tokens < 1) {
        this.violation(seat);
        continue;
      }
      seat.tokens -= 1;
      seat.stats.frames++;
      seat.queue.set(t, [s, buttons]);
    }
  }

  /**
   * Re-simulates from tick `t` with this seat's late press applied there. Only when the
   * press is new (a touch/attack edge), the rally was on and nothing visible happened
   * since `t` (so no client saw something that would now change).
   */
  private rewindPress(seat: Seat, t: number, buttons: number): boolean {
    const m = this.match;
    if (!m || this.stage !== 'match') return false;
    const i = this.history.findIndex((h) => h.tick === t);
    if (i < 0) return false;
    const first = this.history[i]!;
    const applied = first.buttons[seat.slot] ?? 0;
    const prev = first.before.players[seat.slot]?.prev ?? 0;
    const newPress = buttons & (Btn.Touch | Btn.Attack) & ~prev & ~applied;
    if (!newPress) return false;
    if (first.before.phase !== 'rally') return false;
    for (let k = i; k < this.history.length; k++) if (this.history[k]!.events.some((e) => VISIBLE.has(e.k))) return false;

    const evSeq = m.state.evSeq;
    m.restore(first.before);
    m.state.evSeq = evSeq; // ids keep growing: clients never see an id twice
    const fresh: SimEvent[] = [];
    for (let k = i; k < this.history.length; k++) {
      const h = this.history[k]!;
      const b = [...h.buttons];
      if (k === i) b[seat.slot] = buttons; // what the client meant for this tick
      h.before = m.snapshot();
      h.buttons = b;
      h.events = m.step(b);
      fresh.push(...h.events.filter((e) => e.k !== 'jump'));
    }
    seat.lastButtons = this.history[this.history.length - 1]!.buttons[seat.slot] ?? seat.lastButtons;
    seat.stats.rewinds++;
    if (this.log) for (const h of this.history.slice(i)) this.log.inputs.push([h.tick, h.buttons[0]!, h.buttons[1]!]);
    this.broadcastEvents(fresh);
    return true;
  }

  private onReady(seat: Seat, ready: boolean): void {
    if (this.stage !== 'lobby') return;
    seat.ready = ready;
    this.sendLobby();
    if (this.seats.every((s) => s !== null && s.ready && s.connected)) this.startMatch();
  }

  private onRematch(seat: Seat): void {
    if (this.stage !== 'result') return;
    seat.rematch = true;
    this.sendLobby();
    if (this.seats.every((s) => s !== null && s.rematch && s.connected)) this.startMatch();
  }

  // ── match lifecycle ────────────────────────────────────────────────────────

  private startMatch(): void {
    // event ids keep growing across rematches so clients never mistake a new event for a seen one
    const evBase = this.match?.state.evSeq ?? 0;
    this.match?.dispose();
    const seed = 1 + Math.floor(this.rand() * (2 ** 31 - 2));
    this.match = new Match({ players: 2, seed });
    this.match.state.tick = this.tickN;
    this.match.state.evSeq = evBase;
    this.history = [];
    this.log = { seed, startTick: this.tickN, inputs: [] };
    for (const s of this.seats) {
      if (!s) continue;
      Object.assign(s, { ready: false, rematch: false, drops: 0, awayTicks: 0, lastButtons: 0 });
      s.queue.clear();
    }
    this.stage = 'match';
    this.broadcastEvents(this.match.start());
    this.sendLobby();
    this.sendSnapshots();
  }

  private finishMatch(): void {
    if (this.stage !== 'match') return;
    this.stage = 'result';
    if (this.log && this.match && this.onMatchLog) {
      const s = this.match.state;
      this.onMatchLog({ code: this.code, sim: SIM_VERSION, ...this.log, score: [s.score[0], s.score[1]], winner: s.winner });
    }
    this.sendLobby();
    this.sendSnapshots();
  }

  private backToLobby(): void {
    this.stage = 'lobby';
    this.match?.dispose();
    this.match = null;
    this.history = [];
    for (const s of this.seats) if (s) Object.assign(s, { ready: false, rematch: false });
  }

  // ── fixed tick ─────────────────────────────────────────────────────────────

  /** Advances one 60 Hz tick. The host calls it at a fixed rate. */
  tickOnce(): void {
    this.tickN++;
    for (const s of this.seats) {
      if (!s) continue;
      s.tokens = Math.min(INPUT_LIMITS.burst, s.tokens + INPUT_LIMITS.ratePerSecond / TICK_HZ);
      if (!s.connected && this.tickN - s.awaySince > MATCH.reconnectSeconds * TICK_HZ) this.removeSeat(s); // window over
    }
    const m = this.match;
    if (!m || this.stage !== 'match') return;

    const buttons = [0, 0];
    for (const s of this.seats) {
      if (!s) continue;
      if (!s.connected) {
        s.awayTicks++;
        if (s.awayTicks > MATCH.maxPauseTicks && m.state.phase !== 'over') this.broadcastEvents(m.forfeit(teamOf(s.slot)));
      }
      buttons[s.slot] = this.inputFor(s);
    }
    if (this.log) this.log.inputs.push([this.tickN, buttons[0]!, buttons[1]!]);
    const before = m.snapshot();
    const ev = m.step(buttons);
    if (m.state.tick !== this.tickN) m.state.tick = this.tickN;
    this.history.push({ tick: this.tickN, before, buttons, events: ev });
    if (this.history.length > LATE_TICKS + 1) this.history.shift();
    this.broadcastEvents(ev);
    if (m.state.phase === 'over') this.finishMatch();
    if (this.tickN % SNAPSHOT_EVERY === 0) this.sendSnapshots();
  }

  /**
   * Buttons for this tick. Late frames (for ticks already simulated) still count: their
   * movement applies now and their presses are merged in, so a late tap isn't lost.
   */
  private inputFor(s: Seat): number {
    let late = -1;
    let lateActions = 0;
    let lateSeq = -1;
    for (const [t, [seq, b]] of s.queue) {
      if (t < this.tickN) {
        if (seq > lateSeq) {
          lateSeq = seq;
          late = b;
        }
        lateActions |= b & ACTION_BITS;
        s.queue.delete(t);
        s.stats.late++;
      }
    }
    const now = s.queue.get(this.tickN);
    let b: number;
    if (now) {
      s.queue.delete(this.tickN);
      b = now[1] | lateActions;
      s.ackSeq = Math.max(s.ackSeq, now[0], lateSeq);
    } else if (late >= 0) {
      b = late | lateActions;
      s.ackSeq = Math.max(s.ackSeq, lateSeq);
    } else b = s.lastButtons; // nothing arrived: hold (a held button makes no new press)
    s.lastButtons = b;
    return b;
  }

  // ── outgoing ───────────────────────────────────────────────────────────────

  private broadcastEvents(ev: SimEvent[]): void {
    if (ev.length === 0) return;
    for (const s of this.seats) s?.conn?.send('ev', { e: ev });
  }

  private sendSnapshots(): void {
    if (!this.match) return;
    for (const s of this.seats) s?.conn?.send('snap', { s: this.match.state, ack: s.ackSeq });
  }

  private sendLobby(): void {
    for (const s of this.seats) {
      if (!s?.conn) continue;
      const msg: LobbyMsg = {
        code: this.code,
        you: s.slot,
        stage: this.stage,
        seats: this.seats.filter((x): x is Seat => x !== null).map((x) => ({ slot: x.slot, name: x.name, ready: x.ready, connected: x.connected, rematch: x.rematch })),
        away: this.seats.map((x) => (x && !x.connected ? Math.max(0, MATCH.reconnectSeconds - Math.floor((this.tickN - x.awaySince) / TICK_HZ)) : -1)),
      };
      s.conn.send('lobby', msg);
    }
  }
}
