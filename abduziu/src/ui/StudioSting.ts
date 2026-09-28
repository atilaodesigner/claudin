/**
 * GUETO GAME STUDIO sting (canvas 2D), played before the ABDUZIU boot motion.
 *
 * The logo is vectorized from the studio artwork (1846×852 reference): a white frame,
 * chamfered block letters and a wide-tracked geometric "GAME STUDIO" line. All
 * coordinates below are in that reference space.
 *
 * Beats: frame draws itself → letters stamp in → light sweep → GAME STUDIO writes on →
 * the frame opens like a portal into the game's own loading scene.
 */

type Pt = readonly [number, number];

const C = 22; // chamfer
/** Letter outlines. G's counter opens through the slit on its right, so it's one polygon. */
const LETTERS: ReadonlyArray<{ box: readonly [number, number, number, number]; rings: ReadonlyArray<ReadonlyArray<Pt>> }> = [
  {
    box: [267, 266, 523, 496],
    rings: [
      [
        [267 + C, 266], [523 - C, 266], [523, 266 + C], [523, 322], [335, 322], [335, 440], [453, 440], [453, 416], [400, 416],
        [400, 374], [523, 374], [523, 496 - C], [523 - C, 496], [267 + C, 496], [267, 496 - C], [267, 266 + C],
      ],
    ],
  },
  {
    box: [545, 266, 765, 496],
    rings: [[[545, 266 + C], [545 + C, 266], [613, 266], [613, 440], [697, 440], [697, 266], [765 - C, 266], [765, 266 + C], [765, 496 - C], [765 - C, 496], [545 + C, 496], [545, 496 - C]]],
  },
  {
    box: [810, 266, 1045, 496],
    rings: [[[810 + C, 266], [1045, 266], [1045, 322], [877, 322], [877, 356], [1025, 356], [1025, 414], [877, 414], [877, 440], [1045, 440], [1045, 496], [810 + C, 496], [810, 496 - C], [810, 266 + C]]],
  },
  {
    box: [1063, 266, 1302, 496],
    rings: [[[1063 + C, 266], [1302 - C, 266], [1302, 266 + C], [1302, 322], [1216, 322], [1216, 496 - C], [1216 - C, 496], [1148 + C, 496], [1148, 496 - C], [1148, 322], [1063, 322], [1063, 266 + C]]],
  },
  {
    box: [1322, 266, 1578, 496],
    rings: [
      [[1322 + C, 266], [1578 - C, 266], [1578, 266 + C], [1578, 496 - C], [1578 - C, 496], [1322 + C, 496], [1322, 496 - C], [1322, 266 + C]],
      [[1388, 322], [1512, 322], [1512, 440], [1388, 440]],
    ],
  },
];

/** Frame stroke (centered on the artwork's 28px border). */
const FRAME = { x0: 213, y0: 212, x1: 1632, y1: 546, stroke: 28 };
/** Logo bounds (frame + GAME STUDIO) and its center. */
const BOUNDS = { x0: 199, y0: 198, x1: 1646, y1: 665 };
const CX = (BOUNDS.x0 + BOUNDS.x1) / 2;
const CY = (BOUNDS.y0 + BOUNDS.y1) / 2;

