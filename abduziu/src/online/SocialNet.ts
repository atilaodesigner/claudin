import { arenaUrl } from './ArenaNet';

/** Friends hub protocol (see server/src/hub.ts). */
export interface FriendInfo {
  code: string;
  nick: string;
  online: boolean;
  /** Online room the friend is playing in (join them there). */
  room: string | null;
  party: boolean;
}

export interface SocialState {
  me: { code: string; nick: string };
  friends: FriendInfo[];
  requests: Array<{ code: string; nick: string }>;
  party: { id: string; members: Array<{ code: string; nick: string; leader: boolean }> } | null;
}

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode(): string {
  const buf = new Uint32Array(6);
  crypto.getRandomValues(buf);
  return [...buf].map((n) => CODE_ALPHABET[n % CODE_ALPHABET.length]).join('');
}

export function randomSecret(): string {
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hubUrl(): string {
  return arenaUrl().replace(/arena(\?.*)?$/, 'hub');
}

/**
 * Keeps a socket to the friends hub while the game is open: presence, friend
 * requests, invites and parties. Reconnects on its own with a gentle backoff.
 */
export class SocialNet {
  private ws: WebSocket | null = null;
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private id: { code: string; secret: string; nick: string } | null = null;
  private room: string | null = null;
  state: SocialState | null = null;
  connected = false;
  onState: ((s: SocialState) => void) | null = null;
  onToast: ((text: string, ok: boolean) => void) | null = null;
  onInvite: ((party: string, from: string, nick: string) => void) | null = null;
  onGo: ((room: string) => void) | null = null;
  /** Our code belongs to someone else: the game rolls a new one. */
  onTaken: (() => void) | null = null;
  onConnection: ((up: boolean) => void) | null = null;

  start(code: string, secret: string, nick: string): void {
    this.id = { code, secret, nick };
    this.retry = 0;
    this.open();
  }

  private open(): void {
    if (!this.id) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    let ws: WebSocket;
    try {
      ws = new WebSocket(hubUrl());
    } catch {
      this.schedule();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      const id = this.id;
      if (id) ws.send(JSON.stringify({ t: 'hi', ...id }));
      if (this.room) ws.send(JSON.stringify({ t: 'status', room: this.room }));
    };
    ws.onmessage = (ev) => {
      let m: Record<string, unknown>;
      try {
        m = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (m.t === 'state') {
        this.retry = 0;
        this.state = m as unknown as SocialState;
        if (!this.connected) {
          this.connected = true;
          this.onConnection?.(true);
        }
        this.onState?.(this.state);
      } else if (m.t === 'toast') this.onToast?.(String(m.text), !!m.ok);
      else if (m.t === 'invite') this.onInvite?.(String(m.party), String(m.from), String(m.nick));
      else if (m.t === 'go') this.onGo?.(String(m.room));
      else if (m.t === 'taken') this.onTaken?.();
    };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.connected) {
        this.connected = false;
        this.onConnection?.(false);
      }
      // 4000 = the same code signed in somewhere else (another tab): don't fight it
      if (ev.code !== 4000) this.schedule();
    };
  }

  private schedule(): void {
    if (this.timer || !this.id) return;
    const wait = Math.min(30000, 1500 * 2 ** this.retry++);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.open();
    }, wait);
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  setNick(nick: string): void {
    if (this.id) this.id.nick = nick;
    this.send({ t: 'nick', nick });
  }
  add(tag: string): void {
    this.send({ t: 'add', tag });
  }
  accept(code: string): void {
    this.send({ t: 'accept', code });
  }
  decline(code: string): void {
    this.send({ t: 'decline', code });
  }
  remove(code: string): void {
    this.send({ t: 'remove', code });
  }
  invite(code: string): void {
    this.send({ t: 'invite', code });
  }
  joinParty(party: string): void {
    this.send({ t: 'join_party', party });
  }
  leaveParty(): void {
    this.send({ t: 'leave_party' });
  }
  startParty(): void {
    this.send({ t: 'start' });
  }
  joinFriend(code: string): void {
    this.send({ t: 'join_friend', code });
  }
  /** Tells friends which online room we're in (null = not playing online). */
  setRoom(room: string | null): void {
    this.room = room;
    this.send({ t: 'status', room });
  }

  get partySize(): number {
    return this.state?.party?.members.length ?? 1;
  }
  get isLeader(): boolean {
    const p = this.state?.party;
    return !p || p.members.some((m) => m.leader && m.code === this.state?.me.code);
  }
}
