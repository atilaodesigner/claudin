import { BILLBOARD_ADS, SHOP_SIGNS } from '../../config/districts';
import type { ModelBuilder } from '../ModelBuilder';
import { COL } from './palette';
import type { ModelContext, ModelFn } from './types';

const P = { paint: 1 };
const HALF_PI = Math.PI / 2;

function windowFrame(b: ModelBuilder, x: number, y: number, z: number, w: number, h: number, ry: number, lit = false): void {
  const glass = lit ? 0xfff1b8 : COL.glass;
  // frame + glass pane + sill, facing +Z rotated by ry
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const off = (d: number) => [x + sin * d, z + cos * d] as const;
  const [fx, fz] = off(0.02);
  b.box(w + 0.16, h + 0.16, 0.06, COL.white, fx, y, fz, { ry });
  const [gx, gz] = off(0.06);
  b.box(w, h, 0.04, glass, gx, y, gz, { ry, noAO: true, emit: lit ? 0.6 : 0 });
  const [sx, sz] = off(0.1);
  b.box(w + 0.3, 0.08, 0.14, COL.concreteLight, sx, y - h / 2 - 0.08, sz, { ry });
}

function rebar(b: ModelBuilder, x: number, y: number, z: number): void {
  b.cyl(0.025, 0.025, 0.9, 4, 0x7a4b2a, x, y + 0.45, z);
  b.cyl(0.025, 0.025, 0.7, 4, 0x7a4b2a, x + 0.12, y + 0.35, z + 0.08);
}

