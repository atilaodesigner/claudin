/*
 * ABDUZIU — 30 s launch trailer (16:9, 60 fps).
 *
 * This file is injected into the running game (the real build of abduziu.fun) and
 * directs it frame by frame: it stops the game's own loop, steps the simulation with a
 * fixed 1/60 s clock, scripts the saucer, the camera and the other ships, and draws the
 * English titles/CTAs on top as plain DOM. Every frame is a pure function of the shot
 * setup + frame index, so the capture is perfectly smooth no matter how slow the
 * machine that renders it is.
 *
 *   await TRAILER.prepare('hook')   // builds the shot (city, size, enemies...)
 *   TRAILER.frame(i)                // advances one frame and paints global frame i
 */
(() => {
  const FPS = 60;
  const DURATION = 30;
  const g = window.__game;

  // ─────────────────────────────────────────────── shots (seconds on the timeline)
  const SHOTS = [
    { id: 'hook', t0: 0, t1: 2 },
    { id: 'descend', t0: 2, t1: 3.5 },
    { id: 'small', t0: 3.5, t1: 7 },
    { id: 'grow', t0: 7, t1: 10.5 },
    { id: 'skyline', t0: 10.5, t1: 13.5 },
    { id: 'army', t0: 13.5, t1: 16 },
    { id: 'arena', t0: 16, t1: 22 },
    { id: 'city_rio', t0: 22, t1: 22.5 },
    { id: 'city_sp', t0: 22.5, t1: 23 },
    { id: 'city_ssa', t0: 23, t1: 23.5 },
    { id: 'city_mao', t0: 23.5, t1: 24 },
    { id: 'end', t0: 24, t1: 30 },
  ];
  const CUTS = SHOTS.map((s) => s.t0).filter((t) => t > 0);

  // ─────────────────────────────────────────────── helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = {
    out: (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3),
    inOut: (x) => {
      x = clamp(x, 0, 1);
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    },
    back: (x) => {
      x = clamp(x, 0, 1);
      const c1 = 1.9;
      return 1 + (c1 + 1) * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    },
  };
  const lerp = (a, b, k) => a + (b - a) * k;

  const D = {
    now: 0,
    move: { x: 0, y: 0 },
    shot: null,
    lt: 0,
    renderOn: true,
    beforeRender: null,
    state: {},
  };

  // stop the game's own clock: from now on only the director advances time
  g.loop.stop();
  g.quality.setPreset('alta');
  g.quality.sample = () => {};
  g.audio.setVolumes(0, 0, 0);
  const origInputUpdate = g.input.update.bind(g.input);
  g.input.update = (now) => {
    origInputUpdate(now);
    g.input.move.set(D.move.x, D.move.y);
  };
  const origRender = g.post.render.bind(g.post);
  g.post.render = (...a) => {
    if (D.renderOn) origRender(...a);
  };
  const origRenderFrame = g.renderFrame.bind(g);
  g.renderFrame = (dt, rdt) => {
    D.beforeRender?.(dt);
    origRenderFrame(dt, rdt);
  };

  function step(dt = 1 / FPS) {
    D.now += dt * 1000;
    g.frame(dt, D.now);
  }
  /** Simulate without drawing (setup, warm-up). */
  function preroll(seconds, dt = 1 / 30) {
    D.renderOn = false;
    for (let t = 0; t < seconds; t += dt) step(dt);
    D.renderOn = true;
  }
  async function startRun(mode, city) {
    D.renderOn = false;
    await g.startRun(mode, city);
    let n = 0;
    while (g.state !== 'playing' && n++ < 600) step(1 / 15);
    D.renderOn = true;
    g.godMode = true;
    g.damage.god = true;
  }
  function grow(matter) {
    const lv = g.run.progression.addMatter(matter);
    if (lv > 0) g.onLevelsGained(lv);
  }
  function setMatter(m) {
    const cur = g.run.progression.matter;
    if (m > cur) grow(m - cur);
  }
  function flyTo(x, z, speed = 1) {
    const dx = g.world.dx(g.ufo.position.x, x);
    const dz = g.world.dz(g.ufo.position.z, z);
    const d = Math.hypot(dx, dz);
    if (d < 1.5) {
      D.move.x = 0;
      D.move.y = 0;
      return d;
    }
    D.move.x = (dx / d) * speed;
    D.move.y = (-dz / d) * speed;
    return d;
  }
  function placeUfo(x, z) {
    g.ufo.spawnAt(x, z, g.stats.altitude);
    g.cameraCtl.snapTo(g.ufo.position, g.stats.scale);
  }
  function blocksOf(...districts) {
    return g.world.blocks.filter((b) => districts.includes(b.district));
  }
  function nearestBlock(list, x = 0, z = 0) {
    return list.slice().sort((a, b) => Math.hypot(a.cx - x, a.cz - z) - Math.hypot(b.cx - x, b.cz - z))[0];
  }
  function spawn(id, x, z, rot = Math.random() * 6.28) {
    try {
      return g.world.spawn(id, x, -1, z, rot);
    } catch {
      return null;
    }
  }
  function orbitCam(cx, cy, cz, radius, height, angle, lookY) {
    return (cam) => {
      cam.position.set(cx + Math.cos(angle()) * radius, cy + height, cz + Math.sin(angle()) * radius);
      cam.lookAt(cx, lookY ?? cy, cz);
      cam.fov = 50;
      cam.updateProjectionMatrix();
    };
  }

  // ─────────────────────────────────────────────── overlay (all English copy lives here)
  const css = document.createElement('style');
  css.textContent = `
    #ui > *:not(.hud) { display: none !important; }
    .hud > *:not(.arena-tag) { display: none !important; }
    .hud { opacity: 1 !important; transition: none !important; }
    .arena-tag { font-size: 15px !important; padding: 3px 9px !important; }
    .fps-meter { display: none !important; }
    #trl { position: fixed; inset: 0; z-index: 99999; pointer-events: none; overflow: hidden; font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif; color: #fff; }
    #trl .layer { position: absolute; inset: 0; }
    #trl .dim { background: radial-gradient(ellipse at 50% 55%, rgba(2,8,6,0.15), rgba(2,8,6,0.75)); }
    #trl .vig { background: radial-gradient(ellipse at 50% 50%, transparent 58%, rgba(0,0,0,0.55) 100%); }
    #trl .flash { background: #fff; }
    #trl .black { background: #000; }
    #trl .big { position: absolute; left: 0; right: 0; text-align: center; font-weight: 900; font-style: italic; letter-spacing: 0.01em; line-height: 0.9; text-transform: uppercase;
      text-shadow: 0 6px 0 rgba(0,0,0,0.35), 0 0 40px rgba(0,0,0,0.45); white-space: nowrap; }
    #trl .big .hl { color: #5dffa0; }
    #trl .big .gold { color: #ffcf3f; }
    #trl .big .red { color: #ff4d5e; }
    #trl .kick { position: absolute; left: 0; right: 0; text-align: center; font-family: 'Chakra Petch', monospace; font-weight: 700; letter-spacing: 0.32em; font-size: 24px; color: #5dffa0; text-shadow: 0 0 18px rgba(93,255,160,0.6); }
    #trl .tag { display: inline-block; padding: 6px 16px 5px; background: #ff5ad1; color: #14040f; font-family: 'Chakra Petch', monospace; font-weight: 700; letter-spacing: 0.24em; font-size: 22px; font-style: normal; transform: skewX(-10deg); }
    #trl .badge { position: absolute; bottom: 34px; display: flex; align-items: center; gap: 12px; padding: 10px 18px; border-radius: 14px;
      background: rgba(4,16,12,0.72); border: 1px solid rgba(93,255,160,0.45); font-family: 'Chakra Petch', monospace; font-size: 20px; letter-spacing: 0.08em; font-weight: 600; }
    #trl .badge b { color: #5dffa0; font-weight: 700; }
    #trl .badge.l { left: 36px; }
    #trl .badge.r { right: 36px; }
    #trl .spark { width: 20px; height: 20px; display: inline-block; }
    #trl .combo { position: absolute; left: 0; right: 0; top: 300px; text-align: center; font-weight: 900; font-style: italic; font-size: 74px; color: #ffcf3f; text-shadow: 0 5px 0 #9c5800, 0 0 30px rgba(255,207,63,0.5); }
    #trl .combo small { display: block; font-family: 'Chakra Petch', monospace; font-style: normal; font-size: 20px; letter-spacing: 0.3em; color: #fff; text-shadow: none; margin-top: 4px; }
    #trl .board { position: absolute; right: 40px; top: 40px; width: 330px; font-family: 'Chakra Petch', monospace; }
    #trl .board .h { font-size: 17px; letter-spacing: 0.26em; color: #ff5ad1; margin-bottom: 8px; display: flex; justify-content: space-between; }
    #trl .board .row { display: grid; grid-template-columns: 30px 1fr auto; gap: 10px; padding: 7px 12px; margin-bottom: 4px; font-size: 18px; letter-spacing: 0.04em;
      background: linear-gradient(90deg, rgba(2,10,8,0.75), rgba(2,10,8,0.3)); border-left: 3px solid var(--c); text-transform: uppercase; }
    #trl .board .row.me { background: linear-gradient(90deg, rgba(93,255,160,0.35), rgba(93,255,160,0.08)); }
    #trl .board .row .n { font-weight: 700; }
    #trl .city { position: absolute; left: 70px; bottom: 90px; }
    #trl .city .nm { font-weight: 900; font-style: italic; font-size: 96px; line-height: 0.9; text-shadow: 0 6px 0 rgba(0,0,0,0.35); }
    #trl .city .co { font-family: 'Chakra Petch', monospace; font-size: 22px; letter-spacing: 0.3em; color: #5dffa0; margin-top: 6px; }
    #trl .logo { position: absolute; left: 0; right: 0; text-align: center; font-weight: 900; font-style: italic; font-size: 210px; line-height: 0.9;
      background: linear-gradient(180deg, #fff3b0 0%, #ffcf3f 45%, #ff9f1c 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
      filter: drop-shadow(0 8px 0 #9c5800) drop-shadow(0 0 50px rgba(255,207,63,0.45)); padding-right: 0.05em; }
    #trl .url { position: absolute; left: 50%; display: flex; align-items: center; gap: 18px; padding: 18px 40px 16px; border-radius: 999px;
      background: #5dffa0; color: #04140c; font-weight: 900; font-style: italic; font-size: 68px; line-height: 1; letter-spacing: 0.01em; box-shadow: 0 0 0 6px rgba(93,255,160,0.25), 0 0 60px rgba(93,255,160,0.55); }
    #trl .url .play { width: 0; height: 0; border-left: 30px solid #04140c; border-top: 19px solid transparent; border-bottom: 19px solid transparent; }
    #trl .sub { position: absolute; left: 0; right: 0; text-align: center; font-family: 'Chakra Petch', monospace; font-size: 26px; letter-spacing: 0.3em; color: #eafff4; font-weight: 600; }
    #trl .made { position: absolute; left: 0; right: 0; text-align: center; font-family: 'Chakra Petch', monospace; font-size: 32px; letter-spacing: 0.1em; color: #fff; }
    #trl .made b { color: #ffb38a; font-weight: 700; }
    #trl .studio { position: absolute; left: 0; right: 0; text-align: center; font-family: 'Chakra Petch', monospace; font-size: 16px; letter-spacing: 0.4em; color: rgba(234,255,244,0.6); }
    #trl .scan { background: repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 3px); mix-blend-mode: overlay; }
  `;
  document.head.appendChild(css);

  const root = document.createElement('div');
  root.id = 'trl';
  document.body.appendChild(root);
  const el = (cls, html = '', parent = root) => {
    const e = document.createElement('div');
    e.className = cls;
    e.innerHTML = html;
    parent.appendChild(e);
    return e;
  };

  // a tiny four-point spark (Claude-ish burst), drawn inline
  const SPARK = `<svg class="spark" viewBox="0 0 24 24"><path fill="#ff8a5c" d="M12 1.5l2.2 7.1 7.3 2.4-7.3 2.4L12 22.5l-2.2-9.1L2.5 11l7.3-2.4z"/></svg>`;

  const dim = el('layer dim');
  const vig = el('layer vig');
  const black = el('layer black');
  const scan = el('layer scan');

  // title cards: [t0, t1, top(px), size(px), html, style]
  const TITLES = [
    [0.12, 1.95, 720, 96, 'WHAT IF YOU COULD<br>ABDUCT AN <span class="gold">ENTIRE CITY?</span>', 'punch'],
    [2.35, 3.45, 760, 150, 'IT STARTS <span class="hl">SMALL.</span>', 'punch'],
    [3.6, 5.3, 120, 124, 'ABDUCT <span class="hl">ANYTHING.</span>', 'slam'],
    [5.35, 6.95, 120, 84, 'CANS. DOGS. <span class="gold">PLASTIC CHAIRS.</span>', 'slam'],
    [7.1, 10.4, 120, 120, 'GROW WITH <span class="hl">EVERY BITE.</span>', 'slam'],
    [10.6, 13.4, 130, 150, 'EAT THE <span class="gold">SKYLINE.</span>', 'punch'],
    [13.6, 15.95, 120, 120, 'THE ARMY <span class="red">WILL TRY.</span>', 'slam'],
    [16.25, 19.4, 150, 118, 'EAT OTHER <span class="hl">SAUCERS...</span>', 'slam'],
    [19.5, 21.95, 150, 150, '...OR GET <span class="red">EATEN.</span>', 'punch'],
    [22.0, 23.98, 120, 110, '<span class="gold">7</span> BRAZILIAN CITIES', 'hold'],
  ];
  const titleEls = TITLES.map(([, , top, size, html]) => {
    const e = el('big', html);
    e.style.top = `${top}px`;
    e.style.fontSize = `${size}px`;
    return e;
  });
  const kickers = [
    [0.12, 1.95, 660, '◉ INCOMING SIGNAL · BRAZIL'],
    [16.25, 19.4, 90, '<span class="tag">NEW · ARENA .IO MODE</span>'],
  ].map(([t0, t1, top, html]) => {
    const e = el('kick', html);
    e.style.top = `${top}px`;
    return { t0, t1, e };
  });

  const combo = el('combo', '');
  const board = el('board', '');
  const cityBox = el('city', '<div class="nm"></div><div class="co"></div>');
  const CITY_NAMES = { city_rio: ['RIO DE JANEIRO', 'RJ · BRAZIL'], city_sp: ['SÃO PAULO', 'SP · BRAZIL'], city_ssa: ['SALVADOR', 'BA · BRAZIL'], city_mao: ['MANAUS', 'AM · BRAZIL'] };

  const badgeL = el('badge l', `${SPARK}<span>MADE WITH <b>CLAUDE OPUS 5.5</b></span>`);
  const badgeR = el('badge r', `<span>▶ PLAY FREE</span><b>abduziu.fun</b>`);

  // end card
  const logo = el('logo', 'ABDUZIU');
  const endSub = el('sub', 'PLAY FREE IN YOUR BROWSER');
  const url = el('url', '<span class="play"></span><span>abduziu.fun</span>');
  const endNote = el('sub', 'NO DOWNLOAD · PHONE &amp; PC');
  const made = el('made', `${SPARK.replace('class="spark"', 'class="spark" style="width:26px;height:26px;vertical-align:-5px;margin-right:10px"')}MADE WITH <b>CLAUDE OPUS 5.5</b>`);
  const studio = el('studio', 'A GUETO GAME STUDIO GAME');
  const flash = el('layer flash');

  function show(e, o, tf = '') {
    e.style.opacity = String(clamp(o, 0, 1));
    e.style.transform = tf;
    e.style.display = o <= 0.001 ? 'none' : '';
  }

  /** Title animation: in (0.16 s), hold with a slow push, out (0.12 s). */
  function titleAnim(t, t0, t1, kind) {
    if (t < t0 || t > t1) return null;
    const a = (t - t0) / 0.16;
    const out = clamp((t1 - t) / 0.12, 0, 1);
    const hold = (t - t0) / (t1 - t0);
    if (kind === 'punch') {
      const s = lerp(1.6, 1, ease.out(a)) * (1 + hold * 0.06);
      return { o: Math.min(ease.out(a), out), tf: `scale(${s.toFixed(4)})`, blur: (1 - ease.out(a)) * 14 };
    }
    if (kind === 'slam') {
      const y = lerp(-60, 0, ease.back(a));
      const skew = (1 - ease.out(a)) * -12;
      return { o: Math.min(ease.out(a * 1.4), out), tf: `translateY(${y.toFixed(1)}px) skewX(${skew.toFixed(2)}deg) scale(${(1 + hold * 0.04).toFixed(4)})`, blur: 0 };
    }
    return { o: Math.min(ease.out(a), out), tf: `scale(${(1 + hold * 0.05).toFixed(4)})`, blur: 0 };
  }

  function paintOverlay(t) {
    TITLES.forEach(([t0, t1, , , , kind], i) => {
      const e = titleEls[i];
      const s = titleAnim(t, t0, t1, kind);
      if (!s) return show(e, 0);
      show(e, s.o, s.tf);
      e.style.filter = s.blur > 0.2 ? `blur(${s.blur.toFixed(1)}px)` : '';
    });
    for (const k of kickers) {
      const s = titleAnim(t, k.t0, k.t1, 'hold');
      show(k.e, s ? s.o : 0, s ? `translateY(${((1 - Math.min(1, (t - k.t0) / 0.25)) * 20).toFixed(1)}px)` : '');
    }

    // flash on every cut (brighter on the big ones)
    let f = 0;
    for (const c of CUTS) {
      if (t >= c && t < c + 0.18) f = Math.max(f, (1 - (t - c) / 0.18) * (c === 2 || c === 16 || c === 24 ? 0.85 : 0.45));
    }
    show(flash, f);
    // black: hook fades in from black; "descend" starts from dark sky
    show(black, t < 0.2 ? 1 - t / 0.2 : 0);
    show(vig, 1);
    show(scan, 1);
    show(dim, t >= 24 ? ease.inOut((t - 24) / 0.8) : 0);

    // persistent CTA badges during gameplay
    const bo = t >= 3.6 && t < 23.95 ? Math.min(1, (t - 3.6) / 0.3, (23.95 - t) / 0.15) : 0;
    show(badgeL, bo, `translateY(${((1 - bo) * 20).toFixed(1)}px)`);
    show(badgeR, bo, `translateY(${((1 - bo) * 20).toFixed(1)}px)`);

    // combo counter while the small saucer snacks
    const cc = D.shot?.id === 'small' || D.shot?.id === 'grow' ? g.run.combo.count : 0;
    if (cc !== D.state.lastCC) {
      D.state.lastCC = cc;
      D.state.ccT = t;
    }
    if (cc >= 3) {
      const pulse = 1 + Math.max(0, 0.18 - (t - (D.state.ccT ?? 0))) * 1.4;
      combo.innerHTML = `COMBO x${cc}<small>${cc >= 25 ? 'FRENZY!' : 'KEEP IT GOING'}</small>`;
      show(combo, 1, `scale(${pulse.toFixed(3)})`);
    } else show(combo, 0);

    // arena leaderboard
    if (D.shot?.id === 'arena' && g.arena?.active) {
      const list = g.arena.standings().slice(0, 5);
      const me = g.arena.standings().findIndex((e) => e.player);
      const rows = list.map((e, i) => `<div class="row${e.player ? ' me' : ''}" style="--c:#${e.color.toString(16).padStart(6, '0')}"><span class="n">${i + 1}</span><span>${e.name}</span><span>${Math.round(e.matter).toLocaleString('en-US')}</span></div>`);
      if (me >= 5) rows.push(`<div class="row me" style="--c:#5dffa0"><span class="n">${me + 1}</span><span>YOU</span><span>${Math.round(g.arena.playerMatter).toLocaleString('en-US')}</span></div>`);
      board.innerHTML = `<div class="h"><span>● LIVE ARENA</span><span>${g.arena.total} SHIPS</span></div>${rows.join('')}`;
      const bo2 = Math.min(1, (t - 16.1) / 0.3);
      show(board, bo2, `translateX(${((1 - bo2) * 60).toFixed(1)}px)`);
    } else show(board, 0);

    // city name
    const cn = CITY_NAMES[D.shot?.id];
    if (cn) {
      cityBox.firstChild.textContent = cn[0];
      cityBox.lastChild.textContent = cn[1];
      const k = (t - D.shot.t0) / 0.12;
      show(cityBox, 1, `translateX(${((1 - ease.out(k)) * -80).toFixed(1)}px)`);
    } else show(cityBox, 0);

    // end card
    const e0 = 24.25;
    const lk = (t - e0) / 0.35;
    show(logo, t >= e0 ? ease.out(lk) : 0, `scale(${lerp(1.5, 1, ease.back(lk)).toFixed(4)})`);
    logo.style.top = '190px';
    const sk = (t - 25.0) / 0.3;
    show(endSub, t >= 25 ? ease.out(sk) : 0, `translateY(${((1 - ease.out(sk)) * 20).toFixed(1)}px)`);
    endSub.style.top = '440px';
    const uk = (t - 25.4) / 0.35;
    const pulse = t > 26 ? 1 + Math.sin((t - 26) * Math.PI * 2) * 0.025 : 1;
    show(url, t >= 25.4 ? ease.out(uk) : 0, `translateX(-50%) scale(${(lerp(0.6, 1, ease.back(uk)) * pulse).toFixed(4)})`);
    url.style.top = '505px';
    const nk = (t - 25.9) / 0.3;
    show(endNote, t >= 25.9 ? ease.out(nk) * 0.8 : 0);
    endNote.style.top = '650px';
    endNote.style.fontSize = '20px';
    const mk = (t - 26.4) / 0.35;
    show(made, t >= 26.4 ? ease.out(mk) : 0, `translateY(${((1 - ease.out(mk)) * 16).toFixed(1)}px)`);
    made.style.top = '965px';
    show(studio, t >= 26.8 ? ease.out((t - 26.8) / 0.4) : 0);
    studio.style.top = '1030px';
  }

  // ─────────────────────────────────────────────── shot scripts
  const SETUP = {
    async hook() {
      await startRun('casual', 'sao_paulo');
      g.upgrades.maxAll();
      g.maxBeam = true;
      setMatter(15000);
      const b = nearestBlock(blocksOf('F'));
      placeUfo(b.cx, b.cz);
      preroll(1.4);
      const p = g.ufo.position;
      D.state.c = { x: p.x, z: p.z };
      D.update = (lt) => {
        flyTo(D.state.c.x + 40, D.state.c.z + 10, 0.12);
      };
      g.cameraCtl.override = (cam) => {
        const u = g.ufo.position;
        const k = D.lt / 2;
        const r = lerp(125, 105, k) + g.stats.radius * 1.5;
        const a = 0.9 + k * 0.25;
        cam.position.set(u.x + Math.cos(a) * r, lerp(34, 40, k), u.z + Math.sin(a) * r);
        cam.lookAt(u.x, u.y * 0.5, u.z);
        cam.fov = 48;
        cam.updateProjectionMatrix();
      };
      D.dt = 1 / 120; // half-speed: epic
    },

    async descend() {
      await startRun('casual', 'rio');
      const s = g.world.start;
      placeUfo(s.x, s.z);
      preroll(0.5);
      g.ufo.frozen = true;
      D.state.p = { x: g.ufo.position.x, z: g.ufo.position.z };
      D.beforeRender = () => {
        const k = ease.out(D.lt / 1.3);
        const y = lerp(80, 11, k);
        g.ufo.position.set(D.state.p.x, y, D.state.p.z);
        g.ufoVisuals.root.position.copy(g.ufo.position);
        g.ufoVisuals.root.scale.setScalar(g.stats.radius);
        g.ufoVisuals.body.rotation.y += 0.05;
        g.beam.setActive(D.lt > 1.05);
      };
      g.cameraCtl.override = (cam) => {
        const p = D.state.p;
        const u = g.ufo.position;
        cam.position.set(p.x + 34 - D.lt * 3, 4, p.z + 1.5);
        cam.lookAt(u.x, u.y * 0.7 + 3, u.z);
        cam.fov = 52;
        cam.updateProjectionMatrix();
      };
    },

    async small() {
      await startRun('casual', 'salvador');
      setMatter(20);
      // a straight street with a buffet of small stuff
      const zs = g.world.roadLines.zs;
      const z = zs[2];
      const x0 = -g.world.halfSize.w * 0.3;
      placeUfo(x0, z);
      const menu = ['lata', 'garrafa', 'chinelo', 'bola', 'lata', 'cadeira', 'cachorro', 'isopor', 'galinha', 'mesa_bar', 'cone', 'coco', 'cadeira', 'bola', 'caixa_som', 'lata', 'cachorro', 'engradado'];
      for (let i = 0; i < 90; i++) spawn(menu[i % menu.length], x0 + 6 + i * 1.35, z + (Math.random() - 0.5) * 5);
      preroll(0.4);
      D.update = () => flyTo(x0 + 200, z, 0.55);
    },

    async grow() {
      await startRun('casual', 'recife');
      setMatter(110);
      const zs = g.world.roadLines.zs;
      const z = zs[Math.floor(zs.length / 2)];
      const x0 = -g.world.halfSize.w * 0.6;
      placeUfo(x0, z);
      const menu = ['moto', 'hatch', 'taxi', 'barraca_feira', 'seda', 'carrinho_pipoca', 'hatch', 'van', 'onibus', 'taxi', 'caminhonete', 'food_truck', 'onibus', 'caminhao'];
      for (let i = 0; i < 46; i++) spawn(menu[i % menu.length], x0 + 10 + i * 4.2, z + (Math.random() - 0.5) * 6, Math.random() < 0.5 ? 0 : Math.PI);
      preroll(0.3);
      D.update = (lt) => {
        flyTo(x0 + 400, z, 0.6);
        for (const [at, m] of [[0.4, 260], [1.2, 520], [2.0, 900], [2.7, 1500]]) {
          if (lt >= at && !D.state[`g${at}`]) {
            D.state[`g${at}`] = 1;
            setMatter(m);
          }
        }
      };
    },

    async skyline() {
      await startRun('casual', 'sao_paulo');
      g.upgrades.maxAll();
      g.maxBeam = true;
      setMatter(9000);
      const fb = blocksOf('F', 'C');
      const b = nearestBlock(fb, 60, -40);
      placeUfo(b.cx - 70, b.cz);
      preroll(0.4);
      g.run.combo.forceFrenzy();
      D.update = () => flyTo(b.cx + 120, b.cz + 20, 0.5);
    },

    async army() {
      await startRun('campanha', 'brasilia');
      setMatter(700);
      const s = g.world.start;
      placeUfo(s.x, s.z);
      g.run.addThreat(900);
      const snap = g.playerSnapshot();
      for (const k of ['jet', 'jet', 'helicopter', 'helicopter', 'police', 'police', 'police', 'drone', 'drone', 'drone']) g.enemies.spawn(k, snap);
      preroll(3.2);
      D.update = (lt) => {
        flyTo(s.x + 60, s.z - 30, 0.45);
        if (lt >= 1.55 && !D.state.emp) {
          D.state.emp = 1;
          g.fireEMP(1.8);
          g.cameraCtl.addTrauma(0.6);
        }
      };
    },

    async arena() {
      await startRun('arena', 'nova_aurora');
      const a = g.arena;
      a.playerName = 'YOU';
      setMatter(320);
      a.time = 40;
      const p = g.ufo.position;
      const bots = a.bots;
      // the snack: a small ship that dawdles right in front of us
      const prey = bots[0];
      prey.matter = 45;
      prey.pos.set(p.x + 22, prey.pos.y, p.z - 6);
      // the monster: a giant that shows up for the second half
      const giant = bots[1];
      giant.matter = 5200;
      giant.pos.set(p.x - 160, giant.pos.y, p.z + 10);
      // a few mid-size ships around for company
      for (let i = 2; i < Math.min(8, bots.length); i++) {
        bots[i].matter = 60 + i * 55;
        const ang = i * 1.1;
        bots[i].pos.set(p.x + Math.cos(ang) * 70, bots[i].pos.y, p.z + Math.sin(ang) * 70);
      }
      for (const b of bots) b.visuals.setLevel(8);
      const p0 = { x: p.x, z: p.z };
      const preyAt = { x: p.x + 22, z: p.z - 6 };
      const think = a.think.bind(a);
      a.think = (b, dt, pt) => {
        if (b === prey) {
          // dawdles in place: an easy snack
          b.mode = 'wander';
          b.goal.set(preyAt.x + Math.sin(D.lt * 2) * 3, 0, preyAt.z);
          return;
        }
        if (b === giant) {
          b.mode = 'hunt';
          b.target = 'player';
          return;
        }
        think(b, dt, pt);
      };
      const move = a.move.bind(a);
      a.move = (b, dt) => {
        move(b, dt);
        if (b !== giant) return;
        // scripted entrance: slides in from off-screen and parks right on top of us
        const k = ease.inOut((D.lt - 2.6) / 2.2);
        const u = g.ufo.position;
        b.pos.x = u.x + lerp(-110, -1.5, k);
        b.pos.z = u.z + lerp(18, 0.5, k);
        b.vel.set(k < 1 ? 30 : 0, 0, 0);
      };
      preroll(0.2);
      D.update = (lt) => {
        if (lt < 3.0) {
          if (prey.alive) flyTo(preyAt.x, preyAt.z, 0.95);
          else flyTo(g.ufo.position.x + 20, g.ufo.position.z, 0.3);
        } else {
          // tries to run, too late
          flyTo(g.ufo.position.x + 50, g.ufo.position.z - 10, 0.35);
        }
      };
      g.cameraCtl.override = null;
      D.camZoom = 1.35;
    },

    async city(city) {
      await startRun('casual', city);
      setMatter(600);
      const s = g.world.start;
      placeUfo(s.x, s.z);
      preroll(0.6);
      const a0 = Math.random() * 6.28;
      D.update = () => flyTo(s.x + 50, s.z, 0.3);
      g.cameraCtl.override = (cam) => {
        const u = g.ufo.position;
        const a = a0 + D.lt * 0.7;
        const cx = u.x + Math.cos(a) * 80;
        const cz = u.z + Math.sin(a) * 80;
        // stay above any tower between us and the saucer
        const roof = Math.max(g.world.heightField.maxInRadius(cx, cz, 25), g.world.heightField.maxInRadius((cx + u.x) / 2, (cz + u.z) / 2, 25));
        cam.position.set(cx, Math.max(u.y + 45, roof + 25), cz);
        cam.lookAt(u.x, u.y * 0.4, u.z);
        cam.fov = 55;
        cam.updateProjectionMatrix();
      };
    },

    async end() {
      await startRun('casual', 'rio');
      setMatter(2600);
      const s = g.world.start;
      placeUfo(s.x, s.z);
      preroll(0.8);
      D.update = () => flyTo(s.x + 30, s.z, 0.15);
      g.cameraCtl.override = (cam) => {
        const u = g.ufo.position;
        const a = 2.2 + D.lt * 0.12;
        const r = 40 + g.stats.radius * 2.2;
        cam.position.set(u.x + Math.cos(a) * r, u.y + 2, u.z + Math.sin(a) * r);
        cam.lookAt(u.x, u.y + g.stats.radius * 1.6, u.z);
        cam.fov = 45;
        cam.updateProjectionMatrix();
      };
    },
  };

  const CITY_SHOTS = { city_rio: 'rio', city_sp: 'sao_paulo', city_ssa: 'salvador', city_mao: 'manaus' };

  // extra zoom for the arena follow camera (so both ships fit)
  const origCamUpdate = g.cameraCtl.update.bind(g.cameraCtl);
  g.cameraCtl.update = (dt, target, vel, scale, maxSpeed, extraZoom, fov) => origCamUpdate(dt, target, vel, scale, maxSpeed, extraZoom * (D.camZoom ?? 1), fov);

  window.TRAILER = {
    FPS,
    DURATION,
    SHOTS,
    async prepare(id) {
      const shot = SHOTS.find((s) => s.id === id);
      D.shot = shot;
      D.lt = 0;
      D.state = {};
      D.update = null;
      D.beforeRender = null;
      D.dt = 1 / FPS;
      D.camZoom = 1;
      g.cameraCtl.override = null;
      if (CITY_SHOTS[id]) await SETUP.city(CITY_SHOTS[id]);
      else await SETUP[id]();
      return { f0: Math.round(shot.t0 * FPS), f1: Math.round(shot.t1 * FPS) };
    },
    /** Advances the shot one frame and paints the overlay for global frame i. */
    frame(i, draw = true) {
      const t = i / FPS;
      D.lt = t - D.shot.t0;
      D.update?.(D.lt);
      D.renderOn = draw;
      step(D.dt);
      D.renderOn = true;
      if (draw) paintOverlay(t);
    },
    paint: paintOverlay,
  };
})();
