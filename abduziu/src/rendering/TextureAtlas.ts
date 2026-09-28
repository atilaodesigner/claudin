import { CanvasTexture, LinearMipmapLinearFilter, LinearFilter, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { BILLBOARD_ADS, SHOP_SIGNS } from '../config/districts';

export interface UVRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

const SIZE_W = 2048;
const SIZE_H = 1024;

const SIGN_PALETTES: Array<[string, string, string]> = [
  ['#e63946', '#fff4d6', '#ffd166'],
  ['#1d3557', '#f1faee', '#e9c46a'],
  ['#2a9d8f', '#ffffff', '#f4a261'],
  ['#f4a261', '#1d1d1d', '#e76f51'],
  ['#6a4c93', '#ffffff', '#8ac926'],
  ['#ffd166', '#3d2c8d', '#ef476f'],
  ['#118ab2', '#ffffff', '#06d6a0'],
  ['#073b4c', '#ffd166', '#ef476f'],
];

/**
 * One canvas atlas shared by the whole city (signs, billboards, labels). Every other
 * surface samples a pure white texel, so the city renders with a single material.
 */
export class TextureAtlas {
  readonly canvas: HTMLCanvasElement;
  readonly texture: CanvasTexture;
  readonly white: UVRect;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly rects = new Map<string, UVRect>();
  private readonly slots = new Map<string, { x: number; y: number; w: number; h: number }>();
  private readonly labelStyles = new Map<string, { bg: string; fg: string; size: number }>();
  private cursorX = 0;
  private cursorY = 0;
  private rowH = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE_W;
    this.canvas.height = SIZE_H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 32, 32);
    this.white = this.toUV(4, 4, 24, 24);
    this.cursorX = 32;
    this.rowH = 32;

    this.buildContent();

    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.minFilter = LinearMipmapLinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.anisotropy = 4;
    this.texture.generateMipmaps = true;
  }

  get(key: string): UVRect {
    return this.rects.get(key) ?? this.white;
  }

  private toUV(x: number, y: number, w: number, h: number): UVRect {
    // canvas y goes down, uv v goes up (flipY = true)
    return { u0: x / SIZE_W, v0: 1 - (y + h) / SIZE_H, u1: (x + w) / SIZE_W, v1: 1 - y / SIZE_H };
  }

  private alloc(w: number, h: number): { x: number; y: number } {
    const pad = 4;
    if (this.cursorX + w + pad > SIZE_W) {
      this.cursorX = 0;
      this.cursorY += this.rowH + pad;
      this.rowH = 0;
    }
    if (import.meta.env.DEV && this.cursorY + h > SIZE_H) console.warn('[TextureAtlas] out of space');
    const pos = { x: this.cursorX, y: this.cursorY };
    this.cursorX += w + pad;
    this.rowH = Math.max(this.rowH, h);
    return pos;
  }

  private region(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): void {
    const { x, y } = this.alloc(w, h);
    this.slots.set(key, { x, y, w, h });
    this.paint(key, draw);
    // inset by half a texel to avoid bleeding
    this.rects.set(key, this.toUV(x + 1, y + 1, w - 2, h - 2));
  }

  /** (Re)draws an allocated region in place: UVs stay valid, so models never rebuild. */
  private paint(key: string, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): void {
    const slot = this.slots.get(key);
    if (!slot) return;
    const { x, y, w, h } = slot;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h);
    ctx.restore();
  }

  /**
   * Swaps the city's shop signs, billboards and named labels (police, bus...) in place.
   * Missing entries fall back to the Nova Aurora defaults.
   */
  applyCity(signs: readonly string[], billboards: readonly string[], labels: Readonly<Record<string, string>>): void {
    SHOP_SIGNS.forEach((def, i) => this.paint(`sign:${i}`, (ctx, w, h) => this.drawSign(ctx, w, h, i, signs[i] ?? def)));
    BILLBOARD_ADS.forEach((def, i) => this.paint(`billboard:${i}`, (ctx, w, h) => this.drawBillboard(ctx, w, h, i, billboards[i] ?? def)));
    for (const [key, text] of Object.entries(labels)) {
      const st = this.labelStyles.get(key);
      if (st) this.paint(key, (ctx, w, h) => this.drawLabel(ctx, w, h, text, st.bg, st.fg, st.size));
    }
    this.texture.needsUpdate = true;
  }

  private drawSign(ctx: CanvasRenderingContext2D, w: number, h: number, i: number, text: string): void {
    const [bg, fg, accent] = SIGN_PALETTES[i % SIGN_PALETTES.length] as [string, string, string];
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = accent;
    ctx.fillRect(0, h - 8, w, 8);
    ctx.fillRect(0, 0, w, 3);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.fitText(ctx, text, w - 18, 40, 800);
    ctx.fillText(text, w / 2, h / 2 - 2);
  }

  private drawBillboard(ctx: CanvasRenderingContext2D, w: number, h: number, i: number, text: string): void {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    const hues = [
      ['#ff006e', '#fb5607'],
      ['#3a86ff', '#8338ec'],
      ['#06d6a0', '#118ab2'],
      ['#ffbe0b', '#fb5607'],
      ['#8338ec', '#ff006e'],
    ][i % 5] as [string, string];
    grad.addColorStop(0, hues[0]);
    grad.addColorStop(1, hues[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(w * 0.86, h * 0.3, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const words = text.split(' — ');
    this.fitText(ctx, words[0] as string, w - 40, 52, 900, true);
    ctx.fillText(words[0] as string, 20, words.length > 1 ? h * 0.38 : h / 2);
    if (words[1]) {
      ctx.fillStyle = '#fff3b0';
      this.fitText(ctx, words[1], w - 40, 40, 800, true);
      ctx.fillText(words[1], 20, h * 0.72);
    }
  }

  private drawLabel(ctx: CanvasRenderingContext2D, cw: number, ch: number, text: string, bg: string, fg: string, size: number): void {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.fitText(ctx, text, cw - 12, size, 800);
    ctx.fillText(text, cw / 2, ch / 2);
  }

  private fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight = 800, italic = false): number {
    let s = size;
    for (;;) {
      ctx.font = `${italic ? 'italic ' : ''}${weight} ${s}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      if (ctx.measureText(text).width <= maxW || s <= 10) return s;
      s -= 2;
    }
  }

  private buildContent(): void {
    SHOP_SIGNS.forEach((text, i) => this.region(`sign:${i}`, 256, 64, (ctx, w, h) => this.drawSign(ctx, w, h, i, text)));
    BILLBOARD_ADS.forEach((text, i) => this.region(`billboard:${i}`, 384, 128, (ctx, w, h) => this.drawBillboard(ctx, w, h, i, text)));

    const label = (key: string, text: string, bg: string, fg: string, w = 256, h = 64, size = 44) => {
      this.labelStyles.set(key, { bg, fg, size });
      this.region(key, w, h, (ctx, cw, ch) => this.drawLabel(ctx, cw, ch, text, bg, fg, size));
    };

    label('police', 'PATRULHA AURORA', '#f4f6f8', '#1d4ed8');
    label('bus', '051 CENTRO / VIA LÁCTEA', '#111111', '#ffb703');
    label('school', 'ESCOLAR', '#ffd60a', '#111111');
    label('taxi', 'TÁXI', '#ffd60a', '#111111', 128, 48, 36);
    label('foodtruck', 'BURGER ESPACIAL', '#e63946', '#fff1c1');
    label('armored', 'VALORES', '#6c757d', '#f8f9fa');
    label('sentinela', 'SENTINELA', '#4b5320', '#e9edc9');
    label('conspiracy', 'NADA PRA VER AQUI', '#f8f9fa', '#111111');
    label('believe', 'EU ACREDITO', '#9d4dff', '#e0ff4f', 256, 64, 40);
    label('feira', 'FEIRA LIVRE', '#ffb703', '#7a1f2b');
    label('acai', 'AÇAÍ', '#5a189a', '#f8f9fa', 128, 48, 36);
    label('coco', 'ÁGUA DE COCO', '#2d6a4f', '#ffffff');
    label('posto', 'POSTO AURORA', '#0b6e4f', '#ffffff');
    label('banca', 'REVISTAS', '#d62828', '#ffffff', 256, 64, 44);
    label('gas', 'GÁS', '#1d4ed8', '#ffffff', 128, 48, 36);
    label('helipad', 'H', '#2b2d42', '#ffffff', 128, 128, 110);
    label('score', 'AURORA 0 x 0 VISITANTE', '#111827', '#fbbf24', 256, 64, 34);
    label('pipoca', 'PIPOCA', '#ffffff', '#e63946', 128, 48, 36);
    label('hot', 'CACHORRO-QUENTE', '#ffd166', '#9d0208');
    label('radio', 'RÁDIO AURORA FM', '#1b263b', '#e0e1dd');
    label('predio', 'EDIFÍCIO AURORA', '#e9ecef', '#343a40');
    label('boss', 'TUCANO NEGRO', '#0b0b0b', '#ff7b00');
    label('tubarao', 'RISCO DE TUBARÃO', '#ffd60a', '#b00020', 256, 192, 40);
    label('acaraje', 'ACARAJÉ', '#ffffff', '#b5179e', 256, 64, 44);
    label('pastel', 'PASTEL + CALDO DE CANA', '#d62828', '#ffd166');
    label('trio', 'TRIO ELÉTRICO ALIENÍGENA', '#111111', '#ffbe0b', 512, 64, 44);
    label('salva', 'SALVA-VIDAS', '#e63946', '#ffffff');
    label('lacerda', 'ELEVADOR LACERDA', '#f1e3c6', '#1d3557');
    label('churros', 'CHURROS', '#e63946', '#fff1c1');
    label('picole', 'PICOLÉ', '#3a86ff', '#ffffff', 256, 64, 46);
    label('caldo', 'CALDO DE CANA', '#ffd23f', '#1e5a2e');
    label('pamonha', 'PAMONHAS • PAMONHAS', '#f4f1e8', '#1e7a2e', 512, 48, 38);
    label('lotacao', 'LOTAÇÃO', '#111111', '#ffd23f', 256, 64, 44);
    label('borracharia', 'BORRACHARIA 24H', '#1d1d21', '#ffd23f', 512, 80, 60);
    label('atm', 'BANCO 24H', '#1d4ed8', '#ffffff');
    label('excursao', 'EXCURSÃO APARECIDA', '#f4f6f8', '#e67e22', 512, 48, 38);

    // stadium-ish flag / bunting strip (festas)
    this.region('bunting', 256, 32, (ctx, w, h) => {
      const colors = ['#e63946', '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#8338ec'];
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) {
        ctx.fillStyle = colors[i % colors.length] as string;
        ctx.beginPath();
        ctx.moveTo(i * 16, 0);
        ctx.lineTo(i * 16 + 16, 0);
        ctx.lineTo(i * 16 + 8, h);
        ctx.closePath();
        ctx.fill();
      }
    });

    // generic window grid (used on apartment facades)
    this.region('windows', 128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const lit = (x * 7 + y * 3) % 5 === 0;
          ctx.fillStyle = lit ? '#fff1b8' : '#5d7a99';
          ctx.fillRect(x * 32 + 6, y * 32 + 6, 20, 18);
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(x * 32 + 6, y * 32 + 6, 20, 4);
        }
      }
    });
  }
}

/** Tileable value-noise texture for fake cloud shadows and ground grit. */
export function createNoiseTexture(size = 256, seed = 7): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const img = ctx.createImageData(size, size);
  const lattice = (s: number) => {
    const g: number[] = [];
    let st = seed * 9301 + s * 49297;
    for (let i = 0; i < s * s; i++) {
      st = (st * 1103515245 + 12345) & 0x7fffffff;
      g.push(st / 0x7fffffff);
    }
    return g;
  };
  const octaves = [4, 8, 16, 32].map((s) => ({ s, g: lattice(s) }));
  const smooth = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      let amp = 0.55;
      let total = 0;
      for (const { s, g } of octaves) {
        const fx = (x / size) * s;
        const fy = (y / size) * s;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = smooth(fx - x0);
        const ty = smooth(fy - y0);
        const at = (ix: number, iy: number) => g[((iy % s) + s) % s * s + (((ix % s) + s) % s)] as number;
        const a = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
        const b = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
        v += (a * (1 - ty) + b * ty) * amp;
        total += amp;
        amp *= 0.5;
      }
      const n = Math.round((v / total) * 255);
      const idx = (y * size + x) * 4;
      img.data[idx] = n;
      img.data[idx + 1] = n;
      img.data[idx + 2] = n;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  return tex;
}

/** Calçada portuguesa (black & white waves), tileable. */
export function createCalcadaTexture(): Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = '#efe9dc';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#26262a';
  for (let band = 0; band < 2; band++) {
    ctx.beginPath();
    const yBase = band * 128 + 40;
    ctx.moveTo(0, yBase);
    for (let x = 0; x <= size; x += 4) {
      ctx.lineTo(x, yBase + Math.sin((x / size) * Math.PI * 4) * 22);
    }
    for (let x = size; x >= 0; x -= 4) {
      ctx.lineTo(x, yBase + 44 + Math.sin((x / size) * Math.PI * 4) * 22);
    }
    ctx.closePath();
    ctx.fill();
  }
  // stone grain
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const px = (i / 4) % size;
    const py = Math.floor(i / 4 / size);
    const grout = px % 8 === 0 || py % 8 === 0 ? 0.82 : 1;
    const jitter = 0.94 + ((px * 31 + py * 17) % 13) / 100;
    img.data[i] = (img.data[i] as number) * grout * jitter;
    img.data[i + 1] = (img.data[i + 1] as number) * grout * jitter;
    img.data[i + 2] = (img.data[i + 2] as number) * grout * jitter;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
