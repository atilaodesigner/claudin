import type { ModelBuilder } from '../ModelBuilder';
import { COL } from './palette';
import type { ModelFn } from './types';

/**
 * PACOTE BRASIL: street food, home stuff, bichos, carros de rua, carrinhos de
 * ambulante, caminhões, barcos, prédios de bairro e as lendas do folclore (secretos).
 * Same conventions as the other model files: meters, base at y=0, front facing +Z.
 */
const P = { paint: 1 };
const HALF_PI = Math.PI / 2;
const GLOW = { emit: 1.3, noAO: true };

function wheel(b: ModelBuilder, x: number, z: number, r = 0.34, w = 0.26): void {
  b.cyl(r, r, w, 8, COL.tire, x, r, z, { rz: HALF_PI }).cyl(r * 0.55, r * 0.55, w + 0.02, 6, COL.rim, x, r, z, { rz: HALF_PI });
}

function wheels4(b: ModelBuilder, hw: number, front: number, back: number, r = 0.34, w = 0.26): void {
  b.mirrorX((s) => {
    wheel(b, s * hw, front, r, w);
    wheel(b, s * hw, back, r, w);
  });
}

function carLights(b: ModelBuilder, hw: number, y: number, front: number, back: number): void {
  b.mirrorX((s) => {
    b.box(0.32, 0.16, 0.06, COL.headlight, s * (hw - 0.24), y, front, { emit: 1, noAO: true });
    b.box(0.28, 0.14, 0.06, COL.taillight, s * (hw - 0.22), y, back, { emit: 0.7, noAO: true });
  });
}

/** Boxy 80s/90s car body (Gol quadrado, Opala, Brasília...). */
function boxyCar(b: ModelBuilder, L: number, W: number, bodyH: number, cabinH: number, cabinLen: number, cabinZ: number, color = COL.paintBase, paint = true, low = 0.3): void {
  const o = paint ? P : {};
  const top = low + bodyH;
  b.block(W, bodyH, L, color, 0, low, 0, o)
    .block(W * 0.9, cabinH, cabinLen, COL.glassCar, 0, top, cabinZ, { noAO: true })
    .block(W * 0.92, 0.08, cabinLen * 0.92, color, 0, top + cabinH, cabinZ, o)
    .block(W * 0.92, cabinH, 0.12, color, 0, top, cabinZ + cabinLen / 2 - 0.06, o)
    .block(W * 0.92, cabinH, 0.12, color, 0, top, cabinZ - cabinLen / 2 + 0.06, o)
    .block(W + 0.04, 0.18, 0.16, COL.black, 0, low - 0.02, L / 2)
    .block(W + 0.04, 0.18, 0.16, COL.black, 0, low - 0.02, -L / 2);
  wheels4(b, W / 2 - 0.08, L / 2 - 0.75, -L / 2 + 0.75, 0.32, 0.24);
  carLights(b, W / 2, low + bodyH * 0.6, L / 2 + 0.01, -L / 2 - 0.01);
}

/** Cab-over truck cab facing +Z, front face at z. */
function truckCab(b: ModelBuilder, z: number, color: number, W = 2.4): void {
  b.block(W, 2.2, 2.0, color, 0, 0.7, z - 1.0)
    .box(W - 0.3, 0.8, 0.06, COL.glassDark, 0, 2.25, z + 0.01, { noAO: true })
    .block(W + 0.04, 0.3, 0.2, COL.darkMetal, 0, 0.5, z);
  b.mirrorX((s) => b.box(0.3, 0.18, 0.06, COL.headlight, s * (W / 2 - 0.3), 1.1, z + 0.02, { emit: 1, noAO: true }));
}

function truckWheels(b: ModelBuilder, zs: readonly number[], hw = 1.05): void {
  for (const z of zs) b.mirrorX((s) => wheel(b, s * hw, z, 0.5, 0.36));
}

function person(b: ModelBuilder, x: number, y: number, z: number, shirt: number, ry = 0): void {
  b.block(0.36, 0.8, 0.24, 0x2b2d42, x, y, z, { ry })
    .block(0.44, 0.62, 0.26, shirt, x, y + 0.8, z, { ry })
    .sphere(0.15, 6, 5, COL.skin[2], x, y + 1.6, z);
}

/** Street vendor cart: box on two wheels with a handle and a canopy. */
function vendorCart(b: ModelBuilder, body: number, trim: number, canopy: number | null): void {
  b.block(1.5, 0.9, 0.8, body, 0, 0.4, 0)
    .block(1.54, 0.1, 0.84, trim, 0, 1.3, 0)
    .strut(-0.75, 0.9, 0, -1.3, 0.95, 0, 0.03, COL.chrome)
    .box(0.06, 0.06, 0.7, COL.chrome, -1.3, 0.95, 0);
  b.mirrorX((s) => b.cyl(0.32, 0.32, 0.08, 10, COL.tire, 0.35, 0.32, s * 0.45, { rx: HALF_PI }));
  b.block(0.06, 0.4, 0.06, COL.darkMetal, -0.6, 0, 0);
  if (canopy !== null) {
    b.cyl(0.025, 0.025, 1.4, 4, COL.chrome, 0.6, 2.1, 0).cone(0.95, 0.45, 8, canopy, 0.6, 2.95, 0);
  }
}

function tree(b: ModelBuilder, trunkH: number, trunkR: number, crowns: ReadonlyArray<[number, number, number, number]>, leaf: number, leaf2: number, trunk = COL.trunk): void {
  b.cyl(trunkR * 0.7, trunkR, trunkH, 7, trunk, 0, trunkH / 2, 0);
  crowns.forEach(([x, y, z, r], i) => b.ico(r, 1, i % 2 ? leaf2 : leaf, x, y, z, { sy: 0.8 }));
}

function quadruped(b: ModelBuilder, L: number, W: number, H: number, legH: number, fur: number, head: number, headZ: number, headY: number, headR: number): void {
  b.box(W, H, L, fur, 0, legH + H / 2, 0).box(headR * 1.6, headR * 1.5, headR * 1.8, head, 0, headY, headZ);
  b.mirrorX((s) => {
    b.block(0.1 + W * 0.12, legH, 0.1 + W * 0.12, fur, s * (W / 2 - 0.08), 0, L / 2 - 0.15);
    b.block(0.1 + W * 0.12, legH, 0.1 + W * 0.12, fur, s * (W / 2 - 0.08), 0, -L / 2 + 0.15);
  });
}

