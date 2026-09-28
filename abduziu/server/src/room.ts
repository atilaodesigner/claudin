import { DurableObject } from 'cloudflare:workers';
import { CITIES, HOLD_BOT, HOLD_PLAYER, MAX_PLAYERS, RoomSim, TILE } from './logic';

const TICK = 0.1;

/**
 * One arena room. Players connect with a WebSocket, report their own ship ~10×/s and
 * get the whole room back 10×/s; the room runs the bots and decides every swallow.
 */
export class ArenaRoom extends DurableObject {
  private readonly sim = new RoomSim();
  private readonly sockets = new Map<string, WebSocket>();
  private readonly dead = new Map<string, number>();
  private loop: ReturnType<typeof setInterval> | null = null;
  private readonly city: string;
  private readonly seed: number;
  /** Public name the router gave this room (friends use it to join each other). */
  private name = '';

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    // each room keeps one city for its whole life (everyone must build the same map)
    const key = ctx.id.toString();
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) >>> 0;
    this.city = CITIES[h % CITIES.length] as string;
    this.seed = h % 1_000_000_000;
  }

  override async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const named = req.headers.get('X-Room');
    if (named) this.name = named;
    if (url.pathname.endsWith('/count')) return Response.json({ players: this.sockets.size, city: this.city });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    if (this.sockets.size >= MAX_PLAYERS) return new Response('room full', { status: 429 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();
    const id = `p${crypto.randomUUID().slice(0, 8)}`;
    server.addEventListener('message', (ev) => this.onMessage(id, server, ev.data));
    const bye = () => this.drop(id);
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }

  private send(ws: WebSocket, msg: unknown): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* socket already gone */
    }
  }

  private onMessage(id: string, ws: WebSocket, raw: unknown): void {
    if (typeof raw !== 'string' || raw.length > 2000) return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const now = Date.now();
    if (msg.t === 'hello' && !this.sockets.has(id)) {
      const name = String(msg.name ?? 'Visitante').replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, 16) || 'Visitante';
      const color = Number(msg.color) & 0xffffff;
      const clean = (v: unknown, d: string) => (typeof v === 'string' && /^[a-z0-9_]{1,20}$/.test(v) ? v : d);
      this.sockets.set(id, ws);
      this.sim.addPlayer(id, name, color, now, clean(msg.skin, 'classico'), clean(msg.beam, 'verde'));
      this.send(ws, { t: 'welcome', id, city: this.city, seed: this.seed, tile: TILE, room: this.name });
      this.ensureLoop();
    } else if (msg.t === 'st') {
      this.sim.playerState(id, Number(msg.x), Number(msg.z), Number(msg.vx), Number(msg.vz), Number(msg.m), !!msg.b, now);
    } else if (msg.t === 'ping') {
      this.sim.touch(id, now);
    } else if (msg.t === 'bye') {
      this.drop(id);
    }
  }

  private drop(id: string): void {
    const ws = this.sockets.get(id);
    this.sockets.delete(id);
    this.dead.delete(id);
    this.sim.removeShip(id);
    try {
      ws?.close(1000, 'bye');
    } catch {
      /* ignore */
    }
    if (this.sockets.size === 0 && this.loop) {
      clearInterval(this.loop);
      this.loop = null;
    }
  }

  private ensureLoop(): void {
    if (this.loop) return;
    this.loop = setInterval(() => this.tick(), TICK * 1000);
  }

  private tick(): void {
    const now = Date.now();
    for (const ev of this.sim.step(TICK)) {
      if (ev.k !== 'eat') continue;
      const a = this.sim.ships.get(ev.a);
      const b = this.sim.ships.get(ev.b);
      if (!a || !b) continue;
      const aws = this.sockets.get(a.id);
      if (aws) this.send(aws, { t: 'ate', victim: b.name, victimId: b.id, gain: Math.round(ev.gain) });
      const bws = this.sockets.get(b.id);
      if (bws) {
        this.send(bws, { t: 'eaten', by: a.name, byId: a.id });
        this.dead.set(b.id, now);
      }
    }
    // swallowed players and silent sockets leave the room
    for (const [id, at] of this.dead) if (now - at > 4000) this.drop(id);
    for (const id of this.sim.silent(now)) this.drop(id);

    const ships = [...this.sim.ships.values()]
      // players still loading/in their intro stay invisible until they start flying
      .filter((s) => s.alive && (s.bot || s.flying))
      .map((s) => [s.id, s.name, s.color, +s.x.toFixed(2), +s.z.toFixed(2), +s.vx.toFixed(2), +s.vz.toFixed(2), Math.round(s.m), s.bot ? 1 : 0, s.skin, s.beamStyle]);
    const lb = this.sim.leaderboard(10);
    const players = this.sockets.size;
    for (const [id, ws] of this.sockets) {
      const me = this.sim.ships.get(id);
      const hold = me && me.heldBy ? +(me.held / (me.bot ? HOLD_BOT : HOLD_PLAYER)).toFixed(2) : 0;
      this.send(ws, { t: 'snap', s: ships, lb, n: players, h: hold, hb: me?.heldBy ?? null });
    }
  }
}
