import { describe, expect, it } from 'vitest';
import { ROUTES, buildRoute, frameAt, project, wrapS } from '../src/campaign/routes';
import { blockKind, buildCity } from '../src/world/city';
import { collide, rect } from '../src/physics/collide';

describe('trajetos dos capítulos', () => {
  const routes = ROUTES.map((d) => buildRoute(d, blockKind));

  it('fecham, têm tamanho de circuito e curvas numeradas como o original', () => {
    for (const r of routes) {
      expect(r.n).toBeGreaterThan(1100);
      expect(r.n).toBeLessThan(2100);
      expect(r.curveCount).toBeGreaterThanOrEqual(10);
      // fecha: o último metro encosta no primeiro
      const d = Math.hypot(r.P[(r.n - 1) * 2]! - r.P[0]!, r.P[(r.n - 1) * 2 + 1]! - r.P[1]!);
      expect(d).toBeLessThan(1.5);
    }
  });

  it('pontos dos capítulos ficam longe uns dos outros', () => {
    for (let a = 0; a < routes.length; a++)
      for (let b = a + 1; b < routes.length; b++) {
        const pa = routes[a]!.point, pb = routes[b]!.point;
        expect(Math.hypot(pa.x - pb.x, pa.z - pb.z)).toBeGreaterThan(300);
      }
  });

  it('a pista não atravessa prédio nem carro estacionado', () => {
    const city = buildCity();
    const f = { x: 0, z: 0, fx: 0, fz: 1, rx: -1, rz: 0 };
    for (const r of routes) {
      for (let s = 0; s < r.n; s += 2) {
        frameAt(r, s, f);
        for (const lat of [-7, 0, 7]) {
          const probe = rect(f.x + f.rx * lat, f.z + f.rz * lat, 1, 1);
          const hit = city.colliders.find((c) => collide(probe, c));
          expect(hit, `rota ${r.def.chapter + 1} s=${s} x=${lat}`).toBeUndefined();
        }
      }
    }
  }, 20000); // monta a cidade inteira: lento em máquina fraca

  it('projeção devolve o s e o x certos', () => {
    const r = routes[0]!;
    const f = { x: 0, z: 0, fx: 0, fz: 1, rx: -1, rz: 0 };
    frameAt(r, 300, f);
    const p = project(r, f.x + f.rx * 4, f.z + f.rz * 4, 290);
    expect(wrapS(r, p.s)).toBeCloseTo(300, 0);
    expect(p.x).toBeCloseTo(4, 1);
  });
});
