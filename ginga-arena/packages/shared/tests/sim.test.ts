import { beforeAll, describe, expect, it } from 'vitest';
import { BALL, Bot, COURT, MATCH, Match, TIMING, initPhysics, isWinningScore, type MatchState, type SimEvent } from '../src';

beforeAll(async () => {
  await initPhysics();
});

const idle = [0, 0, 0, 0];

function run(m: Match, ticks: number, inputs: (s: MatchState) => number[] = () => idle): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) out.push(...m.step(inputs(m.state)));
  return out;
}

/** A match already in the rally with the ball placed by hand. */
function rally(players: 2 | 4, ball: Partial<MatchState['ball']>, patch: Partial<MatchState> = {}): Match {
  const m = new Match({ players, seed: 1 });
  const s = m.snapshot();
  Object.assign(s, { phase: 'rally', phaseT: 0 }, patch);
  s.ball = { x: -2, y: 1, vx: 0, vy: 0, held: false, ...ball };
  s.side = s.ball.x < 0 ? 0 : 1;
  m.restore(s);
  return m;
}

/** Puts a player's touch/attack right at its first active tick. */
function activeAction(s: MatchState, slot: number, kind: 'touch' | 'attack', dir: -1 | 0 | 1 = 0): void {
  const p = s.players[slot]!;
  const tm = kind === 'touch' ? TIMING.touchGround : TIMING.attackGround;
  p.act = { kind, t: tm.startup, air: false, dir, hit: false };
}

const kinds = (ev: SimEvent[]) => ev.map((e) => e.k);
const first = <K extends SimEvent['k']>(ev: SimEvent[], k: K) => ev.find((e) => e.k === k) as Extract<SimEvent, { k: K }> | undefined;

describe('placar', () => {
  it('7 com 2 de vantagem, teto 11', () => {
    expect(isWinningScore(7, 5)).toBe(true);
    expect(isWinningScore(7, 6)).toBe(false);
    expect(isWinningScore(8, 6)).toBe(true);
    expect(isWinningScore(10, 9)).toBe(false);
    expect(isWinningScore(11, 10)).toBe(true); // 10×10 → o próximo ponto encerra
  });

  it('em 10×10 o próximo ponto encerra a partida', () => {
    const m = rally(2, { x: 2, y: 0.5, vx: 0, vy: -3 }, { score: [10, 10] });
    const ev = run(m, 200);
    expect(first(ev, 'point')?.score).toEqual([11, 10]);
    expect(first(ev, 'over')?.winner).toBe(0);
    expect(m.state.phase).toBe('over');
  });
});

describe('ciclo de partida', () => {
  it('contagem → preparação → saque → saque automático aos 5 s', () => {
    const m = new Match({ players: 2, seed: 3 });
    m.start();
    expect(m.state.phase).toBe('countdown');
    run(m, MATCH.countdown);
    expect(m.state.phase).toBe('prep');
    run(m, MATCH.prep);
    expect(m.state.phase).toBe('serve');
    const ev = run(m, MATCH.serveWindow + TIMING.serve.startup + 2);
    expect(kinds(ev)).toContain('autoServe');
    expect(m.state.phase).toBe('rally');
    expect(m.state.serveInFlight).toBe(true);
  });

  it('saque sem resposta cai do outro lado: ponto de quem sacou, e ele saca de novo', () => {
    const m = new Match({ players: 2, seed: 3 });
    m.start();
    const server = m.state.serveTeam;
    const ev = run(m, MATCH.countdown + MATCH.prep + MATCH.serveWindow + 400);
    const pt = first(ev, 'point')!;
    expect(pt.winner).toBe(server);
    expect(pt.reason).toBe('ground');
    expect(kinds(ev)).toContain('cross');
    expect(m.state.serveTeam).toBe(server);
  });

  it('durante a preparação ninguém se mexe', () => {
    const m = new Match({ players: 2, seed: 3 });
    m.start();
    run(m, MATCH.countdown + 1);
    const x0 = m.state.players[0]!.x;
    run(m, 30, () => [2, 2]);
    expect(m.state.players[0]!.x).toBe(x0);
  });
});

