/**
 * GINGA ARENA logo (canvas 2D, all white), revealed through the studio sting's portal.
 *
 * Mark: slanted chamfered block letters "GINGA", a ball juggled over the I (with its
 * speed trail) and "ARENA" tracked wide between two lines, like a net over the sand.
 * Coordinates are in logo units: cap height of GINGA = 100, logo centered on (0, 0).
 *
 * Beats: ball flies in on an arc → letters kick up with a sway (the ginga) → the ball
 * taps the I twice, altinha style → ARENA and the lines open up → the whole logo sways
 * once and settles → idle bob while the title screen waits.
 */

import { clamp01, easeInOutCubic, easeOutBack, easeOutCubic, seg } from './ease';

type Pt = readonly [number, number];
type Ring = ReadonlyArray<Pt>;

const WHITE = '#ffffff';
const K = 14; // chamfer
const T = 28; // stem

/** Letter outlines in a 0..w × 0..100 box (evenodd, holes as extra rings). */
const DEFS: Record<string, { w: number; rings: ReadonlyArray<Ring> }> = {
  G: {
    w: 92,
    rings: [
      [
        [K, 0], [92 - K, 0], [92, K], [92, 28], [T, 28], [T, 72], [92 - T, 72], [92 - T, 62], [50, 62], [50, 40], [92, 40],
        [92, 100 - K], [92 - K, 100], [K, 100], [0, 100 - K], [0, K],
      ],
    ],
  },
  I: { w: T, rings: [[[0, 0], [T, 0], [T, 100], [0, 100]]] },
  N: {
    w: 88,
    rings: [[[0, 100], [0, K], [K, 0], [T, 0], [60, 52], [60, 0], [88, 0], [88, 100 - K], [88 - K, 100], [60, 100], [T, 48], [T, 100]]],
  },
  A: {
    w: 92,
    rings: [
      [[0, 100], [0, 24], [24, 0], [68, 0], [92, 24], [92, 100], [64, 100], [64, 74], [T, 74], [T, 100]],
      [[T, 28], [64, 28], [64, 50], [T, 50]],
    ],
  },
  R: {
    w: 86,
    rings: [
      [[0, 0], [72, 0], [86, 14], [86, 50], [78, 58], [86, 66], [86, 100], [58, 100], [58, 74], [T, 74], [T, 100], [0, 100]],
      [[T, 26], [58, 26], [58, 48], [T, 48]],
    ],
  },
  E: {
    w: 78,
    rings: [[[K, 0], [78, 0], [78, 26], [T, 26], [T, 38], [68, 38], [68, 62], [T, 62], [T, 74], [78, 74], [78, 100], [K, 100], [0, 100 - K], [0, K]]],
  },
};

const ITALIC = 0.2; // x shift per unit of height above the baseline
const GAP = 14;
const TOP = -70; // GINGA cap top (logo units)
const WORD = 'GINGA';
const SUB = 'ARENA';
const SUB_CAP = 26;
const SUB_Y = 50; // ARENA cap top
const SUB_TRACK = 16; // extra space between ARENA letters, in logo units
const BALL_R = 15;

/** Full intro length (s); after this the logo idles. */
export const LOGO_IN = 2.8;

interface Letter {
  path: Path2D;
  x: number; // left edge at the baseline (logo units)
  w: number;
}

function ringsPath(rings: ReadonlyArray<Ring>, skew: number): Path2D {
  const p = new Path2D();
  for (const ring of rings) {
    ring.forEach(([x, y], k) => {
      const sx = x + skew * (100 - y);
      if (k) p.lineTo(sx, y);
      else p.moveTo(sx, y);
    });
    p.closePath();
  }
  return p;
}

function layout(word: string, skew: number, gap: number): { letters: Letter[]; width: number } {
  const letters: Letter[] = [];
  let x = 0;
  for (const ch of word) {
    const d = DEFS[ch]!;
    letters.push({ path: ringsPath(d.rings, skew), x, w: d.w });
    x += d.w + gap;
  }
  return { letters, width: x - gap };
}

