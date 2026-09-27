import { h, Screen } from './dom';
import { PORTAL_AT, StudioSting } from './StudioSting';

/**
 * ABDUZIU boot motion (canvas 2D, no dependencies).
 *
 * Opens with the GUETO GAME STUDIO sting (StudioSting.ts), whose frame becomes a
 * portal into this scene. Scene time starts at 0 when the sting ends; loading keeps
 * running underneath the whole time. Tap or any key skips straight to the portal.
 *
 * A saucer flies in and parks over the title; its tractor beam pulls each letter of
 * ABDUZIU up from the city skyline as the real loading progresses. When everything is
 * ready the beam flares, the saucer leaves and the overlay dissolves into the menu.
 */

const WORD = 'ABDUZIU';
const MESSAGES = ['INTERCEPTANDO SINAL', 'CALIBRANDO FEIXE TRATOR', 'RASTREANDO VIDA TERRESTRE', 'MAPEANDO CAIXAS D\'ÁGUA', 'CONTANDO VIRA-LATAS', 'IGNORANDO O ESPAÇO AÉREO', 'SINTONIZANDO RÁDIO LOCAL'];
const COORDS = ['RECIFE  -8.05  -34.90', 'SALVADOR  -12.97  -38.50', 'RIO  -22.90  -43.20', 'MANAUS  -3.10  -60.02', 'SÃO PAULO  -23.55  -46.63', 'BRASÍLIA  -15.78  -47.93'];
const TITLE_FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';
const HUD_FONT = '"Chakra Petch", "Barlow Condensed", monospace';
/** The intro never feels rushed, even on a fast machine. */
const MIN_INTRO = 2.6;
const OUTRO = 1.05;

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeOutBack = (t: number) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
const easeInCubic = (t: number) => t * t * t;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

interface Star {
  x: number;
  y: number;
  z: number;
  tw: number;
}

interface Building {
  x: number;
  w: number;
  h: number;
  tank: boolean;
  palm: boolean;
  lit: number[];
}

interface Mote {
  x: number;
  y: number;
  vy: number;
  life: number;
  size: number;
}

export class LoadingScreen extends Screen {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly grain: HTMLCanvasElement;
  private readonly grainPattern: CanvasPattern | null;
  private readonly sting: StudioSting;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private raf = 0;
  private startAt = 0;
  private last = 0;
  private target = 0;
  private shown = 0;
  private label = MESSAGES[0] as string;
  private labelAt = 0;
  private msgIndex = 0;
  private stars: Star[] = [];
  private city: Building[] = [];
  private motes: Mote[] = [];
  private landed: number[] = WORD.split('').map(() => -1);
  private shake = 0;
  private flash = 0;
  private outroAt = -1;
  private done: (() => void) | null = null;
  private readonly reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly onResize = () => this.resize();
  private readonly onSkip = () => this.skipSting();

  constructor(parent: HTMLElement) {
    super(parent, 'loading');
    this.canvas = h('canvas', 'boot');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.root.appendChild(this.canvas);
    // accessible fallback text for screen readers
    const sr = h('div', 'sr-only', 'Gueto Game Studio apresenta ABDUZIU — carregando');
    sr.setAttribute('role', 'status');
    this.root.appendChild(sr);
    this.grain = document.createElement('canvas');
    this.grain.width = this.grain.height = 128;
    const g = this.grain.getContext('2d') as CanvasRenderingContext2D;
    const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this.grainPattern = this.ctx.createPattern(this.grain, 'repeat');
    this.sting = new StudioSting(this.reduced);
  }

