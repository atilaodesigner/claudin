// Áudio 100% sintetizado: ronco de V8, pneu cantando, vento, nitro,
// batida, buzina, e efeitos de pontuação. A música fica em radio.ts.

export class AudioSystem {
  ctx: AudioContext | null = null;
  master!: GainNode;
  carBus!: GainNode;
  musicBus!: GainNode;
  private noise!: AudioBuffer;
  private shaper!: WaveShaperNode;

  // motor
  private eOsc: OscillatorNode[] = [];
  private eFilter!: BiquadFilterNode;
  private eGain!: GainNode;
  private lope!: OscillatorNode;
  private lopeGain!: GainNode;
  // pneu, vento, nitro
  private tireGain!: GainNode;
  private tireFilter!: BiquadFilterNode;
  private tireFilter2!: BiquadFilterNode;
  private windGain!: GainNode;
  private nitroGain!: GainNode;

  carVolume = 0.8;
  musicVolume = 0.7;
  muted = false;

  start(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(comp).connect(ctx.destination);
    this.carBus = ctx.createGain();
    this.carBus.gain.value = this.carVolume;
    this.carBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVolume;
    this.musicBus.connect(this.master);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 3.2);
    }
    this.shaper.curve = curve;

    // ---------- motor V8 ----------
    this.eFilter = ctx.createBiquadFilter();
    this.eFilter.type = 'lowpass';
    this.eFilter.frequency.value = 600;
    this.eFilter.Q.value = 2.5;
    this.eGain = ctx.createGain();
    this.eGain.gain.value = 0;
    const pre = ctx.createGain();
    pre.gain.value = 0.35;
    pre.connect(this.shaper).connect(this.eFilter).connect(this.eGain).connect(this.carBus);
    const types: OscillatorType[] = ['sawtooth', 'square', 'sawtooth'];
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = types[i]!;
      const g = ctx.createGain();
      g.gain.value = [0.5, 0.45, 0.2][i]!;
      o.connect(g).connect(pre);
      o.start();
      this.eOsc.push(o);
    }
    // "lope" do V8 (a batida irregular em marcha lenta)
    this.lope = ctx.createOscillator();
    this.lope.type = 'sine';
    this.lopeGain = ctx.createGain();
    this.lopeGain.gain.value = 0.3;
    this.lope.connect(this.lopeGain).connect(pre.gain);
    this.lope.start();

    // ---------- pneu ----------
    const tireSrc = this.loopNoise();
    this.tireFilter = ctx.createBiquadFilter();
    this.tireFilter.type = 'bandpass';
    this.tireFilter.frequency.value = 900;
    this.tireFilter.Q.value = 6;
    this.tireFilter2 = ctx.createBiquadFilter();
    this.tireFilter2.type = 'bandpass';
    this.tireFilter2.frequency.value = 1900;
    this.tireFilter2.Q.value = 9;
    this.tireGain = ctx.createGain();
    this.tireGain.gain.value = 0;
    tireSrc.connect(this.tireFilter).connect(this.tireGain);
    tireSrc.connect(this.tireFilter2).connect(this.tireGain);
    this.tireGain.connect(this.carBus);

    // ---------- vento ----------
    const windSrc = this.loopNoise();
    const wf = ctx.createBiquadFilter();
    wf.type = 'lowpass';
    wf.frequency.value = 420;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    windSrc.connect(wf).connect(this.windGain).connect(this.carBus);

    // ---------- nitro ----------
    const nSrc = this.loopNoise();
    const nf = ctx.createBiquadFilter();
    nf.type = 'highpass';
    nf.frequency.value = 1400;
    this.nitroGain = ctx.createGain();
    this.nitroGain.gain.value = 0;
    nSrc.connect(nf).connect(this.nitroGain).connect(this.carBus);
  }

  private loopNoise(): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start(0, Math.random() * 1.5);
    return s;
  }

  setVolumes(car: number, music: number): void {
    this.carVolume = car;
    this.musicVolume = music;
    if (!this.ctx) return;
    this.carBus.gain.setTargetAtTime(car, this.ctx.currentTime, 0.05);
    this.musicBus.gain.setTargetAtTime(music, this.ctx.currentTime, 0.05);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  updateCar(rpm: number, throttle: number, rearSlip: number, speed: number, nitro: boolean, surfaceDirt: boolean, paused: boolean): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const k = 0.04;
    if (paused) {
      this.eGain.gain.setTargetAtTime(0, t, 0.1);
      this.tireGain.gain.setTargetAtTime(0, t, 0.1);
      this.windGain.gain.setTargetAtTime(0, t, 0.1);
      this.nitroGain.gain.setTargetAtTime(0, t, 0.1);
      return;
    }
    const fire = (rpm / 60) * 4; // disparos por segundo num V8
    this.eOsc[0]!.frequency.setTargetAtTime(fire * 0.5, t, k);
    this.eOsc[1]!.frequency.setTargetAtTime(fire * 0.25, t, k);
    this.eOsc[2]!.frequency.setTargetAtTime(fire * 1.003, t, k);
    this.lope.frequency.setTargetAtTime(fire * 0.125 + Math.random() * 2, t, k);
    this.lopeGain.gain.setTargetAtTime(Math.max(0.03, 0.35 - rpm / 9000), t, 0.2);
    this.eFilter.frequency.setTargetAtTime(260 + throttle * 1500 + rpm * 0.28, t, k);
    this.eGain.gain.setTargetAtTime(0.16 + throttle * 0.24 + (rpm / 7400) * 0.08, t, k);

    const tire = surfaceDirt ? rearSlip * 0.08 : rearSlip * rearSlip * 0.34 * Math.min(1, speed / 6);
    this.tireGain.gain.setTargetAtTime(tire, t, 0.05);
    this.tireFilter.frequency.setTargetAtTime(700 + speed * 6 + Math.sin(t * 13) * 60, t, 0.05);
    this.tireFilter2.frequency.setTargetAtTime(1700 + speed * 8, t, 0.05);
    this.windGain.gain.setTargetAtTime(Math.min(0.35, (speed / 70) ** 2 * 0.35) + (surfaceDirt ? Math.min(0.2, speed / 100) : 0), t, 0.1);
    this.nitroGain.gain.setTargetAtTime(nitro ? 0.2 : 0, t, 0.06);
  }

  // ---------- efeitos ----------
  private env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  crash(strength: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1800;
    const g = ctx.createGain();
    this.env(g, t, Math.min(1, 0.3 + strength * 0.05), 0.005, 0.35);
    n.connect(f).connect(g).connect(this.carBus);
    n.start(t, Math.random());
    n.stop(t + 0.5);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.25);
    const g2 = ctx.createGain();
    this.env(g2, t, 0.7, 0.005, 0.3);
    o.connect(g2).connect(this.carBus);
    o.start(t);
    o.stop(t + 0.4);
  }

  blip(freqs: number[], dur = 0.08, type: OscillatorType = 'square', vol = 0.12): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    freqs.forEach((fq, i) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = fq;
      const g = ctx.createGain();
      const t = t0 + i * dur;
      this.env(g, t, vol, 0.005, dur * 1.6);
      o.connect(g).connect(this.carBus);
      o.start(t);
      o.stop(t + dur * 2);
    });
  }

  pickup(): void {
    this.blip([660, 880, 1320, 1760], 0.06, 'square', 0.1);
  }

  bank(big: boolean): void {
    this.blip(big ? [523, 659, 784, 1047] : [784, 1047], 0.07, 'triangle', 0.18);
  }

  lost(): void {
    this.blip([392, 311, 233], 0.12, 'sawtooth', 0.1);
  }

  mult(): void {
    this.blip([1200, 1600], 0.04, 'square', 0.06);
  }

  countdown(go: boolean): void {
    this.blip(go ? [1320] : [660], go ? 0.35 : 0.18, 'square', 0.14);
  }

  nearMiss(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(3000, t + 0.25);
    const g = ctx.createGain();
    this.env(g, t, 0.35, 0.03, 0.3);
    n.connect(f).connect(g).connect(this.carBus);
    n.start(t, Math.random());
    n.stop(t + 0.4);
  }

  horn(pan: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
    g.gain.setValueAtTime(0.08, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1500;
    for (const fq of [392, 494]) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = fq;
      o.connect(f);
      o.start(t);
      o.stop(t + 0.5);
    }
    f.connect(g).connect(p).connect(this.carBus);
  }

  static(): void {
    // chiado de trocar de estação
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2500;
    f.Q.value = 0.7;
    const g = ctx.createGain();
    this.env(g, t, 0.12, 0.01, 0.3);
    n.connect(f).connect(g).connect(this.musicBus);
    n.start(t, Math.random());
    n.stop(t + 0.4);
  }
}