describe('faltas', () => {
  it('bola no chão do próprio lado: ponto do adversário', () => {
    const ev = run(rally(2, { x: -3, y: 0.6, vy: -2 }), 60);
    expect(first(ev, 'fault')).toMatchObject({ reason: 'ground', winner: 1 });
  });

  it('bola fora: ponto contra quem tocou por último', () => {
    const m = rally(2, { x: 5, y: 1, vx: 5, vy: 0 }, { lastTouchTeam: 0 });
    const ev = run(m, 80);
    expect(first(ev, 'ground')?.inside).toBe(false);
    expect(first(ev, 'fault')).toMatchObject({ reason: 'out', winner: 1 });
  });

  it('bola na rede segue o jogo (não é falta por si só)', () => {
    const m = rally(2, { x: -1, y: 1.2, vx: 6, vy: 0 });
    const ev = run(m, 90);
    const iNet = ev.findIndex((e) => e.k === 'net');
    const iFault = ev.findIndex((e) => e.k === 'fault');
    expect(iNet).toBeGreaterThanOrEqual(0);
    expect(iFault).toBeGreaterThan(iNet);
    expect(ev.slice(iNet, iFault).some((e) => e.k === 'fault')).toBe(false);
    expect(first(ev, 'fault')?.reason).toBe('ground'); // caiu do lado de quem mandou
    expect(m.state.ball.x).toBeLessThan(0);
  });

  it('quarto toque: ponto do adversário', () => {
    const m = rally(2, { x: -3 + 0.3, y: 1.0, vx: 0, vy: -1 }, { possession: 0, touches: 3, lastTouchTeam: 0 });
    const s = m.snapshot();
    s.players[0]!.x = -3;
    activeAction(s, 0, 'touch');
    m.restore(s);
    const ev = run(m, 2);
    expect(first(ev, 'contact')?.n).toBe(4);
    expect(first(ev, 'fault')).toMatchObject({ reason: 'fourTouches', winner: 1 });
  });

  it('no 1v1 o mesmo jogador faz os três toques', () => {
    const m = rally(2, { x: -3 + 0.3, y: 1.0, vx: 0, vy: -1 }, { possession: 0, touches: 2, lastTouchTeam: 0, lastTouchSlot: 0 });
    const s = m.snapshot();
    s.players[0]!.x = -3;
    activeAction(s, 0, 'touch');
    m.restore(s);
    const ev = run(m, 2);
    expect(first(ev, 'contact')?.n).toBe(3);
    expect(first(ev, 'fault')).toBeUndefined();
  });

  it('no 2v2 o mesmo jogador não toca duas vezes seguidas', () => {
    const m = rally(4, { x: -3 + 0.3, y: 1.0, vx: 0, vy: -1 }, { possession: 0, touches: 1, lastTouchTeam: 0, lastTouchSlot: 0 });
    const s = m.snapshot();
    s.players[0]!.x = -3;
    s.players[2]!.x = -6;
    activeAction(s, 0, 'touch');
    m.restore(s);
    const ev = run(m, 2);
    expect(first(ev, 'fault')).toMatchObject({ reason: 'double', winner: 1 });
  });

  it('saque tocado por colega antes de cruzar é inválido', () => {
    const m = rally(4, { x: -3 + 0.3, y: 1.0, vx: 1, vy: 2 }, { serveInFlight: true, serveTeam: 0, possession: 0, touches: 1, lastTouchTeam: 0, lastTouchSlot: 0 });
    const s = m.snapshot();
    s.players[2]!.x = -3;
    s.players[0]!.x = -7;
    activeAction(s, 2, 'touch');
    m.restore(s);
    const ev = run(m, 2);
    expect(first(ev, 'fault')).toMatchObject({ reason: 'serveInvalid', winner: 1 });
  });

  it('não dá para tocar a bola do outro lado', () => {
    const m = rally(2, { x: 0.4, y: 1.5, vx: 0, vy: 0 });
    const s = m.snapshot();
    s.players[0]!.x = -COURT.netGap;
    activeAction(s, 0, 'touch');
    m.restore(s);
    expect(first(run(m, 2), 'contact')).toBeUndefined();
  });

  it('cruzar a rede zera a contagem da nova equipe', () => {
    const m = rally(2, { x: -0.8, y: 3.2, vx: 4, vy: 0 }, { possession: 0, touches: 2 });
    const ev = run(m, 30);
    expect(first(ev, 'cross')?.to).toBe(1);
    expect(m.state.touches).toBe(0);
    expect(m.state.possession).toBe(1);
  });
});

describe('contato', () => {
  it('bola a 22 m/s: contato no mesmo tick em que entra no alcance, no ponto de entrada', () => {
    // starts out of reach, ends inside it after one tick; the contact point is on the way in
    const m = rally(2, { x: -1.75, y: 1.0, vx: -22, vy: 0 });
    const s = m.snapshot();
    s.players[0]!.x = -3;
    activeAction(s, 0, 'touch');
    m.restore(s);
    const c = first(run(m, 1), 'contact');
    expect(c).toBeDefined();
    expect(c!.x).toBeGreaterThan(-2.1);
  });

  it('um contato por ação, e a bola só volta depois da recarga', () => {
    const m = rally(2, { x: -3 + 0.3, y: 1.0, vx: 0, vy: -1 });
    const s = m.snapshot();
    s.players[0]!.x = -3;
    activeAction(s, 0, 'touch');
    m.restore(s);
    const ev = run(m, TIMING.touchGround.active + 2);
    expect(ev.filter((e) => e.k === 'contact')).toHaveLength(1);
  });

  it('parte do corpo pela altura da bola', () => {
    const part = (h: number) => {
      const m = rally(2, { x: -3 + 0.3, y: h, vx: 0, vy: 0 });
      const s = m.snapshot();
      s.players[0]!.x = -3;
      activeAction(s, 0, 'touch');
      m.restore(s);
      return first(run(m, 1), 'contact')?.part;
    };
    expect(part(0.3)).toBe('foot');
    expect(part(0.8)).toBe('thigh');
    expect(part(1.3)).toBe('chest');
    expect(part(1.8)).toBe('head');
  });

  it('ataque bem feito passa a rede e cai no lado adversário', () => {
    const m = rally(2, { x: -1.5 + 0.3, y: 1.0, vx: 0, vy: -0.5 }, { possession: 0, touches: 2 });
    const s = m.snapshot();
    s.players[0]!.x = -1.5;
    activeAction(s, 0, 'attack');
    m.restore(s);
    const ev = run(m, 200);
    expect(first(ev, 'contact')?.kind).toBe('attack');
    expect(first(ev, 'cross')?.to).toBe(1);
    expect(first(ev, 'fault')).toMatchObject({ reason: 'ground', winner: 0 });
  });

  it('erro de timing é determinístico: cedo = curta, tarde = longa', () => {
    const landing = (offset: number, vx: number) => {
      const m = rally(2, { x: -3 + 0.3 + offset, y: 1.0, vx, vy: 0 }, { possession: 0, touches: 2 });
      const s = m.snapshot();
      s.players[0]!.x = -3;
      activeAction(s, 0, 'touch', 0);
      m.restore(s);
      return first(run(m, 300), 'ground')?.x ?? NaN;
    };
    const perfect = landing(0, 0);
    const early = landing(0.55, -2); // ball still coming, in front of the ideal point
    const late = landing(-0.6, -2); // ball already past the ideal point
    expect(early).toBeLessThan(perfect);
    expect(late).toBeGreaterThan(perfect);
    expect(landing(0.55, -2)).toBe(early);
  });
});

