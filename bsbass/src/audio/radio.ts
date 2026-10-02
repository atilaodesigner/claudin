// Rádio com música de verdade (MP3 em public/radio, streaming):
//  BSBASS FM    -> abre com "Um Grave Romance" (tribo da periferia) e segue no hip-hop
//  TRAP 61      -> trap
//  CRUNK DO DF  -> crunk / dirty south
// As faixas de fora são do ccMixter, licença CC-BY 3.0 (créditos no README e
// nas configurações do jogo).

import type { AudioSystem } from './audio';

export interface Track {
  title: string;
  artist: string;
  file: string;
  length: number; // s (pra lista; o fim de verdade vem do 'ended')
}

export interface Station {
  id: string;
  name: string;
  freq: string;
  genre: string;
  tracks: Track[];
}

const R = (f: string) => `./radio/${f}.mp3`;

export const STATIONS: Station[] = [
  {
    id: 'bsbass', name: 'BSBASS FM', freq: '61.1', genre: 'HIP-HOP',
    tracks: [
      { title: 'Um Grave Romance', artist: 'Tribo da Periferia', file: './intro/tema.mp3', length: 199 },
      { title: 'The Power of Will', artist: 'Robbero', file: R('hiphop-power-of-will'), length: 256 },
      { title: 'Slow Down Move Over', artist: 'Reiswerk', file: R('hiphop-slow-down'), length: 165 },
      { title: 'I Dunno', artist: 'grapes', file: R('hiphop-i-dunno'), length: 165 },
      { title: 'Slumlord', artist: 'lotagblanco', file: R('hiphop-slumlord'), length: 199 },
    ],
  },
  {
    id: 'trap', name: 'TRAP 61', freq: '96.1', genre: 'TRAP',
    tracks: [
      { title: 'Trap Monopoly', artist: 'Robbero', file: R('trap-monopoly'), length: 199 },
      { title: 'Goat (Southern Trap)', artist: 'Robbero', file: R('trap-goat'), length: 141 },
      { title: 'SunLight', artist: 'Robbero', file: R('trap-sunlight'), length: 146 },
      { title: 'The Right Voice', artist: 'Robbero', file: R('trap-right-voice'), length: 200 },
    ],
  },
  {
    id: 'crunk', name: 'CRUNK DO DF', freq: '104.7', genre: 'CRUNK / DIRTY SOUTH',
    tracks: [
      { title: "PoPPin Over Here", artist: 'Jeffo_32', file: R('crunk-poppin'), length: 278 },
      { title: 'KyA (dirrty)', artist: 'Paulus', file: R('crunk-kya'), length: 185 },
      { title: 'The Crunk Alphabet', artist: 'blakeht', file: R('crunk-alphabet'), length: 146 },
      { title: 'M.U.S.T.A.N.G (Going South)', artist: 'whytong', file: R('crunk-mustang'), length: 168 },
    ],
  },
];

export class Radio {
  station = 0;
  track = 0;
  on = true;
  trackTime = 0;
  bassLevel = 0; // 0..1 (pro paredão piscar)
  onChange: (() => void) | null = null;
  private el: HTMLAudioElement | null = null;
  private analyser: AnalyserNode | null = null;
  private freq: Uint8Array<ArrayBuffer> | null = null;

  constructor(private audio: AudioSystem) {}

  get current(): Station {
    return STATIONS[this.station % STATIONS.length]!;
  }

  get currentTrack(): Track {
    return this.current.tracks[this.track % this.current.tracks.length]!;
  }

  /** `afterTheme`: a abertura acabou de tocar (a BSBASS FM segue da segunda faixa) */
  start(afterTheme = false): void {
    const ctx = this.audio.ctx;
    if (!ctx || this.el) return;
    this.station = ((this.station % STATIONS.length) + STATIONS.length) % STATIONS.length;
    const el = new Audio();
    el.preload = 'auto';
    el.addEventListener('ended', () => this.skip(1));
    // vai pela mesa do jogo: volume da música, abaixa no ferro-velho e mede o grave
    const src = ctx.createMediaElementSource(el);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.6;
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    src.connect(this.analyser).connect(this.audio.musicBus);
    this.el = el;
    this.track = this.station === 0 ? (afterTheme ? 1 : 0) : Math.floor(Math.random() * this.current.tracks.length);
    this.play();
  }

  private play(): void {
    const el = this.el;
    if (!el) return;
    this.trackTime = 0;
    if (!this.on) {
      el.pause();
      return;
    }
    const url = this.currentTrack.file;
    if (!el.src.endsWith(url.replace('./', '/'))) el.src = url;
    else el.currentTime = 0;
    el.play().catch(() => undefined);
  }

  setStation(i: number): void {
    this.station = (i + STATIONS.length) % STATIONS.length;
    this.track = Math.floor(Math.random() * this.current.tracks.length);
    this.on = true;
    this.audio.static();
    this.play();
    this.onChange?.();
  }

  nextStation(dir = 1): void {
    if (!this.on) {
      this.on = true;
      this.play();
      this.onChange?.();
      return;
    }
    this.setStation(this.station + dir);
  }

  skip(dir = 1): void {
    const n = this.current.tracks.length;
    this.track = (this.track + dir + n) % n;
    this.audio.static();
    this.play();
    this.onChange?.();
  }

  toggle(): void {
    this.on = !this.on;
    if (this.on) this.play();
    else this.el?.pause();
    this.onChange?.();
  }

  update(_dt: number): void {
    const el = this.el;
    if (!el || !this.analyser || !this.freq) {
      this.bassLevel = 0;
      return;
    }
    this.trackTime = el.currentTime;
    if (!this.on || el.paused) {
      this.bassLevel *= 0.85;
      return;
    }
    // grave (até ~150 Hz) pros LEDs do paredão
    this.analyser.getByteFrequencyData(this.freq);
    const hz = this.audio.ctx!.sampleRate / this.analyser.fftSize;
    const top = Math.max(2, Math.round(150 / hz));
    let sum = 0;
    for (let i = 1; i < top; i++) sum += this.freq[i]!;
    const lvl = Math.min(1, Math.max(0, (sum / (top - 1) - 120) / 120));
    this.bassLevel = Math.max(lvl, this.bassLevel * 0.82);
  }
}
