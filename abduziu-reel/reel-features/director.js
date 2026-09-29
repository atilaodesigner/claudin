/*
 * ABDUZIU — feature reel (9:16, 1080×1920, 60 fps, 25.6 s), game footage only.
 *
 * Injected into the real game (same build as abduziu.fun). Stops the game's own loop,
 * advances the simulation with a fixed clock, hides every piece of UI and scripts the
 * saucer + camera for ten shots, one per feature. Captions live in a separate overlay
 * (overlay.html) so the same footage serves every language.
 *
 * Cuts land on the beat of the 150 BPM soundtrack: 2.4 s (6 beats) per shot.
 * Logged for the sound design: abductions, level-ups, explosions, EMP, swallows, skin swaps.
 * Logged for the overlay: screen positions of the legends and of the friends' saucers.
 *
 *   await TRAILER.prepare('hook')   // builds the shot
 *   TRAILER.frame(i)                // advances one frame (i = global frame number)
 */
(() => {
  const FPS = 60;
  const g = window.__game;

  const SHOTS = [
    { id: 'hook', t0: 0, t1: 2.4 },
    { id: 'orbit', t0: 2.4, t1: 4.8, query: '?city=rio' },
    { id: 'grow', t0: 4.8, t1: 7.2 },
    { id: 'beach', t0: 7.2, t1: 9.6 },
    { id: 'legends', t0: 9.6, t1: 12.0 },
    { id: 'army', t0: 12.0, t1: 14.4 },
    { id: 'arena', t0: 14.4, t1: 16.8 },
    { id: 'friends', t0: 16.8, t1: 19.2 },
    { id: 'skins', t0: 19.2, t1: 21.6 },
    { id: 'end', t0: 21.6, t1: 25.6, query: '?city=rio' },
  ];
  /** Skins shown in the "skins" shot, with their start time inside the shot (s). */
  const SKIN_SHOW = [
    ['neon_rosa', 0],
    ['lava', 0.3],
    ['cristal', 0.6],
    ['ouro', 0.9],
    ['buraco_negro', 1.2],
    ['nave_mae', 1.5],
  ];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  const D = { now: 0, move: { x: 0, y: 0 }, shot: null, lt: 0, t: 0, f: 0, renderOn: true, state: {}, events: [], tracks: [], dt: 1 / FPS, recording: false, camZoom: 1, tracked: null };
  const log = (k, extra = {}) => {
    if (D.recording) D.events.push({ t: +D.t.toFixed(4), k, ...extra });
  };

  // ── take over the clock, silence the game, hide every UI element
  g.loop.stop();
  g.quality.setPreset('alta');
  g.quality.sample = () => {};
  g.audio.setVolumes(0, 0, 0);
  const css = document.createElement('style');
  css.textContent = `
    #ui > *:not(.space-flash) { display: none !important; }
    .arena-tag, .online-tag, .net-notice, .invite-card { display: none !important; }
  `;
  document.head.appendChild(css);

  const origInputUpdate = g.input.update.bind(g.input);
  g.input.update = (now) => {
    origInputUpdate(now);
    g.input.move.set(D.move.x, D.move.y);
  };
  const origRender = g.post.render.bind(g.post);
  g.post.render = (...a) => {
    if (D.renderOn) origRender(...a);
  };
  const origCamUpdate = g.cameraCtl.update.bind(g.cameraCtl);
  g.cameraCtl.update = (dt, target, vel, scale, maxSpeed, extraZoom, fov) => origCamUpdate(dt, target, vel, scale, maxSpeed, extraZoom * D.camZoom, fov);

  // ── sound design log
  const origAbsorbed = g.run.onAbsorbed.bind(g.run);
  g.run.onAbsorbed = (o) => {
    log('pop', { tier: o.def.tier, combo: g.run.combo.count + 1, secret: o.def.secret ? 1 : 0 });
    origAbsorbed(o);
  };
  const origLevels = g.onLevelsGained.bind(g);
  g.onLevelsGained = (n) => {
    log('level');
    origLevels(n);
  };
  const origExplosion = g.vfx.explosion.bind(g.vfx);
  g.vfx.explosion = (pos, size, groundY) => {
    log('boom', { size });
    origExplosion(pos, size, groundY);
  };
  const origEmp = g.fireEMP.bind(g);
  g.fireEMP = (mult) => {
    log('emp');
    origEmp(mult);
  };
  // fast growth levels up every few frames: keep one level-up burst per 1.2 s
  const origLevelFx = g.vfx.levelUp.bind(g.vfx);
  g.vfx.levelUp = (...a) => {
    if (D.t - (D.lastLevelFx ?? -9) < 1.2) return;
    D.lastLevelFx = D.t;
    origLevelFx(...a);
  };

  function step(dt = 1 / FPS) {
    D.now += dt * 1000;
    g.frame(dt, D.now);
  }
  function preroll(seconds, dt = 1 / 30) {
    D.renderOn = false;
    for (let t = 0; t < seconds - 1e-6; t += dt) step(dt);
    D.renderOn = true;
  }
  async function startRun(mode, city) {
    D.renderOn = false;
    await g.startRun(mode, city);
    let n = 0;
    while (g.state !== 'playing' && n++ < 900) step(1 / 15);
    D.renderOn = true;
    godMode();
  }
  function godMode() {
    g.godMode = true;
    g.damage.god = true;
  }
  function setMatter(m) {
    const cur = g.run.progression.matter;
    if (m > cur) {
      const lv = g.run.progression.addMatter(m - cur);
      if (lv > 0) g.onLevelsGained(lv);
    }
  }
  function flyTo(x, z, speed = 1) {
    const dx = g.world.dx(g.ufo.position.x, x);
    const dz = g.world.dz(g.ufo.position.z, z);
    const d = Math.hypot(dx, dz);
    if (d < 1.2) {
      D.move.x = 0;
      D.move.y = 0;
      return d;
    }
    const s = speed * Math.min(1, d / 5);
    D.move.x = (dx / d) * s;
    D.move.y = (-dz / d) * s;
    return d;
  }
  function followPath(path, speed) {
    let i = D.state.pi ?? 0;
    while (i < path.length - 1 && Math.hypot(path[i][0] - g.ufo.position.x, path[i][1] - g.ufo.position.z) < 3) i++;
    D.state.pi = i;
    return flyTo(path[i][0], path[i][1], speed);
  }
  function placeUfo(x, z) {
    g.ufo.spawnAt(x, z, g.stats.altitude);
    g.cameraCtl.snapTo(g.ufo.position, g.stats.scale);
  }
  function blocksOf(...districts) {
    return g.world.blocks.filter((b) => districts.includes(b.district));
  }
  function nearest(list, x = 0, z = 0) {
    return list.slice().sort((a, b) => Math.hypot(a.cx - x, a.cz - z) - Math.hypot(b.cx - x, b.cz - z))[0];
  }
  function blockAt(col, row) {
    return g.world.blocks.find((b) => b.col === col && b.row === row);
  }
  /** Wide, fast single beam (no satellite cones: the frame stays readable). */
  function boost(level = 3) {
    const L = g.upgrades.levels;
    L.set('processamento', 5);
    L.set('campo_maior', level);
    L.set('ima_materia', 3);
    g.upgrades.version++;
  }
  function maxOneBeam() {
    g.upgrades.maxAll();
    g.upgrades.levels.set('feixe_duplo', 0);
    g.upgrades.version++;
  }
  /** Keeps the combo from turning into the (purple) frenzy look. */
  function noFrenzy() {
    g.run.combo.nextFrenzyAt = Infinity;
  }
  function setCam(cam, fov) {
    cam.fov = fov;
    cam.updateProjectionMatrix();
  }
  /** Lowest camera height (≥ y) whose line of sight to the target clears every rooftop. */
  function clearY(cx, y, cz, tx, ty, tz, margin = 4) {
    const hf = g.world.heightField;
    let need = y;
    for (let s = 0.08; s < 0.9; s += 0.07) {
      const roof = hf.maxInRadius(lerp(cx, tx, s), lerp(cz, tz, s), 5);
      need = Math.max(need, (roof + margin - ty * s) / (1 - s));
    }
    return need;
  }
  /** High follow camera (portrait): always above the rooftops, zooms out as the saucer grows. */
  function topCam(zoom = 1, tilt = 0.5, fov = 60, grow = 2) {
    D.state.tc = null;
    g.cameraCtl.override = (cam, dt) => {
      const u = g.ufo.position;
      const c = (D.state.tc ??= { x: u.x, z: u.z, r: g.stats.radius });
      const k = 1 - Math.exp(-4 * (dt || 1 / 60));
      c.x += (u.x - c.x) * k;
      c.z += (u.z - c.z) * k;
      c.r += (g.stats.radius - c.r) * (1 - Math.exp(-grow * (dt || 1 / 60)));
      const d = (26 + c.r * 11) * zoom;
      const cz = c.z + d * tilt;
      const roof = g.world.heightField.maxInRadius(c.x, cz, 16);
      cam.position.set(c.x, Math.max(u.y * 0.3 + d * 0.95, roof + 14), cz);
      cam.lookAt(c.x, 0, c.z - d * 0.18);
      setCam(cam, fov);
    };
  }
  /** Chase camera: behind/above the saucer along its heading, eased. */
  function chaseCam(dist = 1, height = 0.62, fov = 60, side = 0.35, lookY = 0) {
    D.state.cc = null;
    g.cameraCtl.override = (cam, dt) => {
      const u = g.ufo.position;
      const v = g.ufo.velocity;
      const c = (D.state.cc ??= { x: u.x, z: u.z, hx: D.state.hx ?? 0, hz: D.state.hz ?? -1, r: g.stats.radius });
      const k = 1 - Math.exp(-4 * (dt || 1 / 60));
      c.x += (u.x - c.x) * k;
      c.z += (u.z - c.z) * k;
      c.r += (g.stats.radius - c.r) * (1 - Math.exp(-2 * (dt || 1 / 60)));
      const sp = Math.hypot(v.x, v.z);
      if (sp > 0.5) {
        const kh = 1 - Math.exp(-1.6 * (dt || 1 / 60));
        c.hx += (v.x / sp - c.hx) * kh;
        c.hz += (v.z / sp - c.hz) * kh;
        const n = Math.hypot(c.hx, c.hz) || 1;
        c.hx /= n;
        c.hz /= n;
      }
      const d = (22 + c.r * 9) * dist;
      const bx = -c.hx + -c.hz * side;
      const bz = -c.hz + c.hx * side;
      const px = c.x + bx * d;
      const pz = c.z + bz * d;
      const want = clearY(px, u.y * 0.4 + d * height, pz, u.x, u.y * 0.6, u.z, 3);
      c.y = c.y == null ? want : c.y + (want - c.y) * (1 - Math.exp(-3 * (dt || 1 / 60)));
      cam.position.set(px, c.y, pz);
      cam.lookAt(c.x + c.hx * d * 0.3, u.y * lookY, c.z + c.hz * d * 0.3);
      setCam(cam, fov);
    };
  }

  // ── screen tracking for the overlay (legend names, friends' nick tags)
  const _p = g.ufo.position.clone();
  function project(pos, dy = 0) {
    const cam = g.cameraCtl.camera;
    _p.set(pos.x, pos.y + dy, pos.z).project(cam);
    // normalised 0..1 screen coordinates (the overlay scales them to its own size)
    return { x: +((_p.x + 1) / 2).toFixed(4), y: +((1 - _p.y) / 2).toFixed(4), on: _p.z < 1 && Math.abs(_p.x) < 1.2 && Math.abs(_p.y) < 1.2 };
  }
  function recordTracks() {
    if (!D.tracked || !D.recording) return;
    const row = { f: D.f };
    for (const [id, get] of Object.entries(D.tracked)) {
      const r = get();
      if (r) row[id] = r;
    }
    D.tracks.push(row);
  }

  // ───────────────────────────────────────────────────────── shots
  const SETUP = {
    /** Hook: max-level frenzy over São Paulo, slow motion, the skyline flying up the beam. */
    async hook() {
      await startRun('casual', 'sao_paulo');
      maxOneBeam();
      setMatter(11000);
      const b = nearest(blocksOf('F', 'C'), 40, -60);
      placeUfo(b.cx - 60, b.cz + 6);
      g.run.combo.forceFrenzy();
      const go = () => {
        if (!g.run.combo.frenzy) g.run.combo.forceFrenzy();
        flyTo(b.cx + 140, b.cz - 20, 0.42);
      };
      D.update = go;
      for (let i = 0; i < 40; i++) {
        go();
        preroll(1 / 30);
      }
      D.dt = 1 / 110; // ~0.55× speed: every object readable in the vortex
      g.cameraCtl.override = (cam) => {
        const u = g.ufo.position;
        const k = D.lt / 2.4;
        const r = lerp(104, 90, k) + g.stats.radius * 1.3;
        const a = 0.8 + k * 0.45;
        const cx = u.x + Math.cos(a) * r;
        const cz = u.z + Math.sin(a) * r;
        const ty = u.y * 0.98;
        const want = clearY(cx, lerp(30, 40, k), cz, u.x, ty, u.z, 3);
        D.state.hy = D.state.hy == null ? want : D.state.hy + (want - D.state.hy) * 0.08;
        cam.position.set(cx, D.state.hy, cz);
        cam.lookAt(u.x, ty, u.z);
        setCam(cam, 64);
      };
    },

    /** From orbit: the saucer plunges towards Rio, heat shell and white-out on the cut. */
    async orbit() {
      if (g.state !== 'menu') throw new Error('orbit must start from the menu');
      // the recorder is a software renderer: rebuild the planet with the desktop textures
      const Space = g.space.constructor;
      g.setSpace(false);
      g.space = new Space(true);
      g.space.resize(innerWidth, innerHeight);
      g.setSpace(true);
      g.space.startMenu();
      const sp = g.space;
      const upd = sp.update.bind(sp);
      sp.update = (dt, time) => {
        upd(dt, time);
        if (sp.phase === 'dive') {
          sp.look.y += 2.4;
          sp.camera.lookAt(sp.look);
        }
      };
      preroll(0.3);
      D.renderOn = false;
      await g.startRun('casual', 'rio');
      godMode();
      preroll(0.95, 1 / 60); // the white-out peaks right on the cut
    },

    /** Start tiny, end giant: an exponential growth spiral over Rio. */
    async grow() {
      await startRun('casual', 'rio');
      boost(4);
      noFrenzy();
      const a0 = blockAt(4, 1) ?? nearest(blocksOf('C'));
      const b0 = blockAt(5, 2) ?? nearest(blocksOf('F'));
      const c = { x: (a0.cx + b0.cx) / 2, z: (a0.cz + b0.cz) / 2 };
      D.state.ang = 0;
      placeUfo(c.x + 8, c.z);
      preroll(0.4);
      g.lighting.fogMult = 0.3;
      topCam(0.85, 0.7, 58, 1.7);
      D.tracked = { size: () => ({ r: +g.stats.radius.toFixed(3) }) };
      D.update = (lt) => {
        noFrenzy();
        setMatter(12 * Math.pow(3600, clamp((lt + 0.05) / 2.25, 0, 1)));
        const r = 8 + lt * 18;
        D.state.ang += ((g.stats.speed ?? 10) * 0.8) / Math.max(8, r) / 60;
        const a = D.state.ang + 0.5;
        flyTo(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, 1);
      };
    },

    /** Abduct anything: a packed Sunday on Copacabana swept up row by row. */
    async beach() {
      await startRun('casual', 'rio');
      boost(5);
      noFrenzy();
      setMatter(640);
      const beach = nearest(blocksOf('A'), g.world.start.x, g.world.start.z);
      const dir = beach.cx > 0 ? -1 : 1;
      const kit = ['guarda_sol', 'cadeira_praia', 'cadeira_praia', 'isopor', 'prancha', 'coco', 'bola', 'guarda_sol', 'cadeira_praia', 'chinelo', 'copo_acai', 'melancia'];
      const pal = [0xef476f, 0x118ab2, 0x06d6a0, 0xffd166, 0xf77f00, 0x8338ec];
      let n = 0;
      for (let i = 0; i < 34; i++) {
        for (let j = -2; j <= 2; j++) {
          const x = beach.cx + dir * (8 + i * 2.5) + (j % 2) * 1.2;
          const zz = beach.cz - 4 + j * 2.3 + Math.sin(i * 1.7 + j) * 0.5;
          try {
            g.world.spawn(kit[n++ % kit.length], x, -1, zz, (i * 0.7 + j) % 6.28, { paint: pal[(i + j + 6) % pal.length] });
          } catch {
            /* sand edge */
          }
        }
      }
      const z = beach.cz - 4;
      placeUfo(beach.cx + dir * 1, z);
      D.state.hx = dir;
      D.state.hz = 0;
      const path = [[beach.cx + dir * 30, z + 2], [beach.cx + dir * 60, z - 2], [beach.cx + dir * 100, z + 2]];
      D.update = () => {
        noFrenzy();
        followPath(path, 1);
      };
      for (let i = 0; i < 24; i++) {
        D.update();
        preroll(1 / 30);
      }
      chaseCam(0.62, 0.52, 62, 0.28);
    },

    /** Secret legends lined up on the sand in Salvador; the saucer sweeps them up one by one. */
    async legends() {
      await startRun('casual', 'salvador');
      const L = g.upgrades.levels;
      L.set('processamento', 5);
      L.set('campo_maior', 0);
      L.set('gravidade_bruta', 5);
      g.upgrades.version++;
      noFrenzy();
      setMatter(60);
      const beach = nearest(blocksOf('A'), g.world.start.x, g.world.start.z);
      const z = beach.cz;
      const x0 = beach.cx - 6;
      // a clean stage: nothing else on this stretch of sand
      for (const o of g.world.objects.slice()) {
        if (o.alive && Math.abs(o.home.x - (x0 + 5)) < 16 && Math.abs(o.home.z - z) < 14) g.world.kill(o);
      }
      // a "group photo": three small legends in front, three big ones behind
      const cx = x0 + 5;
      const LINEUP = [
        ['saci', cx - 1.3, z + 1.4],
        ['et_varginha', cx, z + 1.7],
        ['curupira', cx + 1.3, z + 1.4],
        ['mula_sem_cabeca', cx - 1.7, z - 1.2],
        ['boitata', cx, z - 1.6],
        ['chupacabra', cx + 1.7, z - 1.2],
      ];
      D.tracked = {};
      for (const [id, x, zz] of LINEUP) {
        const o = g.world.spawn(id, x, -1, zz, 0.15 * (x - cx), id === 'et_varginha' ? { rarity: 'epico' } : {});
        D.tracked[id] = () => {
          if (!o.alive) return null;
          const p = project(o.pos, o.model.height * o.scale + 0.25);
          return { ...p, lift: o.state === 0 ? 0 : 1 };
        };
      }
      // the saucer glides in from behind the group and parks over it
      placeUfo(cx, z - 6);
      D.update = () => {
        noFrenzy();
        flyTo(cx, z + 0.2, 0.42);
      };
      preroll(0.25);
      g.cameraCtl.override = (cam) => {
        const k = D.lt / 2.4;
        cam.position.set(cx + 0.3, 1.8 + k * 0.8, z + 13.5 - k * 1.5);
        cam.lookAt(cx, 1.5 + k * 0.7, z);
        setCam(cam, 40);
      };
    },

    /** The army fights back: Brasília, jets and helicopters, an EMP blast. */
    async army() {
      await startRun('campanha', 'brasilia');
      maxOneBeam();
      noFrenzy();
      setMatter(2600);
      const ministries = blocksOf('G').sort((a, b) => a.cx - b.cx);
      const congress = g.world.objects.find((o) => o.def.id === 'congresso' && o.alive);
      const cx = congress ? congress.home.x : ministries[ministries.length - 1].cx;
      const cz = congress ? congress.home.z : ministries[ministries.length - 1].cz;
      const start = ministries[Math.max(0, ministries.length - 4)] ?? ministries[0];
      placeUfo(start.cx - 20, start.cz + 4);
      g.run.addThreat(1400);
      const snap = g.playerSnapshot();
      for (const k of ['jet', 'jet', 'jet', 'helicopter', 'helicopter', 'helicopter', 'helicopter', 'helicopter', 'police', 'police', 'drone', 'drone', 'drone', 'heavydrone', 'heavydrone']) g.enemies.spawn(k, snap);
      const path = [];
      for (const m of ministries.slice(Math.max(0, ministries.length - 4))) path.push([m.cx, m.cz - 4]);
      path.push([cx - 18, cz], [cx, cz]);
      D.update = () => {
        noFrenzy();
        followPath(path, 0.55);
      };
      preroll(2.2);
      {
        const u = g.ufo.position;
        const nx = path[0][0] - u.x;
        const nz = path[0][1] - u.z;
        const n = Math.hypot(nx, nz) || 1;
        const hx = nx / n;
        const hz = nz / n;
        D.state.hx = hx;
        D.state.hz = hz;
        let i = 0;
        for (const e of g.enemies.enemies) {
          if (!e.alive || e.kind !== 'helicopter') continue;
          const side = (i % 2 ? 1 : -1) * (9 + i * 2);
          const ahead = 14 + i * 5;
          e.pos.set(u.x + hx * ahead - hz * side, u.y + 1 + (i % 3) * 3, u.z + hz * ahead + hx * side);
          i++;
        }
      }
      preroll(0.4);
      chaseCam(0.8, 0.62, 64, 0.5, 0.55);
      D.update = (lt) => {
        noFrenzy();
        followPath(path, 0.55);
        if (lt >= 0.85 && !D.state.e1) {
          D.state.e1 = 1;
          g.fireEMP(2.0);
          g.cameraCtl.addTrauma(0.7);
        }
      };
    },

    /** Arena: two rival saucers swallowed back to back. */
    async arena() {
      await startRun('arena', 'recife');
      boost(3);
      const a = g.arena;
      a.time = 30;
      setMatter(220);
      const home = nearest(blocksOf('R', 'U'), g.world.start.x, g.world.start.z);
      placeUfo(home.cx - 30, home.cz);
      const p = g.ufo.position;
      const bots = a.bots;
      const prey = bots.slice(0, 2);
      const rest = bots.slice(2);
      const spots = [
        { x: p.x + 1.2, z: p.z },
        { x: p.x + 9, z: p.z - 2 },
      ];
      const preyMatter = [26, 60];
      prey.forEach((b, i) => {
        b.matter = preyMatter[i];
        b.skill = 0;
        b.pos.set(spots[i].x, b.pos.y, spots[i].z);
        b.visuals.setLevel(4 + i * 2);
      });
      rest.forEach((b, i) => {
        b.skill = 0;
        b.matter = 30 + i * 20;
        b.pos.set(p.x - 150 - i * 20, b.pos.y, p.z + 120);
      });
      const scripted = new Set(prey);
      const eaten = new Set();
      const idle = new Set(rest);
      const feed = a.feed.bind(a);
      a.feed = (b) => {
        if (!scripted.has(b) && !idle.has(b)) feed(b);
      };
      const move = a.move.bind(a);
      a.move = (b, dt) => {
        if (idle.has(b)) {
          b.vel.set(0, 0, 0);
          return;
        }
        if (!scripted.has(b)) return move(b, dt);
        const i = prey.indexOf(b);
        const sp = spots[i];
        const u = g.ufo.position;
        const dx = g.world.dx(u.x, b.pos.x);
        const dz = g.world.dz(u.z, b.pos.z);
        const d = Math.hypot(dx, dz) || 1;
        let vx = Math.sin(D.lt * 1.3 + i) * 1.5;
        let vz = Math.cos(D.lt * 1.1 + i) * 1.5;
        if (d < 18) {
          // tries to run, too slowly
          vx = (dx / d) * b.speed * 0.1;
          vz = (dz / d) * b.speed * 0.1;
        } else {
          vx += (sp.x - b.pos.x) * 0.8;
          vz += (sp.z - b.pos.z) * 0.8;
        }
        b.vel.set(vx, 0, vz);
        b.pos.x += vx * dt;
        b.pos.z += vz * dt;
      };
      const think = a.think.bind(a);
      a.think = (b, dt, pt) => {
        if (scripted.has(b) || idle.has(b)) {
          b.mode = 'wander';
          return;
        }
        think(b, dt, pt);
      };
      const swallow = a.swallow.bind(a);
      a.swallow = (by, b) => {
        if (by !== 'player' && (scripted.has(b) || scripted.has(by))) {
          b.held = 0;
          b.captor = null;
          return;
        }
        if (by === 'player') {
          log('swallow', { i: prey.indexOf(b) });
          if (scripted.has(b)) eaten.add(b);
        }
        swallow(by, b);
      };
      noFrenzy();
      g.lighting.fogMult = 0.5;
      D.update = () => {
        noFrenzy();
        const next = prey.find((b) => !eaten.has(b) && b.alive);
        if (!next) {
          flyTo(g.ufo.position.x + 40, g.ufo.position.z, 0.25);
          return;
        }
        setMatter(next.matter * 3.4);
        flyTo(next.pos.x, next.pos.z, 1);
        // snappier catches: two swallows fit in the shot
        if (next.captor === 'player') next.held += 0.011;
      };
      for (let i = 0; i < 8; i++) {
        D.update();
        preroll(1 / 30);
      }
      // the first catch is already under way when the shot opens
      prey[0].captor = 'player';
      prey[0].held = Math.max(prey[0].held, 0.55);
      topCam(0.62, 0.5, 58);
      D.tracked = { me: () => project(g.ufo.position, g.stats.radius * 0.4) };
    },

    /** Squad: four saucers in formation, each with a friend's skin, beaming a street clean. */
    async friends() {
      await startRun('arena', 'rio');
      boost(4);
      const a = g.arena;
      a.time = 30;
      setMatter(640);
      noFrenzy();
      const s = g.world.start;
      const zs = g.world.roadLines.zs;
      const z = zs.slice().sort((p, q) => Math.abs(p - s.z) - Math.abs(q - s.z))[0];
      const x0 = s.x - 40;
      placeUfo(x0, z);
      // friends' looks (the player keeps the classic saucer)
      const looks = ['canarinho', 'neon_rosa', 'lava'];
      const accents = [0xffd23f, 0xff5ad1, 0xff7a1a];
      const skins = looks.map((id) => {
        g.applyLook(id);
        return g.lookSkin;
      });
      g.applyLook('classico', 'verde');
      const bots = a.bots;
      const friends = bots.slice(0, 3);
      const rest = bots.slice(3);
      const OFF = [
        [-7, -9],
        [-7, 9],
        [-14, 3],
      ];
      friends.forEach((b, i) => {
        b.matter = g.run.progression.matter;
        b.skill = 0;
        b.visuals.applySkin(skins[i]);
        b.visuals.setAccent(accents[i]);
        b.beam.setColor(accents[i]);
        b.pos.set(x0 + OFF[i][0], b.pos.y, z + OFF[i][1]);
      });
      rest.forEach((b, i) => {
        b.skill = 0;
        b.matter = 20;
        b.pos.set(x0 - 220 - i * 20, b.pos.y, z + 160);
      });
      const squad = new Set(friends);
      const idle = new Set(rest);
      const move = a.move.bind(a);
      a.move = (b, dt) => {
        if (idle.has(b)) {
          b.vel.set(0, 0, 0);
          return;
        }
        if (!squad.has(b)) return move(b, dt);
        const i = friends.indexOf(b);
        const u = g.ufo.position;
        const wob = Math.sin(D.lt * 2.2 + i * 2) * 1.2;
        const tx = u.x + OFF[i][0] + Math.sin(D.lt * 1.4 + i) * 0.8;
        const tz = u.z + OFF[i][1] + wob;
        b.vel.set((tx - b.pos.x) * 4, 0, (tz - b.pos.z) * 4);
        b.pos.x += b.vel.x * dt;
        b.pos.z += b.vel.z * dt;
        b.matter = Math.max(b.matter, g.run.progression.matter);
      };
      const think = a.think.bind(a);
      a.think = (b, dt, pt) => {
        if (squad.has(b) || idle.has(b)) {
          b.mode = 'wander';
          return;
        }
        think(b, dt, pt);
      };
      a.swallow = (by, b) => {
        b.held = 0;
        b.captor = null;
      };
      // a street full of snacks for the whole squad
      const menu = ['hatch', 'taxi', 'moto', 'banca_jornal', 'carrinho_pipoca', 'hatch', 'orelhao', 'van', 'taxi', 'barraca_feira', 'hatch', 'onibus'];
      for (let i = 0; i < 44; i++) {
        for (const dz of [-11, 0, 11]) {
          try {
            g.world.spawn(menu[(i * 3 + dz + 33) % menu.length], x0 + 14 + i * 3.4, -1, z + dz + Math.sin(i * 2.3 + dz) * 2, Math.random() < 0.5 ? 0 : Math.PI);
          } catch {
            /* off the road */
          }
        }
      }
      D.update = () => {
        noFrenzy();
        flyTo(x0 + 400, z, 0.5);
      };
      preroll(0.6);
      g.lighting.fogMult = 0.55;
      // in front of the squad, low, looking back at them as they come
      D.state.cx = g.ufo.position.x;
      g.cameraCtl.override = (cam, dt) => {
        const u = g.ufo.position;
        D.state.cx += (u.x - D.state.cx) * (1 - Math.exp(-5 * (dt || 1 / 60)));
        const x = D.state.cx;
        const k = D.lt / 2.4;
        const r = g.stats.radius;
        cam.position.set(x - 31 - r * 2 + k * 3, u.y + 10 + r, z + 3 - k * 2);
        cam.lookAt(x + 4, u.y * 0.75, z);
        setCam(cam, 60);
      };
      const tag = (b) => () => {
        const p = b.visuals.root.position;
        return project(p, b.radius * 1.6 + 1.2);
      };
      D.tracked = {
        f0: tag(friends[0]),
        f1: tag(friends[1]),
        f2: tag(friends[2]),
        me: () => project(g.ufo.position, g.stats.radius * 1.6 + 1.2),
      };
    },

    /** Skins: close orbit of the saucer in space, swapping to ever rarer looks. */
    async skins() {
      if (g.state !== 'menu') throw new Error('skins must start from the menu');
      const Space = g.space.constructor;
      g.setSpace(false);
      g.space = new Space(true);
      g.space.resize(innerWidth, innerHeight);
      g.setSpace(true);
      g.space.startMenu();
      const space = g.space;
      space.menuCamera = function (s) {
        const cam = this.camera;
        const a = this.angle;
        const d = 4.6;
        cam.position.set(s.x + Math.sin(a) * d, s.y + 1.25, s.z + Math.cos(a) * d);
        this.look.set(s.x - Math.sin(a) * 0.3, s.y - 0.55, s.z - Math.cos(a) * 0.3);
        cam.lookAt(this.look);
      };
      g.ufoVisuals.setLevel(30);
      g.applyLook(SKIN_SHOW[0][0], 'verde');
      preroll(1.2);
      D.update = (lt) => {
        space.angle = 0.2 + lt * 0.55;
        let cur = SKIN_SHOW[0][0];
        for (const [id, at] of SKIN_SHOW) if (lt >= at) cur = id;
        if (cur !== D.state.skin) {
          if (D.state.skin) log('skin', { id: cur });
          D.state.skin = cur;
          g.applyLook(cur, 'verde');
          g.ufoVisuals.setLevel(30);
        }
      };
      D.update(0);
    },

    /** Extraction: the saucer leaves Rio and punches out of the atmosphere (end card on top). */
    async end() {
      await startRun('casual', 'rio');
      boost(4);
      setMatter(2600);
      const s = g.world.start;
      placeUfo(s.x, s.z);
      preroll(0.6);
      // extraction starts just before the shot: the launch white-out lands on the beat (22.4 s)
      g.endRun('extracted');
      preroll(0.2, 1 / 60);
    },
  };

  window.TRAILER = {
    FPS,
    SHOTS,
    SKIN_SHOW,
    get events() {
      return D.events;
    },
    get tracks() {
      return D.tracks;
    },
    async prepare(id) {
      const shot = SHOTS.find((s) => s.id === id);
      D.shot = shot;
      D.lt = 0;
      D.t = shot.t0;
      D.state = {};
      D.update = null;
      D.recording = false;
      D.dt = 1 / FPS;
      D.camZoom = 1;
      D.events = [];
      D.tracks = [];
      D.tracked = null;
      D.lastLevelFx = -9;
      g.cameraCtl.override = null;
      await SETUP[id]();
      D.recording = true;
      return { f0: Math.round(shot.t0 * FPS), f1: Math.round(shot.t1 * FPS) };
    },
    frame(i, draw = true) {
      const t = i / FPS;
      D.f = i;
      D.t = t;
      D.lt = t - D.shot.t0;
      D.update?.(D.lt);
      D.renderOn = draw;
      step(D.dt);
      D.renderOn = true;
      recordTracks();
    },
  };
})();
