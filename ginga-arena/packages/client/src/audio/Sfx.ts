/**
 * Synthesized placeholder sounds (WebAudio, no files): one voice per body part, attack
 * whoosh, net, sand, crowd swell and point stings. Panned by the ball's screen x so the
 * sound tells where the play is. Final recorded SFX replace these in Marco D.
 */

import type { SimEvent } from '@ginga/shared';
import { settings } from '../app/storage';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastCrowd = 0;

  /** Must be called from a user gesture (browsers keep audio locked until then). */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.applyVolume();
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  applyVolume(): void {
    if (this.master) this.master.gain.value = settings.master * settings.sfx;
  }

  private out(pan: number, gain: number): GainNode | null {
    const c = this.ctx;
    if (!c || !this.master) return null;
    const g = c.createGain();
    g.gain.value = gain;
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(this.master);
    return g;
  }

  private tone(freq: number, to: number, dur: number, pan: number, gain: number, type: OscillatorType = 'sine'): void {
    const c = this.ctx;
    const g = this.out(pan, 0);
    if (!c || !g) return;
    const o = c.createOscillator();
    o.type = type;
    const t = c.currentTime;
    o.frequency.setValueAtTime(freq * (0.97 + Math.random() * 0.06), t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private hiss(dur: number, freq: number, q: number, pan: number, gain: number, attack = 0.005): void {
    const c = this.ctx;
    const g = this.out(pan, 0);
    if (!c || !g || !this.noise) return;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  /** `pan` = the event's screen x mapped to -1..1. */
  play(e: SimEvent, pan: number): void {
    if (!this.ctx) return;
    switch (e.k) {
      case 'contact': {
        const loud = Math.min(1, 0.45 + e.speed / 30);
        if (e.part === 'foot') this.tone(150, 55, 0.14, pan, 0.9 * loud);
        else if (e.part === 'thigh') this.tone(110, 60, 0.12, pan, 0.7 * loud, 'triangle');
        else if (e.part === 'chest') this.tone(90, 45, 0.18, pan, 0.8 * loud);
        else this.tone(420, 180, 0.08, pan, 0.6 * loud, 'triangle');
        if (e.kind === 'attack' || e.speed > 13) this.hiss(0.25, 1800, 0.8, pan, 0.25 * loud, 0.03);
        if (e.grade === 'perfect') this.tone(1760, 1600, 0.12, pan, 0.12, 'triangle');
        break;
      }
      case 'net':
        this.hiss(0.3, 3500, 1.5, 0, 0.3);
        break;
      case 'ground':
        this.hiss(0.35, 700, 0.7, pan, 0.5);
        break;
      case 'point': {
        this.crowd(0.6);
        // agogô-like two-tone
        this.tone(988, 980, 0.12, 0, 0.18, 'square');
        setTimeout(() => this.tone(740, 735, 0.18, 0, 0.18, 'square'), 140);
        break;
      }
      case 'over':
        [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.25, 0, 0.16, 'triangle'), i * 150));
        this.crowd(1);
        break;
      case 'phase':
        if (e.phase === 'serve') this.tone(1320, 1300, 0.07, 0, 0.08, 'square');
        break;
      case 'jump':
        this.hiss(0.12, 500, 0.6, pan, 0.12);
        break;
      default:
        break;
    }
  }

  countdownBeep(final: boolean): void {
    this.tone(final ? 880 : 440, final ? 870 : 435, final ? 0.3 : 0.12, 0, 0.18, 'square');
  }

  private crowd(amount: number): void {
    const now = performance.now();
    if (now - this.lastCrowd < 800) return;
    this.lastCrowd = now;
    this.hiss(1.6 * amount + 0.4, 900, 0.4, -0.3, 0.18 * amount, 0.25);
    this.hiss(1.6 * amount + 0.4, 1300, 0.4, 0.3, 0.14 * amount, 0.3);
  }
}
