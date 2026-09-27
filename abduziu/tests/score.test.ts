import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/gameBalance';
import { ChallengeSystem } from '../src/progression/ChallengeSystem';
import { computeCores, extractionMultiplierAt, nextExtractionTier, objectScore } from '../src/progression/ScoreSystem';
import { Rng, dailySeed } from '../src/utils/rng';

describe('score', () => {
  it('scales with mass, combo, alert, risk and rarity', () => {
    const base = { massKg: 1000, comboMultiplier: 1, alert: 0, riskMultiplier: 1, rarityMultiplier: 1 };
    const s = objectScore(base);
    expect(objectScore({ ...base, massKg: 12000 })).toBeGreaterThan(s);
    expect(objectScore({ ...base, comboMultiplier: 2 })).toBeCloseTo(s * 2, -1);
    expect(objectScore({ ...base, alert: 4 })).toBeGreaterThan(s);
    expect(objectScore({ ...base, rarityMultiplier: 5 })).toBeCloseTo(s * 5, -1);
  });
});

describe('extraction risk/reward', () => {
  it('portal opens at 5 minutes with growing multipliers', () => {
    expect(extractionMultiplierAt(299)).toBe(0);
    expect(extractionMultiplierAt(300)).toBe(1);
    expect(extractionMultiplierAt(420)).toBe(2);
    expect(extractionMultiplierAt(540)).toBe(4);
    expect(extractionMultiplierAt(720)).toBe(8);
    expect(nextExtractionTier(430)).toEqual({ time: 540, multiplier: 4 });
    expect(nextExtractionTier(9999)).toBeNull();
  });

  it('extracting beats dying, and waiting pays off', () => {
    const common = { matter: 800, discoveries: 3, enemiesDestroyed: 5, challengeRewards: 60, metaCoreBonus: 0, bonusCores: 0 };
    const died = computeCores({ ...common, extracted: false, extractionMultiplier: 0 });
    const early = computeCores({ ...common, extracted: true, extractionMultiplier: 1 });
    const late = computeCores({ ...common, matter: 3000, extracted: true, extractionMultiplier: 4 });
    expect(early.total).toBeGreaterThan(died.total);
    expect(Math.abs(died.total - died.base * BALANCE.extraction.deathCoreShare)).toBeLessThanOrEqual(1);
    expect(late.total).toBeGreaterThan(early.total * 4);
  });
});

describe('challenges', () => {
  it('rolls 3 distinct challenges deterministically per seed', () => {
    const a = new ChallengeSystem();
    const b = new ChallengeSystem();
    a.roll(new Rng(dailySeed(new Date(2026, 0, 1))));
    b.roll(new Rng(dailySeed(new Date(2026, 0, 1))));
    expect(a.active).toHaveLength(3);
    expect(a.active.map((c) => c.title)).toEqual(b.active.map((c) => c.title));
  });

  it('tracks progress and completion', () => {
    const c = new ChallengeSystem();
    c.roll(new Rng(1));
    c.active = [{ template: { kind: 'abduct_tag', tag: 'carro', title: () => '', goals: [2], reward: 10, weight: 1 }, kind: 'abduct_tag', title: 'x', goal: 2, progress: 0, done: false, reward: 10 }];
    let completed = 0;
    c.onComplete = () => completed++;
    c.onAbduct(['carro'], 1000);
    c.onAbduct(['moto'], 100);
    expect(c.active[0]!.progress).toBe(1);
    c.onAbduct(['carro'], 1000);
    expect(c.active[0]!.done).toBe(true);
    expect(completed).toBe(1);
    expect(c.completedRewards).toBe(10);
  });

  it('no-damage streak resets on damage', () => {
    const c = new ChallengeSystem();
    c.active = [{ template: { kind: 'no_damage_streak', title: () => '', goals: [3], reward: 5, weight: 1 }, kind: 'no_damage_streak', title: 'x', goal: 3, progress: 0, done: false, reward: 5 }];
    c.onAbduct([], 1);
    c.onAbduct([], 1);
    c.onDamage();
    c.onAbduct([], 1);
    expect(c.active[0]!.progress).toBe(2);
    expect(c.active[0]!.done).toBe(false);
  });
});

describe('daily seed', () => {
  it('is stable for the same day and different across days', () => {
    expect(dailySeed(new Date(2026, 5, 10, 8))).toBe(dailySeed(new Date(2026, 5, 10, 22)));
    expect(dailySeed(new Date(2026, 5, 10))).not.toBe(dailySeed(new Date(2026, 5, 11)));
  });
});
