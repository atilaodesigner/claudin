import type { ModelBuilder } from '../ModelBuilder';
import { COL } from './palette';
import type { ModelFn } from './types';

/**
 * Goiânia, Belo Horizonte e Porto Alegre: landmarks and regional props.
 * Same conventions as the other model files: meters, base at y=0, front facing +Z.
 */
const HALF_PI = Math.PI / 2;
const GLOW = { emit: 1.2, noAO: true };
const BRONZE = 0x6e4a2a;
const BRONZE_DARK = 0x4f341d;
const GOLD = { emit: 0.35 };

/** Bronze figure (statues): legs, torso, arms, head; arms can be raised. */
function figure(b: ModelBuilder, x: number, y: number, z: number, s: number, color: number, raise = 0, ry = 0): void {
  const c = Math.cos(ry);
  const n = Math.sin(ry);
  const at = (lx: number, lz: number): [number, number] => [x + lx * c + lz * n, z - lx * n + lz * c];
  const [lx1, lz1] = at(-0.18 * s, 0);
  const [lx2, lz2] = at(0.18 * s, 0);
  b.block(0.26 * s, 0.95 * s, 0.3 * s, color, lx1, y, lz1, { ry }).block(0.26 * s, 0.95 * s, 0.3 * s, color, lx2, y, lz2, { ry });
  b.block(0.62 * s, 0.8 * s, 0.36 * s, color, x, y + 0.95 * s, z, { ry });
  b.sphere(0.2 * s, 7, 6, color, x, y + 1.95 * s, z);
  const [ax1, az1] = at(-0.42 * s, 0);
  const [ax2, az2] = at(0.42 * s, 0);
  b.box(0.18 * s, 0.75 * s, 0.2 * s, color, ax1, y + (1.45 + raise * 0.55) * s, az1, { ry, rz: raise * 0.25 });
  b.box(0.18 * s, 0.75 * s, 0.2 * s, color, ax2, y + (1.45 + raise * 0.55) * s, az2, { ry, rz: -raise * 0.25 });
}

function quadruped(b: ModelBuilder, L: number, W: number, H: number, legH: number, fur: number, head: number, headZ: number, headY: number, headR: number): void {
  b.box(W, H, L, fur, 0, legH + H / 2, 0).box(headR * 1.4, headR * 1.5, headR * 2.2, head, 0, headY, headZ);
  b.mirrorX((s) => {
    b.block(0.14, legH, 0.14, fur, s * (W / 2 - 0.1), 0, L / 2 - 0.18);
    b.block(0.14, legH, 0.14, fur, s * (W / 2 - 0.1), 0, -L / 2 + 0.18);
  });
}

