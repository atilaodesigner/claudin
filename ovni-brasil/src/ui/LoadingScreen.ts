import { h, Screen } from './dom';

const MESSAGES = ['CALIBRANDO FEIXE...', 'RASTREANDO VIDA...', 'IGNORANDO ESPAÇO AÉREO...', 'MAPEANDO CAIXAS D\'ÁGUA...', 'CONTANDO VIRA-LATAS...', 'SINTONIZANDO RÁDIO LOCAL...'];

/** INTERCEPTANDO SINAL... */
export class LoadingScreen extends Screen {
  private readonly bar: HTMLDivElement;
  private readonly msg: HTMLDivElement;
  private msgIndex = 0;
  private msgTimer: ReturnType<typeof setInterval> | null = null;

  constructor(parent: HTMLElement) {
    super(parent, 'loading');
    this.root.appendChild(h('div', 'sig', 'INTERCEPTANDO SINAL...'));
    this.bar = h('div', 'bar', '░░░░░░░░░░  0%');
    this.msg = h('div', 'msg', MESSAGES[0]);
    const loc = h('div', 'loc');
    loc.innerHTML = 'LOCALIZAÇÃO:<br>NOVA AURORA — BRASIL';
    this.root.append(this.bar, this.msg, loc);
    this.root.appendChild(h('div', 'scanlines'));
  }

  start(): void {
    this.show();
    this.root.classList.add('visible');
    this.msgTimer = setInterval(() => {
      this.msgIndex = (this.msgIndex + 1) % MESSAGES.length;
      this.msg.textContent = MESSAGES[this.msgIndex] as string;
    }, 650);
  }

  progress(p: number, label?: string): void {
    const n = Math.round(Math.max(0, Math.min(1, p)) * 10);
    this.bar.textContent = `${'█'.repeat(n)}${'░'.repeat(10 - n)}  ${Math.round(p * 100)}%`;
    if (label) this.msg.textContent = label;
  }

  finish(): void {
    if (this.msgTimer) clearInterval(this.msgTimer);
    this.hide();
  }
}
