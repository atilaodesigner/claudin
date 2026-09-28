/**
 * Bot brain: reads a (delayed) match state and presses the same buttons a player would.
 * Same actions, windows and reach as humans; only its reaction delay and read error
 * change with the level. Always shown as BOT in the UI.
 */

import { Btn } from './input';
import { BALL, COURT, CONTACT, MATCH } from './params';
import { nextRandom } from './rng';
import { facing, type MatchState } from './sim';

export type BotLevel = 'easy' | 'medium' | 'hard';

const LEVELS: Record<BotLevel, { delay: number; readError: number; attackRisk: number }> = {
  easy: { delay: 23, readError: 0.55, attackRisk: 0.15 },
  medium: { delay: 15, readError: 0.3, attackRisk: 0.45 },
  hard: { delay: 10, readError: 0.12, attackRisk: 0.8 },
};

/** Where (x) the ball will be when it falls to height `h`, ignoring the net. */
function landingX(b: { x: number; y: number; vx: number; vy: number }, h: number): number {
  const g = BALL.gravity;
  const disc = b.vy * b.vy + 2 * g * (b.y - h);
  if (disc < 0) return b.x;
  const t = (b.vy + Math.sqrt(disc)) / g;
  return b.x + b.vx * t;
}

export class Bot {
  private readonly cfg: (typeof LEVELS)[BotLevel];
  private readonly history: MatchState[] = [];
  private rng: number;
  private plan = { aimDir: 0 as -1 | 0 | 1, jumpAttack: false, err: 0, forPossessionTouch: -1 };
  private held = 0;

  constructor(
    readonly slot: number,
    level: BotLevel,
    seed = 7,
  ) {
    this.cfg = LEVELS[level];
    this.rng = seed;
  }

  private rand(): number {
    const [v, n] = nextRandom(this.rng);
    this.rng = n;
    return v;
  }

  /** Feed the current state every tick; returns this tick's buttons. */
  think(now: MatchState): number {
    this.history.push(now);
    if (this.history.length > this.cfg.delay + 1) this.history.shift();
    const s = this.history[0]!;
    const me = s.players[this.slot];
    if (!me) return 0;
    const f = facing(me.team);
    let b = 0;
    const press = (bit: number): void => {
      // only press on a fresh edge
      if (!(this.held & bit)) b |= bit;
    };

    if (s.phase === 'serve' && s.serverSlot === this.slot) {
      if (s.phaseT > 40 + Math.floor(this.rand() * 40)) {
        const d = this.rand();
        if (d < 0.3) b |= f > 0 ? Btn.Right : Btn.Left;
        else if (d < 0.5) b |= f > 0 ? Btn.Left : Btn.Right;
        press(Btn.Attack);
      }
      this.held = b;
      return b;
    }
    if (s.phase !== 'rally' && s.phase !== 'serve') {
      this.held = 0;
      return 0;
    }

    const ball = s.ball;
    const mine = s.side === me.team || (ball.vx * f < 0 && Math.abs(ball.x) < 3);
    let targetX = -f * COURT.half * 0.5;
    if (mine && !ball.held) {
      if (this.plan.forPossessionTouch !== s.rallyContacts) {
        this.plan.forPossessionTouch = s.rallyContacts;
        this.plan.err = (this.rand() * 2 - 1) * this.cfg.readError;
        const r = this.rand();
        this.plan.aimDir = r < 0.33 ? -1 : r < 0.66 ? 0 : 1;
        this.plan.jumpAttack = this.rand() < this.cfg.attackRisk;
      }
      const contactH = this.plan.jumpAttack && s.touches === 2 ? 2.2 : 1.0;
      targetX = landingX(ball, contactH) - f * CONTACT.ideal + this.plan.err;
      const lo = me.team === 0 ? -(COURT.half + COURT.freeZone) : COURT.netGap;
      const hi = me.team === 0 ? -COURT.netGap : COURT.half + COURT.freeZone;
      targetX = Math.max(lo, Math.min(hi, targetX));
    }
    const dx = targetX - me.x;
    if (dx > 0.12) b |= Btn.Right;
    else if (dx < -0.12) b |= Btn.Left;

    if (mine && !ball.held && s.side === me.team) {
      const relX = (ball.x - me.x) * f;
      const relY = ball.y - me.y;
      const near = relX > -0.4 && relX < 1.1 && ball.vy < 1;
      // the touch count is known for sure (it's on the HUD); only the ball read is delayed
      const nextTouch = now.possession === me.team && now.side === me.team ? now.touches + 1 : 1;
      const wantAttack = nextTouch >= MATCH.maxTouches || (nextTouch === 2 && this.plan.jumpAttack);
      if (nextTouch > MATCH.maxTouches) {
        // let it go: a fourth touch is a fault
      } else if (wantAttack && this.plan.jumpAttack && me.grounded && near && relY > 2.3 && relY < 3.3) press(Btn.Jump);
      else if (near && relY < (me.grounded ? 1.9 : 2.6) && relY > 0.1) {
        b &= ~(Btn.Left | Btn.Right);
        const aim = wantAttack ? this.plan.aimDir : nextTouch === 1 ? 0 : 1;
        if (aim === 1) b |= f > 0 ? Btn.Right : Btn.Left;
        else if (aim === -1) b |= f > 0 ? Btn.Left : Btn.Right;
        press(wantAttack ? Btn.Attack : Btn.Touch);
      }
    }
    this.held = b;
    return b;
  }
}