export const BUILDING_MODELS: Record<string, ModelFn> = {
  house_slab: (b) => {
    const W = 7;
    const D = 7.5;
    const H = 3.0;
    b.block(W, H, D, COL.paintBase, 0, 0, 0, P)
      .block(W + 0.3, 0.26, D + 0.3, COL.concrete, 0, H, 0)
      // unfinished second floor in exposed brick (classic "puxadinho")
      .block(3.4, 2.5, 3.6, COL.brick, -1.6, H + 0.26, -1.7)
      .block(3.6, 0.18, 3.8, COL.concrete, -1.6, H + 2.76, -1.7)
      .block(0.9, 2.1, 0.1, COL.wood, 1.4, 0.02, D / 2 + 0.02)
      .block(0.5, 0.06, 0.4, COL.concreteLight, 1.4, 0, D / 2 + 0.25);
    windowFrame(b, -1.5, 1.6, D / 2, 1.3, 1.0, 0);
    windowFrame(b, W / 2, 1.6, 1.2, 1.0, 0.9, HALF_PI);
    windowFrame(b, -1.1, H + 1.5, 0.12, 0.9, 0.8, 0);
    rebar(b, W / 2 - 0.2, H + 0.26, D / 2 - 0.2);
    rebar(b, 0.4, H + 0.26, D / 2 - 0.2);
    rebar(b, W / 2 - 0.2, H + 0.26, -D / 2 + 0.3);
    // parapet
    b.block(W + 0.3, 0.5, 0.14, COL.paintBase, 0, H + 0.26, D / 2 + 0.08, P);
    // front wall (muro) with gate
    b.block(2.6, 1.5, 0.22, COL.concreteLight, -2.2, 0, D / 2 + 1.6)
      .block(2.2, 1.5, 0.22, COL.concreteLight, 2.4, 0, D / 2 + 1.6)
      .block(2.0, 1.4, 0.06, 0x2b2b2b, 0.2, 0.05, D / 2 + 1.6);
  },
  house_roof: (b) => {
    const W = 7.2;
    const D = 7;
    const H = 2.9;
    b.block(W, H, D, COL.paintBase, 0, 0, 0, P)
      .block(W - 0.6, 0.18, 2.2, COL.terracotta, 0, 0, D / 2 + 1.1)
      .block(W + 0.4, 0.14, 2.6, COL.woodLight, 0, H - 0.1, D / 2 + 1.2)
      .block(1.0, 2.1, 0.1, COL.wood, 0.6, 0.02, D / 2 + 0.02);
    b.mirrorX((s) => b.cyl(0.12, 0.12, H - 0.1, 6, COL.white, s * (W / 2 - 0.2), (H - 0.1) / 2, D / 2 + 2.3));
    windowFrame(b, -1.8, 1.55, D / 2, 1.2, 1.0, 0);
    windowFrame(b, 2.3, 1.55, D / 2, 0.9, 1.0, 0);
    windowFrame(b, -W / 2, 1.55, 0, 1.0, 0.9, -HALF_PI);
    // hammock on the porch
    b.strut(-2.8, 1.7, D / 2 + 2.3, -0.8, 1.2, D / 2 + 2.3, 0.18, 0xe63946, 5, { sx: 1 });
    b.block(W + 0.6, 1.2, 0.2, COL.concreteLight, 0, 0, D / 2 + 3.2)
      .block(2.0, 1.2, 0.2, 0xb08968, 0, 0, D / 2 + 3.2);
  },
  roof: (b) => {
    b.hipRoof(8.2, 2.1, 8.0, COL.terracotta, 0, 0, 0).block(8.3, 0.14, 8.1, COL.terracottaDark, 0, 0, 0);
    for (let i = 0; i < 4; i++) b.box(8.0 - i * 1.8, 0.05, 0.12, COL.terracottaDark, 0, 0.4 + i * 0.45, 3.6 - i * 0.85, { rx: -0.52 });
  },
  favela_house: (b) => {
    const W = 4.6;
    const D = 5.2;
    b.block(W, 2.8, D, COL.paintBase, 0, 0, 0, P)
      .block(W + 0.2, 0.2, D + 0.2, COL.concrete, 0, 2.8, 0)
      .block(W, 2.6, D, COL.brick, 0, 3.0, 0)
      .block(W + 0.2, 0.2, D + 0.2, COL.concrete, 0, 5.6, 0)
      .block(W * 0.7, 2.4, D * 0.8, COL.paintBase, -0.5, 5.8, -0.3, P)
      .block(W * 0.7 + 0.2, 0.18, D * 0.8 + 0.2, COL.concrete, -0.5, 8.2, -0.3)
      .block(0.9, 2.0, 0.08, 0x355c7d, 1.2, 0, D / 2 + 0.02);
    windowFrame(b, -1.0, 1.6, D / 2, 0.9, 0.8, 0);
    windowFrame(b, 0.8, 4.4, D / 2, 0.8, 0.8, 0, true);
    windowFrame(b, -1.2, 7.1, D * 0.4 - 0.3, 0.7, 0.7, 0);
    // external stairs
    for (let i = 0; i < 6; i++) b.block(0.9, 0.2, 0.5, COL.concrete, W / 2 + 0.45, i * 0.47, D / 2 - 0.5 - i * 0.45);
    rebar(b, W / 2 - 0.3, 8.4, -D / 2 + 0.3);
    b.block(W + 0.2, 0.6, 0.12, COL.concreteLight, 0, 5.8, D / 2 + 0.05);
  },
  shop: (b, ctx) => BUILDING_MODELS['shop:0']!(b, ctx),
  gasstation: (b, ctx) => {
    b.block(16, 0.5, 9, 0x0b6e4f, 0, 5.2, 0).block(16.2, 0.12, 9.2, COL.white, 0, 5.7, 0);
    b.mirrorX((s) => {
      b.block(0.5, 5.2, 0.5, COL.white, s * 5, 0, 0);
      b.block(0.8, 1.6, 0.6, 0xf1faee, s * 3.2, 0.2, 0).block(0.6, 0.4, 0.62, 0xe63946, s * 3.2, 1.2, 0, { emit: 0.3 });
    });
    b.block(16, 0.2, 9, COL.concreteLight, 0, 0, 0)
      .quad(5, 0.5, COL.white, 0, 5.45, 4.52, { uv: ctx.atlas.get('posto'), emit: 0.5 })
      .block(8, 3.2, 6, 0xf1faee, 0, 0, -9)
      .block(7.6, 2.0, 0.06, COL.glass, 0, 0.4, -5.97, { noAO: true })
      .block(8.2, 0.5, 6.2, 0x0b6e4f, 0, 3.2, -9)
      .cyl(0.25, 0.25, 7, 6, COL.white, 7.5, 3.5, 3)
      .block(2.2, 2.2, 0.3, 0x0b6e4f, 7.5, 7, 3)
      .block(1.8, 0.6, 0.32, 0xffd166, 7.5, 7.9, 3, { emit: 0.8 });
  },
  warehouse: (b) => {
    const W = 20;
    const D = 28;
    const H = 8;
    b.block(W, H, D, 0xc9c3b3, 0, 0, 0)
      .block(W + 0.2, 0.8, D + 0.2, 0x3d5a80, 0, 0, 0)
      .block(6, 5.5, 0.1, 0x8d99ae, 0, 0.5, D / 2 + 0.02)
      .block(6.2, 0.3, 0.3, 0xf2b705, 0, 6.0, D / 2 + 0.1);
    for (let i = 0; i < 6; i++) b.block(0.2, 5.4, 0.12, 0x6c757d, -2.8 + i * 1.1, 0.55, D / 2 + 0.08);
    // sawtooth roof
    for (let i = 0; i < 5; i++) {
      const z = -D / 2 + 2.8 + i * 5.6;
      b.prism(W + 0.3, 2.4, 5.6, 0x9aa5ab, 0, H, z, { ry: 0 });
      b.box(W - 1, 1.6, 0.1, COL.glass, 0, H + 1.1, z + 1.9, { rx: 0.9, noAO: true });
    }
    b.block(0.8, 3, 0.8, COL.concreteDark, W / 2 - 1.5, H + 2.0, -D / 2 + 3).cyl(0.4, 0.5, 5, 8, 0x8a817c, W / 2 - 1.5, H + 7.5, -D / 2 + 3);
  },
  apartment: (b, ctx) => {
    const W = 14;
    const D = 14;
    const floors = 12;
    const fh = 3;
    const H = floors * fh;
    b.block(W, H, D, COL.paintBase, 0, 0, 0, P)
      .block(W + 0.4, 3.4, D + 0.4, COL.concreteDark, 0, 0, 0)
      .block(6, 2.6, 0.1, COL.glass, 0, 0.2, D / 2 + 0.21, { noAO: true })
      .quad(5, 0.8, COL.white, 0, 3.0, D / 2 + 0.22, { uv: ctx.atlas.get('predio') });
    const win = ctx.atlas.get('windows');
    for (let f = 1; f < floors; f++) {
      const y = f * fh;
      // balcony slabs & window bands on front/back, window strips on sides
      b.block(W + 0.8, 0.18, 1.2, COL.white, 0, y, D / 2 + 0.6);
      b.block(W + 0.8, 0.9, 0.06, 0x9fb3c8, 0, y + 0.18, D / 2 + 1.18, { noAO: true });
      b.quad(W - 1.5, 1.9, COL.white, 0, y + 1.4, D / 2 + 0.02, { uv: win });
      b.quad(W - 1.5, 1.9, COL.white, 0, y + 1.4, -D / 2 - 0.02, { uv: win, ry: Math.PI });
      b.quad(D - 1.5, 1.9, COL.white, W / 2 + 0.02, y + 1.4, 0, { uv: win, ry: HALF_PI });
      b.quad(D - 1.5, 1.9, COL.white, -W / 2 - 0.02, y + 1.4, 0, { uv: win, ry: -HALF_PI });
      b.box(0.9, 0.6, 0.5, 0xeef0f2, W / 2 - 1, y + 0.6, -D / 2 - 0.3);
    }
    b.block(W + 0.3, 0.6, D + 0.3, COL.concreteLight, 0, H, 0).block(4, 3, 4, COL.concreteLight, 2, H + 0.6, -2);
  },
  office: (b, ctx) => {
    const W = 16;
    const D = 16;
    const floors = 16;
    const fh = 3.2;
    const H = floors * fh;
    b.block(W, 4.5, D, 0x2b2d42, 0, 0, 0).block(W - 1, 3.6, 0.1, 0x8ecae6, 0, 0.4, D / 2 + 0.02, { noAO: true });
    for (let f = 0; f < floors; f++) {
      const y = 4.5 + f * fh;
      b.block(W, fh * 0.72, D, 0x5fa8d3, 0, y, 0, { noAO: true });
      b.block(W + 0.3, fh * 0.28, D + 0.3, 0xe0e5ea, 0, y + fh * 0.72, 0);
    }
    const top = 4.5 + H;
    b.mirrorX((s) => {
      b.block(0.6, H, 0.6, 0xdfe6ec, s * (W / 2), 4.5, D / 2);
      b.block(0.6, H, 0.6, 0xdfe6ec, s * (W / 2), 4.5, -D / 2);
    });
    b.block(W + 0.4, 0.8, D + 0.4, 0xdfe6ec, 0, top, 0)
      .cyl(5.2, 5.2, 0.3, 16, 0x2b2d42, 0, top + 0.95, 0)
      .quad(7, 7, COL.white, 0, top + 1.12, 0, { rx: -HALF_PI, uv: ctx.atlas.get('helipad') })
      .cyl(0.12, 0.12, 8, 5, COL.metal, W / 2 - 1.5, top + 4.8, -D / 2 + 1.5)
      .sphere(0.3, 8, 6, 0xff3b30, W / 2 - 1.5, top + 8.9, -D / 2 + 1.5, { emit: 2, noAO: true });
  },
  skyscraper: (b) => {
    const tiers: Array<[number, number, number]> = [
      [22, 34, 0x3a6ea5],
      [17, 28, 0x4f86c6],
      [12, 22, 0x6aa6db],
    ];
    let y = 0;
    for (const [w, h, c] of tiers) {
      b.block(w, h, w, c, 0, y, 0, { noAO: y > 0 });
      for (let f = 3; f < h; f += 3.4) b.block(w + 0.3, 0.35, w + 0.3, 0xe8eef3, 0, y + f, 0);
      b.mirrorX((s) => {
        b.block(0.7, h, 0.7, 0xe8eef3, s * w / 2, y, w / 2);
        b.block(0.7, h, 0.7, 0xe8eef3, s * w / 2, y, -w / 2);
      });
      y += h;
      b.block(w + 0.6, 0.8, w + 0.6, 0xe8eef3, 0, y, 0);
      y += 0.8;
    }
    b.cone(2.5, 5, 8, 0xe8eef3, 0, y + 2.5, 0).cyl(0.2, 0.2, 14, 6, COL.metal, 0, y + 12, 0).sphere(0.45, 8, 6, 0xff3b30, 0, y + 19.2, 0, { emit: 2.5, noAO: true });
  },
  watertower: (b) => {
    b.mirrorX((s) => {
      b.strut(s * 2.2, 0, 2.2, s * 1.4, 12, 1.4, 0.22, COL.concrete);
      b.strut(s * 2.2, 0, -2.2, s * 1.4, 12, -1.4, 0.22, COL.concrete);
    });
    b.strut(-1.9, 5, 1.9, 1.9, 5, 1.9, 0.12, COL.concrete).strut(-1.9, 5, -1.9, 1.9, 5, -1.9, 0.12, COL.concrete)
      .cyl(3.4, 2.4, 5, 16, 0xe9e4d8, 0, 14.5, 0)
      .cyl(3.5, 3.5, 0.3, 16, 0x2f7fd0, 0, 17.1, 0)
      .cone(3.5, 1.4, 16, 0xe9e4d8, 0, 17.9, 0)
      .cyl(3.42, 3.42, 1.2, 16, 0x2f7fd0, 0, 14.5, 0);
  },
  silo: (b) => {
    b.cyl(3.2, 3.2, 16, 16, 0xcfd4d8, 0, 8, 0)
      .cone(3.3, 3, 16, 0xaeb6bd, 0, 17.5, 0);
    for (let i = 1; i < 6; i++) b.cyl(3.25, 3.25, 0.2, 16, 0x9aa3ab, 0, i * 2.8, 0);
    b.strut(3.2, 0, 0, 3.2, 17, 0, 0.08, COL.darkMetal).strut(3.6, 0, 0, 3.6, 17, 0, 0.08, COL.darkMetal);
  },
  crane: (b) => {
    for (let y = 0; y < 26; y += 2.6) {
      b.block(2.2, 0.2, 2.2, 0xf2b705, 0, y, 0);
      b.mirrorX((s) => {
        b.strut(s * 1.0, y, 1.0, -s * 1.0, y + 2.6, 1.0, 0.08, 0xf2b705);
        b.strut(1.0, y, s * 1.0, 1.0, y + 2.6, -s * 1.0, 0.08, 0xf2b705);
      });
    }
    b.mirrorX((s) => {
      b.cyl(0.14, 0.14, 26, 4, 0xf2b705, s * 1.0, 13, 1.0);
      b.cyl(0.14, 0.14, 26, 4, 0xf2b705, s * 1.0, 13, -1.0);
    });
    b.block(2.4, 2.4, 2.8, 0xf2b705, 0, 26, 0.2)
      .block(1.6, 1.6, 22, 0xf2b705, 0, 28.4, 9)
      .block(1.4, 1.4, 7, 0xf2b705, 0, 28.4, -5)
      .block(2.2, 2.2, 3, COL.concreteDark, 0, 26.8, -8)
      .cyl(0.04, 0.04, 14, 4, COL.black, 0, 21.4, 16)
      .block(2.4, 0.5, 2.4, COL.darkMetal, 0, 14.2, 16)
      .block(4, 1.4, 4, COL.concrete, 0, 0, 0);
  },
  radiotower: (b) => {
    const H = 44;
    for (let i = 0; i < 11; i++) {
      const y = i * 4;
      const w = 3.2 - i * 0.24;
      const w2 = 3.2 - (i + 1) * 0.24;
      const c = i % 2 === 0 ? 0xe63946 : 0xf1faee;
      b.mirrorX((s) => {
        b.strut(s * w / 2, y, w / 2, s * w2 / 2, y + 4, w2 / 2, 0.1, c);
        b.strut(s * w / 2, y, -w / 2, s * w2 / 2, y + 4, -w2 / 2, 0.1, c);
        b.strut(s * w / 2, y, w / 2, -s * w2 / 2, y + 4, w2 / 2, 0.05, c);
      });
    }
    b.cyl(0.08, 0.08, 6, 4, COL.metal, 0, H + 3, 0)
      .sphere(0.4, 8, 6, 0xff3b30, 0, H + 6.2, 0, { emit: 2.5, noAO: true })
      .cyl(1.1, 1.1, 0.6, 8, 0xdddddd, 0, 30, 1.2, { rx: HALF_PI })
      .block(4, 0.6, 4, COL.concrete, 0, 0, 0);
  },
  hangar: (b, ctx) => {
    const W = 24;
    const D = 30;
    b.halfCyl(W / 2, D, 16, 0x7d8a6a, 0, 0, 0)
      .block(W, 0.3, D, COL.concrete, 0, 0, 0)
      .block(W * 0.8, 8, 0.2, 0x5b6b3a, 0, 0, D / 2 + 0.05)
      .quad(8, 1.6, COL.white, 0, 9, D / 2 + 0.2, { uv: ctx.atlas.get('sentinela') });
    for (let i = 0; i < 5; i++) b.halfCyl(W / 2 + 0.1, 0.4, 16, 0x5b6b3a, 0, 0, -D / 2 + 3 + i * 6);
  },
  controltower: (b) => {
    b.cyl(2.2, 2.8, 26, 10, 0xe9ecef, 0, 13, 0)
      .cyl(4.2, 3.2, 1.2, 12, 0xadb5bd, 0, 26.6, 0)
      .cyl(4.4, 4.2, 3.6, 12, 0x1d3557, 0, 29, 0, { noAO: true })
      .cyl(4.6, 4.6, 0.6, 12, 0xadb5bd, 0, 31, 0)
      .cyl(0.1, 0.1, 5, 4, COL.metal, 1.5, 33.8, 0)
      .sphere(0.35, 8, 6, 0xff3b30, 1.5, 36.4, 0, { emit: 2.5, noAO: true })
      .block(8, 4, 8, 0xdee2e6, 0, 0, 0);
  },
  radar: (b) => {
    b.block(6, 6, 6, 0xdee2e6, 0, 0, 0)
      .sphere(4.2, 14, 10, 0xf8f9fa, 0, 8.4, 0)
      .cyl(0.4, 0.5, 3, 8, COL.darkMetal, 7, 1.5, 0)
      .cyl(3.2, 0.6, 1.2, 12, 0xced4da, 7, 3.6, 0, { rx: -0.7 })
      .block(8, 0.4, 8, COL.concrete, 3, 0, 0);
  },
  pool: (b) => {
    b.block(4.6, 0.25, 7.6, COL.white, 0, 0, 0)
      .block(4.0, 0.06, 7.0, 0x33c3f0, 0, 0.23, 0, { emit: 0.25, noAO: true })
      .block(4.0, 0.04, 7.0, 0x7fe3ff, 0, 0.26, 0, { sx: 0.6, sz: 0.4, emit: 0.3, noAO: true });
  },
  billboard: (b, ctx) => BUILDING_MODELS['billboard:0']!(b, ctx),
  kiosk: (b, ctx) => {
    b.cyl(1.9, 1.9, 1.1, 10, 0xc9a26b, 0, 0.55, 0)
      .cyl(2.1, 2.1, 0.1, 10, COL.woodLight, 0, 1.15, 0)
      .cyl(0.14, 0.14, 2.6, 6, COL.wood, 0, 2.3, 0)
      .cone(3.6, 1.6, 10, 0xd4a55a, 0, 3.8, 0)
      .cone(3.61, 0.4, 10, 0xb8863b, 0, 3.2, 0)
      .quad(2.2, 0.5, COL.white, 0, 1.3, 1.98, { uv: ctx.atlas.get('coco') });
    for (let i = 0; i < 4; i++) b.ico(0.22, 0, 0x5e8c31, -0.6 + i * 0.4, 1.35, 1.6);
  },
  busstop: (b) => {
    b.block(4.2, 0.1, 1.8, 0x1d5fbf, 0, 2.6, 0)
      .block(4.0, 2.2, 0.06, COL.glass, 0, 0.3, -0.8, { noAO: true })
      .block(3.0, 0.1, 0.5, COL.wood, 0, 0.5, -0.4)
      .block(0.8, 1.6, 0.1, 0x3a86ff, 2.2, 0.8, 0, { emit: 0.3 });
    b.mirrorX((s) => b.block(0.12, 2.6, 0.12, COL.darkMetal, s * 1.9, 0, -0.8));
  },
  newsstand: (b, ctx) => {
    b.block(3.2, 2.4, 2.2, 0x2d6a4f, 0, 0, 0)
      .block(3.4, 0.2, 2.8, 0x1b4332, 0, 2.4, 0.2)
      .block(2.8, 1.4, 0.08, 0xfaf3dd, 0, 0.6, 1.12)
      .quad(2.6, 0.5, COL.white, 0, 2.75, 1.5, { uv: ctx.atlas.get('banca') });
    const mag = [0xe63946, 0xffd166, 0x06d6a0, 0x118ab2, 0xef476f, 0x8338ec];
    for (let i = 0; i < 12; i++) b.box(0.36, 0.44, 0.03, mag[i % 6] as number, -1.1 + (i % 6) * 0.44, 0.9 + Math.floor(i / 6) * 0.55, 1.18, { noAO: true });
  },
  container: (b) => {
    b.block(2.5, 2.6, 6.1, COL.paintBase, 0, 0, 0, P);
    for (let i = 0; i < 11; i++) b.box(2.54, 2.3, 0.08, COL.paintBase, 0, 1.3, -2.75 + i * 0.55, { paint: 1, sx: 1 });
    b.block(2.3, 2.3, 0.06, 0x3b3b3b, 0, 0.15, 3.06).box(0.05, 2.2, 0.05, COL.metal, 0.4, 1.3, 3.1).box(0.05, 2.2, 0.05, COL.metal, -0.4, 1.3, 3.1);
  },
  pole: (b) => {
    b.cyl(0.12, 0.2, 9, 6, 0xb9b4a8, 0, 4.5, 0)
      .box(2.4, 0.14, 0.14, 0xb9b4a8, 0, 8.4, 0)
      .cyl(0.32, 0.32, 1.0, 6, 0x6c757d, 0, 6.6, 0.4)
      .box(0.1, 0.3, 0.1, 0x6fb7d6, -1.0, 8.6, 0, { noAO: true })
      .box(0.1, 0.3, 0.1, 0x6fb7d6, 1.0, 8.6, 0, { noAO: true })
      .box(0.1, 0.3, 0.1, 0x6fb7d6, 0, 8.6, 0, { noAO: true })
      .strut(0, 7.8, 0, 0, 8.3, 1.6, 0.05, COL.darkMetal, 4)
      .box(0.3, 0.12, 0.5, 0x333333, 0, 8.25, 1.7)
      .box(0.24, 0.06, 0.4, 0xfff1b8, 0, 8.18, 1.7, { emit: 1.2, noAO: true })
      .box(0.5, 0.3, 0.06, 0xf1faee, 0, 2.6, 0.2);
  },
};

