import type { HighlightPayload } from '../core/EventBus';
import { formatInt, formatTime, formatTons } from '../utils/math';
import { h, onTap, Screen } from './dom';

export interface ResultsData {
  extracted: boolean;
  quit: boolean;
  score: number;
  objects: number;
  massKg: number;
  bestCombo: number;
  jets: number;
  enemies: number;
  discoveries: number;
  maxAlert: number;
  duration: number;
  level: number;
  coresBase: number;
  coresTotal: number;
  multiplier: number;
  challenges: ReadonlyArray<{ title: string; done: boolean; reward: number }>;
  highlights: readonly HighlightPayload[];
  goal: { name: string; missing: number; cost: number; level: number } | null;
  newRecord: boolean;
  daily: boolean;
  modeName: string;
  cityName: string;
  campaign: { stars: readonly boolean[]; earnedNow: readonly boolean[]; newStars: number; unlocked: string | null; bonusCores: number } | null;
  rank: { delta: number; rp: number; division: string; color: string; promoted: boolean; demoted: boolean; progress: number } | null;
}

/** End of the run: the city shrinks below, the stats count up, the "só mais uma" hook. */
export class ResultsScreen extends Screen {
  private readonly left: HTMLDivElement;
  private readonly side: HTMLDivElement;
  private onlineLine: HTMLDivElement | null = null;
  onAgain: (() => void) | null = null;
  onMeta: (() => void) | null = null;
  onMenu: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    super(parent, 'results');
    const wrap = h('div', 'wrap');
    this.left = h('div', 'scroll');
    this.side = h('div', 'panel side');
    wrap.append(this.left, this.side);
    this.root.appendChild(wrap);
  }

  /** Ranked runs: live status of the online submission under the RP box. */
  setOnline(text: string, tone: 'ok' | 'bad' | '' = ''): void {
    if (!this.onlineLine) return;
    this.onlineLine.textContent = text;
    this.onlineLine.className = `online ${tone}`;
  }

  open(d: ResultsData): void {
    this.left.innerHTML = '';
    this.side.innerHTML = '';
    const head = h('div', 'head');
    const title = d.extracted ? 'INVASÃO CONCLUÍDA' : d.quit ? 'SINAL PERDIDO' : 'NAVE ABATIDA';
    head.appendChild(h('div', `title-xl${d.extracted ? '' : ' bad'}`, title));
    head.appendChild(h('div', 'label', `${d.modeName} · ${d.cityName}${d.extracted ? ' · EXTRAÇÃO BEM-SUCEDIDA' : ' · A CIDADE RESISTIU... DESSA VEZ'}`));
    this.left.appendChild(head);
    if (d.campaign) {
      const c = d.campaign;
      const box = h('div', 'res-stars');
      c.stars.forEach((got, i) => {
        const star = h('span', `${got ? 'on' : ''}${c.earnedNow[i] ? ' now' : ''}`, got ? '★' : '☆');
        star.style.animationDelay = `${0.3 + i * 0.25}s`;
        box.appendChild(star);
      });
      const info = h('div', 'res-stars-info');
      if (c.newStars > 0) info.appendChild(h('b', '', `+${c.newStars} ${c.newStars > 1 ? 'ESTRELAS NOVAS' : 'ESTRELA NOVA'} · +${c.bonusCores} CORES`));
      if (c.unlocked) info.appendChild(h('div', 'unlock', `NOVA CIDADE LIBERADA: ${c.unlocked}`));
      box.appendChild(info);
      this.left.appendChild(box);
    }
    if (d.rank) {
      const r = d.rank;
      const box = h('div', 'res-rank panel');
      box.style.setProperty('--div', r.color);
      box.appendChild(h('div', `delta ${r.delta >= 0 ? 'up' : 'down'}`, `${r.delta >= 0 ? '+' : ''}${r.delta} RP`));
      const info = h('div', 'info');
      info.appendChild(h('b', '', r.promoted ? `PROMOVIDO: ${r.division}!` : r.demoted ? `REBAIXADO: ${r.division}` : r.division));
      info.appendChild(h('span', '', `${formatInt(r.rp)} RP`));
      const bar = h('div', 'bar');
      const fill = h('div', 'fill');
      fill.style.transform = `scaleX(${r.progress.toFixed(3)})`;
      bar.appendChild(fill);
      info.appendChild(bar);
      this.onlineLine = h('div', 'online', '');
      info.appendChild(this.onlineLine);
      box.appendChild(info);
      this.left.appendChild(box);
    } else this.onlineLine = null;
    const stats = h('div', 'stats');
    const rows: Array<[string, string]> = [
      ['PONTUAÇÃO', formatInt(d.score) + (d.newRecord ? '  ★ RECORDE' : '')],
      ['OBJETOS ABDUZIDOS', formatInt(d.objects)],
      ['PESO TOTAL', formatTons(d.massKg)],
      ['MAIOR COMBO', `x${d.bestCombo}`],
      ['CAÇAS CAPTURADOS', `${d.jets}`],
      ['INIMIGOS NEUTRALIZADOS', `${d.enemies}`],
      ['NOVOS OBJETOS', `${d.discoveries}`],
      ['ALERTA MÁXIMO', `${d.maxAlert}`],
      ['TEMPO DE INVASÃO', formatTime(d.duration)],
      ['NÍVEL DA NAVE', `${d.level}`],
    ];
    rows.forEach(([k, v], i) => {
      const r = h('div', 'stat');
      r.style.animationDelay = `${0.08 * i}s`;
      r.appendChild(h('span', '', k));
      r.appendChild(h('b', '', v));
      stats.appendChild(r);
    });
    this.left.appendChild(stats);

    // side: cores, challenges, moments, actions
    const cores = h('div', 'cores');
    cores.appendChild(h('div', 'label', 'ALIEN CORES'));
    const big = h('div', 'big', '0');
    cores.appendChild(big);
    const multText = d.extracted ? `BASE ${formatInt(d.coresBase)} × EXTRAÇÃO x${d.multiplier}` : `BASE ${formatInt(d.coresBase)} × ${Math.round(d.multiplier * 100)}% (SEM EXTRAÇÃO)`;
    cores.appendChild(h('div', 'mult', multText + (d.campaign && d.campaign.bonusCores > 0 ? ` + ${formatInt(d.campaign.bonusCores)} ESTRELAS` : '')));
    this.side.appendChild(cores);
    this.countUp(big, d.coresTotal);

    if (d.challenges.length) {
      const box = h('div');
      box.appendChild(h('div', 'label', d.campaign ? 'ESTRELAS DA CIDADE' : 'DESAFIOS'));
      for (const c of d.challenges) {
        const row = h('div', `chal${c.done ? ' done' : ''}`);
        row.appendChild(h('span', '', `${c.done ? '✔' : '○'} ${c.title}`));
        row.appendChild(h('span', '', c.done ? `+${c.reward}` : ''));
        box.appendChild(row);
      }
      this.side.appendChild(box);
    }
    if (d.highlights.length) {
      const m = h('div', 'moments');
      m.textContent = `MOMENTOS: ${d.highlights.map((x) => x.label).join(' · ')}`;
      this.side.appendChild(m);
    }
    if (d.goal) {
      const g = h('div', 'goal');
      g.innerHTML =
        d.goal.missing > 0
          ? `FALTAM <b>${formatInt(d.goal.missing)} ALIEN CORES</b><br>para <b>${d.goal.name.toUpperCase()} ${roman(d.goal.level)}</b>`
          : `VOCÊ JÁ PODE COMPRAR <b>${d.goal.name.toUpperCase()} ${roman(d.goal.level)}</b>!`;
      this.side.appendChild(g);
    }
    const actions = h('div', 'actions');
    const again = h('button', 'btn', 'INVADIR NOVAMENTE');
    onTap(again, () => this.onAgain?.());
    const row = h('div', 'row');
    const meta = h('button', `btn ${d.goal && d.goal.missing <= 0 ? 'gold' : 'ghost'}`, 'EVOLUÇÕES');
    const menu = h('button', 'btn ghost', 'MENU');
    onTap(meta, () => this.onMeta?.());
    onTap(menu, () => this.onMenu?.());
    row.append(meta, menu);
    actions.append(again, row);
    this.side.appendChild(actions);
    this.show();
  }

  private countUp(el: HTMLElement, target: number): void {
    const start = performance.now();
    const dur = 1200;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      el.textContent = formatInt(target * e);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

function roman(n: number): string {
  return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][n] ?? `${n}`;
}
