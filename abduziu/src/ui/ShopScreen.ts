import { BEAMS, SKINS, TIER_INFO, TOPPER_NAMES, type BeamStyle, type Skin } from '../config/cosmetics';
import type { SaveData } from '../save/SaveService';
import { patternSwatch } from '../ufo/SkinArt';
import { formatInt } from '../utils/math';
import { h, onTap, Screen } from './dom';

type Tab = 'skins' | 'memes' | 'feixes' | 'super';
type Item = { kind: 'skin'; item: Skin } | { kind: 'beam'; item: BeamStyle };

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/**
 * LOJA: cosmetic skins and beam colours for Alien Cores. Tapping a card previews it on
 * the real saucer behind the panel; super classes also need a best score.
 */
export class ShopScreen extends Screen {
  private readonly grid: HTMLDivElement;
  private readonly coresEl: HTMLSpanElement;
  private readonly bar: HTMLDivElement;
  private readonly barName: HTMLDivElement;
  private readonly barInfo: HTMLDivElement;
  private readonly barBtn: HTMLButtonElement;
  private readonly tabs = new Map<Tab, HTMLButtonElement>();
  private tab: Tab = 'skins';
  private selected: Item | null = null;
  private save: SaveData | null = null;
  onClose: (() => void) | null = null;
  /** Show this look on the menu saucer (null = back to what's equipped). */
  onPreview: ((skin: string | null, beam: string | null) => void) | null = null;
  /** Spend cores; returns false if not enough. */
  onBuy: ((kind: 'skin' | 'beam', id: string, price: number) => boolean) | null = null;
  onEquip: ((kind: 'skin' | 'beam', id: string) => void) | null = null;

  constructor(parent: HTMLElement) {
    super(parent, 'subscreen shop');
    const top = h('div', 'topbar');
    const title = h('div', 'title-xl', 'LOJA');
    title.appendChild(h('small', '', 'VISUAL DA NAVE · SÓ COSMÉTICO'));
    const pill = h('div', 'panel cores-pill');
    pill.appendChild(h('span', 'gem'));
    this.coresEl = h('span', '', '0');
    pill.appendChild(this.coresEl);
    const back = h('button', 'btn ghost', 'VOLTAR');
    onTap(back, () => this.onClose?.());
    const right = h('div', 'shop-top');
    right.append(pill, back);
    top.append(title, right);

    const tabs = h('div', 'shop-tabs');
    for (const [id, label] of [['skins', 'SKINS'], ['memes', 'MEMES'], ['feixes', 'FEIXES'], ['super', 'SUPER CLASSES']] as Array<[Tab, string]>) {
      const b = h('button', `shop-tab${id === 'super' || id === 'memes' ? ` ${id}` : ''}`, label);
      onTap(b, () => {
        this.tab = id;
        this.selected = null;
        this.render();
      });
      this.tabs.set(id, b);
      tabs.appendChild(b);
    }

    const content = h('div', 'content scroll');
    this.grid = h('div', 'shop-grid');
    content.appendChild(this.grid);

    this.bar = h('div', 'shop-bar panel');
    const txt = h('div', 'txt');
    this.barName = h('div', 'nm', '');
    this.barInfo = h('div', 'in', '');
    txt.append(this.barName, this.barInfo);
    this.barBtn = h('button', 'btn primary', '');
    onTap(this.barBtn, () => this.act());
    this.bar.append(txt, this.barBtn);

    this.root.append(top, tabs, content, this.bar);
  }

  open(save: SaveData): void {
    this.save = save;
    this.selected = null;
    this.render();
    this.show();
  }

  override hide(): void {
    this.onPreview?.(null, null);
    super.hide();
  }

  private owned(kind: 'skin' | 'beam', id: string): boolean {
    return !!this.save?.cosmetics.owned.includes(`${kind}:${id}`);
  }
  private equipped(kind: 'skin' | 'beam', id: string): boolean {
    const c = this.save?.cosmetics;
    return !!c && (kind === 'skin' ? c.skin === id : c.beam === id);
  }

  private items(): Item[] {
    if (this.tab === 'feixes') return BEAMS.map((b) => ({ kind: 'beam', item: b }) as Item);
    const pick =
      this.tab === 'memes' ? (s: Skin) => !!s.meme : this.tab === 'super' ? (s: Skin) => s.tier === 'super' : (s: Skin) => !s.meme && s.tier !== 'super';
    return SKINS.filter(pick)
      .sort((a, b) => a.price - b.price)
      .map((s) => ({ kind: 'skin', item: s }) as Item);
  }