export const BRASIL_MODELS: Record<string, ModelFn> = {
  // ───────────── tier 0 — comidinhas e miudezas
  pao_queijo: (b) => {
    b.cyl(0.38, 0.3, 0.2, 10, 0xb5835a, 0, 0.1, 0);
    const pts: Array<[number, number]> = [[0, 0], [0.18, 0.08], [-0.16, 0.12], [0.06, -0.2], [-0.1, -0.12], [0.2, -0.12], [-0.22, 0.02]];
    for (const [x, z] of pts) b.sphere(0.12, 7, 5, 0xf2c979, x, 0.26, z, { sy: 0.8 });
  },
  coxinha: (b) => {
    b.sphere(0.24, 8, 6, 0xd9892e, 0, 0.22, 0).cone(0.22, 0.34, 8, 0xd9892e, 0, 0.52, 0).sphere(0.05, 5, 4, 0xe8a24a, 0, 0.7, 0);
  },
  brigadeiro: (b) => {
    b.block(0.8, 0.06, 0.55, 0xf4f1e8, 0, 0, 0);
    for (let x = 0; x < 4; x++) for (let z = 0; z < 3; z++) b.cyl(0.08, 0.06, 0.05, 6, 0xe63946, -0.3 + x * 0.2, 0.08, -0.17 + z * 0.17).sphere(0.07, 6, 5, 0x3b1f14, -0.3 + x * 0.2, 0.15, -0.17 + z * 0.17);
  },
  guarana: (b) => {
    b.cyl(0.16, 0.16, 0.7, 8, 0x2a7a2a, 0, 0.35, 0, { noAO: true })
      .cyl(0.05, 0.16, 0.22, 8, 0x2a7a2a, 0, 0.81, 0, { noAO: true })
      .cyl(0.055, 0.055, 0.07, 6, 0x1e8f3a, 0, 0.95, 0)
      .cyl(0.162, 0.162, 0.2, 8, 0x1e8f3a, 0, 0.4, 0)
      .cyl(0.163, 0.163, 0.06, 8, 0xffd23f, 0, 0.4, 0);
  },
  marmita: (b) => {
    b.block(0.5, 0.16, 0.36, 0xc9ccd1, 0, 0, 0).block(0.52, 0.04, 0.38, 0xe2e4e8, 0, 0.16, 0).box(0.46, 0.02, 0.12, 0xfefefe, 0, 0.2, 0.08);
  },
  pipa: (b) => {
    b.cyl(0.01, 0.01, 1.8, 3, 0xf4f1e8, 0.3, 0.9, 0, { rz: 0.35 });
    b.box(0.9, 0.9, 0.02, COL.paintBase, 0, 1.9, 0, { rz: Math.PI / 4, paint: 1 })
      .box(0.02, 1.26, 0.03, 0x8a5a2e, 0, 1.9, 0.01)
      .box(1.26, 0.02, 0.03, 0x8a5a2e, 0, 1.9, 0.01);
    for (let i = 0; i < 4; i++) b.box(0.18, 0.05, 0.01, i % 2 ? 0xffd23f : 0xe63946, 0.05 * (i % 2), 1.1 - i * 0.14, 0, { rz: 0.4 * (i % 2 ? 1 : -1) });
  },
  radinho: (b) => {
    b.block(0.5, 0.3, 0.16, 0x3b2a1a, 0, 0, 0)
      .cyl(0.09, 0.09, 0.02, 10, 0xc9ccd1, -0.12, 0.15, 0.085, { rx: HALF_PI })
      .box(0.14, 0.08, 0.02, 0xfff1c1, 0.13, 0.19, 0.085, { emit: 0.4 })
      .strut(0.2, 0.3, 0, 0.35, 0.95, -0.05, 0.01, COL.chrome)
      .box(0.36, 0.04, 0.04, COL.darkMetal, 0, 0.34, 0);
  },
  vassoura: (b) => {
    b.cyl(0.02, 0.02, 1.3, 4, 0xd9b36c, 0, 0.65 + 0.3, 0, { rz: 0.2 }).cone(0.25, 0.4, 6, 0x8a6a3a, -0.02, 0.2, 0, { rx: Math.PI, sz: 0.4 });
  },
  garrafa_cafe: (b) => {
    b.cyl(0.14, 0.14, 0.5, 8, 0xe63946, 0, 0.25, 0).cyl(0.1, 0.14, 0.1, 8, 0xe63946, 0, 0.55, 0).cyl(0.08, 0.08, 0.08, 8, COL.white, 0, 0.64, 0).box(0.04, 0.3, 0.1, COL.white, 0.16, 0.32, 0);
  },
  copo_acai: (b) => {
    b.cyl(0.18, 0.13, 0.36, 10, 0xf4f1e8, 0, 0.18, 0)
      .sphere(0.18, 8, 5, 0x5a189a, 0, 0.36, 0, { sy: 0.5 })
      .sphere(0.07, 6, 4, 0xf2d17a, 0.06, 0.44, 0.04)
      .sphere(0.05, 6, 4, 0xff4d6d, -0.06, 0.44, -0.03)
      .cyl(0.01, 0.01, 0.4, 4, 0xffd23f, 0.05, 0.55, 0, { rz: 0.3 });
  },
  abacaxi: (b) => {
    b.sphere(0.22, 8, 7, 0xd9a21b, 0, 0.3, 0, { sy: 1.35 });
    for (let i = 0; i < 6; i++) b.cone(0.05, 0.4, 3, COL.leaf, Math.cos(i) * 0.06, 0.78, Math.sin(i) * 0.06, { rz: Math.cos(i) * 0.4, rx: Math.sin(i) * 0.4 });
  },
  melancia: (b) => {
    b.sphere(0.34, 12, 8, 0x3f8f3a, 0, 0.34, 0, { sz: 1.4 });
    for (let i = 0; i < 6; i++) b.sphere(0.35, 12, 8, 0x1c5a1e, 0, 0.34, 0, { sx: 0.12, sz: 1.4, rz: (i / 6) * Math.PI });
  },
  pandeiro: (b) => {
    b.cyl(0.32, 0.32, 0.1, 14, 0x8a5a2e, 0, 0.12, 0, { rx: 0.25 }).cyl(0.3, 0.3, 0.11, 14, 0xf4ecd8, 0, 0.13, 0.01, { rx: 0.25 });
    for (let i = 0; i < 5; i++) b.cyl(0.05, 0.05, 0.02, 6, COL.chrome, Math.cos(i * 1.26) * 0.33, 0.12, Math.sin(i * 1.26) * 0.33, { rz: HALF_PI });
  },
  berimbau: (b) => {
    b.cyl(0.02, 0.025, 1.9, 4, 0x8a5a2e, 0, 0.95, 0, { rz: 0.15 })
      .strut(0.04, 0.05, 0, 0.3, 1.85, 0, 0.006, 0xd3d7dc)
      .sphere(0.17, 8, 6, 0xc9a26b, 0.1, 0.35, 0.1, { sz: 0.9 });
  },
  pombo: (b) => {
    b.sphere(0.17, 7, 5, 0x8a929c, 0, 0.2, 0, { sz: 1.4 })
      .sphere(0.1, 6, 5, 0x6b7380, 0, 0.36, 0.17)
      .box(0.2, 0.05, 0.06, 0x5e8c7a, 0, 0.3, 0.1, { noAO: true })
      .cone(0.03, 0.08, 4, 0xe0a07a, 0, 0.35, 0.3, { rx: HALF_PI })
      .cone(0.12, 0.2, 4, 0x6b7380, 0, 0.2, -0.28, { rx: -HALF_PI, sz: 0.3 });
  },
  rapadura: (b) => {
    b.block(0.4, 0.18, 0.4, 0x8a4f1e, 0, 0, 0).block(0.42, 0.02, 0.42, 0xd9b36c, 0, 0.18, 0, { rz: 0.05 });
  },

  // ───────────── tier 1 — casa, quintal e bichos pequenos
  ventilador: (b) => {
    b.cyl(0.25, 0.28, 0.06, 10, 0x2b2d42, 0, 0.03, 0)
      .cyl(0.03, 0.03, 1.1, 5, COL.chrome, 0, 0.6, 0)
      .block(0.2, 0.2, 0.26, 0x2b2d42, 0, 1.1, -0.05)
      .torus(0.34, 0.02, 3, 16, 0xd3d7dc, 0, 1.2, 0.18)
      .cyl(0.34, 0.34, 0.02, 12, 0xd3d7dc, 0, 1.2, 0.08, { rx: HALF_PI });
    for (let i = 0; i < 3; i++) b.box(0.12, 0.3, 0.02, 0x4fc3f7, Math.cos(i * 2.09) * 0.15, 1.2 + Math.sin(i * 2.09) * 0.15, 0.14, { rz: i * 2.09 });
  },
  filtro_barro: (b) => {
    b.cyl(0.26, 0.2, 0.5, 10, 0xb5643c, 0, 0.25, 0)
      .cyl(0.24, 0.26, 0.45, 10, 0xc2653f, 0, 0.72, 0)
      .sphere(0.24, 10, 4, 0xc2653f, 0, 0.95, 0, { sy: 0.4 })
      .cyl(0.02, 0.02, 0.1, 4, COL.chrome, 0, 0.22, 0.26, { rx: HALF_PI });
  },
  tv_tubo: (b) => {
    b.block(0.9, 0.72, 0.72, 0x5a3b22, 0, 0, 0)
      .box(0.64, 0.5, 0.02, 0x2e4a5c, -0.08, 0.38, 0.37, { noAO: true })
      .cyl(0.04, 0.04, 0.03, 8, COL.chrome, 0.35, 0.5, 0.37, { rx: HALF_PI })
      .cyl(0.04, 0.04, 0.03, 8, COL.chrome, 0.35, 0.36, 0.37, { rx: HALF_PI })
      .strut(0, 0.72, 0, -0.35, 1.25, -0.05, 0.01, COL.chrome)
      .strut(0, 0.72, 0, 0.35, 1.25, -0.05, 0.01, COL.chrome)
      .sphere(0.05, 5, 4, COL.metal, 0, 0.74, 0);
  },
  carrinho_rolima: (b) => {
    b.block(0.6, 0.06, 1.2, 0xc79c6a, 0, 0.1, 0).block(0.9, 0.08, 0.08, 0x8a5a2e, 0, 0.1, 0.55).block(0.2, 0.3, 0.3, 0xc79c6a, 0, 0.16, -0.4);
    b.mirrorX((s) => {
      b.cyl(0.07, 0.07, 0.05, 8, COL.chrome, s * 0.45, 0.07, 0.55, { rz: HALF_PI });
      b.cyl(0.07, 0.07, 0.05, 8, COL.chrome, s * 0.3, 0.07, -0.5, { rz: HALF_PI });
    });
  },
  gaiola: (b) => {
    b.cyl(0.03, 0.03, 1.2, 4, COL.wood, 0, 0.6, 0)
      .block(0.5, 0.04, 0.4, COL.wood, 0, 1.2, 0);
    for (let i = 0; i < 6; i++) b.cyl(0.006, 0.006, 0.5, 3, COL.chrome, -0.22 + i * 0.09, 1.49, 0.2).cyl(0.006, 0.006, 0.5, 3, COL.chrome, -0.22 + i * 0.09, 1.49, -0.2);
    b.hipRoof(0.54, 0.2, 0.44, COL.wood, 0, 1.74, 0).sphere(0.07, 6, 5, 0xffd23f, 0, 1.36, 0);
  },
  tanque: (b) => {
    b.block(0.9, 0.85, 0.6, 0xd6d1c4, 0, 0, 0).block(0.8, 0.08, 0.2, 0xbdb7aa, 0, 0.85, -0.2, { rx: 0.2 }).block(0.8, 0.06, 0.4, 0x7fb6d6, 0, 0.8, 0.08, { noAO: true })
      .strut(0.3, 0.9, -0.28, 0.3, 1.2, -0.28, 0.02, COL.chrome)
      .strut(0.3, 1.2, -0.28, 0.3, 1.15, -0.1, 0.02, COL.chrome);
  },
  varal: (b) => {
    const cols = [0xe63946, 0xffffff, 0x3a86ff, 0xffd23f, 0x2ec4b6, 0xff924c];
    b.mirrorX((s) => b.block(0.06, 1.9, 0.06, COL.wood, s * 1.6, 0, 0));
    b.box(3.2, 0.015, 0.015, COL.white, 0, 1.85, 0);
    for (let i = 0; i < 6; i++) b.box(0.4, i % 2 ? 0.55 : 0.4, 0.02, cols[i] as number, -1.25 + i * 0.5, 1.85 - (i % 2 ? 0.28 : 0.2), 0);
  },
  rede_dormir: (b) => {
    b.mirrorX((s) => b.block(0.12, 1.8, 0.12, COL.wood, s * 1.6, 0, 0));
    b.sphere(0.8, 10, 6, 0xe63946, 0, 1.05, 0, { sx: 1.7, sy: 0.35, sz: 0.5 })
      .box(1.8, 0.06, 0.8, 0xffd23f, 0, 0.82, 0)
      .strut(-1.55, 1.7, 0, -1.1, 1.2, 0, 0.015, 0xf4ecd8)
      .strut(1.55, 1.7, 0, 1.1, 1.2, 0, 0.015, 0xf4ecd8);
  },
  papagaio: (b) => {
    b.block(0.05, 0.9, 0.05, COL.wood, 0, 0, 0)
      .box(0.5, 0.04, 0.04, COL.wood, 0, 0.9, 0)
      .box(0.15, 0.3, 0.16, 0x2a9d3a, 0, 1.08, 0)
      .sphere(0.09, 6, 5, 0x2a9d3a, 0, 1.28, 0.03)
      .box(0.12, 0.05, 0.1, 0xffd23f, 0, 1.3, 0.08)
      .box(0.06, 0.06, 0.06, 0x1d1d21, 0, 1.24, 0.13)
      .box(0.05, 0.28, 0.04, 0x1f7a2e, 0, 0.84, -0.06, { rx: 0.2 });
  },
  tucano: (b) => {
    b.block(0.06, 1.2, 0.06, COL.trunk, 0, 0, 0)
      .box(0.5, 0.05, 0.05, COL.trunk, 0, 1.2, 0)
      .box(0.2, 0.34, 0.2, 0x151515, 0, 1.42, 0)
      .box(0.16, 0.14, 0.02, COL.white, 0, 1.5, 0.1)
      .sphere(0.1, 6, 5, 0x151515, 0, 1.64, 0.02)
      .cone(0.08, 0.42, 5, 0xff8a1a, 0, 1.64, 0.3, { rx: HALF_PI })
      .box(0.06, 0.3, 0.06, 0x151515, 0, 1.18, -0.1, { rx: 0.25 });
  },
  mico: (b) => {
    const o = 0xf28c1a;
    b.block(0.07, 1.5, 0.07, COL.trunk, 0, 0, 0)
      .box(0.22, 0.3, 0.2, o, 0, 1.35, 0.1)
      .sphere(0.17, 7, 5, o, 0, 1.62, 0.12)
      .box(0.12, 0.1, 0.02, 0x3b2014, 0, 1.6, 0.27)
      .strut(0, 1.22, 0.02, 0.1, 0.6, 0.2, 0.03, o);
  },
  tatu: (b) => {
    const c = 0x9a8570;
    b.sphere(0.34, 9, 6, c, 0, 0.3, 0, { sz: 1.4, sy: 0.85 });
    for (let i = 0; i < 5; i++) b.torus(0.3, 0.025, 3, 12, 0x7a6552, 0, 0.3, -0.24 + i * 0.12, { sy: 0.9 });
    b.cone(0.1, 0.35, 5, c, 0, 0.25, 0.56, { rx: HALF_PI }).cone(0.06, 0.4, 4, c, 0, 0.18, -0.6, { rx: -HALF_PI - 0.3 }).box(0.06, 0.12, 0.04, c, 0.07, 0.42, 0.44).box(0.06, 0.12, 0.04, c, -0.07, 0.42, 0.44);
  },
  tambor: (b) => {
    b.cyl(0.36, 0.36, 0.8, 12, COL.paintBase, 0, 0.4, 0, P)
      .cyl(0.38, 0.38, 0.06, 12, 0xffd23f, 0, 0.78, 0)
      .cyl(0.38, 0.38, 0.06, 12, 0xffd23f, 0, 0.03, 0)
      .cyl(0.35, 0.35, 0.02, 12, 0xf4ecd8, 0, 0.82, 0);
  },

  // ───────────── tier 2 — ambulantes, móveis largados e bichos médios
  carrinho_churros: (b, ctx) => {
    vendorCart(b, 0xf4f1e8, 0xe63946, 0xe63946);
    b.quad(1.3, 0.34, COL.white, 0, 0.9, 0.41, { uv: ctx.atlas.get('churros') });
    for (let i = 0; i < 4; i++) b.cyl(0.03, 0.03, 0.4, 5, 0xd98e3a, -0.4 + i * 0.12, 1.55, 0, { rz: 0.2 });
  },
  carrinho_picole: (b, ctx) => {
    b.block(1.1, 0.7, 0.7, 0xf4f6f8, 0, 0.3, 0).block(1.14, 0.08, 0.74, 0x3a86ff, 0, 1.0, 0).quad(0.9, 0.28, COL.white, 0, 0.7, 0.36, { uv: ctx.atlas.get('picole') });
    b.mirrorX((s) => b.cyl(0.14, 0.14, 0.05, 8, COL.tire, s * 0.4, 0.14, 0.2, { rz: HALF_PI }));
    b.strut(-0.55, 0.95, 0, -0.95, 1.05, 0, 0.025, COL.chrome).cyl(0.02, 0.02, 1.2, 4, COL.chrome, 0.4, 1.6, 0).cone(0.7, 0.35, 8, 0xffd23f, 0.4, 2.3, 0);
  },
  carrinho_hotdog: (b, ctx) => {
    vendorCart(b, 0xffd166, 0x9d0208, 0x9d0208);
    b.quad(1.3, 0.34, COL.white, 0, 0.9, 0.41, { uv: ctx.atlas.get('hot') }).cyl(0.2, 0.2, 0.2, 8, 0xc0c4ca, 0.3, 1.45, 0).cyl(0.14, 0.14, 0.2, 8, 0xe63946, -0.3, 1.45, 0);
  },
  carrinho_caldo: (b, ctx) => {
    b.block(1.8, 0.9, 0.9, 0x2a9d5a, 0, 0.2, 0).block(1.84, 0.08, 0.94, 0xffd23f, 0, 1.1, 0).quad(1.6, 0.34, COL.white, 0, 0.7, 0.46, { uv: ctx.atlas.get('caldo') });
    // moenda: two rollers and a flywheel
    b.block(0.6, 0.5, 0.5, 0x6b6b70, 0.4, 1.18, 0).cyl(0.1, 0.1, 0.55, 8, COL.chrome, 0.4, 1.5, 0, { rx: HALF_PI }).torus(0.4, 0.04, 4, 14, 0x2c2c2e, 0.75, 1.5, 0, { ry: HALF_PI });
    for (let i = 0; i < 4; i++) b.cyl(0.03, 0.03, 1.4, 5, 0xb5c46a, -0.5 + i * 0.08, 1.25, 0.2, { rz: HALF_PI - 0.2 });
    b.mirrorX((s) => b.cyl(0.22, 0.22, 0.08, 8, COL.tire, s * 0.6, 0.22, 0.48, { rx: HALF_PI }));
  },
  geladeira: (b) => {
    b.block(0.75, 1.7, 0.7, COL.paintBase, 0, 0.05, 0, P)
      .sphere(0.37, 8, 4, COL.paintBase, 0, 1.75, 0, { sy: 0.2, sz: 0.9, paint: 1 })
      .box(0.73, 0.02, 0.02, 0x9aa4b0, 0, 1.2, 0.36)
      .box(0.05, 0.3, 0.05, COL.chrome, 0.3, 0.9, 0.38)
      .box(0.05, 0.15, 0.05, COL.chrome, 0.3, 1.4, 0.38);
  },
  sofa: (b) => {
    const c = COL.paintBase;
    b.block(2.0, 0.45, 0.85, c, 0, 0.1, 0, P)
      .block(2.0, 0.6, 0.22, c, 0, 0.5, -0.32, P)
      .block(0.22, 0.35, 0.85, c, 0.95, 0.5, 0, P)
      .block(0.22, 0.35, 0.85, c, -0.95, 0.5, 0, P)
      .box(0.9, 0.12, 0.7, 0xe7e0d0, -0.45, 0.6, 0.05, { rz: 0.05 })
      .box(0.9, 0.12, 0.7, 0xe7e0d0, 0.45, 0.6, 0.05, { rz: -0.1 });
  },
  sinuca: (b) => {
    b.block(2.4, 0.12, 1.4, 0x1f7a3e, 0, 0.8, 0)
      .block(2.6, 0.14, 1.6, 0x6b3a1f, 0, 0.72, 0)
      .block(2.1, 0.5, 1.1, 0x5a3016, 0, 0.22, 0)
      .sphere(0.05, 6, 4, COL.white, 0.5, 0.97, 0)
      .sphere(0.05, 6, 4, COL.red, -0.4, 0.97, 0.2)
      .sphere(0.05, 6, 4, COL.yellow, -0.5, 0.97, -0.1)
      .sphere(0.05, 6, 4, COL.blue, -0.45, 0.97, 0.05)
      .cyl(0.015, 0.02, 1.5, 4, 0xd9b36c, 0.9, 1.0, 0.2, { rz: HALF_PI - 0.05, ry: 0.3 });
    b.mirrorX((s) => {
      b.block(0.15, 0.22, 0.15, 0x5a3016, s * 1.1, 0, 0.6);
      b.block(0.15, 0.22, 0.15, 0x5a3016, s * 1.1, 0, -0.6);
    });
  },
  cama_elastica: (b) => {
    b.cyl(1.6, 1.6, 0.05, 20, 0x1d1d21, 0, 0.8, 0).torus(1.65, 0.08, 4, 22, 0x3a86ff, 0, 0.82, 0, { rx: HALF_PI });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.block(0.06, 0.8, 0.06, COL.chrome, Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6).cyl(0.025, 0.025, 1.6, 4, COL.chrome, Math.cos(a) * 1.65, 1.6, Math.sin(a) * 1.65);
    }
    b.torus(1.65, 0.03, 3, 22, COL.chrome, 0, 2.4, 0, { rx: HALF_PI });
  },
  bode: (b) => {
    quadruped(b, 0.9, 0.36, 0.42, 0.45, 0xece6d8, 0xe0d9c8, 0.55, 1.05, 0.14);
    b.cone(0.04, 0.3, 4, 0x6b5a45, 0.06, 1.3, 0.48, { rx: -0.6 }).cone(0.04, 0.3, 4, 0x6b5a45, -0.06, 1.3, 0.48, { rx: -0.6 }).cone(0.05, 0.14, 4, 0xd9d0bc, 0, 0.86, 0.66, { rx: Math.PI });
  },
  jegue: (b) => {
    quadruped(b, 1.3, 0.45, 0.6, 0.7, 0x8a7f74, 0x8a7f74, 0.85, 1.45, 0.18);
    b.box(0.14, 0.4, 0.1, 0x8a7f74, 0, 1.25, 0.6, { rx: 0.5 })
      .box(0.08, 0.32, 0.05, 0x6b625a, 0.08, 1.72, 0.78, { rx: -0.3 })
      .box(0.08, 0.32, 0.05, 0x6b625a, -0.08, 1.72, 0.78, { rx: -0.3 })
      .box(0.22, 0.18, 0.2, 0xd9d0bc, 0, 1.36, 1.02)
      .box(0.6, 0.06, 0.7, 0xc2653f, 0, 1.32, 0);
  },
  porco: (b) => {
    const p = 0xf4a3a8;
    b.sphere(0.4, 9, 7, p, 0, 0.5, 0, { sz: 1.5, sy: 0.85 }).cyl(0.14, 0.14, 0.12, 8, 0xe88990, 0, 0.5, 0.64, { rx: HALF_PI }).cone(0.07, 0.14, 3, p, 0.14, 0.82, 0.4).cone(0.07, 0.14, 3, p, -0.14, 0.82, 0.4);
    b.mirrorX((s) => {
      b.block(0.1, 0.2, 0.1, p, s * 0.18, 0, 0.3);
      b.block(0.1, 0.2, 0.1, p, s * 0.18, 0, -0.3);
    });
  },
  tamandua: (b) => {
    const c = 0x5c4a3a;
    b.sphere(0.35, 8, 6, c, 0, 0.6, 0, { sz: 1.8, sy: 0.9 })
      .cone(0.12, 0.8, 6, 0x6b5a48, 0, 0.55, 0.95, { rx: HALF_PI + 0.2 })
      .box(0.72, 0.12, 0.5, 0x1d1d21, 0, 0.62, 0.1, { rx: 0.5, sz: 1 })
      .box(0.12, 0.55, 1.1, 0x3b3026, 0, 0.55, -1.0, { rx: 0.35 });
    b.mirrorX((s) => {
      b.block(0.12, 0.35, 0.12, c, s * 0.2, 0, 0.35);
      b.block(0.12, 0.35, 0.12, c, s * 0.2, 0, -0.35);
    });
  },
  caixa_eletronico: (b, ctx) => {
    b.block(1.0, 2.0, 0.8, 0x1d4ed8, 0, 0, 0)
      .box(0.5, 0.36, 0.02, 0x7fdcff, 0, 1.35, 0.41, { emit: 0.8, noAO: true })
      .block(0.6, 0.06, 0.2, 0x2b2d42, 0, 0.95, 0.45)
      .quad(0.9, 0.24, COL.white, 0, 1.8, 0.41, { uv: ctx.atlas.get('atm') });
  },
  moto_entrega: (b) => {
    b.cyl(0.3, 0.3, 0.12, 8, COL.tire, 0, 0.3, 0.7, { rz: HALF_PI })
      .cyl(0.3, 0.3, 0.12, 8, COL.tire, 0, 0.3, -0.65, { rz: HALF_PI })
      .block(0.3, 0.35, 1.0, 0xe63946, 0, 0.45, 0)
      .strut(0, 0.5, 0.6, 0, 1.15, 0.5, 0.04, COL.darkMetal)
      .box(0.7, 0.04, 0.04, COL.black, 0, 1.15, 0.5);
    person(b, 0, 0.6, -0.05, 0xe63946);
    b.sphere(0.2, 8, 6, 0xe63946, 0, 2.2, -0.05, { sy: 0.9 }).block(0.6, 0.55, 0.55, 0xe63946, 0, 0.9, -0.65).box(0.62, 0.1, 0.57, COL.white, 0, 1.25, -0.65);
  },
  canoa: (b) => {
    b.sphere(0.5, 10, 6, 0x6b4a2f, 0, 0.25, 0, { sz: 5, sy: 0.5 })
      .sphere(0.42, 10, 4, 0x3b2a1a, 0, 0.36, 0, { sz: 4.6, sy: 0.3 })
      .box(0.7, 0.05, 0.2, COL.woodLight, 0, 0.4, 0.4)
      .box(0.1, 0.04, 1.2, COL.woodLight, 0.3, 0.5, -0.6, { rx: 0.4, ry: 0.3 });
  },
  mandacaru: (b) => {
    const g = 0x4f8a4a;
    b.cyl(0.25, 0.28, 3.6, 8, g, 0, 1.8, 0);
    b.mirrorX((s) => {
      b.cyl(0.18, 0.18, 0.8, 7, g, s * 0.45, 1.5, 0, { rz: HALF_PI });
      b.cyl(0.18, 0.2, 1.6, 7, g, s * 0.8, 2.2, 0);
    });
    b.sphere(0.25, 7, 5, g, 0, 3.6, 0).sphere(0.12, 6, 5, 0xff4d8a, 0.15, 3.8, 0.1).sphere(0.12, 6, 5, 0xff4d8a, -0.8, 3.1, 0);
  },

  // ───────────── tier 3 — carros de rua e bichos grandes
  quadradinho: (b) => {
    boxyCar(b, 3.8, 1.64, 0.6, 0.55, 1.9, -0.25, COL.paintBase, true, 0.16);
    b.mirrorX((s) => b.box(0.06, 0.06, 3.6, COL.black, s * 0.83, 0.5, 0));
  },
  brasilia_amarela: (b) => {
    boxyCar(b, 4.0, 1.66, 0.56, 0.62, 2.3, -0.1, 0xf3c332, false, 0.3);
    b.block(1.4, 0.06, 1.8, COL.chrome, 0, 1.52, -0.1);
  },
  uno_escada: (b) => {
    boxyCar(b, 3.7, 1.6, 0.62, 0.6, 1.9, -0.2);
    b.mirrorX((s) => b.box(0.05, 0.05, 2.0, COL.darkMetal, s * 0.6, 1.62, -0.2));
    b.mirrorX((s) => b.box(0.06, 0.06, 3.4, 0xc0c4ca, s * 0.24, 1.7, -0.2));
    for (let i = 0; i < 8; i++) b.box(0.48, 0.05, 0.05, 0xc0c4ca, 0, 1.7, -1.8 + i * 0.45);
  },
  opala: (b) => {
    boxyCar(b, 4.8, 1.78, 0.56, 0.5, 2.0, -0.35);
    b.block(1.66, 0.06, 1.86, 0x1d1d21, 0, 1.46, -0.35);
    b.mirrorX((s) => b.box(0.04, 0.04, 4.6, COL.chrome, s * 0.9, 0.6, 0));
  },
  carro_pamonha: (b, ctx) => {
    boxyCar(b, 3.8, 1.64, 0.6, 0.55, 1.9, -0.25, 0xf4f1e8, false);
    b.block(1.0, 0.1, 0.6, COL.darkMetal, 0, 1.5, -0.25)
      .cone(0.28, 0.5, 8, 0xd3d7dc, 0.3, 1.85, -0.1, { rx: HALF_PI + 0.2 })
      .cone(0.28, 0.5, 8, 0xd3d7dc, -0.3, 1.85, -0.4, { rx: -HALF_PI - 0.2 })
      .mirrorX((s) => b.quad(3.2, 0.3, COL.white, s * 0.83, 0.62, 0, { ry: s * HALF_PI, uv: ctx.atlas.get('pamonha') }));
  },
  jetski: (b) => {
    b.sphere(0.6, 10, 6, 0xffd23f, 0, 0.35, 0, { sz: 2.6, sy: 0.5, sx: 0.8 })
      .block(0.4, 0.3, 1.0, 0x1d1d21, 0, 0.5, -0.3)
      .strut(0, 0.6, 0.6, 0, 1.05, 0.35, 0.05, 0x1d1d21)
      .box(0.7, 0.05, 0.05, 0x1d1d21, 0, 1.05, 0.35)
      .box(0.9, 0.12, 2.2, 0x3a86ff, 0, 0.3, 0);
  },
  onca: (b) => {
    const y = 0xe0a23a;
    b.sphere(0.42, 9, 7, y, 0, 0.75, 0, { sz: 2.1, sy: 0.8 })
      .sphere(0.3, 8, 6, y, 0, 1.0, 0.95)
      .box(0.26, 0.14, 0.12, 0xf2d7a0, 0, 0.9, 1.2)
      .cone(0.08, 0.12, 3, y, 0.16, 1.28, 0.9)
      .cone(0.08, 0.12, 3, y, -0.16, 1.28, 0.9)
      .strut(0, 0.9, -0.8, 0, 0.3, -1.5, 0.06, y);
    const spots: Array<[number, number, number]> = [[0.3, 0.95, 0.3], [-0.3, 0.9, -0.2], [0.2, 1.05, -0.5], [-0.25, 1.0, 0.45], [0.33, 0.8, -0.6], [0, 1.08, 0]];
    for (const [x, yy, z] of spots) b.sphere(0.09, 5, 4, 0x2b1d10, x, yy, z, { sy: 0.4 });
    b.mirrorX((s) => {
      b.block(0.16, 0.5, 0.16, y, s * 0.22, 0, 0.6);
      b.block(0.16, 0.5, 0.16, y, s * 0.22, 0, -0.6);
    });
  },
  boi_bumba: (b) => {
    // a costume-ox with a skirt and a dancer's legs underneath
    b.cyl(1.0, 1.2, 1.0, 12, 0x1d4ed8, 0, 0.5, 0)
      .sphere(0.9, 10, 7, 0x151515, 0, 1.3, 0, { sz: 1.5, sy: 0.6 })
      .sphere(0.35, 8, 6, 0x151515, 0, 1.6, 1.3)
      .cone(0.07, 0.6, 5, COL.white, 0.3, 2.0, 1.3, { rz: -0.8 })
      .cone(0.07, 0.6, 5, COL.white, -0.3, 2.0, 1.3, { rz: 0.8 })
      .sphere(0.12, 6, 5, 0xffd23f, 0, 1.55, 0.3, { emit: 0.5 })
      .sphere(0.1, 6, 5, 0xe63946, 0.35, 1.5, -0.2, { emit: 0.4 })
      .sphere(0.1, 6, 5, 0x2ec4b6, -0.35, 1.5, 0.2, { emit: 0.4 });
    for (let i = 0; i < 12; i++) b.box(0.12, 0.8, 0.02, [0xe63946, 0xffd23f, 0x2ec4b6][i % 3] as number, Math.cos(i * 0.52) * 1.13, 0.55, Math.sin(i * 0.52) * 1.13, { ry: HALF_PI - i * 0.52 });
  },
  cajueiro: (b) => {
    tree(b, 2.2, 0.35, [[0, 3.4, 0, 2.4], [1.8, 3.0, 0.6, 1.6], [-1.6, 3.1, -0.4, 1.7]], 0x3f8f3a, 0x4fa34a, 0x6b4a2f);
    const f: Array<[number, number, number]> = [[1.2, 2.2, 1.2], [-1.0, 2.3, 1.1], [0.4, 2.1, -1.4], [-1.6, 2.4, -0.6]];
    for (const [x, y, z] of f) b.sphere(0.18, 6, 5, 0xff5a3a, x, y, z, { sy: 1.3 }).sphere(0.08, 5, 4, 0x8a5a2e, x, y - 0.25, z);
  },
  mangueira: (b) => {
    tree(b, 2.6, 0.45, [[0, 4.4, 0, 3.2], [2.0, 3.6, 1.0, 2.0], [-2.0, 3.8, -0.8, 2.1], [0.5, 5.6, -0.6, 2.0]], 0x2c6e33, 0x3f8f3a);
    const f: Array<[number, number, number]> = [[1.8, 2.6, 1.8], [-1.6, 2.8, 1.5], [0.8, 2.5, -2.2], [-2.3, 2.9, -0.8], [2.4, 2.8, -0.4]];
    for (const [x, y, z] of f) b.sphere(0.2, 6, 5, 0xffa62b, x, y, z, { sy: 1.25 });
  },
  jaqueira: (b) => {
    tree(b, 3.6, 0.5, [[0, 5.2, 0, 3.0], [1.8, 4.8, 1.2, 2.2], [-1.9, 5.0, -1.0, 2.3]], 0x2f6e30, 0x3b7f3a);
    const f: Array<[number, number, number]> = [[0.5, 2.2, 0.35], [-0.45, 2.8, 0.3], [0.3, 1.6, -0.5]];
    for (const [x, y, z] of f) b.sphere(0.3, 7, 5, 0x9aa83a, x, y, z, { sy: 1.5 });
  },
  relogio_rua: (b) => {
    b.cyl(0.12, 0.16, 4.2, 6, COL.darkMetal, 0, 2.1, 0)
      .block(1.8, 0.8, 0.3, 0x1d1d21, 0, 3.8, 0)
      .box(1.6, 0.6, 0.02, 0xff3b30, 0, 4.2, 0.16, { emit: 1.4, noAO: true })
      .box(1.6, 0.6, 0.02, 0xff3b30, 0, 4.2, -0.16, { emit: 1.4, noAO: true });
  },
  carroca: (b) => {
    // cart + donkey
    b.block(1.5, 0.5, 2.0, 0x8a5a2e, 0, 0.7, -1.0)
      .block(1.4, 0.08, 1.9, 0xc79c6a, 0, 0.72, -1.0)
      .strut(0.4, 0.95, 0, 0.3, 0.9, 1.4, 0.04, 0x8a5a2e)
      .strut(-0.4, 0.95, 0, -0.3, 0.9, 1.4, 0.04, 0x8a5a2e);
    b.mirrorX((s) => b.torus(0.55, 0.06, 4, 12, 0x6b4a2f, s * 0.82, 0.58, -1.0, { ry: HALF_PI }));
    for (let i = 0; i < 4; i++) b.sphere(0.25, 7, 5, [0x2f7a2a, 0xd9a21b, 0xe63946, 0x2f7a2a][i] as number, -0.4 + (i % 2) * 0.7, 1.35, -1.5 + Math.floor(i / 2) * 0.8);
    quadruped(b, 1.2, 0.42, 0.55, 0.65, 0x8a7f74, 0x8a7f74, 1.9, 1.35, 0.17);
    b.box(0.07, 0.3, 0.05, 0x6b625a, 0.08, 1.62, 2.0, { rx: -0.3 }).box(0.07, 0.3, 0.05, 0x6b625a, -0.08, 1.62, 2.0, { rx: -0.3 });
  },

  // ───────────── tier 4 — utilitários e roça
  lotacao: (b, ctx) => {
    const L = 5.3;
    b.block(2.0, 2.0, L, COL.paintBase, 0, 0.35, -0.1, P)
      .block(2.02, 0.12, L, 0x1d1d21, 0, 1.6, -0.1)
      .box(1.8, 0.7, 0.06, COL.glassDark, 0, 1.8, L / 2 - 0.08, { noAO: true })
      .block(2.02, 0.5, 4.0, COL.glassCar, 0, 1.55, -0.6, { noAO: true })
      .box(1.2, 0.26, 0.04, COL.white, 0, 2.2, L / 2 - 0.1, { uv: ctx.atlas.get('lotacao'), emit: 0.3 });
    wheels4(b, 0.92, L / 2 - 1.0, -L / 2 + 0.9, 0.36);
    carLights(b, 1.0, 0.75, L / 2 - 0.08, -L / 2 - 0.12);
  },
  trator: (b) => {
    b.block(1.2, 1.0, 2.4, 0xd62828, 0, 0.8, 0.3)
      .block(1.3, 0.9, 1.1, 0xd62828, 0, 1.0, -0.8)
      .block(1.2, 1.3, 1.0, COL.glassCar, 0, 1.9, -0.8, { noAO: true })
      .block(1.4, 0.08, 1.2, 0xd62828, 0, 3.2, -0.8)
      .cyl(0.06, 0.06, 1.1, 5, COL.darkMetal, 0.4, 2.2, 1.2);
    b.mirrorX((s) => {
      b.cyl(0.85, 0.85, 0.5, 12, COL.tire, s * 0.95, 0.85, -0.8, { rz: HALF_PI }).cyl(0.5, 0.5, 0.52, 8, 0xf3c332, s * 0.95, 0.85, -0.8, { rz: HALF_PI });
      b.cyl(0.45, 0.45, 0.3, 10, COL.tire, s * 0.75, 0.45, 1.2, { rz: HALF_PI }).cyl(0.25, 0.25, 0.32, 8, 0xf3c332, s * 0.75, 0.45, 1.2, { rz: HALF_PI });
    });
  },
  cacamba: (b) => {
    const c = 0xf77f00;
    b.block(2.0, 1.2, 3.4, c, 0, 0, 0).block(1.8, 0.4, 3.0, 0x8e897f, 0, 1.0, 0).block(2.1, 0.12, 3.5, 0xd96a00, 0, 1.2, 0);
    const junk: Array<[number, number, number, number]> = [[0.4, 1.4, 0.5, 0xb35a3c], [-0.5, 1.5, -0.6, 0xc9ccd1], [0.2, 1.55, -1.1, 0x8a5a2e], [-0.3, 1.45, 0.9, 0xf5f2ea]];
    for (const [x, y, z, col] of junk) b.box(0.6, 0.4, 0.5, col, x, y, z, { ry: x * 2 });
  },
  araucaria: (b) => {
    b.cyl(0.3, 0.45, 12, 7, 0x6b4a2f, 0, 6, 0);
    for (let k = 0; k < 3; k++) {
      const y = 9 + k * 1.3;
      const r = 3.6 - k * 0.9;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + k * 0.4;
        b.strut(0, y, 0, Math.cos(a) * r, y + 1.0, Math.sin(a) * r, 0.1, 0x6b4a2f).sphere(0.7, 6, 4, 0x2c5e30, Math.cos(a) * r, y + 1.2, Math.sin(a) * r, { sy: 0.45 });
      }
    }
    b.sphere(1.8, 8, 5, 0x2c5e30, 0, 12.6, 0, { sy: 0.35 });
  },

  // ───────────── tier 5 — caminhões do dia a dia
  caminhao_gas: (b) => {
    truckCab(b, 3.4, 0x1d4ed8);
    b.block(2.4, 0.3, 4.4, COL.darkMetal, 0, 0.8, -1.2);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) b.cyl(0.26, 0.26, 0.72, 8, COL.orange, -0.85 + c * 0.56, 1.46, -0.2 - r * 0.8).sphere(0.26, 8, 3, COL.orange, -0.85 + c * 0.56, 1.82, -0.2 - r * 0.8, { sy: 0.4 });
    b.mirrorX((s) => b.block(0.06, 1.0, 4.2, 0x1d4ed8, s * 1.2, 1.1, -1.2));
    truckWheels(b, [2.3, -2.6]);
  },
  caminhao_pipa: (b) => {
    truckCab(b, 3.6, 0xf4f1e8);
    b.block(2.4, 0.3, 5.0, COL.darkMetal, 0, 0.8, -1.3).cyl(1.1, 1.1, 4.8, 12, 0x2f7fd0, 0, 2.2, -1.4, { rx: HALF_PI }).block(0.8, 0.2, 0.8, 0x1f5fa0, 0, 3.3, -1.4).block(2.3, 0.1, 0.3, COL.chrome, 0, 0.9, -3.9);
    truckWheels(b, [2.5, -2.2, -3.2]);
  },
  caminhao_lixo: (b) => {
    truckCab(b, 3.8, 0xf4f1e8);
    b.block(2.5, 2.8, 5.0, 0x2a9d5a, 0, 0.8, -1.2).block(2.6, 2.4, 1.2, 0x238a4e, 0, 0.9, -4.2).box(2.0, 0.6, 0.3, 0x1d1d21, 0, 1.4, -4.85);
    b.mirrorX((s) => b.box(0.02, 0.3, 4.8, COL.white, s * 1.26, 2.6, -1.2));
    person(b, 1.0, 0.6, -5.0, 0xff924c);
    truckWheels(b, [2.7, -2.0, -3.1]);
  },
  betoneira: (b) => {
    truckCab(b, 3.6, 0xf3c332);
    b.block(2.4, 0.3, 5.0, COL.darkMetal, 0, 0.8, -1.3)
      .sphere(1.25, 12, 8, 0xe7e0d0, 0, 2.5, -1.5, { sz: 2.0, rx: -0.2 })
      .cyl(0.5, 0.2, 0.8, 8, 0xe7e0d0, 0, 3.0, -3.9, { rx: -1.3 });
    for (let i = 0; i < 4; i++) b.torus(1.2, 0.05, 3, 16, 0xf77f00, 0, 2.5 + (i - 1.5) * 0.25, -1.5 + (i - 1.5) * 0.9, { rx: HALF_PI - 0.2 });
    truckWheels(b, [2.5, -2.2, -3.2]);
  },
  onibus_excursao: (b, ctx) => {
    const L = 12;
    b.block(2.6, 3.2, L, 0xf4f6f8, 0, 0.5, 0)
      .block(2.64, 0.9, L - 1, COL.glassDark, 0, 2.2, -0.3, { noAO: true })
      .box(2.4, 1.3, 0.06, COL.glassDark, 0, 2.5, L / 2 + 0.01, { noAO: true })
      .quad(8, 0.5, COL.white, 1.33, 1.3, -0.5, { ry: HALF_PI, uv: ctx.atlas.get('excursao') })
      .quad(8, 0.5, COL.white, -1.33, 1.3, -0.5, { ry: -HALF_PI, uv: ctx.atlas.get('excursao') })
      .block(2.0, 0.6, 3.0, 0xd6d1c4, 0, 3.7, -2.0);
    b.mirrorX((s) => b.box(0.02, 0.2, L, 0xf77f00, s * 1.31, 1.0, 0));
    truckWheels(b, [L / 2 - 2, -L / 2 + 2.2, -L / 2 + 3.4], 1.1);
  },

  // ───────────── tier 6 — casinhas e comércio de bairro
  capela: (b) => {
    b.block(6, 4.5, 9, COL.white, 0, 0, 0)
      .prism(6.6, 2.6, 9.4, COL.terracotta, 0, 4.5, 0, { ry: HALF_PI })
      .block(2.6, 3.8, 2.6, COL.white, 0, 4.5, 3.9)
      .hipRoof(3.0, 1.8, 3.0, COL.terracotta, 0, 8.3, 3.9)
      .block(0.14, 1.2, 0.14, 0xffd23f, 0, 10.1, 3.9)
      .block(0.7, 0.14, 0.14, 0xffd23f, 0, 10.8, 3.9)
      .block(1.6, 2.8, 0.06, 0x2a6f5c, 0, 0, 4.53)
      .cyl(0.5, 0.5, 0.06, 10, 0x7fb6d6, 0, 6.8, 5.23, { rx: HALF_PI, emit: 0.2 })
      .cyl(0.35, 0.35, 0.5, 8, 0xc9a26b, 0, 6.0, 3.9);
    b.mirrorX((s) => b.block(0.9, 1.5, 0.06, 0x7fb6d6, s * 3.03, 1.6, 0, { ry: HALF_PI, noAO: true }));
  },
  borracharia: (b, ctx) => {
    b.block(9, 4.2, 8, 0xf3c332, 0, 0, 0)
      .block(9.4, 0.3, 8.4, 0x2b2d42, 0, 4.2, 0)
      .block(7, 3.2, 0.1, 0x3b3d42, 0, 0, 4.0)
      .quad(7, 1.0, COL.white, 0, 3.7, 4.06, { uv: ctx.atlas.get('borracharia') });
    for (let s = 0; s < 3; s++) for (let i = 0; i < 4 - s; i++) b.torus(0.5, 0.2, 5, 10, COL.tire, -2.5 + s * 1.3, 0.2 + i * 0.4, 5.6, { rx: HALF_PI });
    b.torus(0.8, 0.25, 5, 12, COL.tire, 3.4, 4.9, 4.2);
    b.block(1.2, 0.8, 0.6, 0xe63946, 3.0, 0, 5.3);
  },
  pau_a_pique: (b) => {
    b.block(6, 2.8, 5, 0xb5835a, 0, 0, 0)
      .prism(7, 1.9, 6.2, 0xc9b27a, 0, 2.8, 0, { ry: HALF_PI })
      .block(1.0, 2.0, 0.06, 0x6b4a2f, 0.8, 0, 2.53)
      .block(0.9, 0.8, 0.06, 0x3b2a1a, -1.6, 1.2, 2.53);
    for (let i = 0; i < 7; i++) b.box(0.08, 2.8, 0.06, 0x8a6a45, -2.8 + i * 0.9, 1.4, 2.52);
    b.block(1.1, 0.8, 0.8, COL.concreteDark, -2.2, 0, 3.4).cyl(0.2, 0.2, 1.2, 6, COL.concreteDark, -2.4, 1.3, 3.4);
  },

  // ───────────── tier 7 — festa, praça e água
  coreto: (b) => {
    b.cyl(5, 5.2, 1.2, 8, COL.concreteLight, 0, 0.6, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      b.cyl(0.14, 0.14, 3.6, 6, COL.white, Math.cos(a) * 4.4, 3.0, Math.sin(a) * 4.4);
    }
    b.torus(4.5, 0.08, 3, 16, COL.white, 0, 1.9, 0, { rx: HALF_PI })
      .cyl(0.5, 5.4, 2.4, 8, 0x2a9d5a, 0, 6.0, 0)
      .sphere(0.4, 8, 6, 0xffd23f, 0, 7.4, 0, { emit: 0.3 });
    for (let i = 0; i < 3; i++) person(b, -1.5 + i * 1.5, 1.2, 0, [0xe63946, 0x1d4ed8, 0xffffff][i] as number);
  },
  carro_alegorico: (b) => {
    const L = 16;
    b.block(6, 1.4, L, 0x5a189a, 0, 0.3, 0)
      .block(6.4, 0.4, L + 0.4, 0xffd23f, 0, 1.7, 0, { emit: 0.2 })
      .sphere(3.2, 12, 8, 0xff4fa3, 0, 5.0, -3.0, { sy: 1.2, emit: 0.15 })
      .sphere(1.6, 10, 7, 0xffd23f, 0, 9.0, -3.0, { emit: 0.35 })
      .cone(2.4, 6, 10, 0x2ec4b6, 0, 5.1, 4.0, { emit: 0.15 })
      .torus(3.4, 0.25, 6, 20, 0xffd23f, 0, 5.2, -3.0, { rx: 0.4, emit: 0.6 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      b.cone(0.3, 3, 4, [0xff006e, 0x3a86ff, 0xffbe0b, 0x06d6a0][i % 4] as number, Math.cos(a) * 3.8, 8.0, -3 + Math.sin(a) * 3.8, { rz: Math.cos(a) * 0.7, rx: -Math.sin(a) * 0.7, emit: 0.7, noAO: true });
    }
    for (let i = 0; i < 6; i++) person(b, -2.2 + (i % 3) * 2.2, 2.1, 5.5 - Math.floor(i / 3) * 12, [0xffd23f, 0xff4fa3, 0x2ec4b6][i % 3] as number);
    b.mirrorX((s) => {
      b.cyl(0.6, 0.6, 0.4, 10, COL.tire, s * 2.6, 0.6, 5.5, { rz: HALF_PI });
      b.cyl(0.6, 0.6, 0.4, 10, COL.tire, s * 2.6, 0.6, -5.5, { rz: HALF_PI });
    });
  },
  balsa: (b) => {
    const L = 30;
    const W = 11;
    b.block(W, 1.4, L, 0xe7e0d0, 0, 0, 0)
      .block(W - 1, 0.1, L - 2, COL.asphalt, 0, 1.4, 0)
      .block(W + 0.2, 0.3, L + 0.2, 0x1d6fa5, 0, 0.9, 0)
      .block(2.4, 5.0, 4, COL.white, W / 2 - 1.4, 1.5, -L / 2 + 3)
      .box(2.0, 0.8, 0.06, COL.glassDark, W / 2 - 1.4, 5.5, -L / 2 + 5.05, { noAO: true })
      .block(W, 0.4, 2.0, 0xf3c332, 0, 0, L / 2 + 1, { rx: -0.25 })
      .block(W, 0.4, 2.0, 0xf3c332, 0, 0, -L / 2 - 1, { rx: 0.25 });
    const cols = [0xd7263d, 0x1b4f9c, 0xf4f1e8, 0x2e8b57, 0xf2b705];
    for (let i = 0; i < 8; i++) {
      const x = -2.2 + (i % 2) * 2.6;
      const z = -8 + Math.floor(i / 2) * 5;
      b.block(1.7, 0.7, 3.8, cols[i % 5] as number, x, 1.8, z).block(1.5, 0.55, 1.9, COL.glassCar, x, 2.5, z - 0.2, { noAO: true });
    }
    b.block(1.0, 3.2, 1.0, COL.white, -W / 2 + 1.2, 1.5, 12).block(1.2, 0.2, 1.2, 0xe63946, -W / 2 + 1.2, 4.7, 12);
  },
  escuna: (b) => {
    const L = 18;
    const W = 5;
    b.block(W, 1.8, L * 0.72, 0x1d6fa5, 0, 0, -L * 0.14)
      .prism(W, L * 0.3, 1.8, 0x1d6fa5, 0, 0.9, L * 0.22, { rx: HALF_PI })
      .block(W - 0.2, 0.12, L * 0.7, COL.woodLight, 0, 1.8, -L * 0.14)
      .block(W - 0.6, 0.12, L * 0.6, COL.woodLight, 0, 4.2, -L * 0.2)
      .block(W - 1, 2.2, 5, COL.white, 0, 1.9, -4)
      .cyl(0.14, 0.16, 12, 6, COL.wood, 0, 7.8, 1.5)
      .box(0.06, 7, 5.5, 0xfff8e6, 0.05, 7.8, -1.4, { rx: 0.08 })
      .cone(0.05, 1, 3, 0xe63946, 0, 14.2, 1.5, { rz: HALF_PI, sy: 1 });
    for (let i = 0; i < 6; i++) person(b, -1.2 + (i % 2) * 2.4, 1.92, 4 - i * 1.2, [0xffd23f, 0xff595e, 0x2ec4b6, 0xffffff][i % 4] as number);
    for (let z = -L * 0.45; z <= L * 0.25; z += 2.2) b.mirrorX((s) => b.block(0.1, 2.4, 0.1, COL.white, s * (W / 2 - 0.3), 1.9, z));
  },

  // ───────────── tier 8-9 — gigantes do bairro
  roda_gigante: (b) => {
    const R = 11;
    const H = R + 2.5;
    b.block(8, 0.6, 6, COL.concrete, 0, 0, 0);
    b.mirrorX((s) => {
      b.strut(s * 1.6, 0.6, 3, s * 1.2, H, 0, 0.3, COL.white).strut(s * 1.6, 0.6, -3, s * 1.2, H, 0, 0.3, COL.white);
      b.torus(R, 0.18, 4, 36, 0xe63946, s * 1.1, H, 0, { ry: HALF_PI });
    });
    b.cyl(0.6, 0.6, 2.8, 10, COL.metal, 0, H, 0, { rz: HALF_PI });
    const cols = [0xffd23f, 0x3a86ff, 0x2ec4b6, 0xff4fa3, 0xf77f00, 0x8338ec];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const y = H + Math.sin(a) * R;
      const z = Math.cos(a) * R;
      b.strut(0, H, 0, 0, y, z, 0.08, COL.white).block(1.8, 1.4, 1.4, cols[i % 6] as number, 0, y - 1.6, z).box(1.9, 0.12, 1.5, COL.white, 0, y - 0.15, z);
      b.sphere(0.2, 5, 4, 0xfff3c4, 1.15, y, z, { emit: 2, noAO: true }).sphere(0.2, 5, 4, 0xfff3c4, -1.15, y, z, { emit: 2, noAO: true });
    }
  },
  igreja_matriz: (b) => {
    const W = 14;
    const D = 18;
    b.block(W, 11, D, COL.white, 0, 0, 0)
      .prism(W + 0.8, 5.5, D + 0.6, COL.terracotta, 0, 11, 0, { ry: HALF_PI })
      .block(W + 0.6, 0.6, 0.6, 0xf3c332, 0, 0, D / 2 + 0.3)
      .block(4, 7, 0.1, 0x2a6f5c, 0, 0.6, D / 2 + 0.05)
      .cyl(1.4, 1.4, 0.1, 14, 0x7fb6d6, 0, 13, D / 2 + 0.05, { rx: HALF_PI, emit: 0.3 });
    b.mirrorX((s) => {
      const x = s * (W / 2 - 2);
      b.block(4, 22, 4, COL.white, x, 0, D / 2 - 2)
        .block(4.4, 0.5, 4.4, 0xf3c332, x, 11, D / 2 - 2)
        .block(4.4, 0.5, 4.4, 0xf3c332, x, 22, D / 2 - 2)
        .block(1.4, 2.6, 0.1, 0x3b3d42, x, 18, D / 2 + 0.05)
        .cyl(0.5, 0.5, 0.6, 8, 0xc9a26b, x, 19, D / 2 - 2)
        .hipRoof(4.2, 4.5, 4.2, 0x2a6f5c, x, 22.5, D / 2 - 2)
        .block(0.25, 2.2, 0.25, 0xffd23f, x, 27, D / 2 - 2)
        .block(1.3, 0.25, 0.25, 0xffd23f, x, 28.3, D / 2 - 2);
      for (let i = 0; i < 3; i++) b.block(1.2, 3.6, 0.1, 0x7fb6d6, s * (W / 2 + 0.05), 3.5, -6 + i * 4, { ry: HALF_PI, noAO: true });
    });
    for (let i = 0; i < 3; i++) b.block(W - i * 0.6, 0.6 - i * 0.2, 0.8, COL.concreteLight, 0, 0, D / 2 + 0.4 + i * 0.8);
  },
  mercadao: (b) => {
    const W = 26;
    const D = 16;
    b.block(W, 9, D, 0xe9d8c4, 0, 0, 0)
      .block(W + 0.4, 0.6, D + 0.4, COL.terracotta, 0, 9, 0)
      .halfCyl(D / 2 - 1, W - 4, 14, 0x7fb6d6, 0, 9.6, 0, { ry: HALF_PI, emit: 0.1, noAO: true });
    for (let i = 0; i < 5; i++) b.block(3, 5.5, 0.1, i === 2 ? 0x2a6f5c : 0x7fb6d6, -10 + i * 5, 0, D / 2 + 0.05, { noAO: i !== 2 });
    b.mirrorX((s) => b.block(3.4, 14, 3.4, 0xe9d8c4, s * (W / 2 - 1.7), 0, D / 2 - 1.7).hipRoof(3.8, 2.6, 3.8, COL.terracottaDark, s * (W / 2 - 1.7), 14, D / 2 - 1.7));
    const fruit = [0xffa62b, 0xe63946, 0x6cc24a, 0xffd23f, 0x8338ec];
    for (let i = 0; i < 9; i++) b.block(1.6, 0.9, 1.2, 0x8a5a2e, -10.8 + i * 2.7, 0, D / 2 + 1.4).block(1.5, 0.3, 1.1, fruit[i % 5] as number, -10.8 + i * 2.7, 0.9, D / 2 + 1.4);
  },
  torre_celular: (b) => {
    const H = 45;
    b.block(4, 0.5, 4, COL.concrete, 0, 0, 0);
    b.mirrorX((s) => {
      b.strut(s * 1.6, 0.5, 1.6, s * 0.4, H, 0.4, 0.14, 0xd62828).strut(s * 1.6, 0.5, -1.6, s * 0.4, H, -0.4, 0.14, COL.white);
    });
    for (let y = 4; y < H; y += 4) b.block(3.2 - (y / H) * 2.4, 0.12, 0.12, y % 8 ? COL.white : 0xd62828, 0, y, 0);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      b.block(0.5, 2.4, 0.2, COL.white, Math.cos(a) * 0.9, H - 3, Math.sin(a) * 0.9, { ry: -a + HALF_PI });
    }
    b.cyl(0.6, 0.6, 0.2, 10, COL.white, 0.7, H - 8, 0, { rz: HALF_PI }).sphere(0.3, 6, 5, 0xff3b30, 0, H + 0.4, 0, GLOW);
    b.block(2.2, 2.4, 1.6, COL.concreteLight, 3.5, 0, 0);
  },

  // ───────────── secretos — folclore e lendas urbanas
  saci: (b) => {
    const skin = 0x3b2414;
    b.block(0.2, 0.9, 0.2, skin, 0, 0, 0)
      .block(0.5, 0.2, 0.3, 0xe63946, 0, 0.75, 0)
      .block(0.44, 0.6, 0.28, skin, 0, 0.95, 0)
      .sphere(0.2, 8, 6, skin, 0, 1.75, 0)
      .cone(0.2, 0.5, 8, 0xe63946, 0, 2.1, -0.05, { rx: -0.3 })
      .box(0.06, 0.06, 0.06, COL.white, 0.08, 1.8, 0.18)
      .box(0.06, 0.06, 0.06, COL.white, -0.08, 1.8, 0.18)
      .cyl(0.03, 0.03, 0.3, 5, 0x8a5a2e, 0.18, 1.62, 0.28, { rx: HALF_PI })
      .sphere(0.06, 5, 4, 0xff7b39, 0.18, 1.62, 0.45, { emit: 1.5, noAO: true });
    // the whirlwind he rides
    for (let i = 0; i < 4; i++) b.torus(0.5 - i * 0.08, 0.02, 3, 14, 0xd9e8f0, 0, 0.15 + i * 0.25, 0, { rx: HALF_PI, emit: 0.4, noAO: true });
  },
  curupira: (b) => {
    const skin = 0x6b8f3a;
    b.block(0.4, 0.8, 0.26, skin, 0, 0.1, 0)
      .block(0.5, 0.65, 0.3, 0x2c6e33, 0, 0.9, 0)
      .sphere(0.22, 8, 6, skin, 0, 1.75, 0)
      .box(0.06, 0.06, 0.06, 0xffd23f, 0.08, 1.8, 0.2, GLOW)
      .box(0.06, 0.06, 0.06, 0xffd23f, -0.08, 1.8, 0.2, GLOW);
    for (let i = 0; i < 7; i++) b.cone(0.1, 0.55, 4, 0xff5a1a, -0.2 + (i % 4) * 0.13, 1.95 + (i % 2) * 0.1, -0.05 + Math.floor(i / 4) * -0.1, { rz: -0.4 + (i % 4) * 0.25, emit: 1.1, noAO: true });
    // backwards feet (point to -Z)
    b.mirrorX((s) => b.block(0.14, 0.1, 0.36, 0x4f6b2a, s * 0.1, 0, -0.14));
  },
  mula_sem_cabeca: (b) => {
    quadruped(b, 1.6, 0.55, 0.7, 0.85, 0x2b1d10, 0x2b1d10, 0.95, 1.6, 0.001);
    for (let i = 0; i < 6; i++) b.cone(0.18 - i * 0.02, 0.8, 5, i % 2 ? 0xffd23f : 0xff5a1a, (i % 3 - 1) * 0.12, 1.9 + i * 0.1, 0.95 + (i % 2) * 0.1, { emit: 2, noAO: true, rx: 0.3 });
    b.sphere(0.25, 8, 6, 0xffe27a, 0, 1.75, 0.9, { emit: 2.2, noAO: true });
  },
  chupacabra: (b) => {
    const g = 0x4f5a45;
    b.sphere(0.35, 8, 6, g, 0, 0.8, 0, { sy: 1.2 })
      .sphere(0.24, 8, 6, g, 0, 1.4, 0.15)
      .sphere(0.08, 6, 5, 0xff1a1a, 0.1, 1.45, 0.34, GLOW)
      .sphere(0.08, 6, 5, 0xff1a1a, -0.1, 1.45, 0.34, GLOW)
      .cone(0.04, 0.14, 3, COL.white, 0.05, 1.28, 0.36, { rx: Math.PI })
      .cone(0.04, 0.14, 3, COL.white, -0.05, 1.28, 0.36, { rx: Math.PI });
    for (let i = 0; i < 5; i++) b.cone(0.07, 0.3, 4, 0x2b3326, 0, 1.55 - i * 0.2, -0.28 - i * 0.03, { rx: -0.8 });
    b.mirrorX((s) => {
      b.strut(s * 0.18, 0.6, 0, s * 0.3, 0, 0.1, 0.06, g);
      b.strut(s * 0.25, 1.0, 0.1, s * 0.4, 0.8, 0.4, 0.04, g);
    });
  },
  et_varginha: (b) => {
    const skin = 0x8a6a4f;
    b.block(0.3, 0.7, 0.22, skin, 0, 0, 0)
      .block(0.34, 0.5, 0.24, skin, 0, 0.7, 0)
      .sphere(0.32, 10, 8, skin, 0, 1.5, 0, { sy: 1.1, sx: 1.1 })
      .sphere(0.1, 6, 5, 0xc0161a, 0.14, 1.52, 0.26, GLOW)
      .sphere(0.1, 6, 5, 0xc0161a, -0.14, 1.52, 0.26, GLOW);
    b.mirrorX((s) => b.cone(0.06, 0.34, 4, skin, s * 0.22, 1.9, 0, { rz: -s * 0.4 }));
    b.torus(0.8, 0.03, 3, 20, 0x7dff9b, 0, 0.05, 0, { rx: HALF_PI, emit: 1.5, noAO: true });
  },
  boitata: (b) => {
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      const x = Math.sin(t * Math.PI * 2.2) * 1.4;
      b.sphere(0.55 - t * 0.3, 8, 6, i % 2 ? 0x3aa0ff : 0x7de0ff, x, 0.6 + Math.sin(t * 5) * 0.25, 2.4 - t * 5, GLOW);
    }
    b.sphere(0.7, 9, 7, 0x9ff0ff, 0, 0.8, 2.9, GLOW).sphere(0.1, 6, 5, 0xffffff, 0.28, 1.05, 3.5, { emit: 3, noAO: true }).sphere(0.1, 6, 5, 0xffffff, -0.28, 1.05, 3.5, { emit: 3, noAO: true });
  },
  caramelo_dourado: (b) => {
    const g = COL.gold;
    b.box(0.34, 0.34, 0.8, g, 0, 0.55, 0, { emit: 0.25 })
      .box(0.28, 0.3, 0.32, g, 0, 0.82, 0.48, { emit: 0.25 })
      .box(0.16, 0.14, 0.18, 0xf7dd8a, 0, 0.74, 0.7, { emit: 0.25 })
      .cone(0.06, 0.16, 3, g, 0.1, 1.02, 0.44)
      .cone(0.06, 0.16, 3, g, -0.1, 1.02, 0.44)
      .strut(0, 0.7, -0.4, 0, 1.0, -0.62, 0.04, g)
      .torus(0.14, 0.03, 3, 10, 0xe63946, 0, 0.72, 0.36, { rx: HALF_PI });
    b.mirrorX((s) => {
      b.block(0.08, 0.38, 0.08, g, s * 0.12, 0, 0.28);
      b.block(0.08, 0.38, 0.08, g, s * 0.12, 0, -0.28);
    });
  },
};