export class GameLogo {
  private readonly word = layout(WORD, ITALIC, GAP);
  private readonly sub = layout(SUB, 0, 0);
  private readonly wordX0: number;
  /** Where the ball rests: over the top of the I. */
  private readonly ball: Pt;

  constructor(private readonly reduced: boolean) {
    this.wordX0 = -(this.word.width + ITALIC * 100) / 2;
    const i = this.word.letters[1]!;
    this.ball = [this.wordX0 + i.x + i.w / 2 + ITALIC * 100, TOP - 12 - BALL_R];
  }

  /** Draws the logo at time `t` (s since it started; may run past LOGO_IN for the idle). */
  draw(c: CanvasRenderingContext2D, w: number, h: number, dpr: number, t: number): void {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    if (t < 0) return;

    const S = Math.min((w * 0.8) / 540, (h * 0.5) / 230);
    const ox = w / 2;
    const oy = h * 0.46;
    const tt = this.reduced ? LOGO_IN + t : t; // reduced motion: straight to the settled logo
    const fade = this.reduced ? seg(t, 0, 0.5) : 1;

    // soft light behind the mark
    const glow = c.createRadialGradient(ox, oy, 0, ox, oy, 340 * S);
    glow.addColorStop(0, `rgba(255,255,255,${(0.07 * seg(tt, 0.4, 1.4) * fade).toFixed(3)})`);
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, w, h);

    // the one "ginga" sway of the whole mark, after everything has landed
    const swayK = seg(tt, 1.7, 2.7);
    const sway = swayK > 0 && swayK < 1 ? 0.07 * Math.sin(swayK * Math.PI * 2) * (1 - swayK) : 0;
    const base = (): void => {
      c.setTransform(dpr * S, 0, 0, dpr * S, dpr * ox, dpr * oy);
      c.transform(1, 0, -sway, 1, sway * 30, 0); // skew around the baseline (y = 30)
    };

    c.fillStyle = WHITE;
    c.strokeStyle = WHITE;
    c.shadowColor = 'rgba(255,255,255,0.35)';
    c.shadowBlur = 14 * S * dpr;

    // ── GINGA: letters kick up from the sand with a decaying swing
    const delays = [0.18, 0.12, 0.26, 0.34, 0.42];
    const taps = this.tapSquash(tt);
    this.word.letters.forEach((L, i) => {
      const k = seg(tt, delays[i]!, delays[i]! + 0.46);
      if (k <= 0) return;
      const rise = easeOutBack(k);
      const sgn = i % 2 ? -1 : 1;
      const rot = sgn * 0.34 * Math.exp(-5 * k) * Math.cos(9 * k);
      const squash = i === 1 ? taps : 0;
      const pivotX = this.wordX0 + L.x + L.w / 2;
      base();
      c.translate(pivotX, TOP + 100 + (1 - rise) * 80);
      c.rotate(rot);
      c.scale(1 + squash * 0.5, 1 - squash);
      c.translate(-pivotX, -(TOP + 100));
      c.translate(this.wordX0 + L.x, TOP);
      c.globalAlpha = clamp01(k * 4) * fade;
      c.fill(L.path, 'evenodd');
    });

    // ── ARENA between two lines
    const subK = easeOutCubic(seg(tt, 1.05, 1.65));
    if (subK > 0) {
      const sc = SUB_CAP / 100;
      const track = SUB_TRACK + (1 - subK) * 40;
      const subW = this.sub.width * sc + track * (SUB.length - 1);
      base();
      c.globalAlpha = subK * fade;
      let x = -subW / 2;
      for (const L of this.sub.letters) {
        c.save();
        c.translate(x, SUB_Y);
        c.scale(sc, sc);
        c.fill(L.path, 'evenodd');
        c.restore();
        x += L.w * sc + track;
      }
      // lines grow outward from the word to the width of GINGA
      const lineK = easeInOutCubic(seg(tt, 1.12, 1.7));
      const inner = subW / 2 + 16;
      const outer = inner + (-this.wordX0 - 10 - inner) * lineK;
      const y = SUB_Y + SUB_CAP / 2;
      c.globalAlpha = fade;
      c.fillRect(inner, y - 2.5, outer - inner, 5);
      c.fillRect(-outer, y - 2.5, outer - inner, 5);
    }

