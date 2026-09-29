/**
 * Transport to a match room, with two backends behind one interface:
 *
 * - "edge" (production): Cloudflare Worker + Durable Object, JSON over a plain WebSocket
 *   at /api/room/:code on the same origin. Reconnects by token for up to 15 s.
 * - "colyseus" (local dev / Node server): the Colyseus SDK.
 *
 * Choice: ?backend= in the URL, else VITE_BACKEND at build time, else "colyseus" on the
 * Vite dev port and "edge" everywhere else.
 */

import { Client, type Room } from '@colyseus/sdk';
import { ERR, PROTOCOL_VERSION, ROOM_NAME, SIM_VERSION, MATCH } from '@ginga/shared';

export interface NetRoom {
  readonly roomId: string;
  readonly reconnectionToken: string;
  readonly isOpen: boolean;
  send(type: string, msg?: unknown): void;
  onMessage<T = unknown>(type: string, cb: (m: T) => void): void;
  onDrop(cb: () => void): void;
  onReconnect(cb: () => void): void;
  onLeave(cb: (code: number, reason?: string) => void): void;
  leave(): Promise<void>;
}

export class NetError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

type Backend = 'edge' | 'colyseus';

export function backend(): Backend {
  const q = new URLSearchParams(location.search).get('backend');
  if (q === 'edge' || q === 'colyseus') return q;
  const env = import.meta.env.VITE_BACKEND as string | undefined;
  if (env === 'edge' || env === 'colyseus') return env;
  return location.port === '5173' ? 'colyseus' : 'edge';
}

