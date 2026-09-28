/**
 * Boot sequence: GUETO GAME STUDIO sting → GINGA ARENA logo (through the sting's portal)
 * → the logo idles as the title screen.
 *
 * Any key, click or tap skips ahead: during the sting it jumps to the portal, during the
 * logo it jumps to the settled mark. `onTitle` fires once the logo has settled.
 */

import { GameLogo, LOGO_IN } from './GameLogo';
import { PORTAL_AT, StudioSting } from './StudioSting';

export interface IntroOptions {
  /** Start straight on the settled logo (e.g. `?intro=0`). */
  skipStudio?: boolean;
  onTitle: () => void;
}

export class IntroSequence {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly sting = new StudioSting(this.reduced);
  private readonly logo = new GameLogo(this.reduced);
  private readonly grain: CanvasPattern | null;
  /** When the logo's clock starts, on the sequence clock. */
  private readonly logoAt: number;
  private t = 0;
  private last = 0;
  private titled = false;
  private raf = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly opts: IntroOptions) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D indisponível');
    this.ctx = ctx;
    this.grain = makeGrain(ctx);
    this.logoAt = this.reduced ? this.sting.duration - 0.45 : PORTAL_AT;
    if (opts.skipStudio) this.t = this.logoAt + LOGO_IN;
    this.resize();
    addEventListener('resize', this.resize);
    addEventListener('keydown', this.skip);
    canvas.addEventListener('pointerdown', this.skip);
  }

  start(): void {
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this.resize);
    removeEventListener('keydown', this.skip);
    this.canvas.removeEventListener('pointerdown', this.skip);
  }

  private readonly resize = (): void => {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = innerWidth;
    this.h = innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  };

  private readonly skip = (): void => {
    if (this.t < this.sting.skipTo) this.t = this.sting.skipTo;
    else if (this.t < this.logoAt + LOGO_IN) this.t = this.logoAt + LOGO_IN;
  };

  private readonly frame = (now: number): void => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    const { ctx: c, w, h, dpr, t } = this;
    const logoT = t - this.logoAt;
    if (t < this.sting.duration) {
      this.sting.draw(c, w, h, dpr, t, dt, this.grain, () => this.logo.draw(c, w, h, dpr, logoT));
    } else {
      this.logo.draw(c, w, h, dpr, logoT);
    }
    if (!this.titled && logoT >= LOGO_IN) {
      this.titled = true;
      this.opts.onTitle();
    }
    this.raf = requestAnimationFrame(this.frame);
  };
}

function makeGrain(c: CanvasRenderingContext2D): CanvasPattern | null {
  const g = document.createElement('canvas');
  g.width = g.height = 128;
  const gc = g.getContext('2d');
  if (!gc) return null;
  const img = gc.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  gc.putImageData(img, 0, 0);
  return c.createPattern(g, 'repeat');
}
