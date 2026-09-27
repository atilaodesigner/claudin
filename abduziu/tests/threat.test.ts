import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/gameBalance';
import { alertFromThreat, MAX_ALERT, ThreatSystem } from '../src/progression/ThreatSystem';

describe('threat & alert progression', () => {
  it('maps thresholds to alert levels 0..6', () => {
    const th = BALANCE.threat.alertThresholds;
    expect(alertFromThreat(0)).toBe(0);
    for (let i = 1; i < th.length; i++) {
      expect(alertFromThreat(th[i]!)).toBe(i);
      expect(alertFromThreat(th[i]! - 0.001)).toBe(i - 1);
    }
    expect(MAX_ALERT).toBe(6);
  });

  it('reports only increases and never decreases', () => {
    const t = new ThreatSystem();
    t.passive = false;
    expect(t.add(BALANCE.threat.alertThresholds[1]!)).toBe(1);
    expect(t.add(0.1)).toBeNull();
    expect(t.alert).toBe(1);
    t.update(100, 10);
    expect(t.alert).toBe(1);
  });

  it('passive growth escalates slowly even without abductions', () => {
    const t = new ThreatSystem();
    let level = 0;
    for (let s = 0; s < 200; s++) {
      const r = t.update(1, s);
      if (r !== null) level = r;
    }
    expect(level).toBeGreaterThanOrEqual(2);
    expect(t.alert).toBeLessThan(4);
  });

  it('tracks time at max alert and the first time it was reached', () => {
    const t = new ThreatSystem();
    t.add(1e6, 123);
    expect(t.alert).toBe(MAX_ALERT);
    expect(t.timeReachedMax).toBe(123);
    t.update(5, 128);
    expect(t.timeAtMaxAlert).toBeCloseTo(5);
    expect(t.progress).toBe(1);
  });

  it('first minute choreography: police, drones and helicopter within ~60s of normal play', () => {
    // nominal early intake: ~0.6 matter/s
    const t = new ThreatSystem();
    const reached: Record<number, number> = {};
    for (let s = 0; s <= 70; s++) {
      t.add(0.62 * BALANCE.threat.perMatter, s);
      t.update(1, s);
      if (reached[t.alert] === undefined) reached[t.alert] = s;
    }
    expect(reached[1]).toBeLessThan(35);
    expect(reached[2]).toBeLessThan(55);
    expect(reached[3]).toBeLessThan(70);
  });
});
