import { formatInt } from '../utils/math';
import { h, onTap, Screen } from './dom';

export type MenuAction = 'play' | 'daily' | 'meta' | 'dex' | 'records' | 'settings';

/** Cinematic title: the city and the saucer live behind it. */
export class MainMenu extends Screen {
  private readonly cores: HTMLSpanElement;
  private readonly dailyBtn: HTMLButtonElement;
  private readonly metaBtn: HTMLButtonElement;
  onAction: ((a: MenuAction) => void) | null = null;

  constructor(parent: HTMLElement) {
    super(parent, 'menu');
    const left = h('div', 'left');
    const logo = h('div', 'logo');
    logo.appendChild(h('div', 'title-xl ovni', 'OVNI'));
    logo.appendChild(h('div', 'title-xl brasil', 'BRASIL'));
    logo.appendChild(document.createElement('br'));
    logo.appendChild(h('div', 'sub', 'ABDUÇÃO TOTAL'));
    left.appendChild(logo);

    const play = h('button', 'btn primary', 'INVADIR');
    onTap(play, () => this.onAction?.('play'));
    left.appendChild(play);
    this.dailyBtn = h('button', 'btn gold daily', 'INVASÃO DO DIA');
    onTap(this.dailyBtn, () => this.onAction?.('daily'));
    left.appendChild(this.dailyBtn);

    const links = h('div', 'links');
    this.metaBtn = h('button', 'btn ghost', 'Evoluções');
    const items: Array<[string, MenuAction, HTMLButtonElement?]> = [
      ['Evoluções', 'meta', this.metaBtn],
      ['Coleção', 'dex'],
      ['Recordes', 'records'],
      ['Configurações', 'settings'],
    ];
    for (const [label, action, existing] of items) {
      const b = existing ?? h('button', 'btn ghost', label);
      onTap(b, () => this.onAction?.(action));
      links.appendChild(b);
    }
    left.appendChild(links);

    const right = h('div', 'right');
    const pill = h('div', 'panel cores-pill');
    pill.appendChild(h('span', 'gem'));
    this.cores = h('span', '', '0');
    pill.appendChild(this.cores);
    right.appendChild(pill);
    right.appendChild(h('div', 'coords', 'SINAL: NOVA AURORA — BRASIL\nLAT -22.9 · LON -43.2\nOBJETO NÃO IDENTIFICADO'));
    this.root.append(left, right);
    const hint = h('div', 'rotate-hint', '↻ GIRE O CELULAR PARA A MELHOR EXPERIÊNCIA');
    if (navigator.maxTouchPoints > 0) hint.classList.add('touch');
    this.root.appendChild(hint);
  }

  refresh(cores: number, dailyBest: number | null, canBuy: boolean): void {
    this.cores.textContent = formatInt(cores);
    this.dailyBtn.textContent = dailyBest ? `INVASÃO DO DIA · RECORDE ${formatInt(dailyBest)}` : 'INVASÃO DO DIA';
    this.metaBtn.textContent = canBuy ? 'Evoluções ●' : 'Evoluções';
    this.metaBtn.style.color = canBuy ? 'var(--gold)' : '';
  }
}
