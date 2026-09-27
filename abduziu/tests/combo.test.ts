import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/gameBalance';
import { ComboSystem } from '../src/progression/ComboSystem';

describe('ABDUCTION COMBO', () => {
  it('chains absorptions inside the window', () => {
    const c = new ComboSystem();
    c.register(0);
    c.update(1);
    c.register(0);
    expect(c.count).toBe(2);
    expect(c.multiplier).toBeGreaterThan(1);
  });

  it('breaks after the window and reports the final count', () => {
    const c = new ComboSystem();
    for (let i = 0; i < 7; i++) c.register(1);
    const r = c.update(BALANCE.combo.maxWindow + 1);
    expect(r.endedWith).toBe(7);
    expect(c.count).toBe(0);
    expect(c.best).toBe(7);
  });

  it('heavier objects extend the window', () => {
    const a = new ComboSystem();
    a.register(0);
    const b = new ComboSystem();
    b.register(8);
    expect(b.window).toBeGreaterThan(a.window);
  });

  it('reports milestones and triggers FRENZY at x50', () => {
    const c = new ComboSystem();
    const milestones: number[] = [];
    let frenzyAt = -1;
    for (let i = 1; i <= 60; i++) {
      const r = c.register(1);
      if (r.milestone) milestones.push(r.milestone);
      if (r.frenzyStarted) frenzyAt = i;
      c.update(0.1);
    }
    expect(milestones).toEqual([5, 10, 20, 30, 50]);
    expect(frenzyAt).toBe(BALANCE.combo.frenzyAt);
    expect(c.frenzy).toBe(true);
  });

  it('frenzy expires after its duration', () => {
    const c = new ComboSystem();
    c.forceFrenzy();
    c.register(1);
    let ended = false;
    for (let t = 0; t < BALANCE.combo.frenzyDuration + 1; t += 0.5) {
      c.register(1);
      if (c.update(0.5).frenzyEnded) ended = true;
    }
    expect(ended).toBe(true);
    expect(c.frenzy).toBe(false);
  });

  it('multiplier is capped', () => {
    const c = new ComboSystem();
    for (let i = 0; i < 1000; i++) c.register(0);
    expect(c.multiplier).toBe(BALANCE.combo.maxMultiplier);
  });
});
