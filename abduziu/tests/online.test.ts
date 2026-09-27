import { describe, expect, it } from 'vitest';
import { rpDelta } from '../src/progression/RankSystem';
import { cloudWins, defaultSave } from '../src/save/SaveService';

describe('cloud save', () => {
  it('keeps the more progressed save', () => {
    const local = defaultSave();
    const cloud = defaultSave();
    expect(cloudWins(local, cloud)).toBe(false);
    cloud.records.totalRuns = 12;
    expect(cloudWins(local, cloud)).toBe(true);
    local.records.totalRuns = 30;
    expect(cloudWins(local, cloud)).toBe(false);
    cloud.records.totalRuns = 30;
    cloud.totalCoresEarned = 500;
    expect(cloudWins(local, cloud)).toBe(true);
  });
});

describe('ranked RP parity with supabase submit_ranked_run', () => {
  // values checked against the SQL function on the live project
  it('matches the server for the reference runs', () => {
    expect(rpDelta(0, 800_000, true)).toBe(35);
    expect(rpDelta(0, 200_000, false)).toBe(-35);
  });
  it('stays inside the server clamp', () => {
    expect(rpDelta(0, 1e9, true)).toBe(60);
    expect(rpDelta(2400, 1, false)).toBe(-40);
  });
});
