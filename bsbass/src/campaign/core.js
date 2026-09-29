// Núcleo de regras do BSBASS THE GAME (bsbass/site/index.html), copiado sem
// mudar números nem lógica: configuração, carros, pilotos, pinturas, os 5
// capítulos, física 2D (usada pela IA do bonde), pontuação/combo, fila de
// mensagens, save versionado, desafios e recompensas. Mudou só o jeito de
// exportar (módulo ES em vez de variável global).
/* eslint-disable */
export const BSB = (function () {
  'use strict';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const wrapAng = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const DEG = Math.PI / 180;

  // ------------------------------------------------------------ CONFIG
  const CONFIG = {
    sim: { hz: 60, maxSteps: 5 },
    control: {
      scheme: 'wheel',       // 'wheel' = volante + pedais + freio de mão; 'thumb' = um dedo, acelera sozinho
      wheelMaxDeg: 120,      // giro do volante do batente ao centro
      wheelReturn: 6,        // rad/s de retorno do volante ao soltar
      deadzone: 0.08,        // fração do raio do joystick ignorada
      driftThreshold: 0.55,  // esterço (0..1) que inicia o drift quando mantido
      driftHold: 0.12,       // s segurando acima do limiar
      driftMinSpeed: 12,     // m/s
      releaseThreshold: 0.3, // abaixo disso o drift termina e a aderência volta
      joyRadius: 64,         // px
      regionTop: 0.4         // joystick só nasce abaixo de 40% da altura da tela
    },
    drive: {
      // sem teto: o motor perde força com a velocidade e o ar freia cada vez mais, mas nada corta
      aeroDrag: 0.0012,      // arrasto: o carro encosta em ~290-320 km/h conforme o modelo
      powerFalloff: 0.5,     // quanto a força do motor cai acima da velocidade de referência do carro
      highSpeedGrip: 0.9,    // perda de aderência por velocidade acima de 1,2x a referência
      highSpeedSteer: 0.8,   // direção mais pesada acima da referência
      wobble: 0.35,          // instabilidade (rad/s) quando passa de 1,35x a referência (~265 km/h)
      brakeDecel: 20,        // m/s² no freio
      coast: 5,              // m/s² desacelerando sem acelerador
      handDecel: 6,          // m/s² extra com o freio de mão puxado
      handMinSpeed: 0.55     // fração da velocidade mínima de drift para o freio de mão pegar
    },
    assist: {
      autoAlign: 0.3,        // correção de rumo com o dedo solto (0 = nenhuma)
      autoAlignInput: 0.12,  // abaixo desse esterço a correção atua
      driftBlend: 0.85,      // 0 = drift cru; 1 = rumo totalmente assistido
      lateralGain: 0.05,     // rad/s por metro fora do centro
      lateralMax: 0.25,      // limite da correção lateral (entrada atrasada ainda bate)
      headingGain: 1.0,      // rad/s por rad de diferença entre trajetória e pista
      slipMin: 18,           // ângulo (graus) com o joystick logo acima do limiar de soltar
      gripMin: 0.3
    },
    boost: {
      minEnergy: 40,         // energia mínima para descarregar (0..100)
      energyRate: 26,        // energia/s em drift válido
      cleanExitWindow: 0.35, // s sem colisão antes de sair do drift
      cooldown: 1.6,         // s entre ativações
      perEnergy: 0.018       // s de boost por ponto de energia
    },
    damage: {
      wallMin: 4.5,          // m/s de impacto perpendicular para causar dano
      wallPerMS: 0.9,        // dano por m/s acima do mínimo
      contactCooldown: 0.6,  // s: mesmo encostão não tira vida por quadro
      copBump: 4,
      bullet: 5,
      stuckTime: 1.6,        // s parado contra algo → reposiciona
      stuckSpeed: 3
    },
    scoring: {
      baseRate: 100, minSpeed: 6, minSlip: 12, maxSlip: 55, idealLo: 20, idealHi: 40,
      minProgress: 3,        // m/s avançando na rota (anti-donut / anti-ré)
      transitionWindow: 0.65, consolidateAfter: 0.8, maxMult: 5,
      nearMiss: 150, nearMissCooldown: 3, transitionBonus: 100, cleanCurveBonus: 60,
      copBonus: 250, copBonusCap: 1250,
      heavyHit: 9,           // m/s: acima disso perde o combo pendente
      lightHitCooldown: 1,
      speedRef: 22
    },
    rewards: { coinsPerPoints: 100, coinCapPerRace: 70, newStar: 25 },
    // níveis de gráfico: o Automático só transita entre Alto, Médio e Baixo (nunca liga o Ultra sozinho)
    quality: [
      { id: 'ultra', label: 'Ultra', dpr: 2, particles: 1.3, outline: true, view: 360, fog: [90, 420], flag: true },
      { id: 'alta', label: 'Alto', dpr: 1.5, particles: 1, outline: true, view: 270, fog: [70, 340], flag: true },
      { id: 'media', label: 'Médio', dpr: 1.2, particles: 0.7, outline: true, view: 210, fog: [55, 270], flag: true },
      { id: 'baixa', label: 'Baixo', dpr: 0.85, particles: 0.4, outline: false, view: 150, fog: [40, 200], flag: false }
    ]
  };

  // ------------------------------------------------------------ CARROS (arquétipos PROVISÓRIOS)
  const CARS = {
    role: {
      name: 'Rolê', tag: 'Compacto equilibrado', model: 'car1', frontZ: true, len: 4.5,
      maxSpeed: 55, accel: 19, steerRate: 2.3, steerAtSpeed: 0.55, gripRear: 8.5, driftGrip: 1.7,
      gripRecovery: 3.2, angDamp: 6.5, driftYaw: 1.35, counterAssist: 0.65, maxSlip: 50,
      boostSpeed: 12, hp: 100, unlock: null
    },
    lamina: {
      name: 'Lâmina', tag: 'Cupê de drift', model: 'car3', frontZ: true, len: 4.5,
      maxSpeed: 58.3, accel: 20.5, steerRate: 2.65, steerAtSpeed: 0.6, gripRear: 7.2, driftGrip: 1.25,
      gripRecovery: 2.5, angDamp: 5.5, driftYaw: 1.45, counterAssist: 0.62, maxSlip: 49,
      boostSpeed: 13, hp: 85, unlock: { chapter: 'c2', coins: 450 }
    },
    tanque: {
      name: 'Tanque', tag: 'Sedã resistente', model: 'car3b', frontZ: true, len: 4.8,
      maxSpeed: 53.3, accel: 16.8, steerRate: 2.0, steerAtSpeed: 0.5, gripRear: 10, driftGrip: 2.3,
      gripRecovery: 4.2, angDamp: 7.5, driftYaw: 1.2, counterAssist: 0.8, maxSlip: 44,
      boostSpeed: 11, hp: 135, unlock: { stars: 6, coins: 600 }
    }
  };
  const CAR_ORDER = ['role', 'lamina', 'tanque'];
  // Atributos exibidos (0..1) derivados dos parâmetros reais
  function carStats(c) {
    const n = (v, a, b) => clamp((v - a) / (b - a), 0.08, 1);
    return {
      velocidade: n(c.maxSpeed, 50, 60),
      resposta: n(c.steerRate * c.steerAtSpeed, 0.9, 1.7),
      drift: n((c.maxSlip / 56) * (1.7 / c.driftGrip) * c.driftYaw, 0.35, 1.9),
      resistencia: n(c.hp, 70, 140)
    };
  }

  // ------------------------------------------------------------ PILOTOS (habilidades passivas)
  // Personagens oficiais. As habilidades e apelidos são provisórios (ajuste de jogo, não fato do álbum).
  // Cada piloto só mexe em multiplicadores; nenhum deles controla o carro.
  const PILOTS = [
    { id: 'duckjay', name: 'DuckJay', model: 'chDuck', tag: 'Mão leve no volante', color: '#E6B84A',
      perk: 'Drift rende 20% mais pontos e o combo aguenta 0,3 s a mais', unlock: null,
      mods: { score: 1.2, comboHold: 1.35 } },
    { id: 'diey', name: 'Diey Pitalurgh', model: 'chDiey', tag: 'Cabeça fria', color: '#9A6A45',
      perk: 'Leva 25% menos dano e o carro recupera aderência mais rápido', unlock: { chapter: 'c2' },
      mods: { damage: 0.75, gripRecovery: 1.3 } },
    { id: 'bella', name: 'Bella Dona', model: 'chBella', tag: 'Pé no fundo', color: '#D8323C',
      perk: 'Acelera 12% mais forte, principalmente na saída das curvas', unlock: { stars: 5 },
      mods: { accel: 1.12 } },
    { id: 'bozo', name: 'Bozó', model: 'chBozo', tag: 'Ângulo grande', color: '#B8B8C4',
      perk: 'Segura 8° a mais de ângulo, mas o carro fica menos estável', unlock: { stars: 9 },
      mods: { maxSlip: 8, angDamp: 0.85, steerRate: 1.06 } },
  ];
  // ids antigos (provisórios) -> personagens reais, para saves já existentes
  const PILOT_ALIAS = { piloto2: 'diey', piloto3: 'bella', piloto4: 'bozo' };
  function pilotById(id) { return PILOTS.find(p => p.id === id) || PILOTS[0]; }
  // aplica os modificadores do piloto sobre os parâmetros do carro (não altera o original)
  function pilotCar(carKey, pilotId) {
    const base = CARS[carKey], m = pilotById(pilotId).mods, out = Object.assign({}, base);
    if (m.maxSlip) out.maxSlip = base.maxSlip + m.maxSlip;
    if (m.angDamp) out.angDamp = base.angDamp * m.angDamp;
    if (m.steerRate) out.steerRate = base.steerRate * m.steerRate;
    if (m.gripRecovery) out.gripRecovery = base.gripRecovery * m.gripRecovery;
    if (m.speed) out.maxSpeed = base.maxSpeed * m.speed;
    if (m.accel) out.accel = base.accel * m.accel;
    if (m.hp) out.hp = Math.round(base.hp * m.hp);
    return out;
  }
  function pilotScoring(pilotId) {
    const m = pilotById(pilotId).mods, S = Object.assign({}, CONFIG.scoring);
    if (m.score) S.baseRate = CONFIG.scoring.baseRate * m.score;
    if (m.comboHold) S.consolidateAfter = CONFIG.scoring.consolidateAfter * m.comboHold;
    return S;
  }
  function pilotUnlocked(data, p) {
    if (!p.unlock) return true;
    if (p.unlock.chapter) return !!(data.chapters[p.unlock.chapter] || {}).done;
    if (p.unlock.stars) return totalStars(data) >= p.unlock.stars;
    return true;
  }

  const PAINTS = [
    { id: 'orig', name: 'Original', color: null },
    { id: 'red', name: 'Vermelho BSBASS', color: '#F20D24' },
    { id: 'black', name: 'Preto carvão', color: '#1c1c22', unlock: { stars: 2 } },
    { id: 'white', name: 'Branco quente', color: '#F3F0E8', unlock: { stars: 4 } },
    { id: 'gold', name: 'Ouro do bonde', color: '#E0A92A', unlock: { stars: 8 } },
    { id: 'blue', name: 'Azul madrugada', color: '#2F5BD8', unlock: { stars: 11 } }
  ];

  // ------------------------------------------------------------ CAMPANHA (estrutura PROVISÓRIA)
  // trackId: slot de faixa do álbum. Hoje todas apontam para o arquivo enviado ('music').
  const CHAPTERS = [
    { id: 'c1', title: 'Na Mira', trackId: 'slot_faixa_01',
      intro: ['Rádio: movimentação estranha no bairro.', 'DuckJay e o bonde no rolê.'],
      objective: 'Complete a volta e pegue o jeito do drift',
      win: { type: 'lap', laps: 1 }, speed: 0.86, tutorial: true,
      cops: { queue: [], max: 0 }, truck: null, blocks: false,
      challenges: [{ type: 'complete', label: 'Completar o rolê' }, { type: 'score', value: 2500, label: '2.500 pontos' }, { type: 'combo', value: 3, label: 'Combo x3' }],
      reward: 120 },
    { id: 'c2', title: 'O Corre', trackId: 'slot_faixa_02',
      intro: ['A caminho da região da carga.', 'Tem viatura rondando.'],
      objective: 'Chegue até o caminhão sem perder o ritmo',
      win: { type: 'lap', laps: 1 }, speed: 0.93,
      cops: { queue: ['patrol', 'patrol'], max: 1, start: 22 }, truck: { mode: 'show' }, blocks: false,
      challenges: [{ type: 'complete', label: 'Completar o corre' }, { type: 'score', value: 6000, label: '6.000 pontos' }, { type: 'driftTime', value: 15, label: '15 s em drift' }],
      reward: 160 },
    { id: 'c3', title: 'A Carga', trackId: 'slot_faixa_03',
      intro: ['O caminhão tá na pista.', 'Cola nele e segura.'],
      objective: 'Cola no caminhão (atrás ou do lado) até completar a interceptação',
      win: { type: 'intercept', time: 95 }, speed: 1, dmgMul: 0.9,
      cops: { queue: ['patrol', 'inter', 'patrol', 'patrol'], max: 2, start: 12 }, truck: { mode: 'intercept' }, blocks: false,
      challenges: [{ type: 'complete', label: 'Interceptar a carga' }, { type: 'score', value: 5000, label: '5.000 pontos' }, { type: 'noHeavy', label: 'Sem batida forte' }],
      reward: 200 },
    { id: 'c4', title: 'No Retrovisor', trackId: 'slot_faixa_04',
      intro: ['A polícia foi atrás do grupo.', 'Olho nos bloqueios.'],
      objective: 'Aguente a perseguição até o tempo acabar',
      win: { type: 'survive', time: 75 }, speed: 1, dmgMul: 0.8,
      cops: { queue: ['patrol', 'inter', 'patrol', 'swat', 'patrol', 'inter', 'patrol'], max: 2, ramp: { at: 35, max: 3 }, start: 6 }, truck: null, blocks: true,
      challenges: [{ type: 'complete', label: 'Escapar da perseguição' }, { type: 'score', value: 7500, label: '7.500 pontos' }, { type: 'nearMiss', value: 3, label: '3 passadas raspando' }],
      reward: 240 },
    { id: 'c5', title: 'Sumir na Noite', trackId: 'slot_faixa_05',
      intro: ['Última volta.', 'Some com o bonde.'],
      objective: 'Feche a volta e suma com o bonde',
      win: { type: 'escape', laps: 1 }, speed: 1.04, dmgMul: 0.85,
      cops: { queue: ['patrol', 'inter', 'swat', 'patrol', 'inter', 'patrol'], max: 3, start: 5 }, truck: null, blocks: true,
      challenges: [{ type: 'complete', label: 'Sumir na noite' }, { type: 'score', value: 9000, label: '9.000 pontos' }, { type: 'combo', value: 5, label: 'Combo x5' }],
      reward: 300 }
  ];

  // ------------------------------------------------------------ FÍSICA DO CARRO (2D, passo fixo)
  // Estado: px,pz (m), h (rumo, rad; frente = (sin h, cos h)), vx,vz (m/s), omega (rad/s)
  function newCarState(px, pz, h, speed) {
    return { px, pz, h, vx: Math.sin(h) * speed, vz: Math.cos(h) * speed, omega: 0, drift: false, driftHold: 0,
      grip: 8, boostT: 0, speedMul: 1, slip: 0, vf: speed, vl: 0 };
  }
  // input: {steer:-1..1 (positivo = direita)}, P: parâmetros do carro, trackHeading: rumo da pista no ponto
  function stepCar(c, input, dt, P, T) {
    if (typeof T === 'number') T = { h: T, k: 0, x: 0 };
    const trackHeading = T ? T.h : null;
    const C = CONFIG.control, A = CONFIG.assist;
    const D = CONFIG.drive;
    const steer = Math.abs(input.steer) < C.deadzone ? 0 : input.steer;
    const hasPedals = input.throttle != null || input.handbrake != null;
    const thr = input.throttle == null ? 1 : clamp(input.throttle, 0, 1);
    const brake = input.brake ? 1 : 0, hand = !!input.handbrake;
    const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -fz, rz = fx;
    let vf = c.vx * fx + c.vz * fz, vl = c.vx * rx + c.vz * rz;
    const sp = Math.abs(vf), slipNow = Math.atan2(vl, Math.max(2, vf));
    if (hasPedals) {
      // freio de mão solta a traseira; o drift continua enquanto o volante segura o ângulo
      if (hand && sp > C.driftMinSpeed * D.handMinSpeed) c.drift = true;
      else if (c.drift && (Math.abs(steer) < C.releaseThreshold || Math.abs(slipNow) < 8 * DEG)) c.drift = false;
    } else if (Math.abs(steer) > C.driftThreshold && sp > C.driftMinSpeed) {
      c.driftHold += dt; if (!c.drift && c.driftHold >= C.driftHold) c.drift = true;
    } else {
      c.driftHold = 0; if (c.drift && Math.abs(steer) < C.releaseThreshold) c.drift = false;
    }
    // acelerador / freio / inércia
    const ref = P.maxSpeed * c.speedMul;
    if (brake) vf = Math.max(0, vf - D.brakeDecel * dt);
    else if (hasPedals) {
      // pedais: sem velocidade máxima. Força do motor cai com a velocidade, o ar segura
      const r = Math.max(0, vf / ref), pm = c.powerMul || 1;
      const force = P.accel * thr * pm * (c.boostT > 0 ? 2.2 : 1) / (1 + D.powerFalloff * r * r);
      vf += (force - D.aeroDrag * vf * Math.abs(vf) - (thr < 0.05 ? D.coast : 0)) * dt;
      if (vf < 0 && thr < 0.05) vf = Math.min(0, vf + D.coast * dt);
    } else {
      // um dedo (acelera sozinho, sem freio): mantém o teto antigo
      const target = (P.maxSpeed + (c.boostT > 0 ? P.boostSpeed : 0)) * c.speedMul * thr;
      if (vf > target) vf = Math.max(target, vf - P.accel * 2 * dt);
      else vf += Math.min(target - vf, P.accel * dt * (c.boostT > 0 ? 2.2 : 1));
    }
    if (hand) vf = Math.max(0, vf - D.handDecel * dt);
    // taxa de guinada crua pelo esterço
    const overV = Math.max(0, sp / (P.maxSpeed * c.speedMul) - 1);
    const steerK = P.steerRate * (1 - (1 - P.steerAtSpeed) * clamp(sp / P.maxSpeed, 0, 1)) * clamp(sp / 6, 0, 1) / (1 + overV * D.highSpeedSteer);
    let yawT = -steer * steerK * (c.drift ? P.driftYaw : 1);
    if (Math.abs(steer) < A.autoAlignInput && trackHeading != null) yawT += wrapAng(trackHeading - c.h) * A.autoAlign;
    let gripT = c.drift ? P.driftGrip : P.gripRear;
    // drift assistido: o joystick escolhe o ângulo; a aderência traseira se ajusta para a trajetória
    // acompanhar a curvatura da pista (com correção lateral limitada). Só atua com o drift segurado.
    if (c.drift && T && sp > 4 && steer !== 0) {
      const dir = -Math.sign(steer), velDir = Math.atan2(c.vx, c.vz);
      const wReq = sp * T.k + clamp(T.x * A.lateralGain, -A.lateralMax, A.lateralMax) + clamp(wrapAng(T.h - velDir), -0.5, 0.5) * A.headingGain;
      const frac = clamp((Math.abs(steer) - C.releaseThreshold) / (1 - C.releaseThreshold), 0, 1);
      const slipT = (A.slipMin + (P.maxSlip - 8 - A.slipMin) * frac) * DEG;
      gripT = clamp((wReq * dir) / Math.sin(slipT), A.gripMin, P.driftGrip * 1.8);
      const yawA = wrapAng(velDir + dir * slipT - c.h) * 6;
      yawT = yawT + (yawA - yawT) * A.driftBlend;
    }
    gripT /= 1 + Math.max(0, sp / (P.maxSpeed * c.speedMul) - 1.2) * D.highSpeedGrip;   // muito rápido: pneu não segura
    c.grip = damp(c.grip, gripT, c.drift ? 9 : P.gripRecovery, dt);
    vl *= Math.exp(-c.grip * dt);
    // contravolante assistido: limita o ângulo de deslizamento
    const slip = Math.atan2(vl, Math.max(2, vf));
    const over = Math.abs(slip) - (P.maxSlip - 10) * DEG;
    if (over > 0) yawT += -Math.sign(slip) * over * 26 * P.counterAssist;
    // acima de 1,6x a referência o carro flutua (determinístico: depende da posição, não de sorteio)
    const wob = Math.max(0, sp / (P.maxSpeed * c.speedMul) - 1.35);
    if (wob > 0) yawT += Math.sin(c.px * 0.37 + c.pz * 0.23) * Math.sin(c.px * 0.11 - c.pz * 0.29) * D.wobble * Math.min(2, wob * 2);
    c.omega = damp(c.omega, yawT, P.angDamp, dt);
    // recompõe no rumo antigo, depois gira a carroceria: a divergência vira deslizamento
    c.vx = fx * vf + rx * vl; c.vz = fz * vf + rz * vl;
    c.h = wrapAng(c.h + c.omega * dt);
    c.px += c.vx * dt; c.pz += c.vz * dt;
    if (c.boostT > 0) c.boostT -= dt;
    c.vf = vf; c.vl = vl; c.slip = slip;
    return c;
  }
  function slipDeg(c) {
    const sp = Math.hypot(c.vx, c.vz);
    if (sp < 2) return 0;
    const fx = Math.sin(c.h), fz = Math.cos(c.h);
    const cos = clamp((c.vx * fx + c.vz * fz) / sp, -1, 1);
    return Math.acos(cos) / DEG;
  }

  // ------------------------------------------------------------ PONTUAÇÃO / COMBO
  function angleFactor(a, S) {
    if (a < S.minSlip || a > S.maxSlip) return 0;
    if (a < S.idealLo) return 0.5 + 0.5 * (a - S.minSlip) / (S.idealLo - S.minSlip);
    if (a <= S.idealHi) return 1;
    return 1 - 0.6 * (a - S.idealHi) / (S.maxSlip - S.idealHi);
  }
  function DriftScorer(cfg) {
    const S = Object.assign({}, CONFIG.scoring, cfg || {});
    const st = {
      total: 0, pending: 0, mult: 1, chainCurves: 0, active: false, sinceValid: 0,
      lastDir: 0, lastCurve: -1, curveHadHit: false, curveDrifted: false,
      counted: new Set(), lightCD: 0, bestCombo: 0, bestMult: 1, driftTime: 0, curveTime: 0, curveDriftTime: 0,
      heavyHits: 0, lightHits: 0, nearMisses: 0, nearCD: new Map(), copAwarded: 0, transitions: 0, events: []
    };
    function emit(type, data) { st.events.push(Object.assign({ type }, data || {})); }
    function consolidate(reason) {
      if (st.pending > 0) {
        const got = Math.round(st.pending * st.mult);
        st.total += got; st.bestCombo = Math.max(st.bestCombo, got); st.bestMult = Math.max(st.bestMult, st.mult);
        emit('combo', { points: got, mult: st.mult, reason });
      }
      st.pending = 0; st.mult = 1; st.chainCurves = 0; st.active = false; st.sinceValid = 0; st.lastDir = 0;
    }
    return {
      state: st, S,
      // o: {dt, speed, slip (graus), grounded, progress (m/s ao longo da rota), colliding, curveId, dir (-1/1), lap, zone}
      update(o) {
        const dt = o.dt; st.lightCD = Math.max(0, st.lightCD - dt);
        for (const [k, v] of st.nearCD) { if (v - dt <= 0) st.nearCD.delete(k); else st.nearCD.set(k, v - dt); }
        if (o.curveId >= 0) st.curveTime += dt;
        const valid = o.grounded !== false && !o.colliding && o.speed >= S.minSpeed && o.progress >= S.minProgress &&
          o.slip >= S.minSlip && o.slip <= S.maxSlip;
        // curva deixada: bônus de curva limpa
        if (o.curveId !== st.lastCurve) {
          if (st.lastCurve >= 0 && st.curveDrifted && !st.curveHadHit && st.active) { st.pending += S.cleanCurveBonus; emit('clean'); }
          st.lastCurve = o.curveId; st.curveHadHit = false; st.curveDrifted = false;
        }
        if (valid) {
          const sf = clamp(o.speed / S.speedRef, 0.5, 1.5), af = angleFactor(o.slip, S), zf = clamp(o.zone == null ? 1 : o.zone, 0.3, 2);
          st.pending += S.baseRate * sf * af * zf * dt;
          st.driftTime += dt; if (o.curveId >= 0) { st.curveDriftTime += dt; st.curveDrifted = true; }
          if (st.active && st.lastDir && o.dir && o.dir !== st.lastDir && st.sinceValid > 0 && st.sinceValid <= S.transitionWindow) {
            st.pending += S.transitionBonus; st.transitions++; emit('transition');
          }
          if (o.curveId >= 0) {
            const key = (o.lap || 0) * 10000 + o.curveId;
            if (!st.counted.has(key)) {
              st.counted.add(key);
              if (st.chainCurves > 0) { st.mult = Math.min(S.maxMult, st.mult + 1); emit('mult', { mult: st.mult }); }
              st.chainCurves++;
            }
          }
          st.active = true; st.sinceValid = 0; if (o.dir) st.lastDir = o.dir;
        } else if (st.active) {
          st.sinceValid += dt;
          if (st.sinceValid >= S.consolidateAfter) consolidate('stable');
        }
      },
      hit(impact) {
        if (impact >= S.heavyHit) {
          st.heavyHits++; st.curveHadHit = true;
          if (st.pending > 0) emit('lost', { points: Math.round(st.pending * st.mult) });
          st.pending = 0; st.mult = 1; st.chainCurves = 0; st.active = false; st.sinceValid = 0;
          return 'heavy';
        }
        if (st.lightCD <= 0) {
          st.lightHits++; st.lightCD = S.lightHitCooldown; st.curveHadHit = true;
          if (st.mult > 1) { st.mult--; emit('multDown', { mult: st.mult }); }
          return 'light';
        }
        return 'ignored';
      },
      nearMiss(objId) {
        if (st.nearCD.has(objId)) return false;
        st.nearCD.set(objId, S.nearMissCooldown); st.nearMisses++;
        if (st.active) st.pending += S.nearMiss; else st.total += S.nearMiss;
        emit('near'); return true;
      },
      copKill() {
        const give = Math.max(0, Math.min(S.copBonus, S.copBonusCap - st.copAwarded));
        st.copAwarded += give; st.total += give; return give;
      },
      finish() { consolidate('finish'); return this.summary(); },
      summary() {
        const q = st.curveTime > 0 ? clamp(st.curveDriftTime / st.curveTime, 0, 1) : 0;
        const pen = Math.min(0.5, st.heavyHits * 0.12 + st.lightHits * 0.03);
        const quality = clamp(q - pen, 0, 1);
        const grade = quality > 0.72 ? 'S' : quality > 0.52 ? 'A' : quality > 0.32 ? 'B' : 'C';
        return { score: st.total, bestCombo: st.bestCombo, bestMult: st.bestMult, driftTime: st.driftTime, quality, grade,
          heavyHits: st.heavyHits, nearMisses: st.nearMisses };
      },
      liveScore() { return st.total; },
      drainEvents() { const e = st.events; st.events = []; return e; }
    };
  }

  // ------------------------------------------------------------ MENSAGENS (fila com prioridade)
  function MessageQueue(opts) {
    const o = Object.assign({ duration: 1.0, cooldown: { graze: 1.2, near: 0.8, combo: 0.2, mult: 0.25 } }, opts || {});
    const q = { current: null, lastByType: {}, t: 0 };
    return {
      q,
      push(type, text, priority, dur) {
        const now = q.t, cd = o.cooldown[type] || 0;
        const cur = q.current;
        if (cur && cur.type === type && cur.consolidate) {   // consolida repetidos
          cur.count++; cur.text = cur.base + ' x' + cur.count; cur.left = Math.max(cur.left, dur || o.duration); cur.changed = true; return 'merged';
        }
        if (now - (q.lastByType[type] ?? -99) < cd) return 'cooldown';
        if (cur && cur.priority > priority && cur.left > 0.25) return 'dropped';
        q.lastByType[type] = now;
        q.current = { type, text, base: text, priority, left: dur || o.duration, count: 1, consolidate: ['graze', 'near', 'hit'].includes(type), changed: true, id: (cur ? cur.id + 1 : 1) };
        return 'shown';
      },
      tick(dt) { q.t += dt; if (q.current) { q.current.left -= dt; if (q.current.left <= 0) q.current = null; } return q.current; }
    };
  }

  // ------------------------------------------------------------ SALVAMENTO (esquema versionado)
  const SAVE_VERSION = 1;
  function defaultSave() {
    return { v: SAVE_VERSION, coins: 0, equipped: 'role', pilot: 'duckjay', paints: { role: 'orig', lamina: 'orig', tanque: 'orig' },
      unlockedCars: ['role'], chapters: {}, bestFree: 0,
      options: { sound: true, music: true, vibration: true, reduceFx: false, thumbControls: false, graphics: 'auto', camera: 'chase', guide: true, rain: true }, tutorialDone: false, applied: [] };
  }
  function validateSave(d) {
    const def = defaultSave();
    if (!d || typeof d !== 'object' || d.v !== SAVE_VERSION) return null;
    const out = def;
    if (Number.isFinite(d.coins) && d.coins >= 0) out.coins = Math.floor(d.coins);
    if (Array.isArray(d.unlockedCars)) out.unlockedCars = Array.from(new Set(['role'].concat(d.unlockedCars.filter(k => CARS[k]))));
    if (CARS[d.equipped] && out.unlockedCars.includes(d.equipped)) out.equipped = d.equipped;
    if (d.paints && typeof d.paints === 'object') for (const k of CAR_ORDER) if (PAINTS.some(p => p.id === d.paints[k])) out.paints[k] = d.paints[k];
    if (d.chapters && typeof d.chapters === 'object') for (const c of CHAPTERS) {
      const x = d.chapters[c.id]; if (!x || typeof x !== 'object') continue;
      out.chapters[c.id] = { done: !!x.done, stars: Array.isArray(x.stars) ? [0, 1, 2].map(i => !!x.stars[i]) : [false, false, false],
        best: Number.isFinite(x.best) ? Math.max(0, x.best) : 0 };
    }
    if (d.options && typeof d.options === 'object') for (const k of Object.keys(out.options)) if (typeof d.options[k] === 'boolean') out.options[k] = d.options[k];
    if (d.options && ['auto', 'ultra', 'alta', 'media', 'baixa'].includes(d.options.graphics)) out.options.graphics = d.options.graphics;
    if (d.options && ['chase', 'pov'].includes(d.options.camera)) out.options.camera = d.options.camera;
    const pid = PILOT_ALIAS[d.pilot] || d.pilot;
    if (PILOTS.some(p => p.id === pid)) out.pilot = pid;
    out.tutorialDone = !!d.tutorialDone;
    if (Array.isArray(d.applied)) out.applied = d.applied.filter(x => typeof x === 'string').slice(-30);
    return out;
  }
  function SaveStore(storage, key) {
    key = key || 'bsbass:save';
    let data = defaultSave(), status = 'new';
    try {
      const raw = storage && storage.getItem(key);
      if (raw) { const v = validateSave(JSON.parse(raw)); if (v) { data = v; status = 'ok'; } else status = 'corrupt'; }
    } catch (e) { status = storage ? 'corrupt' : 'unavailable'; }
    return {
      get data() { return data; }, status,
      save() { try { storage && storage.setItem(key, JSON.stringify(data)); return true; } catch (e) { return false; } },
      reset() { data = defaultSave(); this.save(); }
    };
  }
  function totalStars(data) { let n = 0; for (const k in data.chapters) n += data.chapters[k].stars.filter(Boolean).length; return n; }
  function chapterUnlocked(data, idx) { return idx === 0 || !!(data.chapters[CHAPTERS[idx - 1].id] || {}).done; }
  function carUnlockState(data, key) {
    const c = CARS[key]; if (data.unlockedCars.includes(key)) return { owned: true };
    const u = c.unlock || {};
    const req = u.chapter ? !!(data.chapters[u.chapter] || {}).done : u.stars ? totalStars(data) >= u.stars : true;
    return { owned: false, requirementMet: req, coins: u.coins || 0, affordable: data.coins >= (u.coins || 0),
      label: u.chapter ? 'concluir o capítulo ' + (CHAPTERS.findIndex(x => x.id === u.chapter) + 1) : u.stars ? u.stars + ' estrelas' : '' };
  }
  function buyCar(data, key) {
    const s = carUnlockState(data, key);
    if (s.owned || !s.requirementMet || !s.affordable) return false;
    data.coins -= s.coins; data.unlockedCars.push(key); return true;
  }
  function paintUnlocked(data, p) { return !p.unlock || totalStars(data) >= (p.unlock.stars || 0); }

  // desafios + recompensa aplicados UMA vez por resultado (token)
  function evaluateChallenges(ch, res) {
    return ch.challenges.map(c => {
      switch (c.type) {
        case 'complete': return !!res.win;
        case 'score': return res.win && res.score >= c.value;
        case 'combo': return res.win && res.bestMult >= c.value;
        case 'driftTime': return res.win && res.driftTime >= c.value;
        case 'noHeavy': return res.win && res.heavyHits === 0;
        case 'nearMiss': return res.win && res.nearMisses >= c.value;
        default: return false;
      }
    });
  }
  function applyResult(data, chIdx, res, token) {
    if (data.applied.includes(token)) return { duplicate: true, coins: 0, newStars: 0, record: false, firstClear: false };
    const ch = CHAPTERS[chIdx], R = CONFIG.rewards;
    const prev = data.chapters[ch.id] || { done: false, stars: [false, false, false], best: 0 };
    const stars = evaluateChallenges(ch, res);
    const newStars = stars.filter((s, i) => s && !prev.stars[i]).length;
    const firstClear = res.win && !prev.done;
    const record = res.score > prev.best;
    const coins = Math.min(R.coinCapPerRace, Math.floor(res.score / R.coinsPerPoints)) + newStars * R.newStar + (firstClear ? ch.reward : 0);
    data.chapters[ch.id] = { done: prev.done || !!res.win, stars: prev.stars.map((s, i) => s || stars[i]), best: Math.max(prev.best, res.score) };
    data.coins += coins; data.applied.push(token); if (data.applied.length > 30) data.applied.shift();
    return { duplicate: false, coins, newStars, stars, record, firstClear, prevBest: prev.best };
  }

  return { CONFIG, CARS, CAR_ORDER, PAINTS, CHAPTERS, PILOTS, pilotById, pilotCar, pilotScoring, pilotUnlocked, carStats, newCarState, stepCar, slipDeg, angleFactor, DriftScorer,
    MessageQueue, SaveStore, defaultSave, validateSave, totalStars, chapterUnlocked, carUnlockState, buyCar, paintUnlocked,
    evaluateChallenges, applyResult, clamp, damp, wrapAng };
})();
