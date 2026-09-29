import { beforeAll, describe, expect, it } from 'vitest';
import { Bot, PROTOCOL_VERSION, RoomCore, SIM_VERSION, initPhysics, nextRandom, type Conn, type MatchState, type SimEvent } from '../src';

beforeAll(async () => {
  await initPhysics();
});

function fake(id: string) {
  const got = { snap: null as MatchState | null, events: [] as SimEvent[] };
  const conn: Conn = {
    id,
    send: (type, msg) => {
      if (type === 'snap') got.snap = (msg as { s: MatchState }).s;
      if (type === 'ev') got.events.push(...(msg as { e: SimEvent[] }).e);
    },
    close: () => {},
  };
  return { conn, got };
}

/** Two bots play through RoomCore; slot 1's frames reach the server `lag` ticks late. */
function play(lag: number, ticks: number) {
  let r = 99;
  const room = new RoomCore('TEST', () => {
    const [v, n] = nextRandom(r);
    r = n;
    return v;
  });
  const a = fake('a');
  const b = fake('b');
  const opts = { name: 'x', pv: PROTOCOL_VERSION, sv: SIM_VERSION };
  room.join(a.conn, opts);
  room.join(b.conn, opts);
  room.message('a', 'ready', true);
  room.message('b', 'ready', true);
  const bots = [new Bot(0, 'hard', 1), new Bot(1, 'hard', 2)];
  // each client predicts from the last snapshot it has; here both see the exact state
  const truth = () => a.got.snap!;
  const pending: Array<[number, number, number]> = [];
  const seq = [0, 0];
  for (let i = 0; i < ticks; i++) {
    const t = room.tick + 1;
    const s = truth();
    for (const slot of [0, 1]) {
      const bits = bots[slot]!.think(s);
      seq[slot]!++;
      const frame: [number, number, number] = [seq[slot]!, t, bits];
      if (slot === 0 || lag === 0) room.message(slot ? 'b' : 'a', 'in', { f: [frame] });
      else pending.push(frame);
    }
    while (pending.length && pending[0]![1] <= t - lag) room.message('b', 'in', { f: [pending.shift()!] });
    room.tickOnce();
    // keep the snapshot fresh every tick for the bots
    (room as unknown as { sendSnapshots(): void }).sendSnapshots();
  }
  const contacts = a.got.events.filter((e) => e.k === 'contact' && e.slot === 1 && e.kind !== 'serve').length;
  return { contacts, stats: room.stats(), events: a.got.events };
}

describe('toque atrasado', () => {
  it('um toque que chega 4 ticks atrasado cai no tick certo (re-simulação)', () => {
    const late = play(4, 60 * 60);
    const seat1 = late.stats.seats.find((s) => s.slot === 1)!;
    expect(seat1.rewinds).toBeGreaterThan(0);
    expect(late.contacts).toBeGreaterThan(10);
  });

  it('ids de evento nunca se repetem, mesmo re-simulando', () => {
    const { events } = play(4, 60 * 60);
    const ids = events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
