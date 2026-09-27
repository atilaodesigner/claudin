import type { ModelBuilder } from '../ModelBuilder';
import { COL } from './palette';
import type { ModelFn } from './types';

/**
 * Regional props: beach, boats, street food, Amazon fauna/flora and regional houses.
 * Same conventions as the other model files: meters, base at y=0, front facing +Z.
 */
const P = { paint: 1 };
const HALF_PI = Math.PI / 2;

function hull(b: ModelBuilder, L: number, W: number, H: number, color: number, deck: number, stripe?: number): void {
  // flat-bottomed hull with a pointed bow toward +Z
  b.block(W, H, L * 0.72, color, 0, 0, -L * 0.14, P)
    .prism(W, L * 0.3, H, color, 0, H / 2, L * 0.22, { rx: HALF_PI, paint: 1 })
    .block(W - 0.2, 0.08, L * 0.7, deck, 0, H, -L * 0.14);
  if (stripe !== undefined) b.block(W + 0.04, 0.16, L * 0.72, stripe, 0, H * 0.6, -L * 0.14);
}

function person(b: ModelBuilder, x: number, y: number, z: number, shirt: number, ry = 0): void {
  b.block(0.36, 0.8, 0.24, 0x2b2d42, x, y, z, { ry })
    .block(0.44, 0.62, 0.26, shirt, x, y + 0.8, z, { ry })
    .sphere(0.15, 6, 5, COL.skin[1], x, y + 1.6, z);
}

function leafFan(b: ModelBuilder, x: number, y: number, z: number, n: number, len: number, color: number, color2: number, droop = 1.9): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    b.cone(len * 0.16, len, 4, i % 2 ? color : color2, x + Math.cos(a) * len * 0.38, y - 0.15, z + Math.sin(a) * len * 0.38, {
      rz: Math.cos(a) * droop,
      rx: -Math.sin(a) * droop,
      sz: 0.25,
    });
  }
}

