/**
 * Screen flow (PLANO.md §5): title → Início → (online room | training | bot) → match →
 * result → rematch. Menus are DOM, separate from the game loop.
 */

import { ERR, type BotLevel, type LobbyMsg, type SimEvent, type Team } from '@ginga/shared';
import { Sfx } from '../audio/Sfx';
import { LocalGame } from '../game/LocalGame';
import { NetGame } from '../game/NetGame';
import type { Game, View } from '../game/types';
import { Controls } from '../input/Controls';
import { Scene3D, TEAM_SYMBOL } from '../render/Scene3D';
import { Hud } from '../ui/Hud';
import { saveSettings, settings } from './storage';

type Screen = 'home' | 'room' | 'game' | 'result' | 'none';

/** Keeps the invite code in the URL (and every other param, e.g. the lab's ?autobot). */
function setSala(code: string | null): void {
  const q = new URLSearchParams(location.search);
  if (code) q.set('sala', code);
  else q.delete('sala');
  const qs = q.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export class App {
  private readonly root: HTMLElement;
  private readonly ui: HTMLElement;
  private readonly controls: Controls;
  private readonly hud: Hud;
  private readonly sfx = new Sfx();
  private scene: Scene3D | null = null;
  private game: Game | null = null;
  private net: NetGame | null = null;
  private last = 0;
  private raf = 0;
  private screen: Screen = 'none';
  private lastView: View | null = null;
  private resultShown = false;
  private stats = { perfect: 0, firsts: 0, longest: 0, crossings: 0 };
  private botLevel: BotLevel = 'medium';
  private debug = false;
  private readonly debugEl: HTMLElement;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.root = document.body;
    this.ui = document.createElement('div');
    this.ui.className = 'ui';
    this.root.appendChild(this.ui);
    this.controls = new Controls(this.root);
    this.controls.setEnabled(false);
    this.hud = new Hud(this.root);
    this.hud.onMenu = () => this.pauseMenu();
    this.debugEl = document.createElement('pre');
    this.debugEl.className = 'debug';
    this.debugEl.hidden = true;
    this.root.appendChild(this.debugEl);
    addEventListener('keydown', (e) => {
      if (e.code === 'F3') {
        e.preventDefault();
        this.debug = !this.debug;
        this.debugEl.hidden = !this.debug;
      } else if (e.code === 'Escape' && this.screen === 'game') this.pauseMenu();
    });
    addEventListener('pointerdown', () => this.sfx.unlock(), { once: true });
    addEventListener('keydown', () => this.sfx.unlock(), { once: true });
  }

  /** Called once the title screen is dismissed. */
  async start(): Promise<void> {
    this.sfx.unlock();
    const invite = new URLSearchParams(location.search).get('sala');
    const resumed = await NetGame.resume(this.controls, this.netHandlers());
    if (resumed) {
      this.net = resumed;
      this.toast('De volta à partida!');
      return;
    }
    if (invite) {
      this.home(invite);
      return;
    }
    this.home();
  }

  // ── screens ────────────────────────────────────────────────────────────────

  private show(html: string, cls: string): HTMLElement {
    this.ui.innerHTML = `<div class="panel ${cls}" role="dialog">${html}</div>`;
    this.ui.hidden = false;
    const first = this.ui.querySelector<HTMLElement>('[autofocus], button, input');
    first?.focus();
    return this.ui.firstElementChild as HTMLElement;
  }

  private hideUi(): void {
    this.ui.hidden = true;
    this.ui.innerHTML = '';
  }

  toast(text: string, kind: 'info' | 'error' = 'info'): void {
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.setAttribute('role', 'status');
    t.textContent = text;
    this.root.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  private home(invite?: string): void {
    this.screen = 'home';
    this.stopGame();
    const p = this.show(
      `
      <h2 class="logo-small">GINGA <span>ARENA</span></h2>
      <label class="field">Seu apelido
        <input id="nick" maxlength="14" autocomplete="nickname" placeholder="Como te chamam na areia?" value="${esc(settings.name)}" />
      </label>
      ${invite ? `<p class="invite">Convite para a sala <b>${esc(invite.toUpperCase())}</b></p><button class="btn primary" data-act="accept">Entrar na sala</button>` : ''}
      <div class="grid">
        <button class="btn primary" data-act="create">Criar sala online</button>
        <div class="join">
          <input id="code" maxlength="4" placeholder="CÓDIGO" aria-label="Código da sala" autocapitalize="characters" />
          <button class="btn" data-act="join">Entrar</button>
        </div>
        <button class="btn" data-act="training">Treino</button>
        <div class="bot-row">
          <button class="btn" data-act="bot">Contra bot</button>
          <select id="lvl" aria-label="Nível do bot">
            <option value="easy">Fácil</option><option value="medium" selected>Médio</option><option value="hard">Difícil</option>
          </select>
        </div>
      </div>
      <details class="help"><summary>Controles</summary>
        <p><b>A/D</b> ou <b>←/→</b> mover · <b>Espaço</b> pular · <b>J</b> toque/levantar · <b>K</b> ataque · <b>Esc</b> menu · <b>F3</b> rede</p>
        <p>A direção segurada no toque escolhe: <b>frente</b> (rumo à rede), <b>trás</b> ou neutro. No ataque, ela escolhe se a bola cai curta, no meio ou no fundo.</p>
        <p>Até <b>3 toques</b> por lado. Pé, coxa, peito ou cabeça saem da altura da bola.</p>
      </details>
      <label class="check"><input type="checkbox" id="rm" ${settings.reduceMotion ? 'checked' : ''}/> Reduzir tremor e movimento</label>
      <label class="check"><input type="checkbox" id="rf" ${settings.reduceFx ? 'checked' : ''}/> Reduzir efeitos</label>
      <label class="field inline">Volume <input type="range" id="vol" min="0" max="1" step="0.05" value="${settings.master}" /></label>`,
      'home',
    );
    const nick = p.querySelector<HTMLInputElement>('#nick')!;
    const name = () => {
      settings.name = nick.value.trim().slice(0, 14);
      saveSettings();
      return settings.name || 'Jogador';
    };
    p.querySelector<HTMLInputElement>('#rm')!.onchange = (e) => {
      settings.reduceMotion = (e.target as HTMLInputElement).checked;
      saveSettings();
    };
    p.querySelector<HTMLInputElement>('#rf')!.onchange = (e) => {
      settings.reduceFx = (e.target as HTMLInputElement).checked;
      saveSettings();
    };
    p.querySelector<HTMLInputElement>('#vol')!.oninput = (e) => {
      settings.master = Number((e.target as HTMLInputElement).value);
      saveSettings();
      this.sfx.applyVolume();
    };
    const codeIn = p.querySelector<HTMLInputElement>('#code')!;
    codeIn.oninput = () => (codeIn.value = codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    p.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) =>
      b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'create') void this.goOnline(() => NetGame.create(name(), this.controls, this.netHandlers()));
        else if (act === 'join') {
          const code = codeIn.value.trim();
          if (code.length !== 4) {
            this.toast('O código tem 4 letras/números.', 'error');
            codeIn.focus();
            return;
          }
          void this.goOnline(() => NetGame.join(code, name(), this.controls, this.netHandlers()));
        } else if (act === 'accept' && invite) void this.goOnline(() => NetGame.join(invite, name(), this.controls, this.netHandlers()));
        else if (act === 'training') this.startLocal('training', 'easy', name());
        else if (act === 'bot') this.startLocal('bot', p.querySelector<HTMLSelectElement>('#lvl')!.value as BotLevel, name());
      }),
    );
    codeIn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') p.querySelector<HTMLButtonElement>('[data-act="join"]')!.click();
    });
  }

  private async goOnline(connect: () => Promise<NetGame>): Promise<void> {
    this.show(`<p class="loading">Conectando…</p>`, 'loading');
    try {
      this.net = await connect();
      setSala(this.net.code);
    } catch (e) {
      const code = (e as { code?: number }).code;
      const msg =
        code === ERR.VERSION
          ? 'Tem versão nova do jogo. Recarregue a página.'
          : code === ERR.FULL || /full|locked/i.test(String(e))
            ? 'Sala cheia. Cria outra?'
            : /not found|invalid|room/i.test(String(e))
              ? 'Código não encontrado. Confere aí?'
              : 'Não deu pra conectar no servidor. Tenta de novo, ou treina enquanto isso.';
      this.toast(msg, 'error');
      setSala(null);
      this.home();
    }
  }

  private netHandlers() {
    return {
      onLobby: (m: LobbyMsg) => this.onLobby(m),
      onDrop: () => this.reconnectOverlay(true),
      onReconnect: () => {
        this.reconnectOverlay(false);
        this.toast('Conexão de volta!');
      },
      onLeave: (code: number) => {
        this.reconnectOverlay(false);
        this.net?.dispose();
        this.net = null;
        setSala(null);
        if (code === ERR.KICKED) this.toast('Você foi desconectado (mensagens inválidas).', 'error');
        else if (code !== 4000 && code !== 1000) this.toast('Conexão perdida.', 'error');
        this.home();
      },
    };
  }

  private reconnectOverlay(on: boolean): void {
    let el = document.querySelector<HTMLElement>('.reconnect');
    if (!on) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.className = 'reconnect';
      el.setAttribute('role', 'alert');
      el.innerHTML = `<div class="spinner"></div><p>Conexão caiu. Voltando…</p><small>Você tem 15 s para voltar sem perder a partida.</small>`;
      this.root.appendChild(el);
    }
  }

  private onLobby(m: LobbyMsg): void {
    const net = this.net;
    if (!net) return;
    if (m.stage === 'lobby') {
      this.room(m);
      return;
    }
    if (m.stage === 'match') {
      if (this.game !== net || this.screen !== 'game') this.startGame(net);
      const away = m.away.findIndex((s, i) => s >= 0 && i !== m.you);
      this.hud.setConnection(away >= 0 ? `${m.seats.find((s) => s.slot === away)?.name ?? 'Adversário'} caiu. Esperando ${m.away[away]}s — se não voltar, vitória por W.O.` : null, 'warn');
      return;
    }
    if (m.stage === 'result' && this.screen === 'result') this.updateRematch(m);
  }

  private room(m: LobbyMsg): void {
    this.stopGame();
    this.screen = 'room';
    const me = m.seats.find((s) => s.slot === m.you);
    const link = `${location.origin}${location.pathname}?sala=${m.code}`;
    const seat = (slot: number) => {
      const s = m.seats.find((x) => x.slot === slot);
      const team = (slot % 2) as Team;
      return `<li class="seat t${team}"><span class="sym">${TEAM_SYMBOL[team]}</span>${
        s ? `<b>${esc(s.name)}</b>${s.slot === m.you ? ' <small>(você)</small>' : ''}<span class="st ${s.ready ? 'ok' : ''}">${!s.connected ? 'caiu…' : s.ready ? 'Pronto ✓' : 'Esperando'}</span>` : '<i>Vaga livre</i><span class="st">—</span>'
      }</li>`;
    };
    const p = this.show(
      `<h2>Sala</h2>
      <div class="code" aria-label="Código da sala">${m.code}</div>
      <div class="row"><button class="btn" data-act="copy">Copiar link</button>${'share' in navigator ? '<button class="btn" data-act="share">Compartilhar</button>' : ''}</div>
      <p class="muted">Chama a galera: manda o link.</p>
      <ul class="seats">${seat(0)}${seat(1)}</ul>
      ${m.seats.length < 2 ? '<p class="muted waiting">Esperando o parça…</p>' : ''}
      <div class="row">
        <button class="btn primary" data-act="ready" ${m.seats.length < 2 ? 'disabled' : ''}>${me?.ready ? 'Cancelar' : 'Tô pronto!'}</button>
        <button class="btn ghost" data-act="leave">Sair</button>
      </div>`,
      'room',
    );
    p.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) =>
      b.addEventListener('click', async () => {
        const act = b.dataset.act;
        if (act === 'copy') {
          try {
            await navigator.clipboard.writeText(link);
            this.toast('Link copiado!');
          } catch {
            prompt('Copie o link:', link);
          }
        } else if (act === 'share') void navigator.share?.({ title: 'GINGA ARENA', text: `Bora uma partida? Sala ${m.code}`, url: link }).catch(() => {});
        else if (act === 'ready') this.net?.setReady(!me?.ready);
        else if (act === 'leave') {
          await this.net?.leave();
          this.net?.dispose();
          this.net = null;
          setSala(null);
          this.home();
        }
      }),
    );
  }

  private startLocal(mode: 'training' | 'bot', level: BotLevel, name: string): void {
    this.botLevel = level;
    const botName = level === 'easy' ? 'Tico' : level === 'medium' ? 'Sereno' : 'Maré Alta';
    this.startGame(new LocalGame(this.controls, { mode, level, name, botName }));
  }

  private startGame(game: Game): void {
    this.stopGame(game === this.net);
    this.game = game;
    this.screen = 'game';
    this.resultShown = false;
    this.stats = { perfect: 0, firsts: 0, longest: 0, crossings: 0 };
    this.hideUi();
    this.scene ??= new Scene3D(this.canvas, this.root);
    this.canvas.hidden = false;
    this.hud.show(true);
    this.hud.setConnection(null);
    this.controls.setEnabled(true);
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  private stopGame(keepNet = false): void {
    cancelAnimationFrame(this.raf);
    if (this.game && this.game !== this.net) this.game.dispose();
    if (!keepNet) this.game = null;
    this.hud.show(false);
    this.controls.setEnabled(false);
    this.canvas.hidden = true;
    document.querySelector('.pause')?.remove();
  }

  private readonly loop = (now: number): void => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const g = this.game;
    if (!g) return;
    const v = g.frame(now, dt);
    if (v && this.scene) {
      this.lastView = v;
      for (const e of g.drainEvents()) this.onEvent(e, v);
      this.scene.render(v, dt, now);
      this.hud.update(v, dt);
      if (v.phase === 'over' && !this.resultShown) {
        this.resultShown = true;
        setTimeout(() => this.result(), 1600);
      }
    }
    if (this.debug) this.debugEl.textContent = this.debugText(v);
    if (this.net && g === this.net) {
      const r = this.net.stats.rtt;
      if (!document.querySelector('.hud .conn[data-level="warn"]')) this.hud.setConnection(`${Math.round(r)} ms`, r > 200 ? 'bad' : r > 120 ? 'warn' : 'good');
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private onEvent(e: SimEvent, v: View): void {
    this.scene?.onEvent(e);
    this.hud.onEvent(e);
    const x = 'x' in e && typeof e.x === 'number' ? e.x : v.ball.x;
    this.sfx.play(e, ((v.flip ? -x : x) / 10) * 0.8);
    if (e.k === 'contact' && v.players[e.slot]?.isLocal) {
      if (e.grade === 'perfect') this.stats.perfect++;
      if (e.kind === 'attack' && e.n === 1) this.stats.firsts++;
    }
    if (e.k === 'cross') this.stats.crossings++;
    if (e.k === 'point') {
      this.stats.longest = Math.max(this.stats.longest, this.stats.crossings);
      this.stats.crossings = 0;
    }
    if (e.k === 'phase' && e.phase === 'countdown') this.sfx.countdownBeep(false);
  }

  private result(): void {
    const v = this.lastView;
    if (!v || !this.game) return;
    this.screen = 'result';
    this.controls.setEnabled(false);
    const myTeam = v.players[v.localSlot]?.team ?? 0;
    const won = v.winner === myTeam;
    const other = (1 - myTeam) as Team;
    const online = this.game === this.net;
    const p = this.show(
      `<h2 class="${won ? 'win' : 'lose'}">${won ? 'Ganhou na ginga!' : 'Perdeu, mas foi bonito.'}</h2>
      <div class="final"><span>${TEAM_SYMBOL[myTeam]} ${v.score[myTeam]}</span><i>×</i><span>${v.score[other]} ${TEAM_SYMBOL[other]}</span></div>
      <ul class="stats">
        <li><b>${this.stats.perfect}</b> toques perfeitos</li>
        <li><b>${this.stats.firsts}</b> de primeira</li>
        <li><b>${this.stats.longest}</b> travessias no maior rally</li>
      </ul>
      <p class="muted rematch-state"></p>
      <div class="row">
        <button class="btn primary" data-act="again">${online ? 'Revanche?' : 'Bora de novo?'}</button>
        <button class="btn ghost" data-act="menu">Menu</button>
      </div>`,
      'result',
    );
    p.querySelector<HTMLButtonElement>('[data-act="again"]')!.onclick = () => {
      if (online) {
        this.net?.rematch();
        p.querySelector('.rematch-state')!.textContent = 'Revanche pedida. Esperando o outro lado…';
      } else if (this.game instanceof LocalGame) {
        const mode = this.game.mode;
        this.startLocal(mode, this.botLevel, settings.name || 'Jogador');
      }
    };
    p.querySelector<HTMLButtonElement>('[data-act="menu"]')!.onclick = () => void this.backToMenu();
    if (online && this.net?.lobby) this.updateRematch(this.net.lobby);
  }

  private updateRematch(m: LobbyMsg): void {
    const el = this.ui.querySelector('.rematch-state');
    if (!el) return;
    const votes = m.seats.filter((s) => s.rematch).length;
    if (m.seats.length < 2) el.textContent = 'O adversário saiu. Chama outro pela sala.';
    else if (votes > 0) el.textContent = `Revanche: ${votes}/2`;
  }

  private async backToMenu(): Promise<void> {
    if (this.net) {
      await this.net.leave();
      this.net.dispose();
      this.net = null;
      setSala(null);
    }
    this.home();
  }

  private pauseMenu(): void {
    if (document.querySelector('.pause')) return;
    const online = this.game === this.net;
    const el = document.createElement('div');
    el.className = 'pause';
    el.innerHTML = `<div class="panel"><h2>${online ? 'Menu' : 'Pausa'}</h2>
      ${online ? '<p class="muted">A partida online não pausa.</p>' : ''}
      <div class="row"><button class="btn primary" data-act="back">Continuar</button><button class="btn ghost" data-act="quit">${online ? 'Abandonar (W.O.)' : 'Sair'}</button></div></div>`;
    this.root.appendChild(el);
    const localPaused = !online;
    if (localPaused) cancelAnimationFrame(this.raf);
    el.querySelector<HTMLButtonElement>('[data-act="back"]')!.focus();
    el.querySelector<HTMLButtonElement>('[data-act="back"]')!.onclick = () => {
      el.remove();
      if (localPaused) {
        this.last = performance.now();
        this.raf = requestAnimationFrame(this.loop);
      }
    };
    el.querySelector<HTMLButtonElement>('[data-act="quit"]')!.onclick = () => {
      if (online && !confirm('Sair agora conta como abandono (W.O.). Sair mesmo?')) return;
      el.remove();
      void this.backToMenu();
    };
  }

  private debugText(v: View | null): string {
    const lines = [`fps ~${Math.round(1 / Math.max(0.001, (performance.now() - this.last) / 1000 || 0.016))}`, `tick ${v?.tick ?? '-'} fase ${v?.phase ?? '-'}`];
    if (this.net) {
      const s = this.net.stats;
      lines.push(
        `RTT ${s.rtt.toFixed(0)} ms  jitter ${s.jitter.toFixed(0)} ms`,
        `adiantamento ${s.lead} ticks  interpolação ${s.interp} ticks`,
        `snapshots/s ${s.snapsPerSec}`,
        `correções ${s.corrections} (grandes ${s.bigCorrections}) última ${(s.lastCorrection * 100).toFixed(1)} cm`,
        `toques previstos ${s.predicted}  confirmados ${s.confirmed}  rejeitados ${s.rejected}  (no replay ${s.lateFound})`,
        `correção da bola p95 ${(s.ballP95 * 100).toFixed(1)} cm`,
      );
    }
    return lines.join('\n');
  }
}
