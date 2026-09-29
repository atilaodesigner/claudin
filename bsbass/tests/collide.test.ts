import { describe, expect, it } from 'vitest';
import { circle, collide, rect, resolve, SpatialGrid, type Shape } from '../src/physics/collide';

describe('colisão', () => {
  it('retângulos separados não colidem', () => {
    expect(collide(rect(0, 0, 1, 2), rect(5, 0, 1, 2))).toBeNull();
  });

  it('normal aponta de B pra A e profundidade certa', () => {
    const c = collide(rect(0, 0, 1, 2), rect(1.5, 0, 1, 2))!;
    expect(c).not.toBeNull();
    expect(c.nx).toBeCloseTo(-1);
    expect(c.depth).toBeCloseTo(0.5);
  });

  it('retângulo girado contra círculo (poste)', () => {
    const c = collide(rect(0, 0, 1, 2, Math.PI / 4), circle(0, 1.8, 0.3));
    expect(c).not.toBeNull();
    expect(c!.nz).toBeLessThan(0);
  });

  it('bater de frente na parede devolve a velocidade e para de entrar', () => {
    const body = { x: 0, z: 0, vx: 0, vz: 20, yawRate: 0 };
    const c = collide(rect(0, 0, 1, 2), rect(0, 2.5, 5, 1))!;
    const impact = resolve(body, 1500, 2500, c, 0.2, 0.3);
    expect(impact).toBeGreaterThan(19);
    expect(body.vz).toBeLessThan(0);
    expect(body.z).toBeLessThan(0);
  });

  it('batida de quina gera giro', () => {
    const body = { x: 0, z: 0, vx: 0, vz: 15, yawRate: 0 };
    const c = collide(rect(0, 0, 1, 2), rect(1.6, 2.9, 1, 1))!;
    resolve(body, 1500, 2500, c);
    expect(Math.abs(body.yawRate)).toBeGreaterThan(0.1);
  });

  it('grade espacial encontra só os vizinhos', () => {
    const g = new SpatialGrid<Shape>(16);
    const a = rect(0, 0, 1, 1), b = circle(100, 100, 1);
    g.insert(a);
    g.insert(b);
    expect(g.near(-5, -5, 5, 5)).toEqual([a]);
    expect(g.near(95, 95, 105, 105)).toEqual([b]);
  });
});