    // ── the ball: arc in, two taps on the I, then a gentle idle bob
    const bp = this.ballPos(tt);
    if (bp) {
      base();
      const [bx, by, spin] = bp;
      // speed trail back along the arrival arc (up-left): fades in while flying, stays as part of the mark
      const trailA = seg(tt, 0.3, 0.7) * fade;
      c.globalAlpha = trailA;
      const trail: ReadonlyArray<readonly [number, number, number]> = [
        [-26, -20, 5.5],
        [-46, -40, 4],
        [-62, -62, 2.8],
      ];
      for (const [dx, dy, r] of trail) {
        c.beginPath();
        c.arc(this.ball[0] + dx, this.ball[1] + dy, r, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = fade;
      this.drawBall(c, bx, by, spin);
    }

    c.shadowBlur = 0;
    c.shadowColor = 'transparent';
    c.globalAlpha = 1;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Ball center (logo units) and spin angle at time `t`, or null before it enters. */
  private ballPos(t: number): readonly [number, number, number] | null {
    const [ex, ey] = this.ball;
    const ARRIVE = 0.62;
    if (t < 0.02) return null;
    if (t < ARRIVE) {
      // quadratic arc from low left, coming down onto the I at the end
      const u = easeOutCubic(seg(t, 0.02, ARRIVE));
      const p0: Pt = [ex - 420, ey + 250];
      const p1: Pt = [ex - 120, ey - 230];
      const x = (1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * ex;
      const y = (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * ey;
      return [x, y, -u * 9];
    }
    // two juggles on the I (altinha), then idle
    const j1 = seg(t, ARRIVE, ARRIVE + 0.44);
    const j2 = seg(t, ARRIVE + 0.44, ARRIVE + 0.72);
    const j3 = seg(t, 1.85, 2.2); // one more tap during the sway
    let up = 0;
    if (j1 < 1) up = 46 * Math.sin(Math.PI * j1);
    else if (j2 < 1) up = 14 * Math.sin(Math.PI * j2);
    else if (j3 > 0 && j3 < 1) up = 22 * Math.sin(Math.PI * j3);
    else if (t > LOGO_IN) up = 3.5 * Math.sin((t - LOGO_IN) * 3.9);
    const spin = -9 - 4 * seg(t, ARRIVE, ARRIVE + 0.72) - 3 * j3 + (t > LOGO_IN ? (t - LOGO_IN) * 0.6 : 0);
    return [ex, ey - up, spin];
  }

  /** How squashed the I is by the ball's taps (0..~0.12). */
  private tapSquash(t: number): number {
    const hit = (at: number, amt: number) => {
      const k = (t - at) / 0.16;
      return k < 0 || k > 1 ? 0 : amt * Math.sin(Math.PI * k);
    };
    return hit(0.6, 0.12) + hit(1.04, 0.06) + hit(1.83, 0.07) + hit(2.18, 0.07);
  }

  private drawBall(c: CanvasRenderingContext2D, x: number, y: number, spin: number): void {
    c.beginPath();
    c.arc(x, y, BALL_R, 0, Math.PI * 2);
    c.fill();
    // seams cut out in black, rotating with the spin
    const shadow = c.shadowBlur;
    c.shadowBlur = 0;
    c.save();
    c.beginPath();
    c.arc(x, y, BALL_R - 0.5, 0, Math.PI * 2);
    c.clip();
    c.translate(x, y);
    c.rotate(spin);
    c.strokeStyle = '#000';
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(-BALL_R, -3);
    c.bezierCurveTo(-5, -12, 5, 8, BALL_R, -1);
    c.moveTo(-4, -BALL_R);
    c.bezierCurveTo(-11, -4, 1, 6, -6, BALL_R);
    c.moveTo(6, -BALL_R);
    c.bezierCurveTo(12, -6, 14, 2, BALL_R, 6);
    c.stroke();
    c.restore();
    c.strokeStyle = WHITE;
    c.shadowBlur = shadow;
  }
}
