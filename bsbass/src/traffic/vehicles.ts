// Carros populares da quebrada (low-poly): hatch quadrado, "Uno", Kombi,
// picape e o busão. Tudo em cor de vértice, luzes numa geometria à parte.

import * as THREE from 'three';
import { GeoBuilder, hex, type RGB } from '../utils/geo';

export const PAINTS = [0xb9bcc0, 0xe8e8e4, 0x1b1c1f, 0x8e1c1c, 0x2c4a7a, 0xb8a27a, 0x2f5a3a, 0x6b6e72, 0xd9c7a0, 0x7a2a4a];

export interface VehicleGeo {
  body: THREE.BufferGeometry;
  lights: THREE.BufferGeometry;
  halfW: number;
  halfL: number;
  mass: number;
}

const GLASS: RGB = hex(0x0d1117);
const BLACK: RGB = hex(0x121212);
const CHROME: RGB = hex(0x9a9ea3);
const HEAD: RGB = hex(0xfff1d0, 2.2);
const HEAD_OFF: RGB = hex(0x9a9486, 0.6);
const TAIL: RGB = hex(0xff1a10, 1.6);
const TAIL_OFF: RGB = hex(0x5a0d0a, 0.7);

function wheel(b: GeoBuilder, x: number, z: number, r: number, w: number): void {
  const seg = 8;
  const pts: [number, number][] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push([Math.cos(a) * r + r, Math.sin(a) * r]);
  }
  const x0 = x - w / 2, x1 = x + w / 2;
  for (let i = 0; i < seg; i++) {
    const [y0, z0] = pts[i]!, [y1, z1] = pts[(i + 1) % seg]!;
    b.quad([x0, y0, z + z0], [x0, y1, z + z1], [x1, y1, z + z1], [x1, y0, z + z0], undefined, BLACK);
  }
  // calotas
  for (const sx of [x0, x1]) {
    const dir = sx === x1 ? 1 : -1;
    for (let i = 0; i < seg; i++) {
      const [y0, z0] = pts[i]!, [y1, z1] = pts[(i + 1) % seg]!;
      const a: [number, number, number] = [sx, r, z];
      const p0: [number, number, number] = [sx, y0, z + z0];
      const p1: [number, number, number] = [sx, y1, z + z1];
      if (dir > 0) b.tri(a, p0, p1, i % 2 ? CHROME : hex(0x55585c));
      else b.tri(a, p1, p0, i % 2 ? CHROME : hex(0x55585c));
    }
  }
}

function wheels(b: GeoBuilder, hw: number, zf: number, zr: number, r = 0.3): void {
  for (const z of [zf, zr]) for (const s of [-1, 1]) wheel(b, s * (hw - 0.1), z, r, 0.2);
}

/** cabine com vidro: trapézio (mais estreita em cima) */
function cabin(b: GeoBuilder, hw: number, y0: number, y1: number, zr0: number, zr1: number, zf1: number, zf0: number, paint: RGB, inset = 0.12): void {
  const tw = hw - inset;
  // laterais (vidro)
  b.quad([hw, y0, zr0], [hw, y0, zf0], [tw, y1, zf1], [tw, y1, zr1], undefined, GLASS);
  b.quad([-hw, y0, zf0], [-hw, y0, zr0], [-tw, y1, zr1], [-tw, y1, zf1], undefined, GLASS);
  // para-brisa e vidro traseiro
  b.quad([-hw, y0, zf0], [hw, y0, zf0], [tw, y1, zf1], [-tw, y1, zf1], undefined, GLASS);
  b.quad([hw, y0, zr0], [-hw, y0, zr0], [-tw, y1, zr1], [tw, y1, zr1], undefined, GLASS);
  // teto
  b.quad([-tw, y1, zf1], [tw, y1, zf1], [tw, y1, zr1], [-tw, y1, zr1], undefined, paint);
  // colunas
  for (const s of [-1, 1]) {
    b.box(s * (hw - inset / 2), (y0 + y1) / 2, zf0 - (zf0 - zf1) / 2, 0.06, y1 - y0, 0.08, paint);
  }
}

