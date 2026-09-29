import { describe, expect, it } from 'vitest';
import { BSB } from '../src/campaign/core.js';

describe('núcleo do BSBASS THE GAME', () => {
  it('mantém os 5 capítulos na ordem original', () => {
    expect(BSB.CHAPTERS.map((c) => c.title)).toEqual(['Na Mira', 'O Corre', 'A Carga', 'No Retrovisor', 'Sumir na Noite']);
    expect(BSB.CHAPTERS.map((c) => c.reward)).toEqual([120, 160, 200, 240, 300]);
  });

  it('destranca em ordem e salva concluída, melhor pontuação e estrelas', () => {
    const d = BSB.defaultSave();
    expect(BSB.chapterUnlocked(d, 0)).toBe(true);
    expect(BSB.chapterUnlocked(d, 1)).toBe(false);
    const ap = BSB.applyResult(d, 0, { win: true, score: 3000, bestMult: 3, driftTime: 20, heavyHits: 0, nearMisses: 0 }, 'run1');
    expect(ap.firstClear).toBe(true);
    expect(d.chapters.c1).toEqual({ done: true, stars: [true, true, true], best: 3000 });
    expect(BSB.chapterUnlocked(d, 1)).toBe(true);
    // mesma corrida não conta duas vezes
    expect(BSB.applyResult(d, 0, { win: true, score: 3000 }, 'run1').duplicate).toBe(true);
  });

  it('pontua drift válido e perde o combo na batida forte', () => {
    const s = BSB.DriftScorer();
    for (let i = 0; i < 120; i++) s.update({ dt: 1 / 60, speed: 25, slip: 30, progress: 20, colliding: false, curveId: 0, dir: 1, lap: 0, zone: 1 });
    expect(s.state.pending).toBeGreaterThan(100);
    expect(s.hit(20)).toBe('heavy');
    expect(s.state.pending).toBe(0);
  });
});
