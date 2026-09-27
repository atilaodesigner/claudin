import { COL } from './palette';
import type { ModelFn } from './types';

export const NATURE_MODELS: Record<string, ModelFn> = {
  palm: (b) => {
    // curved trunk from stacked segments
    let x = 0;
    let y = 0;
    for (let i = 0; i < 7; i++) {
      const lean = i * 0.11;
      b.cyl(0.2 - i * 0.012, 0.23 - i * 0.012, 1.25, 7, i % 2 ? 0x9c7a54 : 0x8a6a45, x, y + 0.62, 0, { rz: -lean });
      x += Math.sin(lean) * 1.2;
      y += Math.cos(lean) * 1.2;
    }
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      b.cone(0.5, 3.4, 4, i % 2 ? COL.leaf : COL.leafLight, x + Math.cos(a) * 1.3, y - 0.2, Math.sin(a) * 1.3, { rz: Math.cos(a) * 1.9, rx: -Math.sin(a) * 1.9, sz: 0.25 });
    }
    b.ico(0.22, 0, 0x6b8e23, x + 0.2, y - 0.25, 0.15).ico(0.22, 0, 0x6b8e23, x - 0.15, y - 0.3, -0.1).ico(0.22, 0, 0x556b2f, x, y - 0.3, 0.25);
  },
  ipe: (b) => {
    b.cyl(0.22, 0.32, 3.2, 7, 0x6b4a2f, 0, 1.6, 0)
      .strut(0, 2.8, 0, 1.2, 4.0, 0.3, 0.14, 0x6b4a2f)
      .strut(0, 2.8, 0, -1.0, 4.2, -0.4, 0.14, 0x6b4a2f)
      .ico(1.7, 1, COL.ipe, 0, 4.6, 0, { sy: 0.75 })
      .ico(1.2, 0, 0xffe066, 1.3, 4.5, 0.4, { sy: 0.8 })
      .ico(1.1, 0, 0xf4b400, -1.2, 4.4, -0.3, { sy: 0.8 })
      .ico(0.9, 0, 0xffd23f, 0.2, 5.4, -0.6);
  },
  dog: (b) => {
    const c = 0xc98b3f;
    b.box(0.42, 0.42, 1.0, c, 0, 0.62, 0)
      .box(0.36, 0.38, 0.42, c, 0, 0.95, 0.55)
      .box(0.22, 0.18, 0.28, 0xe3b574, 0, 0.88, 0.82)
      .box(0.08, 0.06, 0.06, 0x1d1d1d, 0, 0.94, 0.97)
      .cone(0.08, 0.2, 4, 0x9c6a2e, 0.13, 1.2, 0.5)
      .cone(0.08, 0.2, 4, 0x9c6a2e, -0.13, 1.2, 0.5)
      .cyl(0.05, 0.03, 0.5, 5, c, 0, 0.95, -0.62, { rx: -0.8 })
      .box(0.3, 0.06, 0.06, 0xd62828, 0, 0.8, 0.45);
    b.mirrorX((s) => {
      b.block(0.12, 0.45, 0.12, c, s * 0.14, 0, 0.35);
      b.block(0.12, 0.45, 0.12, c, s * 0.14, 0, -0.35);
    });
  },
  shrub: (b) => {
    b.ico(0.8, 1, COL.leaf, 0, 0.6, 0, { sy: 0.8 }).ico(0.6, 1, COL.leafLight, 0.5, 0.5, 0.2, { sy: 0.8 });
  },
};
