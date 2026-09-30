// Diretor do trailer (9:16, 1080×1920, 30 fps, 20 s), injetado no jogo de verdade
// aberto com ?manual. Para o loop do jogo, avança a simulação com relógio fixo,
// dirige o carro (piloto automático seguindo as rotas dos capítulos), move a
// câmera por roteiro e pinta as legendas por cima. Cada cena é independente:
// capture.mjs recarrega a página, chama TRAILER.prepare(id) e TRAILER.frame(i).
(() => {
  const g = window.__game;
  const FPS = 30;
  const TAU = Math.PI * 2;
  const wrap = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (k) => k * k * (3 - 2 * k);

  // ---------- tela limpa + camada de legendas ----------
  const css = document.createElement('style');
  css.textContent = `
    #hud, #campaign-ui, #radio-panel { display: none !important; }
    #tr { position: fixed; inset: 0; pointer-events: none; z-index: 100; font-family: Anton, Impact, sans-serif; }
    #tr .vig { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 62%, rgba(0,0,0,.6) 100%); }
    #tr .cap { position: absolute; left: 0; right: 0; bottom: 250px; text-align: center; color: #fff; font-size: 66px; letter-spacing: .04em; line-height: 1.05;
      text-shadow: 0 4px 24px rgba(0,0,0,.7); opacity: 0; transform: translateY(18px); }
    #tr .cap small { display: block; margin-top: 16px; font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 26px; letter-spacing: .32em; color: #ffb14a; }
    #tr .cap i { display: block; width: 90px; height: 6px; margin: 0 auto 22px; background: #f20d24; }
    #tr .flash { position: absolute; inset: 0; background: #fff; opacity: 0; }
    #tr .end { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 28px; opacity: 0;
      background: radial-gradient(ellipse at 50% 45%, rgba(5,5,8,.25), rgba(5,5,8,.8) 70%); }
    #tr .end img { width: 860px; height: auto; filter: drop-shadow(0 10px 40px rgba(0,0,0,.9)); }
    #tr .end b { font-size: 60px; color: #fff; letter-spacing: .06em; }
    #tr .end small { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 28px; letter-spacing: .36em; color: #ffb14a; }
  `;
  document.head.appendChild(css);
  const tr = document.createElement('div');
  tr.id = 'tr';
  tr.innerHTML = `<div class="vig"></div><div class="cap"><i></i><span></span><small></small></div>
    <div class="end"><img src="./logo-game.webp" alt=""/><b>JOGUE GRÁTIS</b><small>bsbass.fun</small></div><div class="flash"></div>`;
  document.body.appendChild(tr);
  const capEl = tr.querySelector('.cap'), capTxt = capEl.querySelector('span'), capSub = capEl.querySelector('small');
  const flashEl = tr.querySelector('.flash'), endEl = tr.querySelector('.end');
  /** legenda com entrada/saída suave entre t0 e t1 (segundos da cena) */
  function caption(t, t0, t1, text, sub = '') {
    capTxt.textContent = text;
    capSub.textContent = sub;
    const a = clamp((t - t0) / 0.35, 0, 1) * clamp((t1 - t) / 0.3, 0, 1);
    capEl.style.opacity = String(a);
    capEl.style.transform = `translateY(${(1 - ease(clamp((t - t0) / 0.35, 0, 1))) * 18}px)`;
  }
  /** flash branco curto no começo da cena (corte no tempo) */
  function flash(t) {
    flashEl.style.opacity = String(clamp(0.55 - t * 3.2, 0, 0.55));
  }

  // ---------- câmera por roteiro ----------
  let camFn = null;
  const origCam = g.updateCamera.bind(g);
  g.updateCamera = (dt) => {
    origCam(dt);
    if (camFn) camFn(g.camera);
  };
  const look = (cam, px, py, pz, lx, ly, lz) => {
    cam.position.set(px, py, pz);
    cam.lookAt(lx, ly, lz);
  };

  // ---------- piloto automático seguindo uma rota ----------
  function nearest(r, x, z, from, to) {
    let best = from, bd = Infinity;
    for (let k = from; k <= to; k++) {
      const i = ((k % r.n) + r.n) % r.n;
      const d = (r.P[i * 2] - x) ** 2 + (r.P[i * 2 + 1] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function follower(r, o = {}) {
    let s = null;
    const top = o.speed ?? 26;
    return () => {
      const c = g.car;
      s = s === null ? nearest(r, c.x, c.z, 0, r.n - 1) : nearest(r, c.x, c.z, s - 12, s + 30);
      const la = 6 + c.speed * 0.42;
      const j = Math.round(s + la) % r.n;
      const err = wrap(Math.atan2(r.P[j * 2] - c.x, r.P[j * 2 + 1] - c.z) - c.heading);
      let kmax = 0;
      for (let k = 4; k < 32; k++) kmax = Math.max(kmax, Math.abs(r.K[(s + k) % r.n]));
      const vT = kmax > 0.03 ? (o.corner ?? 16) : top;
      const drift = o.drift !== false && kmax > 0.035 && c.speed > 12 && Math.abs(err) > 0.2;
      return {
        throttle: c.speed < vT ? 1 : drift ? 0.7 : 0.15,
        brake: c.speed > vT + 7 && !drift ? 0.5 : 0,
        steer: clamp(err * (o.gain ?? 2.4), -1, 1),
        handbrake: drift && Math.abs(err) < 0.9,
        nitro: !!o.nitro && kmax < 0.01 && c.speed > 18,
      };
    };
  }
  /** põe o carro na rota r, no metro s, andando a v m/s */
  function placeOnRoute(r, s, v, lateral = 0) {
    const i = ((s % r.n) + r.n) % r.n;
    const fx = r.F[i * 2], fz = r.F[i * 2 + 1];
    const x = r.P[i * 2] + r.R[i * 2] * lateral, z = r.P[i * 2 + 1] + r.R[i * 2 + 1] * lateral;
    const h = Math.atan2(fx, fz);
    g.car.reset(x, z, h);
    g.car.vx = fx * v;
    g.car.vz = fz * v;
  }
  /** primeira curva forte da rota a partir de s */
  function nextCorner(r, s) {
    for (let k = 0; k < r.n; k++) {
      const i = (s + k) % r.n;
      if (Math.abs(r.K[i]) > 0.06) return s + k;
    }
    return s;
  }

  const sim = (sec, dt = 1 / FPS) => { for (let k = 0; k < Math.round(sec / dt); k++) g.frame(dt, false); };
  const routes = () => g.campaign.routes;

  // ---------- cenas ----------
  const T = { t: 0 };
  const shots = {
    // 0–3 s: aéreo na chuva em volta da Caixa d'Água, descendo
    aereo: {
      frames: 90,
      prepare() {
        const r = routes()[0];
        placeOnRoute(r, 30, 18);
        g.setAutopilot(follower(r, { speed: 20, drift: false }));
        sim(1);
        camFn = (cam) => {
          const k = ease(T.t / 3);
          const a = lerp(-0.9, -0.2, k);
          const rad = lerp(120, 70, k);
          look(cam, Math.sin(a) * rad, lerp(62, 26, k), Math.cos(a) * rad - 20, 0, lerp(18, 22, k), 0);
        };
      },
      step(t) { caption(t, 0.5, 2.85, 'PERIFERIA DO DF', 'MADRUGADA · CHUVA · GRAVE'); },
    },
    // 3–7 s: câmera baixa acompanhando o drift numa esquina
    drift: {
      frames: 120,
      prepare() {
        const r = routes()[0];
        const c0 = nextCorner(r, 40);
        placeOnRoute(r, c0 - 55, 22);
        g.setAutopilot(follower(r, { speed: 25, corner: 17, gain: 2.6 }));
        sim(0.8);
        const cam0 = { x: 0, z: 0, init: false };
        camFn = (cam) => {
          const c = g.car;
          const vy = Math.atan2(c.vx, c.vz);
          // lateral e um pouco à frente, bem baixo, suavizado
          const px = c.x + Math.cos(vy) * 5.5 - Math.sin(vy) * 1.5, pz = c.z - Math.sin(vy) * 5.5 - Math.cos(vy) * 1.5;
          if (!cam0.init) { cam0.x = px; cam0.z = pz; cam0.init = true; }
          cam0.x = lerp(cam0.x, px, 0.18);
          cam0.z = lerp(cam0.z, pz, 0.18);
          look(cam, cam0.x, 0.9, cam0.z, c.x, 0.7, c.z);
        };
      },
      step(t) { flash(t); caption(t, 0.4, 3.8, 'DRIFT NO GRAVE'); },
    },
    // 7–9,4 s: câmera lenta no poste caindo (cai no respiro da música)
    poste: {
      frames: 72,
      prepare() {
        const b = g.breakables;
        const pick = () => {
          for (const it of b.items) {
            if (it.lamp < 0 || it.state !== 'idle') continue;
            // rua livre por 40 m na direção do braço do poste (ele fica na calçada)
            const li = g.meshes.lampInst.lamps[it.lamp];
            const ax = li.dirZ !== 0 ? 1 : 0, az = li.dirX !== 0 ? 1 : 0; // ao longo da calçada
            for (const sg of [1, -1]) {
              let ok = true;
              for (let d = 3; d <= 40 && ok; d += 1) {
                const x = it.p0.x - ax * sg * d + li.dirX * 1.6, z = it.p0.z - az * sg * d + li.dirZ * 1.6;
                if (g.grid.near(x - 1.4, z - 1.4, x + 1.4, z + 1.4, []).some((s) => s !== it.shape)) ok = false;
              }
              if (ok) return { it, ax: ax * sg, az: az * sg, li };
            }
          }
          return null;
        };
        const p = pick();
        this.p = p;
        const { it, ax, az, li } = p;
        // vem pela beira da rua, mira meio de lado no poste
        const sx = it.p0.x - ax * 38 + li.dirX * 1.3, sz = it.p0.z - az * 38 + li.dirZ * 1.3;
        const h = Math.atan2(ax, az);
        g.car.reset(sx, sz, h);
        g.car.vx = ax * 24;
        g.car.vz = az * 24;
        g.setAutopilot(() => {
          const c = g.car;
          const err = wrap(Math.atan2(it.p0.x - c.x, it.p0.z - c.z) - c.heading);
          return { throttle: 1, steer: clamp(err * 1.6, -0.5, 0.5) };
        });
        // câmera parada do outro lado da rua, baixa, olhando o poste
        const cx = it.p0.x + li.dirX * 9 + ax * 7, cz = it.p0.z + li.dirZ * 9 + az * 7;
        camFn = (cam) => {
          const c = g.car;
          const k = clamp(T.t / 3, 0, 1);
          const tx = lerp(c.x, it.p0.x, 0.55), tz = lerp(c.z, it.p0.z, 0.55);
          look(cam, cx, 1.1 + k * 0.6, cz, tx, 2.2 + k, tz);
        };
        this.hitAt = null;
      },
      dt() {
        // câmera lenta a partir do impacto
        const it = this.p.it;
        if (it.state !== 'idle' && this.hitAt === null) this.hitAt = T.t;
        return this.hitAt === null ? 1 / FPS : (1 / FPS) * 0.3;
      },
      step(t) { flash(t); caption(t, 0.3, 2.3, 'DERRUBA O QUE VIER'); },
    },
    // 9,4–14 s: capítulo 4, fuga com a polícia (volta a batida)
    policia: {
      frames: 138,
      prepare() {
        const cm = g.campaign;
        // save novo: libera o capítulo 4 (só na memória desta página)
        for (const id of ['c1', 'c2', 'c3']) cm.save.data.chapters[id] = { done: true, best: 0, stars: [true, true, true] };
        cm.startChapter(3);
        const r = routes()[3];
        g.setAutopilot(follower(r, { speed: 27, corner: 17, gain: 2.5 }));
        // pula a abertura e deixa a perseguição esquentar
        for (let k = 0; k < 60 * 30 && cm.mission.state !== 'play'; k++) g.frame(1 / FPS, false);
        sim(9);
        const sm = { x: 0, z: 0, init: false };
        camFn = (cam) => {
          const c = g.car;
          const vy = Math.atan2(c.vx, c.vz);
          // na frente do carro, olhando pra trás: o Mustang vindo e as viaturas na cola
          const px = c.x + Math.sin(vy) * 8 + Math.cos(vy) * 1.8, pz = c.z + Math.cos(vy) * 8 - Math.sin(vy) * 1.8;
          if (!sm.init) { sm.x = px; sm.z = pz; sm.init = true; }
          sm.x = lerp(sm.x, px, 0.3);
          sm.z = lerp(sm.z, pz, 0.3);
          look(cam, sm.x, 1.5, sm.z, c.x - Math.sin(vy) * 5, 1.1, c.z - Math.cos(vy) * 5);
        };
      },
      step(t) { flash(t); caption(t, 0.4, 4.4, '5 CAPÍTULOS', 'A POLÍCIA NA COLA'); },
    },
    // 14–17 s: o ferro-velho, câmera girando devagar
    ferro: {
      frames: 90,
      prepare() {
        const y = g.campaign.yard;
        const p = y.pt(3, -2);
        g.car.reset(p.x, p.z, Math.atan2(-y.toRoad.x, -y.toRoad.z));
        g.setAutopilot(() => ({ brake: 1 }));
        sim(1.5);
        const C = y.pt(0, -4);
        camFn = (cam) => {
          const k = T.t / 3;
          const a = Math.atan2(y.toRoad.x, y.toRoad.z) + lerp(-0.55, 0.15, ease(k));
          look(cam, C.x + Math.sin(a) * 19, lerp(3.2, 5.5, k), C.z + Math.cos(a) * 19, C.x, 4.5, C.z);
        };
      },
      step(t) { flash(t); caption(t, 0.4, 2.85, 'O FERRO-VELHO', 'BASE DO BONDE'); },
    },
    // 17–20 s: cavalinho de pneu com fumaça + logo
    fim: {
      frames: 90,
      prepare() {
        const lamps = g.meshes.lampInst.lamps;
        const l = lamps.find((q) => Math.abs(q.x) < 200 && Math.abs(q.z) < 200 && q.dirX !== 0) || lamps[0];
        const cx = l.x + l.dirX * 5, cz = l.z;
        g.car.reset(cx, cz, 0);
        g.setAutopilot((t) => ({ throttle: 1, steer: 1, handbrake: t % 1.2 < 0.25 }));
        sim(2.2);
        camFn = (cam) => {
          const c = g.car;
          const a = 0.6 + T.t * 0.35;
          look(cam, cx + Math.sin(a) * 9, 1.4 + T.t * 0.25, cz + Math.cos(a) * 9, c.x, 1.3, c.z);
        };
      },
      step(t) {
        flash(t);
        capEl.style.opacity = '0';
        const a = clamp((t - 0.7) / 0.6, 0, 1);
        endEl.style.opacity = String(a);
        endEl.querySelector('img').style.transform = `scale(${1.08 - ease(a) * 0.08})`;
      },
    },
  };
  const ORDER = ['aereo', 'drift', 'poste', 'policia', 'ferro', 'fim'];

  let cur = null;
  window.TRAILER = {
    FPS,
    ORDER,
    frames: (id) => shots[id].frames,
    total: () => ORDER.reduce((n, id) => n + shots[id].frames, 0),
    /** índice global do primeiro quadro da cena */
    offset: (id) => ORDER.slice(0, ORDER.indexOf(id)).reduce((n, k) => n + shots[k].frames, 0),
    prepare(id) {
      cur = shots[id];
      T.t = 0;
      capEl.style.opacity = '0';
      endEl.style.opacity = '0';
      flashEl.style.opacity = '0';
      g.settings.shake = false;
      g.settings.orbit = false;
      cur.prepare();
    },
    /** avança um quadro da cena e desenha */
    frame(render = true) {
      const dt = cur.dt ? cur.dt() : 1 / FPS;
      cur.step(T.t);
      g.frame(dt, render);
      T.t += 1 / FPS;
    },
  };
})();
