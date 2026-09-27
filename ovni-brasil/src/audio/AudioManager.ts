import { MusicSystem, type MusicState } from './MusicSystem';
import { midiToFreq, Synth } from './Synth';

/** Pentatonic ladder for the abduction combo: each capture climbs a note. */
const PENTA = [0, 2, 4, 7, 9];

type Loop = { gain: GainNode; stop: () => void };

/**
 * Audio architecture: master → compressor → out, with music / sfx / ui buses.
 * Every sound is synthesized (no files), so the game loads instantly and there are no
 * missing assets. Placeholders by design, but tuned to feel good.
 */
export class AudioManager {
  ctx: AudioContext | null = null;
  private synth!: Synth;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private uiBus!: GainNode;
  music: MusicSystem | null = null;
  private beam: { gain: GainNode; osc1: OscillatorNode; osc2: OscillatorNode; filter: BiquadFilterNode; noiseGain: GainNode } | null = null;
  private strain: { gain: GainNode; osc: OscillatorNode; filter: BiquadFilterNode } | null = null;
  private heli: Loop & { lfo: OscillatorNode } | null = null;
  private siren: { gain: GainNode; osc: OscillatorNode; lfo: OscillatorNode } | null = null;
  private volumes = { master: 0.9, music: 0.6, sfx: 0.9 };
  private lastPlay = new Map<string, number>();
  listenerX = 0;
  listenerZ = 0;
  listenerRange = 60;

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture (tap on INVADIR). */
  unlock(): void {
    const activation = (navigator as unknown as { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (activation && !activation.hasBeenActive) return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.synth = new Synth(this.ctx);
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 12;
      comp.ratio.value = 5;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      this.master = this.ctx.createGain();
      this.master.connect(comp).connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.uiBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.uiBus.connect(this.master);
      this.music = new MusicSystem(this.synth, this.musicBus);
      this.applyVolumes();
      this.createLoops();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(master: number, music: number, sfx: number): void {
    this.volumes = { master, music, sfx };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.volumes.music * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
    this.uiBus.gain.setTargetAtTime(this.volumes.sfx * 0.8, t, 0.05);
  }

  setMusic(state: Partial<MusicState>): void {
    this.music?.setState(state);
  }

  private throttle(key: string, seconds: number): boolean {
    if (!this.ctx) return false;
    const now = this.ctx.currentTime;
    const last = this.lastPlay.get(key) ?? -1;
    if (now - last < seconds) return false;
    this.lastPlay.set(key, now);
    return true;
  }

  /** Distance attenuation + stereo pan relative to the camera focus. */
  private spatial(x: number, z: number, range = this.listenerRange): { node: AudioNode; gain: number } | null {
    if (!this.ctx) return null;
    const dx = x - this.listenerX;
    const dz = z - this.listenerZ;
    const d = Math.hypot(dx, dz);
    const gain = Math.max(0, 1 - d / (range * 2.2));
    if (gain <= 0.02) return null;
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, dx / range));
    pan.connect(this.sfxBus);
    return { node: pan, gain };
  }

  private createLoops(): void {
    const ctx = this.ctx as AudioContext;
    // beam hum
    const bg = ctx.createGain();
    bg.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    filter.Q.value = 4;
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 55;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = 110.6;
    const n = ctx.createBufferSource();
    n.buffer = this.synth.pink;
    n.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 900;
    nf.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.value = 0.25;
    o1.connect(filter);
    o2.connect(filter);
    n.connect(nf).connect(ng).connect(filter);
    filter.connect(bg).connect(this.sfxBus);
    o1.start();
    o2.start();
    n.start();
    this.beam = { gain: bg, osc1: o1, osc2: o2, filter, noiseGain: ng };

    // strain rumble
    const sg = ctx.createGain();
    sg.gain.value = 0;
    const so = ctx.createOscillator();
    so.type = 'square';
    so.frequency.value = 38;
    const sf = ctx.createBiquadFilter();
    sf.type = 'lowpass';
    sf.frequency.value = 180;
    const sn = ctx.createBufferSource();
    sn.buffer = this.synth.noise;
    sn.loop = true;
    const snf = ctx.createBiquadFilter();
    snf.type = 'lowpass';
    snf.frequency.value = 260;
    const sng = ctx.createGain();
    sng.gain.value = 0.9;
    so.connect(sf);
    sn.connect(snf).connect(sng).connect(sf);
    sf.connect(sg).connect(this.sfxBus);
    so.start();
    sn.start();
    this.strain = { gain: sg, osc: so, filter: sf };

    // helicopter rotor (amplitude modulated noise)
    const hg = ctx.createGain();
    hg.gain.value = 0;
    const hn = ctx.createBufferSource();
    hn.buffer = this.synth.noise;
    hn.loop = true;
    const hf = ctx.createBiquadFilter();
    hf.type = 'lowpass';
    hf.frequency.value = 420;
    const am = ctx.createGain();
    am.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.5;
    lfo.connect(lfoGain).connect(am.gain);
    hn.connect(hf).connect(am).connect(hg).connect(this.sfxBus);
    hn.start();
    lfo.start();
    this.heli = { gain: hg, lfo, stop: () => undefined };

    // police siren (two-tone wail)
    const zg = ctx.createGain();
    zg.gain.value = 0;
    const zo = ctx.createOscillator();
    zo.type = 'triangle';
    zo.frequency.value = 780;
    const zl = ctx.createOscillator();
    zl.type = 'square';
    zl.frequency.value = 1.6;
    const zlg = ctx.createGain();
    zlg.gain.value = 170;
    zl.connect(zlg).connect(zo.frequency);
    const zf = ctx.createBiquadFilter();
    zf.type = 'bandpass';
    zf.frequency.value = 900;
    zf.Q.value = 0.7;
    zo.connect(zf).connect(zg).connect(this.sfxBus);
    zo.start();
    zl.start();
    this.siren = { gain: zg, osc: zo, lfo: zl };
  }

  /** Continuous beam hum: louder and higher with load and combo. */
  setBeam(active: boolean, load: number, combo: number, frenzy: boolean): void {
    if (!this.ctx || !this.beam) return;
    const t = this.ctx.currentTime;
    const g = active ? 0.05 + Math.min(1, load) * 0.09 : 0;
    this.beam.gain.gain.setTargetAtTime(g, t, 0.08);
    const pitch = 1 + Math.min(1, combo / 60) * 0.5 + (frenzy ? 0.3 : 0);
    this.beam.osc1.frequency.setTargetAtTime(55 * pitch, t, 0.2);
    this.beam.osc2.frequency.setTargetAtTime(110.6 * pitch + load * 20, t, 0.2);
    this.beam.filter.frequency.setTargetAtTime(500 + load * 1400 + combo * 12, t, 0.1);
  }

  setStrain(level: number): void {
    if (!this.ctx || !this.strain) return;
    const t = this.ctx.currentTime;
    this.strain.gain.gain.setTargetAtTime(level * 0.35, t, 0.06);
    this.strain.osc.frequency.setTargetAtTime(32 + level * 18, t, 0.1);
  }

  setHelicopter(nearness: number): void {
    if (!this.ctx || !this.heli) return;
    this.heli.gain.gain.setTargetAtTime(Math.min(0.5, nearness * 0.5), this.ctx.currentTime, 0.2);
  }

  setSiren(nearness: number): void {
    if (!this.ctx || !this.siren) return;
    this.siren.gain.gain.setTargetAtTime(Math.min(0.08, nearness * 0.08), this.ctx.currentTime, 0.3);
  }

  // ───────────────────────────────────────────── one-shots

  abductPop(tier: number, combo: number, rare: boolean, x: number, z: number): void {
    if (!this.ctx) return;
    if (!this.throttle('pop', 0.035)) return;
    const s = this.synth;
    const t = this.ctx.currentTime;
    const out = this.sfxBus;
    const deg = combo % 15;
    const octave = Math.floor(deg / 5);
    const note = 72 + PENTA[deg % 5]! + octave * 12 - Math.min(12, tier * 2);
    const f = midiToFreq(note);
    s.osc('sine', f * 0.5, t, 0.16, out, 0.2, 0.002, f);
    s.osc('triangle', f, t + 0.01, 0.22, out, 0.12, 0.003);
    s.osc('sine', f * 2, t + 0.02, 0.12, out, 0.04, 0.002);
    if (tier >= 3) {
      s.osc('sine', 90, t, 0.3 + tier * 0.04, out, 0.25 + tier * 0.03, 0.003, 38);
      s.noiseBurst(t, 0.25, out, 0.08, 'bandpass', 400, 2400, 1.2);
    }
    if (tier >= 6) {
      s.osc('sawtooth', 55, t, 0.8, out, 0.12, 0.01, 30);
      s.noiseBurst(t, 0.9, out, 0.12, 'lowpass', 900, 120, 0.7);
    }
    if (rare) {
      for (let i = 0; i < 4; i++) s.osc('sine', midiToFreq(note + 12 + [0, 4, 7, 12][i]!), t + 0.05 + i * 0.05, 0.3, out, 0.05, 0.002);
    }
    void x;
    void z;
  }

  liftStart(tier: number): void {
    if (!this.ctx || !this.throttle('lift', 0.06)) return;
    const t = this.ctx.currentTime;
    const dur = 0.35 + tier * 0.08;
    this.synth.noiseBurst(t, dur, this.sfxBus, 0.05 + tier * 0.012, 'bandpass', 250 + (6 - Math.min(6, tier)) * 60, 2200, 1.5, true, 0.05);
    if (tier >= 4) this.synth.osc('sawtooth', 50, t, dur + 0.3, this.sfxBus, 0.05, 0.1, 90);
  }

  levelUp(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [62, 66, 69, 74, 78];
    notes.forEach((m, i) => this.synth.osc('square', midiToFreq(m), t + i * 0.06, 0.25, this.uiBus, 0.05, 0.003));
    notes.forEach((m, i) => this.synth.osc('sine', midiToFreq(m + 12), t + i * 0.06, 0.5, this.uiBus, 0.06, 0.003));
    this.synth.noiseBurst(t, 0.8, this.uiBus, 0.05, 'highpass', 3000, 9000, 0.5, false, 0.2);
    this.synth.osc('sawtooth', 110, t, 0.9, this.uiBus, 0.05, 0.05, 440);
  }

  tierUp(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const m of [38, 45, 50, 57]) this.synth.osc('sawtooth', midiToFreq(m), t, 1.6, this.sfxBus, 0.07, 0.04);
    this.synth.osc('sine', 55, t, 1.4, this.sfxBus, 0.35, 0.01, 30);
    this.synth.noiseBurst(t, 1.2, this.sfxBus, 0.1, 'lowpass', 2000, 100, 0.7);
  }