describe('bola presa, pausa e abandono', () => {
  it('bola parada em cima da rede anula o rally', () => {
    const m = rally(2, { x: 0, y: COURT.netTop + COURT.netHalf + BALL.radius, vx: 0, vy: 0 });
    const ev = run(m, 120);
    expect(first(ev, 'void')?.why).toBe('stuck');
    expect(first(ev, 'point')).toBeUndefined();
  });

  it('queda durante a pendência não escapa do ponto', () => {
    const m = rally(2, { x: -3, y: 0.3, vy: -3 });
    for (let i = 0; i < 30 && m.state.phase !== 'pending'; i++) m.step(idle);
    expect(m.state.phase).toBe('pending');
    const ev = m.pause();
    expect(first(ev, 'point')?.winner).toBe(1);
    expect(m.state.phase).toBe('paused');
  });

  it('queda no meio do rally: relógio parado, depois rally anulado', () => {
    const m = rally(2, { x: -3, y: 3, vx: 0, vy: 2 });
    m.pause();
    const t = m.state.ball.y;
    run(m, 100);
    expect(m.state.ball.y).toBe(t);
    m.resume();
    const ev = run(m, MATCH.resume + 1);
    expect(first(ev, 'void')?.why).toBe('reconnect');
    expect(m.state.phase).toBe('prep');
    expect(m.state.score).toEqual([0, 0]);
  });

  it('W.O. por abandono', () => {
    const m = rally(2, { x: -3, y: 3 });
    const ev = m.forfeit(1);
    expect(first(ev, 'over')).toMatchObject({ winner: 0, reason: 'forfeit' });
  });
});

describe('determinismo', () => {
  const botMatch = (seed: number) => {
    const m = new Match({ players: 2, seed });
    const bots = [new Bot(0, 'medium', 11), new Bot(1, 'hard', 12)];
    m.start();
    return { m, inputs: (s: MatchState) => bots.map((b) => b.think(s)) };
  };

  it('mesma semente e mesmos inputs → mesmo estado', () => {
    const a = botMatch(42);
    const b = botMatch(42);
    run(a.m, 4000, a.inputs);
    run(b.m, 4000, b.inputs);
    expect(JSON.stringify(a.m.state)).toBe(JSON.stringify(b.m.state));
  });

  it('restaurar um snapshot num mundo novo reproduz o futuro', () => {
    const a = botMatch(9);
    run(a.m, 1500, a.inputs);
    const snap = a.m.snapshot();
    const recorded: number[][] = [];
    for (let i = 0; i < 1500; i++) {
      const inp = a.inputs(a.m.state);
      recorded.push(inp);
      a.m.step(inp);
    }
    const c = new Match({ players: 2, seed: 0 }, snap);
    for (const inp of recorded) c.step(inp);
    expect(JSON.stringify(c.state)).toBe(JSON.stringify(a.m.state));
  });

  it('bot contra bot termina uma partida válida', () => {
    const { m, inputs } = botMatch(5);
    let contacts = 0;
    let crossings = 0;
    for (let i = 0; i < 60 * 60 * 20 && m.state.phase !== 'over'; i++) {
      for (const e of m.step(inputs(m.state))) {
        if (e.k === 'contact') contacts++;
        if (e.k === 'cross') crossings++;
      }
    }
    expect(m.state.phase).toBe('over');
    const [a, b] = m.state.score;
    expect(isWinningScore(Math.max(a, b), Math.min(a, b))).toBe(true);
    expect(contacts).toBeGreaterThan(40);
    expect(crossings).toBeGreaterThan(contacts / 6);
  });
});
