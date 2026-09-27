import { COL } from './palette';
import { PROP_MODELS } from './props';
import { VEHICLE_MODELS } from './vehicles';
import type { ModelFn } from './types';

const HALF_PI = Math.PI / 2;

/** Secret and legendary objects: rare spawns designed to be shareable moments. */
export const SPECIAL_MODELS: Record<string, ModelFn> = {
  chicken_cosmic: (b, ctx) => {
    PROP_MODELS.chicken!(b, ctx);
    b.torus(0.32, 0.04, 6, 18, COL.alien, 0, 1.2, 0.28, { rx: HALF_PI, emit: 3, noAO: true })
      .ico(0.12, 0, 0x9d4dff, 0.4, 0.55, 0.1, { emit: 2, noAO: true });
  },
  cow_gold: (b) => {
    const g = COL.gold;
    const e = { emit: 0.35 };
    b.box(0.9, 0.85, 1.7, g, 0, 1.15, 0, e)
      .box(0.5, 0.55, 0.6, g, 0, 1.35, 1.05, e)
      .box(0.44, 0.24, 0.24, 0xffe8a3, 0, 1.18, 1.38, e)
      .cone(0.06, 0.22, 4, 0xffffff, 0.18, 1.72, 1.05)
      .cone(0.06, 0.22, 4, 0xffffff, -0.18, 1.72, 1.05);
    b.mirrorX((s) => {
      b.block(0.2, 0.75, 0.2, g, s * 0.3, 0, 0.6, e);
      b.block(0.2, 0.75, 0.2, g, s * 0.3, 0, -0.6, e);
    });
  },
  hatch_gold: (b, ctx) => {
    VEHICLE_MODELS.hatch!(b, ctx);
    b.box(1.9, 0.06, 4.1, COL.gold, 0, 0.25, 0, { emit: 0.8, noAO: true }).box(0.5, 0.35, 0.6, 0x111111, 0, 1.25, -1.6);
  },
  kombi_alien: (b, ctx) => {
    VEHICLE_MODELS.kombi!(b, ctx);
    b.quad(2.0, 0.5, COL.white, 0.935, 1.2, -0.3, { ry: HALF_PI, uv: ctx.atlas.get('believe') })
      .quad(2.0, 0.5, COL.white, -0.935, 1.2, -0.3, { ry: -HALF_PI, uv: ctx.atlas.get('believe') })
      .torus(1.2, 0.05, 6, 20, COL.alien, 0, 2.5, 0, { rx: HALF_PI, emit: 3, noAO: true })
      .sphere(0.3, 10, 6, COL.alien, 0, 2.3, 0, { emit: 2, noAO: true });
  },
  meteor: (b) => {
    b.dodeca(1.3, 0x3b3330, 0, 1.1, 0, { sy: 0.8 })
      .dodeca(0.9, 0x2a2422, 0.7, 0.9, 0.4)
      .ico(1.0, 0, 0xff6a00, 0, 1.0, 0, { sx: 1.05, sy: 0.7, sz: 1.05, emit: 3, noAO: true })
      .dodeca(1.32, 0x3b3330, 0, 1.12, 0, { sy: 0.78, ry: 0.6 });
  },
  statue: (b) => {
    const bronze = 0x5f8f7a;
    b.block(3, 3, 3, COL.concreteLight, 0, 0, 0)
      .block(2.2, 0.6, 2.2, COL.concrete, 0, 3, 0)
      .block(1.2, 2.2, 0.8, bronze, 0, 3.6, 0)
      .sphere(0.45, 10, 8, bronze, 0, 6.3, 0)
      .box(0.3, 2.2, 0.3, bronze, 0.55, 6.9, 0.2, { rz: -0.25 })
      .box(0.3, 1.6, 0.3, bronze, -0.7, 4.8, 0, { rz: 0.2 })
      .cone(0.8, 2.4, 8, bronze, 0, 4.4, 0);
  },
  secret_dish: (b) => {
    b.block(3, 2, 3, COL.concrete, 0, 0, 0)
      .cyl(0.5, 0.6, 5, 8, COL.metal, 0, 4.5, 0)
      .sphere(5, 16, 8, 0xe9ecef, 0, 8, 1.4, { sy: 0.35, rx: -0.6 })
      .cyl(0.08, 0.08, 3, 5, COL.metal, 0, 9, 2.6, { rx: -0.6 })
      .sphere(0.3, 8, 6, COL.alien, 0, 10.2, 3.4, { emit: 3, noAO: true });
  },
  truck_conspiracy: (b, ctx) => {
    VEHICLE_MODELS.truck!(b, ctx);
    b.quad(5.6, 1.2, COL.white, 1.26, 2.4, -0.8, { ry: HALF_PI, uv: ctx.atlas.get('conspiracy') })
      .quad(5.6, 1.2, COL.white, -1.26, 2.4, -0.8, { ry: -HALF_PI, uv: ctx.atlas.get('conspiracy') })
      .sphere(0.2, 8, 6, COL.alien, 0, 3.95, -3.9, { emit: 3, noAO: true });
  },
};
