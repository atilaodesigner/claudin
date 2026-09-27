import { describe, expect, it } from 'vitest';
import { UPGRADES, UPGRADE_BY_ID, SYNERGIES } from '../src/config/upgrades';
import { findNewSynergies, synergyProgress } from '../src/progression/SynergySystem';
import { UpgradeSystem } from '../src/progression/UpgradeSystem';
import { UFOStats } from '../src/ufo/UFOStats';
import { Rng } from '../src/utils/rng';

const baseInputs = (u: UpgradeSystem) => ({ upgrades: u, meta: {}, matterTier: 1, frenzy: false, chainStacks: 0, perfectDodgeBuff: false, stillFactor: 0, maxBeam: false });

describe('upgrade cards', () => {
  it('offers 3 distinct, valid cards', () => {
    const u = new UpgradeSystem();
    const offers = u.rollOffers(new Rng(42), 10);
    expect(offers).toHaveLength(3);
    expect(new Set(offers.map((o) => o.id)).size).toBe(3);
    for (const o of offers) expect(o.nextLevel).toBe(1);
  });

  it('respects minimum player level', () => {
    const u = new UpgradeSystem();
    for (let seed = 0; seed < 50; seed++) {
      for (const o of u.rollOffers(new Rng(seed), 1)) expect(o.def.minPlayerLevel ?? 0).toBeLessThanOrEqual(1);
    }
  });

  it('never offers maxed upgrades', () => {
    const u = new UpgradeSystem();
    const def = UPGRADE_BY_ID.get('gravidade_bruta')!;
    for (let i = 0; i < def.maxLevel; i++) u.apply({ id: 'gravidade_bruta', enhanced: false });
    for (let seed = 0; seed < 60; seed++) {
      expect(u.rollOffers(new Rng(seed), 30).some((o) => o.id === 'gravidade_bruta')).toBe(false);
    }
  });

  it('enhanced cards grant two levels (clamped to max)', () => {
    const u = new UpgradeSystem();
    expect(u.apply({ id: 'campo_maior', enhanced: true }).level).toBe(2);
    const max = UPGRADE_BY_ID.get('feixe_duplo')!.maxLevel;
    for (let i = 0; i < 5; i++) u.apply({ id: 'feixe_duplo', enhanced: true });
    expect(u.level('feixe_duplo')).toBe(max);
  });

  it('three core upgrades change the ship stats', () => {
    const u = new UpgradeSystem();
    const s = new UFOStats();
    s.compute(baseInputs(u));
    const before = { tier: s.beamTier, radius: s.beamRadius, speed: s.absorbSpeed };
    u.apply({ id: 'gravidade_bruta', enhanced: false });
    u.apply({ id: 'campo_maior', enhanced: false });
    u.apply({ id: 'processamento', enhanced: false });
    s.compute(baseInputs(u));
    expect(s.beamTier).toBeGreaterThan(before.tier);
    expect(s.beamRadius).toBeCloseTo(before.radius * 1.2, 5);
    expect(s.absorbSpeed).toBeCloseTo(before.speed * 1.3, 5);
  });

  it('all upgrades have descriptions for every level', () => {
    for (const u of UPGRADES) for (let l = 1; l <= u.maxLevel; l++) expect(u.describe(l).length).toBeGreaterThan(5);
  });
});

describe('synergies', () => {
  it('SINGULARIDADE unlocks with Buraco Negro III + Campo Maior III + Gravidade Bruta III', () => {
    const u = new UpgradeSystem();
    const got: string[] = [];
    for (let i = 0; i < 3; i++) {
      got.push(...u.apply({ id: 'buraco_negro', enhanced: false }).newSynergies);
      got.push(...u.apply({ id: 'campo_maior', enhanced: false }).newSynergies);
    }
    expect(got).not.toContain('singularidade');
    for (let i = 0; i < 3; i++) got.push(...u.apply({ id: 'gravidade_bruta', enhanced: false }).newSynergies);
    expect(got).toContain('singularidade');
    expect(u.has('singularidade')).toBe(true);
    const s = new UFOStats();
    s.compute(baseInputs(u));
    expect(s.orbitAlways).toBe(true);
  });

  it('TEMPESTADE MAGNÉTICA and COLHEITA INDUSTRIAL are reachable', () => {
    const levels = new Map([
      ['pulso_emp', 3],
      ['escudo', 3],
      ['feixe_duplo', 3],
      ['processamento', 3],
    ] as const);
    const found = findNewSynergies(levels as never, new Set());
    expect(found).toContain('tempestade_magnetica');
    expect(found).toContain('colheita_industrial');
  });

  it('progress helper reports partial completion', () => {
    const levels = new Map([['buraco_negro', 3]] as const);
    expect(synergyProgress('singularidade', levels as never)).toBeCloseTo(3 / 9, 5);
    expect(SYNERGIES.length).toBeGreaterThanOrEqual(3);
  });
});
