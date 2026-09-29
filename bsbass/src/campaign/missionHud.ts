// Interface da campanha no mundo aberto: HUD de missão (o mesmo do BSBASS THE
// GAME: pontos, recorde, objetivo, vida, combo, mensagens, história,
// contagem, aviso de curva, indicador de viatura), tela de resultado, cartão
// do ponto de capítulo, anel de "segura E" e painéis do ferro-velho.

import type { Message } from './core.js';


export interface ResultView {
  win: boolean;
  title: string;
  sub: string;
  chapterLine: string;
  score: string;
  record: string;
  recordNew: boolean;
  stars: { label: string; got: boolean }[];
  stats: [string, string][];
}

export interface CardView {
  num: number;
  title: string;
  line: string;
  best: string;
  stars: boolean[];
  state: 'open' | 'done' | 'locked';
  action: string;
}

export interface PanelView {
  title: string;
  tag: string;
  body: string;
  action: string | null;
  swatches?: { id: string; color: string | null; name: string; locked: boolean; sel: boolean }[];
}

const TEMPLATE = /* html */ `
<div class="m-hud">
  <div class="m-top">
    <div class="m-score"><b data-m="score">0</b><small data-m="record">Primeira vez</small></div>
    <div class="m-obj"><small data-m="objL">Volta</small><b data-m="objV">0%</b><div class="m-gauge" data-m="gauge"><i></i></div></div>
  </div>
  <div class="m-sub">
    <div class="m-bars"><div class="m-life" data-m="lifebox"><i data-m="life"></i></div></div>
    <div class="m-combo" data-m="combo"><b data-m="cpts">+0</b><span data-m="cmult">x1</span><i data-m="cbar"></i></div>
  </div>
  <div class="m-cue" data-m="cue"><i></i><b></b></div>
  <div class="m-slip" data-m="slip"><i></i></div>
  <div class="m-msg" data-m="msg"></div>
  <div class="m-hint" data-m="hint"></div>
  <div class="m-ind" data-m="ind"></div>
</div>
<div class="m-hurt" data-m="hurt"></div>
<div class="m-graze" data-m="graze"></div>
<div class="m-count" data-m="count"></div>
<div class="m-story" data-m="story"></div>
<div class="m-finale" data-m="finale"><img src="./campaign/bsbass.webp" alt="BSBASS The Game" /><p></p></div>

<div class="m-result" data-m="result">
  <div class="m-panel">
    <h2 class="m-tag" data-m="rtitle"></h2>
    <p class="m-rsub" data-m="rsub"></p>
    <p class="m-rline" data-m="rline"></p>
    <div class="m-rscore"><b data-m="rscore">0</b><small data-m="rrec"></small></div>
    <ul class="m-rstars" data-m="rstars"></ul>
    <dl class="m-rstats" data-m="rstats"></dl>
    <div class="m-rbtns">
      <button class="m-btn red" data-m="retry"><span>Tentar de novo</span></button>
      <button class="m-btn ghost" data-m="leave"><span>Voltar ao mundo aberto</span></button>
    </div>
  </div>
</div>

<div class="m-card" data-m="card">
  <div class="m-card-n" data-m="cardN">1</div>
  <div class="m-card-t"><b data-m="cardT"></b><span data-m="cardL"></span><small data-m="cardB"></small></div>
  <div class="m-card-a" data-m="cardA"></div>
</div>
<div class="m-hold" data-m="hold"><svg viewBox="0 0 44 44"><circle class="bg" cx="22" cy="22" r="19"/><circle class="fg" data-m="holdArc" cx="22" cy="22" r="19"/></svg><b data-m="holdKey">E</b><span data-m="holdLabel"></span></div>
<button class="m-act" data-m="act" aria-label="Ação">SEGURA</button>

<div class="m-panel2" data-m="panel">
  <small data-m="pTag"></small>
  <b data-m="pTitle"></b>
  <div data-m="pBody"></div>
  <div class="m-sw" data-m="pSw"></div>
  <em data-m="pAct"></em>
</div>
`;

export class MissionHud {
  readonly root: HTMLElement;
  private m: Record<string, HTMLElement> = {};
  private last: Record<string, string> = {};
  private hintTimer = 0;
  private msgId = -1;
  onRetry: (() => void) | null = null;
  onLeave: (() => void) | null = null;
  onSwatch: ((id: string) => void) | null = null;
  /** botão de ação na tela (celular): segura = mesma coisa que a tecla E */
  actHeld = false;

