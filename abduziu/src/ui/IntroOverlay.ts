import { h, Screen } from './dom';

/** Radio chatter + "SINAL LOCALIZADO" for the cinematic intro. */
export class IntroOverlay extends Screen {
  private readonly radio: HTMLDivElement;
  private readonly locate: HTMLDivElement;
  readonly skip: HTMLDivElement;
  readonly blackout: HTMLDivElement;
  private typeTimer: ReturnType<typeof setInterval> | null = null;
  onSkip: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    super(parent, 'intro');
    this.blackout = h('div', 'blackout');
    parent.appendChild(this.blackout);
    this.locate = h('div', 'locate');
    this.locate.innerHTML = 'SINAL LOCALIZADO<small>NOVA AURORA / BRASIL</small>';
    this.radio = h('div', 'radio');
    this.skip = h('div', 'skip', 'TOQUE PARA PULAR ▸▸');
    this.root.append(this.locate, this.radio, this.skip);
    this.root.appendChild(h('div', 'scanlines'));
    this.root.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (this.skip.style.display !== 'none') this.onSkip?.();
    });
  }

  setSkippable(on: boolean): void {
    this.skip.style.display = on ? '' : 'none';
  }

  say(who: string, text: string, charMs = 28): void {
    if (this.typeTimer) clearInterval(this.typeTimer);
    this.radio.innerHTML = '';
    const w = h('span', 'who', who);
    const t = h('span', '');
    this.radio.append(w, t);
    let i = 0;
    this.typeTimer = setInterval(() => {
      i++;
      t.textContent = text.slice(0, i);
      if (i >= text.length && this.typeTimer) clearInterval(this.typeTimer);
    }, charMs);
  }

  clearRadio(): void {
    if (this.typeTimer) clearInterval(this.typeTimer);
    this.radio.innerHTML = '';
  }

  showLocate(on: boolean): void {
    this.locate.classList.toggle('on', on);
  }

  setBlackout(on: boolean): void {
    this.blackout.classList.toggle('on', on);
  }
}
