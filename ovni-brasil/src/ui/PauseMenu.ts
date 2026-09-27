import { h, onTap, Screen } from './dom';

export class PauseMenu extends Screen {
  onResume: (() => void) | null = null;
  onSettings: (() => void) | null = null;
  onQuit: (() => void) | null = null;
  private readonly quitBtn: HTMLButtonElement;
  private confirmQuit = false;

  constructor(parent: HTMLElement) {
    super(parent, 'pause dim');
    this.root.appendChild(h('div', 'title-xl', 'PAUSA'));
    const resume = h('button', 'btn', 'CONTINUAR');
    const settings = h('button', 'btn ghost', 'CONFIGURAÇÕES');
    this.quitBtn = h('button', 'btn ghost', 'ABANDONAR INVASÃO');
    onTap(resume, () => this.onResume?.());
    onTap(settings, () => this.onSettings?.());
    onTap(this.quitBtn, () => {
      if (!this.confirmQuit) {
        this.confirmQuit = true;
        this.quitBtn.textContent = 'TOQUE DE NOVO PARA CONFIRMAR';
        this.quitBtn.classList.add('danger');
        return;
      }
      this.onQuit?.();
    });
    this.root.append(resume, settings, this.quitBtn);
  }

  override show(): void {
    this.confirmQuit = false;
    this.quitBtn.textContent = 'ABANDONAR INVASÃO';
    this.quitBtn.classList.remove('danger');
    super.show();
  }
}
