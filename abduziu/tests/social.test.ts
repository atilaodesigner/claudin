import { describe, expect, it } from 'vitest';
import { RoomSim } from '../server/src/logic';
import { MAX_PARTY, parseTag, Parties, SocialBook, type KV } from '../server/src/social';

class MemKV implements KV {
  private readonly m = new Map<string, unknown>();
  async get<T>(k: string): Promise<T | undefined> {
    const v = this.m.get(k);
    return v === undefined ? undefined : (structuredClone(v) as T);
  }
  async put<T>(k: string, v: T): Promise<void> {
    this.m.set(k, structuredClone(v));
  }
}

describe('friend tags', () => {
  it('parses Nick#CODE, #CODE and CODE', () => {
    expect(parseTag('Atila#k7qm2x')).toEqual({ nick: 'Atila', code: 'K7QM2X' });
    expect(parseTag('#K7QM2X')).toEqual({ nick: null, code: 'K7QM2X' });
    expect(parseTag(' K7Q-M2X ')).toEqual({ nick: null, code: 'K7QM2X' });
    expect(parseTag('Atila#K7Q')).toBeNull();
    expect(parseTag('Atila#K7QM2I')).toBeNull(); // I is not in the alphabet
  });
});

describe('social book', () => {
  it('claims codes and refuses a different secret', async () => {
    const b = new SocialBook(new MemKV());
    expect(await b.signIn('AAAAAA', 'h1', 'Ana')).toBe('ok');
    expect(await b.signIn('AAAAAA', 'h1', 'Ana2')).toBe('ok');
    expect((await b.get('AAAAAA'))?.nick).toBe('Ana2');
    expect(await b.signIn('AAAAAA', 'other', 'Ladrão')).toBe('taken');
  });

  it('request → accept makes a mutual friendship; nick must match', async () => {
    const b = new SocialBook(new MemKV());
    await b.signIn('AAAAAA', 'h', 'Ana');
    await b.signIn('BBBBBB', 'h', 'Beto');
    expect(await b.request('AAAAAA', { nick: 'Carlos', code: 'BBBBBB' })).toBe('nick_mismatch');
    expect(await b.request('AAAAAA', { nick: 'beto', code: 'BBBBBB' })).toBe('sent');
    expect((await b.get('BBBBBB'))?.inbox).toEqual(['AAAAAA']);
    expect(await b.accept('BBBBBB', 'AAAAAA')).toBe(true);
    expect((await b.get('AAAAAA'))?.friends).toEqual(['BBBBBB']);
    expect((await b.get('BBBBBB'))?.friends).toEqual(['AAAAAA']);
    expect(await b.request('AAAAAA', { nick: null, code: 'BBBBBB' })).toBe('already');
    await b.remove('BBBBBB', 'AAAAAA');
    expect((await b.get('AAAAAA'))?.friends).toEqual([]);
  });

  it('asking someone who already asked you accepts at once', async () => {
    const b = new SocialBook(new MemKV());
    await b.signIn('AAAAAA', 'h', 'Ana');
    await b.signIn('BBBBBB', 'h', 'Beto');
    expect(await b.request('AAAAAA', { nick: null, code: 'BBBBBB' })).toBe('sent');
    expect(await b.request('BBBBBB', { nick: null, code: 'AAAAAA' })).toBe('accepted');
    expect((await b.get('AAAAAA'))?.inbox).toEqual([]);
    expect(await b.request('AAAAAA', { nick: null, code: 'AAAAAA' })).toBe('self');
    expect(await b.request('AAAAAA', { nick: null, code: 'ZZZZZZ' })).toBe('not_found');
  });
});

describe('parties', () => {
  it('invite, join, leave and leader hand-over', () => {
    const p = new Parties();
    const g = p.ensure('A');
    expect(p.join(g.id, 'B')?.map((x) => x.id)).toEqual([g.id]);
    expect(p.of('B')?.members).toEqual(['A', 'B']);
    p.leave('A');
    expect(p.of('B')?.leader).toBe('B');
    // joining another party leaves the old one
    const h = p.ensure('C');
    p.join(h.id, 'B');
    expect(p.get(g.id)).toBeNull();
    expect(p.of('B')?.id).toBe(h.id);
    for (let i = 0; i < MAX_PARTY; i++) p.join(h.id, `X${i}`);
    expect(p.of('C')?.members.length).toBe(MAX_PARTY);
    expect(p.join(h.id, 'late')).toBeNull();
  });
});

describe('room keep-alive', () => {
  it('a loading player with pings survives; a silent flying one is dropped', () => {
    const sim = new RoomSim(() => 0.5);
    sim.addPlayer('p1', 'Loading', 0xffffff, 0);
    sim.addPlayer('p2', 'Flying', 0xffffff, 0);
    sim.playerState('p2', 0, 0, 0, 0, 10, true, 1000);
    sim.touch('p1', 30000);
    expect(sim.silent(40000)).toEqual(['p2']);
    expect(sim.silent(80000).sort()).toEqual(['p1', 'p2']);
  });
});
