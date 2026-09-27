import { SYNERGY_BY_ID } from '../config/upgrades';
import type { UpgradeOffer } from '../progression/UpgradeSystem';
import { h, Screen } from './dom';

/** LEVEL UP: world frozen, three cards. Input is ignored for a moment to avoid mis-taps. */
export class UpgradeScreen extends Screen {
  private readonly title: HTMLDivElement;
  private readonly subtitle: HTMLDivElement;
  private readonly cards: HTMLDivElement;
  private armedAt = 0;
  private picking = false;
  onPick: ((offer: UpgradeOffer) => void) | null = null;
  onHover: (() => void) | null = null;
  private offers: UpgradeOffer[] = [];

  constructor(parent: HTMLElement) {
    super(parent, 'upgrades dim');
    const head = h('div', 'head');
    this.title = h('div', 'title-xl', 'LEVEL UP');
    this.subtitle = h('div', 'label', 'ESCOLHA UM PODER');
    head.append(this.title, this.subtitle);
    this.cards = h('div', 'cards');
    this.root.append(head, this.cards);
    window.addEventListener('keydown', (e) => {
      if (!this.visible) return;
      const idx = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (idx >= 0 && this.offers[idx]) this.pick(idx);
    });
  }

  open(level: number, offers: UpgradeOffer[], levels: ReadonlyMap<string, number>, pendingAfter: number): void {
    this.offers = offers;
    this.picking = false;
    this.title.textContent = `NÍVEL ${level}`;
    this.subtitle.textContent = pendingAfter > 0 ? `ESCOLHA UM PODER · +${pendingAfter} NA FILA` : 'ESCOLHA UM PODER';
    this.cards.innerHTML = '';
    offers.forEach((o, i) => {
      const c = h('div', `card panel cat-${o.def.category}`);
      c.appendChild(h('div', 'cat', o.def.category));
      c.appendChild(h('div', 'icon', o.def.icon));
      c.appendChild(h('div', 'name', o.def.name));
      const pips = h('div', 'pips');
      const cur = levels.get(o.id) ?? 0;
      const add = o.enhanced ? 2 : 1;
      for (let l = 0; l < o.def.maxLevel; l++) {
        const p = h('i');
        if (l < cur) p.className = 'on';
        else if (l < cur + add) p.className = 'new';
        pips.appendChild(p);
      }
      c.appendChild(pips);
      if (o.enhanced) c.appendChild(h('div', 'badge', 'APRIMORADA · +2 NÍVEIS'));
      c.appendChild(h('div', 'desc', o.def.describe(o.nextLevel)));
      if (o.synergyHint) {
        const syn = SYNERGY_BY_ID.get(o.synergyHint);
        if (syn) c.appendChild(h('div', 'syn', `⚡ rumo a ${syn.name}`));
      }
      c.addEventListener('pointerenter', () => this.onHover?.());
      c.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pick(i);
      });
      c.addEventListener('pointerdown', (e) => e.stopPropagation());
      this.cards.appendChild(c);
    });
    this.armedAt = performance.now() + 450;
    this.show();
  }

  private pick(i: number): void {
    if (this.picking || performance.now() < this.armedAt) return;
    const offer = this.offers[i];
    if (!offer) return;
    this.picking = true;
    const el = this.cards.children[i] as HTMLElement | undefined;
    el?.classList.add('picked');
    setTimeout(() => {
      this.hide();
      this.onPick?.(offer);
    }, 280);
  }
}
