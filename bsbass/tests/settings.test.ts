import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, PRESETS, autoPreset, loadSettings, lowerPreset } from '../src/settings';

describe('configurações', () => {
  it('sem localStorage cai no padrão (auto)', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('presets ficam mais caros do baixo pro ultra', () => {
    const order = ['baixa', 'media', 'alta', 'ultra'] as const;
    for (let i = 1; i < order.length; i++) {
      const a = PRESETS[order[i - 1]!], b = PRESETS[order[i]!];
      expect(b.pixelRatio).toBeGreaterThanOrEqual(a.pixelRatio);
      expect(b.reflection).toBeGreaterThanOrEqual(a.reflection);
      expect(b.lamps + b.neon).toBeGreaterThanOrEqual(a.lamps + a.neon);
    }
    expect(PRESETS.baixa.reflection).toBe(0);
  });

  it('auto desce um degrau por vez até o baixo', () => {
    expect(autoPreset(true)).toBe('media');
    expect(autoPreset(false)).toBe('alta');
    expect(lowerPreset('ultra')).toBe('alta');
    expect(lowerPreset('media')).toBe('baixa');
    expect(lowerPreset('baixa')).toBeNull();
  });
});
