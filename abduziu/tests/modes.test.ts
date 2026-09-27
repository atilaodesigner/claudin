import { describe, expect, it } from 'vitest';
import { CAMPAIGN, CITIES, getCity } from '../src/config/cities';
import { getObjectDef } from '../src/config/objects';
import { dailySetup, weekKey, weeklySetup } from '../src/config/modes';
import { applyCampaignRun, isUnlocked, totalStars } from '../src/progression/CampaignSystem';
import { ChallengeSystem } from '../src/progression/ChallengeSystem';
import { applyRp, DIVISIONS, divisionFor, RANK, rpDelta } from '../src/progression/RankSystem';
import { CityGrid } from '../src/world/CityGrid';

describe('ranked divisions', () => {
  it('divisions are ordered and the ladder starts at 0', () => {
    expect(DIVISIONS[0]?.min).toBe(0);
    for (let i = 1; i < DIVISIONS.length; i++) {
      expect(DIVISIONS[i]!.min).toBeGreaterThan(DIVISIONS[i - 1]!.min);
      expect(DIVISIONS[i]!.par).toBeGreaterThan(DIVISIONS[i - 1]!.par);
    }
  });

  it('scoring par with an extraction gains exactly the extraction bonus', () => {
    for (const d of DIVISIONS) expect(rpDelta(d.min, d.par, true)).toBe(RANK.extractBonus);
  });

  it('doubling the par is worth one step, dying costs points', () => {
    const d = DIVISIONS[1]!;
    expect(rpDelta(d.min, d.par * 2, true)).toBe(RANK.extractBonus + RANK.perDoubling);
    expect(rpDelta(d.min, d.par, false)).toBe(-RANK.deathPenalty);
  });

  it('deltas are clamped and RP never goes negative', () => {
    expect(rpDelta(0, 1e12, true)).toBe(RANK.maxDelta);
    expect(rpDelta(3000, 1, false)).toBe(RANK.minDelta);
    expect(applyRp(10, -40)).toBe(0);
  });

  it('division status reports progress to the next division', () => {
    const s = divisionFor(DIVISIONS[1]!.min + (DIVISIONS[2]!.min - DIVISIONS[1]!.min) / 2);
    expect(s.division.id).toBe(DIVISIONS[1]!.id);
    expect(s.progress).toBeCloseTo(0.5, 5);
    expect(divisionFor(1e9).next).toBeNull();
  });
});

describe('campaign', () => {
  it('only the first city is open on a fresh save', () => {
    expect(isUnlocked({}, CAMPAIGN[0]!.id)).toBe(true);
    expect(isUnlocked({}, CAMPAIGN[1]!.id)).toBe(false);
  });

  it('extracting unlocks the next city and pays new stars once', () => {
    const first = CAMPAIGN[0]!.id;
    const a = applyCampaignRun({}, first, [true, false, true], 1000, true);
    expect(a.firstClear).toBe(true);
    expect(a.newStars).toBe(2);
    expect(a.unlocked?.id).toBe(CAMPAIGN[1]!.id);
    const save = { [first]: a.progress };
    expect(isUnlocked(save, CAMPAIGN[1]!.id)).toBe(true);
    // a worse run keeps the stars and doesn't pay again
    const b = applyCampaignRun(save, first, [false, false, false], 10, false);
    expect(b.progress.stars).toEqual([true, false, true]);
    expect(b.newStars).toBe(0);
    expect(b.bonusCores).toBe(0);
    expect(b.progress.bestScore).toBe(1000);
    expect(totalStars({ [first]: b.progress })).toBe(2);
  });

  it('dying never unlocks the next city', () => {
    const r = applyCampaignRun({}, CAMPAIGN[0]!.id, [false, true, false], 500, false);
    expect(r.unlocked).toBeNull();
    expect(isUnlocked({ [CAMPAIGN[0]!.id]: r.progress }, CAMPAIGN[1]!.id)).toBe(false);
  });
});

describe('fixed star objectives', () => {
  it('abduct_id and extract objectives complete from their facts', () => {
    const c = new ChallengeSystem();
    c.setFixed(getCity('recife').stars);
    for (let i = 0; i < 5; i++) c.onAbduct(['movel'], 0.4, 'sombrinha_frevo');
    expect(c.active[1]!.done).toBe(true);
    expect(c.active[0]!.done).toBe(false);
    c.onExtracted();
    expect(c.active[0]!.done).toBe(true);
    c.onAbduct(['marco'], 60000, 'galo_gigante');
    expect(c.active.every((x) => x.done)).toBe(true);
  });
});

describe('cities', () => {
  it('every city is a valid grid with known objects and a dry start', () => {
    for (const city of CITIES) {
      const cols = city.layout[0]!.length;
      for (const row of city.layout) expect(row.length).toBe(cols);
      const grid = new CityGrid(city);
      expect(grid.cell(city.start.col, city.start.row)).not.toBeNull();
      expect(grid.isWet(grid.cell(city.start.col, city.start.row))).toBe(false);
      for (const lm of city.landmarks) {
        expect(city.layout[lm.row]![lm.col]).toBe('L');
        expect(() => getObjectDef(lm.id)).not.toThrow();
      }
      for (const s of city.stars) if (s.objectId) expect(() => getObjectDef(s.objectId!)).not.toThrow();
      expect(() => getObjectDef(city.secret)).not.toThrow();
      expect(city.signs.length === 0 || city.signs.length === 16).toBe(true);
    }
  });

  it('roads stop at the water unless a bridge carries them', () => {
    const recife = new CityGrid(getCity('recife'));
    const B = 58;
    // row 2 is the Capibaribe: line 2 is a bridge, line 3 is not
    const zRiver = recife.centerZ(2);
    expect(recife.isRoadAt(-recife.halfW + 2 * B, zRiver)).toBe(true);
    expect(recife.isRoadAt(-recife.halfW + 3 * B, zRiver)).toBe(false);
    expect(recife.isWaterAt(recife.centerX(3), zRiver)).toBe(true);
    // the riverside avenue exists
    expect(recife.isRoadAt(recife.centerX(3), -recife.halfH + 3 * B)).toBe(true);
    // sea beyond the east edge, beach sand is not water
    expect(recife.isWaterAt(recife.halfW + 200, 0)).toBe(true);
    expect(recife.isWaterAt(recife.centerX(6), recife.centerZ(5))).toBe(false);
    expect(recife.groundAt(recife.centerX(3), zRiver)).toBeLessThan(0);
  });
});

describe('shared maps', () => {
  it('weekly and daily setups are deterministic for everyone', () => {
    const d = new Date(2026, 8, 27);
    expect(weekKey(d)).toBe('2026-W39');
    expect(weeklySetup(d)).toEqual(weeklySetup(new Date(2026, 8, 23)));
    expect(weeklySetup(d).city).not.toBe('nova_aurora');
    expect(dailySetup(42, d)).toEqual(dailySetup(42, new Date(2026, 8, 27, 23, 0)));
  });
});