  constructor(parent: HTMLElement) {
    const root = document.createElement('div');
    root.id = 'campaign-ui';
    root.innerHTML = TEMPLATE;
    parent.appendChild(root);
    this.root = root;
    for (const el of root.querySelectorAll<HTMLElement>('[data-m]')) this.m[el.dataset.m!] = el;
    this.m.retry!.addEventListener('click', () => this.onRetry?.());
    this.m.leave!.addEventListener('click', () => this.onLeave?.());
    const act = this.m.act!;
    const on = (e: Event) => {
      e.preventDefault();
      this.actHeld = true;
      act.classList.add('on');
    };
    const off = (e: Event) => {
      e.preventDefault();
      this.actHeld = false;
      act.classList.remove('on');
    };
    act.addEventListener('pointerdown', on);
    act.addEventListener('pointerup', off);
    act.addEventListener('pointercancel', off);
    act.addEventListener('pointerleave', off);
    this.m.pSw!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-sw]');
      if (b && !b.hasAttribute('disabled')) this.onSwatch?.(b.dataset.sw!);
    });
  }

  private setT(key: string, v: string, html = false): void {
    if (this.last[key] === v) return;
    this.last[key] = v;
    const el = this.m[key];
    if (!el) return;
    if (html) el.innerHTML = v;
    else el.textContent = v;
  }

  /** modo missão liga/desliga o HUD da campanha (e esconde o do mundo aberto) */
  mission(on: boolean): void {
    document.body.classList.toggle('missioning', on);
  }

  // ---------------- chamados pela missão ----------------
  reset(): void {
    this.last = {};
    this.msgId = -1;
    this.m.msg!.className = 'm-msg';
    this.m.hint!.classList.remove('on');
    this.m.combo!.classList.remove('on');
    this.m.count!.innerHTML = '';
    this.m.story!.classList.remove('on');
    this.m.cue!.classList.remove('on');
    this.m.slip!.classList.remove('on');
    this.m.hurt!.style.opacity = '0';
    this.m.ind!.innerHTML = '';
    this.hideResult();
  }
  cine(on: boolean): void {
    this.root.classList.toggle('cine', on);
  }
  story(html: string | null): void {
    if (html) this.m.story!.innerHTML = html;
    this.m.story!.classList.toggle('on', !!html);
  }
  count(text: string | null): void {
    this.m.count!.innerHTML = text ? `<span>${text}</span>` : '';
  }
  finale(text: string | null, lose = false): void {
    const f = this.m.finale!;
    if (text) f.querySelector('p')!.textContent = text;
    f.classList.toggle('lose', lose);
    f.classList.toggle('on', !!text);
  }
  hint(text: string | null, dur = 4): void {
    const h = this.m.hint!;
    if (!text) {
      h.classList.remove('on');
      return;
    }
    h.textContent = text;
    h.classList.add('on');
    clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => h.classList.remove('on'), dur * 1000);
  }
  score(v: string): void {
    this.setT('score', v);
  }
  record(v: string): void {
    this.setT('record', v);
  }
  objective(label: string, value: string): void {
    this.setT('objL', label);
    this.setT('objV', value);
  }
  gauge(pct: number | null): void {
    const g = this.m.gauge!;
    g.style.display = pct == null ? 'none' : '';
    if (pct != null) (g.firstElementChild as HTMLElement).style.width = pct.toFixed(1) + '%';
  }
  life(f: number): void {
    const pct = Math.round(f * 100);
    if (this.last.life === String(pct)) return;
    this.last.life = String(pct);
    this.m.life!.style.width = pct + '%';
    this.m.lifebox!.classList.toggle('low', pct < 30);
  }
  combo(show: boolean, pts: string, mult: string, left: number, warn: boolean): void {
    this.m.combo!.classList.toggle('on', show);
    if (!show) return;
    this.setT('cpts', pts);
    this.setT('cmult', mult);
    this.m.combo!.classList.toggle('warn', warn);
    this.m.cbar!.style.width = (left * 100).toFixed(0) + '%';
  }
  msg(cur: Message | null): void {
    const el = this.m.msg!;
    if (cur) {
      if (cur.id !== this.msgId) {
        this.msgId = cur.id;
        el.className = 'm-msg p' + cur.priority;
        void el.offsetWidth;
        el.classList.add('on');
        el.textContent = cur.text;
        cur.changed = false;
      } else if (cur.changed) {
        el.textContent = cur.text;
        cur.changed = false;
      }
    } else if (this.msgId !== -1) {
      this.msgId = -1;
      el.classList.remove('on');
    }
  }
  hurt(a: number): void {
    this.m.hurt!.style.opacity = a.toFixed(3);
  }
  graze(on: boolean): void {
    this.m.graze!.classList.toggle('on', on);
  }
  indicators(xs: number[]): void {
    const box = this.m.ind!;
    while (box.children.length < 3) box.appendChild(document.createElement('i'));
    [...box.children].forEach((c, i) => {
      const el = c as HTMLElement;
      const x = xs[i];
      el.style.display = x == null ? 'none' : '';
      if (x != null) el.style.left = (x * 100).toFixed(1) + '%';
    });
  }
  cue(on: boolean, side?: 'l' | 'r', text?: string, ring?: number): void {
    const c = this.m.cue!;
    c.classList.toggle('on', on);
    if (!on) return;
    c.classList.toggle('left', side === 'l');
    c.classList.toggle('right', side === 'r');
    this.setT('cueText', text || '');
    (c.querySelector('b') as HTMLElement).textContent = text || '';
    (c.querySelector('i') as HTMLElement).style.transform = `scaleX(${(ring ?? 0).toFixed(2)})`;
  }
  slip(on: boolean, pct: number, good: boolean): void {
    const s = this.m.slip!;
    s.classList.toggle('on', on);
    if (!on) return;
    s.classList.toggle('good', good);
    (s.firstElementChild as HTMLElement).style.transform = `scaleY(${pct.toFixed(2)})`;
  }

  // ---------------- resultado ----------------
  showResult(r: ResultView): void {
    this.m.rtitle!.textContent = r.title;
    this.m.rtitle!.className = 'm-tag ' + (r.win ? 'win' : 'lose');
    this.m.rsub!.textContent = r.sub;
    this.m.rline!.textContent = r.chapterLine;
    this.m.rscore!.textContent = r.score;
    this.m.rrec!.textContent = r.record;
    this.m.rrec!.classList.toggle('new', r.recordNew);
    this.m.rstars!.innerHTML = r.stars.map((s) => `<li class="${s.got ? 'got' : ''}"><i aria-hidden="true">★</i><span>${s.label}</span></li>`).join('');
    this.m.rstats!.innerHTML = r.stats.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    (this.m.retry!.firstElementChild as HTMLElement).textContent = r.win ? 'Jogar de novo' : 'Tentar de novo';
    this.m.result!.classList.add('show');
    this.finale(null);
  }
  hideResult(): void {
    this.m.result!.classList.remove('show');
  }
  get resultOpen(): boolean {
    return this.m.result!.classList.contains('show');
  }

  // ---------------- mundo aberto ----------------
  card(v: CardView | null): void {
    const c = this.m.card!;
    c.classList.toggle('on', !!v);
    if (!v) return;
    c.dataset.state = v.state;
    this.setT('cardN', String(v.num));
    this.setT('cardT', v.title);
    this.setT('cardL', v.line);
    this.setT('cardB', v.best);
    this.setT('cardA', v.action, true);
  }
  /** anel de segurar (0..1) ou null pra esconder */
  hold(progress: number | null, label = '', key = 'E'): void {
    const h = this.m.hold!;
    h.classList.toggle('on', progress != null);
    this.m.act!.classList.toggle('show', progress != null);
    if (progress == null) return;
    this.setT('holdLabel', label);
    this.setT('holdKey', key);
    const len = 2 * Math.PI * 19;
    (this.m.holdArc as unknown as SVGCircleElement).style.strokeDasharray = `${(progress * len).toFixed(1)} ${len.toFixed(1)}`;
  }
  panel(v: PanelView | null): void {
    const p = this.m.panel!;
    p.classList.toggle('on', !!v);
    if (!v) return;
    this.setT('pTag', v.tag);
    this.setT('pTitle', v.title);
    this.setT('pBody', v.body, true);
    this.setT('pAct', v.action || '', true);
    const sw = v.swatches
      ? v.swatches
          .map(
            (s) =>
              `<button data-sw="${s.id}" class="${s.sel ? 'sel' : ''}" ${s.locked ? 'disabled' : ''} title="${s.name}" style="--c:${s.color || 'linear-gradient(135deg,#888,#444)'}">${s.locked ? '🔒' : ''}</button>`,
          )
          .join('')
      : '';
    this.setT('pSw', sw, true);
  }
}
