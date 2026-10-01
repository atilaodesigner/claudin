/**
 * GUETO GAME STUDIO sting (canvas 2D), the first thing on screen.
 *
 * The mark is vectorized from the studio artwork (1860×846 reference): red frame,
 * chamfered block letters and a wide-tracked white "GAME STUDIO" line. All coordinates
 * below are in that reference space.
 *
 * Beats: frame draws itself → letters stamp in → light sweep → GAME STUDIO writes on →
 * the frame opens like a portal into the game logo.
 */

import { clamp01, easeInCubic, easeInOutCubic, easeOutCubic, easeOutExpo, seg } from './ease';

type Pt = readonly [number, number];

export const STUDIO_RED = '#fb010a';
const WHITE = '#f4f4f4';

const C = 26; // chamfer
/** Letter outlines (evenodd). The G's counter opens through the slit on its right, so it's one ring. */
const LETTERS: ReadonlyArray<{ box: readonly [number, number, number, number]; rings: ReadonlyArray<ReadonlyArray<Pt>> }> = [
  {
    box: [271, 270, 525, 499],
    rings: [
      [
        [271 + C, 270], [525 - C, 270], [525, 270 + C], [525, 343], [456, 343], [456, 325], [337, 325], [337, 446],
        [457, 446], [457, 413], [399, 413], [399, 384], [383, 365], [525, 365], [525, 499 - C], [525 - C, 499],
        [271 + C, 499], [271, 499 - C], [271, 270 + C],
      ],
    ],
  },
  {
    box: [546, 270, 794, 499],
    rings: [[[546, 270], [611, 270], [611, 446], [729, 446], [729, 270], [794, 270], [794, 499 - C], [794 - C, 499], [546 + C, 499], [546, 499 - C]]],
  },
  {
    box: [816, 270, 1052, 499],
    rings: [
      [
        [816 + C, 270], [1052, 270], [1052, 324], [882, 324], [882, 360], [1047, 360], [1047, 413], [882, 413], [882, 446],
        [1052, 446], [1052, 499], [816 + C, 499], [816, 499 - C], [816, 270 + C],
      ],
    ],
  },
  {
    box: [1073, 270, 1312, 499],
    rings: [[[1073, 270], [1312, 270], [1312, 324], [1225, 324], [1225, 499], [1159, 499], [1159, 324], [1073, 324]]],
  },
  {
    box: [1333, 270, 1590, 499],
    rings: [
      [[1333 + C, 270], [1590 - C, 270], [1590, 270 + C], [1590, 499 - C], [1590 - C, 499], [1333 + C, 499], [1333, 499 - C], [1333, 270 + C]],
      [[1397, 324], [1524, 324], [1524, 445], [1397, 445]],
    ],
  },
];

/** Frame stroke, centered on the artwork's 27px border. */
const FRAME = { x0: 214, y0: 214, x1: 1647, y1: 548, stroke: 27 };
/** Mark bounds (frame + GAME STUDIO) and its center. */
const BOUNDS = { x0: 200, y0: 200, x1: 1661, y1: 671 };
const CX = (BOUNDS.x0 + BOUNDS.x1) / 2;
const CY = (BOUNDS.y0 + BOUNDS.y1) / 2;

