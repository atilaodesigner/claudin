/*
 * ABDUZIU × Tripo showreel — game shots (9:16, 1080×1920, 30 fps), no UI.
 *   ideia   Brasília swallowed by a giant beam (opening)
 *   proto   the same Brasília as a grey blockout (the prototype)
 *   payoff  the Tripo characters swimming belly-up into the beam
 */
(() => {
  const FPS = 30;
  const g = window.__game;
  const SHOTS = [
    { id: 'ideia', t0: 0, t1: 7 },
    { id: 'proto', t0: 0, t1: 5.5 },
    { id: 'payoff', t0: 0, t1: 6 },
  ];
  const SKIN_SHOW = [];

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
  async function startRun(mode, city, seed = 424242) {
    D.renderOn = false;
    await g.startRun(mode, city, seed);
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
    async ideia() {
      await startRun('casual', 'brasilia');
      maxOneBeam();
      noFrenzy();
      setMatter(6200);
      const ministries = blocksOf('G').sort((a, b) => a.cx - b.cx);
      const congress = g.world.objects.find((o) => o.def.id === 'congresso' && o.alive);
      const cx = congress ? congress.home.x : ministries[ministries.length - 1].cx;
      const cz = congress ? congress.home.z : ministries[ministries.length - 1].cz;
      const start = ministries[Math.max(0, ministries.length - 5)] ?? ministries[0];
      placeUfo(start.cx - 30, start.cz + 4);
      const path = [];
      for (const m of ministries.slice(Math.max(0, ministries.length - 5))) path.push([m.cx, m.cz - 4]);
      path.push([cx - 18, cz], [cx, cz], [cx + 30, cz]);
      D.update = () => {
        noFrenzy();
        followPath(path, 0.42);
      };
      for (let i = 0; i < 80; i++) {
        D.update();
        preroll(1 / 30);
      }
      D.dt = 1 / 45; // a touch of slow motion
      g.cameraCtl.override = (cam) => {
        const u = g.ufo.position;
        const k = D.lt / 7;
        const r = lerp(95, 70, k) + g.stats.radius * 1.4;
        const a = -0.9 + k * 0.7;
        const px = u.x + Math.cos(a) * r;
        const pz = u.z + Math.sin(a) * r;
        const ty = u.y * 0.62;
        const want = clearY(px, lerp(38, 30, k), pz, u.x, ty, u.z, 6);
        D.state.hy = D.state.hy == null ? want : D.state.hy + (want - D.state.hy) * 0.1;
        cam.position.set(px, D.state.hy, pz);
        cam.lookAt(u.x, ty, u.z);
        setCam(cam, 62);
      };
    },

    async proto() {
      await startRun('casual', 'brasilia');
      boost(4);
      noFrenzy();
      setMatter(520);
      // blockout look: every city material becomes plain clay, the saucer and its beam stay
      const keep = new Set();
      for (const root of [g.ufoVisuals.root, g.beam.group, g.sky.mesh]) root.traverse((o) => keep.add(o));
      const clay = new Map();
      const toClay = () =>
        g.scene.traverse((o) => {
          if (keep.has(o) || !o.material || Array.isArray(o.material)) return;
          if (o.name?.startsWith('crowd:')) {
            o.visible = false;
            return;
          }
          if (o.isInstancedMesh && o.instanceColor) o.instanceColor = null;
          if (o.isBatchedMesh && o._colorsTexture) o._colorsTexture = null;
          const m = o.material;
          if (clay.has(m) || [...clay.values()].includes(m)) {
            if (clay.has(m)) o.material = clay.get(m);
            return;
          }
          if (!o.isMesh || m.isSpriteMaterial || m.isPointsMaterial || m.transparent) return;
          clay.set(m, CLAY);
          o.material = CLAY;
        });
      const CLAY = new (g.sky.mesh.material.constructor.name === 'MeshStandardMaterial' ? g.sky.mesh.material.constructor : findStd())({ color: 0xc4c7ce, roughness: 0.95, metalness: 0, flatShading: true });
      function findStd() {
        let C = null;
        g.scene.traverse((o) => {
          if (!C && o.material?.isMeshStandardMaterial) C = o.material.constructor;
        });
        return C;
      }
      toClay();
      g.npcs.drawCrowd = () => {};
      g.sky.mesh.visible = false;
      g.scene.background = new g.beam.color.constructor(0x34383f);
      g.scene.fog && g.scene.fog.color && g.scene.fog.color.setHex(0x34383f);
      const s = g.world.start;
      const b = nearest(blocksOf('R', 'C', 'Q'), s.x, s.z) ?? { cx: s.x, cz: s.z };
      placeUfo(b.cx - 20, b.cz);
      D.update = () => {
        noFrenzy();
        toClay();
        flyTo(b.cx + 120, b.cz + 6, 0.38);
      };
      preroll(0.6);
      topCam(0.85, 0.75, 58, 2);
    },

    async payoff() {
      await startRun('casual', 'brasilia');
      const L = g.upgrades.levels;
      noFrenzy();
      setMatter(70);
      // an open spot (no props or trees around) near a Tripo pedestrian
      const people = g.npcs.npcs.filter((n) => n.look >= 0);
      const props = g.world.objects.filter((o) => o.alive && !o.living);
      let best = people[0];
      let bestN = 1e9;
      for (const p of people) {
        const gy0 = g.world.groundAt(p.x, p.z);
        if (gy0 < 0.05) continue;
        let k = 0;
        for (const o of props) {
          const d = Math.hypot(o.home.x - p.x, o.home.z - p.z);
          if (d < 16) k += o.def.massKg > 800 || d < 8 ? 3 : 1;
        }
        k += Math.max(0, g.world.heightField.maxInRadius(p.x, p.z, 14) - gy0) * 4;
        if (k < bestN) {
          bestN = k;
          best = p;
        }
      }
      // a few more of them gathered around, so the beam fills up
      people
        .filter((p) => p !== best)
        .sort((a, b) => Math.hypot(a.x - best.x, a.z - best.z) - Math.hypot(b.x - best.x, b.z - best.z))
        .slice(0, 9)
        .forEach((p, i) => {
          const a = i * 2.4;
          p.x = best.x + Math.cos(a) * (1.5 + (i % 3));
          p.z = best.z + Math.sin(a) * (1.5 + (i % 3));
          p.spawnX = p.x;
          p.spawnZ = p.z;
          p.y = g.world.groundAt(p.x, p.z);
        });
      const c = { x: best.x, z: best.z };
      placeUfo(c.x - 7, c.z);
      D.update = () => {
        noFrenzy();
        flyTo(c.x + 3, c.z, 0.25);
      };
      preroll(0.5);
      D.dt = 1 / 55; // slow motion: they float longer
      const gy = g.world.groundAt(c.x, c.z);
      g.cameraCtl.override = (cam) => {
        const u = g.ufo.position;
        const k = D.lt / 6;
        const a = 0.7 + k * 0.5;
        const px = u.x + Math.cos(a) * 10;
        const pz = u.z + Math.sin(a) * 10;
        cam.position.set(px, Math.min(gy + 7, clearY(px, gy + 1.4 + k * 1.2, pz, u.x, gy + 3.5, u.z, 1.5)), pz);
        cam.lookAt(u.x, gy + 3.6 + k * 1.8, u.z);
        setCam(cam, 62);
      };
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
