import { COL } from './palette';
import type { ModelFn } from './types';

const HALF_PI = Math.PI / 2;

/** Força Sentinela (fictional). Models face +Z. */
export const MILITARY_MODELS: Record<string, ModelFn> = {
  drone: (b) => {
    b.box(0.9, 0.28, 0.9, COL.sentinel, 0, 0.6, 0)
      .sphere(0.26, 10, 6, 0x111827, 0, 0.45, 0.32, { sy: 0.8 })
      .sphere(0.08, 8, 6, 0xff3b30, 0, 0.45, 0.55, { emit: 3, noAO: true });
    const arms: Array<[number, number]> = [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ];
    for (const [sx, sz] of arms) {
      b.strut(0, 0.62, 0, sx * 0.8, 0.66, sz * 0.8, 0.06, COL.sentinelLight);
      b.cyl(0.08, 0.08, 0.14, 6, COL.darkMetal, sx * 0.8, 0.72, sz * 0.8);
      b.cyl(0.42, 0.42, 0.02, 12, 0xc9d6e3, sx * 0.8, 0.8, sz * 0.8, { noAO: true });
    }
    b.box(0.5, 0.04, 0.04, 0x7df9ff, 0, 0.76, -0.46, { emit: 2, noAO: true });
  },
  helicopter: (b, ctx) => {
    b.sphere(1.5, 14, 10, COL.sentinel, 0, 1.9, 0.8, { sz: 1.45, sy: 0.95 })
      .sphere(1.2, 12, 8, 0x1f3342, 0, 2.2, 1.9, { sx: 0.95, sy: 0.8, sz: 0.8, noAO: true })
      .cyl(0.35, 0.6, 5.2, 8, COL.sentinel, 0, 2.2, -2.8, { rx: HALF_PI })
      .box(0.1, 1.4, 0.9, COL.sentinel, 0, 2.8, -5.2)
      .cyl(0.7, 0.7, 0.06, 10, 0xc9d6e3, 0.14, 2.9, -5.2, { rz: HALF_PI, noAO: true })
      .box(2.2, 0.08, 0.5, COL.sentinel, 0, 2.2, -4.6)
      .cyl(0.2, 0.25, 0.5, 8, COL.darkMetal, 0, 3.05, 0.6)
      .box(0.25, 0.08, 10, 0x2b2f36, 0, 3.35, 0.6, { ry: 0.5 })
      .box(0.25, 0.08, 10, 0x2b2f36, 0, 3.36, 0.6, { ry: 0.5 + HALF_PI })
      .quad(1.6, 0.34, COL.white, 1.45, 1.9, 0.4, { ry: HALF_PI, uv: ctx.atlas.get('sentinela') })
      .sphere(0.12, 6, 4, 0xff3b30, 0, 3.3, -5.3, { emit: 3, noAO: true });
    b.mirrorX((s) => {
      b.strut(s * 0.8, 0.9, 1.6, s * 1.2, 0.2, 1.6, 0.06, COL.darkMetal);
      b.strut(s * 0.8, 0.9, -0.2, s * 1.2, 0.2, -0.2, 0.06, COL.darkMetal);
      b.box(0.1, 0.1, 3.0, COL.darkMetal, s * 1.2, 0.2, 0.7);
      b.cyl(0.18, 0.18, 1.5, 6, COL.darkMetal, s * 1.7, 1.4, 1.0, { rx: HALF_PI });
    });
  },
  jet: (b, ctx) => {
    b.cyl(0.55, 0.85, 11, 10, 0x6c7a89, 0, 1.2, 0, { rx: HALF_PI })
      .cone(0.55, 3.2, 10, 0x6c7a89, 0, 1.2, 7.1, { rx: HALF_PI })
      .sphere(0.6, 10, 8, 0x1f3342, 0, 1.75, 3.6, { sz: 2.2, sy: 0.7, noAO: true })
      .box(10, 0.12, 3.6, 0x5c6a79, 0, 1.1, -0.6)
      .box(4.4, 0.1, 1.6, 0x5c6a79, 0, 1.2, -4.8)
      .box(0.12, 2.6, 2.2, 0x5c6a79, 0, 2.5, -4.6, { rx: -0.35 })
      .cyl(0.7, 0.6, 0.5, 10, 0x2b2f36, 0, 1.2, -5.6, { rx: HALF_PI })
      .cyl(0.5, 0.5, 0.1, 10, 0xff9f1c, 0, 1.2, -5.86, { rx: HALF_PI, emit: 3, noAO: true })
      .quad(1.2, 0.3, COL.white, 0.07, 2.6, -4.6, { ry: HALF_PI, uv: ctx.atlas.get('sentinela') });
    b.mirrorX((s) => {
      b.cyl(0.12, 0.12, 2.4, 6, 0xdddddd, s * 3.4, 0.9, -0.3, { rx: HALF_PI });
      b.cone(0.12, 0.4, 6, 0xd62828, s * 3.4, 0.9, 1.1, { rx: HALF_PI });
      b.box(0.8, 0.06, 0.3, 0x5c6a79, s * 5.0, 1.12, -1.8, { ry: s * 0.3 });
    });
  },
  aagun: (b) => {
    b.block(4.2, 1.0, 4.2, COL.militaryDark, 0, 0, 0)
      .cyl(1.5, 1.7, 1.2, 10, COL.military, 0, 1.6, 0)
      .box(2.2, 1.4, 2.4, COL.military, 0, 2.8, 0)
      .mirrorX((s) => b.cyl(0.16, 0.16, 4.2, 6, COL.darkMetal, s * 0.5, 4.6, 1.6, { rx: 0.9 }))
      .sphere(0.3, 8, 6, 0xff3b30, 0.9, 3.6, -1.1, { emit: 2, noAO: true });
  },
  boss: (b, ctx) => {
    // PROJETO TUCANO NEGRO: flying wing with an oversized orange beak
    b.cyl(2.2, 3.2, 20, 12, 0x121216, 0, 3.5, 0, { rx: HALF_PI })
      .cone(2.2, 7, 12, 0xff7b00, 0, 3.6, 13.4, { rx: HALF_PI, sx: 0.85, sy: 1.2 })
      .cone(1.2, 3, 10, 0x121216, 0, 3.6, 17.6, { rx: HALF_PI })
      .sphere(1.3, 10, 8, 0x2a1b00, 0, 5.2, 7, { sz: 2, sy: 0.6, noAO: true })
      .box(38, 0.6, 9, 0x16161c, 0, 3.4, -2, { ry: 0 })
      .box(26, 0.5, 5, 0x1c1c24, 0, 3.8, -8)
      .quad(8, 1.5, COL.white, 0, 3.72, 2.51, { uv: ctx.atlas.get('boss'), rx: -HALF_PI });
    b.mirrorX((s) => {
      b.box(12, 0.5, 5, 0x16161c, s * 23, 3.2, -4.5, { ry: s * 0.45 });
      b.box(0.4, 4, 3.4, 0x16161c, s * 5, 6, -8.5, { rz: s * 0.35 });
      b.cyl(1.4, 1.2, 5, 10, 0x222228, s * 7, 2.5, -5, { rx: HALF_PI });
      b.cyl(1.0, 1.0, 0.2, 10, 0xff7b00, s * 7, 2.5, -7.6, { rx: HALF_PI, emit: 4, noAO: true });
      b.box(14, 0.12, 0.4, 0xff7b00, s * 12, 3.72, 2.2, { ry: s * -0.1, emit: 2.5, noAO: true });
      b.sphere(0.4, 8, 6, 0xff2d2d, s * 34, 3.4, -6, { emit: 3, noAO: true });
    });
  },
};
