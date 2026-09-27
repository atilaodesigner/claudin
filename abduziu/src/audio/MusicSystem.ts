import { midiToFreq, type Synth } from './Synth';

export interface MusicState {
  mode: 'off' | 'menu' | 'run';
  alert: number;
  combo: number;
  frenzy: boolean;
  boss: boolean;
}

type Section = 'calm' | 'tension' | 'combat' | 'redsky';

/** Chord voicings (MIDI) per section, 4 bars each. */
const PROGRESSIONS: Record<Section, number[][]> = {
  // bossa-ish: Dmaj9 – Bm9 – Em9 – A13
  calm: [
    [50, 54, 57, 61, 64],
    [47, 50, 54, 57, 61],
    [52, 55, 59, 62, 66],
    [45, 49, 55, 59, 66],
  ],
  // Dm9 – Bbmaj7 – Gm9 – A7(b9)
  tension: [
    [50, 53, 57, 60, 64],
    [46, 50, 53, 57, 62],
    [43, 46, 50, 53, 57],
    [45, 49, 52, 55, 58],
  ],
  combat: [
    [50, 53, 57, 62],
    [46, 50, 53, 58],
    [48, 52, 55, 60],
    [45, 49, 52, 57],
  ],
  redsky: [
    [50, 53, 56, 62],
    [49, 52, 56, 61],
    [46, 50, 53, 58],
    [45, 48, 52, 57],
  ],
};

const TEMPO: Record<Section, number> = { calm: 100, tension: 112, combat: 128, redsky: 132 };

/**
 * Procedural adaptive soundtrack with a Brazilian flavor:
 * calm = bossa pad + clave + shaker, tension = samba surdo & tamborim,
 * combat/red sky = batidão (funk) kick pattern + stabs. Combo adds an arpeggio,
 * frenzy speeds everything up.
 */
export class MusicSystem {
  private state: MusicState = { mode: 'off', alert: 0, combo: 0, frenzy: false, boss: false };
  private readonly out: GainNode;
  private nextTime = 0;
  private step = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private section: Section = 'calm';
  private layerGains: Record<string, number> = {};

  constructor(
    private readonly synth: Synth,
    destination: AudioNode,
  ) {
    const ctx = synth.ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(destination);
  }

  setState(s: Partial<MusicState>): void {
    Object.assign(this.state, s);
    const a = this.state.alert;
    this.section = this.state.boss || a >= 6 ? 'redsky' : a >= 4 ? 'combat' : a >= 2 ? 'tension' : 'calm';
    if (this.state.mode === 'off') this.stop();
    else this.start();
  }

