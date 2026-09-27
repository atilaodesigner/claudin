/** Small helpers to build procedural sounds with the WebAudio API. */
export class Synth {
  readonly noise: AudioBuffer;
  readonly pink: AudioBuffer;

  constructor(readonly ctx: AudioContext) {
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.pink = ctx.createBuffer(1, len, ctx.sampleRate);
    const p = this.pink.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      p[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
  }

  env(g: GainNode, t: number, attack: number, peak: number, decay: number, sustain = 0): void {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + attack + decay);
  }

  osc(type: OscillatorType, freq: number, t: number, dur: number, out: AudioNode, gain: number, attack = 0.005, freqEnd?: number, detune = 0): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
    o.detune.value = detune;
    const g = this.ctx.createGain();
    this.env(g, t, attack, gain, dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
    return o;
  }

  noiseBurst(t: number, dur: number, out: AudioNode, gain: number, filter: BiquadFilterType, f0: number, f1?: number, q = 1, pink = false, attack = 0.003): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = pink ? this.pink : this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, t, attack, gain, dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + dur + 0.05);
    return src;
  }
}

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}
