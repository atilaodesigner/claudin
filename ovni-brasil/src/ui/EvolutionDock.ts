import { SYNERGY_BY_ID } from '../config/upgrades';
import type { UpgradeOffer } from '../progression/UpgradeSystem';
import { h } from './dom';
import { evolutionIcon } from './EvolutionIcons';

/**
 * LEVEL UP without pausing: three compact chips (icon + title) slide in at the
 * bottom of the HUD while the run keeps going. Tap/click or keys 1-3 to evolve.
 * Pending level-ups queue up and roll the next set right after a pick.
 */
export class EvolutionDock {
  readonly root: HTMLDivElement;
  private readonly head: HTMLDivElement;
  private readonly queue: HTMLElement;
  private readonly list: HTMLDivElement;
  private readonly tip: HTMLDivElement;
  private offers: UpgradeOffer[] = [];
  private armedAt = 0;
  private openedAt = 0;
  private picking = false;
  private nudged = false;
  /** Set by the game: whether keys/taps should be accepted right now. */
  canPick: () => boolean = () => true;
  onPick: ((offer: UpgradeOffer) => void) | null = null;
  onHover: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = h('div', 'evo-dock');
    const top = h('div', 'evo-top');
    this.head = h('div', 'evo-head', '');
    this.queue = h('span', 'evo-queue', '');
    top.append(this.head, this.queue);
    this.list = h('div', 'evo-list');
    this.tip = h('div', 'evo-tip');
    this.root.append(this.tip, top, this.list);
    parent.appendChild(this.root);
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen || !this.canPick()) return;
      const idx = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code) % 3;
      if (idx >= 0 && this.offers[idx]) this.pick(idx);
    });
  }

  get isOpen(): boolean {
    return this.root.classList.contains('open');
  }

  open(level: number, offers: UpgradeOffer[], levels: ReadonlyMap<string, number>, pendingAfter: number): void {
    this.offers = offers;
    this.picking = false;
    this.nudged = false;
    this.head.textContent = `NÍVEL ${level} · EVOLUA`;
    this.queue.textContent = pendingAfter > 0 ? `+${pendingAfter}` : '';
    this.queue.style.display = pendingAfter > 0 ? '' : 'none';
    this.tip.classList.remove('on');
    this.list.innerHTML = '';
    offers.forEach((o, i) => {
      const cur = levels.get(o.id) ?? 0;
      const next = Math.min(o.def.maxLevel, cur + (o.enhanced ? 2 : 1));
      const chip = h('button', `evo-chip cat-${o.def.category}${o.enhanced ? ' enhanced' : ''}`);
      chip.type = 'button';
      chip.style.animationDelay = `${i * 0.06}s`;
      chip.setAttribute('aria-label', `${o.def.name}, nível ${next}. ${o.def.describe(o.nextLevel)}`);
      const icon = h('span', 'ic');
      icon.innerHTML = evolutionIcon(o.id);
      const txt = h('span', 'tx');
      txt.appendChild(h('span', 'nm', o.def.name));
      const meta = h('span', 'lv', o.enhanced ? `NV ${next} · +2` : cur === 0 ? 'NOVO' : `NV ${next}`);
      if (o.synergyHint) meta.appendChild(h('i', 'syn', ' ⚡'));
      txt.appendChild(meta);
      chip.append(h('span', 'key', `${i + 1}`), icon, txt);
      chip.addEventListener('pointerdown', (e) => e.stopPropagation());
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pick(i);
      });
      chip.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        this.onHover?.();
        this.showTip(o);
      });
      chip.addEventListener('pointerleave', () => this.tip.classList.remove('on'));
      this.list.appendChild(chip);
    });
    this.openedAt = performance.now();
    // a finger already on the glass shouldn't pick by accident
    this.armedAt = this.openedAt + 260;
    this.root.classList.remove('nudge');
    this.root.classList.add('open');
  }

  close(): void {
    this.root.classList.remove('open', 'nudge');
    this.tip.classList.remove('on');
    this.offers = [];
  }

  /** Keeps the queue badge live and nudges when choices sit untouched. */
  update(queued: number): void {
    if (!this.isOpen) return;
    const q = queued > 0 ? `+${queued}` : '';
    if (this.queue.textContent !== q) {
      this.queue.textContent = q;
      this.queue.style.display = q ? '' : 'none';
    }
    if (this.nudged) return;
    if (performance.now() - this.openedAt > 12000) {
      this.nudged = true;
      this.root.classList.add('nudge');
    }
  }

  private showTip(o: UpgradeOffer): void {
    this.tip.innerHTML = '';
    this.tip.appendChild(h('b', '', o.def.name));
    this.tip.appendChild(h('span', '', o.def.describe(o.nextLevel)));
    if (o.synergyHint) {
      const syn = SYNERGY_BY_ID.get(o.synergyHint);
      if (syn) this.tip.appendChild(h('span', 'syn', `⚡ rumo a ${syn.name}`));
    }
    this.tip.classList.add('on');
  }

  private pick(i: number): void {
    if (this.picking || performance.now() < this.armedAt) return;
    const offer = this.offers[i];
    if (!offer) return;
    this.picking = true;
    this.tip.classList.remove('on');
    const chips = Array.from(this.list.children) as HTMLElement[];
    chips.forEach((c, j) => c.classList.add(j === i ? 'picked' : 'dropped'));
    this.onPick?.(offer);
  }
}