  render(): void {
    const save = this.save;
    if (!save) return;
    this.coresEl.textContent = formatInt(save.cores);
    for (const [id, b] of this.tabs) b.classList.toggle('on', id === this.tab);
    this.grid.innerHTML = '';
    this.grid.classList.toggle('super', this.tab === 'super');
    for (const it of this.items()) {
      const { kind, item } = it;
      const tier = TIER_INFO[item.tier];
      const own = this.owned(kind, item.id);
      const eq = this.equipped(kind, item.id);
      const card = h('button', `shop-card panel${eq ? ' eq' : ''}${own ? ' own' : ''}${this.selected?.item.id === item.id ? ' sel' : ''}`);
      card.style.setProperty('--t', tier.color);
      const sw = h('div', 'sw');
      if (kind === 'skin') {
        const s = item as Skin;
        sw.style.setProperty('--hull', hex(s.hull));
        sw.style.setProperty('--trim', hex(s.trim));
        sw.style.setProperty('--dome', hex(s.dome));
        sw.style.setProperty('--acc', hex(s.accent));
        sw.classList.add('saucer', `fx-${s.fx}`);
        if (s.pattern) {
          sw.classList.add('painted');
          sw.style.setProperty('--paint', `url(${patternSwatch(s.pattern, s.patternColors ?? [s.hull])})`);
        }
        sw.append(h('i', 'dome'), h('i', 'hull'), h('i', 'lights'));
      } else {
        const b = item as BeamStyle;
        sw.classList.add('beam');
        if (typeof b.color === 'number') sw.style.setProperty('--beam', hex(b.color));
        else sw.classList.add(b.color);
        sw.append(h('i', 'cone'));
      }
      card.appendChild(sw);
      const meme = kind === 'skin' && (item as Skin).meme;
      card.appendChild(h('div', 'tier', meme && this.tab === 'memes' && item.tier !== 'super' ? `MEME · ${tier.label}` : tier.label));
      card.appendChild(h('div', 'nm', item.name));
      const topper = kind === 'skin' ? (item as Skin).topper : undefined;
      if (topper) card.appendChild(h('div', 'acc', `+ ${TOPPER_NAMES[topper]}`));
      const price = h('div', 'pr');
      if (eq) price.textContent = 'EQUIPADO';
      else if (own) price.textContent = 'SEU · TOQUE PRA USAR';
      else if (item.price === 0) price.textContent = 'GRÁTIS';
      else {
        price.appendChild(h('span', 'gem'));
        price.appendChild(document.createTextNode(formatInt(item.price)));
      }
      card.appendChild(price);
      const minScore = kind === 'skin' ? (item as Skin).minScore : undefined;
      if (minScore && !own) {
        const locked = save.records.bestScore < minScore;
        card.appendChild(h('div', `req${locked ? ' no' : ''}`, `${locked ? '🔒 ' : '✓ '}SCORE ${formatInt(minScore)}`));
      }
      onTap(card, () => {
        this.selected = it;
        this.onPreview?.(kind === 'skin' ? item.id : null, kind === 'beam' ? item.id : null);
        this.render();
      });
      this.grid.appendChild(card);
    }
    this.renderBar();
  }

  private renderBar(): void {
    const save = this.save;
    const sel = this.selected;
    this.bar.style.display = sel ? '' : 'none';
    if (!sel || !save) return;
    const { kind, item } = sel;
    const own = this.owned(kind, item.id);
    const eq = this.equipped(kind, item.id);
    const minScore = kind === 'skin' ? (item as Skin).minScore : undefined;
    this.barName.textContent = item.name;
    this.barInfo.textContent = kind === 'skin' ? (item as Skin).description : typeof (item as BeamStyle).color === 'number' ? 'Cor do feixe trator e do brilho da nave.' : 'Feixe animado: a cor muda o tempo todo enquanto você abduz.';
    this.barBtn.disabled = false;
    this.barBtn.className = 'btn primary';
    if (eq) {
      this.barBtn.textContent = 'EQUIPADO';
      this.barBtn.disabled = true;
    } else if (own) this.barBtn.textContent = 'USAR';
    else if (minScore && save.records.bestScore < minScore) {
      this.barBtn.textContent = `PRECISA DE ${formatInt(minScore)} DE SCORE`;
      this.barBtn.disabled = true;
    } else if (save.cores < item.price) {
      this.barBtn.textContent = `FALTAM ${formatInt(item.price - save.cores)} CORES`;
      this.barBtn.disabled = true;
    } else this.barBtn.textContent = item.price === 0 ? 'PEGAR' : `COMPRAR · ${formatInt(item.price)}`;
  }

  private act(): void {
    const sel = this.selected;
    const save = this.save;
    if (!sel || !save) return;
    const { kind, item } = sel;
    if (!this.owned(kind, item.id)) {
      if (!this.onBuy?.(kind, item.id, item.price)) return;
    }
    this.onEquip?.(kind, item.id);
    this.render();
  }
}