export const REGIONAL_MODELS: Record<string, ModelFn> = {
  // ───────────── Goiânia
  /** Relógio da Avenida Goiás: Art Déco, stepped shaft with fins and a four-faced clock. */
  torre_relogio_goiania: (b) => {
    const cream = 0xeadfc4;
    const ochre = 0xc9963f;
    b.block(6, 1, 6, COL.concreteLight, 0, 0, 0).block(4.6, 1.2, 4.6, cream, 0, 1, 0);
    b.block(3.2, 15, 3.2, cream, 0, 2.2, 0);
    // vertical déco fins on every face
    for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      for (const k of [-0.9, 0, 0.9]) {
        const x = fx !== 0 ? fx * 1.7 : k;
        const z = fz !== 0 ? fz * 1.7 : k;
        b.block(fx !== 0 ? 0.3 : 0.26, 14 - Math.abs(k) * 2, fz !== 0 ? 0.3 : 0.26, ochre, x, 2.2, z);
      }
    }
    // clock box
    b.block(4.2, 4.2, 4.2, cream, 0, 17.2, 0).block(4.5, 0.4, 4.5, ochre, 0, 21.4, 0);
    for (const r of [0, HALF_PI, Math.PI, -HALF_PI]) {
      const dx = Math.sin(r) * 2.12;
      const dz = Math.cos(r) * 2.12;
      const facesZ = Math.abs(dz) > Math.abs(dx);
      b.cyl(1.55, 1.55, 0.12, 16, 0xfff8e6, dx, 19.3, dz, { ...(facesZ ? { rx: HALF_PI } : { rz: HALF_PI }), ...GLOW })
        .box(0.12, 1.1, 0.06, COL.black, dx * 1.03, 19.7, dz * 1.03, { ry: r })
        .box(0.12, 0.8, 0.06, COL.black, dx * 1.03 + Math.cos(r) * 0.3, 19.3, dz * 1.03 - Math.sin(r) * 0.3, { ry: r, rz: HALF_PI });
    }
    // stepped crown
    b.block(3.2, 1.2, 3.2, cream, 0, 21.8, 0).block(2.2, 1.2, 2.2, cream, 0, 23, 0).block(1.2, 1.2, 1.2, ochre, 0, 24.2, 0).cone(0.4, 2.2, 4, ochre, 0, 26.5, 0);
  },
  /** Monumento às Três Raças (Praça Cívica): three bronze figures lifting a stone. */
  tres_racas: (b) => {
    b.block(9, 1.2, 7, COL.concrete, 0, 0, 0).block(6.4, 2.6, 4.2, 0x9a9184, 0, 1.2, 0);
    const y = 3.8;
    figure(b, -1.8, y, 0.4, 2.6, BRONZE, 1, 0.5);
    figure(b, 1.8, y, 0.4, 2.6, BRONZE_DARK, 1, -0.5);
    figure(b, 0, y, -1.1, 2.7, BRONZE, 1, Math.PI);
    b.block(4.6, 1.2, 2.4, 0x8d8579, 0, y + 7.4, -0.2, { rz: 0.05 });
  },
  pamonha: (b) => {
    b.sphere(0.32, 8, 6, 0x9cc46b, 0, 0.28, 0, { sz: 1.9, sy: 0.75 }).box(0.66, 0.05, 0.05, 0xe8dcc0, 0, 0.3, 0.32).box(0.66, 0.05, 0.05, 0xe8dcc0, 0, 0.3, -0.32);
    b.cone(0.16, 0.3, 5, 0x8db35a, 0, 0.3, 0.72, { rx: HALF_PI });
  },
  pamonha_dourada: (b) => {
    b.sphere(0.36, 9, 7, COL.gold, 0, 0.32, 0, { sz: 1.9, sy: 0.75, ...GOLD }).box(0.74, 0.06, 0.06, 0xfff1b8, 0, 0.34, 0.36, GOLD).box(0.74, 0.06, 0.06, 0xfff1b8, 0, 0.34, -0.36, GOLD);
    b.cone(0.18, 0.34, 5, 0xf7d36b, 0, 0.34, 0.8, { rx: HALF_PI, ...GOLD });
  },
  viola_caipira: (b) => {
    const w = 0xb5713a;
    b.cyl(0.38, 0.38, 0.14, 12, w, 0, 0.38, 0, { rx: HALF_PI }).cyl(0.3, 0.3, 0.14, 12, w, 0, 0.92, 0, { rx: HALF_PI });
    b.cyl(0.11, 0.11, 0.15, 10, 0x2b1a0e, 0, 0.66, 0.01, { rx: HALF_PI });
    b.box(0.12, 0.8, 0.08, 0x3b2314, 0, 1.55, 0).box(0.22, 0.26, 0.09, 0x3b2314, 0, 2.05, 0);
    for (let i = 0; i < 5; i++) b.box(0.012, 1.6, 0.012, COL.chrome, -0.04 + i * 0.02, 1.05, 0.08, { noAO: true });
  },
  chapeu_vaqueiro: (b) => {
    b.cyl(0.62, 0.62, 0.05, 14, 0x7b5230, 0, 0.03, 0, { sx: 1.15 }).cyl(0.3, 0.34, 0.36, 10, 0x7b5230, 0, 0.24, 0).cyl(0.345, 0.345, 0.07, 10, 0x3b2314, 0, 0.1, 0);
  },
  berrante: (b) => {
    const horn = 0xe8dcc0;
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      b.cyl(0.05 + t * 0.12, 0.05 + (t + 0.2) * 0.12, 0.36, 8, i % 2 ? horn : 0xc9b48a, -0.9 + i * 0.34, 0.2 + Math.sin(t * Math.PI) * 0.25, 0, { rz: HALF_PI - 0.4 + t * 0.8 });
    }
    b.box(1.6, 0.04, 0.04, 0x3b2314, 0, 0.5, 0);
  },
  // ───────────── Belo Horizonte
  /** Igreja de São Francisco de Assis (Pampulha): vaults, azulejo back wall, slanted bell tower. */
  igrejinha_pampulha: (b) => {
    const white = 0xf4f1ea;
    const tile = 0x2f6db5;
    b.block(30, 0.6, 20, COL.concreteLight, 0, 0, 0);
    // big front vault and three small ones on the side
    b.halfCyl(6.2, 13, 18, white, -6, 0.6, 0);
    b.halfCyl(5.9, 12.6, 18, 0x1f3342, -6, 0.6, 0.25, { noAO: true });
    for (let i = 0; i < 3; i++) b.halfCyl(3.1, 8, 14, white, 4.5 + i * 3.6, 0.6, -2.5);
    // azulejo panel on the back of the big vault
    b.box(12.3, 6.3, 0.2, tile, -6, 3.6, -6.6);
    for (let i = 0; i < 6; i++) b.box(1.4, 1.4, 0.06, 0x8fb8e8, -10.5 + i * 1.8, 2.4 + (i % 2) * 2, -6.75, { noAO: true });
    // front glass with brise slats
    for (let i = 0; i < 9; i++) b.box(0.18, 5.2, 0.3, white, -11 + i * 1.25, 3.2, 6.4);
    // bell tower: inverted trapezoid on a stem, with a cross
    b.block(1, 4, 1, white, 9, 0.6, 7).block(2.6, 7, 1.6, white, 9, 4.6, 7, { sx: 1 });
    b.box(3.6, 0.5, 1.8, white, 9, 11.6, 7).box(0.25, 2, 0.25, COL.black, 9, 13, 7).box(1, 0.25, 0.25, COL.black, 9, 13.4, 7);
  },
  /** Edifício Niemeyer (Praça da Liberdade): wavy slabs stacked twelve floors high. */
  edificio_niemeyer: (b) => {
    const floors = 12;
    const fh = 3.1;
    const segs = 10;
    const W = 26;
    for (let f = 0; f <= floors; f++) {
      const y = f * fh;
      for (let i = 0; i < segs; i++) {
        const xa = -W / 2 + (i * W) / segs;
        const xb = xa + W / segs;
        const za = Math.sin((xa / W) * Math.PI * 2.2) * 2.4;
        const zb = Math.sin((xb / W) * Math.PI * 2.2) * 2.4;
        const ang = Math.atan2(zb - za, xb - xa);
        const len = Math.hypot(xb - xa, zb - za) + 0.15;
        b.box(len, 0.5, 9, f === floors ? 0xe9e5dc : 0xf6f3ec, (xa + xb) / 2, y + 0.25, (za + zb) / 2, { ry: -ang });
        if (f < floors) b.box(len - 0.1, fh - 0.55, 7.6, 0x2c4656, (xa + xb) / 2, y + 0.5 + (fh - 0.5) / 2, (za + zb) / 2 - 0.2, { ry: -ang, noAO: true });
      }
    }
    b.block(W * 0.7, 3, 6, 0x5d6d74, 0, 0, -1);
  },
  fogao_lenha: (b) => {
    b.block(1.6, 0.85, 0.8, COL.brick, 0, 0, 0).block(1.68, 0.08, 0.86, COL.darkMetal, 0, 0.85, 0);
    b.block(0.4, 1.8, 0.4, COL.brick, 0.6, 0.93, -0.2).block(0.3, 0.3, 0.3, COL.darkMetal, 0.6, 2.7, -0.2);
    b.box(0.5, 0.3, 0.06, 0x1a1a1a, -0.3, 0.4, 0.41).box(0.36, 0.18, 0.06, 0xff7a1a, -0.3, 0.38, 0.43, GLOW);
    b.cyl(0.22, 0.2, 0.26, 10, 0x2b2b2b, -0.35, 1.06, 0).cyl(0.16, 0.16, 0.2, 10, 0x6b6b6b, 0.15, 1.03, 0.1);
  },
  panela_pedra: (b) => {
    b.cyl(0.38, 0.3, 0.34, 10, 0x34312f, 0, 0.17, 0).cyl(0.4, 0.4, 0.06, 10, 0x2a2826, 0, 0.36, 0).sphere(0.06, 5, 4, 0x2a2826, 0, 0.42, 0);
    b.mirrorX((s) => b.box(0.12, 0.08, 0.14, 0x2a2826, s * 0.42, 0.28, 0));
  },
  // ───────────── Porto Alegre
  /** Usina do Gasômetro: brick power plant with its very tall chimney. */
  usina_gasometro: (b) => {
    const brick = 0xa64a30;
    const trim = 0xe8d9c0;
    b.block(30, 13, 16, brick, -4, 0, 0).block(30.4, 0.8, 16.4, trim, -4, 13, 0);
    b.prism(30, 4, 16, 0x7b3a28, -4, 13.8, 0);
    for (let i = 0; i < 7; i++) {
      b.block(1.6, 5, 0.2, 0x2c3c45, -16 + i * 4, 4, 8.05, { noAO: true }).cyl(0.8, 0.8, 0.22, 10, 0x2c3c45, -16 + i * 4, 9, 8.05, { rx: HALF_PI, noAO: true });
    }
    b.cyl(2.6, 3.2, 4, 12, brick, 15, 0, 0).cyl(2.6, 2.6, 0.5, 12, trim, 15, 4, 0);
    b.cyl(1.7, 2.5, 46, 12, brick, 15, 27, 0);
    for (const y of [12, 24, 36, 48]) b.cyl(2.2 - y * 0.012, 2.2 - y * 0.012, 0.5, 12, trim, 15, y, 0);
    b.cyl(1.9, 1.75, 1, 12, 0x3a2a24, 15, 50.5, 0);
  },
  /** Estátua do Laçador: a gaúcho in bronze with the lasso, on a stone base. */
  lacador: (b) => {
    b.block(5, 1, 5, COL.concreteLight, 0, 0, 0).block(3.2, 4, 3.2, 0x9a9184, 0, 1, 0);
    const y = 5;
    const s = 2.4;
    // bombacha legs, boots
    b.block(0.36 * s, 0.95 * s, 0.4 * s, BRONZE, -0.22 * s, y, 0).block(0.36 * s, 0.95 * s, 0.4 * s, BRONZE, 0.22 * s, y, 0);
    // poncho and torso
    b.cone(0.75 * s, 1.0 * s, 8, BRONZE_DARK, 0, y + 1.45 * s, 0).block(0.6 * s, 0.4 * s, 0.36 * s, BRONZE, 0, y + 1.7 * s, 0);
    b.sphere(0.2 * s, 7, 6, BRONZE, 0, y + 2.3 * s, 0);
    // hat with a wide brim
    b.cyl(0.45 * s, 0.45 * s, 0.05 * s, 12, BRONZE_DARK, 0, y + 2.45 * s, 0).cyl(0.2 * s, 0.22 * s, 0.22 * s, 10, BRONZE_DARK, 0, y + 2.58 * s, 0);
    // right arm down holding the coiled lasso, left arm bent
    b.box(0.18 * s, 0.8 * s, 0.2 * s, BRONZE, 0.45 * s, y + 1.5 * s, 0.1 * s, { rz: 0.15 });
    b.torus(0.35 * s, 0.035 * s, 5, 14, BRONZE_DARK, 0.62 * s, y + 1.05 * s, 0.25 * s, { ry: HALF_PI });
    b.box(0.18 * s, 0.7 * s, 0.2 * s, BRONZE, -0.45 * s, y + 1.6 * s, 0.2 * s, { rx: -0.6 });
  },
  cuia_chimarrao: (b) => {
    b.sphere(0.3, 9, 7, 0x6b8c3a, 0, 0.3, 0, { sy: 1.15 }).cyl(0.2, 0.22, 0.08, 10, 0xd8c08a, 0, 0.62, 0).cyl(0.17, 0.17, 0.02, 10, 0x4f7a2a, 0, 0.66, 0);
    b.strut(0.05, 0.5, 0, 0.2, 1.05, 0, 0.022, COL.chrome);
  },
  cuia_dourada: (b) => {
    b.sphere(0.32, 9, 7, COL.gold, 0, 0.32, 0, { sy: 1.15, ...GOLD }).cyl(0.22, 0.24, 0.08, 10, 0xfff1b8, 0, 0.66, 0, GOLD);
    b.strut(0.05, 0.54, 0, 0.22, 1.12, 0, 0.026, 0xfff1b8, 5, GOLD);
  },
  garrafa_termica: (b) => {
    b.cyl(0.17, 0.17, 0.62, 10, 0x2f6b4f, 0, 0.31, 0).cyl(0.13, 0.17, 0.1, 10, 0x22302a, 0, 0.67, 0).cyl(0.07, 0.07, 0.07, 8, 0x22302a, 0, 0.75, 0);
    b.box(0.05, 0.42, 0.08, 0x22302a, 0.22, 0.4, 0).box(0.1, 0.05, 0.08, 0x22302a, 0.19, 0.6, 0).box(0.1, 0.05, 0.08, 0x22302a, 0.19, 0.2, 0);
  },
  cavalo_crioulo: (b) => {
    const coat = 0x8a5a33;
    quadruped(b, 1.9, 0.55, 0.75, 1.0, coat, coat, 1.25, 2.05, 0.2);
    b.box(0.26, 0.75, 0.3, coat, 0, 1.75, 0.95, { rx: 0.55 });
    b.box(0.08, 0.6, 0.22, 0x2b1a0e, 0, 1.95, 0.75, { rx: 0.5 });
    b.box(0.1, 0.55, 0.12, 0x2b1a0e, 0, 1.45, -1.0, { rx: -0.4 });
    b.box(0.6, 0.08, 0.7, 0x3b2314, 0, 1.78, -0.05).box(0.5, 0.12, 0.5, 0x7a1f2b, 0, 1.86, -0.05);
  },
};