export function buildVehicle(model: number, paintHex: number, lightsOn = true): VehicleGeo {
  const b = new GeoBuilder();
  const l = new GeoBuilder();
  const paint = hex(paintHex);
  const dark = hex(paintHex, 0.55);
  const head = lightsOn ? HEAD : HEAD_OFF;
  const tail = lightsOn ? TAIL : TAIL_OFF;
  let hw = 0.8, hl = 1.9, mass = 1000;

  switch (model) {
    case 0: {
      // hatch quadradão
      hw = 0.8; hl = 1.9; mass = 950;
      b.box(0, 0.62, 0, hw * 2, 0.62, hl * 2, paint);
      b.box(0, 0.36, hl - 0.05, hw * 2 + 0.02, 0.16, 0.12, BLACK); // para-choque
      b.box(0, 0.36, -hl + 0.05, hw * 2 + 0.02, 0.16, 0.12, BLACK);
      cabin(b, hw - 0.02, 0.93, 1.38, -hl + 0.25, -hl + 0.45, 0.35, 0.75, paint);
      b.box(0, 0.7, hl + 0.005, 0.7, 0.14, 0.02, BLACK); // grade
      wheels(b, hw, hl - 0.65, -hl + 0.62);
      for (const s of [-1, 1]) {
        l.box(s * 0.58, 0.72, hl + 0.01, 0.34, 0.14, 0.02, head);
        l.box(s * 0.62, 0.72, -hl - 0.01, 0.26, 0.2, 0.02, tail);
      }
      break;
    }
    case 1: {
      // "Uno" caixote
      hw = 0.78; hl = 1.82; mass = 900;
      b.box(0, 0.6, 0.05, hw * 2, 0.6, hl * 2 - 0.1, paint);
      b.box(0, 0.36, hl - 0.03, hw * 2, 0.14, 0.1, BLACK);
      b.box(0, 0.36, -hl + 0.03, hw * 2, 0.14, 0.1, BLACK);
      cabin(b, hw - 0.02, 0.9, 1.45, -hl + 0.12, -hl + 0.2, 0.55, 0.95, paint, 0.08);
      wheels(b, hw, hl - 0.6, -hl + 0.55, 0.28);
      for (const s of [-1, 1]) {
        l.box(s * 0.55, 0.7, hl + 0.01, 0.36, 0.16, 0.02, head);
        l.box(s * 0.66, 0.78, -hl - 0.01, 0.14, 0.36, 0.02, tail);
      }
      break;
    }
    case 2: {
      // Kombi saia-e-blusa
      hw = 0.86; hl = 2.15; mass = 1250;
      const white = hex(0xe8e6de);
      b.box(0, 0.75, 0, hw * 2, 0.9, hl * 2, paint);
      b.box(0, 1.55, -0.05, hw * 2 - 0.04, 0.7, hl * 2 - 0.1, white);
      // janelas laterais
      for (const s of [-1, 1]) b.box(s * (hw - 0.01), 1.58, -0.2, 0.02, 0.42, hl * 2 - 1.2, GLASS);
      b.box(0, 1.58, hl - 0.04, hw * 2 - 0.3, 0.44, 0.02, GLASS);
      b.box(0, 1.9, -0.05, hw * 2 - 0.04, 0.06, hl * 2 - 0.1, white);
      b.box(0, 0.36, hl + 0.02, hw * 2, 0.12, 0.1, CHROME);
      wheels(b, hw, hl - 0.55, -hl + 0.6, 0.32);
      for (const s of [-1, 1]) {
        l.box(s * 0.62, 0.95, hl + 0.01, 0.22, 0.22, 0.02, head);
        l.box(s * 0.7, 0.9, -hl - 0.01, 0.12, 0.3, 0.02, tail);
      }
      break;
    }
    case 3: {
      // picape
      hw = 0.82; hl = 2.2; mass = 1100;
      b.box(0, 0.62, 0, hw * 2, 0.6, hl * 2, paint);
      cabin(b, hw - 0.02, 0.92, 1.45, -0.2, -0.1, 0.8, 1.1, paint, 0.1);
      // caçamba (bordas)
      b.box(0, 0.98, -hl + 0.05, hw * 2, 0.12, 0.1, dark);
      for (const s of [-1, 1]) b.box(s * (hw - 0.05), 0.98, -hl / 2 - 0.2, 0.1, 0.12, hl - 0.3, dark);
      b.box(0, 0.93, -hl / 2 - 0.2, hw * 2 - 0.2, 0.02, hl - 0.4, BLACK);
      b.box(0, 0.36, hl - 0.03, hw * 2, 0.14, 0.1, BLACK);
      wheels(b, hw, hl - 0.7, -hl + 0.7);
      for (const s of [-1, 1]) {
        l.box(s * 0.56, 0.74, hl + 0.01, 0.36, 0.14, 0.02, head);
        l.box(s * 0.72, 0.8, -hl - 0.01, 0.14, 0.3, 0.02, tail);
      }
      break;
    }
    default: {
      // busão
      hw = 1.25; hl = 6; mass = 11000;
      const stripe = hex(0xf2c21a);
      b.box(0, 1.75, 0, hw * 2, 2.9, hl * 2, paint);
      b.box(0, 0.75, 0, hw * 2 + 0.01, 0.25, hl * 2 + 0.01, stripe);
      for (const s of [-1, 1]) b.box(s * (hw + 0.005), 2.25, -0.3, 0.02, 1.0, hl * 2 - 2, GLASS);
      b.box(0, 2.2, hl + 0.005, hw * 2 - 0.2, 1.2, 0.02, GLASS);
      wheels(b, hw, hl - 1.6, -hl + 2.2, 0.5);
      // luz de dentro do busão
      for (const s of [-1, 1]) l.box(s * (hw + 0.012), 2.3, -0.3, 0.01, 0.8, hl * 2 - 2.4, lightsOn ? hex(0xd8f0ff, 0.9) : hex(0x333333));
      l.box(0, 3.0, hl + 0.01, 1.6, 0.25, 0.02, lightsOn ? hex(0xff8a1a, 2) : BLACK); // letreiro
      for (const s of [-1, 1]) {
        l.box(s * 0.9, 0.95, hl + 0.01, 0.34, 0.18, 0.02, head);
        l.box(s * 1.0, 1.0, -hl - 0.01, 0.2, 0.4, 0.02, tail);
      }
    }
  }
  return { body: b.build(), lights: l.build(), halfW: hw, halfL: hl, mass };
}