/** Server base: ?server=, else VITE_SERVER_URL, else same origin (edge) / host:2567 (colyseus). */
function serverBase(kind: Backend): string {
  const param = new URLSearchParams(location.search).get('server');
  if (param) return param;
  const env = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? '';
  if (env) return env;
  if (kind === 'edge') return location.origin;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.hostname || 'localhost'}:2567`;
}

// ── Colyseus ────────────────────────────────────────────────────────────────

class ColyseusRoom implements NetRoom {
  constructor(private readonly room: Room) {}
  get roomId(): string {
    return this.room.roomId;
  }
  get reconnectionToken(): string {
    return `colyseus:${this.room.reconnectionToken}`;
  }
  get isOpen(): boolean {
    return this.room.connection.isOpen;
  }
  send(type: string, msg?: unknown): void {
    this.room.send(type, msg);
  }
  onMessage<T>(type: string, cb: (m: T) => void): void {
    this.room.onMessage(type, cb);
  }
  onDrop(cb: () => void): void {
    this.room.onDrop(() => cb());
  }
  onReconnect(cb: () => void): void {
    this.room.onReconnect(() => cb());
  }
  onLeave(cb: (code: number, reason?: string) => void): void {
    this.room.onLeave((code, reason) => cb(code, reason));
  }
  async leave(): Promise<void> {
    await this.room.leave(true);
  }
}

function colyseusError(e: unknown): NetError {
  const code = (e as { code?: number }).code ?? 0;
  const msg = String((e as Error)?.message ?? e);
  if (code === ERR.VERSION) return new NetError(ERR.VERSION, msg);
  if (/full|locked/i.test(msg)) return new NetError(ERR.FULL, msg);
  if (/not found|invalid|room/i.test(msg)) return new NetError(ERR.NOT_FOUND, msg);
  return new NetError(0, msg);
}

// ── Edge (Cloudflare) ───────────────────────────────────────────────────────

class EdgeRoom implements NetRoom {
  roomId: string;
  reconnectionToken = '';
  private ws!: WebSocket;
  private readonly handlers = new Map<string, Array<(m: unknown) => void>>();
  private early: Array<{ t: string; d: unknown }> = [];
  private dropCbs: Array<() => void> = [];
  private reconnectCbs: Array<() => void> = [];
  private leaveCbs: Array<(code: number, reason?: string) => void> = [];
  private left = false;
  private reconnecting = false;

  private constructor(
    private readonly base: string,
    code: string,
  ) {
    this.roomId = code;
  }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  static async open(base: string, code: string, query: string): Promise<EdgeRoom> {
    const r = new EdgeRoom(base, code);
    await r.connect(query);
    return r;
  }

  private url(query: string): string {
    return `${this.base.replace(/^http/, 'ws')}/api/room/${this.roomId}?${query}`;
  }

  /** Resolves on 'hello', rejects on an 'error' message or a close before it. */
  private connect(query: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let hello = false;
      const ws = new WebSocket(this.url(query));
      this.ws = ws;
      ws.onmessage = (e) => {
        let m: { t: string; d: unknown };
        try {
          m = JSON.parse(String(e.data)) as { t: string; d: unknown };
        } catch {
          return;
        }
        if (m.t === 'hello') {
          const d = m.d as { token: string; code: string };
          this.reconnectionToken = `edge:${d.code}:${d.token}`;
          hello = true;
          resolve();
          return;
        }
        if (m.t === 'error') {
          const d = m.d as { code: number; reason: string };
          if (!hello) reject(new NetError(d.code, d.reason));
          return;
        }
        const list = this.handlers.get(m.t);
        if (list?.length) for (const cb of list) cb(m.d);
        else this.early.push(m); // arrived before anyone listened (e.g. 'lobby' right on join)
      };
      ws.onclose = (e) => {
        if (!hello) {
          reject(new NetError(e.code >= 4000 ? e.code : 0, e.reason || 'connection failed'));
          return;
        }
        if (this.left || this.ws !== ws) return;
        if (e.code >= 4000) {
          this.leaveCbs.forEach((cb) => cb(e.code, e.reason));
          return;
        }
        void this.retry();
      };
    });
  }

  /** Unexpected close: try the token for up to the server's reconnection window. */
  private async retry(): Promise<void> {
    if (this.reconnecting) return;
    this.reconnecting = true;
    this.dropCbs.forEach((cb) => cb());
    const token = this.reconnectionToken.split(':')[2] ?? '';
    const deadline = Date.now() + MATCH.reconnectSeconds * 1000;
    while (!this.left && Date.now() < deadline) {
      try {
        await this.connect(`token=${encodeURIComponent(token)}`);
        this.reconnecting = false;
        this.reconnectCbs.forEach((cb) => cb());
        return;
      } catch (e) {
        if (e instanceof NetError && e.code === ERR.NOT_FOUND) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    this.reconnecting = false;
    if (!this.left) this.leaveCbs.forEach((cb) => cb(4003, 'reconnection failed'));
  }

  send(type: string, msg?: unknown): void {
    if (this.isOpen) this.ws.send(JSON.stringify({ t: type, d: msg }));
  }
  onMessage<T>(type: string, cb: (m: T) => void): void {
    const list = this.handlers.get(type) ?? [];
    list.push(cb as (m: unknown) => void);
    this.handlers.set(type, list);
    const keep: Array<{ t: string; d: unknown }> = [];
    for (const m of this.early) {
      if (m.t === type) cb(m.d as T);
      else keep.push(m);
    }
    this.early = keep;
  }
  onDrop(cb: () => void): void {
    this.dropCbs.push(cb);
  }
  onReconnect(cb: () => void): void {
    this.reconnectCbs.push(cb);
  }
  onLeave(cb: (code: number, reason?: string) => void): void {
    this.leaveCbs.push(cb);
  }
  async leave(): Promise<void> {
    this.left = true;
    this.send('leave');
    setTimeout(() => this.ws.close(1000), 200);
  }
}

// ── entry points ────────────────────────────────────────────────────────────

const joinQuery = (name: string) => `name=${encodeURIComponent(name)}&pv=${PROTOCOL_VERSION}&sv=${encodeURIComponent(SIM_VERSION)}`;

export async function createRoom(name: string): Promise<NetRoom> {
  const kind = backend();
  const base = serverBase(kind);
  if (kind === 'colyseus') {
    try {
      return new ColyseusRoom(await new Client(base).create(ROOM_NAME, { name, pv: PROTOCOL_VERSION, sv: SIM_VERSION }));
    } catch (e) {
      throw colyseusError(e);
    }
  }
  const r = await fetch(`${base}/api/new`, { method: 'POST' });
  if (!r.ok) throw new NetError(0, `create failed (${r.status})`);
  const { code } = (await r.json()) as { code: string };
  return EdgeRoom.open(base, code, joinQuery(name));
}

export async function joinRoom(code: string, name: string): Promise<NetRoom> {
  const kind = backend();
  const base = serverBase(kind);
  if (kind === 'colyseus') {
    try {
      return new ColyseusRoom(await new Client(base).joinById(code, { name, pv: PROTOCOL_VERSION, sv: SIM_VERSION }));
    } catch (e) {
      throw colyseusError(e);
    }
  }
  return EdgeRoom.open(base, code, joinQuery(name));
}

/** Token saved by a previous page (reload inside the 15 s window). */
export async function resumeRoom(saved: string): Promise<NetRoom> {
  const [kind, ...rest] = saved.split(':');
  if (kind === 'colyseus') return new ColyseusRoom(await new Client(serverBase('colyseus')).reconnect(rest.join(':')));
  const [code, token] = rest;
  if (!code || !token) throw new NetError(ERR.NOT_FOUND, 'bad token');
  return EdgeRoom.open(serverBase('edge'), code, `token=${encodeURIComponent(token)}`);
}
