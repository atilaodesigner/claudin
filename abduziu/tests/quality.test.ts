import { describe, expect, it } from 'vitest';
import { AdaptiveQualityManager, QUALITY_LEVELS, type DeviceProfile } from '../src/performance/AdaptiveQualityManager';

const profile: DeviceProfile = { mobile: true, lowEnd: false, multiDraw: true, initialLevel: 2 };

function make(): { q: AdaptiveQualityManager; applied: Array<{ level: string; scale: number; changed: boolean }> } {
  const q = new AdaptiveQualityManager(profile);
  const applied: Array<{ level: string; scale: number; changed: boolean }> = [];
  q.onApply = (lv, scale, changed) => applied.push({ level: lv.name, scale, changed });
  return { q, applied };
}

function run(q: AdaptiveQualityManager, seconds: number, dt: number, canChange: boolean, inPlay: boolean): void {
  for (let t = 0; t < seconds; t += dt) q.sample(dt, canChange, inPlay);
}

describe('adaptive quality', () => {
  it('stays put on a smooth 60 fps run', () => {
    const { q, applied } = make();
    run(q, 30, 1 / 60, false, true);
    expect(applied).toHaveLength(0);
    expect(q.level).toBe(2);
  });

  it('drowning mid-run drops resolution, then the level, without waiting for the menu', () => {
    const { q, applied } = make();
    run(q, 5, 1 / 60, false, true); // past the warm-up
    run(q, 60, 1 / 12, false, true); // 12 fps, never a calm moment
    expect(applied.some((a) => !a.changed && a.scale < QUALITY_LEVELS[2]!.maxScale)).toBe(true);
    expect(applied.some((a) => a.changed)).toBe(true);
    expect(q.level).toBeLessThan(2);
  });

  it('repeated hitches count as overload', () => {
    const { q, applied } = make();
    run(q, 5, 1 / 60, false, true);
    for (let i = 0; i < 5; i++) {
      q.sample(0.18, false, true);
      run(q, 0.5, 1 / 60, false, true);
    }
    expect(applied.length).toBeGreaterThan(0);
  });

  it('ignores hitches while loading, in menus and in the first seconds of a run', () => {
    const { q, applied } = make();
    for (let i = 0; i < 10; i++) q.sample(0.4, true, false); // loading / shader warm-up in the menu
    run(q, 1, 1 / 60, false, true);
    for (let i = 0; i < 6; i++) q.sample(0.15, false, true); // warm-up right after the run starts
    run(q, 10, 1 / 60, false, true);
    expect(applied).toHaveLength(0);
  });

  it('a hidden tab (seconds-long gap) is not a hitch', () => {
    const { q, applied } = make();
    run(q, 5, 1 / 60, false, true);
    for (let i = 0; i < 6; i++) {
      q.sample(30, false, true);
      run(q, 5, 1 / 60, false, true);
    }
    expect(applied).toHaveLength(0);
  });

  it('does not touch a quality the player chose', () => {
    const { q, applied } = make();
    q.setPreset('alta');
    applied.length = 0;
    run(q, 5, 1 / 60, false, true);
    run(q, 30, 1 / 12, false, true);
    expect(applied).toHaveLength(0);
    expect(q.level).toBe(3);
  });
});
