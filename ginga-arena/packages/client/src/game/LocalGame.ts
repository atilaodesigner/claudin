/**
 * Training and bot matches: the shared simulation runs right here in the browser.
 * Works offline and costs no server, but it is NOT a multiplayer test (PLANO.md D-11).
 */

import { Bot, DT, Match, type BotLevel, type SimEvent } from '@ginga/shared';
import type { Controls } from '../input/Controls';
import { toWorld } from '../input/Controls';
import { lerpView, viewFromState, type Game, type View } from './types';

export class LocalGame implements Game {
  readonly mode: 'training' | 'bot';
  private readonly match: Match;
  private readonly bot: Bot;
  private acc = 0;
  private prev: View;
  private cur: View;
  private events: SimEvent[] = [];
  private readonly names: string[];

  constructor(
    private readonly controls: Controls,
    opts: { mode: 'training' | 'bot'; level: BotLevel; name: string; botName: string },
  ) {
    this.mode = opts.mode;
    this.match = new Match({ players: 2, seed: (Math.random() * 2 ** 31) | 0 });
    this.bot = new Bot(1, opts.level, (Math.random() * 1e9) | 0);
    this.names = [opts.name, opts.botName];
    this.events.push(...this.match.start());
    this.cur = this.view();
    this.prev = this.cur;
  }

  private view(): View {
    return viewFromState(this.match.state, this.names, 0, [false, true], this.mode === 'training');
  }

  frame(_now: number, dt: number): View {
    this.acc += Math.min(dt, 0.25);
    while (this.acc >= DT) {
      this.acc -= DT;
      const human = toWorld(this.controls.sample(), false);
      const bot = this.bot.think(this.match.state);
      this.prev = this.cur;
      this.events.push(...this.match.step([human, bot]));
      this.cur = this.view();
    }
    return lerpView(this.prev, this.cur, this.acc / DT);
  }

  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** Rematch in place. */
  restart(): void {
    this.events.push(...this.match.start());
  }

  dispose(): void {
    this.match.dispose();
  }
}