  private start(): void {
    if (this.timer !== null) return;
    this.nextTime = this.synth.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const ctx = this.synth.ctx;
    if (ctx.state !== 'running') return;
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime);
      const bpm = TEMPO[this.section] * (this.state.frenzy ? 1.12 : 1);
      this.nextTime += 60 / bpm / 4;
      this.step = (this.step + 1) % 256;
    }
  }

  private target(name: string, want: number): number {
    // smooth layer fades across steps (no hard cuts)
    const cur = this.layerGains[name] ?? 0;
    const next = cur + (want - cur) * 0.08;
    this.layerGains[name] = next;
    return next;
  }

  private playStep(step: number, t: number): void {
    const s = this.synth;
    const st = this.state;
    const sec = this.section;
    const s16 = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const chord = PROGRESSIONS[sec][bar] as number[];
    const menu = st.mode === 'menu';
    const combo = st.combo;

    const padG = this.target('pad', menu ? 0.7 : 1);
    const lightG = this.target('light', sec === 'calm' || menu ? 1 : 0.5);
    const sambaG = this.target('samba', !menu && (sec === 'tension' || sec === 'combat') ? 1 : 0);
    const funkG = this.target('funk', !menu && (sec === 'combat' || sec === 'redsky') ? 1 : 0);
    const arpG = this.target('arp', !menu && (combo >= 10 || st.frenzy) ? Math.min(1, 0.4 + combo / 60) : 0);
    const stabG = this.target('stab', !menu && (sec === 'redsky' || st.boss) ? 1 : 0);
    const out = this.out;

    // PAD: chord on bar start, soft and wide
    if (s16 === 0 && padG > 0.02) {
      const len = (60 / TEMPO[sec]) * 4;
      chord.forEach((m, i) => {
        s.osc(i % 2 ? 'triangle' : 'sine', midiToFreq(m + 12), t, len * 0.95, out, 0.035 * padG, 0.25, undefined, (i - 2) * 6);
      });
    }
    // Rhodes-ish comping (bossa syncopation)
    if (sec === 'calm' && [0, 3, 6, 10, 12].includes(s16) && padG > 0.02) {
      const notes = chord.slice(1, 4);
      for (const m of notes) s.osc('sine', midiToFreq(m + 12), t, 0.35, out, 0.028 * padG, 0.005);
    }
    // BASS
    const root = chord[0] as number;
    const bassPattern = sec === 'calm' ? [0, 6, 8, 14] : sec === 'tension' ? [0, 3, 8, 11, 14] : [0, 3, 6, 10, 12, 14];
    if (bassPattern.includes(s16) && !menu) {
      const fifth = s16 === 6 || s16 === 14 ? 7 : 0;
      const type: OscillatorType = sec === 'calm' ? 'sine' : 'sawtooth';
      const f = midiToFreq(root - 12 + fifth);
      const b = s.osc(type, f, t, sec === 'calm' ? 0.28 : 0.16, out, sec === 'calm' ? 0.16 : 0.09, 0.004);
      if (type === 'sawtooth') {
        // quick filter via detune wobble is cheap; keep it short and punchy
        b.detune.setValueAtTime(-8, t);
      }
    }
    // LIGHT PERC: shaker + bossa clave (rim)
    if (lightG > 0.02) {
      s.noiseBurst(t, 0.04, out, (s16 % 2 === 0 ? 0.03 : 0.018) * lightG, 'highpass', 7000);
      if ([0, 3, 6, 10, 13].includes(s16)) s.osc('square', 1700, t, 0.03, out, 0.03 * lightG, 0.001, 900);
    }
    // SAMBA: surdo on 2 and 4 (steps 4 & 12), tamborim syncopation
    if (sambaG > 0.02) {
      if (s16 === 4) s.osc('sine', 70, t, 0.35, out, 0.3 * sambaG, 0.004, 52);
      if (s16 === 12) s.osc('sine', 62, t, 0.45, out, 0.36 * sambaG, 0.004, 46);
      if ([0, 2, 3, 5, 7, 8, 10, 11, 13, 15].includes(s16)) s.osc('square', 2400, t, 0.02, out, 0.022 * sambaG, 0.001, 1600);
      if (s16 % 4 === 2) s.noiseBurst(t, 0.06, out, 0.05 * sambaG, 'bandpass', 3500, undefined, 2);
    }
    // FUNK / batidão
    if (funkG > 0.02) {
      if ([0, 3, 6, 10].includes(s16)) s.osc('sine', 110, t, 0.22, out, 0.5 * funkG, 0.002, 40);
      if (s16 === 4 || s16 === 12) {
        s.noiseBurst(t, 0.14, out, 0.16 * funkG, 'bandpass', 1800, 900, 0.8);
        s.osc('triangle', 220, t, 0.08, out, 0.08 * funkG, 0.001, 150);
      }
      if (s16 % 2 === 1) s.noiseBurst(t, 0.03, out, 0.03 * funkG, 'highpass', 9000);
    }
    // ARP (combo / frenzy)
    if (arpG > 0.02) {
      const tones = [...chord.slice(1), (chord[1] as number) + 12];
      const m = tones[s16 % tones.length] as number;
      s.osc(st.frenzy ? 'sawtooth' : 'square', midiToFreq(m + 12), t, 0.1, out, 0.03 * arpG, 0.002);
    }
    // STABS (red sky / boss)
    if (stabG > 0.02 && [0, 7, 10].includes(s16)) {
      for (const m of chord.slice(0, 3)) s.osc('sawtooth', midiToFreq(m), t, 0.18, out, 0.05 * stabG, 0.01);
    }
  }

  setVolume(v: number): void {
    this.out.gain.setTargetAtTime(v, this.synth.ctx.currentTime, 0.1);
  }
}