  start(): void {
    this.show();
    this.root.classList.add('visible');
    this.resize();
    window.addEventListener('resize', this.onResize);
    this.root.addEventListener('pointerdown', this.onSkip);
    window.addEventListener('keydown', this.onSkip);
    try {
      void document.fonts?.load(`italic 900 80px ${TITLE_FONT}`);
      void document.fonts?.load(`500 14px ${HUD_FONT}`);
    } catch {
      /* fonts API missing: fallbacks render fine */
    }
    this.startAt = performance.now() / 1000;
    this.last = this.startAt;
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.frame();
    };
    this.raf = requestAnimationFrame(loop);
  }

  progress(p: number, label?: string): void {
    this.target = Math.max(this.target, clamp01(p));
    if (label) this.setLabel(label.replace(/\.+$/, ''));
  }

  /** Plays the outro once the title is complete; resolves when the menu is revealed. */
  finish(): Promise<void> {
    this.target = 1;
    return new Promise((resolve) => {
      this.done = resolve;
    });
  }

  private setLabel(text: string): void {
    this.label = text;
    this.labelAt = this.now();
  }

  /** Seconds since start (sting included). */
  private realNow(): number {
    return performance.now() / 1000 - this.startAt;
  }

  /** ABDUZIU scene time: negative while the studio sting plays. */
  private now(): number {
    return this.realNow() - this.sting.duration;
  }

  /** Jumps to the moment the studio frame opens (the logo was seen, the player wants in). */
  private skipSting(): void {
    const target = this.reduced ? this.sting.duration - 0.45 : PORTAL_AT;
    const r = this.realNow();
    if (r < target) this.startAt -= target - r;
  }

  private resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.root.clientWidth || window.innerWidth;
    const hh = this.root.clientHeight || window.innerHeight;
    this.dpr = dpr;
    this.w = w;
    this.h = hh;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(hh * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${hh}px`;
    this.buildScene();
  }

  private buildScene(): void {
    const { w, h: hh } = this;
    this.stars = [];
    const n = Math.round((w * hh) / 5200);
    for (let i = 0; i < n; i++) this.stars.push({ x: Math.random() * w, y: Math.random() * hh * 0.8, z: 0.2 + Math.random() * 0.8, tw: Math.random() * Math.PI * 2 });
    // skyline with the Brazilian classics: blue water tanks and palm trees
    this.city = [];
    let x = -20;
    while (x < w + 40) {
      const bw = 26 + Math.random() * 60;
      const tall = Math.random() < 0.18;
      const bh = (tall ? 90 + Math.random() * 110 : 24 + Math.random() * 60) * Math.min(1.3, hh / 700);
      const lit: number[] = [];
      for (let i = 0; i < 14; i++) if (Math.random() < 0.35) lit.push(i);
      this.city.push({ x, w: bw, h: bh, tank: !tall && Math.random() < 0.55, palm: Math.random() < 0.12, lit });
      x += bw + Math.random() * 6;
    }
  }

  // ───────────────────────────────────────────── frame

  private frame(): void {
    const t = this.now();
    const nowS = performance.now() / 1000;
    const dt = Math.min(0.1, nowS - this.last);
    this.last = nowS;
    // displayed progress eases toward the real one and never outruns the choreography
    const cap = clamp01((t - 0.55) / MIN_INTRO);
    this.shown += (Math.min(this.target, cap) - this.shown) * Math.min(1, dt * 5);
    if (this.target >= 1 && this.shown > 0.995) this.shown = 1;
    if (t - this.labelAt > 0.75 && this.target < 1) {
      this.msgIndex = (this.msgIndex + 1) % MESSAGES.length;
      this.setLabel(MESSAGES[this.msgIndex] as string);
    }
    // letters lock in as progress passes their slot
    for (let i = 0; i < WORD.length; i++) {
      if (this.landed[i] === -1 && this.shown >= (i + 0.6) / WORD.length) {
        this.landed[i] = t;
      }
    }
    const allIn = this.landed.every((v) => v >= 0) && t - Math.max(...this.landed) > 0.45;
    if (this.done && this.outroAt < 0 && this.shown >= 1 && allIn) this.outroAt = t;
    this.shake = Math.max(0, this.shake - dt * 3.5);
    this.flash = Math.max(0, this.flash - dt * 2.4);

    const out = this.outroAt >= 0 ? clamp01((t - this.outroAt) / OUTRO) : 0;
    const r = this.realNow();
    if (r < this.sting.duration) {
      this.canvas.style.opacity = '1';
      this.sting.draw(this.ctx, this.w, this.h, this.dpr, r, dt, this.reduced ? null : this.grainPattern, () => this.draw(t, dt, 0));
      return;
    }
    this.draw(t, dt, out);
    if (this.outroAt >= 0 && out >= 1) this.end();
  }

  private end(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.root.removeEventListener('pointerdown', this.onSkip);
    window.removeEventListener('keydown', this.onSkip);
    this.hideNow();
    const d = this.done;
    this.done = null;
    d?.();
  }

  private draw(t: number, dt: number, out: number): void {
    const c = this.ctx;
    const { w, h: hh } = this;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    const fade = out > 0.45 ? 1 - easeInCubic((out - 0.45) / 0.55) : 1;
    this.canvas.style.opacity = fade.toFixed(3);

    // layout
    const size = Math.max(54, Math.min(w * 0.17, hh * 0.24, 190));
    const cx = w / 2;
    const logoY = hh * 0.52;
    const shakeAmt = this.reduced ? 0 : this.shake * 7;
    const sx = (Math.random() - 0.5) * shakeAmt;
    const sy = (Math.random() - 0.5) * shakeAmt;

    // sky
    const sky = c.createLinearGradient(0, 0, 0, hh);
    sky.addColorStop(0, '#01040a');
    sky.addColorStop(0.55, '#041420');
    sky.addColorStop(1, '#0a2a2a');
    c.fillStyle = sky;
    c.fillRect(0, 0, w, hh);
    const glow = c.createRadialGradient(cx, logoY, 10, cx, logoY, Math.max(w, hh) * 0.6);
    glow.addColorStop(0, `rgba(93,255,160,${0.1 + this.shown * 0.12 + out * 0.3})`);
    glow.addColorStop(1, 'rgba(93,255,160,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, w, hh);

    // stars drift sideways (parallax)
    for (const s of this.stars) {
      const x = (((s.x - t * 12 * s.z) % w) + w) % w;
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.3 + s.tw));
      c.fillStyle = `rgba(220,255,240,${(a * s.z * 0.9).toFixed(3)})`;
      c.fillRect(x, s.y, s.z * 1.8, s.z * 1.8);
    }

    // perspective grid floor
    const horizon = hh * 0.8;
    c.save();
    c.beginPath();
    c.rect(0, horizon, w, hh - horizon);
    c.clip();
    c.strokeStyle = 'rgba(93,255,160,0.10)';
    c.lineWidth = 1;
    for (let i = -12; i <= 12; i++) {
      c.beginPath();
      c.moveTo(cx + i * 18, horizon);
      c.lineTo(cx + i * w * 0.16, hh);
      c.stroke();
    }
    const scroll = (t * 0.35) % 1;
    for (let i = 0; i < 9; i++) {
      const k = (i + scroll) / 9;
      const y = horizon + (hh - horizon) * k * k;
      c.globalAlpha = k;
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    c.restore();
    c.globalAlpha = 1;

    // skyline
    for (const b of this.city) {
      const top = horizon - b.h;
      c.fillStyle = '#040b12';
      c.fillRect(b.x, top, b.w, b.h + 2);
      c.fillStyle = 'rgba(255,214,120,0.55)';
      for (const li of b.lit) {
        const col = li % 3;
        const row = Math.floor(li / 3);
        const wx = b.x + 5 + col * ((b.w - 10) / 3);
        const wy = top + 8 + row * 11;
        if (wy < horizon - 6) c.fillRect(wx, wy, 4, 5);
      }
      if (b.tank) {
        c.fillStyle = '#1f5fa8';
        c.fillRect(b.x + b.w * 0.2, top - 7, 11, 7);
      }
      if (b.palm) {
        c.strokeStyle = '#040b12';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(b.x + b.w + 6, horizon);
        c.quadraticCurveTo(b.x + b.w + 2, horizon - 30, b.x + b.w + 10, horizon - 52);
        c.stroke();
        c.fillStyle = '#040b12';
        for (let k = 0; k < 5; k++) {
          c.save();
          c.translate(b.x + b.w + 10, horizon - 52);
          c.rotate(-2.4 + k * 0.9);
          c.fillRect(0, -2, 20, 4);
          c.restore();
        }
      }
    }

    // saucer
    const enter = easeOutExpo(clamp01(t / 1.1));
    const ufoTargetY = logoY - size * 1.28;
    const leave = out > 0.12 ? easeInCubic(clamp01((out - 0.12) / 0.5)) : 0;
    const ux = cx + (1 - enter) * -w * 0.7 + sx;
    const uy = ufoTargetY + (1 - enter) * -hh * 0.35 + Math.sin(t * 2.2) * 5 - leave * hh * 1.1 + sy;
    const uScale = size / 120 * (1 + leave * 0.6);

    // tractor beam
    const beamOn = clamp01((t - 0.8) / 0.4) * (1 - leave);
    if (beamOn > 0) {
      const flare = out > 0 ? Math.sin(Math.min(1, out / 0.25) * Math.PI) : 0;
      const top = uy + 16 * uScale;
      const bottom = horizon + 4;
      const halfTop = 34 * uScale;
      const halfBot = (size * 2.3 + Math.sin(t * 3) * 8) * (1 + flare * 0.5);
      c.save();
      c.globalCompositeOperation = 'lighter';
      const bg = c.createLinearGradient(0, top, 0, bottom);
      const a = (0.28 + 0.06 * Math.sin(t * 17) + flare * 0.6) * beamOn;
      bg.addColorStop(0, `rgba(190,255,220,${a.toFixed(3)})`);
      bg.addColorStop(1, `rgba(93,255,160,${(a * 0.18).toFixed(3)})`);
      c.fillStyle = bg;
      c.beginPath();
      c.moveTo(ux - halfTop, top);
      c.lineTo(ux + halfTop, top);
      c.lineTo(ux + halfBot, bottom);
      c.lineTo(ux - halfBot, bottom);
      c.closePath();
      c.fill();
      // scan rings sliding down the beam
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.6 + i / 4) % 1;
        const y = top + (bottom - top) * k;
        const rw = halfTop + (halfBot - halfTop) * k;
        c.strokeStyle = `rgba(160,255,210,${(0.22 * (1 - k) * beamOn).toFixed(3)})`;
        c.lineWidth = 1.5;
        c.beginPath();
        c.ellipse(ux, y, rw, rw * 0.12, 0, 0, Math.PI * 2);
        c.stroke();
      }
      // motes rising in the beam
      if (!this.reduced && Math.random() < dt * 40 * beamOn) {
        this.motes.push({ x: ux + (Math.random() - 0.5) * halfBot * 1.4, y: bottom - Math.random() * 20, vy: 40 + Math.random() * 90, life: 1, size: 1 + Math.random() * 2.5 });
      }
      c.restore();
    }
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i] as Mote;
      m.y -= m.vy * dt;
      m.x += (ux - m.x) * dt * 0.8;
      m.life -= dt * 0.7;
      if (m.life <= 0 || m.y < uy) {
        this.motes.splice(i, 1);
        continue;
      }
      c.fillStyle = `rgba(190,255,220,${(m.life * 0.8).toFixed(3)})`;
      c.fillRect(m.x, m.y, m.size, m.size);
    }
    c.restore();
    this.drawSaucer(ux, uy, uScale, t);

    // title
    this.drawTitle(cx + sx, logoY + sy, size, t, horizon, out);

    // tagline, progress bar, status
    const infoA = clamp01((t - 0.9) / 0.5) * (1 - clamp01(out * 3));
    const barW = Math.min(440, w * 0.62);
    const barY = logoY + size * 0.72;
    c.globalAlpha = infoA;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#9ab8ad';
    c.font = `500 ${Math.max(10, Math.round(size * 0.1))}px ${HUD_FONT}`;
    const tag = 'INVASÃO ALIENÍGENA · BRASIL';
    const typed = Math.floor(clamp01((t - 1.0) / 1.1) * tag.length);
    this.spaced(tag.slice(0, typed), cx, barY - size * 0.02, 0.32 * Math.max(10, size * 0.1));
    const by = barY + size * 0.2;
    c.fillStyle = 'rgba(255,255,255,0.08)';
    c.fillRect(cx - barW / 2, by, barW, 3);
    const fillW = barW * this.shown;
    const bar = c.createLinearGradient(cx - barW / 2, 0, cx - barW / 2 + fillW, 0);
    bar.addColorStop(0, 'rgba(62,232,255,0.6)');
    bar.addColorStop(1, '#5dffa0');
    c.fillStyle = bar;
    c.fillRect(cx - barW / 2, by, fillW, 3);
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(160,255,210,0.9)';
    c.beginPath();
    c.arc(cx - barW / 2 + fillW, by + 1.5, 4 + Math.sin(t * 10) * 1.2, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.font = `700 12px ${HUD_FONT}`;
    c.textAlign = 'left';
    c.fillStyle = '#5dffa0';
    const caret = Math.floor(t * 3) % 2 ? '_' : ' ';
    c.fillText(`> ${this.label}${this.target >= 1 ? '' : caret}`, cx - barW / 2, by + 18);
    c.textAlign = 'right';
    c.fillStyle = '#eafff4';
    c.fillText(`${String(Math.round(this.shown * 100)).padStart(3, '0')}%`, cx + barW / 2, by + 18);
    c.globalAlpha = 1;

    this.drawHudFrame(t, infoA);

    // flash on letter lock / outro flare
    const flare = out > 0 ? Math.max(0, 1 - Math.abs(out - 0.18) / 0.18) : 0;
    const fl = Math.max(this.reduced ? 0 : this.flash * 0.35, flare * 0.85);
    if (fl > 0.01) {
      c.fillStyle = `rgba(230,255,240,${fl.toFixed(3)})`;
      c.fillRect(0, 0, w, hh);
    }
    // scanlines, grain, vignette
    c.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < hh; y += 3) c.fillRect(0, y, w, 1);
    if (!this.reduced) {
      c.globalAlpha = 0.05;
      c.globalCompositeOperation = 'overlay';
      const ox = Math.random() * 128;
      const oy = Math.random() * 128;
      const pat = c.createPattern(this.grain, 'repeat');
      if (pat) {
        c.save();
        c.translate(-ox, -oy);
        c.fillStyle = pat;
        c.fillRect(0, 0, w + 128, hh + 128);
        c.restore();
      }
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
    }
    const vig = c.createRadialGradient(cx, hh / 2, Math.min(w, hh) * 0.35, cx, hh / 2, Math.max(w, hh) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.65)');
    c.fillStyle = vig;
    c.fillRect(0, 0, w, hh);
  }

  private spaced(text: string, x: number, y: number, tracking: number): void {
    const c = this.ctx;
    const widths = [...text].map((ch) => c.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, text.length - 1);
    let px = x - total / 2;
    const align = c.textAlign;
    c.textAlign = 'left';
    [...text].forEach((ch, i) => {
      c.fillText(ch, px, y);
      px += (widths[i] as number) + tracking;
    });
    c.textAlign = align;
  }

  private drawSaucer(x: number, y: number, s: number, t: number): void {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.rotate(Math.sin(t * 1.7) * 0.05);
    // underside glow
    c.save();
    c.globalCompositeOperation = 'lighter';
    const ug = c.createRadialGradient(0, 14, 2, 0, 14, 60);
    ug.addColorStop(0, 'rgba(120,255,190,0.55)');
    ug.addColorStop(1, 'rgba(120,255,190,0)');
    c.fillStyle = ug;
    c.fillRect(-70, -10, 140, 70);
    c.restore();
    // dome
    const dome = c.createLinearGradient(0, -38, 0, 0);
    dome.addColorStop(0, 'rgba(210,255,240,0.95)');
    dome.addColorStop(1, 'rgba(93,255,160,0.55)');
    c.fillStyle = dome;
    c.beginPath();
    c.ellipse(0, -6, 28, 30, 0, Math.PI, 0);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.beginPath();
    c.ellipse(-9, -22, 6, 9, -0.5, 0, Math.PI * 2);
    c.fill();
    // hull
    const hull = c.createLinearGradient(0, -12, 0, 16);
    hull.addColorStop(0, '#f4f8fb');
    hull.addColorStop(0.55, '#aab4bf');
    hull.addColorStop(1, '#5b6570');
    c.fillStyle = hull;
    c.beginPath();
    c.ellipse(0, 0, 62, 15, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#39424e';
    c.beginPath();
    c.ellipse(0, 7, 40, 7, 0, 0, Math.PI * 2);
    c.fill();
    // chasing rim lights
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI + (i / 8) * Math.PI;
      const lx = Math.cos(a) * 52;
      const ly = 4 + Math.sin(-a) * 2;
      const on = (Math.floor(t * 10) + i) % 3 === 0;
      c.fillStyle = on ? '#ffcf3f' : 'rgba(93,255,160,0.8)';
      c.beginPath();
      c.arc(lx, ly, on ? 3.4 : 2.4, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  private drawTitle(cx: number, baseY: number, size: number, t: number, horizon: number, out: number): void {
    const c = this.ctx;
    c.font = `italic 900 ${size}px ${TITLE_FONT}`;
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    const letters = WORD.split('');
    const tracking = size * 0.02;
    const widths = letters.map((ch) => c.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + tracking * (letters.length - 1);
    const outScale = 1 + easeOutExpo(out) * 0.06;
    let x = cx - (total * outScale) / 2;
    const depth = Math.max(3, Math.round(size * 0.045));
    letters.forEach((ch, i) => {
      const lw = (widths[i] as number) * outScale;
      const landedAt = this.landed[i] as number;
      const lx = x;
      x += lw + tracking * outScale;
      if (landedAt < 0) {
        // ghost outline waiting to be abducted into place
        c.save();
        c.strokeStyle = 'rgba(93,255,160,0.12)';
        c.lineWidth = 1;
        c.strokeText(ch, lx, baseY);
        c.restore();
        return;
      }
      const k = clamp01((t - landedAt) / 0.62);
      if (k < 1 && k > 0.8 && !this.reduced) this.onLand(i, t);
      const rise = this.reduced ? 1 : easeOutBack(k);
      const y = baseY + (1 - rise) * (horizon - baseY + size * 0.4);
      const sc = (0.45 + 0.55 * Math.min(1, rise)) * outScale;
      const alpha = clamp01(k * 3);
      const wob = (1 - k) * Math.sin(t * 22 + i) * 0.25;
      const bob = Math.sin(t * 2 + i * 0.7) * size * 0.012 * k;
      c.save();
      c.globalAlpha = alpha;
      c.translate(lx + lw / 2, y + bob);
      c.rotate(wob);
      c.scale(sc, sc);
      c.translate(-(widths[i] as number) / 2, 0);
      // extruded depth
      c.fillStyle = '#9c5800';
      for (let d = depth; d > 0; d--) c.fillText(ch, d * 0.6, d);
      const grad = c.createLinearGradient(0, -size * 0.8, 0, 0);
      grad.addColorStop(0, '#fff3b0');
      grad.addColorStop(0.45, '#ffcf3f');
      grad.addColorStop(1, '#ff9f1c');
      c.fillStyle = grad;
      c.fillText(ch, 0, 0);
      // chromatic split while settling
      if (k < 1 && !this.reduced) {
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = alpha * (1 - k) * 0.7;
        c.fillStyle = 'rgba(255,40,90,0.9)';
        c.fillText(ch, -size * 0.03, 0);
        c.fillStyle = 'rgba(40,230,255,0.9)';
        c.fillText(ch, size * 0.03, 0);
      }
      c.restore();
    });
  }

  private lastLand = -1;
  private onLand(i: number, _t: number): void {
    if (this.lastLand === i) return;
    this.lastLand = i;
    this.shake = Math.min(1, this.shake + 0.55);
    this.flash = Math.min(1, this.flash + 0.35);
  }

  private drawHudFrame(t: number, a: number): void {
    const c = this.ctx;
    const { w, h: hh } = this;
    const m = 18;
    const L = 22;
    c.globalAlpha = a;
    c.strokeStyle = 'rgba(93,255,160,0.55)';
    c.lineWidth = 1.5;
    const corner = (x: number, y: number, dx: number, dy: number) => {
      c.beginPath();
      c.moveTo(x, y + dy * L);
      c.lineTo(x, y);
      c.lineTo(x + dx * L, y);
      c.stroke();
    };
    corner(m, m, 1, 1);
    corner(w - m, m, -1, 1);
    corner(m, hh - m, 1, -1);
    corner(w - m, hh - m, -1, -1);
    c.font = `500 10px ${HUD_FONT}`;
    c.fillStyle = 'rgba(154,184,173,0.85)';
    c.textBaseline = 'top';
    c.textAlign = 'left';
    c.fillText('SINAL · 1420 MHz · INTERCEPTADO', m + 8, m + 8);
    c.textAlign = 'right';
    c.fillText(COORDS[Math.floor(t * 1.4) % COORDS.length] as string, w - m - 8, m + 8);
    c.textBaseline = 'bottom';
    c.fillText('OBJETO NÃO IDENTIFICADO', w - m - 8, hh - m - 8);
    c.textAlign = 'left';
    c.fillText(`T+${t.toFixed(2)}s`, m + 8, hh - m - 8);
    c.globalAlpha = 1;
  }
}