/** Monoline geometric glyphs for "GAME STUDIO", in cap-height units. */
type Glyph = { w: number; draw: (p: Path2D) => void };
const GLYPHS: Record<string, Glyph> = {
  G: {
    w: 1,
    draw: (p) => {
      p.moveTo(0.5 + 0.5 * Math.cos(-Math.PI / 4), 0.5 + 0.5 * Math.sin(-Math.PI / 4));
      p.arc(0.5, 0.5, 0.5, -Math.PI / 4, 0, true);
      p.lineTo(0.56, 0.5);
    },
  },
  A: {
    w: 1,
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
    draw: (p) => {
      p.moveTo(0.74, 0.16);
      p.bezierCurveTo(0.64, 0.01, 0.07, -0.03, 0.07, 0.26);
      p.bezierCurveTo(0.07, 0.52, 0.78, 0.44, 0.78, 0.73);
      p.bezierCurveTo(0.78, 1.03, 0.14, 1.03, 0.02, 0.83);
    },
  },
  T: {
    w: 0.86,
    draw: (p) => {
      p.moveTo(0, 0);
      p.lineTo(0.86, 0);
      p.moveTo(0.43, 0);
      p.lineTo(0.43, 1);
    },
  },
  U: {
    w: 0.86,
    draw: (p) => {
      p.moveTo(0, 0);
      p.lineTo(0, 0.57);
      p.arc(0.43, 0.57, 0.43, Math.PI, 0, true);
      p.lineTo(0.86, 0);
    },
  },
  D: {
    w: 0.92,
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
    draw: (p) => {
      p.moveTo(0, 0);
      p.lineTo(0, 1);
    },
  },
  O: {
    w: 1,
    draw: (p) => {
      p.moveTo(1, 0.5);
      p.arc(0.5, 0.5, 0.5, 0, Math.PI * 2);
    },
  },
};
const TAG = 'GAME STUDIO';
const TAG_Y0 = 610;
const TAG_CAP = 55;
const TAG_X0 = 378;
const TAG_X1 = 1475;
/** Rough stroke length per glyph (for the write-on dash), in cap units. */
const GLYPH_LEN: Record<string, number> = { G: 3.3, A: 2.8, M: 3.9, E: 3.2, S: 3.0, T: 1.9, U: 3.0, D: 3.9, I: 1, O: 3.2 };

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number) => t * t * t;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

/** Full sting length (s). The portal overlaps the first ~0.6 s of the game scene. */
export const STING = 3.0;
export const STING_REDUCED = 1.7;
/** When the frame starts opening (skip jumps here). */
export const PORTAL_AT = 2.4;

