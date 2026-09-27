import { describe, expect, it } from 'vitest';
import { OBJECTS } from '../src/config/objects';
import { BALANCE } from '../src/config/gameBalance';
import { matterForTier, tierFromMatter, levelFromXp } from '../src/progression/RunProgression';

/**
 * Rough intake model of a competent player: eats ~0.8 objects/s of the two highest
 * liftable tiers. Checks the escalation timeline the design asks for.
 */
function simulate(seconds: number): { tierAt: Record<number, number>; levelAt: (t: number) => number } {
  let matter = 0;
  const tierAt: Record<number, number> = {};
  const levels: number[] = [];
  for (let t = 0; t <= seconds; t++) {
    const tier = tierFromMatter(matter);
    const ft = Math.floor(tier);
    if (tierAt[ft] === undefined) tierAt[ft] = t;
    matter += 0.8 * matterForTier(Math.max(0, tier - 0.6));
    levels.push(levelFromXp(matter));
  }
  return { tierAt, levelAt: (t: number) => levels[Math.min(levels.length - 1, t)] ?? 1 };
}

describe('balance timeline', () => {
  const sim = simulate(600);

  it('follows the escalation beats (±60s tolerance)', () => {
    expect(sim.tierAt[2]).toBeGreaterThan(20);
    expect(sim.tierAt[2]).toBeLessThan(110);
    expect(sim.tierAt[3]).toBeLessThan(200);
    expect(sim.tierAt[5]).toBeLessThan(330);
    expect(sim.tierAt[8]).toBeLessThan(560);
  });

  it('levels come regularly (not a card every 5s, not starving)', () => {
    const l60 = sim.levelAt(60);
    const l300 = sim.levelAt(300);
    expect(l60).toBeGreaterThanOrEqual(3);
    expect(l60).toBeLessThanOrEqual(8);
    expect(l300).toBeGreaterThan(l60 + 6);
    expect(l300).toBeLessThan(30);
  });
});

describe('object table', () => {
  it('has unique ids and dex numbers, valid tiers', () => {
    expect(new Set(OBJECTS.map((o) => o.id)).size).toBe(OBJECTS.length);
    expect(new Set(OBJECTS.map((o) => o.dex)).size).toBe(OBJECTS.length);
    for (const o of OBJECTS) {
      expect(o.tier).toBeGreaterThanOrEqual(0);
      expect(o.tier).toBeLessThanOrEqual(10);
      expect(o.massKg).toBeGreaterThan(0);
      expect(o.description.length).toBeGreaterThan(5);
    }
  });

  it('ships at least 30 abductable objects and a handful of secrets', () => {
    expect(OBJECTS.length).toBeGreaterThanOrEqual(30);
    expect(OBJECTS.filter((o) => o.secret).length).toBeGreaterThanOrEqual(6);
  });

  it('every tier from 0 to 9 has content', () => {
    for (let t = 0; t <= 9; t++) expect(OBJECTS.some((o) => o.tier === t)).toBe(true);
    expect(BALANCE.tierMatterThresholds.length).toBeGreaterThan(10);
  });
});
