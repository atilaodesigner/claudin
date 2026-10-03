import { describe, expect, it } from 'vitest';
import { BEAMS, BOT_SKINS, SKINS, SKIN_BY_ID, TOPPER_NAMES, beamColorAt } from '../src/config/cosmetics';

describe('cosmetics', () => {
  it('has unique, url-safe ids', () => {
    const ids = SKINS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [...ids, ...BEAMS.map((b) => b.id)]) expect(id).toMatch(/^[a-z0-9_]+$/);
  });

  it('gives every painted skin a palette and every topper a shop name', () => {
    for (const s of SKINS) {
      if (s.pattern) expect(s.patternColors?.length ?? 0).toBeGreaterThan(0);
      if (s.topper) expect(TOPPER_NAMES[s.topper]).toBeTruthy();
    }
  });

  it('has a real memes shelf, priced above the starter looks', () => {
    const memes = SKINS.filter((s) => s.meme);
    expect(memes.length).toBeGreaterThanOrEqual(20);
    for (const m of memes) expect(m.price).toBeGreaterThanOrEqual(40_000);
  });

  it('gates super classes by score', () => {
    for (const s of SKINS.filter((s) => s.tier === 'super')) expect(s.minScore ?? 0).toBeGreaterThan(0);
  });

  it('only dresses bots in skins that exist', () => {
    for (const id of BOT_SKINS) expect(SKIN_BY_ID.has(id)).toBe(true);
  });

  it('keeps animated beam colours valid', () => {
    for (const b of BEAMS) {
      for (const t of [0, 0.7, 3.3, 12.9]) {
        const c = beamColorAt(b, t);
        expect(Number.isInteger(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(0xffffff);
      }
    }
  });
});
