import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, type Room } from '@colyseus/sdk';
import type { Server } from 'colyseus';
import { CODE_ALPHABET, ERR, PROTOCOL_VERSION, ROOM_NAME, SIM_VERSION, type LobbyMsg, type SimEvent, type SnapMsg } from '@ginga/shared';
import { startServer } from '../src/app';

const PORT = 25000 + Math.floor(Math.random() * 1000);
let server: Server;
const url = `ws://localhost:${PORT}`;
const opts = (name: string) => ({ name, pv: PROTOCOL_VERSION, sv: SIM_VERSION });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Probe {
  room: Room;
  lobby: LobbyMsg | null;
  snap: SnapMsg | null;
  events: SimEvent[];
}

function probe(room: Room): Probe {
  const p: Probe = { room, lobby: null, snap: null, events: [] };
  room.onMessage('lobby', (m: LobbyMsg) => (p.lobby = m));
  room.onMessage('snap', (m: SnapMsg) => (p.snap = m));
  room.onMessage('ev', (m: { e: SimEvent[] }) => p.events.push(...m.e));
  room.onMessage('pong', () => {});
  return p;
}

async function until(cond: () => boolean, ms = 15000): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await wait(20);
  }
}

async function pair(): Promise<[Probe, Probe]> {
  const a = probe(await new Client(url).create(ROOM_NAME, opts('Duda')));
  await until(() => a.lobby !== null);
  const b = probe(await new Client(url).joinById(a.lobby!.code, opts('Juninho')));
  await until(() => a.lobby!.seats.length === 2 && b.lobby !== null);
  return [a, b];
}

beforeAll(async () => {
  server = await startServer(PORT);
});
afterAll(async () => {
  await server.gracefullyShutdown(false);
});

describe('sala', () => {
  it('cria com código curto sem letras ambíguas e entra pelo código', async () => {
    const [a, b] = await pair();
    const code = a.lobby!.code;
    expect(code).toHaveLength(4);
    for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
    expect(b.lobby!.code).toBe(code);
    expect(a.lobby!.you).toBe(0);
    expect(b.lobby!.you).toBe(1);
    expect(b.lobby!.seats.map((s) => s.name)).toEqual(['Duda', 'Juninho']);
    await a.room.leave();
    await b.room.leave();
  });

  it('recusa versão diferente, sala cheia e código inexistente', async () => {
    const [a, b] = await pair();
    await expect(new Client(url).joinById(a.lobby!.code, { name: 'X', pv: PROTOCOL_VERSION + 1, sv: SIM_VERSION })).rejects.toThrow();
    await expect(new Client(url).joinById(a.lobby!.code, opts('Terceiro'))).rejects.toThrow();
    await expect(new Client(url).joinById('ZZZZ', opts('Perdido'))).rejects.toThrow();
    await a.room.leave();
    await b.room.leave();
  });

  it('apelido é limpo pelo servidor', async () => {
    const a = probe(await new Client(url).create(ROOM_NAME, { ...opts('<b>Duda</b>!!!'), name: '<script>Duda' }));
    await until(() => a.lobby !== null);
    expect(a.lobby!.seats[0]!.name).toBe('scriptDuda');
    await a.room.leave();
  });
});

describe('partida', () => {
  it('os dois confirmam, a partida começa, sai saque automático e os dois recebem o mesmo ponto', async () => {
    const [a, b] = await pair();
    a.room.send('ready', true);
    b.room.send('ready', true);
    await until(() => a.snap !== null && a.snap.s.phase !== 'idle');
    expect(a.lobby!.stage).toBe('match');
    await until(() => a.events.some((e) => e.k === 'point') && b.events.some((e) => e.k === 'point'), 20000);
    const pa = a.events.find((e) => e.k === 'point')!;
    const pb = b.events.find((e) => e.k === 'point')!;
    expect(pa).toEqual(pb);
    expect(a.events.some((e) => e.k === 'autoServe')).toBe(true);
    await a.room.leave();
    await b.room.leave();
  }, 30000);

  it('input adulterado não move ninguém nem muda o placar; flood derruba o cliente', async () => {
    const [a, b] = await pair();
    let kicked = -1;
    a.room.onLeave((code) => (kicked = code));
    a.room.send('ready', true);
    b.room.send('ready', true);
    await until(() => b.snap?.s.phase === 'countdown');
    const x0 = b.snap!.s.players[0]!.x;
    const tick = b.snap!.s.tick;
    // position/force/score injection, bad bits, far-future ticks
    a.room.send('in', { f: [[1, tick + 1, 999]] });
    a.room.send('in', { f: [[2, tick + 1, 2]], x: 100, score: [7, 0] });
    a.room.send('in', { f: [[3, tick + 5000, 2]] });
    a.room.send('in', { x: 50, vx: 999 });
    a.room.send('score', [7, 0]);
    await wait(300);
    expect(b.snap!.s.players[0]!.x).toBe(x0); // countdown: nobody moves, whatever was sent
    expect(b.snap!.s.score).toEqual([0, 0]);
    expect(kicked).toBe(-1);
    // flood past the token bucket → too many violations → kicked
    for (let i = 0; i < 60; i++) a.room.send('in', { f: [[10 + i, tick + 2 + i, 1]] });
    await until(() => kicked !== -1, 5000);
    expect(kicked).toBe(ERR.KICKED);
    await until(() => b.events.some((e) => e.k === 'over'), 20000);
    expect(b.events.find((e) => e.k === 'over')).toMatchObject({ winner: 1 });
    expect(b.snap!.s.score).toEqual([0, 0]);
    await b.room.leave();
  }, 30000);

  it('quem sai no meio da partida perde por W.O.', async () => {
    const [a, b] = await pair();
    a.room.send('ready', true);
    b.room.send('ready', true);
    await until(() => a.snap?.s.phase === 'countdown');
    await b.room.leave(true);
    await until(() => a.events.some((e) => e.k === 'over'));
    expect(a.events.find((e) => e.k === 'over')).toMatchObject({ winner: 0, reason: 'forfeit' });
    await until(() => a.lobby!.stage === 'lobby' && a.lobby!.seats.length === 1);
    await a.room.leave();
  });

  it('queda de conexão pausa a partida e a reconexão retoma na mesma vaga', async () => {
    const [a, b] = await pair();
    a.room.send('ready', true);
    b.room.send('ready', true);
    await until(() => a.snap?.s.phase === 'countdown');
    await wait(1200); // past the SDK's minimum uptime for automatic reconnection
    const token = b.room.reconnectionToken;
    b.room.reconnection.enabled = false; // simulate a closed tab: reconnect by token, like a page reload
    b.room.connection.close(4999, 'simulated drop');
    await until(() => a.events.some((e) => e.k === 'phase' && e.phase === 'paused'), 5000);
    await until(() => a.lobby!.seats[1]?.connected === false, 5000);
    const back = probe(await new Client(url).reconnect(token));
    await until(() => a.events.some((e) => e.k === 'phase' && e.phase === 'resume'), 5000);
    await until(() => back.lobby !== null);
    expect(back.lobby!.you).toBe(1);
    expect(back.lobby!.seats[1]!.name).toBe('Juninho');
    expect(a.lobby!.seats.every((s) => s.connected)).toBe(true);
    await a.room.leave();
    await back.room.leave();
  }, 20000);
});