function letterPath(i: number): Path2D {
  const p = new Path2D();
  for (const ring of (LETTERS[i] as (typeof LETTERS)[number]).rings) {
    ring.forEach(([x, y], k) => (k ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
  }
  return p;
}

interface TagGlyph {
  path: Path2D;
  x: number;
  w: number;
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
    // lay GAME STUDIO out across the artwork's span, word space = 1.7× tracking
    const chars = [...TAG];
    const inked = chars.reduce((a, ch) => a + (ch === ' ' ? 0 : ((GLYPHS[ch] as Glyph).w || 0.02)), 0) * TAG_CAP;
    const gaps = chars.length - 1 + 0.7;
    const track = (TAG_X1 - TAG_X0 - inked) / gaps;
    let x = TAG_X0;
    for (const ch of chars) {
      if (ch === ' ') {
        x += track * 0.7;
        continue;
      }
      const g = GLYPHS[ch] as Glyph;
      const path = new Path2D();
      g.draw(path);
      this.tag.push({ path, x, w: g.w * TAG_CAP, len: GLYPH_LEN[ch] ?? 3 });
      x += (g.w || 0.02) * TAG_CAP + track;
    }
  }

  get duration(): number {
    return this.reduced ? STING_REDUCED : STING;
  }

  /**
   * Draws the sting at time `t` (s). `scene` draws the game's loading scene; it's
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

    // background
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    const halo = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
    halo.addColorStop(0, `rgba(255,255,255,${(0.05 * seg(t, 0.3, 1.2) * (1 - portal)).toFixed(3)})`);
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = halo;
    c.fillRect(0, 0, w, h);

    // the game behind the portal
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

    // logo space
    const L = (sx: number, cxo = 0, cyo = 0) => c.setTransform(dpr * sx, 0, 0, dpr * sx, dpr * (ox + cxo), dpr * (oy + cyo));

    // ── frame: two strokes from the top center meet at the bottom center
    const draw = easeInOutCubic(seg(t, 0.12, 0.9));
    if (draw > 0) {
      const k = S * fScale * breathe;
      c.setTransform(dpr * k, 0, 0, dpr * k, dpr * (ox + fcx - ((FRAME.x0 + FRAME.x1) / 2 - CX) * k), dpr * (oy + fcy - ((FRAME.y0 + FRAME.y1) / 2 - CY) * k));
      c.translate(-CX, -CY);
      const midX = (FRAME.x0 + FRAME.x1) / 2;
      const half = FRAME.x1 - FRAME.x0 + (FRAME.y1 - FRAME.y0);
      c.strokeStyle = '#fff';
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
        c.setLineDash([half * draw, half * 2]);
        c.stroke(p);
      }
      c.setLineDash([]);
      // spark at the drawing heads
      if (draw < 1) {
        const head = (dir: number): Pt => {
          let d = half * draw;
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
          const g = c.createRadialGradient(hx, hy, 0, hx, hy, 70);
          g.addColorStop(0, 'rgba(255,255,255,0.9)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = g;
          c.fillRect(hx - 70, hy - 70, 140, 140);
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
      const box = (LETTERS[i] as (typeof LETTERS)[number]).box;
      const lcx = (box[0] + box[2]) / 2;
      const lcy = (box[1] + box[3]) / 2;
      const e = easeOutExpo(k);
      const sc = 1.55 - 0.55 * e;
      const a = clamp01(k * 2.6) * lettersAlpha;
      L(lettersScale);
      c.translate(lcx - CX, lcy - CY);
      c.scale(sc, sc);
      c.translate(-lcx, -lcy);
      // short vertical smear while it slams down
      if (k < 0.5) {
        c.globalAlpha = a * 0.25 * (1 - k * 2);
        c.fillStyle = '#fff';
        c.translate(0, -40 * (1 - e));
        c.fill(this.letters[i] as Path2D, 'evenodd');
        c.translate(0, 40 * (1 - e));
      }
      c.globalAlpha = a;
      c.fillStyle = '#f2f4f5';
      c.fill(this.letters[i] as Path2D, 'evenodd');
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
      g.addColorStop(0.45, 'rgba(140,150,160,0.35)');
      g.addColorStop(0.55, 'rgba(255,255,255,1)');
      g.addColorStop(0.62, 'rgba(120,130,140,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(100, 200, 1700, 360);
      c.restore();
      // glint riding the top edge
      c.globalCompositeOperation = 'lighter';
      const gx = bx - 40;
      const gg = c.createRadialGradient(gx, 268, 0, gx, 268, 90);
      gg.addColorStop(0, 'rgba(255,255,255,0.8)');
      gg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gg;
      c.fillRect(gx - 90, 178, 180, 180);
      c.globalCompositeOperation = 'source-over';
    }

    // ── GAME STUDIO writes on, tracking opening up
    const tagIn = seg(t, 1.2, 2.0);
    const tagA = (1 - seg(portal, 0, 0.35)) * clamp01(tagIn * 3);
    if (tagIn > 0 && tagA > 0) {
      const spread = 0.82 + 0.18 * easeOutExpo(tagIn);
      const tagCx = (TAG_X0 + TAG_X1) / 2;
      c.lineWidth = 7.2 / TAG_CAP;
      c.lineCap = 'butt';
      c.lineJoin = 'miter';
      c.strokeStyle = '#f2f4f5';
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
    // a quick white pop exactly as the portal breaks open
    const pop = Math.max(0, 1 - Math.abs(t - (PORTAL_AT + 0.08)) / 0.1) * 0.18;
    if (pop > 0) {
      c.fillStyle = `rgba(255,255,255,${pop.toFixed(3)})`;
      c.fillRect(0, 0, w, h);
    }
  }

  /** prefers-reduced-motion: the whole logo fades in, holds and cross-fades to the game. */
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
    c.strokeStyle = '#fff';
    c.lineWidth = FRAME.stroke;
    c.strokeRect(FRAME.x0, FRAME.y0, FRAME.x1 - FRAME.x0, FRAME.y1 - FRAME.y0);
    c.fillStyle = '#f2f4f5';
    c.fill(this.allLetters, 'evenodd');
    c.strokeStyle = '#f2f4f5';
    for (const g of this.tag) {
      c.save();
      c.translate(g.x, TAG_Y0);
      c.scale(TAG_CAP, TAG_CAP);
      c.lineWidth = 7.2 / TAG_CAP;
      c.stroke(g.path);
      c.restore();
    }
    c.globalAlpha = 1;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}
