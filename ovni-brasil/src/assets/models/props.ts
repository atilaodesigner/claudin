import { COL } from './palette';
import type { ModelFn } from './types';

const P = { paint: 1 };

/** Small and light props: tiers 0-2. Slightly exaggerated in size so they read from the air. */
export const PROP_MODELS: Record<string, ModelFn> = {
  can: (b) => {
    b.cyl(0.17, 0.17, 0.46, 8, COL.paintBase, 0, 0.23, 0, P)
      .cyl(0.15, 0.17, 0.05, 8, COL.chrome, 0, 0.485, 0)
      .cyl(0.172, 0.172, 0.12, 8, COL.white, 0, 0.23, 0);
  },
  bottle: (b) => {
    b.cyl(0.13, 0.14, 0.42, 7, 0x3d7a3a, 0, 0.21, 0)
      .cyl(0.05, 0.13, 0.16, 7, 0x3d7a3a, 0, 0.5, 0)
      .cyl(0.055, 0.055, 0.06, 6, COL.chrome, 0, 0.6, 0)
      .cyl(0.141, 0.141, 0.14, 7, 0xf2e8cf, 0, 0.24, 0);
  },
  flipflop: (b) => {
    b.box(0.34, 0.06, 0.8, COL.paintBase, 0, 0.03, 0, P)
      .box(0.34, 0.03, 0.8, COL.white, 0, 0.075, 0)
      .strut(-0.12, 0.09, -0.05, 0, 0.18, 0.2, 0.025, COL.paintBase, 4, P)
      .strut(0.12, 0.09, -0.05, 0, 0.18, 0.2, 0.025, COL.paintBase, 4, P);
  },
  box: (b) => {
    b.block(0.8, 0.6, 0.7, 0xc49a6c, 0, 0, 0)
      .box(0.82, 0.02, 0.12, 0xd9c29a, 0, 0.6, 0)
      .box(0.02, 0.2, 0.6, 0x9b7446, 0.4, 0.4, 0);
  },
  trashbag: (b) => {
    b.ico(0.42, 0, 0x1f2328, 0, 0.36, 0, { sy: 0.85 })
      .cone(0.12, 0.28, 6, 0x1f2328, 0, 0.8, 0)
      .ico(0.3, 0, 0x2b3036, 0.35, 0.26, 0.15);
  },
  cone: (b) => {
    b.block(0.62, 0.06, 0.62, COL.orange, 0, 0, 0)
      .cone(0.25, 0.85, 12, COL.orange, 0, 0.48, 0)
      .cyl(0.16, 0.19, 0.14, 12, COL.white, 0, 0.5, 0, { noAO: true });
  },
  coconut: (b) => {
    b.ico(0.3, 0, 0x5e8c31, 0, 0.3, 0, { sy: 1.1 }).cyl(0.06, 0.08, 0.12, 6, 0x9bbf5a, 0, 0.64, 0).cyl(0.02, 0.02, 0.35, 4, 0xf4f4f4, 0.08, 0.75, 0, { rz: 0.3 });
  },
  ball: (b) => {
    b.ico(0.3, 1, COL.white, 0, 0.3, 0).ico(0.302, 0, COL.black, 0, 0.3, 0, { sx: 0.6, sy: 0.6, sz: 0.6 });
  },
  cooler: (b) => {
    b.block(0.9, 0.55, 0.6, 0xf6f6f3, 0, 0, 0).block(0.94, 0.1, 0.64, 0x2f7fd0, 0, 0.55, 0).box(0.4, 0.06, 0.08, 0x2f7fd0, 0, 0.7, 0);
  },
  chicken: (b) => {
    b.ico(0.32, 0, 0xf7f3e8, 0, 0.42, 0, { sz: 1.3 })
      .ico(0.2, 0, 0xf7f3e8, 0, 0.72, 0.28)
      .box(0.12, 0.14, 0.05, COL.red, 0, 0.92, 0.28)
      .cone(0.06, 0.14, 4, 0xf2a900, 0, 0.72, 0.5, { rx: Math.PI / 2 })
      .cone(0.18, 0.28, 5, 0xf0ebe0, 0, 0.55, -0.38, { rx: -0.7 })
      .strut(0.1, 0, 0, 0.1, 0.25, 0, 0.03, 0xf2a900)
      .strut(-0.1, 0, 0, -0.1, 0.25, 0, 0.03, 0xf2a900);
  },
  plantpot: (b) => {
    b.cyl(0.38, 0.28, 0.55, 7, COL.terracotta, 0, 0.275, 0)
      .ico(0.42, 0, COL.leaf, 0, 0.8, 0, { sy: 0.9 })
      .cone(0.1, 0.8, 4, COL.leafLight, 0.15, 1.0, 0, { rz: -0.3 })
      .cone(0.1, 0.7, 4, COL.leafLight, -0.15, 1.0, 0.1, { rz: 0.35 });
  },
  crate: (b) => {
    b.block(0.9, 0.5, 0.6, 0xe6b422, 0, 0, 0);
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 0; z++) b.cyl(0.08, 0.08, 0.35, 4, 0x5c3b1e, x * 0.28, 0.6, z * 0.26 + 0.13);
  },
  chair: (b) => {
    const c = COL.paintBase;
    b.block(0.62, 0.06, 0.6, c, 0, 0.5, 0, P)
      .box(0.62, 0.6, 0.06, c, 0, 0.84, -0.28, { rx: -0.12, paint: 1 })
      .mirrorX((s) => {
        b.strut(s * 0.27, 0, 0.25, s * 0.25, 0.5, 0.22, 0.035, c, 4, P);
        b.strut(s * 0.27, 0, -0.27, s * 0.25, 0.5, -0.24, 0.035, c, 4, P);
        b.box(0.05, 0.05, 0.5, c, s * 0.3, 0.72, 0, P);
      });
  },
  bartable: (b) => {
    const c = COL.paintBase;
    b.block(0.95, 0.06, 0.95, c, 0, 0.74, 0, P).cyl(0.05, 0.05, 0.72, 6, c, 0, 0.37, 0, P).block(0.5, 0.04, 0.5, c, 0, 0, 0, P)
      .cyl(0.05, 0.045, 0.12, 8, 0xeef6ff, 0.2, 0.86, 0.1, { noAO: true })
      .cyl(0.09, 0.1, 0.36, 8, 0x5b2e0c, -0.2, 0.98, -0.1);
  },
  bicycle: (b) => {
    const f = COL.paintBase;
    b.torus(0.36, 0.045, 3, 10, COL.tire, 0, 0.4, 0.55, { ry: Math.PI / 2 })
      .torus(0.36, 0.045, 3, 10, COL.tire, 0, 0.4, -0.55, { ry: Math.PI / 2 })
      .strut(0, 0.4, -0.55, 0, 0.85, -0.1, 0.04, f, 4, P)
      .strut(0, 0.4, -0.55, 0, 0.45, 0.05, 0.04, f, 4, P)
      .strut(0, 0.45, 0.05, 0, 0.85, -0.1, 0.04, f, 4, P)
      .strut(0, 0.85, -0.1, 0, 0.88, 0.4, 0.04, f, 4, P)
      .strut(0, 0.4, 0.55, 0, 0.95, 0.42, 0.04, f, 4, P)
      .box(0.5, 0.04, 0.04, COL.black, 0, 0.98, 0.42)
      .box(0.14, 0.06, 0.26, COL.black, 0, 0.93, -0.12);
  },
  grill: (b) => {
    b.cyl(0.42, 0.42, 0.8, 8, 0x2c2c2e, 0, 0.9, 0, { rz: Math.PI / 2 })
      .box(0.82, 0.04, 0.74, 0x6b6b70, 0, 1.06, 0)
      .mirrorX((s) => b.strut(s * 0.3, 0, 0.3, s * 0.3, 0.6, 0.2, 0.03, COL.darkMetal).strut(s * 0.3, 0, -0.3, s * 0.3, 0.6, -0.2, 0.03, COL.darkMetal))
      .box(0.5, 0.12, 0.2, 0x8b2c1a, 0, 1.12, 0.1)
      .box(0.4, 0.1, 0.16, 0xff7b39, 0, 0.9, 0, { emit: 0.8, noAO: true });
  },
  bin: (b) => {
    b.cyl(0.36, 0.3, 0.95, 7, COL.paintBase, 0, 0.475, 0, P).cyl(0.39, 0.39, 0.08, 7, COL.darkMetal, 0, 0.98, 0).cyl(0.05, 0.05, 1.1, 5, COL.darkMetal, 0, 0.55, -0.42);
  },
  gascan: (b) => {
    b.cyl(0.32, 0.32, 0.72, 8, COL.orange, 0, 0.46, 0)
      .sphere(0.32, 8, 4, COL.orange, 0, 0.82, 0, { sy: 0.45 })
      .cyl(0.34, 0.34, 0.1, 8, 0xd96a00, 0, 0.08, 0)
      .cyl(0.18, 0.18, 0.12, 6, COL.darkMetal, 0, 1.0, 0)
      .torus(0.18, 0.03, 3, 8, COL.metal, 0, 1.08, 0, { rx: Math.PI / 2 });
  },
  cart: (b) => {
    b.block(0.62, 0.55, 0.95, 0xb8c0c8, 0, 0.45, 0)
      .block(0.56, 0.5, 0.88, 0x8d98a3, 0, 0.5, 0)
      .strut(-0.3, 1.0, -0.5, 0.3, 1.0, -0.5, 0.03, COL.red)
      .mirrorX((s) => {
        b.cyl(0.08, 0.08, 0.05, 8, COL.tire, s * 0.25, 0.08, 0.4, { rz: Math.PI / 2 });
        b.cyl(0.08, 0.08, 0.05, 8, COL.tire, s * 0.25, 0.08, -0.4, { rz: Math.PI / 2 });
        b.strut(s * 0.25, 0.1, 0.4, s * 0.28, 0.45, 0.4, 0.02, COL.metal);
        b.strut(s * 0.25, 0.1, -0.4, s * 0.28, 0.45, -0.4, 0.02, COL.metal);
      });
  },
  parasol: (b) => {
    b.cyl(0.03, 0.03, 2.2, 5, COL.white, 0, 1.1, 0)
      .cone(1.3, 0.55, 8, COL.paintBase, 0, 2.2, 0, P)
      .cone(1.31, 0.55, 8, COL.white, 0, 2.19, 0, { sx: 0.5, sz: 0.5, sy: 1.02 })
      .cyl(0.25, 0.3, 0.1, 8, COL.concrete, 0, 0.05, 0);
  },
  speaker: (b) => {
    b.block(0.6, 1.0, 0.5, 0x1b1b1e, 0, 0, 0)
      .cyl(0.2, 0.2, 0.04, 12, 0x3b3b40, 0, 0.35, 0.26, { rx: Math.PI / 2 })
      .cyl(0.12, 0.12, 0.04, 12, 0x3b3b40, 0, 0.75, 0.26, { rx: Math.PI / 2 })
      .box(0.5, 0.04, 0.02, 0x7df9ff, 0, 0.93, 0.26, { emit: 1, noAO: true });
  },
  tvantenna: (b) => {
    b.cyl(0.03, 0.03, 1.8, 4, COL.metal, 0, 0.9, 0);
    for (let i = 0; i < 5; i++) b.box(1.1 - i * 0.14, 0.03, 0.03, COL.metal, 0, 1.2 + i * 0.13, 0.15 * (i % 2 ? 1 : -1));
    b.cyl(0.25, 0.25, 0.04, 10, COL.darkMetal, 0, 0.02, 0);
  },
  aircon: (b) => {
    b.block(0.95, 0.65, 0.5, 0xeef0f2, 0, 0, 0).cyl(0.23, 0.23, 0.03, 12, 0x9aa1a8, 0.18, 0.32, 0.26, { rx: Math.PI / 2 }).box(0.25, 0.4, 0.02, 0xb0b6bd, -0.28, 0.32, 0.26);
  },
  bench: (b) => {
    b.block(1.8, 0.08, 0.5, COL.wood, 0, 0.45, 0).box(1.8, 0.4, 0.07, COL.wood, 0, 0.8, -0.24, { rx: -0.15 }).mirrorX((s) => b.block(0.08, 0.45, 0.5, COL.darkMetal, s * 0.75, 0, 0));
  },
  moto: (b) => {
    b.cyl(0.38, 0.38, 0.18, 8, COL.tire, 0, 0.38, 0.72, { rz: Math.PI / 2 })
      .cyl(0.38, 0.38, 0.18, 8, COL.tire, 0, 0.38, -0.68, { rz: Math.PI / 2 })
      .box(0.34, 0.36, 1.0, COL.paintBase, 0, 0.75, 0.02, P)
      .box(0.3, 0.14, 0.62, COL.black, 0, 1.0, -0.2)
      .box(0.26, 0.32, 0.36, COL.darkMetal, 0, 0.52, 0.05)
      .strut(0, 0.4, 0.72, 0, 1.12, 0.52, 0.04, COL.chrome)
      .box(0.7, 0.04, 0.05, COL.black, 0, 1.15, 0.5)
      .box(0.18, 0.14, 0.1, COL.headlight, 0, 1.0, 0.66, { emit: 0.8, noAO: true })
      .cyl(0.05, 0.06, 0.62, 6, COL.chrome, 0.2, 0.48, -0.3, { rx: Math.PI / 2 - 0.2 })
      .box(0.2, 0.08, 0.06, COL.taillight, 0, 0.9, -0.68, { emit: 0.6, noAO: true });
  },
  popcorn: (b) => {
    b.block(1.1, 0.9, 0.7, 0xe63946, 0, 0.3, 0)
      .block(1.0, 0.7, 0.62, 0xfaf3dd, 0, 1.2, 0, { noAO: true })
      .block(1.2, 0.08, 0.8, 0xe63946, 0, 1.9, 0)
      .cone(0.7, 0.4, 4, 0xe63946, 0, 2.16, 0, { ry: Math.PI / 4 })
      .ico(0.3, 1, 0xfff1b5, 0, 1.45, 0, { sx: 1.3 })
      .cyl(0.28, 0.28, 0.1, 10, COL.tire, 0.35, 0.28, 0.38, { rx: Math.PI / 2 })
      .cyl(0.28, 0.28, 0.1, 10, COL.tire, -0.35, 0.28, 0.38, { rx: Math.PI / 2 })
      .strut(0.55, 1.0, -0.2, 0.95, 1.0, -0.2, 0.03, COL.chrome);
  },
  stall: (b, ctx) => {
    const t = COL.paintBase;
    b.block(2.8, 0.1, 1.6, COL.woodLight, 0, 0.85, 0)
      .block(2.6, 0.2, 1.4, 0x6c9a3b, 0, 0.95, 0)
      .ico(0.18, 0, 0xe63946, -0.8, 1.2, 0.2).ico(0.18, 0, 0xffb703, -0.4, 1.2, -0.1).ico(0.18, 0, 0x8ac926, 0.1, 1.2, 0.2).ico(0.2, 0, 0xfb8500, 0.6, 1.2, -0.2)
      .ico(0.22, 1, 0x2d6a4f, 0.95, 1.22, 0.25, { sz: 1.4 })
      .prism(3.0, 0.5, 1.9, t, 0, 2.25, 0, P)
      .quad(1.6, 0.4, COL.white, 0, 2.1, 0.96, { uv: ctx.atlas.get('feira') });
    b.mirrorX((s) => {
      b.cyl(0.035, 0.035, 2.25, 4, COL.metal, s * 1.35, 1.12, 0.75);
      b.cyl(0.035, 0.035, 2.25, 4, COL.metal, s * 1.35, 1.12, -0.75);
    });
  },
  payphone: (b) => {
    b.cyl(0.07, 0.07, 1.5, 6, COL.metal, 0, 0.75, 0)
      .sphere(0.62, 12, 8, 0xf77f00, 0, 1.95, 0.05, { sy: 1.1, sz: 0.85 })
      .sphere(0.5, 12, 8, 0x2d2d2d, 0, 1.9, 0.18, { sy: 0.95, sz: 0.55 })
      .box(0.22, 0.4, 0.12, 0x3a86ff, 0, 1.75, 0.2)
      .block(0.4, 0.04, 0.4, COL.concrete, 0, 0, 0);
  },
  watertank: (b) => {
    b.cyl(0.85, 0.7, 1.0, 10, COL.blueTank, 0, 0.5, 0)
      .cyl(0.9, 0.9, 0.12, 10, 0x2a6fb5, 0, 1.06, 0)
      .cyl(0.25, 0.25, 0.1, 6, 0x2a6fb5, 0, 1.16, 0)
      .cyl(0.05, 0.05, 0.6, 4, COL.white, 0.6, 0.3, 0.6, { rz: 0.4 });
  },
  tree: (b) => {
    b.cyl(0.14, 0.2, 2.2, 6, COL.trunk, 0, 1.1, 0)
      .ico(1.2, 1, COL.leaf, 0, 2.8, 0, { sy: 0.85 })
      .ico(0.8, 0, COL.leafLight, 0.55, 3.2, 0.3)
      .ico(0.75, 0, COL.leafDark, -0.5, 2.5, -0.4);
  },
  cow: (b) => {
    b.box(0.9, 0.85, 1.7, 0xf6f4ee, 0, 1.15, 0)
      .box(0.92, 0.5, 0.6, 0x1f1f1f, 0, 1.3, -0.3)
      .box(0.5, 0.3, 0.4, 0x1f1f1f, 0.2, 1.35, 0.5)
      .box(0.5, 0.55, 0.6, 0xf6f4ee, 0, 1.35, 1.05)
      .box(0.44, 0.24, 0.24, 0xf2b8a2, 0, 1.18, 1.38)
      .cone(0.06, 0.22, 4, COL.offwhite, 0.18, 1.72, 1.05)
      .cone(0.06, 0.22, 4, COL.offwhite, -0.18, 1.72, 1.05)
      .box(0.3, 0.14, 0.1, 0xf6f4ee, 0.34, 1.55, 0.98, { rz: -0.4 })
      .box(0.3, 0.14, 0.1, 0xf6f4ee, -0.34, 1.55, 0.98, { rz: 0.4 })
      .ico(0.14, 0, 0xf2b8a2, 0, 0.72, -0.2);
    b.mirrorX((s) => {
      b.block(0.2, 0.75, 0.2, 0xeeeae0, s * 0.3, 0, 0.6);
      b.block(0.2, 0.75, 0.2, 0xeeeae0, s * 0.3, 0, -0.6);
    });
  },
  trafficlight: (b) => {
    b.cyl(0.08, 0.1, 3.2, 6, COL.darkMetal, 0, 1.6, 0)
      .block(0.4, 1.0, 0.35, 0x1d1d21, 0, 3.0, 0.1)
      .sphere(0.11, 8, 6, 0xff3b30, 0, 3.8, 0.28, { emit: 0.9, noAO: true })
      .sphere(0.11, 8, 6, 0xffc300, 0, 3.5, 0.28, { emit: 0.9, noAO: true })
      .sphere(0.11, 8, 6, 0x34c759, 0, 3.2, 0.28, { emit: 0.9, noAO: true });
  },
  streetsign: (b) => {
    b.cyl(0.05, 0.05, 2.6, 5, COL.metal, 0, 1.3, 0).box(1.1, 0.35, 0.04, 0x1d5fbf, 0, 2.5, 0).box(0.9, 0.08, 0.05, COL.white, 0, 2.5, 0.01, { noAO: true });
  },
  floatie: (b) => {
    b.torus(0.6, 0.24, 8, 16, 0xff7eb6, 0, 0.24, 0, { rx: Math.PI / 2 })
      .cyl(0.12, 0.14, 0.9, 8, 0xff7eb6, 0, 0.7, 0.5, { rx: -0.3 })
      .sphere(0.2, 8, 6, 0xff7eb6, 0, 1.12, 0.62)
      .cone(0.08, 0.2, 5, 0x1d1d21, 0, 1.08, 0.86, { rx: Math.PI / 2 });
  },
  goal: (b) => {
    b.mirrorX((s) => b.cyl(0.07, 0.07, 2.2, 6, COL.white, s * 2.6, 1.1, 0));
    b.box(5.3, 0.14, 0.14, COL.white, 0, 2.2, 0)
      .strut(-2.6, 2.2, 0, -2.6, 0, -1.4, 0.04, 0xdddddd)
      .strut(2.6, 2.2, 0, 2.6, 0, -1.4, 0.04, 0xdddddd)
      .box(5.2, 2.1, 0.02, 0xf2f2f2, 0, 1.1, -0.7, { rx: -0.55, noAO: true });
  },
  person: (b) => {
    // shirt uses the paint mask; pants/skin baked
    b.block(0.44, 0.8, 0.26, 0x2f3e5c, 0, 0, 0)
      .block(0.52, 0.66, 0.32, COL.paintBase, 0, 0.8, 0, P)
      .sphere(0.21, 7, 5, COL.skin[1], 0, 1.66, 0)
      .sphere(0.215, 7, 3, COL.hair[0], 0, 1.72, -0.03, { sy: 0.72 })
      .box(0.14, 0.58, 0.14, COL.skin[1], 0.34, 1.12, 0)
      .box(0.14, 0.58, 0.14, COL.skin[1], -0.34, 1.12, 0);
  },
  person_up: (b) => {
    b.block(0.44, 0.8, 0.26, 0x2f3e5c, 0, 0, 0)
      .block(0.52, 0.66, 0.32, COL.paintBase, 0, 0.8, 0, P)
      .sphere(0.21, 7, 5, COL.skin[1], 0, 1.66, 0)
      .sphere(0.215, 7, 3, COL.hair[0], 0, 1.72, -0.03, { sy: 0.72 })
      .box(0.14, 0.62, 0.14, COL.skin[1], 0.36, 1.7, 0.04, { rz: -0.35 })
      .box(0.14, 0.62, 0.14, COL.skin[1], -0.36, 1.7, 0.04, { rz: 0.35 })
      .box(0.14, 0.22, 0.03, 0x111827, 0.46, 2.06, 0.1, { rz: -0.35 })
      .box(0.1, 0.16, 0.01, 0xbfe9ff, 0.46, 2.06, 0.12, { rz: -0.35, emit: 1.2, noAO: true });
  },
};
