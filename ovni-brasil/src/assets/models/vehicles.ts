import type { ModelBuilder } from '../ModelBuilder';
import { COL } from './palette';
import type { ModelContext, ModelFn } from './types';

const P = { paint: 1 };
const HALF_PI = Math.PI / 2;

function wheel(b: ModelBuilder, x: number, z: number, r = 0.34, w = 0.26): void {
  b.cyl(r, r, w, 8, COL.tire, x, r, z, { rz: HALF_PI }).cyl(r * 0.55, r * 0.55, w + 0.02, 6, COL.rim, x, r, z, { rz: HALF_PI });
}

function wheels4(b: ModelBuilder, halfW: number, front: number, back: number, r = 0.34, w = 0.26): void {
  wheel(b, halfW, front, r, w);
  wheel(b, -halfW, front, r, w);
  wheel(b, halfW, back, r, w);
  wheel(b, -halfW, back, r, w);
}

function lights(b: ModelBuilder, halfW: number, y: number, front: number, back: number): void {
  b.mirrorX((s) => {
    b.box(0.34, 0.16, 0.06, COL.headlight, s * (halfW - 0.24), y, front, { emit: 1, noAO: true });
    b.box(0.3, 0.14, 0.06, COL.taillight, s * (halfW - 0.22), y, back, { emit: 0.7, noAO: true });
  });
}

interface CarSpec {
  length: number;
  width: number;
  bodyH: number;
  cabinH: number;
  cabinLen: number;
  cabinZ: number;
  body: number;
  bodyPaint: boolean;
}

function car(b: ModelBuilder, s: CarSpec): void {
  const half = s.length / 2;
  const hw = s.width / 2;
  const clearance = 0.3;
  const bodyTop = clearance + s.bodyH;
  const body = s.bodyPaint ? COL.paintBase : s.body;
  const bo = s.bodyPaint ? P : {};
  b.block(s.width, s.bodyH, s.length, body, 0, clearance, 0, bo)
    // hood slope feel: slight front wedge
    .block(s.width * 0.98, 0.08, s.length * 0.3, body, 0, bodyTop, half - s.length * 0.16, bo)
    .block(s.width * 0.9, s.cabinH, s.cabinLen, COL.glassCar, 0, bodyTop, s.cabinZ, { noAO: true })
    .block(s.width * 0.92, 0.09, s.cabinLen * 0.86, body, 0, bodyTop + s.cabinH, s.cabinZ - 0.05, bo)
    // pillars
    .block(s.width * 0.92, s.cabinH, 0.12, body, 0, bodyTop, s.cabinZ + s.cabinLen / 2 - 0.1, bo)
    .block(s.width * 0.92, s.cabinH, 0.14, body, 0, bodyTop, s.cabinZ - s.cabinLen / 2 + 0.1, bo)
    .block(s.width + 0.04, 0.2, 0.18, COL.darkMetal, 0, clearance - 0.02, half, {})
    .block(s.width + 0.04, 0.2, 0.18, COL.darkMetal, 0, clearance - 0.02, -half, {});
  wheels4(b, hw - 0.08, half - 0.8, -half + 0.8);
  lights(b, hw, clearance + s.bodyH * 0.65, half + 0.01, -half - 0.01);
}