// Shop variants: one per fictional sign.
function makeShop(signIndex: number): ModelFn {
  return (b: ModelBuilder, ctx: ModelContext) => {
    const W = 11;
    const D = 10;
    b.block(W, 3.4, D, COL.paintBase, 0, 0, 0, P)
      .block(W, 3.2, D, COL.paintBase, 0, 3.6, 0, P)
      .block(W + 0.3, 0.22, D + 0.3, COL.concrete, 0, 3.4, 0)
      .block(W + 0.3, 0.5, D + 0.3, COL.concreteLight, 0, 6.8, 0)
      .block(W - 1.6, 2.6, 0.08, 0x9aa3ab, 0, 0.05, D / 2 + 0.02)
      .block(W - 2.2, 1.4, 0.06, 0xfff1b8, 0, 0.3, D / 2 + 0.07, { emit: 0.4, noAO: true });
    for (let i = 0; i < 9; i++) b.box(W - 1.6, 0.04, 0.05, 0x7d858d, 0, 1.9 + i * 0.08, D / 2 + 0.07);
    // striped awning
    const awn = [0xe63946, 0xf1faee];
    for (let i = 0; i < 8; i++) b.box((W - 0.6) / 8, 0.08, 1.6, awn[i % 2] as number, -W / 2 + 0.3 + (W - 0.6) / 16 + (i * (W - 0.6)) / 8, 2.9, D / 2 + 0.75, { rx: 0.35 });
    b.quad(W - 1.2, 1.1, COL.white, 0, 4.2, D / 2 + 0.03, { uv: ctx.atlas.get(`sign:${signIndex}`), emit: 0.35 });
    windowFrame(b, -2.8, 5.4, D / 2, 1.4, 1.0, 0);
    windowFrame(b, 2.8, 5.4, D / 2, 1.4, 1.0, 0, signIndex % 3 === 0);
    b.box(1.0, 0.7, 0.5, 0xeef0f2, 4.5, 5.3, D / 2 + 0.3);
  };
}

function makeBillboard(adIndex: number): ModelFn {
  return (b: ModelBuilder, ctx: ModelContext) => {
    b.mirrorX((s) => b.cyl(0.18, 0.22, 7, 6, COL.darkMetal, s * 3, 3.5, 0));
    b.block(9.4, 3.4, 0.3, 0x2b2d42, 0, 6.2, 0)
      .quad(9, 3.0, COL.white, 0, 7.9, 0.17, { uv: ctx.atlas.get(`billboard:${adIndex}`), emit: 0.25 })
      .block(9, 0.1, 0.8, COL.darkMetal, 0, 5.9, 0.5);
    for (let i = 0; i < 3; i++) b.box(0.3, 0.2, 0.5, 0xfff1b8, -3 + i * 3, 9.9, 0.5, { emit: 1.5, noAO: true });
  };
}

SHOP_SIGNS.forEach((_, i) => (BUILDING_MODELS[`shop:${i}`] = makeShop(i)));
BILLBOARD_ADS.forEach((_, i) => (BUILDING_MODELS[`billboard:${i}`] = makeBillboard(i)));

export const MODEL_VARIANTS: Record<string, number> = {
  shop: SHOP_SIGNS.length,
  billboard: BILLBOARD_ADS.length,
};
