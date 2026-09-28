/**
 * One room = one short code = one 1v1 match (and its rematches).
 *
 * The server is the only authority: it runs the shared simulation at a fixed 60 Hz,
 * consumes numbered inputs (bits only), decides contacts, faults, score and result,
 * and sends tick-stamped snapshots (~20 Hz) plus events with ids.
 *
 * Clients only send: inputs, ready, rematch, ping. Nothing else is accepted.
 */

import { randomInt } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Client, Room, ServerError, matchMaker } from 'colyseus';
import {
  Btn,
  CODE_ALPHABET,
  CODE_LENGTH,
  ERR,
  INPUT_LIMITS,
  MATCH,
  Match,
  PROTOCOL_VERSION,
  SIM_VERSION,
  SNAPSHOT_EVERY,
  TICK_HZ,
  initPhysics,
  isValidButtons,
  sanitizeName,
  teamOf,
  type InputMsg,
  type JoinOptions,
  type LobbyMsg,
  type SimEvent,
} from '@ginga/shared';

const ACTION_BITS = Btn.Jump | Btn.Touch | Btn.Attack;

interface Seat {
  slot: number;
  sessionId: string;
  client: Client | null;
  name: string;
  ready: boolean;
  rematch: boolean;
  connected: boolean;
  /** Inputs waiting for their tick: tick → [seq, buttons]. */
  queue: Map<number, [number, number]>;
  lastSeqSeen: number;
  ackSeq: number;
  lastButtons: number;
  tokens: number;
  violations: number[];
  drops: number;
  awayTicks: number;
  awaySince: number;
  stats: { late: number; lateDropped: number; frames: number };
}

export interface RoomStats {
  code: string;
  ticks: number;
  seats: Array<Seat['stats'] & { slot: number }>;
}

async function freshCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    const taken = await matchMaker.query({ roomId: code });
    if (taken.length === 0) return code;
  }
  throw new Error('no free room code');
}

export class MatchRoom extends Room {
  override maxClients = 2;
  private readonly seats: Array<Seat | null> = [null, null];
  private stage: LobbyMsg['stage'] = 'lobby';
  private match: Match | null = null;
  /** Network tick: always runs, the match's tick follows it. */
  private tick = 0;
  private log: { seed: number; startTick: number; inputs: Array<[number, number, number]> } | null = null;

  override async onCreate(): Promise<void> {
    await initPhysics();
    this.roomId = await freshCode();
    this.onMessage('in', (client, msg: InputMsg) => this.onInput(client, msg));
    this.onMessage('ready', (client, ready: unknown) => this.onReady(client, ready === true));
    this.onMessage('rematch', (client) => this.onRematch(client));
    this.onMessage('ping', (client, msg: { c?: unknown }) => {
      client.send('pong', { c: typeof msg?.c === 'number' ? msg.c : 0, t: this.tick });
    });
    this.onMessage('*', (client) => this.violation(this.seatOf(client)));
    this.setFixedTimestep(() => this.update(), TICK_HZ);
    // No schema state: snapshots are messages. Must come after setFixedTimestep, otherwise
    // Colyseus starts a second clock ticker that starves the fixed-step accumulator.
    this.patchRate = null;
  }

  override onAuth(_client: Client, options: Partial<JoinOptions>): boolean {
    if (options?.pv !== PROTOCOL_VERSION || options?.sv !== SIM_VERSION) throw new ServerError(ERR.VERSION, 'version mismatch');
    return true;
  }

  override onJoin(client: Client, options: Partial<JoinOptions>): void {
    const slot = this.seats.findIndex((s) => s === null);
    if (slot < 0) throw new ServerError(ERR.FULL, 'room full');
    this.seats[slot] = {
      slot,
      sessionId: client.sessionId,
      client,
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
      stats: { late: 0, lateDropped: 0, frames: 0 },
    };
    this.sendLobby();
    if (this.match) this.sendSnapshots();
  }

  override onDrop(client: Client): void {
    const seat = this.seatOf(client);
    if (!seat) return;
    seat.connected = false;
    seat.client = null;
    seat.awaySince = this.tick;
    seat.drops++;
    if (this.stage === 'match' && this.match) {
      if (seat.drops > MATCH.maxDrops) {
        this.broadcastEvents(this.match.forfeit(teamOf(seat.slot)));
      } else this.broadcastEvents(this.match.pause());
    }
    try {
      this.allowReconnection(client, MATCH.reconnectSeconds);
    } catch {
      // room is shutting down: nothing to reconnect to
    }
    this.sendLobby();
  }

  override onReconnect(client: Client): void {
    const seat = this.seatOf(client);
    if (!seat) return;
    seat.connected = true;
    seat.client = client;
    seat.queue.clear();
    seat.lastSeqSeen = -1;
    if (this.match && this.stage === 'match' && this.seats.every((s) => s === null || s.connected)) this.broadcastEvents(this.match.resume());
    this.sendLobby();
    this.sendSnapshots();
  }

  override onLeave(client: Client): void {
    const seat = this.seatOf(client);
    if (!seat) return;
    this.seats[seat.slot] = null;
    if (this.stage === 'match' && this.match && this.match.state.phase !== 'over') {
      this.broadcastEvents(this.match.forfeit(teamOf(seat.slot)));
      this.finishMatch();
    }
    if (this.stage === 'result' || this.stage === 'match') this.backToLobby();
    this.sendLobby();
  }

  override onDispose(): void {
    this.match?.dispose();
    this.match = null;
  }

  /** Test/diagnostics hook. */
  getStats(): RoomStats {
    return {
      code: this.roomId,
      ticks: this.tick,
      seats: this.seats.filter((s): s is Seat => s !== null).map((s) => ({ slot: s.slot, ...s.stats })),
    };
  }

