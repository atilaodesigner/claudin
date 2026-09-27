import { META_BRANCHES, META_NODES, metaCost } from '../config/meta';
import type { MetaProgression } from '../progression/MetaProgression';
import { formatInt } from '../utils/math';
import { h, onTap, Screen } from './dom';

/** ÁRVORE DE EVOLUÇÃO: permanent upgrades bought with Alien Cores. */
export class MetaScreen extends Screen {
  private readonly tree: HTMLDivElement;
  private readonly coresEl: HTMLSpanElement;
  onClose: (() => void) | null = null;
  onBuy: ((ok: boolean) => void) | null = null;

  constructor(
    parent: HTMLElement,
    private readonly meta: MetaProgression,
  ) {
    super(parent, 'sub');
    const top = h('div', 'topbar');
    const title = h('div', 'title-xl', 'EVOLUÇÕES');
    title.appendChild(h('small', '', 'UPGRADES PERMANENTES DA NAVE'));
    const pill = h('div', 'panel cores-pill');
    pill.appendChild(h('span', 'gem'));
    this.coresEl = h('span', '', '0');
    pill.appendChild(this.coresEl);
    const back = h('button', 'btn ghost', 'VOLTAR');
    onTap(back, () => this.onClose?.());
    const right = h('div');
    right.style.display = 'flex';
    right.style.gap = '10px';
    right.style.alignItems = 'center';
    right.append(pill, back);
    top.append(title, right);
    const content = h('div', 'content scroll');
    this.tree = h('div', 'tree');
    content.appendChild(this.tree);
    this.root.append(top, content);
  }

  open(): void {
    this.render();
    this.show();
  }

  private render(boughtId?: string): void {
    this.coresEl.textContent = formatInt(this.meta.cores);
    this.tree.innerHTML = '';
    for (const branch of META_BRANCHES) {
      const col = h('div', 'branch');
      col.appendChild(h('h3', '', branch));
      for (const node of META_NODES.filter((n) => n.branch === branch)) {
        const lvl = this.meta.level(node.id);
        const unlocked = this.meta.isUnlocked(node);
        const max = lvl >= node.maxLevel;
        const cost = max ? 0 : metaCost(node, lvl);
        const afford = !max && unlocked && this.meta.cores >= cost;
        const el = h('div', `node panel${!unlocked ? ' locked' : ''}${max ? ' max' : ''}${afford ? ' afford' : ''}${boughtId === node.id ? ' bought' : ''}`);
        el.appendChild(h('div', 'nm', node.name));
        el.appendChild(h('div', 'ds', node.description));
        el.appendChild(h('div', 'pl', node.perLevel));
        const ft = h('div', 'ft');
        const pips = h('div', 'pips');
        for (let i = 0; i < node.maxLevel; i++) pips.appendChild(h('i', i < lvl ? 'on' : ''));
        ft.appendChild(pips);
        ft.appendChild(h('span', 'cost', max ? 'MÁX' : !unlocked ? '🔒' : `◆ ${formatInt(cost)}`));
        el.appendChild(ft);
        onTap(el, () => {
          const r = this.meta.buy(node.id);
          this.onBuy?.(r === 'ok');
          this.render(r === 'ok' ? node.id : undefined);
        });
        col.appendChild(el);
      }
      this.tree.appendChild(col);
    }
  }
}
