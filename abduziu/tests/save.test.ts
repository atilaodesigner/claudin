import { describe, expect, it } from 'vitest';
import { META_NODES, metaCost } from '../src/config/meta';
import { MetaProgression } from '../src/progression/MetaProgression';
import { MemoryBackend } from '../src/save/SaveBackend';
import { defaultSave, migrate, SaveService } from '../src/save/SaveService';

describe('SaveService', () => {
  it('starts from defaults and round-trips through the backend', () => {
    const backend = new MemoryBackend();
    const a = new SaveService(backend);
    expect(a.get().cores).toBe(0);
    a.update((d) => {
      d.cores = 123;
      d.dex.lata = { count: 3, firstCaptureAt: 1, bestCombo: 9 };
      d.records.bestScore = 999;
    }, true);
    const b = new SaveService(backend);
    expect(b.get().cores).toBe(123);
    expect(b.get().dex.lata?.count).toBe(3);
    expect(b.get().records.bestScore).toBe(999);
  });

  it('survives corrupted data', () => {
    const backend = new MemoryBackend();
    backend.save('ovni-brasil:save', '{not json');
    expect(new SaveService(backend).get()).toEqual(defaultSave());
  });

  it('migrates partial/old saves by filling defaults', () => {
    const m = migrate({ cores: 50, settings: { musicVolume: 0.1 }, records: { bestScore: 10 } });
    expect(m.cores).toBe(50);
    expect(m.settings.musicVolume).toBe(0.1);
    expect(m.settings.sfxVolume).toBe(defaultSave().settings.sfxVolume);
    expect(m.records.bestScore).toBe(10);
    expect(m.records.fastestMaxAlert).toBeNull();
    expect(migrate({ cores: -5 }).cores).toBe(0);
  });

  it('export/import', () => {
    const s = new SaveService(new MemoryBackend());
    s.update((d) => (d.cores = 77), true);
    const json = s.export();
    const t = new SaveService(new MemoryBackend());
    expect(t.import(json)).toBe(true);
    expect(t.get().cores).toBe(77);
    expect(t.import('garbage')).toBe(false);
  });
});

describe('meta progression', () => {
  it('buys with cores, respects prerequisites and max level', () => {
    const save = new SaveService(new MemoryBackend());
    const meta = new MetaProgression(save);
    expect(meta.buy('feixe_forca')).toBe('cores');
    meta.addCores(10000);
    expect(meta.buy('feixe_raio')).toBe('locked');
    expect(meta.buy('feixe_forca')).toBe('ok');
    expect(meta.level('feixe_forca')).toBe(1);
    expect(meta.buy('feixe_raio')).toBe('ok');
    const node = META_NODES.find((n) => n.id === 'mov_dash')!;
    meta.buy('mov_velocidade');
    expect(meta.buy('mov_dash')).toBe('ok');
    expect(meta.buy('mov_dash')).toBe('max');
    expect(node.maxLevel).toBe(1);
  });

  it('costs grow per level and the next goal is the cheapest reachable node', () => {
    for (const n of META_NODES) if (n.maxLevel > 1) expect(metaCost(n, 1)).toBeGreaterThan(metaCost(n, 0));
    const meta = new MetaProgression(new SaveService(new MemoryBackend()));
    const goal = meta.nextGoal()!;
    expect(goal.missing).toBe(goal.cost);
    const cheapest = Math.min(...META_NODES.filter((n) => !n.requires).map((n) => metaCost(n, 0)));
    expect(goal.cost).toBe(cheapest);
  });
});
