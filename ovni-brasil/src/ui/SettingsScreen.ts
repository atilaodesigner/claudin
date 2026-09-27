import type { QualityPreset, Settings } from '../save/SaveService';
import { h, onTap, Screen } from './dom';

/** Accessibility and performance settings. */
export class SettingsScreen extends Screen {
  private readonly list: HTMLDivElement;
  onChange: ((s: Settings) => void) | null = null;
  onClose: (() => void) | null = null;
  onReset: (() => void) | null = null;
  private settings!: Settings;

  constructor(parent: HTMLElement) {
    super(parent, 'sub');
    this.root.style.zIndex = '42';
    const top = h('div', 'topbar');
    const title = h('div', 'title-xl', 'CONFIGURAÇÕES');
    const back = h('button', 'btn ghost', 'VOLTAR');
    onTap(back, () => this.onClose?.());
    top.append(title, back);
    const content = h('div', 'content scroll');
    this.list = h('div', 'list');
    content.appendChild(this.list);
    this.root.append(top, content);
  }

  open(s: Settings): void {
    this.settings = { ...s };
    this.render();
    this.show();
  }

  private emit(): void {
    this.onChange?.({ ...this.settings });
  }

  private render(): void {
    const s = this.settings;
    this.list.innerHTML = '';
    const slider = (label: string, key: 'masterVolume' | 'musicVolume' | 'sfxVolume' | 'uiScale', min = 0, max = 1, step = 0.05) => {
      const row = h('div', 'row panel');
      row.appendChild(h('span', '', label));
      const input = h('input');
      input.type = 'range';
      input.min = `${min}`;
      input.max = `${max}`;
      input.step = `${step}`;
      input.value = `${s[key]}`;
      input.addEventListener('input', () => {
        s[key] = parseFloat(input.value);
        this.emit();
      });
      input.addEventListener('pointerdown', (e) => e.stopPropagation());
      row.appendChild(input);
      this.list.appendChild(row);
    };
    const toggle = (label: string, key: 'haptics' | 'reduceShake' | 'reduceFlashes' | 'skipIntro' | 'showFps') => {
      const row = h('div', 'row panel');
      row.appendChild(h('span', '', label));
      const t = h('div', `toggle${s[key] ? ' on' : ''}`);
      onTap(t, () => {
        s[key] = !s[key];
        t.classList.toggle('on', s[key]);
        this.emit();
      });
      row.appendChild(t);
      this.list.appendChild(row);
    };
    slider('VOLUME GERAL', 'masterVolume');
    slider('MÚSICA', 'musicVolume');
    slider('EFEITOS', 'sfxVolume');
    toggle('VIBRAÇÃO (HAPTIC)', 'haptics');
    toggle('REDUZIR TREMOR DE CÂMERA', 'reduceShake');
    toggle('REDUZIR FLASHES', 'reduceFlashes');
    toggle('PULAR INTRODUÇÃO', 'skipIntro');
    toggle('MOSTRAR FPS', 'showFps');
    const qrow = h('div', 'row panel');
    qrow.appendChild(h('span', '', 'QUALIDADE GRÁFICA'));
    const sel = h('select');
    const opts: Array<[QualityPreset, string]> = [
      ['auto', 'Automática'],
      ['baixa', 'Baixa'],
      ['media', 'Média'],
      ['alta', 'Alta'],
    ];
    for (const [v, l] of opts) {
      const o = h('option', '', l);
      o.value = v;
      if (s.quality === v) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => {
      s.quality = sel.value as QualityPreset;
      this.emit();
    });
    sel.addEventListener('pointerdown', (e) => e.stopPropagation());
    qrow.appendChild(sel);
    this.list.appendChild(qrow);
    slider('TAMANHO DA INTERFACE', 'uiScale', 0.8, 1.25, 0.05);
    const reset = h('button', 'btn danger', 'APAGAR PROGRESSO');
    let armed = false;
    onTap(reset, () => {
      if (!armed) {
        armed = true;
        reset.textContent = 'TOQUE DE NOVO PARA APAGAR TUDO';
        return;
      }
      this.onReset?.();
      reset.textContent = 'PROGRESSO APAGADO';
    });
    reset.style.marginTop = '10px';
    this.list.appendChild(reset);
  }
}
