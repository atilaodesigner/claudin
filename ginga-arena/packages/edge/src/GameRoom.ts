/**
 * One Durable Object per room code: a persistent, stateful actor that stays alive while
 * players are connected (not an ephemeral HTTP function). It runs RoomCore at 60 Hz and
 * speaks JSON over WebSocket: { t: type, d: data } both ways.
 *
 * Reconnection: each connection gets a token ('hello'); an unexpected close keeps the seat
 * for 15 s (RoomCore) and a new socket with ?token= takes it back.
 */

import { DurableObject } from 'cloudflare:workers';
import { ERR, RoomCore, TICK_HZ, initPhysics, type Conn } from '@ginga/shared';
import type { Env } from './index';

const STEP_MS = 1000 / TICK_HZ;
const MAX_MSG = 8 * 1024;

interface Link {
  ws: WebSocket;
  token: string;
  consented: boolean;
}

export class GameRoom extends DurableObject<Env> {
  private core: RoomCore | null = null;
  private readonly links = new Map<string, Link>(); // conn id → socket
  private readonly tokens = new Map<string, string>(); // token → conn id of the seat
  private loop: ReturnType<typeof setInterval> | null = null;
  private last = 0;
  private acc = 0;
  private emptySince = 0;

  override async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/create') {
      if (this.core) return new Response('taken', { status: 409 });
      await initPhysics();
      const code = url.searchParams.get('code') ?? '????';
      this.core = new RoomCore(code, () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32);
      this.emptySince = Date.now();
      this.startLoop();
      return new Response('ok');
    }
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });

    const pair = new WebSocketPair();
    const [client, ws] = [pair[0], pair[1]];
    ws.accept();
    const fail = (code: number, reason: string): Response => {
      ws.send(JSON.stringify({ t: 'error', d: { code, reason } }));
      ws.close(code, reason);
      return new Response(null, { status: 101, webSocket: client });
    };
    const core = this.core;
    if (!core) return fail(ERR.NOT_FOUND, 'room not found');

    const id = crypto.randomUUID();
    const link: Link = { ws, token: crypto.randomUUID(), consented: false };
    const conn: Conn = {
      id,
      send: (t, d) => {
        try {
          ws.send(JSON.stringify({ t, d }));
        } catch {
          /* socket already closing */
        }
      },
      close: (code, reason) => {
        link.consented = true;
        ws.close(code, reason);
      },
    };

    const q = url.searchParams;
    const token = q.get('token');
    let slot: number | null;
    if (token && this.tokens.has(token)) {
      const oldId = this.tokens.get(token)!;
      this.tokens.delete(token);
      this.links.delete(oldId);
      slot = core.reconnect(oldId, conn);
      if (slot === null) return fail(ERR.NOT_FOUND, 'seat expired');
    } else {
      const r = core.join(conn, { name: q.get('name') ?? '', pv: Number(q.get('pv')), sv: q.get('sv') ?? '' });
      if (typeof r !== 'number') return fail(r.code, r.reason);
      slot = r;
    }
    this.links.set(id, link);
    this.tokens.set(link.token, id);
    conn.send('hello', { code: core.code, slot, token: link.token });

    ws.addEventListener('message', (e) => {
      const raw = typeof e.data === 'string' ? e.data : '';
      if (raw.length === 0 || raw.length > MAX_MSG) return;
      let msg: { t?: unknown; d?: unknown };
      try {
        msg = JSON.parse(raw) as { t?: unknown; d?: unknown };
      } catch {
        return;
      }
      if (msg.t === 'leave') {
        link.consented = true;
        this.forget(id, link);
        core.leave(id);
        ws.close(1000, 'bye');
        return;
      }
      if (typeof msg.t === 'string') core.message(id, msg.t, msg.d);
    });
    const closed = (): void => {
      if (this.links.get(id) !== link) return; // replaced by a reconnection
      this.links.delete(id);
      if (link.consented) {
        this.forget(id, link);
        core.leave(id);
      } else core.drop(id); // seat kept; the token can take it back
    };
    ws.addEventListener('close', closed);
    ws.addEventListener('error', closed);
    this.startLoop();
    return new Response(null, { status: 101, webSocket: client });
  }

  private forget(id: string, link: Link): void {
    this.links.delete(id);
    this.tokens.delete(link.token);
  }

  private startLoop(): void {
    if (this.loop) return;
    this.last = Date.now();
    this.acc = 0;
    this.loop = setInterval(() => this.update(), STEP_MS);
  }

  private update(): void {
    const core = this.core;
    if (!core) return;
    const now = Date.now();
    this.acc += now - this.last;
    this.last = now;
    let ran = 0;
    while (this.acc >= STEP_MS && ran < 6) {
      core.tickOnce();
      this.acc -= STEP_MS;
      ran++;
    }
    if (ran === 6) this.acc = 0; // hitch: drop the backlog instead of spiraling
    // an empty room closes after a while (its code becomes free again)
    if (core.isEmpty) {
      if (now - this.emptySince > 120_000) this.close();
    } else this.emptySince = now;
  }

  private close(): void {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
    this.core?.dispose();
    this.core = null;
    this.tokens.clear();
    this.links.clear();
  }
}
