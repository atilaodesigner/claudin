/*
 * ABDUZIU gameplay clips — sound (Web Audio / OfflineAudioContext).
 * A groove per clip + the game's sounds placed on the exact frames the director logged:
 * a pop per abduction (pitch climbs with the combo), level-up chimes, explosions, EMP
 * blasts, arena swallows, the dive through the atmosphere, the saucer's hum.
 *
 *   const wav = await renderGameplayAudio('arena', events, 15);   // ArrayBuffer (WAV)
 */
async function renderGameplayAudio(clip, events, LEN) {
  const SR = 48000;
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * LEN), SR);

  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.gain.setValueAtTime(0.5, LEN - 0.6);
  master.gain.linearRampToValueAtTime(0, LEN - 0.02);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3.5;
  const trim = ctx.createGain();
  trim.gain.value = 0.55;
  const soft = ctx.createWaveShaper();
  const sc = new Float32Array(2048);
  for (let i = 0; i < 2048; i++) sc[i] = Math.tanh(((i / 2047) * 2 - 1) * 1.4) / Math.tanh(1.4);
  soft.curve = sc;
  master.connect(comp).connect(trim).connect(soft).connect(ctx.destination);

  const irLen = SR * 1.8;
  const ir = ctx.createBuffer(2, irLen, SR);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2);
  }
  const verb = ctx.createConvolver();
  verb.buffer = ir;
  const verbIn = ctx.createGain();
  verbIn.gain.value = 0.35;
  verbIn.connect(verb).connect(master);

  const noiseBuf = ctx.createBuffer(1, SR * 2, SR);
  {
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const noise = (t, dur) => {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
    return s;
  };
  const env = (g, t, a, peak, d) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  };
  const out = (node, gain = 1, rev = 0, pan = 0) => {
    const g = ctx.createGain();
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    node.connect(g).connect(p).connect(master);
    if (rev) {
      const r = ctx.createGain();
      r.gain.value = rev;
      p.connect(r).connect(verbIn);
    }
    return g;
  };
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const osc = (type, f, t, dur) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  };

  // ─── instruments
  function kick(t, v = 1) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    const g = ctx.createGain();
    env(g, t, 0.002, 0.95 * v, 0.28);
    o.connect(g);
    out(g, 0.9);
    o.start(t);
    o.stop(t + 0.35);
  }
  function snare(t, v = 1) {
    const n = noise(t, 0.18);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2000;
    const g = ctx.createGain();
    env(g, t, 0.001, 0.42 * v, 0.14);
    n.connect(bp).connect(g);
    out(g, 0.6, 0.22);
    const o = osc('triangle', 190, t, 0.1);
    const og = ctx.createGain();
    env(og, t, 0.001, 0.25 * v, 0.08);
    o.connect(og);
    out(og, 0.6);
  }
  function hat(t, v = 1, open = false) {
    const n = noise(t, open ? 0.2 : 0.05);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    const g = ctx.createGain();
    env(g, t, 0.002, 0.13 * v, open ? 0.18 : 0.035);
    n.connect(hp).connect(g);
    out(g, 0.6, 0, 0.25);
  }
  function bass(t, note, dur, v = 1) {
    const o = osc('sawtooth', midi(note), t, dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + dur);
    const g = ctx.createGain();
    env(g, t, 0.004, 0.42 * v, dur);
    o.connect(lp).connect(g);
    out(g, 0.8);
    const s = osc('sine', midi(note - 12), t, dur);
    const sg = ctx.createGain();
    env(sg, t, 0.004, 0.5 * v, dur);
    s.connect(sg);
    out(sg, 0.8);
  }
  function pluck(t, note, v = 1, pan = 0) {
    const f = midi(note);
    for (const [mul, amp, dec] of [[1, 1, 0.3], [2, 0.35, 0.12], [4, 0.12, 0.05]]) {
      const o = osc('sine', f * mul, t, dec);
      const g = ctx.createGain();
      env(g, t, 0.002, 0.16 * v * amp, dec);
      o.connect(g);
      out(g, 1, 0.3, pan);
    }
  }
  function pad(t, notes, dur, v = 1) {
    for (const n of notes) {
      for (const det of [-6, 6]) {
        const o = osc('sawtooth', midi(n), t, dur);
        o.detune.value = det;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1400;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.035 * v, t + Math.min(0.8, dur * 0.3));
        g.gain.setValueAtTime(0.035 * v, t + dur * 0.75);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(lp).connect(g);
        out(g, 1, 0.5, det > 0 ? 0.3 : -0.3);
      }
    }
  }
  /** The abduction pop: a bubbly upward blip; heavy objects add a thump. */
  function pop(t, note, big, v = 1) {
    const f = midi(note);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f * 0.55, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.035);
    const g = ctx.createGain();
    env(g, t, 0.003, 0.2 * v, big ? 0.22 : 0.1);
    o.connect(g);
    out(g, 1, 0.18, (Math.random() - 0.5) * 0.6);
    o.start(t);
    o.stop(t + 0.3);
    if (big) {
      const s = ctx.createOscillator();
      s.frequency.setValueAtTime(170, t);
      s.frequency.exponentialRampToValueAtTime(45, t + 0.2);
      const sg = ctx.createGain();
      env(sg, t, 0.003, 0.4 * v, 0.22);
      s.connect(sg);
      out(sg, 0.8);
      s.start(t);
      s.stop(t + 0.3);
    }
  }
  function chime(t) {
    [72, 76, 79, 84].forEach((n, i) => pluck(t + i * 0.05, n + 12, 1.2, i % 2 ? 0.3 : -0.3));
  }
  function whoosh(t, dur, f0 = 400, f1 = 5000, v = 0.3) {
    const n = noise(t, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + dur * 0.85);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(g);
    out(g, 0.9, 0.2);
  }
  function boom(t, v = 1) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.8);
    const g = ctx.createGain();
    env(g, t, 0.003, 0.9 * v, 0.9);
    o.connect(g);
    out(g, 0.85, 0.25);
    o.start(t);
    o.stop(t + 1);
    const n = noise(t, 0.6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(200, t + 0.6);
    const ng = ctx.createGain();
    env(ng, t, 0.002, 0.5 * v, 0.55);
    n.connect(lp).connect(ng);
    out(ng, 0.7, 0.3, (Math.random() - 0.5) * 0.8);
  }
  function emp(t) {
    // charge, zap, thunder
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t - 0.35);
    o.frequency.exponentialRampToValueAtTime(1800, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t - 0.35);
    g.gain.exponentialRampToValueAtTime(0.18, t - 0.02);
    g.gain.linearRampToValueAtTime(0.0001, t);
    o.connect(g);
    out(g, 0.8, 0.3);
    o.start(t - 0.35);
    o.stop(t + 0.05);
    const z = ctx.createOscillator();
    z.type = 'square';
    z.frequency.setValueAtTime(2400, t);
    z.frequency.exponentialRampToValueAtTime(60, t + 0.5);
    const zg = ctx.createGain();
    env(zg, t, 0.002, 0.3, 0.5);
    z.connect(zg);
    out(zg, 0.6, 0.4);
    z.start(t);
    z.stop(t + 0.6);
    boom(t, 1.3);
  }
  function gulp(t) {
    // arena swallow: a deep "vwoom" + sparkle
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.35);
    const g = ctx.createGain();
    env(g, t, 0.004, 0.8, 0.4);
    o.connect(g);
    out(g, 0.9, 0.2);
    o.start(t);
    o.stop(t + 0.5);
    [84, 88, 91, 96].forEach((n, i) => pluck(t + 0.08 + i * 0.045, n, 1.1, i % 2 ? 0.35 : -0.35));
  }
  /** Continuous saucer hum (theremin-ish), optional pitch rise. */
  function hum(t0, t1, f0 = 110, f1 = 110, v = 0.05) {
    const o = osc('sawtooth', f0, t0, t1 - t0);
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.linearRampToValueAtTime(f1, t1);
    const lfo = osc('sine', 5.5, t0, t1 - t0);
    const lg = ctx.createGain();
    lg.gain.value = 4;
    lfo.connect(lg).connect(o.detune);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.4);
    g.gain.setValueAtTime(v, t1 - 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t1);
    o.connect(lp).connect(g);
    out(g, 1, 0.2);
  }
  function siren(t0, t1, v = 0.05) {
    const o = osc('triangle', 700, t0, t1 - t0);
    for (let t = t0; t < t1; t += 1.2) {
      o.frequency.setValueAtTime(620, t);
      o.frequency.linearRampToValueAtTime(980, t + 0.6);
      o.frequency.linearRampToValueAtTime(620, t + 1.2);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.5);
    g.gain.setValueAtTime(v, t1 - 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t1);
    o.connect(g);
    out(g, 1, 0.4, 0.4);
  }
  function rotor(t0, t1, v = 0.12) {
    // helicopter chop
    for (let t = t0; t < t1; t += 0.085) {
      const n = noise(t, 0.05);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 500;
      const g = ctx.createGain();
      env(g, t, 0.003, v * (0.6 + 0.4 * Math.sin(t * 0.7)), 0.05);
      n.connect(lp).connect(g);
      out(g, 0.9, 0, -0.3);
    }
  }

  // ─── groove helper: 4-on-the-floor funk with a chord loop
  function groove(t0, t1, bpm, chords, opts = {}) {
    const beat = 60 / bpm;
    const bar = beat * 4;
    for (let b = 0; t0 + b * bar < t1 - 0.01; b++) {
      const tb = t0 + b * bar;
      const ch = chords[b % chords.length];
      for (let i = 0; i < 4; i++) {
        const t = tb + i * beat;
        if (t >= t1) break;
        kick(t, opts.soft && b === 0 ? 0.6 : 1);
        if (i % 2 === 1) snare(t, 0.9);
        hat(t + beat / 2, 1, i === 3);
        hat(t + beat / 4, 0.5);
        hat(t + (beat * 3) / 4, 0.5);
        if (opts.arp !== false) pluck(t + beat / 2, ch[i % 3] + 12, 0.65, i % 2 ? 0.3 : -0.3);
      }
      // funk bass: root, octave hop, fifth
      const r = ch[0] - 24;
      bass(tb, r, beat * 0.9);
      bass(tb + beat * 1.5, r + 12, beat * 0.35, 0.8);
      bass(tb + beat * 2, r, beat * 0.6);
      bass(tb + beat * 3, r + 7, beat * 0.45, 0.9);
      bass(tb + beat * 3.5, r + 10, beat * 0.4, 0.8);
      if (opts.pad) pad(tb, ch, bar, 0.8);
    }
  }
  const MAJOR = [[60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74]];
  const MINOR = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]];
  const HEROIC = [[62, 66, 69], [59, 62, 66], [67, 71, 74], [69, 73, 76]];

  // ─── clip scores
  const ev = (k) => events.filter((e) => e.k === k).sort((a, b) => a.t - b.t);
  const dive = ev('dive')[0]?.t ?? null;
  if (clip === 'espaco') {
    // space: wide pad + twinkles, then the dive, then the beach groove
    pad(0, [48, 55, 60, 64], dive ?? 3, 1.2);
    for (let t = 0.2; t < (dive ?? 3); t += 0.37) pluck(t, [84, 88, 91, 95, 91][Math.floor(t * 3) % 5], 0.4, Math.sin(t * 3) * 0.6);
    hum(0, LEN, 98, 98, 0.035);
    if (dive !== null) {
      const hit = dive + 3.4; // DIVE_TIME: the white-out
      whoosh(dive, 3.4, 150, 3000, 0.35);
      // re-entry rumble
      const n = noise(dive + 1.4, 2.2);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 260;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, dive + 1.4);
      g.gain.exponentialRampToValueAtTime(0.6, hit);
      g.gain.linearRampToValueAtTime(0.0001, hit + 0.05);
      n.connect(lp).connect(g);
      out(g, 1);
      boom(hit, 1.2);
      // through the clouds: soft wind, then the groove lands with the beach
      whoosh(hit, 2.6, 3000, 300, 0.12);
      const land = hit + 3.2;
      pad(hit, [57, 60, 64, 67], 3.3, 0.9);
      groove(land - 60 / 118, LEN, 118, MAJOR, { soft: true });
    }
  } else if (clip === 'gigante') {
    groove(0, LEN, 122, HEROIC, { pad: true });
    hum(0, LEN, 90, 55, 0.05); // the saucer's voice drops as it grows
    for (const t of [3.5, 7, 10.5]) whoosh(t - 0.5, 0.5, 600, 6000, 0.18);
  } else if (clip === 'frenesi') {
    groove(0, LEN, 128, MINOR, { pad: true });
    hum(0, LEN, 60, 60, 0.07);
    whoosh(0, 1.2, 200, 4000, 0.2);
    // frenzy riser that keeps climbing
    const o = osc('sawtooth', 220, 0, LEN);
    o.frequency.setValueAtTime(220, 0);
    o.frequency.exponentialRampToValueAtTime(880, LEN);
    const lp = ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.value = 0.025;
    o.connect(lp).connect(g);
    out(g, 1, 0.4);
  } else if (clip === 'exercito') {
    groove(0, LEN, 124, MINOR, { arp: false, pad: true });
    siren(0, LEN, 0.035);
    rotor(0, LEN, 0.09);
    hum(0, LEN, 80, 70, 0.045);
    // jets tearing through
    for (const t of [0.8, 3.1, 6.4, 8.8, 12.2]) whoosh(t, 1.1, 300, 2500, 0.22);
  } else if (clip === 'arena') {
    groove(0, LEN, 120, MAJOR, {});
    hum(0, LEN, 100, 70, 0.04);
  }

  // ─── game events
  const SCALE = [0, 2, 4, 7, 9];
  let last = -1;
  let inWindow = 0;
  let windowStart = 0;
  for (const e of ev('pop')) {
    if (e.t - last < 0.03) continue;
    if (e.t - windowStart > 0.1) {
      windowStart = e.t;
      inWindow = 0;
    }
    if (++inWindow > 3) continue;
    last = e.t;
    const step = Math.min(e.combo ?? 1, 30);
    const note = 72 + SCALE[step % 5] + 12 * Math.floor(step / 5) - Math.min(18, (e.tier ?? 0) * 3);
    pop(e.t, Math.min(note, 100), (e.tier ?? 0) >= 3, (e.tier ?? 0) >= 6 ? 1.1 : 0.85);
  }
  let lastChime = -9;
  for (const e of ev('level')) {
    if (e.t - lastChime < 0.35) continue;
    lastChime = e.t;
    chime(e.t);
  }
  let lastBoom = -9;
  for (const e of ev('boom')) {
    if (e.t - lastBoom < 0.12) continue;
    lastBoom = e.t;
    boom(e.t, Math.min(1.2, 0.5 + (e.size ?? 2) * 0.12));
  }
  for (const e of ev('emp')) emp(e.t);
  for (const e of ev('swallow')) gulp(e.t);

  const buf = await ctx.startRendering();
  const n = buf.length;
  const data = new DataView(new ArrayBuffer(44 + n * 4));
  const w = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  data.setUint32(4, 36 + n * 4, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, 2, true);
  data.setUint32(24, SR, true);
  data.setUint32(28, SR * 4, true);
  data.setUint16(32, 4, true);
  data.setUint16(34, 16, true);
  w(36, 'data');
  data.setUint32(40, n * 4, true);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  for (let i = 0; i < n; i++) {
    data.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    data.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
  }
  return data.buffer;
}
if (typeof window !== 'undefined') window.renderGameplayAudio = renderGameplayAudio;
