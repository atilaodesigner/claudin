import { DEX_OBJECTS, RARITY_INFO, TIER_NAMES, type ObjectDef } from '../config/objects';
import type { DexEntry } from '../save/SaveService';
import { formatInt } from '../utils/math';
import { h, onTap, Screen } from './dom';
import type { Thumbnails } from './Thumbnails';

/** ABDUCTION DEX: collect them all (silhouettes until the first capture). */
export class DexScreen extends Screen {
  private readonly grid: HTMLDivElement;
  private readonly count: HTMLElement;
  private readonly detail: HTMLDivElement;
  private queue: Array<{ def: ObjectDef; img: HTMLImageElement }> = [];
  private rafId = 0;
  onClose: (() => void) | null = null;
  private dex: Record<string, DexEntry> = {};

  constructor(
    parent: HTMLElement,
    private readonly thumbs: Thumbnails,
  ) {
    super(parent, 'sub');
    const top = h('div', 'topbar');
    const title = h('div', 'title-xl', 'COLEÇÃO');
    this.count = h('small', '', '');
    title.appendChild(this.count);
    const back = h('button', 'btn ghost', 'VOLTAR');
    onTap(back, () => {
      if (this.detail.style.display !== 'none') this.detail.style.display = 'none';
      else this.onClose?.();
    });
    top.append(title, back);
    const content = h('div', 'content scroll');
    this.grid = h('div', 'dex-grid');
    content.appendChild(this.grid);
    this.detail = h('div', 'dex-detail panel');
    this.detail.style.display = 'none';
    onTap(this.detail, () => (this.detail.style.display = 'none'));
    this.root.append(top, content, this.detail);
  }

  open(dex: Record<string, DexEntry>): void {
    this.dex = dex;
    const found = DEX_OBJECTS.filter((d) => dex[d.id]).length;
    this.count.textContent = `ABDUCTION DEX · ${found} / ${DEX_OBJECTS.length} OBJETOS`;
    this.grid.innerHTML = '';
    this.queue = [];
    for (const def of DEX_OBJECTS) {
      const entry = dex[def.id];
      const known = !!entry;
      const item = h('div', `dex-item panel${known ? '' : ' locked'}${def.secret ? ' secret' : ''}`);
      const img = h('img');
      img.alt = known ? def.name : '???';
      const cached = this.thumbs.get(def.id);
      if (cached) img.src = cached;
      else this.queue.push({ def, img });
      item.appendChild(img);
      item.appendChild(h('div', 'no', `#${def.dex.toString().padStart(3, '0')}`));
      item.appendChild(h('div', 'nm', known ? def.name : def.secret ? 'SECRETO' : '???'));
      onTap(item, () => this.showDetail(def));
      this.grid.appendChild(item);
    }
    this.show();
    cancelAnimationFrame(this.rafId);
    const pump = () => {
      // a few thumbnails per frame keeps the menu responsive
      for (let i = 0; i < 4 && this.queue.length > 0; i++) {
        const q = this.queue.shift()!;
        q.img.src = this.thumbs.render(q.def.id);
      }
      if (this.queue.length > 0 && this.visible) this.rafId = requestAnimationFrame(pump);
    };
    this.rafId = requestAnimationFrame(pump);
  }

  private showDetail(def: ObjectDef): void {
    const e = this.dex[def.id];
    this.detail.innerHTML = '';
    const img = h('img');
    img.src = this.thumbs.render(def.id);
    if (!e) img.style.filter = 'brightness(0)';
    const info = h('div', 'info');
    info.appendChild(h('div', 'label', `OBJETO #${def.dex.toString().padStart(3, '0')}`));
    info.appendChild(h('h2', '', e ? def.name : '???'));
    const row = (k: string, v: string) => {
      const r = h('div', 'row');
      r.appendChild(h('span', '', k));
      r.appendChild(h('b', '', v));
      info.appendChild(r);
    };
    row('CLASSE DE MASSA', `${def.tier} · ${TIER_NAMES[def.tier] ?? ''}`);
    row('PESO', e ? `${formatInt(def.massKg)} kg` : '—');
    row('RARIDADE', RARITY_INFO[def.rarity ?? 'normal'].label);
    row('CAPTURAS', e ? formatInt(e.count) : '—');
    row('PRIMEIRA CAPTURA', e ? new Date(e.firstCaptureAt).toLocaleDateString('pt-BR') : '—');
    row('MAIOR COMBO', e ? `x${e.bestCombo}` : '—');
    const desc = h('div', '', e ? def.description : def.secret ? 'Objeto secreto. Aparece raramente em algum canto de Nova Aurora.' : 'Ainda não abduzido.');
    desc.style.marginTop = '8px';
    desc.style.fontStyle = 'italic';
    info.appendChild(desc);
    this.detail.append(img, info);
    this.detail.style.display = 'flex';
  }
}
