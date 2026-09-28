import { describe, expect, it } from 'vitest';
import { CITIES as CITY_LIST } from '../src/config/cities';
import { GRID } from '../src/config/districts';
import { tierFromMatter as clientTier } from '../src/progression/RunProgression';
import { CITIES, RoomSim, TILE, tierFromMatter, wrapDelta, wrapPos } from '../server/src/logic';

describe('arena server logic', () => {
  it('uses the same wrapping tile as every city the client builds', () => {
    for (const c of CITY_LIST) {
      const cols = (c.layout[0] as string).length;
      expect(cols * GRID.blockSize + GRID.roadWidth).toBe(TILE);
      expect(c.layout.length * GRID.blockSize + GRID.roadWidth).toBe(TILE);
    }
    for (const id of CITIES) expect(CITY_LIST.some((c) => c.id === id)).toBe(true);
  });

  it('matches the client size curve', () => {
    for (const m of [0, 10, 50, 300, 1500, 9000, 60000]) expect(tierFromMatter(m)).toBeCloseTo(clientTier(m), 6);
  });

  it('wraps around the torus', () => {
    expect(wrapDelta(TILE - 2)).toBeCloseTo(-2);
    expect(wrapPos(TILE / 2 + 3)).toBeCloseTo(-TILE / 2 + 3);
  });

  it('fills the room with bots and lets a big player swallow a small one', () => {
    let r = 0.3;
    const sim = new RoomSim(() => ((r = (r * 9301 + 49297) % 233280), r / 233280));
    sim.addPlayer('a', 'Grande', 0, 0);
    sim.addPlayer('b', 'Pequeno', 0, 0);
    let now = 0;
    let eaten = false;
    // newcomers are shielded for a few seconds first
    for (let i = 0; i < 140 && !eaten; i++) {
      now += 100;
      sim.playerState('a', 0, 0, 0, 0, Math.min(3000, 200 + i * 200), true, now);
      if (i < 90) for (const e of sim.step(0)) void e;
      sim.playerState('b', 1, 1, 0, 0, 10, true, now);
      for (const e of sim.step(0.1)) if (e.k === 'eat' && e.a === 'a' && e.b === 'b') eaten = true;
    }
    expect(eaten).toBe(true);
    expect(sim.time).toBeGreaterThan(10);
    expect([...sim.ships.values()].filter((s) => s.bot).length).toBeGreaterThan(0);
  });

  it('rate-limits how fast a player can claim matter', () => {
    const sim = new RoomSim();
    sim.addPlayer('a', 'X', 0, 0);
    sim.playerState('a', 0, 0, 0, 0, 1e9, true, 100);
    expect(sim.ships.get('a')!.m).toBeLessThan(1000);
  });
});

describe('arena room pacing', () => {
  it('always leaves smaller bots for a newcomer', () => {
    const sim = new RoomSim();
    sim.addPlayer('big', 'Big', 0, 0);
    let now = 0;
    for (let i = 0; i < 600; i++) {
      now += 100;
      sim.playerState('big', 200, 200, 0, 0, Math.min(8000, i * 40), true, now);
      sim.step(0.1);
    }
    sim.addPlayer('new', 'New', 0, now);
    for (let i = 0; i < 100; i++) {
      now += 100;
      sim.playerState('big', 200, 200, 0, 0, 8000, true, now);
      sim.playerState('new', -200, -200, 0, 0, 5, true, now);
      sim.step(0.1);
    }
    const bots = [...sim.ships.values()].filter((s) => s.bot && s.alive).map((s) => s.m);
    expect(bots.some((m) => m < 150)).toBe(true);
    expect(bots.some((m) => m > 3000)).toBe(true);
  });
});
