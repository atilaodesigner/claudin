// Rádio com música gerada na hora (sequenciador WebAudio):
//  GRAVE 61 FM  -> funk de quebrada (tamborzão, 808 distorcido, stab)
//  BSBASS PHONK -> drift phonk (cowbell, 808 deslizando)
//  EIXÃO TRAP   -> trap meio-tempo (hi-hat picotado, sino escuro)
// Faixas e artistas são fictícios.

import type { AudioSystem } from './audio';

export interface Track {
  title: string;
  artist: string;
  seed: number;
  length: number; // s
}

export interface Station {
  id: string;
  name: string;
  freq: string;
  genre: string;
  bpm: number;
  tracks: Track[];
}

export const STATIONS: Station[] = [
  {
    id: 'funk', name: 'GRAVE 61 FM', freq: '61.1', genre: 'FUNK DE QUEBRADA', bpm: 130,
    tracks: [
      { title: 'TAMBORZÃO DA QNN', artist: 'MC POEIRA', seed: 11, length: 150 },
      { title: 'BAILE NO SOL NASCENTE', artist: 'DJ CERRADO', seed: 12, length: 140 },
      { title: 'MANDELÃO DO BALÃO', artist: 'MC K7 & DJ LAJE', seed: 13, length: 160 },
      { title: 'ESTRUTURAL NA ATIVIDADE', artist: 'BONDE DO GRAVE', seed: 14, length: 150 },
    ],
  },
  {
    id: 'phonk', name: 'BSBASS PHONK', freq: '96.1', genre: 'DRIFT PHONK', bpm: 128,
    tracks: [
      { title: 'DRIFT NO BALÃO', artist: 'K7 DO GRAVE', seed: 21, length: 150 },
      { title: 'CAIXA D’ÁGUA NIGHTS', artist: 'BSB PHONK', seed: 22, length: 140 },
      { title: 'POEIRA VERMELHA', artist: 'CEILÂNDIA DRIFT CLUB', seed: 23, length: 150 },
      { title: 'MUSTANG AZUL', artist: 'LIL CERRADO', seed: 24, length: 145 },
    ],
  },
  {
    id: 'trap', name: 'EIXÃO TRAP', freq: '104.7', genre: 'TRAP DE QUEBRADA', bpm: 142,
    tracks: [
      { title: 'EIXÃO 3AM', artist: 'LIL SECA', seed: 31, length: 150 },
      { title: 'LAJE SEM REBOCO', artist: 'QUEBRADA BOYZ', seed: 32, length: 140 },
      { title: 'SINAL FECHADO', artist: 'MC TESOURINHA', seed: 33, length: 150 },
    ],
  },
];

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class Radio {
  station = 1; // começa no phonk
  track = 0;
  on = true;
  trackTime = 0;
  bassLevel = 0; // 0..1 (pro paredão piscar)
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private lastKicks: number[] = [];
  private rnd = Math.random;
  private shaper: WaveShaperNode | null = null;
  private delay: DelayNode | null = null;
  private noise: AudioBuffer | null = null;
  private key = 0;
  private riff: number[] = [];
  private bassline: number[] = [];
  private variation = 0;
  onChange: (() => void) | null = null;

  constructor(private audio: AudioSystem) {}

  get current(): Station {
    return STATIONS[this.station]!;
  }

  get currentTrack(): Track {
    return this.current.tracks[this.track % this.current.tracks.length]!;
  }

  start(): void {
    const ctx = this.audio.ctx;
    if (!ctx || this.timer !== null) return;
    this.shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 2.6);
    }
    this.shaper.curve = curve;
    const sh = ctx.createGain();
    sh.gain.value = 0.8;
    this.shaper.connect(sh).connect(this.audio.musicBus);
    this.delay = ctx.createDelay(1);
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(wet).connect(this.audio.musicBus);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.setupTrack();
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private setupTrack(): void {
    const tr = this.currentTrack;
    let s = tr.seed * 9973;
    this.rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    this.key = [0, 2, 3, 5, 7, 8, 10][Math.floor(this.rnd() * 7)]!;
    const scale = [0, 3, 5, 7, 10, 12, 15];
    this.riff = Array.from({ length: 16 }, () => (this.rnd() < 0.72 ? scale[Math.floor(this.rnd() * scale.length)]! : -1));
    this.riff[0] = 0;
    const roots = [0, -4, -2, -5, 0, 3, -2, -7];
    const a = Math.floor(this.rnd() * 4);
    this.bassline = [roots[a]!, roots[(a + 1) % 8]!, roots[(a + 3) % 8]!, roots[(a + 2) % 8]!];
    this.step = 0;
    this.trackTime = 0;
    this.delay?.delayTime.setValueAtTime((60 / this.current.bpm) * 0.75, this.audio.ctx?.currentTime ?? 0);
  }

  setStation(i: number): void {
    this.station = (i + STATIONS.length) % STATIONS.length;
    this.track = Math.floor(Math.random() * this.current.tracks.length);
    this.on = true;
    this.audio.static();
    this.setupTrack();
    this.onChange?.();
  }

  nextStation(dir = 1): void {
    if (!this.on) {
      this.on = true;
      this.setupTrack();
      this.onChange?.();
      return;
    }
    this.setStation(this.station + dir);
  }

  skip(dir = 1): void {
    const n = this.current.tracks.length;
    this.track = (this.track + dir + n) % n;
    this.audio.static();
    this.setupTrack();
    this.onChange?.();
  }

  toggle(): void {
    this.on = !this.on;
    if (this.on) this.setupTrack();
    this.onChange?.();
  }

  update(dt: number): void {
    const ctx = this.audio.ctx;
    if (!ctx) return;
    if (this.on) {
      this.trackTime += dt;
      if (this.trackTime > this.currentTrack.length) this.skip(1);
    }
    // nível do grave pros LEDs do paredão
    const now = ctx.currentTime;
    let lvl = 0;
    for (const k of this.lastKicks) {
      const age = now - k;
      if (age >= 0 && age < 0.5) lvl = Math.max(lvl, Math.exp(-age * 7));
    }
    this.lastKicks = this.lastKicks.filter((k) => now - k < 1);
    this.bassLevel = this.on ? lvl : 0;
  }

  private schedule(): void {
    const ctx = this.audio.ctx;
    if (!ctx) return;
    const stepDur = 60 / this.current.bpm / 4;
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.12) {
      if (this.on) this.playStep(this.step, this.nextTime, stepDur);
      this.step++;
      this.nextTime += stepDur;
    }
  }

  private playStep(step: number, t: number, sd: number): void {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const chord = this.bassline[bar % 4]!;
    const root = 33 + this.key + chord; // A1 + tom
    if (s === 0 && bar % 8 === 0) this.variation = this.rnd();
    const id = this.current.id;
    const fill = bar % 8 === 7;

    if (id === 'funk') {
      // tamborzão
      if ([0, 3, 8, 11].includes(s) || (fill && s === 14)) this.kick(t, 1);
      if (s === 4 || s === 12) this.clap(t, 0.5);
      if ([2, 6, 7, 10, 14, 15].includes(s)) this.tom(t, s % 4 === 3 ? 180 : 125, 0.4);
      if (s % 2 === 0) this.hat(t, 0.06, false);
      if (s === 0 || s === 8) this.bass808(t, root + (s === 8 && this.variation > 0.5 ? 3 : 0), sd * 7, 0.8);
      if (bar % 2 === 1 && (s === 2 || s === 5 || s === 10)) this.stab(t, root + 36 + (this.riff[s] ?? 0), 0.12);
      if (bar % 4 === 3 && s === 12) this.vocal(t, this.variation > 0.5 ? 'ei' : 'ah');
    } else if (id === 'phonk') {
      if (s === 0 || s === 10 || (s === 7 && this.variation > 0.4) || (fill && s === 14)) this.kick(t, 1);
      if (s === 4 || s === 12) this.clap(t, 0.55);
      if (s % 2 === 0) this.hat(t, s % 4 === 2 ? 0.1 : 0.05, s === 14);
      if (fill && s >= 12) this.hat(t + sd / 2, 0.05, false);
      if (s === 0) this.bass808(t, root, sd * 10, 0.9, s === 0 && bar % 2 === 1 ? root + 7 : undefined);
      if (s === 10) this.bass808(t, root + (this.variation > 0.6 ? 3 : 0), sd * 5, 0.7);
      const n = this.riff[s]!;
      if (n >= 0 && bar % 16 >= 2) this.cowbell(t, root + 48 + n + (bar % 4 === 3 && s > 8 ? 2 : 0), 0.13);
    } else {
      // trap meio-tempo
      if (s === 0 || (s === 7 && this.variation > 0.3) || s === 10 || (fill && s === 13)) this.kick(t, 0.95);
      if (s === 8) this.clap(t, 0.6);
      const roll = (s === 6 || s === 14) && this.variation > 0.35;
      this.hat(t, 0.05 + (s % 4 === 0 ? 0.03 : 0), false);
      if (roll) {
        this.hat(t + sd / 3, 0.04, false);
        this.hat(t + (sd * 2) / 3, 0.04, false);
      }
      if (s === 0) this.bass808(t, root, sd * 12, 0.95, bar % 2 === 1 ? root - 2 : undefined);
      if (s === 10) this.bass808(t, root + 5, sd * 4, 0.7, root);
      if (s % 4 === 0 && this.riff[s]! >= 0 && bar % 2 === 0) this.bell(t, root + 48 + this.riff[s]!, 0.1);
    }
  }

  // ---------- instrumentos ----------
  private out(): AudioNode {
    return this.audio.musicBus;
  }

  private env(g: GainNode, t: number, peak: number, a: number, d: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private kick(t: number, v: number): void {
    const ctx = this.audio.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    const g = ctx.createGain();
    this.env(g, t, 0.9 * v, 0.003, 0.28);
    o.connect(g).connect(this.out());
    o.start(t);
    o.stop(t + 0.35);
    this.lastKicks.push(t);
  }

  private noiseHit(t: number, type: BiquadFilterType, freq: number, q: number, peak: number, decay: number, dest?: AudioNode): void {
    const ctx = this.audio.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, peak, 0.002, decay);
    n.connect(f).connect(g).connect(dest ?? this.out());
    n.start(t, Math.random() * 0.5);
    n.stop(t + decay + 0.05);
  }

  private clap(t: number, v: number): void {
    for (let k = 0; k < 3; k++) this.noiseHit(t + k * 0.011, 'bandpass', 1500, 1.2, v * (k === 2 ? 1 : 0.6), k === 2 ? 0.18 : 0.02);
  }

  private hat(t: number, v: number, open: boolean): void {
    this.noiseHit(t, 'highpass', 7500, 0.8, v, open ? 0.2 : 0.035);
  }

  private tom(t: number, f0: number, v: number): void {
    const ctx = this.audio.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.7, t + 0.12);
    const g = ctx.createGain();
    this.env(g, t, v, 0.003, 0.14);
    o.connect(g).connect(this.out());
    o.start(t);
    o.stop(t + 0.2);
  }

  private bass808(t: number, note: number, dur: number, v: number, glideTo?: number): void {
    const ctx = this.audio.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(midi(note), t);
    if (glideTo !== undefined) o.frequency.exponentialRampToValueAtTime(midi(glideTo), t + dur * 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v * 0.75, t + 0.01);
    g.gain.exponentialRampToValueAtTime(v * 0.4, t + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.shaper!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private cowbell(t: number, note: number, v: number): void {
    const ctx = this.audio.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = midi(note) * 1.6;
    f.Q.value = 2;
    const g = ctx.createGain();
    this.env(g, t, v, 0.002, 0.16);
    for (const r of [1, 1.48]) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = midi(note) * r;
      o.connect(f);
      o.start(t);
      o.stop(t + 0.22);
    }
    f.connect(g);
    g.connect(this.out());
    g.connect(this.delay!);
  }

  private bell(t: number, note: number, v: number): void {
    const ctx = this.audio.ctx!;
    const g = ctx.createGain();
    this.env(g, t, v, 0.004, 0.9);
    for (const [r, type] of [[1, 'triangle'], [2.01, 'sine'], [3.98, 'sine']] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = midi(note) * r;
      const og = ctx.createGain();
      og.gain.value = r === 1 ? 1 : 0.3;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + 1);
    }
    g.connect(this.out());
    g.connect(this.delay!);
  }

  private stab(t: number, note: number, v: number): void {
    const ctx = this.audio.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3000, t);
    f.frequency.exponentialRampToValueAtTime(400, t + 0.15);
    const g = ctx.createGain();
    this.env(g, t, v, 0.004, 0.16);
    for (const [n, d] of [[0, -8], [0, 8], [3, 0], [7, 0]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(note + n);
      o.detune.value = d;
      o.connect(f);
      o.start(t);
      o.stop(t + 0.22);
    }
    f.connect(g).connect(this.out());
  }

  private vocal(t: number, v: 'ei' | 'ah'): void {
    // "vocal" formante sintético (chamada de MC)
    const ctx = this.audio.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(v === 'ei' ? 210 : 180, t);
    o.frequency.linearRampToValueAtTime(v === 'ei' ? 240 : 160, t + 0.2);
    const g = ctx.createGain();
    this.env(g, t, 0.18, 0.01, 0.22);
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.value = v === 'ei' ? 500 : 800;
    f1.Q.value = 6;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = v === 'ei' ? 1900 : 1200;
    f2.Q.value = 8;
    o.connect(f1).connect(g);
    o.connect(f2).connect(g);
    g.connect(this.out());
    g.connect(this.delay!);
    o.start(t);
    o.stop(t + 0.3);
  }
}