  ui(kind: 'tap' | 'hover' | 'pick' | 'back' | 'buy' | 'deny'): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.synth;
    if (kind === 'tap') s.osc('sine', 880, t, 0.05, this.uiBus, 0.08, 0.001, 1200);
    else if (kind === 'hover') s.osc('sine', 1400, t, 0.03, this.uiBus, 0.03, 0.001);
    else if (kind === 'back') s.osc('sine', 700, t, 0.06, this.uiBus, 0.07, 0.001, 450);
    else if (kind === 'deny') {
      s.osc('square', 180, t, 0.12, this.uiBus, 0.06, 0.001);
      s.osc('square', 150, t + 0.1, 0.14, this.uiBus, 0.06, 0.001);
    } else if (kind === 'buy') {
      [72, 76, 79, 84].forEach((m, i) => s.osc('triangle', midiToFreq(m), t + i * 0.05, 0.25, this.uiBus, 0.08, 0.002));
    } else {
      s.osc('triangle', midiToFreq(76), t, 0.2, this.uiBus, 0.09, 0.002);
      s.osc('triangle', midiToFreq(83), t + 0.07, 0.3, this.uiBus, 0.09, 0.002);
    }
  }

  comboMilestone(combo: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = 62 + Math.min(12, Math.floor(combo / 10) * 2);
    for (const m of [0, 4, 7, 11]) this.synth.osc('sawtooth', midiToFreq(base + m), t, 0.35, this.sfxBus, 0.03, 0.005);
    this.synth.osc('sine', midiToFreq(base + 24), t, 0.4, this.sfxBus, 0.05, 0.002);
  }

  frenzy(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.synth.osc('sawtooth', 110, t, 0.7, this.sfxBus, 0.12, 0.3, 880);
    this.synth.noiseBurst(t, 0.7, this.sfxBus, 0.08, 'bandpass', 400, 6000, 1, false, 0.5);
    this.synth.osc('sine', 60, t + 0.7, 0.8, this.sfxBus, 0.5, 0.005, 30);
    this.synth.noiseBurst(t + 0.7, 0.5, this.sfxBus, 0.2, 'lowpass', 3000, 200, 0.7);
  }

  discovery(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [79, 83, 86, 91, 95].forEach((m, i) => {
      this.synth.osc('sine', midiToFreq(m), t + i * 0.07, 0.6, this.uiBus, 0.06, 0.002);
      this.synth.osc('sine', midiToFreq(m) * 2.01, t + i * 0.07, 0.3, this.uiBus, 0.02, 0.002);
    });
  }

  explosion(size: number, x: number, z: number): void {
    if (!this.ctx) return;
    if (!this.throttle('boom', 0.05)) return;
    const sp = this.spatial(x, z, 70 + size * 10);
    if (!sp) return;
    const t = this.ctx.currentTime;
    const g = sp.gain * Math.min(1.2, 0.4 + size * 0.15);
    this.synth.noiseBurst(t, 0.6 + size * 0.1, sp.node, 0.5 * g, 'lowpass', 1800, 90, 0.7);
    this.synth.osc('sine', 70, t, 0.6 + size * 0.1, sp.node, 0.6 * g, 0.003, 28);
    this.synth.noiseBurst(t, 0.12, sp.node, 0.3 * g, 'highpass', 2500, undefined, 0.5);
  }

  missileLaunch(x: number, z: number): void {
    if (!this.ctx) return;
    const sp = this.spatial(x, z, 90);
    if (!sp) return;
    const t = this.ctx.currentTime;
    this.synth.noiseBurst(t, 0.9, sp.node, 0.25 * sp.gain, 'bandpass', 600, 2500, 0.8, false, 0.02);
    this.synth.osc('sawtooth', 200, t, 0.6, sp.node, 0.05 * sp.gain, 0.02, 90);
  }

  lockBeep(urgent: boolean): void {
    if (!this.ctx || !this.throttle('lock', urgent ? 0.09 : 0.18)) return;
    const t = this.ctx.currentTime;
    this.synth.osc('square', urgent ? 1760 : 1320, t, 0.05, this.uiBus, 0.05, 0.001);
  }

  jetFlyby(fromLeft: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const pan = this.ctx.createStereoPanner();
    pan.pan.setValueAtTime(fromLeft ? -1 : 1, t);
    pan.pan.linearRampToValueAtTime(fromLeft ? 1 : -1, t + 2.2);
    pan.connect(this.sfxBus);
    const src = this.ctx.createBufferSource();
    src.buffer = this.synth.pink;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.9;
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(350, t + 2.4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 1.0);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    src.connect(f).connect(g).connect(pan);
    src.start(t);
    src.stop(t + 2.7);
    this.synth.osc('sawtooth', 160, t + 0.8, 1.2, pan, 0.06, 0.2, 60);
  }

  distantRumble(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.synth.noiseBurst(t, 2.2, this.sfxBus, 0.18, 'lowpass', 300, 120, 0.7, true, 0.9);
  }

  radio(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) this.synth.noiseBurst(t + i * 0.13 + Math.random() * 0.05, 0.08, this.uiBus, 0.07, 'bandpass', 1800, undefined, 2);
    this.synth.osc('sine', 1000, t, 0.12, this.uiBus, 0.05, 0.002);
    this.synth.osc('sine', 1000, t + 0.75, 0.08, this.uiBus, 0.04, 0.002);
  }

  staticBurst(duration: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.synth.noiseBurst(t, duration, this.uiBus, 0.06, 'bandpass', 2500, 1500, 0.6, false, 0.05);
  }

  shieldHit(): void {
    if (!this.ctx || !this.throttle('shield', 0.05)) return;
    const t = this.ctx.currentTime;
    this.synth.osc('sine', 700, t, 0.18, this.sfxBus, 0.12, 0.002, 320);
    this.synth.osc('triangle', 1400, t, 0.1, this.sfxBus, 0.05, 0.002, 900);
    this.synth.noiseBurst(t, 0.06, this.sfxBus, 0.08, 'highpass', 4000);
  }

  shieldBreak(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 7; i++) this.synth.osc('sine', 2400 - i * 250, t + i * 0.025, 0.4, this.sfxBus, 0.05, 0.002, 400);
    this.synth.noiseBurst(t, 0.5, this.sfxBus, 0.25, 'highpass', 2000, 500, 0.7);
    this.synth.osc('sine', 80, t, 0.5, this.sfxBus, 0.4, 0.002, 30);
  }

  damage(): void {
    if (!this.ctx || !this.throttle('dmg', 0.06)) return;
    const t = this.ctx.currentTime;
    this.synth.osc('square', 130, t, 0.14, this.sfxBus, 0.12, 0.001, 70);
    this.synth.noiseBurst(t, 0.15, this.sfxBus, 0.18, 'lowpass', 2200, 300, 0.8);
  }

  empCharge(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.synth.osc('sawtooth', 90, t, 0.35, this.sfxBus, 0.1, 0.3, 1100);
  }

  empBlast(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.synth.osc('sine', 120, t, 0.9, this.sfxBus, 0.6, 0.002, 25);
    this.synth.noiseBurst(t, 0.5, this.sfxBus, 0.25, 'highpass', 5000, 800, 0.6);
    for (let i = 0; i < 10; i++) this.synth.noiseBurst(t + 0.05 + Math.random() * 0.8, 0.02, this.sfxBus, 0.1, 'bandpass', 3000 + Math.random() * 3000, undefined, 4);
  }

  dash(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.synth.noiseBurst(t, 0.3, this.sfxBus, 0.18, 'bandpass', 500, 3500, 1.2, true, 0.01);
    this.synth.osc('sine', 300, t, 0.25, this.sfxBus, 0.08, 0.005, 900);
  }

  perfectDodge(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.synth.osc('triangle', midiToFreq(84), t, 0.3, this.uiBus, 0.1, 0.002);
    this.synth.osc('triangle', midiToFreq(91), t + 0.08, 0.4, this.uiBus, 0.1, 0.002);
  }

  alertUp(level: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      this.synth.osc('square', 520 + level * 20, t + i * 0.32, 0.22, this.uiBus, 0.06, 0.01);
      this.synth.osc('square', 390 + level * 20, t + i * 0.32 + 0.16, 0.14, this.uiBus, 0.06, 0.01);
    }
  }

  honk(x: number, z: number): void {
    if (!this.ctx || !this.throttle('honk', 0.4)) return;
    const sp = this.spatial(x, z, 40);
    if (!sp) return;
    const t = this.ctx.currentTime;
    this.synth.osc('square', 392, t, 0.28, sp.node, 0.05 * sp.gain, 0.01);
    this.synth.osc('square', 494, t, 0.28, sp.node, 0.04 * sp.gain, 0.01);
  }

  carAlarm(x: number, z: number): void {
    if (!this.ctx || !this.throttle('alarm', 1.2)) return;
    const sp = this.spatial(x, z, 40);
    if (!sp) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) this.synth.osc('square', i % 2 ? 1100 : 1500, t + i * 0.12, 0.1, sp.node, 0.035 * sp.gain, 0.005);
  }

  animal(kind: 'bark' | 'moo' | 'cluck' | 'panic', x: number, z: number): void {
    if (!this.ctx || !this.throttle(kind, kind === 'panic' ? 0.5 : 0.35)) return;
    const sp = this.spatial(x, z, 35);
    if (!sp) return;
    const t = this.ctx.currentTime;
    if (kind === 'bark') {
      for (let i = 0; i < 2; i++) {
        this.synth.noiseBurst(t + i * 0.18, 0.08, sp.node, 0.18 * sp.gain, 'bandpass', 900, 500, 3);
        this.synth.osc('sawtooth', 380, t + i * 0.18, 0.08, sp.node, 0.05 * sp.gain, 0.002, 250);
      }
    } else if (kind === 'moo') {
      const o = this.synth.osc('sawtooth', 150, t, 0.9, sp.node, 0.08 * sp.gain, 0.15, 105);
      o.detune.setValueAtTime(0, t);
    } else if (kind === 'cluck') {
      for (let i = 0; i < 3; i++) this.synth.osc('square', 900 + Math.random() * 300, t + i * 0.09, 0.04, sp.node, 0.03 * sp.gain, 0.001, 600);
    } else {
      // distant "ôôô!" crowd murmur: filtered noise swell
      this.synth.noiseBurst(t, 0.5, sp.node, 0.04 * sp.gain, 'bandpass', 700, 1100, 3, true, 0.1);
    }
  }

  gunshot(x: number, z: number, heavy: boolean): void {
    if (!this.ctx || !this.throttle('gun', 0.045)) return;
    const sp = this.spatial(x, z, 60);
    if (!sp) return;
    const t = this.ctx.currentTime;
    this.synth.noiseBurst(t, heavy ? 0.1 : 0.06, sp.node, (heavy ? 0.14 : 0.08) * sp.gain, 'bandpass', heavy ? 900 : 1600, 400, 0.8);
  }

  extraction(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const m of [62, 69, 74, 78, 81]) this.synth.osc('sine', midiToFreq(m), t, 2.6, this.sfxBus, 0.06, 0.8);
    this.synth.osc('sawtooth', 80, t, 2.4, this.sfxBus, 0.06, 1.2, 640);
    this.synth.noiseBurst(t, 2.5, this.sfxBus, 0.08, 'highpass', 1000, 8000, 0.6, false, 1.5);
  }

  crash(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.synth.osc('sawtooth', 300, t, 1.4, this.sfxBus, 0.12, 0.01, 40);
    this.synth.noiseBurst(t + 1.2, 1.4, this.sfxBus, 0.5, 'lowpass', 2000, 60, 0.7);
    this.synth.osc('sine', 60, t + 1.2, 1.5, this.sfxBus, 0.7, 0.002, 20);
  }

  bossWarning(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      this.synth.osc('sawtooth', 220, t + i * 0.6, 0.45, this.uiBus, 0.07, 0.05, 180);
      this.synth.osc('sawtooth', 233, t + i * 0.6, 0.45, this.uiBus, 0.05, 0.05, 190);
    }
  }
}
