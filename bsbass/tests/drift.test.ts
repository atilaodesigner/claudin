import { describe, expect, it } from 'vitest';
import { DriftScorer, GRACE, MULT_STEP, bankLabel } from '../src/score/drift';

const drift = { speedKmh: 80, angleDeg: 40, forward: true, surface: 1 };
const straight = { speedKmh: 80, angleDeg: 2, forward: true, surface: 1 };

function run(s: DriftScorer, sample: typeof drift, seconds: number) {
  const ev = [];
  for (let t = 0; t < seconds; t += 1 / 60) ev.push(...s.update(1 / 60, sample));
  return ev;
}

describe('DriftScorer', () => {
  it('acumula pontos só quando está de lado e rápido', () => {
    const s = new DriftScorer();
    run(s, straight, 2);
    expect(s.chain).toBe(0);
    run(s, { ...drift, speedKmh: 15 }, 1);
    expect(s.chain).toBe(0);
    run(s, drift, 1);
    expect(s.chain).toBeGreaterThan(0);
  });

  it('sobe o multiplicador com o tempo de drift', () => {
    const s = new DriftScorer();
    const ev = run(s, drift, MULT_STEP * 2 + 0.1);
    expect(s.mult).toBe(3);
    expect(ev.filter((e) => e.type === 'mult')).toHaveLength(2);
  });

  it('guarda o combo depois da janela de tolerância', () => {
    const s = new DriftScorer();
    run(s, drift, 3);
    const value = s.chainValue;
    const before = run(s, straight, GRACE - 0.2);
    expect(before.some((e) => e.type === 'bank')).toBe(false);
    const after = run(s, straight, 0.5);
    const bank = after.find((e) => e.type === 'bank');
    expect(bank && bank.type === 'bank' && bank.points).toBe(value);
    expect(s.total).toBe(value);
    expect(s.best).toBe(value);
    expect(s.active).toBe(false);
  });

  it('emendar drifts dentro da janela mantém o combo', () => {
    const s = new DriftScorer();
    run(s, drift, 2);
    run(s, straight, GRACE * 0.6);
    run(s, drift, 2);
    expect(s.driftTime).toBeGreaterThan(3.9);
    expect(s.total).toBe(0);
  });

  it('bater perde o combo inteiro', () => {
    const s = new DriftScorer();
    run(s, drift, 4);
    const e = s.crash();
    expect(e?.type).toBe('lost');
    expect(s.total).toBe(0);
    expect(s.chain).toBe(0);
    expect(s.crash()).toBeNull();
  });

  it('raspar no tráfego só vale durante o combo', () => {
    const s = new DriftScorer();
    expect(s.nearMiss()).toBeNull();
    run(s, drift, 0.5);
    const c = s.chain;
    expect(s.nearMiss()?.type).toBe('nearMiss');
    expect(s.chain).toBeGreaterThan(c);
  });

  it('rótulos por faixa de pontos', () => {
    expect(bankLabel(100)).toBe('DE LADO!');
    expect(bankLabel(6000)).toBe('MASSA DEMAIS!');
    expect(bankLabel(200000)).toBe('LENDA DO DF!');
  });
});
