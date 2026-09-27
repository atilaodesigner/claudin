import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/gameBalance';
import { levelFromXp, matterForTier, matterForTierThreshold, RunProgression, tierFromMatter, xpForLevel } from '../src/progression/RunProgression';

describe('XP and levels', () => {
  it('level 1 needs no XP and thresholds grow monotonically', () => {
    expect(xpForLevel(1)).toBe(0);
    let prev = 0;
    for (let l = 2; l < 40; l++) {
      const xp = xpForLevel(l);
      expect(xp).toBeGreaterThan(prev);
      prev = xp;
    }
  });

  it('levelFromXp is the inverse of xpForLevel at exact thresholds', () => {
    for (let l = 1; l < 40; l++) {
      expect(levelFromXp(xpForLevel(l))).toBe(l);
      expect(levelFromXp(xpForLevel(l + 1) - 0.001)).toBe(l);
    }
  });

  it('first level-up happens quickly (tutorial pacing)', () => {
    // a handful of cans and chairs should level you up
    const perSmall = matterForTier(0.5);
    expect(xpForLevel(2) / perSmall).toBeLessThan(15);
  });

  it('RunProgression counts pending level ups (multi-level jumps)', () => {
    const p = new RunProgression();
    expect(p.addMatter(xpForLevel(4))).toBe(3);
    expect(p.level).toBe(4);
    expect(p.pendingLevelUps).toBe(3);
    expect(p.addMatter(0)).toBe(0);
    expect(p.levelProgress).toBeGreaterThanOrEqual(0);
    expect(p.levelProgress).toBeLessThan(1);
  });
});

describe('mass tiers', () => {
  it('starts at tier 1 (cans, chairs, dogs)', () => {
    expect(tierFromMatter(0)).toBe(1);
    expect(Math.floor(tierFromMatter(BALANCE.tierMatterThresholds[2]! - 0.01))).toBe(1);
    expect(Math.floor(tierFromMatter(BALANCE.tierMatterThresholds[2]!))).toBe(2);
  });

  it('is continuous and monotonic, extrapolating past the table', () => {
    let prev = 0;
    for (let m = 0; m < 40000; m += 37) {
      const t = tierFromMatter(m);
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
    expect(tierFromMatter(30000)).toBeGreaterThan(11);
  });

  it('matterForTierThreshold matches the table', () => {
    for (let t = 2; t < BALANCE.tierMatterThresholds.length; t++) {
      expect(matterForTierThreshold(t)).toBe(BALANCE.tierMatterThresholds[t]);
      expect(Math.floor(tierFromMatter(matterForTierThreshold(t)) + 1e-9)).toBe(t);
    }
  });

  it('heavier tiers give exponentially more matter', () => {
    expect(matterForTier(3) / matterForTier(2)).toBeCloseTo(BALANCE.matterGrowth, 5);
    expect(matterForTier(8)).toBeGreaterThan(matterForTier(3) * 10);
  });
});
