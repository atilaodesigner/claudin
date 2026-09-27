import { DEX_OBJECTS } from '../config/objects';
import type { SaveData } from '../save/SaveService';
import { dailyKey } from '../utils/rng';
import { formatInt, formatTime, formatTons } from '../utils/math';
import { h, onTap, Screen } from './dom';

export class RecordsScreen extends Screen {
  private readonly list: HTMLDivElement;
  onClose: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    super(parent, 'subscreen');
    const top = h('div', 'topbar');
    const title = h('div', 'title-xl', 'RECORDES');
    title.appendChild(h('small', '', 'SALVO NESTE APARELHO'));
    const back = h('button', 'btn ghost', 'VOLTAR');
    onTap(back, () => this.onClose?.());
    top.append(title, back);
    const content = h('div', 'content scroll');
    this.list = h('div', 'list');
    content.appendChild(this.list);
    this.root.append(top, content);
  }

  open(save: SaveData): void {
    const r = save.records;
    const found = DEX_OBJECTS.filter((d) => save.dex[d.id]).length;
    const today = save.daily[dailyKey()];
    const rows: Array<[string, string]> = [
      ['MAIOR PONTUAÇÃO', formatInt(r.bestScore)],
      ['MAIOR COMBO', `x${r.bestCombo}`],
      ['MAIOR MASSA ABDUZIDA', formatTons(r.bestMassKg)],
      ['MAIOR ALERTA SOBREVIVIDO', `${r.bestAlert}`],
      ['MENOR TEMPO ATÉ ALERTA MÁXIMO', r.fastestMaxAlert !== null ? formatTime(r.fastestMaxAlert) : '—'],
      ['OBJETOS ENCONTRADOS', `${found} / ${DEX_OBJECTS.length}`],
      ['TOTAL ABDUZIDO', formatInt(r.totalAbducted)],
      ['CAÇAS CAPTURADOS', formatInt(r.jetsCaptured)],
      ['TUCANO NEGRO DERROTADO', formatInt(r.bossesDefeated)],
      ['INVASÕES', formatInt(r.totalRuns)],
      ['INVASÃO DO DIA (HOJE)', today ? `${formatInt(today.bestScore)} · ${today.attempts} tentativa(s)` : '—'],
      ['ALIEN CORES GANHOS', formatInt(save.totalCoresEarned)],
    ];
    this.list.innerHTML = '';
    for (const [k, v] of rows) {
      const row = h('div', 'row panel');
      row.appendChild(h('span', '', k));
      row.appendChild(h('b', '', v));
      this.list.appendChild(row);
    }
    if (save.history.length) {
      this.list.appendChild(h('div', 'label', 'ÚLTIMAS INVASÕES'));
      for (const run of [...save.history].reverse().slice(0, 6)) {
        const row = h('div', 'row panel');
        row.appendChild(h('span', '', `${new Date(run.date).toLocaleDateString('pt-BR')} · ${run.extracted ? 'EXTRAÍDO' : 'ABATIDO'}${run.daily ? ' · DIÁRIA' : ''}`));
        row.appendChild(h('b', '', formatInt(run.score)));
        this.list.appendChild(row);
      }
    }
    this.show();
  }
}