/** Monoline geometric glyphs for "GAME STUDIO", in cap-height units. */
type Glyph = { w: number; len: number; draw: (p: Path2D) => void };
const GLYPHS: Record<string, Glyph> = {
  G: {
    w: 1,
    len: 3.3,
    draw: (p) => {
      p.moveTo(0.5 + 0.5 * Math.cos(-Math.PI / 4), 0.5 + 0.5 * Math.sin(-Math.PI / 4));
      p.arc(0.5, 0.5, 0.5, -Math.PI / 4, 0, true);
      p.lineTo(0.56, 0.5);
    },
  },
  A: {
    w: 1,
    len: 2.8,
    draw: (p) => {
      p.moveTo(0, 1);
      p.lineTo(0.5, 0);
      p.lineTo(1, 1);
      p.moveTo(0.23, 0.62);
      p.lineTo(0.77, 0.62);
    },
  },
  M: {
    w: 0.96,
    len: 3.9,
    draw: (p) => {
      p.moveTo(0, 1);
      p.lineTo(0, 0);
      p.lineTo(0.48, 0.72);
      p.lineTo(0.96, 0);
      p.lineTo(0.96, 1);
    },
  },
  E: {
    w: 0.72,
    len: 3.2,
    draw: (p) => {
      p.moveTo(0.72, 0);
      p.lineTo(0, 0);
      p.lineTo(0, 1);
      p.lineTo(0.72, 1);
      p.moveTo(0, 0.5);
      p.lineTo(0.62, 0.5);
    },
  },
  S: {
    w: 0.78,
    len: 3.0,
    draw: (p) => {
      p.moveTo(0.74, 0.16);
      p.bezierCurveTo(0.64, 0.01, 0.07, -0.03, 0.07, 0.26);
      p.bezierCurveTo(0.07, 0.52, 0.78, 0.44, 0.78, 0.73);
      p.bezierCurveTo(0.78, 1.03, 0.14, 1.03, 0.02, 0.83);
    },
  },
  T: {
    w: 0.86,
    len: 1.9,
    draw: (p) => {
      p.moveTo(0, 0);
      p.lineTo(0.86, 0);
      p.moveTo(0.43, 0);
      p.lineTo(0.43, 1);
    },
  },
  U: {
    w: 0.86,
    len: 3.0,
    draw: (p) => {
      p.moveTo(0, 0);
      p.lineTo(0, 0.57);
      p.arc(0.43, 0.57, 0.43, Math.PI, 0, true);
      p.lineTo(0.86, 0);
    },
  },
  D: {
    w: 0.92,
    len: 3.9,
    draw: (p) => {
      p.moveTo(0, 0);
      p.lineTo(0, 1);
      p.lineTo(0.42, 1);
      p.arc(0.42, 0.5, 0.5, Math.PI / 2, -Math.PI / 2, true);
      p.lineTo(0, 0);
    },
  },
  I: {
    w: 0,
    len: 1,
    draw: (p) => {
      p.moveTo(0, 0);
      p.lineTo(0, 1);
    },
  },
  O: {
    w: 1,
    len: 3.2,
    draw: (p) => {
      p.moveTo(1, 0.5);
      p.arc(0.5, 0.5, 0.5, 0, Math.PI * 2);
    },
  },
};
const TAG = 'GAME STUDIO';
const TAG_Y0 = 612;
const TAG_CAP = 58;
const TAG_STROKE = 8.5;
const TAG_X0 = 385;
const TAG_X1 = 1476;

/** Full sting length (s). The portal overlaps the first ~0.6 s of the game logo. */
export const STING = 3.0;
export const STING_REDUCED = 1.7;
/** When the frame starts opening (skip jumps here). */
export const PORTAL_AT = 2.4;

