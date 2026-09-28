/**
 * Friends & parties (pure logic, storage-agnostic so it can be unit tested).
 *
 * Every player has a public friend code (e.g. K7QM2X) and a secret only their device
 * knows: whoever presents the secret owns the code. Friends add each other with
 * "Nick#CODE"; the nick must match what the owner uses right now.
 */

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LEN = 6;
export const MAX_FRIENDS = 100;
export const MAX_INBOX = 50;
export const MAX_PARTY = 8;

export function normCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isCode(code: string): boolean {
  if (code.length !== CODE_LEN) return false;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return false;
  return true;
}

export function cleanNick(raw: unknown): string {
  return String(raw ?? '')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .trim()
    .slice(0, 16);
}

export function sameNick(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');
}

/** "Atila#K7QM2X", "#K7QM2X" or "K7QM2X" → { nick, code }. */
export function parseTag(input: string): { nick: string | null; code: string } | null {
  const s = input.trim();
  const hash = s.lastIndexOf('#');
  const nick = hash > 0 ? cleanNick(s.slice(0, hash)) : null;
  const code = normCode(hash >= 0 ? s.slice(hash + 1) : s);
  if (!isCode(code)) return null;
  return { nick: nick || null, code };
}

export interface Account {
  nick: string;
  /** SHA-256 (hex) of the device secret. */
  secret: string;
  friends: string[];
  /** Codes that asked to be my friend. */
  inbox: string[];
}

/** The slice of Durable Object storage this needs. */
export interface KV {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

export type AddResult = 'sent' | 'accepted' | 'not_found' | 'nick_mismatch' | 'already' | 'self' | 'full';

export class SocialBook {
  constructor(private readonly kv: KV) {}

  private key(code: string): string {
    return `u:${code}`;
  }

  get(code: string): Promise<Account | undefined> {
    return this.kv.get<Account>(this.key(code));
  }

  private put(code: string, a: Account): Promise<void> {
    return this.kv.put(this.key(code), a);
  }

  /** Claims a code (first come) or signs in to it. 'taken' = someone else owns it. */
  async signIn(code: string, secretHash: string, nick: string): Promise<'ok' | 'taken'> {
    const a = await this.get(code);
    if (!a) {
      await this.put(code, { nick, secret: secretHash, friends: [], inbox: [] });
      return 'ok';
    }
    if (a.secret !== secretHash) return 'taken';
    if (a.nick !== nick) {
      a.nick = nick;
      await this.put(code, a);
    }
    return 'ok';
  }

  async request(from: string, tag: { nick: string | null; code: string }): Promise<AddResult> {
    const to = tag.code;
    if (to === from) return 'self';
    const [me, them] = await Promise.all([this.get(from), this.get(to)]);
    if (!me || !them) return 'not_found';
    if (tag.nick && !sameNick(tag.nick, them.nick)) return 'nick_mismatch';
    if (me.friends.includes(to)) return 'already';
    if (me.friends.length >= MAX_FRIENDS || them.friends.length >= MAX_FRIENDS) return 'full';
    // they already asked me: that's a yes
    if (me.inbox.includes(to)) {
      await this.link(from, me, to, them);
      return 'accepted';
    }
    if (!them.inbox.includes(from)) {
      them.inbox.push(from);
      if (them.inbox.length > MAX_INBOX) them.inbox.shift();
      await this.put(to, them);
    }
    return 'sent';
  }

  async accept(me: string, from: string): Promise<boolean> {
    const [a, b] = await Promise.all([this.get(me), this.get(from)]);
    if (!a || !b || !a.inbox.includes(from)) return false;
    await this.link(me, a, from, b);
    return true;
  }

  async decline(me: string, from: string): Promise<void> {
    const a = await this.get(me);
    if (!a) return;
    a.inbox = a.inbox.filter((c) => c !== from);
    await this.put(me, a);
  }

  async remove(me: string, other: string): Promise<void> {
    const [a, b] = await Promise.all([this.get(me), this.get(other)]);
    if (a) {
      a.friends = a.friends.filter((c) => c !== other);
      await this.put(me, a);
    }
    if (b) {
      b.friends = b.friends.filter((c) => c !== me);
      await this.put(other, b);
    }
  }

  private async link(aCode: string, a: Account, bCode: string, b: Account): Promise<void> {
    a.inbox = a.inbox.filter((c) => c !== bCode);
    b.inbox = b.inbox.filter((c) => c !== aCode);
    if (!a.friends.includes(bCode)) a.friends.push(bCode);
    if (!b.friends.includes(aCode)) b.friends.push(aCode);
    await Promise.all([this.put(aCode, a), this.put(bCode, b)]);
  }
}

export interface Party {
  id: string;
  leader: string;
  members: string[];
}

/** Groups of friends that enter the same online room together (in memory). */
export class Parties {
  private readonly byId = new Map<string, Party>();
  private readonly byMember = new Map<string, string>();
  private seq = 0;

  of(code: string): Party | null {
    const id = this.byMember.get(code);
    return id ? (this.byId.get(id) ?? null) : null;
  }

  get(id: string): Party | null {
    return this.byId.get(id) ?? null;
  }

  /** The player's party, creating a solo one if needed. */
  ensure(code: string): Party {
    const cur = this.of(code);
    if (cur) return cur;
    const p: Party = { id: `g${(++this.seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`, leader: code, members: [code] };
    this.byId.set(p.id, p);
    this.byMember.set(code, p.id);
    return p;
  }

  /** Returns the parties whose membership changed (to notify), or null if it can't join. */
  join(id: string, code: string): Party[] | null {
    const p = this.byId.get(id);
    if (!p) return null;
    if (p.members.includes(code)) return [p];
    if (p.members.length >= MAX_PARTY) return null;
    const changed = this.leave(code);
    p.members.push(code);
    this.byMember.set(code, p.id);
    return [...changed.filter((c) => c.id !== p.id), p];
  }

  /** Leaves the current party (a new leader is picked, empty parties vanish). */
  leave(code: string): Party[] {
    const p = this.of(code);
    if (!p) return [];
    this.byMember.delete(code);
    p.members = p.members.filter((c) => c !== code);
    if (p.members.length === 0) {
      this.byId.delete(p.id);
      return [];
    }
    if (p.leader === code) p.leader = p.members[0] as string;
    return [p];
  }
}
