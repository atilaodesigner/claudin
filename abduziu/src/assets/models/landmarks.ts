import { COL } from './palette';
import type { ModelFn } from './types';

/**
 * Cartões-postais (abductable, tier 9-11) and backdrop scenery (bd_*, never abducted).
 * Stylized on purpose: recognizable silhouettes, not replicas.
 * Landmarks fit a 40 x 40 m lot, front facing +Z.
 */
const HALF_PI = Math.PI / 2;

export const LANDMARK_MODELS: Record<string, ModelFn> = {
  giant_rooster: (b) => {
    const red = 0xe63946;
    b.cyl(3.6, 4.2, 3, 10, 0xf1f1ec, 0, 1.5, 0).cyl(3.9, 3.9, 0.3, 10, 0xffd166, 0, 3.1, 0);
    b.mirrorX((s) => {
      b.cyl(0.3, 0.35, 4, 6, 0xf4a261, s * 1.2, 5.2, 0);
      b.box(1.4, 0.2, 0.4, 0xf4a261, s * 1.2, 3.35, 0.5);
    });
    b.sphere(4, 12, 10, red, 0, 9.5, 0, { sx: 0.9, sz: 1.2 })
      .sphere(2.3, 10, 8, red, 0, 13.6, 2.6)
      .cone(0.7, 2, 5, 0xffd166, 0, 13.4, 5.2, { rx: HALF_PI })
      .sphere(0.35, 6, 5, 0x111111, 1.4, 14.1, 3.8)
      .sphere(0.35, 6, 5, 0x111111, -1.4, 14.1, 3.8)
      .box(0.5, 1.4, 0.6, 0xc1121f, 0, 12, 4.4);
    // crest
    for (let i = 0; i < 4; i++) b.sphere(0.8, 6, 5, 0xff006e, 0, 16 + Math.sin(i) * 0.3, 1.8 + i * 0.6, { sz: 0.6 });
    // carnival tail fan
    const tail = [0x3a86ff, 0x06d6a0, 0xffbe0b, 0xff006e, 0x8338ec, 0xfb5607, 0x06d6a0];
    for (let i = 0; i < 7; i++) {
      const a = -0.9 + i * 0.3;
      b.cone(1.1, 9, 4, tail[i] as number, Math.sin(a) * 3.5, 12 + Math.cos(a) * 3, -5, { rx: -0.7, rz: -a, sz: 0.3 });
    }
    b.mirrorX((s) => b.sphere(2.2, 8, 6, 0xffbe0b, s * 3.4, 9.5, -0.5, { sx: 0.3, sz: 1.3 }));
  },
  lighthouse: (b) => {
    const wall = 0xe9c46a;
    // fort bastion
    b.block(26, 5, 22, wall, 0, 0, -2).block(26.6, 0.6, 22.6, 0xd4a852, 0, 5, -2);
    for (let i = -6; i <= 6; i++) b.block(1.2, 1.0, 0.8, wall, i * 2, 5.6, 9);
    for (let i = -5; i <= 5; i++) b.block(0.8, 1.0, 1.2, wall, 13, 5.6, -2 + i * 2);
    b.block(8, 3, 6, 0xf1efe6, -6, 5.6, -7).prism(8.4, 1.5, 6.4, COL.terracotta, -6, 8.6, -7);
    // tower
    b.cyl(2.2, 2.8, 20, 12, 0xf5f2ea, 5, 15.6, -2)
      .cyl(2.35, 2.5, 2.2, 12, 0x1d1d21, 5, 11, -2)
      .cyl(2.25, 2.3, 2.2, 12, 0x1d1d21, 5, 20, -2)
      .cyl(2.8, 2.8, 0.4, 12, 0x1d1d21, 5, 25.8, -2)
      .cyl(1.6, 1.6, 2.2, 10, 0xfff3b0, 5, 27.1, -2, { emit: 1.1, noAO: true })
      .cone(2.0, 1.8, 10, 0xc1121f, 5, 29.1, -2);
    b.block(1.2, 2.2, 0.1, COL.wood, 0, 0, 9.02);
  },
  lapa_arches: (b) => {
    const white = 0xf5f2ea;
    const L = 40;
    const D = 4;
    const bays = 8;
    const bw = L / bays;
    // lower tier
    for (let i = 0; i <= bays; i++) b.block(1.4, 16, D, white, -L / 2 + i * bw, 0, 0);
    for (let i = 0; i < bays; i++) {
      const x = -L / 2 + (i + 0.5) * bw;
      b.block(bw, 2.4, D, white, x, 5.6, 0)
        .box(1.3, 1.3, D, white, x - bw / 2 + 0.9, 5.2, 0, { rz: Math.PI / 4 })
        .box(1.3, 1.3, D, white, x + bw / 2 - 0.9, 5.2, 0, { rz: Math.PI / 4 });
      // upper tier: smaller arches
      b.block(bw, 1.6, D, white, x, 14.4, 0)
        .box(0.9, 0.9, D, white, x - bw / 2 + 0.7, 14.1, 0, { rz: Math.PI / 4 })
        .box(0.9, 0.9, D, white, x + bw / 2 - 0.7, 14.1, 0, { rz: Math.PI / 4 });
    }
    b.block(L + 1.4, 1.2, D, white, 0, 8.0, 0)
      .block(L + 1.4, 0.4, D + 0.6, 0xd9d4c7, 0, 16, 0)
      .block(L + 1.4, 0.12, 1.6, 0x6b4a2f, 0, 16.4, 0);
    b.mirrorX((s) => b.block(L + 1.4, 0.06, 0.06, 0x5b5b5b, 0, 16.45, s * 0.5));
  },
  ministry: (b, ctx) => {
    const L = 38;
    const D = 12;
    const H = 34;
    b.block(L, H, D, 0x6f9c8a, 0, 0, 0, { noAO: true })
      .block(1.2, H + 0.6, D + 0.4, 0xeae6da, -L / 2, 0, 0)
      .block(1.2, H + 0.6, D + 0.4, 0xeae6da, L / 2, 0, 0)
      .block(L + 1.2, 0.6, D + 0.4, 0xeae6da, 0, H, 0)
      .block(L, 3.2, D - 2, 0x4c5a58, 0, 0, 0);
    const win = ctx.atlas.get('windows');
    for (let f = 1; f < 11; f++) {
      const y = f * 3.1 + 0.6;
      b.quad(L - 1, 1.8, COL.white, 0, y, D / 2 + 0.03, { uv: win }).quad(L - 1, 1.8, COL.white, 0, y, -D / 2 - 0.03, { uv: win, ry: Math.PI });
      b.block(L, 0.14, 0.2, 0xdfe6e2, 0, y + 1.1, D / 2 + 0.1);
    }
    b.block(10, 3.4, 8, 0xeae6da, 0, 0, D / 2 + 5).block(10.4, 0.3, 8.4, COL.concrete, 0, 3.4, D / 2 + 5);
  },
  lacerda: (b, ctx) => {
    const cream = 0xf1e3c6;
    b.block(12, 44, 12, cream, 0, 0, 2)
      .block(12.6, 1.2, 12.6, 0xd9c9a6, 0, 12, 2)
      .block(12.6, 1.2, 12.6, 0xd9c9a6, 0, 30, 2)
      .block(10, 5, 10, cream, 0, 44, 2)
      .block(10.6, 0.8, 10.6, 0xd9c9a6, 0, 49, 2)
      .block(6, 3, 6, cream, 0, 49.8, 2);
    // art-deco vertical ribs and windows
    for (let i = -2; i <= 2; i++) {
      b.block(0.6, 44, 0.5, 0xe4d3b0, i * 2.3, 0, 8.2).block(1.2, 40, 0.06, 0x7fb6d6, i * 2.3 + 1.15, 2, 8.03, { noAO: true });
    }
    b.quad(9, 1.4, COL.white, 0, 46.5, 7.05, { uv: ctx.atlas.get('lacerda') });
    // walkway to the upper city (-Z)
    b.block(5, 4, 20, cream, 0, 40, -13).block(5.4, 0.6, 20.4, 0xd9c9a6, 0, 44, -13);
    for (let i = 0; i < 5; i++) b.block(4.6, 1.6, 0.06, 0x7fb6d6, 0, 41.4, -4 - i * 4 + 0.1, { noAO: true });
    b.block(3, 2.8, 0.1, 0x3a3a3a, 0, 0, 8.05);
  },
  amazon_theater: (b) => {
    const rose = 0xe8a3a3;
    const white = 0xf6f1e7;
    b.block(34, 13, 24, rose, 0, 0, -3)
      .block(34.6, 1, 24.6, white, 0, 13, -3)
      .block(34.6, 1.2, 24.6, white, 0, 0, -3)
      .block(20, 3, 6, white, 0, 0, 12)
      .prism(22, 4, 7, white, 0, 16, 11.5)
      .block(22, 2, 7, white, 0, 14, 11.5);
    for (let i = 0; i < 6; i++) b.cyl(0.55, 0.6, 11, 8, white, -8 + i * 3.2, 8.5, 14.6);
    for (let i = 0; i < 6; i++) b.block(20 - i * 0.2, 0.5, 1, white, 0, i * 0.5 - 0.5, 15.5 + i * 0.8);
    // windows with white frames
    for (let i = 0; i < 6; i++)
      b.mirrorX((s) => {
        b.block(1.6, 3, 0.1, 0x6b3a3a, s * (5 + i * 2.2), 4, 9.05).block(1.9, 0.3, 0.14, white, s * (5 + i * 2.2), 7.1, 9.07);
      });
    // the dome: drum + colored tile bands (green, yellow, blue: the flag)
    b.cyl(7, 7.4, 4, 16, white, 0, 16, -5);
    const bands = [0x2a9d5a, 0xf3c332, 0x1d5fbf, 0x2a9d5a, 0xf3c332, 0x1d5fbf];
    for (let i = 0; i < 6; i++) {
      const t = i / 6;
      const r = 7 * Math.cos(t * HALF_PI);
      b.cyl(r * 0.94, r, 1.3, 16, bands[i] as number, 0, 18.6 + Math.sin(t * HALF_PI) * 7, -5);
    }
    b.cyl(0.6, 1, 2.5, 8, white, 0, 26.6, -5).sphere(0.7, 8, 6, 0xf5c542, 0, 28.2, -5, { emit: 0.2 });
  },
  masp: (b) => {
    const red = 0xd62828;
    const L = 40;
    const D = 18;
    // four pillars + two giant beams on top, glass box hanging below the beams
    b.mirrorX((s) => {
      b.block(2.4, 17, 3, red, s * (L / 2 - 1.2), 0, D / 2 - 1.5);
      b.block(2.4, 17, 3, red, s * (L / 2 - 1.2), 0, -D / 2 + 1.5);
    });
    b.block(L, 2.4, 3, red, 0, 15, D / 2 - 1.5).block(L, 2.4, 3, red, 0, 15, -D / 2 + 1.5);
    b.block(L - 6, 7, D - 5, 0x1e2a30, 0, 7.8, 0, { noAO: true });
    for (let i = 0; i < 12; i++) b.block(0.18, 7, 0.1, 0x3c4a52, -L / 2 + 4.2 + i * 2.9, 7.8, (D - 5) / 2 + 0.05);
    b.block(L - 6.4, 0.5, D - 5.4, 0x6c757d, 0, 7.3, 0);
    // vão livre: people and a feira underneath
    for (let i = 0; i < 4; i++) b.block(2, 1.8, 1.4, [0xe63946, 0xffd166, 0x2a9d8f, 0x3a86ff][i] as number, -9 + i * 6, 0, 2);
  },
  copan: (b) => {
    const segs = 9;
    const H = 58;
    const x0 = -18;
    const len = 36 / segs;
    for (let i = 0; i < segs; i++) {
      const xa = x0 + i * len;
      const xb = xa + len;
      const za = Math.sin((xa / 36) * Math.PI * 1.6) * 5;
      const zb = Math.sin((xb / 36) * Math.PI * 1.6) * 5;
      const ang = Math.atan2(zb - za, xb - xa);
      const cx = (xa + xb) / 2;
      const cz = (za + zb) / 2;
      const segLen = Math.hypot(xb - xa, zb - za) + 0.6;
      b.box(segLen, H, 9, 0xa7b3b8, cx, H / 2, cz, { ry: -ang, noAO: true });
      for (let y = 2.5; y < H; y += 2.9) b.box(segLen + 0.1, 0.55, 9.8, 0xf2f0e8, cx, y, cz, { ry: -ang });
    }
    b.block(34, 6, 16, 0xe9e4d8, 0, 0, 2).block(34.4, 0.5, 16.4, 0xcfc8b8, 0, 6, 2);
  },
  palace: (b) => {
    const white = 0xf7f5ef;
    b.block(40, 1.2, 18, 0xdad6cc, 0, 0, 0)
      .block(34, 7, 11, 0x2e4a5c, 0, 1.2, -1, { noAO: true })
      .block(40, 1.2, 16, white, 0, 8.2, -0.5)
      .block(40.4, 0.4, 16.4, 0xe6e3da, 0, 9.4, -0.5);
    // the swooping columns: pairs of curved blades
    for (let i = 0; i < 8; i++) {
      const x = -17 + i * 4.85;
      b.box(0.9, 6, 0.35, white, x - 0.9, 5.6, 7.2, { rz: 0.35 })
        .box(0.9, 6, 0.35, white, x + 0.9, 5.6, 7.2, { rz: -0.35 })
        .box(0.7, 3.4, 0.35, white, x, 1.2 + 1.3, 7.2)
        .box(2.6, 0.3, 0.4, white, x, 8.5, 7.2);
    }
    b.block(14, 0.3, 8, 0x3f88c5, 0, 0, 13.4, { noAO: true });
  },
  stadium: (b) => {
    const n = 28;
    const rx = 20;
    const rz = 17;
    const concrete = 0xe3e0d8;
    b.cyl(1, 1, 0.2, 24, 0x3e9a45, 0, 0.1, 0, { sx: rx - 5, sz: rz - 5 });
    b.cyl(1, 1, 0.22, 24, 0x6fb05a, 0, 0.12, 0, { sx: rx - 7, sz: rz - 7 });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * rx;
      const z = Math.sin(a) * rz;
      const seg = ((2 * Math.PI) / n) * ((rx + rz) / 2) + 0.4;
      const face = Math.atan2(Math.cos(a) * rz, Math.sin(a) * rx);
      // stands leaning outward, outer wall, roof ring
      b.box(seg, 11, 5, i % 2 ? 0x3a86ff : 0xe63946, x * 0.86, 6.2, z * 0.86, { ry: face, rx: 0.45 })
        .box(seg, 13, 1.2, concrete, x * 1.0, 6.5, z * 1.0, { ry: face })
        .box(seg, 0.5, 7, 0xf5f5f0, x * 0.9, 13.2, z * 0.9, { ry: face });
      if (i % 4 === 0) b.cyl(0.3, 0.3, 4, 5, COL.metal, x * 1.02, 15, z * 1.02);
    }
    b.mirrorX((s) => b.block(0.1, 0.9, 3.2, 0xffffff, s * (rx - 6.5), 0.2, 0));
  },
  cable_bridge: (b) => {
    const L = 56;
    const white = 0xf1f1ec;
    b.block(13, 1.2, L, 0x8e897f, 0, 0, 0).block(12.6, 0.1, L, 0x45474d, 0, 1.2, 0);
    b.mirrorX((s) => b.block(0.3, 1, L, 0xd6d1c4, s * 6.3, 1.2, 0));
    // X-shaped mast
    b.strut(-7, 0, -3, 7, 62, 3, 1.1, white, 6).strut(7, 0, -3, -7, 62, 3, 1.1, white, 6).strut(-7, 0, 3, 7, 62, -3, 1.1, white, 6).strut(7, 0, 3, -7, 62, -3, 1.1, white, 6);
    b.block(3, 8, 3, white, 0, 56, 0);
    // stays fanning to the deck, two colors like the real thing
    for (let i = 0; i < 12; i++) {
      const z = -L / 2 + 1 + i * 2.2;
      const zz = L / 2 - 1 - i * 2.2;
      const y = 60 - i * 0.6;
      b.strut(0, y, 0, -6, 1.8, z, 0.08, 0xffd166, 4).strut(0, y, 0, 6, 1.8, zz, 0.08, 0xffd166, 4);
    }
  },
  congress: (b, ctx) => {
    const white = 0xf1efe8;
    // long base platform (with ramp)
    b.block(40, 4, 22, white, 0, 0, 0).block(40.4, 0.4, 22.4, 0xdcd8cd, 0, 4, 0).block(6, 0.6, 16, 0xdcd8cd, 12, 0, 18, { rx: -0.22 });
    // Câmara: inverted bowl; Senado: dome
    b.cyl(9, 4, 5, 20, white, 10, 6.8, 1).cyl(8.6, 8.6, 0.2, 20, 0xc9c4b6, 10, 9.3, 1);
    b.sphere(6, 16, 8, white, -10, 4.4, 1, { sy: 0.55 });
    // twin towers with a bridge
    const win = ctx.atlas.get('windows');
    b.mirrorX((s) => {
      const x = s * 3.2;
      b.block(5, 42, 13, 0xdcd8cd, x, 4.4, -8);
      for (let f = 1; f < 13; f++) b.quad(12, 1.4, COL.white, x + s * 2.52, 4.4 + f * 3.1, -8, { uv: win, ry: s * HALF_PI });
    });
    b.block(1.4, 3.2, 10, white, 0, 36, -8).block(1.4, 3.2, 10, white, 0, 26, -8);
    b.block(2, 40, 0.4, 0x2e4a5c, 0, 4.4, -1.4, { noAO: true });
    b.block(10, 0.4, 0.2, 0xd62828, 0, 44, -8).block(10, 0.4, 0.2, 0x2a9d5a, 0, 44.5, -8);
  },

  // ───────────── backdrops (scenery beyond the play area)
  bd_sugarloaf: (b) => {
    b.cyl(60, 70, 8, 16, 0x3f7a3a, 0, 2, 0, { sz: 0.7 });
    b.sphere(38, 16, 12, 0x6b6660, 30, 40, 0, { sx: 0.8, sy: 2.4, sz: 0.8 })
      .sphere(36, 14, 10, 0x4f7a3a, 30, 10, 0, { sx: 0.95, sy: 0.8, sz: 0.95 })
      .sphere(28, 14, 10, 0x6b6660, -40, 22, 10, { sx: 0.9, sy: 1.3, sz: 0.9 })
      .sphere(30, 14, 10, 0x4f7a3a, -40, 4, 10, { sx: 1.1, sy: 0.6, sz: 1.1 });
    b.strut(-40, 58, 10, 30, 128, 0, 0.3, 0x333333, 4).strut(-40, 58, 10, -110, 6, 30, 0.3, 0x333333, 4);
    b.block(3, 2.4, 3, 0xd62828, -5, 91, 5);
  },
  bd_redeemer: (b) => {
    b.cone(120, 150, 12, 0x3f7a3a, 0, 75, 0, { sz: 0.8 })
      .cone(60, 60, 10, 0x5b8f45, 30, 30, 20)
      .block(6, 8, 6, 0xd9d4c7, 0, 146, 0)
      .cone(3.2, 18, 8, 0xe7e2d6, 0, 163, 0)
      .box(26, 3, 2.2, 0xe7e2d6, 0, 168, 0)
      .sphere(1.8, 8, 6, 0xe7e2d6, 0, 173.5, 0);
  },
  bd_hills: (b) => {
    const hills: Array<[number, number, number, number]> = [
      [0, 0, 70, 90],
      [110, 30, 60, 70],
      [-120, 20, 80, 110],
      [220, -10, 50, 60],
      [-230, 40, 70, 80],
    ];
    for (const [x, z, r, h] of hills) b.sphere(r, 12, 8, 0x3f7a3a, x, 0, z, { sy: h / r });
    for (let i = 0; i < 24; i++) b.block(4, 3 + (i % 3), 4, [0xf6c85f, 0xef8a62, 0x9ecae1, 0xf1a7b5][i % 4] as number, -150 + (i % 8) * 10, 10 + Math.floor(i / 8) * 9, 40 + (i % 3) * 6);
  },
  bd_olinda: (b) => {
    b.sphere(90, 14, 8, 0x4f8f45, 0, -20, 0, { sy: 0.55, sx: 1.4 });
    const cols = [0xf6c85f, 0xef8a62, 0x6fb7a8, 0xf1a7b5, 0x9ecae1, 0xffd166];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI - HALF_PI;
      const r = 40 + (i % 5) * 16;
      const x = Math.sin(a) * r * 1.3;
      const z = Math.cos(a) * r * 0.4 + 20;
      const y = Math.max(0, 30 - r * 0.28);
      b.block(6, 5, 6, cols[i % cols.length] as number, x, y, z).prism(6.4, 2, 6.4, COL.terracotta, x, y + 5, z);
    }
    b.cyl(2, 2.6, 20, 10, 0xf5f2ea, 30, 32, 10).cyl(1.4, 1.4, 2, 8, 0xfff3b0, 30, 43, 10, { emit: 1 });
  },
  bd_island: (b) => {
    b.sphere(140, 16, 8, 0x5f9e45, 0, -30, 0, { sy: 0.25, sz: 0.5 }).cyl(150, 150, 1, 16, 0xead9a4, 0, 0.2, 0, { sz: 0.55 });
    for (let i = 0; i < 20; i++) b.ico(8, 0, i % 2 ? COL.leaf : COL.leafDark, -120 + i * 12, 8 + (i % 3) * 2, (i % 4) * 8 - 10);
  },
  bd_forest: (b) => {
    for (let i = 0; i < 60; i++) {
      const x = -300 + i * 10.5;
      const z = ((i * 37) % 60) - 30;
      const h = 18 + ((i * 13) % 14);
      b.cyl(1, 1.4, h, 5, 0x7a6a55, x, h / 2, z).ico(9 + (i % 4) * 2, 0, i % 3 ? COL.leafDark : COL.leaf, x, h + 3, z, { sy: 0.6 });
    }
  },
  bd_skyline: (b) => {
    const cols = [0x9aa5ab, 0xb9c3c8, 0x7d8a92, 0xa9b4b9, 0xc5ccd0];
    for (let i = 0; i < 28; i++) {
      const x = -280 + i * 20 + ((i * 7) % 9);
      const z = ((i * 29) % 50) - 25;
      const h = 40 + ((i * 53) % 90);
      const w = 12 + (i % 4) * 4;
      b.block(w, h, w, cols[i % cols.length] as number, x, 0, z, { noAO: true });
      if (i % 3 === 0) b.cyl(0.4, 0.4, 12, 4, COL.metal, x, h + 6, z);
    }
  },
  bd_tv_tower: (b) => {
    b.cyl(14, 18, 16, 8, 0xd9d4c7, 0, 8, 0);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      b.strut(Math.cos(a) * 10, 16, Math.sin(a) * 10, Math.cos(a) * 2, 120, Math.sin(a) * 2, 0.6, 0x9aa5ab, 4);
    }
    b.cyl(6, 6, 5, 10, 0xe8eef3, 0, 78, 0).cyl(1, 1, 40, 5, 0xd62828, 0, 140, 0).cyl(1.3, 1.3, 4, 5, 0xffffff, 0, 128, 0);
  },
};
