/**
 * HUD in HTML/CSS over the canvas: score and teams (symbols, not only colors), touches
 * left, who serves, connection, countdown, point/fault banners and short callouts.
 * DOM is only touched when something changed.
 */

import { MATCH, isWinningScore, type Reason, type SimEvent, type Team } from '@ginga/shared';
import type { View } from '../game/types';
import { TEAM_SYMBOL } from '../render/Scene3D';

const FAULT_TEXT: Record<Reason, string> = {
  ground: 'Caiu!',
  out: 'Pra fora!',
  fourTouches: 'Quatro toques!',
  double: 'Toque duplo!',
  serveInvalid: 'Saque não passou!',
  forfeit: 'W.O.',
};
const NICE = ['Boa!', 'No capricho!', 'Que isso!'];

export class Hud {
  readonly el: HTMLElement;
  private readonly q = <T extends HTMLElement>(sel: string) => this.el.querySelector<T>(sel)!;
  private cache = new Map<string, string>();
  private calloutT = 0;
  private bannerT = 0;
  private niceI = 0;
  private rallyCallout = false;
  private lastView: View | null = null;
  onMenu: () => void = () => {};

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="hud-top">
        <div class="team left"><div class="tname"><span class="sym"></span><span class="nm"></span><span class="srv" title="Saca">🏐</span></div><div class="pips"></div></div>
        <div class="pts"><b class="sl">0</b><i>×</i><b class="sr">0</b><div class="mp" hidden>PONTO DE PARTIDA</div></div>
        <div class="team right"><div class="tname"><span class="srv" title="Saca">🏐</span><span class="nm"></span><span class="sym"></span></div><div class="pips"></div></div>
      </div>
      <button class="hud-menu" aria-label="Menu">⏸</button>
      <div class="conn" hidden></div>
      <div class="banner" hidden></div>
      <div class="callout" hidden></div>
      <div class="hint" hidden></div>`;
    root.appendChild(this.el);
    this.q<HTMLButtonElement>('.hud-menu').addEventListener('click', () => this.onMenu());
  }

  show(on: boolean): void {
    this.el.hidden = !on;
  }

  private set(sel: string, key: string, value: string, html = false): void {
    const ck = sel + key;
    if (this.cache.get(ck) === value) return;
    this.cache.set(ck, value);
    const el = this.q(sel);
    if (html) el.innerHTML = value;
    else el.textContent = value;
  }

  private toggle(sel: string, on: boolean): void {
    const el = this.q(sel);
    if (el.hidden === !on) return;
    el.hidden = !on;
  }

  setConnection(text: string | null, level: 'good' | 'warn' | 'bad' = 'good'): void {
    this.toggle('.conn', text !== null);
    if (text !== null) {
      this.set('.conn', 't', text);
      this.q('.conn').dataset.level = level;
    }
  }

  update(v: View, dt: number): void {
    this.lastView = v;
    const localTeam: Team = v.localSlot >= 0 ? (v.players[v.localSlot]?.team ?? 0) : 0;
    const left: Team = localTeam;
    const right = (1 - left) as Team;
    for (const [side, team] of [
      ['left', left],
      ['right', right],
    ] as const) {
      const names = v.players.filter((p) => p.team === team).map((p) => (p.isBot ? `${p.name} (BOT)` : p.name)).join(' + ');
      this.set(`.${side} .nm`, '', names);
      this.set(`.${side} .sym`, '', TEAM_SYMBOL[team]);
      this.q(`.${side}`).dataset.team = String(team);
      this.q(`.${side} .srv`).style.visibility = v.serveTeam === team ? 'visible' : 'hidden';
      // touches used by this team in the current possession
      const used = v.possession === team && v.side === team && (v.phase === 'rally' || v.phase === 'pending') ? v.touches : 0;
      let pips = '';
      for (let i = 0; i < MATCH.maxTouches; i++) pips += `<span class="pip${i < used ? ' used' : ''}${used === MATCH.maxTouches - 1 && i === MATCH.maxTouches - 1 ? ' last' : ''}"></span>`;
      this.set(`.${side} .pips`, '', pips, true);
    }
    this.set('.sl', '', String(v.score[left]));
    this.set('.sr', '', String(v.score[right]));
    const mp = v.phase !== 'over' && (isWinningScore(v.score[0] + 1, v.score[1]) || isWinningScore(v.score[1] + 1, v.score[0]));
    this.toggle('.mp', mp);

    // countdown / serve hints
    let hint: string | null = null;
    if (v.phase === 'countdown' || v.phase === 'resume') {
      const left3 = Math.ceil((MATCH.countdown - v.phaseT) / 60);
      this.banner(left3 > 0 ? String(left3) : 'JOGA!', 'count', 0.2);
    } else if (v.phase === 'serve' && v.serverSlot === v.localSlot) {
      const s = Math.max(0, Math.ceil((MATCH.serveWindow - v.phaseT) / 60));
      hint = `Sua vez de sacar · J ou K · ${s}s`;
    } else if (v.phase === 'paused') hint = 'Partida pausada';
    this.toggle('.hint', hint !== null);
    if (hint) this.set('.hint', '', hint);

    this.calloutT -= dt;
    if (this.calloutT <= 0) this.toggle('.callout', false);
    this.bannerT -= dt;
    if (this.bannerT <= 0) this.toggle('.banner', false);
  }

  private callout(text: string, time = 1.1): void {
    this.set('.callout', '', text);
    const el = this.q('.callout');
    el.hidden = false;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    this.calloutT = time;
  }

  private banner(text: string, kind: string, time = 1.4): void {
    this.set('.banner', '', text);
    const el = this.q('.banner');
    el.dataset.kind = kind;
    el.hidden = false;
    this.bannerT = time;
  }

  onEvent(e: SimEvent): void {
    const v = this.lastView;
    switch (e.k) {
      case 'contact':
        if (e.kind === 'attack' && e.n === 1) this.callout('De primeira!');
        else if (e.grade === 'perfect' && e.kind !== 'serve' && Math.random() < 0.5) this.callout(NICE[this.niceI++ % NICE.length]!, 0.8);
        break;
      case 'net':
        this.callout('Na rede! Segue o jogo.', 1);
        break;
      case 'autoServe':
        this.callout('Saque automático');
        break;
      case 'fault':
        this.callout(FAULT_TEXT[e.reason], 1.3);
        break;
      case 'point': {
        const name = v?.players.filter((p) => p.team === e.winner).map((p) => p.name).join(' + ') ?? '';
        this.banner(`PONTO ${TEAM_SYMBOL[e.winner]} ${name}`, e.winner === (v?.players[v.localSlot]?.team ?? -1) ? 'win' : 'lose', 1.4);
        if (v && v.phase !== 'over' && !this.rallyCallout && (this.crossings ?? 0) >= 6) this.callout('Essa foi bonita!', 1.4);
        this.crossings = 0;
        break;
      }
      case 'cross':
        this.crossings = (this.crossings ?? 0) + 1;
        break;
      case 'void':
        this.callout(e.why === 'reconnect' ? 'Rally anulado (queda de conexão)' : 'Rally anulado', 1.6);
        break;
      case 'phase':
        if (e.phase === 'prep') this.rallyCallout = false;
        break;
      default:
        break;
    }
  }

  private crossings = 0;
}
