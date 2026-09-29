// Texturas procedurais em canvas: paredes (reboco, tijolo baiano, bloco),
// pixação, grafite, portões de enrolar, janelas com grade, letreiros,
// asfalto, calçada, terra vermelha do cerrado, placas verdes.

import * as THREE from 'three';
import { mulberry32, pick, range, type Rng } from '../utils/rng';
import { PLACES, SHOP_NAMES } from './city';

export const ATLAS_ROWS = 16;
export const EXTRA_SIGNS = ['POSTO 24H', 'CONVENIÊNCIA', 'FEIRA DA QUEBRADA', 'PAREDÃO 61'] as const;
export const SIGN_ROW = { posto: 12, conveniencia: 13, feira: 14, paredao: 15 } as const;
export const ROW = {
  plaster: 0,
  plasterDirty: 1,
  brick: 2,
  block: 3,
  pixo0: 4, // 4..9
  grafite0: 10, // 10..11
  doors: 12,
  windows: 13,
  laje: 14,
  telha: 15,
} as const;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function noise(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rnd: Rng, amount: number, n = 4000, size = 2): void {
  for (let i = 0; i < n; i++) {
    const v = rnd() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${rnd() * amount})`;
    ctx.fillRect(x + rnd() * w, y + rnd() * h, size * rnd() + 0.5, size * rnd() + 0.5);
  }
}

function stains(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rnd: Rng, n: number): void {
  for (let i = 0; i < n; i++) {
    const sx = x + rnd() * w;
    const sy = y + rnd() * h * 0.5;
    const len = range(rnd, 20, h * 0.8);
    const g = ctx.createLinearGradient(sx, sy, sx, sy + len);
    g.addColorStop(0, 'rgba(40,35,30,0.28)');
    g.addColorStop(1, 'rgba(40,35,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sx, sy, range(rnd, 3, 16), len);
  }
}

/** a poeira vermelha do cerrado subindo no pé do muro */
function redDust(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, strength = 0.55): void {
  const g = ctx.createLinearGradient(0, y + h, 0, y + h * 0.55);
  g.addColorStop(0, `rgba(150,62,30,${strength})`);
  g.addColorStop(1, 'rgba(150,62,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y + h * 0.55, w, h * 0.45);
}

/** fotos reais (ambientCG, CC0) usadas como base das paredes, se carregaram */
let PHOTOS: Partial<Record<'plaster' | 'brick' | 'concrete' | 'rebar' | 'plates' | 'painted' | 'corrugated', HTMLImageElement>> = {};

/** preenche o retângulo com a foto repetida (tile = tamanho de cada repetição em px) */
function photoFill(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, tile: number, rnd: Rng): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const ox = -rnd() * tile, oy = -rnd() * tile;
  for (let ty = y + oy; ty < y + h; ty += tile) {
    for (let tx = x + ox; tx < x + w; tx += tile) ctx.drawImage(img, tx, ty, tile + 0.5, tile + 0.5);
  }
  ctx.restore();
}

function plaster(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rnd: Rng, dirty: boolean): void {
  ctx.fillStyle = '#e8e4dc';
  ctx.fillRect(x, y, w, h);
  if (PHOTOS.plaster) {
    photoFill(ctx, PHOTOS.plaster, x, y, w, h, 200, rnd);
    // clareia um pouco pra pintura (cor de vértice) aparecer
    ctx.fillStyle = 'rgba(240,236,228,0.25)';
    ctx.fillRect(x, y, w, h);
  }
  noise(ctx, x, y, w, h, rnd, 0.08, 9000, 3);
  // manchas de reboco remendado
  for (let i = 0; i < (dirty ? 14 : 5); i++) {
    ctx.fillStyle = `rgba(120,110,100,${range(rnd, 0.05, 0.16)})`;
    ctx.beginPath();
    ctx.ellipse(x + rnd() * w, y + rnd() * h, range(rnd, 10, 60), range(rnd, 8, 40), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  stains(ctx, x, y, w, h, rnd, dirty ? 26 : 8);
  redDust(ctx, x, y, w, h, dirty ? 0.6 : 0.4);
  // rachaduras
  ctx.strokeStyle = 'rgba(50,45,40,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < (dirty ? 6 : 2); i++) {
    let cx = x + rnd() * w, cy = y + rnd() * h;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let k = 0; k < 6; k++) {
      cx += range(rnd, -10, 10);
      cy += range(rnd, 4, 14);
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }
}

function brick(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rnd: Rng): void {
  ctx.fillStyle = '#8f8a80'; // argamassa
  ctx.fillRect(x, y, w, h);
  const bw = 30, bh = 15;
  if (PHOTOS.brick) photoFill(ctx, PHOTOS.brick, x, y, w, h, 170, rnd);
  else for (let row = 0; row * bh < h; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let cx = -bw; cx < w + bw; cx += bw) {
      const r = 170 + rnd() * 40, g = 80 + rnd() * 25, b = 45 + rnd() * 20;
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      const bx = x + cx + off + 1.5, by = y + row * bh + 1.5;
      const ww = Math.min(bw - 3, x + w - bx), hh = Math.min(bh - 3, y + h - by);
      if (ww > 0 && hh > 0 && bx >= x) ctx.fillRect(bx, by, ww, hh);
    }
  }
  noise(ctx, x, y, w, h, rnd, 0.12, 6000, 2);
  // escorrido de argamassa
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = 'rgba(160,155,145,0.5)';
    ctx.fillRect(x + rnd() * w, y + rnd() * h, range(rnd, 4, 22), range(rnd, 2, 5));
  }
  redDust(ctx, x, y, w, h, 0.35);
}

function concreteBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rnd: Rng): void {
  ctx.fillStyle = '#6f6e6a';
  ctx.fillRect(x, y, w, h);
  if (PHOTOS.concrete) {
    photoFill(ctx, PHOTOS.concrete, x, y, w, h, 220, rnd);
    // juntas dos blocos por cima da foto
    ctx.strokeStyle = 'rgba(40,38,34,0.55)';
    ctx.lineWidth = 2;
    for (let row = 0; row * 24 < h; row++) {
      ctx.beginPath();
      ctx.moveTo(x, y + row * 24);
      ctx.lineTo(x + w, y + row * 24);
      ctx.stroke();
      for (let cx = (row % 2) * 24; cx < w; cx += 48) {
        ctx.beginPath();
        ctx.moveTo(x + cx, y + row * 24);
        ctx.lineTo(x + cx, y + row * 24 + 24);
        ctx.stroke();
      }
    }
    stains(ctx, x, y, w, h, rnd, 10);
    redDust(ctx, x, y, w, h, 0.45);
    return;
  }
  const bw = 48, bh = 24;
  for (let row = 0; row * bh < h; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let cx = -bw; cx < w + bw; cx += bw) {
      const v = 125 + rnd() * 25;
      ctx.fillStyle = `rgb(${v | 0},${(v - 2) | 0},${(v - 6) | 0})`;
      const bx = x + cx + off + 2, by = y + row * bh + 2;
      const ww = Math.min(bw - 4, x + w - bx), hh = Math.min(bh - 4, y + h - by);
      if (ww > 0 && hh > 0 && bx >= x) ctx.fillRect(bx, by, ww, hh);
    }
  }
  noise(ctx, x, y, w, h, rnd, 0.14, 8000, 2);
  stains(ctx, x, y, w, h, rnd, 10);
  redDust(ctx, x, y, w, h, 0.45);
}

// ---------------- pixação ----------------
// letras retas, altas e pontudas (estilo "tag reto" das quebradas)
function pixoGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, rnd: Rng): number {
  const w = h * range(rnd, 0.22, 0.34);
  const top = y, bot = y + h;
  ctx.beginPath();
  const type = Math.floor(rnd() * 7);
  switch (type) {
    case 0: // |\|
      ctx.moveTo(x, bot); ctx.lineTo(x, top); ctx.lineTo(x + w, bot); ctx.lineTo(x + w, top - h * 0.12);
      break;
    case 1: // A pontudo
      ctx.moveTo(x, bot); ctx.lineTo(x + w / 2, top - h * 0.15); ctx.lineTo(x + w, bot);
      ctx.moveTo(x + w * 0.2, y + h * 0.6); ctx.lineTo(x + w * 0.8, y + h * 0.55);
      break;
    case 2: // E / F com traços inclinados
      ctx.moveTo(x + w, top); ctx.lineTo(x, top + h * 0.05); ctx.lineTo(x, bot); ctx.lineTo(x + w, bot - h * 0.05);
      ctx.moveTo(x, y + h * 0.5); ctx.lineTo(x + w * 0.8, y + h * 0.42);
      break;
    case 3: // R / K
      ctx.moveTo(x, bot); ctx.lineTo(x, top); ctx.lineTo(x + w, top + h * 0.25); ctx.lineTo(x, y + h * 0.5); ctx.lineTo(x + w, bot);
      break;
    case 4: // S anguloso
      ctx.moveTo(x + w, top); ctx.lineTo(x, top + h * 0.3); ctx.lineTo(x + w, top + h * 0.7); ctx.lineTo(x, bot);
      break;
    case 5: // T com coroa
      ctx.moveTo(x - w * 0.2, top); ctx.lineTo(x + w * 1.2, top - h * 0.06);
      ctx.moveTo(x + w / 2, top); ctx.lineTo(x + w / 2, bot);
      break;
    default: // O / V
      ctx.moveTo(x, top); ctx.lineTo(x + w / 2, bot); ctx.lineTo(x + w, top);
      break;
  }
  ctx.stroke();
  return w;
}

export function drawPixo(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, rnd: Rng, color = '#111'): number {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, h * 0.07);
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';
  const n = 3 + Math.floor(rnd() * 5);
  let cx = x;
  for (let i = 0; i < n; i++) {
    const w = pixoGlyph(ctx, cx, y + range(rnd, -h * 0.05, h * 0.05), h, rnd);
    cx += w + h * 0.1;
  }
  // sublinhado / "grife" embaixo
  if (rnd() < 0.6) {
    ctx.beginPath();
    ctx.moveTo(x, y + h * 1.18);
    ctx.lineTo(cx, y + h * 1.12);
    ctx.lineWidth *= 0.6;
    ctx.stroke();
  }
  return cx - x;
}

function markerTag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `${size}px "Permanent Marker", "Comic Sans MS", cursive`;
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

const TAGS = ['BSB', 'DF 61', 'CEI', 'QNN', 'SAMAMBA', 'RAP', 'QUEBRADA', 'SOL NASCENTE', 'GRAVE', 'PAZ', 'TAGUA', 'P.SUL', 'BSBASS', 'É NÓIS', 'LOKO'];

function pixoWall(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rnd: Rng, base: 'plaster' | 'brick' | 'block'): void {
  if (base === 'plaster') plaster(ctx, x, y, w, h, rnd, true);
  else if (base === 'brick') brick(ctx, x, y, w, h, rnd);
  else concreteBlock(ctx, x, y, w, h, rnd);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // camadas de pixo sobrepostas
  const layers = 3 + Math.floor(rnd() * 4);
  for (let i = 0; i < layers; i++) {
    const ph = range(rnd, 40, 110);
    const col = rnd() < 0.8 ? 'rgba(15,15,15,0.92)' : pick(rnd, ['#b0121b', '#1b3bb0', '#e6e6e6']);
    drawPixo(ctx, x + range(rnd, -20, w - 120), y + range(rnd, 10, h - ph - 30), ph, rnd, col);
  }
  for (let i = 0; i < 3; i++) {
    markerTag(ctx, pick(rnd, TAGS), x + rnd() * (w - 150), y + range(rnd, 60, h - 20), range(rnd, 26, 48), pick(rnd, ['#111', '#222', '#c01', '#fff']), range(rnd, -0.2, 0.1));
  }
  ctx.restore();
}

function grafiteWall(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rnd: Rng, word: string): void {
  // fundo pintado de uma cor viva
  const bg = pick(rnd, ['#1d2a6b', '#5c1f6e', '#0f5c55', '#6e2412', '#20242c']);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  noise(ctx, x, y, w, h, rnd, 0.1, 5000, 2);
  // spray em nuvens
  for (let i = 0; i < 60; i++) {
    const c = pick(rnd, ['#ff2d95', '#26e0ff', '#ffe23b', '#7cff4f', '#ff6a1a', '#9b5cff']);
    const gx = x + rnd() * w, gy = y + rnd() * h, r = range(rnd, 10, 60);
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
    g.addColorStop(0, c + '66');
    g.addColorStop(1, c + '00');
    ctx.fillStyle = g;
    ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
  }
  ctx.save();
  ctx.font = `${Math.floor(h * 0.62)}px "Permanent Marker", Impact, sans-serif`;
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(word).width;
  const sx = Math.min(1, (w * 0.9) / tw);
  ctx.translate(x + w / 2, y + h * 0.52);
  ctx.scale(sx, 1);
  ctx.rotate(-0.04);
  ctx.lineJoin = 'round';
  // sombra 3D
  ctx.fillStyle = '#0a0a0a';
  ctx.fillText(word, -tw / 2 + 8, 8);
  const g = ctx.createLinearGradient(0, -h * 0.3, 0, h * 0.3);
  g.addColorStop(0, pick(rnd, ['#ffe23b', '#26e0ff', '#ff2d95']));
  g.addColorStop(1, pick(rnd, ['#ff6a1a', '#7cff4f', '#9b5cff']));
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#fff';
  ctx.strokeText(word, -tw / 2, 0);
  ctx.fillStyle = g;
  ctx.fillText(word, -tw / 2, 0);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#111';
  ctx.strokeText(word, -tw / 2, 0);
  ctx.restore();
  // escorrido
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x + rnd() * w, y + h * 0.7, 2, range(rnd, 10, 50));
  }
  redDust(ctx, x, y, w, h, 0.4);
}

function rollingDoor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rnd: Rng, color: string, pixo: boolean): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  // chapa de metal de verdade por baixo; o portão verde é pintado e descascado
  const plate = color === '#2f5a7a' ? PHOTOS.painted : PHOTOS.plates;
  if (plate) {
    photoFill(ctx, plate, x, y, w, h, 256, rnd);
    if (plate === PHOTOS.plates) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }
  }
  for (let yy = y; yy < y + h; yy += 7) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, yy, w, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, yy + 2, w, 1);
  }
  noise(ctx, x, y, w, h, rnd, 0.15, 1500, 2);
  // ferrugem
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = `rgba(120,50,20,${range(rnd, 0.1, 0.35)})`;
    ctx.fillRect(x + rnd() * w, y + h * range(rnd, 0.6, 1) - 10, range(rnd, 5, 30), range(rnd, 3, 12));
  }
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x, y, w, 10);
  if (pixo) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    drawPixo(ctx, x + 10, y + 50, range(rnd, 60, 110), rnd, rnd() < 0.7 ? '#0d0d0d' : '#ddd');
    ctx.restore();
  }
}

function windowTile(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rnd: Rng, kind: number): void {
  // moldura
  ctx.fillStyle = '#d8d3c8';
  ctx.fillRect(x, y, w, h);
  const m = 14;
  ctx.fillStyle = kind === 3 ? '#3a2a18' : '#0c1016';
  ctx.fillRect(x + m, y + m, w - m * 2, h - m * 2);
  // reflexo
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, 'rgba(120,140,170,0.25)');
  g.addColorStop(0.5, 'rgba(120,140,170,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x + m, y + m, w - m * 2, h - m * 2);
  // grade
  ctx.strokeStyle = kind === 1 ? '#f2f2f2' : '#262626';
  ctx.lineWidth = 4;
  ctx.beginPath();
  const bars = kind === 2 ? 4 : 7;
  for (let i = 1; i < bars; i++) {
    const bx = x + m + ((w - 2 * m) * i) / bars;
    ctx.moveTo(bx, y + m);
    ctx.lineTo(bx, y + h - m);
  }
  if (kind === 2) {
    // grade com losangos
    for (let i = 0; i < 6; i++) {
      ctx.moveTo(x + m, y + m + i * 40);
      ctx.lineTo(x + w - m, y + m + i * 40 + 30);
    }
  }
  ctx.moveTo(x + m, y + h / 2);
  ctx.lineTo(x + w - m, y + h / 2);
  ctx.stroke();
  noise(ctx, x, y, w, h, rnd, 0.1, 800, 2);
}

function laje(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rnd: Rng): void {
  ctx.fillStyle = '#8a8680';
  ctx.fillRect(x, y, w, h);
  if (PHOTOS.rebar) photoFill(ctx, PHOTOS.rebar, x, y, w, h, 256, rnd);
  else if (PHOTOS.concrete) photoFill(ctx, PHOTOS.concrete, x, y, w, h, 256, rnd);
  noise(ctx, x, y, w, h, rnd, 0.18, 12000, 3);
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = `rgba(40,40,40,${range(rnd, 0.1, 0.3)})`;
    ctx.beginPath();
    ctx.ellipse(x + rnd() * w, y + rnd() * h, range(rnd, 10, 80), range(rnd, 5, 30), 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function telha(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rnd: Rng): void {
  // fibrocimento ondulado
  if (PHOTOS.corrugated) photoFill(ctx, PHOTOS.corrugated, x, y, w, h, 256, rnd);
  for (let xx = 0; xx < w; xx += 2) {
    const v = 120 + Math.sin(xx * 0.25) * 30;
    ctx.fillStyle = PHOTOS.corrugated ? `rgba(${v | 0},${v | 0},${(v - 4) | 0},0.45)` : `rgb(${v | 0},${v | 0},${(v - 4) | 0})`;
    ctx.fillRect(x + xx, y, 2, h);
  }
  noise(ctx, x, y, w, h, rnd, 0.2, 8000, 3);
  for (let i = 0; i < 25; i++) {
    ctx.fillStyle = `rgba(30,40,20,${range(rnd, 0.1, 0.3)})`; // limo
    ctx.fillRect(x + rnd() * w, y + rnd() * h, range(rnd, 10, 50), range(rnd, 10, 60));
  }
}

export interface Textures {
  wall: THREE.CanvasTexture;
  shops: THREE.CanvasTexture;
  signs: THREE.CanvasTexture;
  asphalt: THREE.CanvasTexture;
  sidewalk: THREE.CanvasTexture;
  dirt: THREE.CanvasTexture;
  glow: THREE.CanvasTexture;
  litWindow: THREE.CanvasTexture;
  puff: THREE.CanvasTexture;
  pool: THREE.CanvasTexture;
  marks: THREE.CanvasTexture;
}

function tex(c: HTMLCanvasElement, repeat = false, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function makeTextures(photos: typeof PHOTOS = {}): Textures {
  PHOTOS = photos;
  const rnd = mulberry32(6161);

  // ---------- atlas das paredes ----------
  const [wc, w] = canvas(1024, 256 * ATLAS_ROWS);
  const R = (r: number) => r * 256;
  plaster(w, 0, R(ROW.plaster), 1024, 256, rnd, false);
  plaster(w, 0, R(ROW.plasterDirty), 1024, 256, rnd, true);
  brick(w, 0, R(ROW.brick), 1024, 256, rnd);
  concreteBlock(w, 0, R(ROW.block), 1024, 256, rnd);
  const bases = ['plaster', 'brick', 'plaster', 'block', 'plaster', 'brick'] as const;
  for (let i = 0; i < 6; i++) pixoWall(w, 0, R(ROW.pixo0 + i), 1024, 256, rnd, bases[i]!);
  grafiteWall(w, 0, R(ROW.grafite0), 1024, 256, rnd, 'BSBASS');
  grafiteWall(w, 0, R(ROW.grafite0 + 1), 1024, 256, rnd, 'QUEBRADA 61');
  const doorColors = ['#7d8084', '#6a4a2a', '#2f5a7a', '#8a8f93'];
  for (let i = 0; i < 4; i++) rollingDoor(w, i * 256, R(ROW.doors), 256, 256, rnd, doorColors[i]!, i !== 2);
  for (let i = 0; i < 4; i++) windowTile(w, i * 256, R(ROW.windows), 256, 256, rnd, i);
  laje(w, 0, R(ROW.laje), 1024, 256, rnd);
  telha(w, 0, R(ROW.telha), 1024, 256, rnd);

  // ---------- letreiros de comércio (emissivos) ----------
  const [sc, s] = canvas(1024, 128 * 16);
  const shopColors = ['#ff2a2a', '#ffd21a', '#b24dff', '#1ae0ff', '#ffffff', '#ff4fb4', '#3cff6e', '#ff8a1a', '#1a8cff', '#ffffff', '#ffd21a', '#26e0ff', '#ffffff', '#ff2a2a', '#ffd21a', '#3cff6e'];
  [...SHOP_NAMES, ...EXTRA_SIGNS].forEach((name, i) => {
    const y = i * 128;
    s.fillStyle = i % 3 === 0 ? '#101014' : i % 3 === 1 ? '#1c1208' : '#0a1418';
    s.fillRect(0, y, 1024, 128);
    s.strokeStyle = shopColors[i]!;
    s.lineWidth = 6;
    s.strokeRect(8, y + 8, 1008, 112);
    s.font = '82px Anton, Impact, sans-serif';
    s.textAlign = 'center';
    s.textBaseline = 'middle';
    s.fillStyle = shopColors[i]!;
    s.shadowColor = shopColors[i]!;
    s.shadowBlur = 18;
    s.fillText(name, 512, y + 68, 960);
    s.shadowBlur = 0;
  });

  // ---------- placas verdes ----------
  const [gc, g] = canvas(512, 128 * 16);
  for (let i = 0; i < 16; i++) {
    const y = i * 128;
    g.fillStyle = '#0d5a34';
    g.fillRect(0, y, 512, 128);
    g.strokeStyle = '#f2f2f2';
    g.lineWidth = 5;
    g.strokeRect(6, y + 6, 500, 116);
    g.fillStyle = '#f2f2f2';
    g.font = '52px Anton, Impact, sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(PLACES[i % PLACES.length]!, 24, y + 48, 400);
    g.font = '30px Anton, Impact, sans-serif';
    g.fillText(`QN${'MNOPR'[i % 5]} ${3 + i * 2}  →`, 24, y + 96);
    // pixo por cima da placa (clássico)
    if (i % 3 === 0) drawPixo(g, 330, y + 70, 40, rnd, '#111');
  }

  // ---------- asfalto ----------
  const [ac, a] = canvas(512, 512);
  a.fillStyle = '#26272a';
  a.fillRect(0, 0, 512, 512);
  noise(a, 0, 0, 512, 512, rnd, 0.22, 40000, 2);
  for (let i = 0; i < 18; i++) {
    // remendos
    a.fillStyle = `rgba(${rnd() < 0.5 ? 10 : 60},${rnd() < 0.5 ? 10 : 58},${rnd() < 0.5 ? 12 : 55},${range(rnd, 0.2, 0.45)})`;
    const px = rnd() * 512, py = rnd() * 512;
    a.fillRect(px, py, range(rnd, 20, 120), range(rnd, 20, 90));
  }
  a.strokeStyle = 'rgba(8,8,8,0.6)';
  a.lineWidth = 1.5;
  for (let i = 0; i < 10; i++) {
    let x = rnd() * 512, y = rnd() * 512;
    a.beginPath();
    a.moveTo(x, y);
    for (let k = 0; k < 12; k++) {
      x += range(rnd, -14, 14);
      y += range(rnd, -14, 14);
      a.lineTo(x, y);
    }
    a.stroke();
  }
  // poeira vermelha
  for (let i = 0; i < 30; i++) {
    const px = rnd() * 512, py = rnd() * 512, r = range(rnd, 20, 90);
    const gg = a.createRadialGradient(px, py, 0, px, py, r);
    gg.addColorStop(0, 'rgba(130,60,30,0.16)');
    gg.addColorStop(1, 'rgba(130,60,30,0)');
    a.fillStyle = gg;
    a.fillRect(px - r, py - r, r * 2, r * 2);
  }

  // ---------- calçada ----------
  const [cc, c] = canvas(256, 256);
  c.fillStyle = '#7d7a74';
  c.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) {
    for (let x = 0; x < 256; x += 64) {
      const v = 110 + rnd() * 30;
      c.fillStyle = `rgb(${v | 0},${(v - 3) | 0},${(v - 8) | 0})`;
      c.fillRect(x + 2, y + 2, 60, 60);
    }
  }
  noise(c, 0, 0, 256, 256, rnd, 0.2, 5000, 2);
  for (let i = 0; i < 8; i++) {
    c.fillStyle = 'rgba(140,65,30,0.25)';
    c.fillRect(rnd() * 256, rnd() * 256, range(rnd, 20, 80), range(rnd, 10, 50));
  }

  // ---------- terra vermelha ----------
  const [dc, d] = canvas(512, 512);
  d.fillStyle = '#7a3418';
  d.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60000; i++) {
    const v = rnd();
    d.fillStyle = v < 0.5 ? `rgba(60,20,8,${rnd() * 0.3})` : `rgba(190,95,50,${rnd() * 0.3})`;
    d.fillRect(rnd() * 512, rnd() * 512, 2 + rnd() * 2, 2 + rnd() * 2);
  }
  for (let i = 0; i < 25; i++) {
    // tufos de capim seco
    d.fillStyle = `rgba(150,130,70,${range(rnd, 0.2, 0.5)})`;
    const px = rnd() * 512, py = rnd() * 512;
    for (let k = 0; k < 30; k++) d.fillRect(px + range(rnd, -12, 12), py + range(rnd, -12, 12), 1, range(rnd, 3, 8));
  }

  // ---------- janela acesa (2 variações lado a lado: cortina / grade) ----------
  const [wc2, wl] = canvas(256, 128);
  for (let k = 0; k < 2; k++) {
    const x = k * 128;
    const gl = wl.createLinearGradient(x, 0, x, 128);
    gl.addColorStop(0, '#fff');
    gl.addColorStop(1, '#bbb');
    wl.fillStyle = gl;
    wl.fillRect(x, 0, 128, 128);
    if (k === 0) {
      // cortina
      for (let i = 0; i < 128; i += 6) {
        wl.fillStyle = `rgba(0,0,0,${0.15 + 0.15 * Math.sin(i * 0.8)})`;
        wl.fillRect(x + i, 0, 3, 128);
      }
      wl.fillStyle = 'rgba(0,0,0,0.35)';
      wl.fillRect(x + 50, 0, 28, 128);
    }
    wl.strokeStyle = '#111';
    wl.lineWidth = 5;
    wl.beginPath();
    for (let i = 1; i < 6; i++) {
      wl.moveTo(x + (128 * i) / 6, 0);
      wl.lineTo(x + (128 * i) / 6, 128);
    }
    wl.moveTo(x, 64);
    wl.lineTo(x + 128, 64);
    wl.stroke();
    wl.lineWidth = 12;
    wl.strokeRect(x + 2, 2, 124, 124);
  }

  // ---------- brilhos ----------
  const [lc, l] = canvas(128, 128);
  const lg = l.createRadialGradient(64, 64, 0, 64, 64, 64);
  lg.addColorStop(0, 'rgba(255,255,255,1)');
  lg.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  lg.addColorStop(1, 'rgba(255,255,255,0)');
  l.fillStyle = lg;
  l.fillRect(0, 0, 128, 128);

  const [pc, p] = canvas(128, 128);
  const pg = p.createRadialGradient(64, 64, 0, 64, 64, 64);
  pg.addColorStop(0, 'rgba(255,255,255,0.9)');
  pg.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  pg.addColorStop(1, 'rgba(255,255,255,0)');
  p.fillStyle = pg;
  p.fillRect(0, 0, 128, 128);
  // textura irregular pra fumaça
  for (let i = 0; i < 30; i++) {
    p.globalCompositeOperation = 'destination-out';
    p.fillStyle = `rgba(0,0,0,${range(rnd, 0.05, 0.2)})`;
    p.beginPath();
    p.arc(rnd() * 128, rnd() * 128, range(rnd, 6, 20), 0, Math.PI * 2);
    p.fill();
  }
  p.globalCompositeOperation = 'source-over';

  const [oc, o] = canvas(256, 256);
  const og = o.createRadialGradient(128, 128, 0, 128, 128, 128);
  og.addColorStop(0, 'rgba(255,255,255,0.85)');
  og.addColorStop(0.35, 'rgba(255,255,255,0.4)');
  og.addColorStop(0.7, 'rgba(255,255,255,0.1)');
  og.addColorStop(1, 'rgba(255,255,255,0)');
  o.fillStyle = og;
  o.fillRect(0, 0, 256, 256);

  // ---------- marcas da pista (faixa) com desgaste ----------
  const [mc, m] = canvas(64, 256);
  m.fillStyle = '#fff';
  m.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 900; i++) {
    m.fillStyle = `rgba(0,0,0,${rnd() * 0.9})`;
    m.fillRect(rnd() * 64, rnd() * 256, 2 + rnd() * 6, 2 + rnd() * 6);
  }

  return {
    wall: tex(wc),
    shops: tex(sc),
    signs: tex(gc),
    asphalt: tex(ac, true),
    sidewalk: tex(cc, true),
    dirt: tex(dc, true),
    glow: tex(lc),
    litWindow: tex(wc2),
    puff: tex(pc),
    pool: tex(oc),
    marks: tex(mc, true),
  };
}
