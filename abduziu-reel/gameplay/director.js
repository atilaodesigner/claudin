/*
 * ABDUZIU — gameplay clips (16:9, 1920×1080, 60 fps, ≤15 s each), no text at all.
 *
 * Injected into the real game (same build as abduziu.fun). Stops the game's own loop
 * and advances the simulation with a fixed clock, hides every piece of UI, and scripts
 * the saucer + camera for five short, loopable moments. Every abduction, level-up,
 * explosion, EMP and swallow is logged in TRAILER.events for the sound design.
 *
 *   await TRAILER.prepare('espaco')   // builds the clip
 *   TRAILER.frame(i)                  // advances one frame (i = 0..)
 */
(() => {
  const FPS = 60;
  const g = window.__game;

  const SHOTS = [
    { id: 'espaco', t0: 0, t1: 15 },
    { id: 'gigante', t0: 0, t1: 15 },
    { id: 'frenesi', t0: 0, t1: 12 },
    { id: 'exercito', t0: 0, t1: 15 },
    { id: 'arena', t0: 0, t1: 15 },
  ];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  const D = { now: 0, move: { x: 0, y: 0 }, shot: null, lt: 0, t: 0, renderOn: true, state: {}, events: [], dt: 1 / FPS, recording: false, camZoom: 1 };
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
  const origRenderFrame = g.renderFrame.bind(g);
  g.renderFrame = (dt, rdt) => {
    D.beforeRender?.(dt);
    origRenderFrame(dt, rdt);
  };
  const origCamUpdate = g.cameraCtl.update.bind(g.cameraCtl);
  g.cameraCtl.update = (dt, target, vel, scale, maxSpeed, extraZoom, fov) => origCamUpdate(dt, target, vel, scale, maxSpeed, extraZoom * D.camZoom, fov);

  // ── sound design log
  const origAbsorbed = g.run.onAbsorbed.bind(g.run);
  g.run.onAbsorbed = (o) => {
    log('pop', { tier: o.def.tier, combo: g.run.combo.count + 1 });
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

  // growth videos level up every half second: keep one level-up burst per 1.6 s
  const origLevelFx = g.vfx.levelUp.bind(g.vfx);
  g.vfx.levelUp = (...a) => {
    if (D.t - (D.lastLevelFx ?? -9) < 1.6) return;
    D.lastLevelFx = D.t;
    origLevelFx(...a);
  };

  function step(dt = 1 / FPS) {
    D.now += dt * 1000;
    g.frame(dt, D.now);
  }
  function preroll(seconds, dt = 1 / 30) {
    D.renderOn = false;
    for (let t = 0; t < seconds; t += dt) step(dt);
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
  /** High follow camera that always stays above the rooftops. */
  function topCam(zoom = 1, tilt = 0.5, fov = 50) {
    D.state.tc = null;
    g.cameraCtl.override = (cam, dt) => {
      const u = g.ufo.position;
      const c = (D.state.tc ??= { x: u.x, z: u.z, r: g.stats.radius });
      const k = 1 - Math.exp(-4 * (dt || 1 / 60));
      c.x += (u.x - c.x) * k;
      c.z += (u.z - c.z) * k;
      c.r += (g.stats.radius - c.r) * (1 - Math.exp(-2 * (dt || 1 / 60)));
      const d = (26 + c.r * 11) * zoom;
      const cz = c.z + d * tilt;
      const roof = g.world.heightField ? g.world.heightField.maxInRadius(c.x, cz, 16) : 0;
      cam.position.set(c.x, Math.max(u.y * 0.3 + d * 0.95, roof + 14), cz);
      cam.lookAt(c.x, 0, c.z - d * 0.12);
      cam.fov = fov;
      cam.updateProjectionMatrix();
    };
  }
  function blockAt(col, row) {
    return g.world.blocks.find((b) => b.col === col && b.row === row);
  }
  /** Chase camera: behind/above the saucer along its heading, eased. */
  function chaseCam(dist = 1, height = 0.62, fov = 52, side = 0.35) {
    D.state.cc = null;
    g.cameraCtl.override = (cam, dt) => {
      const u = g.ufo.position;
      const v = g.ufo.velocity;
      const c = (D.state.cc ??= { x: u.x, z: u.z, hx: 0, hz: -1, r: g.stats.radius });
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
      // behind the heading, a little to the side
      const bx = -c.hx + -c.hz * side;
      const bz = -c.hz + c.hx * side;
      cam.position.set(c.x + bx * d, u.y * 0.4 + d * height, c.z + bz * d);
      cam.lookAt(c.x + c.hx * d * 0.25, 0, c.z + c.hz * d * 0.25);
      cam.fov = fov;
      cam.updateProjectionMatrix();
    };
  }

  // ───────────────────────────────────────────────────────── clips
  const SETUP = {
    /** Orbit → dive into Rio → through the clouds → sweeping Copacabana. */
    async espaco() {
      if (g.state !== 'menu') throw new Error('espaco must start from the menu (load with ?city=rio)');
      // the recorder is a software renderer: rebuild the planet with the desktop textures
      const Space = g.space.constructor;
      g.setSpace(false);
      g.space = new Space(true);
      g.space.resize(innerWidth, innerHeight);
      g.setSpace(true);
      g.space.startMenu();
      const space = g.space;
      // land right on the Copacabana promenade
      const sand = blocksOf('A');
      const beach = nearest(sand, g.world.start.x, g.world.start.z);
      g.world.start = { x: beach.cx, z: beach.cz - 18 };
      // a packed Sunday on the sand along the sweep
      {
        const dir = beach.cx > 0 ? -1 : 1;
        const kit = ['guarda_sol', 'cadeira_praia', 'cadeira_praia', 'isopor', 'prancha', 'coco', 'bola', 'guarda_sol', 'cadeira_praia', 'chinelo', 'copo_acai', 'melancia'];
        const pal = [0xef476f, 0x118ab2, 0x06d6a0, 0xffd166, 0xf77f00, 0x8338ec];
        let n = 0;
        for (let i = 0; i < 60; i++) {
          for (let j = -2; j <= 2; j++) {
            const x = beach.cx + dir * (4 + i * 2.6) + (j % 2) * 1.2;
            const zz = beach.cz - 4 + j * 2.4 + Math.sin(i * 1.7 + j) * 0.5;
            try {
              g.world.spawn(kit[n++ % kit.length], x, -1, zz, (i * 0.7 + j) % 6.28, { paint: pal[(i + j + 6) % pal.length] });
            } catch {
              /* sand edge */
            }
          }
        }
      }
      // centred composition (the menu keeps room for the logo on the left)
      space.menuCamera = function (s) {
        const cam = this.camera;
        const a = this.angle;
        const d = 7.6;
        cam.position.set(s.x + Math.sin(a) * d, s.y + 1.9, s.z + Math.cos(a) * d);
        this.look.set(s.x - Math.sin(a) * 2.2, s.y - 1.7, s.z - Math.cos(a) * 2.2);
        cam.lookAt(this.look);
      };
      space.angle = 0.25;
      preroll(0.5);
      D.update = (lt) => {
        if (lt >= 2.3 && !D.state.started) {
          D.state.started = 1;
          log('dive');
          void g.startRun('casual', 'rio');
          godMode();
        }
        if (D.state.started && g.state === 'playing' && !D.state.play) {
          D.state.play = 1;
          godMode();
          noFrenzy();
          boost(5);
          setMatter(260);
          // sweep along Copacabana: umbrellas, chairs, people, kiosks
          const z = beach.cz - 4;
          const dir = beach.cx > 0 ? -1 : 1;
          D.state.path = [[beach.cx + dir * 6, z], [beach.cx + dir * 50, z + 4], [beach.cx + dir * 100, z - 3], [beach.cx + dir * 160, z + 3]];
          D.state.pi = 0;
        }
        if (D.state.play) followPath(D.state.path, 0.55);
      };
    },

    /** One continuous take: a tiny saucer ends up eating the São Paulo skyline. */
    async gigante() {
      await startRun('casual', 'rio');
      boost(4);
      noFrenzy();
      // spiral out from a shopping street into Rio's towers
      const a0 = blockAt(4, 1) ?? nearest(blocksOf('C'));
      const b0 = blockAt(5, 2) ?? nearest(blocksOf('F'));
      const c = { x: (a0.cx + b0.cx) / 2, z: (a0.cz + b0.cz) / 2 };
      D.state.ang = 0;
      placeUfo(c.x + 8, c.z);
      preroll(0.4);
      g.lighting.fogMult = 0.28; // the director's camera pulls far back: keep the skyline crisp
      topCam(0.95, 0.72, 50);
      D.update = (lt) => {
        noFrenzy();
        // matter grows exponentially: cans → cars → houses → towers
        setMatter(14 * Math.pow(4200, clamp(lt / 13.5, 0, 1)));
        const r = 8 + lt * 5.2;
        D.state.ang += ((g.stats.speed ?? 10) * 0.75) / Math.max(8, r) / 60;
        const a = D.state.ang + 0.5;
        flyTo(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, 1);
      };
    },

    /** Max-level frenzy over downtown São Paulo, slow motion from a low angle. */
    async frenesi() {
      await startRun('casual', 'sao_paulo');
      maxOneBeam();
      setMatter(11000);
      const b = nearest(blocksOf('F', 'C'), 40, -60);
      placeUfo(b.cx - 60, b.cz + 6);
      preroll(0.5);
      g.run.combo.forceFrenzy();
      D.dt = 1 / 100; // 0.6× speed: every object readable in the vortex
      D.update = (lt) => {
        if (!g.run.combo.frenzy) g.run.combo.forceFrenzy();
        flyTo(b.cx + 140, b.cz - 20, 0.42);
      };
      g.cameraCtl.override = (cam) => {
        const u = g.ufo.position;
        const k = D.lt / 12;
        const r = lerp(118, 96, k) + g.stats.radius * 1.4;
        const a = 0.75 + k * 0.7;
        const cx = u.x + Math.cos(a) * r;
        const cz = u.z + Math.sin(a) * r;
        const roof = g.world.heightField ? g.world.heightField.maxInRadius(cx, cz, 18) : 0;
        cam.position.set(cx, Math.max(lerp(30, 42, k), roof + 12), cz);
        cam.lookAt(u.x, u.y * 0.55, u.z);
        cam.fov = 50;
        cam.updateProjectionMatrix();
      };
    },

    /** Brasília under attack: jets, helicopters, EMP blasts and the Congresso ripped out. */
    async exercito() {
      await startRun('campanha', 'brasilia');
      maxOneBeam();
      noFrenzy();
      setMatter(5200);
      const ministries = blocksOf('G').sort((a, b) => a.cx - b.cx);
      const congress = g.world.objects.find((o) => o.def.id === 'congresso' && o.alive);
      const cx = congress ? congress.home.x : ministries[ministries.length - 1].cx;
      const cz = congress ? congress.home.z : ministries[ministries.length - 1].cz;
      const start = ministries[0];
      placeUfo(start.cx - 30, start.cz + 4);
      g.run.addThreat(1200);
      const snap = g.playerSnapshot();
      for (const k of ['jet', 'jet', 'jet', 'helicopter', 'helicopter', 'helicopter', 'police', 'police', 'drone', 'drone', 'heavydrone']) g.enemies.spawn(k, snap);
      preroll(2.6);
      D.camZoom = 1.15;
      chaseCam(1.05, 0.55, 54, 0.45);
      const path = [];
      for (const m of ministries) path.push([m.cx, m.cz - 4]);
      path.push([cx - 18, cz], [cx, cz], [cx + 6, cz]);
      D.update = (lt) => {
        noFrenzy();
        followPath(path, lt > 10.5 ? 0.35 : 0.62);
        if (lt >= 4.6 && !D.state.e1) {
          D.state.e1 = 1;
          g.fireEMP(1.8);
          g.cameraCtl.addTrauma(0.6);
        }
        if (lt >= 8.2 && !D.state.more) {
          D.state.more = 1;
          const s2 = g.playerSnapshot();
          for (const k of ['jet', 'jet', 'helicopter', 'helicopter', 'heavydrone']) g.enemies.spawn(k, s2);
        }
        if (lt >= 10.2 && !D.state.big) {
          D.state.big = 1;
          setMatter(17000); // big enough for the Congresso
        }
        if (lt >= 11.6 && !D.state.e2) {
          D.state.e2 = 1;
          g.fireEMP(2.2);
          g.cameraCtl.addTrauma(0.8);
        }
      };
    },

    /** Arena .io: a chain of swallowed saucers, each bigger than the last. */
    async arena() {
      await startRun('arena', 'recife');
      boost(3);
      const a = g.arena;
      a.time = 30;
      setMatter(160);
      const home = nearest(blocksOf('R', 'U'), g.world.start.x, g.world.start.z);
      placeUfo(home.cx - 30, home.cz);
      const p = g.ufo.position;
      const bots = a.bots;
      const preyMatter = [22, 70, 190, 480, 1300];
      const prey = bots.slice(0, preyMatter.length);
      const rest = bots.slice(preyMatter.length);
      // prey laid out along a gentle arc ahead of us
      const spots = [];
      let x = p.x;
      let z = p.z;
      for (let i = 0; i < prey.length; i++) {
        x += 10 + i * 2.5;
        z += (i % 2 ? 1 : -1) * (3 + i);
        spots.push({ x, z });
        const b = prey[i];
        b.matter = preyMatter[i];
        b.skill = 0;
        b.pos.set(x, b.pos.y, z);
        b.visuals.setLevel(3 + i * 2);
      }
      // the others far away, no pacing
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
        // idles near its spot, runs (too slowly) once we get close
        let vx = Math.sin(D.lt * 1.3 + i) * 2;
        let vz = Math.cos(D.lt * 1.1 + i) * 2;
        if (d < 24) {
          vx = (dx / d) * b.speed * 0.08;
          vz = (dz / d) * b.speed * 0.08;
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
        // the scripted prey are only for us
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
      preroll(0.3);
      noFrenzy();
      g.lighting.fogMult = 0.5;
      topCam(1.05, 0.55, 50);
      D.update = () => {
        noFrenzy();
        const next = prey.find((b) => !eaten.has(b) && b.alive);
        if (!next) {
          flyTo(g.ufo.position.x + 40, g.ufo.position.z, 0.25);
          return;
        }
        // always big enough for the next bite (the swallows do most of the growing)
        setMatter(next.matter * 3.4);
        flyTo(next.pos.x, next.pos.z, 1);
      };
    },
  };

  window.TRAILER = {
    FPS,
    SHOTS,
    get events() {
      return D.events;
    },
    async prepare(id) {
      const shot = SHOTS.find((s) => s.id === id);
      D.shot = shot;
      D.lt = 0;
      D.t = 0;
      D.state = {};
      D.update = null;
      D.beforeRender = null;
      D.recording = false;
      D.dt = 1 / FPS;
      D.camZoom = 1;
      D.events = [];
      D.lastLevelFx = -9;
      D.resetFog?.();
      g.cameraCtl.override = null;
      await SETUP[id]();
      D.recording = true;
      return { f0: Math.round(shot.t0 * FPS), f1: Math.round(shot.t1 * FPS) };
    },
    frame(i, draw = true) {
      const t = i / FPS;
      D.t = t;
      D.lt = t - D.shot.t0;
      D.update?.(D.lt);
      D.renderOn = draw;
      step(D.dt);
      D.renderOn = true;
    },
  };
})();