export const VEHICLE_MODELS: Record<string, ModelFn> = {
  hatch: (b) => car(b, { length: 3.9, width: 1.72, bodyH: 0.62, cabinH: 0.56, cabinLen: 2.0, cabinZ: -0.35, body: COL.paintBase, bodyPaint: true }),
  sedan: (b) => car(b, { length: 4.5, width: 1.78, bodyH: 0.6, cabinH: 0.54, cabinLen: 2.1, cabinZ: -0.1, body: COL.paintBase, bodyPaint: true }),
  taxi: (b, ctx) => {
    car(b, { length: 4.4, width: 1.76, bodyH: 0.6, cabinH: 0.54, cabinLen: 2.1, cabinZ: -0.1, body: 0xffd23f, bodyPaint: false });
    b.mirrorX((s) => b.box(0.02, 0.14, 4.3, 0x1d5fbf, s * 0.89, 0.62, 0));
    b.block(0.62, 0.22, 0.3, 0xffffff, 0, 1.55, -0.1, { emit: 0.4 }).quad(0.56, 0.18, COL.white, 0, 1.66, 0.06, { uv: ctx.atlas.get('taxi') });
  },
  beetle: (b) => {
    b.sphere(1.0, 10, 7, COL.paintBase, 0, 0.72, -0.1, { sx: 0.85, sy: 0.72, sz: 1.95, ...P })
      .sphere(0.72, 8, 6, COL.glassCar, 0, 1.12, -0.25, { sx: 0.95, sy: 0.72, sz: 1.3, noAO: true })
      .sphere(0.7, 8, 6, COL.paintBase, 0, 1.22, -0.3, { sx: 1.0, sy: 0.6, sz: 1.15, ...P })
      .block(1.66, 0.18, 0.16, COL.chrome, 0, 0.3, 1.8)
      .block(1.66, 0.18, 0.16, COL.chrome, 0, 0.3, -1.95);
    b.mirrorX((s) => {
      b.sphere(0.45, 8, 5, COL.paintBase, s * 0.72, 0.52, 1.1, { sy: 0.8, ...P });
      b.sphere(0.45, 8, 5, COL.paintBase, s * 0.72, 0.52, -1.25, { sy: 0.8, ...P });
      b.sphere(0.13, 6, 4, COL.headlight, s * 0.62, 0.78, 1.55, { emit: 1, noAO: true });
    });
    wheels4(b, 0.7, 1.1, -1.25, 0.32, 0.24);
  },
  policecar: (b, ctx) => {
    car(b, { length: 4.6, width: 1.8, bodyH: 0.62, cabinH: 0.54, cabinLen: 2.1, cabinZ: -0.1, body: 0xf4f6f8, bodyPaint: false });
    b.mirrorX((s) => {
      b.box(0.02, 0.22, 4.4, 0x1d4ed8, s * 0.91, 0.62, 0);
      b.quad(2.0, 0.36, COL.white, s * 0.915, 0.95, -0.1, { ry: s * HALF_PI, uv: ctx.atlas.get('police') });
      b.box(0.5, 0.16, 0.36, s > 0 ? 0xff2d2d : 0x2d6bff, s * 0.3, 1.62, -0.1, { emit: 2.2, noAO: true });
    });
    b.box(1.2, 0.06, 0.4, COL.darkMetal, 0, 1.55, -0.1);
  },
  van: (b, ctx) => {
    const L = 5.0;
    b.block(2.0, 1.95, L, 0xffd60a, 0, 0.35, -0.1)
      .block(2.0, 0.9, 0.9, 0xffd60a, 0, 0.35, L / 2 - 0.1 + 0.45 - 0.2)
      .block(1.9, 0.72, 0.1, COL.glassCar, 0, 1.4, L / 2 - 0.12, { rx: -0.25, noAO: true })
      .box(0.02, 0.24, L - 0.4, 0x111111, 1.01, 1.0, -0.1);
    b.mirrorX((s) => {
      b.box(0.02, 0.62, 3.3, COL.glassCar, s * 1.005, 1.72, -0.45, { noAO: true });
      b.quad(1.9, 0.44, COL.white, s * 1.02, 1.0, -0.4, { ry: s * HALF_PI, uv: ctx.atlas.get('school') });
    });
    wheels4(b, 0.92, 1.5, -1.8, 0.4, 0.3);
    lights(b, 1.0, 0.8, 3.11, -L / 2 - 0.12);
  },
  pickup: (b) => {
    b.block(1.85, 0.72, 5.1, COL.paintBase, 0, 0.42, 0, P)
      .block(1.72, 0.72, 1.7, COL.glassCar, 0, 1.14, 0.55, { noAO: true })
      .block(1.76, 0.1, 1.5, COL.paintBase, 0, 1.86, 0.5, P)
      .block(1.85, 0.4, 2.2, COL.paintBase, 0, 1.14, -1.45, P)
      .block(1.6, 0.36, 2.0, 0x2b2b2b, 0, 1.0, -1.45);
    for (let i = 0; i < 5; i++) b.ico(0.34, 0, 0x2f7d32, -0.45 + (i % 3) * 0.45, 1.46, -0.8 - Math.floor(i / 3) * 0.75, { sz: 1.3 });
    wheels4(b, 0.88, 1.6, -1.6, 0.4, 0.3);
    lights(b, 0.92, 0.9, 2.56, -2.56);
  },
  kombi: (b) => {
    b.block(1.85, 1.0, 4.3, COL.paintBase, 0, 0.35, 0, P)
      .block(1.85, 0.72, 4.3, COL.white, 0, 1.35, 0)
      .cyl(0.925, 0.925, 4.3, 8, COL.white, 0, 2.05, 0, { rx: HALF_PI, sx: 1, sz: 0.3 })
      .box(1.75, 0.55, 0.06, COL.glassCar, 0, 1.68, 2.16, { noAO: true })
      .box(1.2, 0.06, 0.8, COL.paintBase, 0, 0.85, 2.14, { rx: HALF_PI, ...P });
    b.mirrorX((s) => {
      b.box(0.02, 0.5, 3.4, COL.glassCar, s * 0.93, 1.66, -0.2, { noAO: true });
      b.sphere(0.13, 6, 4, COL.headlight, s * 0.6, 0.95, 2.16, { emit: 1, noAO: true });
    });
    wheels4(b, 0.84, 1.4, -1.4, 0.34, 0.26);
  },
  foodtruck: (b, ctx) => {
    b.block(2.2, 2.4, 4.4, 0xe63946, 0, 0.45, -0.7)
      .block(2.1, 1.35, 1.6, 0xf1faee, 0, 0.45, 2.1)
      .block(2.0, 0.6, 0.1, COL.glassCar, 0, 1.25, 2.9, { noAO: true })
      .block(0.04, 1.0, 2.6, 0x3b2a1a, 1.11, 1.3, -0.7)
      .box(0.7, 0.06, 2.8, 0xfff1c1, 1.4, 2.2, -0.7, { rz: -0.35 })
      .quad(2.6, 0.5, COL.white, 1.12, 2.55, -0.7, { ry: HALF_PI, uv: ctx.atlas.get('foodtruck') })
      .sphere(0.4, 8, 5, 0xd4a373, 0, 3.15, -0.7, { sy: 0.55 })
      .box(0.7, 0.12, 0.7, 0x6a994e, 0, 3.08, -0.7);
    wheels4(b, 0.98, 1.9, -1.9, 0.42, 0.3);
    lights(b, 1.0, 0.9, 2.92, -2.92);
  },
  armored: (b, ctx) => {
    b.block(2.3, 2.3, 4.2, 0x7d8590, 0, 0.5, -0.8)
      .block(2.2, 1.6, 1.8, 0x6c757d, 0, 0.5, 2.1)
      .block(2.1, 0.55, 0.08, COL.glassDark, 0, 1.45, 3.0, { noAO: true })
      .block(2.36, 0.12, 4.26, 0x495057, 0, 2.8, -0.8);
    b.mirrorX((s) => b.quad(2.4, 0.5, COL.white, s * 1.16, 1.8, -0.8, { ry: s * HALF_PI, uv: ctx.atlas.get('armored') }));
    wheels4(b, 1.02, 2.0, -2.0, 0.46, 0.34);
    wheel(b, 1.02, -0.9, 0.46, 0.34);
    wheel(b, -1.02, -0.9, 0.46, 0.34);
    lights(b, 1.1, 1.0, 3.01, -2.92);
  },
  bus: (b, ctx) => {
    const L = 11;
    b.block(2.55, 2.6, L, COL.paintBase, 0, 0.45, 0, P)
      .block(2.57, 0.16, L, COL.white, 0, 3.05, 0)
      .block(2.4, 0.2, L - 1, 0xdedede, 0, 3.2, -0.2)
      .block(2.4, 1.3, 0.06, COL.glassCar, 0, 1.55, L / 2 + 0.01, { noAO: true })
      .quad(2.0, 0.34, COL.white, 0, 2.86, L / 2 + 0.05, { uv: ctx.atlas.get('bus'), emit: 0.6 });
    b.mirrorX((s) => {
      b.box(0.03, 1.05, L - 1.6, COL.glassCar, s * 1.28, 2.08, -0.4, { noAO: true });
      b.box(0.03, 0.26, L, COL.white, s * 1.285, 1.2, 0);
    });
    b.box(0.03, 1.9, 1.1, COL.glassDark, 1.29, 1.6, 3.5);
    b.box(0.03, 1.9, 1.1, COL.glassDark, 1.29, 1.6, -1.2);
    wheels4(b, 1.12, L / 2 - 1.8, -L / 2 + 2.2, 0.52, 0.36);
    lights(b, 1.25, 0.95, L / 2 + 0.02, -L / 2 - 0.02);
  },
  artbus: (b, ctx) => {
    const seg = (z: number, len: number, front: boolean) => {
      b.block(2.55, 2.6, len, 0x1f7a8c, 0, 0.45, z)
        .block(2.57, 0.2, len, COL.white, 0, 3.05, z)
        .block(2.57, 0.3, len, 0xffb703, 0, 1.05, z);
      b.mirrorX((s) => b.box(0.03, 1.05, len - 1.2, COL.glassCar, s * 1.28, 2.08, z, { noAO: true }));
      if (front) {
        b.block(2.4, 1.3, 0.06, COL.glassCar, 0, 1.55, z + len / 2 + 0.01, { noAO: true });
        b.quad(2.0, 0.34, COL.white, 0, 2.86, z + len / 2 + 0.05, { uv: ctx.atlas.get('bus'), emit: 0.6 });
      }
      wheel(b, 1.12, z + len / 2 - 1.5, 0.52, 0.36);
      wheel(b, -1.12, z + len / 2 - 1.5, 0.52, 0.36);
      wheel(b, 1.12, z - len / 2 + 1.5, 0.52, 0.36);
      wheel(b, -1.12, z - len / 2 + 1.5, 0.52, 0.36);
    };
    seg(3.2, 8.8, true);
    seg(-6.1, 8.0, false);
    for (let i = 0; i < 5; i++) b.block(2.35, 2.5, 0.12, 0x222222, 0, 0.5, -1.6 + i * 0.18);
    lights(b, 1.25, 0.95, 7.62, -10.12);
  },
  truck: (b) => {
    b.block(2.4, 2.2, 1.9, 0xe9ecef, 0, 0.55, 3.6)
      .block(2.3, 0.9, 0.08, COL.glassCar, 0, 1.75, 4.56, { noAO: true })
      .block(2.5, 3.0, 6.4, COL.paintBase, 0, 0.8, -0.8, P)
      .block(2.52, 0.2, 6.42, COL.darkMetal, 0, 0.62, -0.8)
      .block(2.3, 0.4, 0.3, COL.darkMetal, 0, 0.35, 4.55);
    wheels4(b, 1.05, 3.6, -2.8, 0.52, 0.4);
    wheel(b, 1.05, -1.6, 0.52, 0.4);
    wheel(b, -1.05, -1.6, 0.52, 0.4);
    lights(b, 1.2, 0.95, 4.6, -4.02);
  },
  semitruck: (b) => {
    b.block(2.5, 2.8, 2.3, 0x9d0208, 0, 0.6, 6.4)
      .block(2.4, 1.0, 0.08, COL.glassCar, 0, 2.2, 7.56, { noAO: true })
      .block(2.5, 0.9, 1.4, 0x9d0208, 0, 3.4, 6.1)
      .block(2.2, 0.6, 0.2, COL.chrome, 0, 0.5, 7.6)
      .mirrorX((s) => b.cyl(0.1, 0.1, 2.4, 6, COL.chrome, s * 1.0, 3.2, 5.3))
      .block(2.6, 3.4, 12.5, 0xe5e5e5, 0, 1.1, -1.4)
      .block(2.62, 0.5, 12.5, 0x1d3557, 0, 2.2, -1.4)
      .block(2.62, 0.14, 12.5, 0xffb703, 0, 1.5, -1.4);
    wheels4(b, 1.1, 6.6, 5.2, 0.55, 0.42);
    for (let i = 0; i < 3; i++) {
      wheel(b, 1.1, -5.2 - i * 1.25, 0.55, 0.42);
      wheel(b, -1.1, -5.2 - i * 1.25, 0.55, 0.42);
    }
    lights(b, 1.25, 1.0, 7.62, -7.66);
  },
  forklift: (b) => {
    b.block(1.3, 1.1, 2.0, 0xf2b705, 0, 0.3, -0.2)
      .block(1.1, 0.8, 0.9, 0x2b2b2b, 0, 1.4, -0.6)
      .mirrorX((s) => {
        b.cyl(0.04, 0.04, 2.1, 4, COL.darkMetal, s * 0.55, 2.4, -0.2);
        b.cyl(0.04, 0.04, 2.1, 4, COL.darkMetal, s * 0.55, 2.4, -1.0);
        b.cyl(0.05, 0.05, 3.2, 5, COL.darkMetal, s * 0.4, 1.6, 0.95);
        b.block(0.14, 0.06, 1.1, COL.darkMetal, s * 0.3, 0.12, 1.4);
      })
      .block(1.35, 0.1, 1.0, 0xf2b705, 0, 3.45, -0.6)
      .block(1.1, 0.6, 1.0, 0x9c6a3a, 0, 0.2, 1.45);
    wheels4(b, 0.6, 0.5, -0.85, 0.32, 0.3);
  },
  mototaxi: (b, ctx: ModelContext) => {
    VEHICLE_MODELS.moto_base!(b, ctx);
    b.block(0.44, 0.5, 0.28, 0x2f3e5c, 0, 0.95, -0.15)
      .block(0.5, 0.66, 0.32, 0xff7b00, 0, 1.4, -0.12)
      .sphere(0.24, 8, 6, 0xeeeeee, 0, 2.28, -0.1)
      .box(0.3, 0.1, 0.05, 0x3b82f6, 0, 2.28, 0.1, { noAO: true })
      .box(0.14, 0.5, 0.14, COL.skin[2], 0.3, 1.6, 0.3, { rx: -1.1 })
      .box(0.14, 0.5, 0.14, COL.skin[2], -0.3, 1.6, 0.3, { rx: -1.1 });
  },
  moto_base: (b) => {
    b.cyl(0.38, 0.38, 0.18, 8, COL.tire, 0, 0.38, 0.72, { rz: HALF_PI })
      .cyl(0.38, 0.38, 0.18, 8, COL.tire, 0, 0.38, -0.68, { rz: HALF_PI })
      .box(0.34, 0.36, 1.0, 0xd62828, 0, 0.75, 0.02)
      .box(0.3, 0.14, 0.62, COL.black, 0, 1.0, -0.2)
      .strut(0, 0.4, 0.72, 0, 1.12, 0.52, 0.04, COL.chrome)
      .box(0.7, 0.04, 0.05, COL.black, 0, 1.15, 0.5)
      .box(0.18, 0.14, 0.1, COL.headlight, 0, 1.0, 0.66, { emit: 0.8, noAO: true });
  },
  miltruck: (b, ctx) => {
    b.block(2.5, 2.1, 2.2, COL.military, 0, 0.7, 3.2)
      .block(2.4, 0.8, 0.08, COL.glassDark, 0, 1.9, 4.31, { noAO: true })
      .block(2.6, 0.5, 6.0, COL.militaryDark, 0, 0.8, -1.2)
      .cyl(1.3, 1.3, 6.0, 8, COL.military, 0, 1.85, -1.2, { rx: HALF_PI, sy: 1, sx: 1, sz: 0.85 });
    b.mirrorX((s) => b.quad(2.2, 0.45, COL.white, s * 1.31, 1.2, 3.1, { ry: s * HALF_PI, uv: ctx.atlas.get('sentinela') }));
    wheels4(b, 1.1, 3.2, -3.2, 0.58, 0.44);
    wheel(b, 1.1, -1.8, 0.58, 0.44);
    wheel(b, -1.1, -1.8, 0.58, 0.44);
    lights(b, 1.2, 1.1, 4.31, -4.21);
  },
};
