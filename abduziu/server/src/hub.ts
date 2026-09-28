import { DurableObject } from 'cloudflare:workers';
import { pickRoom, isRoomName, type RoomNamespace } from './router';
import { cleanNick, isCode, normCode, parseTag, Parties, SocialBook, type Party } from './social';

interface Session {
  ws: WebSocket;
  nick: string;
  /** Online room the player is in right now (friends can join it). */
  room: string | null;
}

interface Env {
  ROOMS: RoomNamespace;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const ADD_TEXT: Record<string, string> = {
  sent: 'Pedido de amizade enviado!',
  accepted: 'Vocês agora são amigos!',
  not_found: 'Nenhum jogador com esse código.',
  nick_mismatch: 'O nick não bate com esse código.',
  already: 'Vocês já são amigos.',
  self: 'Esse é o seu próprio código 😅',
  full: 'Lista de amigos cheia.',
};

/**
 * One global hub for friends, presence, invites and parties. Clients keep a WebSocket
 * open while the game is running; friendships persist in this object's storage.
 */
export class Hub extends DurableObject<Env> {
  private readonly book: SocialBook;
  private readonly parties = new Parties();
  private readonly sessions = new Map<string, Session>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.book = new SocialBook(ctx.storage);
  }

  override async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();
    let code: string | null = null;
    server.addEventListener('message', (ev) => {
      void this.onMessage(server, code, ev.data).then((c) => {
        if (c) code = c;
      });
    });
    const bye = () => {
      if (code && this.sessions.get(code)?.ws === server) void this.goOffline(code);
    };
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }

  private send(ws: WebSocket | undefined, msg: unknown): void {
    if (!ws) return;
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* gone */
    }
  }

  private toast(code: string, text: string, ok = true): void {
    this.send(this.sessions.get(code)?.ws, { t: 'toast', text, ok });
  }

  /** Returns the code this socket signed in with (on 'hi'). */
  private async onMessage(ws: WebSocket, code: string | null, raw: unknown): Promise<string | null> {
    if (typeof raw !== 'string' || raw.length > 1000) return null;
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(raw);
    } catch {
      return null;
    }
    if (m.t === 'hi') return this.signIn(ws, m);
    if (!code || this.sessions.get(code)?.ws !== ws) return null;
    const other = normCode(String(m.code ?? ''));
    switch (m.t) {
      case 'nick': {
        const nick = cleanNick(m.nick);
        if (nick.length < 2) break;
        const s = this.sessions.get(code) as Session;
        s.nick = nick;
        await this.book.signIn(code, (await this.book.get(code))?.secret ?? '', nick);
        await this.pushAround(code);
        break;
      }
      case 'add': {
        const tag = parseTag(String(m.tag ?? ''));
        if (!tag) {
          this.toast(code, 'Código inválido. Use NICK#CÓDIGO.', false);
          break;
        }
        const r = await this.book.request(code, tag);
        this.toast(code, ADD_TEXT[r] ?? r, r === 'sent' || r === 'accepted');
        if (r === 'sent') this.toast(tag.code, `${(this.sessions.get(code) as Session).nick} quer ser seu amigo!`);
        if (r === 'accepted') this.toast(tag.code, `${(this.sessions.get(code) as Session).nick} aceitou sua amizade!`);
        await this.push(code);
        await this.push(tag.code);
        break;
      }
      case 'accept':
        if (isCode(other) && (await this.book.accept(code, other))) {
          this.toast(other, `${(this.sessions.get(code) as Session).nick} aceitou sua amizade!`);
          await this.push(code);
          await this.push(other);
        }
        break;
      case 'decline':
        if (isCode(other)) {
          await this.book.decline(code, other);
          await this.push(code);
        }
        break;
      case 'remove':
        if (isCode(other)) {
          await this.book.remove(code, other);
          await this.push(code);
          await this.push(other);
        }
        break;
      case 'invite': {
        const me = await this.book.get(code);
        const friend = this.sessions.get(other);
        if (!me?.friends.includes(other) || !friend) {
          this.toast(code, 'Esse amigo não está online.', false);
          break;
        }
        const party = this.parties.ensure(code);
        this.send(friend.ws, { t: 'invite', party: party.id, from: code, nick: (this.sessions.get(code) as Session).nick });
        this.toast(code, `Convite enviado pra ${friend.nick}!`);
        await this.pushParty(party);
        break;
      }
      case 'join_party': {
        const changed = this.parties.join(String(m.party ?? ''), code);
        if (!changed) {
          this.toast(code, 'Esse grupo não existe mais ou está cheio.', false);
          break;
        }
        for (const p of changed) await this.pushParty(p);
        await this.push(code);
        break;
      }
      case 'leave_party': {
        const changed = this.parties.leave(code);
        for (const p of changed) await this.pushParty(p);
        await this.push(code);
        break;
      }
      case 'start': {
        const party = this.parties.of(code);
        if (!party || party.leader !== code) break;
        const online = party.members.filter((c) => this.sessions.has(c));
        const room = await pickRoom(this.env.ROOMS, online.length);
        if (!room) {
          this.toast(code, 'Todas as salas estão cheias. Tenta de novo já já.', false);
          break;
        }
        for (const c of online) this.send(this.sessions.get(c)?.ws, { t: 'go', room });
        break;
      }
      case 'join_friend': {
        const me = await this.book.get(code);
        const friend = this.sessions.get(other);
        if (!me?.friends.includes(other) || !friend?.room) {
          this.toast(code, 'Esse amigo não está numa partida online agora.', false);
          break;
        }
        this.send(ws, { t: 'go', room: friend.room });
        break;
      }
      case 'status': {
        const s = this.sessions.get(code) as Session;
        const room = typeof m.room === 'string' && isRoomName(m.room) ? m.room : null;
        if (s.room !== room) {
          s.room = room;
          await this.pushAround(code);
        }
        break;
      }
      default:
        break;
    }
    return null;
  }

  private async signIn(ws: WebSocket, m: Record<string, unknown>): Promise<string | null> {
    const code = normCode(String(m.code ?? ''));
    const secret = String(m.secret ?? '');
    const nick = cleanNick(m.nick) || 'Visitante';
    if (!isCode(code) || secret.length < 16 || secret.length > 128) {
      this.send(ws, { t: 'taken' });
      return null;
    }
    const r = await this.book.signIn(code, await sha256(secret), nick);
    if (r === 'taken') {
      // that code belongs to someone else: the client rolls a new one
      this.send(ws, { t: 'taken' });
      return null;
    }
    const old = this.sessions.get(code);
    if (old && old.ws !== ws) {
      try {
        old.ws.close(4000, 'replaced');
      } catch {
        /* ignore */
      }
    }
    this.sessions.set(code, { ws, nick, room: null });
    await this.pushAround(code);
    return code;
  }

  private async goOffline(code: string): Promise<void> {
    this.sessions.delete(code);
    for (const p of this.parties.leave(code)) await this.pushParty(p);
    await this.pushAround(code, false);
  }

  /** Pushes my state and refreshes every online friend (presence changed). */
  private async pushAround(code: string, self = true): Promise<void> {
    if (self) await this.push(code);
    const a = await this.book.get(code);
    for (const f of a?.friends ?? []) if (this.sessions.has(f)) await this.push(f);
  }

  private async pushParty(p: Party): Promise<void> {
    for (const c of p.members) await this.push(c);
  }

  /** Full social state for one online player. */
  private async push(code: string): Promise<void> {
    const s = this.sessions.get(code);
    if (!s) return;
    const a = await this.book.get(code);
    if (!a) return;
    const party = this.parties.of(code);
    const inParty = new Set(party?.members ?? []);
    const friends = await Promise.all(
      a.friends.map(async (c) => {
        const f = this.sessions.get(c);
        const acc = f ? null : await this.book.get(c);
        return { code: c, nick: f?.nick ?? acc?.nick ?? '???', online: !!f, room: f?.room ?? null, party: inParty.has(c) };
      }),
    );
    friends.sort((x, y) => Number(y.online) - Number(x.online) || x.nick.localeCompare(y.nick));
    const requests = await Promise.all(a.inbox.map(async (c) => ({ code: c, nick: (await this.book.get(c))?.nick ?? '???' })));
    const members = party
      ? party.members.map((c) => ({ code: c, nick: this.sessions.get(c)?.nick ?? '???', leader: c === party.leader }))
      : [];
    this.send(s.ws, { t: 'state', me: { code, nick: s.nick }, friends, requests, party: party ? { id: party.id, members } : null });
  }
}