export const COAST_MODELS: Record<string, ModelFn> = {
  // ───────────── tier 0-1 miudezas
  cookie_bag: (b) => {
    b.block(0.22, 0.32, 0.08, 0xf1f1ec, 0, 0, 0)
      .block(0.23, 0.08, 0.09, 0xe63946, 0, 0.2, 0)
      .block(0.23, 0.05, 0.09, 0x1d4ed8, 0, 0.1, 0);
  },
  frevo_umbrella: (b) => {
    const cols = [0xe63946, 0xffd166, 0x06d6a0, 0x118ab2];
    b.cyl(0.015, 0.015, 0.7, 4, COL.darkMetal, 0, 0.35, 0);
    for (let i = 0; i < 4; i++) b.cone(0.34, 0.16, 4, cols[i] as number, 0, 0.72 + i * 0.001, 0, { ry: (i * Math.PI) / 8 });
  },
  ribbons: (b) => {
    const cols = [0xe63946, 0xffd166, 0x06d6a0, 0x118ab2, 0x8338ec, 0xffffff, 0xf77f00];
    b.block(0.06, 1.1, 0.06, COL.wood, -0.5, 0, 0).block(0.06, 1.1, 0.06, COL.wood, 0.5, 0, 0).box(1.1, 0.04, 0.04, COL.wood, 0, 1.05, 0);
    for (let i = 0; i < 7; i++) b.box(0.05, 0.62, 0.01, cols[i] as number, -0.42 + i * 0.14, 0.72, 0, { rz: (i % 3) * 0.08 - 0.08 });
  },
  pequi: (b) => {
    b.sphere(0.13, 7, 6, 0x6b8f3a, 0, 0.12, 0, { sy: 0.9 }).cyl(0.012, 0.012, 0.06, 4, COL.trunk, 0, 0.26, 0);
  },
  pequi_glow: (b) => {
    b.sphere(0.15, 8, 7, 0xc8ff4f, 0, 0.14, 0, { emit: 1.4, noAO: true }).cyl(0.012, 0.012, 0.06, 4, COL.trunk, 0, 0.3, 0);
  },
  macaw: (b) => {
    b.block(0.06, 0.5, 0.06, COL.trunk, 0, 0, 0)
      .box(0.5, 0.05, 0.05, COL.trunk, 0, 0.5, 0)
      .box(0.16, 0.26, 0.16, 0x1f5fd6, 0.08, 0.68, 0)
      .sphere(0.09, 6, 5, 0x1f5fd6, 0.08, 0.86, 0.04)
      .box(0.08, 0.05, 0.06, 0xffd23f, 0.08, 0.84, 0.13)
      .box(0.05, 0.3, 0.04, 0x1a47a8, 0.08, 0.44, -0.06, { rx: 0.25 });
  },
  beach_chair: (b) => {
    b.box(0.6, 0.04, 0.9, COL.paintBase, 0, 0.32, 0.15, P).box(0.6, 0.8, 0.04, COL.paintBase, 0, 0.62, -0.35, { rx: -0.45, paint: 1 });
    b.mirrorX((s) => {
      b.strut(s * 0.3, 0, 0.5, s * 0.3, 0.32, 0.1, 0.018, COL.chrome);
      b.strut(s * 0.3, 0, -0.3, s * 0.3, 0.98, -0.52, 0.018, COL.chrome);
    });
  },
  surfboard: (b) => {
    b.block(0.5, 0.07, 1.9, COL.paintBase, 0, 0.12, 0, P)
      .sphere(0.25, 8, 4, COL.paintBase, 0, 0.155, 0.92, { sy: 0.14, sz: 1.2, paint: 1 })
      .block(0.06, 0.02, 1.8, 0xe63946, 0, 0.19, 0)
      .block(0.04, 0.2, 0.16, COL.black, 0, 0, -0.8);
  },
  surfboard_gold: (b) => {
    b.block(0.5, 0.07, 1.9, COL.gold, 0, 0.12, 0, { emit: 0.25 })
      .sphere(0.25, 8, 4, COL.gold, 0, 0.155, 0.92, { sy: 0.14, sz: 1.2, emit: 0.25 })
      .block(0.06, 0.02, 1.8, 0xffffff, 0, 0.19, 0, { emit: 0.6 })
      .block(0.04, 0.2, 0.16, COL.black, 0, 0, -0.8);
  },
  sloth: (b) => {
    const fur = 0x8a7358;
    b.block(0.08, 1.8, 0.08, COL.trunk, 0, 0, 0)
      .box(0.34, 0.5, 0.3, fur, 0, 1.3, 0.1, { rx: 0.2 })
      .sphere(0.15, 6, 5, fur, 0, 1.62, 0.2)
      .box(0.18, 0.08, 0.02, 0x3b2a1a, 0, 1.63, 0.34)
      .box(0.5, 0.06, 0.06, fur, 0, 1.55, 0.02, { rz: 0.1 })
      .box(0.5, 0.06, 0.06, fur, 0, 1.08, 0.02, { rz: -0.1 });
  },

  // ───────────── tier 2 barracas e bancas
  beach_tent: (b) => {
    b.hipRoof(3.2, 0.9, 3.2, COL.paintBase, 0, 2.2, 0, P).block(3.2, 0.12, 3.2, COL.white, 0, 2.1, 0);
    b.mirrorX((s) => {
      b.block(0.06, 2.2, 0.06, COL.chrome, s * 1.5, 0, 1.5);
      b.block(0.06, 2.2, 0.06, COL.chrome, s * 1.5, 0, -1.5);
    });
    b.block(1.4, 0.8, 0.6, 0xf1f1ec, 0, 0, -1.0).block(1.2, 0.5, 0.5, 0x1d4ed8, 0.6, 0, 0.4);
  },
  volley_net: (b) => {
    b.mirrorX((s) => b.block(0.1, 2.5, 0.1, COL.white, s * 4.5, 0, 0));
    b.box(9, 0.9, 0.02, 0x1d1d21, 0, 1.95, 0).box(9, 0.07, 0.03, COL.white, 0, 2.43, 0);
    b.sphere(0.11, 6, 5, 0xffd166, 1.4, 0.11, 1.2);
  },
  mate_cart: (b) => {
    b.cyl(0.35, 0.35, 0.8, 10, 0xc0c4ca, -0.35, 0.8, 0)
      .cyl(0.35, 0.35, 0.8, 10, 0xc0c4ca, 0.35, 0.8, 0)
      .cyl(0.36, 0.36, 0.14, 10, 0xffd166, -0.35, 0.9, 0)
      .cyl(0.36, 0.36, 0.14, 10, 0x2a9d5a, 0.35, 0.9, 0)
      .block(0.9, 0.05, 0.5, COL.darkMetal, 0, 0.35, 0)
      .cyl(0.14, 0.14, 0.06, 8, COL.tire, 0, 0.14, 0.3, { rz: HALF_PI });
  },
  acaraje_stand: (b, ctx) => {
    b.block(1.6, 0.8, 0.9, COL.woodLight, 0, 0, 0)
      .block(1.7, 0.06, 1.0, 0xf1f1ec, 0, 0.8, 0)
      .cyl(0.28, 0.24, 0.14, 10, 0x2b2d42, -0.4, 0.93, 0)
      .cyl(0.25, 0.25, 0.04, 10, 0xd98e04, -0.4, 1.0, 0, { emit: 0.2 })
      .sphere(0.2, 8, 6, 0xf4a261, 0.4, 0.95, 0, { sy: 0.5 })
      .cyl(0.03, 0.03, 2.4, 5, COL.white, 0.7, 1.2, -0.3)
      .cone(1.5, 0.6, 10, 0xffffff, 0.7, 2.6, -0.3)
      .quad(1.4, 0.34, COL.white, 0, 0.45, 0.46, { uv: ctx.atlas.get('acaraje') });
    person(b, -0.2, 0, -0.9, 0xffffff);
    b.cone(0.55, 0.9, 8, 0xffffff, -0.2, 0.45, -0.9).sphere(0.18, 6, 5, 0xffffff, -0.2, 1.82, -0.9, { sy: 0.8 });
  },
  acaraje_cosmic: (b) => {
    b.sphere(0.16, 8, 6, 0x9dff6a, 0, 0.1, 0, { sy: 0.55, sx: 1.4, emit: 1.1, noAO: true })
      .box(0.22, 0.04, 0.06, 0xff4fd8, 0, 0.16, 0, { emit: 1.2, noAO: true })
      .torus(0.24, 0.02, 4, 12, 0x7df9ff, 0, 0.1, 0, { rx: HALF_PI, emit: 1.4, noAO: true });
  },
  pastel_stall: (b, ctx) => {
    b.block(3.2, 0.9, 1.4, 0xf1f1ec, 0, 0, 0)
      .block(3.3, 0.08, 1.5, 0xc0c4ca, 0, 0.9, 0)
      .box(3.6, 0.06, 2.6, 0xffd166, 0, 2.5, 0.2, { rx: -0.12 })
      .quad(2.4, 0.5, COL.white, 0, 2.1, 0.92, { uv: ctx.atlas.get('pastel') });
    b.mirrorX((s) => {
      b.block(0.06, 2.5, 0.06, COL.chrome, s * 1.65, 0, 1.3);
      b.block(0.06, 2.6, 0.06, COL.chrome, s * 1.65, 0, -0.9);
    });
    for (let i = 0; i < 5; i++) b.box(0.34, 0.05, 0.2, 0xe9b44c, -1.0 + i * 0.5, 0.97, 0.2, { ry: i * 0.3 });
    b.cyl(0.24, 0.24, 0.4, 8, 0x2a9d5a, 1.3, 1.14, -0.3);
  },
  giant_pastel: (b) => {
    b.sphere(0.8, 12, 4, 0xe9b44c, 0, 0.2, 0, { sy: 0.22, sx: 1.2, emit: 0.1 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 8) * Math.PI - HALF_PI;
      b.box(0.14, 0.04, 0.1, 0xd4972e, Math.sin(a) * 0.95, 0.22, Math.cos(a) * 0.66, { ry: a });
    }
  },
  shark_sign: (b, ctx) => {
    b.block(0.12, 2.6, 0.12, COL.metal, 0, 0, 0)
      .block(1.7, 1.3, 0.06, 0xffd60a, 0, 1.6, 0.08)
      .quad(1.6, 1.2, COL.white, 0, 2.25, 0.12, { uv: ctx.atlas.get('tubarao') });
  },
  banana_tree: (b) => {
    b.cyl(0.14, 0.2, 2.6, 7, 0x7a8c3a, 0, 1.3, 0);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      b.box(0.5, 0.03, 2.4, i % 2 ? 0x4c9a2a : 0x6cc24a, Math.cos(a) * 0.9, 2.9, Math.sin(a) * 0.9, { ry: -a + HALF_PI, rx: 0.5 });
    }
    b.cyl(0.14, 0.22, 0.7, 6, 0xd4c341, 0.3, 2.1, 0.2, { rz: 0.3 });
  },
  capybara: (b) => {
    const c = 0x8c6a45;
    b.box(0.55, 0.5, 1.0, c, 0, 0.45, 0)
      .box(0.4, 0.4, 0.42, c, 0, 0.62, 0.62)
      .box(0.3, 0.18, 0.08, 0x5c4630, 0, 0.62, 0.84)
      .box(0.06, 0.05, 0.03, 0x1d1d1d, 0.12, 0.74, 0.8)
      .box(0.06, 0.05, 0.03, 0x1d1d1d, -0.12, 0.74, 0.8);
    b.mirrorX((s) => {
      b.block(0.12, 0.25, 0.12, c, s * 0.18, 0, 0.3);
      b.block(0.12, 0.25, 0.12, c, s * 0.18, 0, -0.3);
    });
  },

  // ───────────── tier 3-4 barcos e bichos
  jangada: (b) => {
    for (let i = 0; i < 6; i++) b.cyl(0.14, 0.14, 5, 6, i % 2 ? 0xc9a26b : 0xb08957, -0.7 + i * 0.28, 0.14, 0, { rx: HALF_PI });
    b.block(1.4, 0.06, 1.2, COL.woodLight, 0, 0.26, -1.3)
      .cyl(0.06, 0.07, 5.4, 5, COL.wood, 0, 2.9, 0.4)
      .box(0.04, 3.6, 2.4, 0xf4f1e6, 0.02, 2.8, 1.0, { rx: 0.35 })
      .block(0.2, 0.02, 3.2, 0xe63946, 0, 5.1, 0.4);
  },
  speedboat: (b) => {
    hull(b, 6.5, 2.2, 0.9, COL.paintBase, COL.woodLight, 0x1d3557);
    b.block(1.6, 0.6, 1.2, COL.white, 0, 0.98, -0.3)
      .box(1.5, 0.5, 0.06, COL.glassDark, 0, 1.75, 0.3, { rx: -0.6, noAO: true })
      .block(0.6, 0.8, 0.5, COL.darkMetal, 0, 0.5, -3.15);
  },
  caiman: (b) => {
    const c = 0x4b5a32;
    b.box(0.7, 0.3, 2.0, c, 0, 0.18, 0)
      .box(0.44, 0.22, 0.9, c, 0, 0.14, 1.35)
      .box(0.46, 0.06, 0.8, 0xe8e0c6, 0, 0.06, 1.35)
      .cone(0.3, 1.8, 5, c, 0, 0.14, -1.8, { rx: -HALF_PI, sy: 1, sx: 0.8 })
      .box(0.08, 0.08, 0.08, 0xd9c75b, 0.14, 0.33, 1.05)
      .box(0.08, 0.08, 0.08, 0xd9c75b, -0.14, 0.33, 1.05);
    for (let i = 0; i < 6; i++) b.box(0.08, 0.1, 0.12, 0x3a4726, 0, 0.36, -0.8 + i * 0.3);
    b.mirrorX((s) => {
      b.box(0.3, 0.14, 0.2, c, s * 0.45, 0.08, 0.6);
      b.box(0.3, 0.14, 0.2, c, s * 0.45, 0.08, -0.6);
    });
  },
  acai_palm: (b) => {
    for (let k = 0; k < 3; k++) {
      const x = (k - 1) * 0.6;
      const h = 7 + k * 1.2;
      b.cyl(0.1, 0.13, h, 6, 0x8a7a5c, x, h / 2, k * 0.3, { rz: (k - 1) * 0.06 });
      leafFan(b, x + (k - 1) * 0.4, h, k * 0.3, 6, 2.2, 0x3f8f3a, 0x5cae45, 2.1);
      for (let i = 0; i < 3; i++) b.ico(0.16, 0, 0x3b1f4f, x + (k - 1) * 0.4 + 0.3, h - 0.6 - i * 0.12, k * 0.3 + 0.2);
    }
  },
  fishing_boat: (b) => {
    hull(b, 10, 3.2, 1.6, COL.paintBase, COL.woodLight, COL.white);
    b.block(2.6, 2.0, 2.6, COL.white, 0, 1.68, -2.2)
      .block(2.8, 0.2, 2.8, 0xe63946, 0, 3.68, -2.2)
      .box(2.2, 0.7, 0.06, COL.glassDark, 0, 3.0, -0.88, { noAO: true })
      .cyl(0.08, 0.08, 5.5, 5, COL.wood, 0, 4.4, 1.6)
      .strut(0, 6.8, 1.6, 0, 1.7, 4.4, 0.03, COL.metal)
      .strut(0, 6.8, 1.6, 0, 3.8, -2.2, 0.03, COL.metal)
      .box(1.2, 0.7, 0.9, 0x2a9d8f, 0.6, 2.0, 2.2);
  },
  tram: (b) => {
    const y = 0xf3c332;
    b.block(2.4, 0.5, 7.4, 0x3b3d42, 0, 0.1, 0)
      .block(2.3, 1.1, 7.0, y, 0, 0.6, 0)
      .block(2.6, 0.12, 7.6, 0x6b4a2f, 0, 3.0, 0)
      .block(2.3, 0.3, 7.0, y, 0, 2.7, 0);
    for (let i = 0; i < 7; i++) {
      const z = -3.0 + i * 1.0;
      b.mirrorX((s) => b.block(0.08, 1.0, 0.08, 0x6b4a2f, s * 1.15, 1.7, z));
      b.block(2.0, 0.5, 0.14, COL.wood, 0, 0.9, z + 0.3);
    }
    person(b, 1.2, 0.6, -1.5, 0x3a86ff);
    person(b, -1.2, 0.6, 1.2, 0xff595e);
    b.strut(0, 3.1, 0, 0, 4.6, -2.0, 0.03, COL.darkMetal);
    for (let i = 0; i < 2; i++) b.mirrorX((s) => b.cyl(0.4, 0.4, 0.14, 8, COL.tire, s * 0.9, 0.4, (i ? 1 : -1) * 2.4, { rz: HALF_PI }));
  },
  lifeguard: (b, ctx) => {
    b.block(3.2, 0.2, 3.2, COL.white, 0, 2.6, 0)
      .block(3.0, 2.2, 3.0, 0xe63946, 0, 2.8, 0)
      .block(2.6, 0.9, 0.06, COL.glass, 0, 3.8, 1.52, { noAO: true })
      .block(3.5, 0.2, 3.5, 0xffd166, 0, 5.0, 0)
      .quad(2.6, 0.5, COL.white, 0, 3.4, 1.53, { uv: ctx.atlas.get('salva') })
      .cyl(0.04, 0.04, 2.4, 4, COL.metal, 1.4, 6.3, 1.4)
      .box(0.9, 0.6, 0.02, 0xe63946, 1.85, 7.2, 1.4);
    b.mirrorX((s) => {
      b.block(0.2, 2.6, 0.2, COL.white, s * 1.4, 0, 1.4);
      b.block(0.2, 2.6, 0.2, COL.white, s * 1.4, 0, -1.4);
    });
    for (let i = 0; i < 6; i++) b.block(1.0, 0.08, 0.3, COL.white, 0, i * 0.44, 2.0 + i * 0.3);
  },
  civil_heli: (b) => {
    b.sphere(1.2, 10, 8, COL.paintBase, 0, 1.4, 0.6, { sz: 1.5, sy: 0.9, paint: 1 })
      .sphere(0.9, 8, 6, COL.glassDark, 0, 1.6, 1.6, { sz: 0.8, noAO: true })
      .cyl(0.3, 0.16, 4.2, 6, COL.paintBase, 0, 1.6, -2.6, { rx: HALF_PI, paint: 1 })
      .box(0.08, 1.2, 0.8, COL.paintBase, 0, 2.1, -4.5, { paint: 1 })
      .cyl(0.1, 0.1, 0.5, 5, COL.darkMetal, 0, 2.6, 0.5)
      .box(9, 0.04, 0.3, COL.darkMetal, 0, 2.85, 0.5, { ry: 0.4 })
      .box(9, 0.04, 0.3, COL.darkMetal, 0, 2.85, 0.5, { ry: 0.4 + HALF_PI });
    b.mirrorX((s) => {
      b.box(0.1, 0.1, 3.0, COL.chrome, s * 0.8, 0.06, 0.6);
      b.strut(s * 0.8, 0.06, 1.4, s * 0.6, 0.8, 1.2, 0.04, COL.chrome);
      b.strut(s * 0.8, 0.06, -0.3, s * 0.6, 0.8, -0.2, 0.04, COL.chrome);
    });
  },
  shark: (b) => {
    const g = 0x6c7a89;
    b.sphere(0.6, 10, 8, g, 0, 0.45, 0, { sz: 2.8, sy: 0.75 })
      .box(0.9, 0.08, 0.9, 0xe8ecef, 0, 0.14, 0.5)
      .cone(0.25, 0.9, 4, g, 0, 1.1, -0.1, { sz: 1.6, rx: -0.3 })
      .cone(0.3, 1.0, 4, g, 0, 0.8, -1.9, { rx: -2.2, sz: 0.4 })
      .cone(0.25, 0.8, 4, g, 0, 0.3, -1.9, { rx: -1.0, sz: 0.4 })
      .box(0.5, 0.05, 0.1, 0xffffff, 0, 0.3, 1.5)
      .box(0.08, 0.08, 0.08, 0x111111, 0.32, 0.6, 1.2)
      .box(0.08, 0.08, 0.08, 0x111111, -0.32, 0.6, 1.2);
    b.mirrorX((s) => b.box(0.9, 0.06, 0.4, g, s * 0.7, 0.3, 0.3, { rz: s * -0.4, ry: s * 0.4 }));
  },
  pink_dolphin: (b) => {
    const p = 0xf4a3b8;
    b.sphere(0.5, 10, 8, p, 0, 0.35, 0, { sz: 2.2, sy: 0.7 })
      .cyl(0.08, 0.12, 0.7, 6, p, 0, 0.35, 1.3, { rx: HALF_PI })
      .sphere(0.3, 8, 6, 0xf7b9c9, 0, 0.55, 0.7)
      .cone(0.18, 0.4, 4, p, 0, 0.8, -0.1, { sz: 1.8 })
      .box(0.9, 0.06, 0.3, p, 0, 0.3, -1.2, { ry: 0 })
      .box(0.07, 0.07, 0.07, 0x111111, 0.2, 0.62, 0.85)
      .box(0.07, 0.07, 0.07, 0x111111, -0.2, 0.62, 0.85);
  },

  // ───────────── tier 5-8 casas e barcos grandes
  floating_house: (b) => {
    for (let i = 0; i < 5; i++) b.cyl(0.35, 0.35, 9, 7, 0x8a6a45, -3 + i * 1.5, 0.2, 0, { rx: HALF_PI });
    b.block(7.4, 0.2, 9.2, COL.woodLight, 0, 0.5, 0)
      .block(6, 2.8, 6, COL.paintBase, 0, 0.7, -0.8, P)
      .prism(6.6, 1.6, 6.6, 0xb0b8bf, 0, 3.5, -0.8, { ry: HALF_PI })
      .block(1.0, 2.0, 0.06, COL.wood, 1.2, 0.7, 2.22)
      .block(1.2, 0.9, 0.06, COL.glass, -1.5, 1.8, 2.22, { noAO: true })
      .box(7.4, 0.06, 0.06, COL.wood, 0, 1.6, 4.5);
    b.strut(-2.5, 3.2, 3.4, 1.5, 2.6, 3.4, 0.14, 0xe63946, 5, { sx: 1 });
    b.block(0.8, 0.4, 3.0, 0xc9a26b, 3.6, 0.1, 5.0, { ry: 0.3 });
  },
  stilt_house: (b) => {
    const H = 2.6;
    for (let x = -3; x <= 3; x += 2) for (let z = -3; z <= 3; z += 2) b.block(0.2, H, 0.2, COL.wood, x, 0, z);
    b.block(7.6, 0.2, 7.8, COL.woodLight, 0, H, 0)
      .block(6.4, 2.8, 6.2, COL.paintBase, 0, H + 0.2, -0.4, P)
      .prism(7.0, 1.8, 7.0, 0x9aa5ab, 0, H + 3.0, -0.4, { ry: HALF_PI })
      .block(1.0, 2.0, 0.06, COL.wood, 1.0, H + 0.2, 2.72)
      .block(1.1, 0.9, 0.06, COL.glass, -1.6, H + 1.3, 2.72, { noAO: true });
    for (let i = 0; i < 6; i++) b.block(1.0, 0.08, 0.36, COL.wood, 2.6, i * 0.43, 3.9 + i * 0.36);
    b.box(7.6, 0.06, 0.06, COL.wood, 0, H + 1.1, 3.85);
  },
  colonial_house: (b) => {
    const W = 6.4;
    const D = 9;
    b.block(W, 3.4, D, COL.paintBase, 0, 0, 0, P)
      .block(W, 3.2, D, COL.paintBase, 0, 3.4, 0, P)
      .block(W + 0.2, 0.2, D + 0.2, COL.white, 0, 3.3, 0)
      .block(W + 0.3, 0.35, D + 0.2, COL.white, 0, 6.6, 0)
      .prism(W + 0.4, 1.6, D + 0.2, COL.terracotta, 0, 6.95, 0, { ry: HALF_PI });
    // colonial doors/windows with white frames, iron balcony on the upper floor
    for (let i = 0; i < 3; i++) {
      const x = -2 + i * 2;
      b.block(1.0, 2.4, 0.06, i === 1 ? 0x2a6f5c : 0x7a3b2e, x, 0.1, D / 2 + 0.03)
        .block(1.2, 0.18, 0.1, COL.white, x, 2.5, D / 2 + 0.05)
        .block(0.95, 2.0, 0.06, 0x2a6f5c, x, 4.0, D / 2 + 0.03)
        .block(1.15, 0.16, 0.1, COL.white, x, 6.05, D / 2 + 0.05);
    }
    b.block(W - 0.4, 0.1, 0.8, COL.concreteLight, 0, 3.8, D / 2 + 0.4)
      .block(W - 0.4, 0.8, 0.04, 0x1d1d21, 0, 3.9, D / 2 + 0.8)
      .block(W - 0.1, 0.16, 0.12, COL.white, 0, 0, D / 2 + 0.05);
    b.mirrorX((s) => b.block(0.3, 6.6, 0.12, COL.white, s * (W / 2 - 0.1), 0, D / 2 + 0.05));
  },
  river_boat: (b) => {
    const L = 24;
    const W = 6;
    hull(b, L, W, 1.8, COL.white, COL.woodLight, 0x1d6fa5);
    const decks: Array<[number, number]> = [
      [1.88, 17],
      [4.6, 15],
      [7.3, 11],
    ];
    decks.forEach(([y, len], k) => {
      b.block(W - 0.2, 0.2, len, COL.white, 0, y + 2.5, -1.5 - k * 0.5);
      b.block(W - 0.1, 0.35, len, 0x1d6fa5, 0, y + 2.52, -1.5 - k * 0.5);
      for (let z = -len / 2; z <= len / 2; z += 2) b.mirrorX((s) => b.block(0.14, 2.5, 0.14, COL.white, s * (W / 2 - 0.25), y, -1.5 - k * 0.5 + z));
      // hammocks
      const hc = [0xe63946, 0x06d6a0, 0xffd166, 0x118ab2, 0x8338ec];
      if (k < 2) for (let i = 0; i < 5; i++) b.box(W - 1.2, 0.3, 0.5, hc[(i + k) % 5] as number, 0, y + 1.3, -7 + i * 2.8 - k, { rz: 0.06 });
    });
    b.block(3.2, 1.6, 3.0, COL.white, 0, 9.85, 3.5)
      .box(3.0, 0.7, 0.06, COL.glassDark, 0, 10.9, 5.0, { noAO: true })
      .cyl(0.25, 0.25, 2.5, 6, 0x1d3557, 0, 11.6, -4);
  },
  trio: (b, ctx) => {
    const L = 16;
    b.block(2.6, 1.4, 3.2, 0xe63946, 0, 0.6, L / 2 - 1.2)
      .box(2.4, 0.9, 0.06, COL.glassDark, 0, 2.3, L / 2 + 0.41, { noAO: true })
      .block(3.2, 4.4, L - 3.4, 0x1d1d21, 0, 0.8, -1.3)
      .block(3.4, 0.3, L - 3.2, 0xffd166, 0, 5.2, -1.3)
      .quad(10, 1.1, COL.white, 1.62, 3.2, -1.3, { ry: HALF_PI, uv: ctx.atlas.get('trio'), emit: 0.4 })
      .quad(10, 1.1, COL.white, -1.62, 3.2, -1.3, { ry: -HALF_PI, uv: ctx.atlas.get('trio'), emit: 0.4 });
    for (let i = 0; i < 5; i++)
      b.mirrorX((s) => {
        b.cyl(0.4, 0.4, 0.06, 10, 0x3b3b40, s * 1.63, 1.6 + (i % 2) * 0.9, -6 + i * 2.2, { rz: HALF_PI });
      });
    const lights = [0xff006e, 0x3a86ff, 0x06d6a0, 0xffbe0b];
    for (let i = 0; i < 8; i++) b.box(0.3, 0.3, 0.3, lights[i % 4] as number, -1.3 + (i % 2) * 2.6, 5.7, -7 + i * 1.6, { emit: 1.2, noAO: true });
    b.mirrorX((s) => b.block(0.08, 1.1, L - 3.4, 0xc0c4ca, s * 1.65, 5.5, -1.3));
    for (let i = 0; i < 4; i++) person(b, -0.8 + (i % 2) * 1.6, 5.5, -4 + i * 2, [0xffd166, 0xff595e, 0x2ec4b6, 0xffffff][i] as number);
    for (let i = 0; i < 4; i++)
      b.mirrorX((s) => b.cyl(0.55, 0.55, 0.4, 10, COL.tire, s * 1.4, 0.55, [L / 2 - 1.5, 1.5, -3.5, -6.5][i] as number, { rz: HALF_PI }));
  },
  kapok: (b) => {
    const bark = 0x9c9082;
    b.cyl(1.4, 2.2, 26, 9, bark, 0, 13, 0);
    // buttress roots
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.prism(0.5, 5, 5, 0x8a7e70, Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6, { ry: -a });
    }
    // umbrella crown
    const crown: Array<[number, number, number, number]> = [
      [0, 30, 0, 9],
      [6, 28, 3, 6],
      [-6, 28.5, -2, 6.5],
      [2, 29, -6, 6],
      [-3, 27.5, 6, 5.5],
    ];
    for (const [x, y, z, r] of crown) b.ico(r, 1, x % 2 ? COL.leafDark : COL.leaf, x, y, z, { sy: 0.45 });
    b.strut(0, 22, 0, 6, 27, 3, 0.6, bark).strut(0, 23, 0, -6, 27.5, -2, 0.6, bark).strut(0, 24, 0, 2, 28, -6, 0.5, bark);
  },
  pilotis_block: (b, ctx) => {
    const L = 36;
    const D = 12;
    const piloti = 3.2;
    const floors = 6;
    const fh = 3;
    for (let x = -L / 2 + 2; x <= L / 2 - 2; x += 5.6) b.mirrorX((s) => b.block(0.7, piloti, 0.7, COL.concreteLight, x, 0, s * (D / 2 - 1.2)));
    b.block(6, piloti - 0.2, 4, COL.glass, 0, 0, 0, { noAO: true })
      .block(L, floors * fh, D, COL.paintBase, 0, piloti, 0, P)
      .block(L + 0.4, 0.5, D + 0.4, COL.concrete, 0, piloti + floors * fh, 0);
    const win = ctx.atlas.get('windows');
    for (let f = 0; f < floors; f++) {
      const y = piloti + f * fh + 1.6;
      b.quad(L - 1, 1.6, COL.white, 0, y, D / 2 + 0.02, { uv: win })
        .quad(L - 1, 1.6, COL.white, 0, y, -D / 2 - 0.02, { uv: win, ry: Math.PI })
        .block(L + 0.2, 0.12, 0.6, COL.white, 0, piloti + f * fh, D / 2 + 0.3);
    }
    // cobogó screen on the stairwell
    b.block(4, floors * fh, 0.3, 0xe5dccd, L / 2 - 4, piloti, D / 2 + 0.2);
    for (let i = 0; i < floors * 3; i++) b.box(3.6, 0.12, 0.34, 0xc9bca6, L / 2 - 4, piloti + 0.5 + i, D / 2 + 0.2);
  },
};