function letterPath(i: number): Path2D {
  const p = new Path2D();
  for (const ring of LETTERS[i]!.rings) {
    ring.forEach(([x, y], k) => (k ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
  }
  return p;
}

interface TagGlyph {
  path: Path2D;
  x: number;
  len: number;
}

export class StudioSting {
  private readonly letters = LETTERS.map((_, i) => letterPath(i));
  private readonly allLetters = new Path2D();
  private readonly tag: TagGlyph[] = [];
  private shake = 0;
  private lastImpact = -1;

  constructor(private readonly reduced: boolean) {
    for (const p of this.letters) this.allLetters.addPath(p);
    // lay GAME STUDIO out across the artwork's span; the word space is 1.7× the tracking
    const chars = [...TAG];
    const inked = chars.reduce((a, ch) => a + (ch === ' ' ? 0 : GLYPHS[ch]!.w || 0.02), 0) * TAG_CAP;
    const track = (TAG_X1 - TAG_X0 - inked) / (chars.length - 1 + 0.7);
    let x = TAG_X0;
    for (const ch of chars) {
      if (ch === ' ') {
        x += track * 0.7;
        continue;
      }
      const g = GLYPHS[ch]!;
      const path = new Path2D();
      g.draw(path);
      this.tag.push({ path, x, len: g.len });
      x += (g.w || 0.02) * TAG_CAP + track;
    }
  }

  get duration(): number {
    return this.reduced ? STING_REDUCED : STING;
  }

  /** Time at which a skip should land (the portal opening). */
  get skipTo(): number {
    return this.reduced ? STING_REDUCED - 0.45 : PORTAL_AT;
  }

  /**
   * Draws the sting at time `t` (s). `scene` draws what comes next (the game logo); it's
   * called clipped to the opening frame during the portal (or full screen when reduced).
   */
  draw(c: CanvasRenderingContext2D, w: number, h: number, dpr: number, t: number, dt: number, grain: CanvasPattern | null, scene: () => void): void {
    if (this.reduced) {
      this.drawReduced(c, w, h, dpr, t, scene);
      return;
    }
    const S = Math.min((w * 0.74) / (BOUNDS.x1 - BOUNDS.x0), (h * 0.44) / (BOUNDS.y1 - BOUNDS.y0), 0.46);
    this.shake = Math.max(0, this.shake - dt * 5);
    const sh = this.shake * 5;
    const ox = w / 2 + (Math.random() - 0.5) * sh;
    const oy = h / 2 + (Math.random() - 0.5) * sh;
    const portal = seg(t, PORTAL_AT, STING);
    const open = easeInOutCubic(portal);
    // frame scale that makes the inner edge clear the whole screen
    const innerW = (FRAME.x1 - FRAME.x0 - FRAME.stroke) * S;
    const innerH = (FRAME.y1 - FRAME.y0 - FRAME.stroke) * S;
    const full = Math.max(w / innerW, h / innerH) * 1.25;
    const fScale = 1 + (full - 1) * open;
    const breathe = 1 + 0.015 * easeOutCubic(seg(t, 1.8, PORTAL_AT));

    // background with a faint red halo
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    const halo = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
    halo.addColorStop(0, `rgba(251,1,10,${(0.09 * seg(t, 0.3, 1.2) * (1 - portal)).toFixed(3)})`);
    halo.addColorStop(1, 'rgba(251,1,10,0)');
    c.fillStyle = halo;
    c.fillRect(0, 0, w, h);

    // the game logo behind the portal
    const fx0 = (FRAME.x0 + FRAME.stroke / 2 - CX) * S;
    const fy0 = (FRAME.y0 + FRAME.stroke / 2 - CY) * S;
    const fcx = ((FRAME.x0 + FRAME.x1) / 2 - CX) * S;
    const fcy = ((FRAME.y0 + FRAME.y1) / 2 - CY) * S;
    if (portal > 0) {
      c.save();
      c.beginPath();
      const k = fScale * breathe;
      c.rect(ox + fcx + (fx0 - fcx) * k, oy + fcy + (fy0 - fcy) * k, innerW * k, innerH * k);
      c.clip();
      scene();
      c.restore();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const L = (sx: number) => c.setTransform(dpr * sx, 0, 0, dpr * sx, dpr * ox, dpr * oy);

    // ── frame: two strokes from the top center meet at the bottom center
    const drawK = easeInOutCubic(seg(t, 0.12, 0.9));
    if (drawK > 0) {
      const k = S * fScale * breathe;
      c.setTransform(dpr * k, 0, 0, dpr * k, dpr * (ox + fcx - ((FRAME.x0 + FRAME.x1) / 2 - CX) * k), dpr * (oy + fcy - ((FRAME.y0 + FRAME.y1) / 2 - CY) * k));
      c.translate(-CX, -CY);
      const midX = (FRAME.x0 + FRAME.x1) / 2;
      const half = FRAME.x1 - FRAME.x0 + (FRAME.y1 - FRAME.y0);
      c.strokeStyle = STUDIO_RED;
      c.lineWidth = FRAME.stroke;
      c.lineJoin = 'miter';
      c.lineCap = 'butt';
      c.globalAlpha = 1 - seg(portal, 0.55, 1);
      for (const dir of [1, -1]) {
        const p = new Path2D();
        p.moveTo(midX, FRAME.y0);
        p.lineTo(dir > 0 ? FRAME.x1 : FRAME.x0, FRAME.y0);
        p.lineTo(dir > 0 ? FRAME.x1 : FRAME.x0, FRAME.y1);
        p.lineTo(midX, FRAME.y1);
        c.setLineDash([half * drawK, half * 2]);
        c.stroke(p);
      }
      c.setLineDash([]);
      // hot spark at the drawing heads
      if (drawK < 1) {
        const head = (dir: number): Pt => {
          let d = half * drawK;
          const top = (FRAME.x1 - FRAME.x0) / 2;
          if (d <= top) return [midX + dir * d, FRAME.y0];
          d -= top;
          if (d <= FRAME.y1 - FRAME.y0) return [dir > 0 ? FRAME.x1 : FRAME.x0, FRAME.y0 + d];
          d -= FRAME.y1 - FRAME.y0;
          return [(dir > 0 ? FRAME.x1 : FRAME.x0) - dir * d, FRAME.y1];
        };
        c.globalCompositeOperation = 'lighter';
        for (const dir of [1, -1]) {
          const [hx, hy] = head(dir);
          const g = c.createRadialGradient(hx, hy, 0, hx, hy, 80);
          g.addColorStop(0, 'rgba(255,220,200,0.95)');
          g.addColorStop(0.35, 'rgba(251,40,20,0.6)');
          g.addColorStop(1, 'rgba(251,1,10,0)');
          c.fillStyle = g;
          c.fillRect(hx - 80, hy - 80, 160, 160);
        }
        c.globalCompositeOperation = 'source-over';
      }
      c.globalAlpha = 1;
    }

    // ── letters stamp in, then fly through the portal
    const flyK = easeInCubic(portal);
    const lettersScale = S * breathe * (1 + flyK * 2.6);
    const lettersAlpha = 1 - seg(portal, 0.15, 0.7);
    for (let i = 0; i < this.letters.length; i++) {
      const t0 = 0.62 + i * 0.085;
      const k = seg(t, t0, t0 + 0.34);
      if (k <= 0) continue;
      if (k > 0.3 && this.lastImpact < i) {
        this.lastImpact = i;
        this.shake = Math.min(1, this.shake + 0.45);
      }
      const box = LETTERS[i]!.box;
      const lcx = (box[0] + box[2]) / 2;
      const lcy = (box[1] + box[3]) / 2;
      const e = easeOutExpo(k);
      const sc = 1.55 - 0.55 * e;
      const a = clamp01(k * 2.6) * lettersAlpha;
      const path = this.letters[i]!;
      L(lettersScale);
      c.translate(lcx - CX, lcy - CY);
      c.scale(sc, sc);
      c.translate(-lcx, -lcy);
      // short vertical smear while it slams down
      if (k < 0.5) {
        c.globalAlpha = a * 0.3 * (1 - k * 2);
        c.fillStyle = STUDIO_RED;
        c.translate(0, -40 * (1 - e));
        c.fill(path, 'evenodd');
        c.translate(0, 40 * (1 - e));
      }
      c.globalAlpha = a;
      // a white-hot flash as it lands, cooling to the brand red
      c.fillStyle = k < 0.45 ? mixHot(1 - k / 0.45) : STUDIO_RED;
      c.fill(path, 'evenodd');
    }
    c.globalAlpha = 1;

    // ── light sweep across the settled letters
    const sw = seg(t, 1.32, 1.86);
    if (sw > 0 && sw < 1 && lettersAlpha > 0) {
      L(lettersScale);
      c.translate(-CX, -CY);
      c.save();
      c.clip(this.allLetters, 'evenodd');
      const bx = 150 + (1750 - 150) * easeInOutCubic(sw);
      const g = c.createLinearGradient(bx - 160, 200, bx + 60, 560);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.45, 'rgba(255,120,110,0.35)');
      g.addColorStop(0.55, 'rgba(255,235,230,0.95)');
      g.addColorStop(0.62, 'rgba(255,90,80,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(100, 200, 1700, 360);
      c.restore();
      // glint riding the top edge
      c.globalCompositeOperation = 'lighter';
      const gx = bx - 40;
      const gg = c.createRadialGradient(gx, 272, 0, gx, 272, 90);
      gg.addColorStop(0, 'rgba(255,230,220,0.8)');
      gg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gg;
      c.fillRect(gx - 90, 182, 180, 180);
      c.globalCompositeOperation = 'source-over';
    }

    // ── GAME STUDIO writes on, tracking opening up
    const tagIn = seg(t, 1.2, 2.0);
    const tagA = (1 - seg(portal, 0, 0.35)) * clamp01(tagIn * 3);
    if (tagIn > 0 && tagA > 0) {
      const spread = 0.82 + 0.18 * easeOutExpo(tagIn);
      const tagCx = (TAG_X0 + TAG_X1) / 2;
      c.lineWidth = TAG_STROKE / TAG_CAP;
      c.lineCap = 'butt';
      c.lineJoin = 'miter';
      c.strokeStyle = WHITE;
      c.globalAlpha = tagA;
      this.tag.forEach((g, i) => {
        const k = easeOutCubic(seg(t, 1.2 + i * 0.045, 1.2 + i * 0.045 + 0.42));
        if (k <= 0) return;
        const gx = tagCx + (g.x - tagCx) * spread;
        L(S * breathe);
        c.translate(gx - CX, TAG_Y0 - CY);
        c.scale(TAG_CAP, TAG_CAP);
        c.setLineDash([g.len * k, g.len + 1]);
        c.stroke(g.path);
      });
      c.setLineDash([]);
      c.globalAlpha = 1;
    }

    // film grain + vignette
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (grain) {
      c.globalAlpha = 0.06;
      c.globalCompositeOperation = 'overlay';
      c.save();
      c.translate(-Math.random() * 128, -Math.random() * 128);
      c.fillStyle = grain;
      c.fillRect(0, 0, w + 128, h + 128);
      c.restore();
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
    }
    const vig = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(0,0,0,${(0.55 * (1 - portal)).toFixed(3)})`);
    c.fillStyle = vig;
    c.fillRect(0, 0, w, h);
    // a quick pop exactly as the portal breaks open
    const pop = Math.max(0, 1 - Math.abs(t - (PORTAL_AT + 0.08)) / 0.1) * 0.18;
    if (pop > 0) {
      c.fillStyle = `rgba(255,255,255,${pop.toFixed(3)})`;
      c.fillRect(0, 0, w, h);
    }
  }

  /** prefers-reduced-motion: the whole mark fades in, holds and cross-fades to the game logo. */
  private drawReduced(c: CanvasRenderingContext2D, w: number, h: number, dpr: number, t: number, scene: () => void): void {
    const S = Math.min((w * 0.74) / (BOUNDS.x1 - BOUNDS.x0), (h * 0.44) / (BOUNDS.y1 - BOUNDS.y0), 0.46);
    const out = seg(t, STING_REDUCED - 0.45, STING_REDUCED);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalAlpha = 1;
    if (out > 0) scene();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalAlpha = 1 - out;
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    c.globalAlpha = seg(t, 0.05, 0.45) * (1 - out);
    c.setTransform(dpr * S, 0, 0, dpr * S, (dpr * w) / 2, (dpr * h) / 2);
    c.translate(-CX, -CY);
    c.strokeStyle = STUDIO_RED;
    c.lineWidth = FRAME.stroke;
    c.strokeRect(FRAME.x0, FRAME.y0, FRAME.x1 - FRAME.x0, FRAME.y1 - FRAME.y0);
    c.fillStyle = STUDIO_RED;
    c.fill(this.allLetters, 'evenodd');
    c.strokeStyle = WHITE;
    for (const g of this.tag) {
      c.save();
      c.translate(g.x, TAG_Y0);
      c.scale(TAG_CAP, TAG_CAP);
      c.lineWidth = TAG_STROKE / TAG_CAP;
      c.stroke(g.path);
      c.restore();
    }
    c.globalAlpha = 1;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

/** White-hot → brand red. `k` = 1 is white, 0 is red. */
function mixHot(k: number): string {
  const e = k * k;
  const g = Math.round(1 + 229 * e);
  const b = Math.round(10 + 215 * e);
  return `rgb(${Math.round(251 + 4 * e)},${g},${b})`;
}