  // ── messages ───────────────────────────────────────────────────────────────

  private seatOf(client: Client): Seat | null {
    return this.seats.find((s) => s?.sessionId === client.sessionId) ?? null;
  }

  private violation(seat: Seat | null): void {
    if (!seat) return;
    const now = Date.now();
    seat.violations = seat.violations.filter((t) => now - t < 60_000);
    seat.violations.push(now);
    if (seat.violations.length > INPUT_LIMITS.maxViolations) seat.client?.leave(ERR.KICKED, 'too many invalid messages');
  }

  private onInput(client: Client, msg: InputMsg): void {
    const seat = this.seatOf(client);
    if (!seat) return;
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
      if (!Number.isInteger(seq) || !Number.isInteger(tick) || !isValidButtons(buttons)) {
        this.violation(seat);
        return;
      }
      const s = seq as number;
      const t = tick as number;
      if (s <= seat.lastSeqSeen) continue; // redundant copy of a frame we already have
      if (t > this.tick + INPUT_LIMITS.futureTicks) {
        this.violation(seat);
        continue;
      }
      seat.lastSeqSeen = s;
      if (t < this.tick - INPUT_LIMITS.pastTicks) {
        seat.stats.lateDropped++;
        seat.ackSeq = Math.max(seat.ackSeq, s);
        continue;
      }
      // token bucket against floods
      if (seat.tokens < 1) {
        this.violation(seat);
        continue;
      }
      seat.tokens -= 1;
      seat.stats.frames++;
      seat.queue.set(t, [s, buttons]);
    }
  }

  private onReady(client: Client, ready: boolean): void {
    const seat = this.seatOf(client);
    if (!seat || this.stage !== 'lobby') return;
    seat.ready = ready;
    this.sendLobby();
    if (this.seats.every((s) => s !== null && s.ready && s.connected)) this.startMatch();
  }

  private onRematch(client: Client): void {
    const seat = this.seatOf(client);
    if (!seat || this.stage !== 'result') return;
    seat.rematch = true;
    this.sendLobby();
    if (this.seats.every((s) => s !== null && s.rematch && s.connected)) this.startMatch();
  }

  // ── match lifecycle ────────────────────────────────────────────────────────

  private startMatch(): void {
    this.match?.dispose();
    const seed = randomInt(1, 2 ** 31 - 1);
    this.match = new Match({ players: 2, seed });
    this.match.state.tick = this.tick;
    this.log = { seed, startTick: this.tick, inputs: [] };
    for (const s of this.seats) {
      if (!s) continue;
      s.ready = false;
      s.rematch = false;
      s.drops = 0;
      s.awayTicks = 0;
      s.lastButtons = 0;
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
    this.writeLog();
    this.sendLobby();
    this.sendSnapshots();
  }

  private backToLobby(): void {
    this.stage = 'lobby';
    this.match?.dispose();
    this.match = null;
    for (const s of this.seats) if (s) Object.assign(s, { ready: false, rematch: false });
  }

  private writeLog(): void {
    const dir = process.env.GINGA_LOG_DIR;
    if (!dir || !this.log || !this.match) return;
    try {
      mkdirSync(dir, { recursive: true });
      const file = join(dir, `${this.roomId}-${this.log.startTick}.json`);
      writeFileSync(file, JSON.stringify({ sim: SIM_VERSION, ...this.log, score: this.match.state.score, winner: this.match.state.winner }));
    } catch (e) {
      console.warn('[ginga] could not write match log', e);
    }
  }

  // ── fixed tick ─────────────────────────────────────────────────────────────

  private update(): void {
    this.tick++;
    for (const s of this.seats) {
      if (!s) continue;
      s.tokens = Math.min(INPUT_LIMITS.burst, s.tokens + INPUT_LIMITS.ratePerSecond / TICK_HZ);
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
    if (this.log) this.log.inputs.push([this.tick, buttons[0]!, buttons[1]!]);
    const ev = m.step(buttons);
    if (m.state.tick !== this.tick) m.state.tick = this.tick;
    this.broadcastEvents(ev);
    if (m.state.phase === 'over') this.finishMatch();
    if (this.tick % SNAPSHOT_EVERY === 0) this.sendSnapshots();
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
      if (t < this.tick) {
        if (seq > lateSeq) {
          lateSeq = seq;
          late = b;
        }
        lateActions |= b & ACTION_BITS;
        s.queue.delete(t);
        s.stats.late++;
      }
    }
    const now = s.queue.get(this.tick);
    let b: number;
    if (now) {
      s.queue.delete(this.tick);
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
    if (ev.length > 0) this.broadcast('ev', { e: ev });
  }

  private sendSnapshots(): void {
    if (!this.match) return;
    for (const s of this.seats) {
      if (!s?.client) continue;
      s.client.send('snap', { s: this.match.state, ack: s.ackSeq });
    }
  }

  private sendLobby(): void {
    for (const s of this.seats) {
      if (!s?.client) continue;
      const msg: LobbyMsg = {
        code: this.roomId,
        you: s.slot,
        stage: this.stage,
        seats: this.seats.filter((x): x is Seat => x !== null).map((x) => ({ slot: x.slot, name: x.name, ready: x.ready, connected: x.connected, rematch: x.rematch })),
        away: this.seats.map((x) => (x && !x.connected ? Math.max(0, MATCH.reconnectSeconds - Math.floor((this.tick - x.awaySince) / TICK_HZ)) : -1)),
      };
      s.client.send('lobby', msg);
    }
  }
}
