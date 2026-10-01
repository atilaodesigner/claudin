import type { ActionState, MatchState, Part, Phase, SimEvent, Team } from '@ginga/shared';

export interface ViewPlayer {
  slot: number;
  team: Team;
  x: number;
  y: number;
  vx: number;
  grounded: boolean;
  act: ActionState | null;
  lastPart: Part | '';
  lastTick: number;
  name: string;
  isBot: boolean;
  isLocal: boolean;
}

/** Everything the renderer and the HUD need for one frame (world coordinates). */
export interface View {
  tick: number;
  phase: Phase;
  phaseT: number;
  score: [number, number];
  serveTeam: Team;
  serverSlot: number;
  touches: number;
  possession: Team;
  side: Team;
  ball: { x: number; y: number; vx: number; vy: number; held: boolean };
  players: ViewPlayer[];
  localSlot: number;
  /** Mirror the presentation so the local team is always on the left. */
  flip: boolean;
  /** Show where the ball will land (training only). */
  landingHint: boolean;
  winner: -1 | Team;
}

export interface Game {
  readonly mode: 'training' | 'bot' | 'online';
  /** Advances by real time and returns the frame to draw. */
  frame(now: number, dt: number): View | null;
  /** Events since the last call (deduplicated, each shown once). */
  drainEvents(): SimEvent[];
  dispose(): void;
}

export function viewFromState(s: MatchState, names: string[], local: number, bots: boolean[], landingHint = false): View {
  return {
    tick: s.tick,
    phase: s.phase,
    phaseT: s.phaseT,
    score: [s.score[0], s.score[1]],
    serveTeam: s.serveTeam,
    serverSlot: s.serverSlot,
    touches: s.touches,
    possession: s.possession,
    side: s.side,
    ball: { ...s.ball },
    players: s.players.map((p) => ({
      slot: p.slot,
      team: p.team,
      x: p.x,
      y: p.y,
      vx: p.vx,
      grounded: p.grounded,
      act: p.act ? { ...p.act } : null,
      lastPart: p.lastPart,
      lastTick: p.lastTick,
      name: names[p.slot] ?? `Jogador ${p.slot + 1}`,
      isBot: bots[p.slot] ?? false,
      isLocal: p.slot === local,
    })),
    localSlot: local,
    flip: local >= 0 && s.players[local]?.team === 1,
    landingHint,
    winner: s.winner,
  };
}

/** Linear blend of two views' continuous values (for render interpolation). */
export function lerpView(a: View, b: View, t: number): View {
  const L = (x: number, y: number) => x + (y - x) * t;
  return {
    ...b,
    ball: { ...b.ball, x: L(a.ball.x, b.ball.x), y: L(a.ball.y, b.ball.y) },
    players: b.players.map((p, i) => {
      const q = a.players[i];
      return q ? { ...p, x: L(q.x, p.x), y: L(q.y, p.y) } : p;
    }),
  };
}
