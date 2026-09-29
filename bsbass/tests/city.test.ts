import { describe, expect, it } from 'vitest';
import { buildCity, nearestLane, surfaceAt, BALAO } from '../src/world/city';
import { collide, rect } from '../src/physics/collide';
import { CAR } from '../src/physics/car';

describe('cidade', () => {
  const city = buildCity();

  it('é determinística', () => {
    const b = buildCity();
    expect(b.lots.length).toBe(city.lots.length);
    expect(b.colliders.length).toBe(city.colliders.length);
    expect(b.lots[10]).toEqual(city.lots[10]);
  });

  it('tem casas, postes, placas e carros estacionados', () => {
    expect(city.lots.length).toBeGreaterThan(800);
    expect(city.lamps.length).toBeGreaterThan(200);
    expect(city.parked.length).toBeGreaterThan(15);
    expect(city.signs.length).toBeGreaterThan(5);
  });

  it('o respawn cai numa faixa livre', () => {
    for (const [x, z] of [[-260, 5], [120, -333], [0, 0], [399, 399], [-50, 180]] as const) {
      const p = nearestLane(x, z);
      const car = rect(p.x, p.z, CAR.halfWidth, CAR.halfLength, p.heading);
      const hits = city.colliders.filter((c) => collide(car, c));
      expect(hits, `respawn em ${x},${z}`).toHaveLength(0);
    }
  });

  it('terrão tem menos aderência que o asfalto', () => {
    const t = city.blocks.find((b) => b.kind === 'terrao')!;
    expect(surfaceAt(city, t.x, t.z).grip).toBeLessThan(0.8);
    expect(surfaceAt(city, t.x, t.z).dirt).toBe(true);
    expect(surfaceAt(city, t.x + 50, t.z).grip).toBe(1);
  });

  it('nenhuma casa invade o balão', () => {
    for (const l of city.lots) expect(Math.hypot(l.x - BALAO.x, l.z - BALAO.z)).toBeGreaterThan(BALAO.ring);
  });
});
