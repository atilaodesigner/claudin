import { formatInt } from '../utils/math';
import { h, onTap, Screen } from './dom';

export type MenuAction = 'play' | 'daily' | 'meta' | 'dex' | 'records' | 'settings' | 'account';

/** Cinematic title: the city and the saucer live behind it. */
export class MainMenu extends Screen {
  private readonly cores: HTMLSpanElement;
  private readonly dailyBtn: HTMLButtonElement;
  private readonly metaBtn: HTMLButtonElement;
  private readonly coords: HTMLDivElement;
  private readonly account: HTMLButtonElement;
  private readonly accountName: HTMLSpanElement;
  private readonly accountSub: HTMLSpanElement;
  onAction: ((a: MenuAction) => void) | null = null;

  constructor(parent: HTMLElement) {
    super(parent, 'menu');
    const left = h('div', 'left');
    const logo = h('div', 'logo');
    logo.appendChild(h('div', 'title-xl wordmark', 'ABDUZIU'));
    logo.appendChild(document.createElement('br'));
    logo.appendChild(h('div', 'sub', 'INVASÃO ALIENÍGENA · BRASIL'));
    left.appendChild(logo);

    const play = h('button', 'btn primary', 'INVADIR');
    onTap(play, () => this.onAction?.('play'));
    left.appendChild(play);
    this.dailyBtn = h('button', 'btn gold daily', 'INVASÃO DO DIA');
    onTap(this.dailyBtn, () => this.onAction?.('daily'));
    left.appendChild(this.dailyBtn);

    const links = h('div', 'links');
    this.metaBtn = h('button', 'btn ghost', 'Evoluções');
    const items: Array<[string, MenuAction, HTMLButtonElement?]> = [
      ['Evoluções', 'meta', this.metaBtn],
      ['Coleção', 'dex'],
      ['Recordes', 'records'],
      ['Configurações', 'settings'],
    ];
    for (const [label, action, existing] of items) {
      const b = existing ?? h('button', 'btn ghost', label);
      onTap(b, () => this.onAction?.(action));
      links.appendChild(b);
    }
    left.appendChild(links);

    const right = h('div', 'right');
    const topRight = h('div', 'top-right');
    const pill = h('div', 'panel cores-pill');
    pill.appendChild(h('span', 'gem'));
    this.cores = h('span', '', '0');
    pill.appendChild(this.cores);
    this.account = h('button', 'panel account-chip');
    this.accountName = h('span', 'name', 'ENTRAR');
    this.accountSub = h('span', 'sub', 'RANKING ONLINE');
    this.account.append(h('span', 'avatar'), this.accountName, this.accountSub);
    onTap(this.account, () => this.onAction?.('account'));
    topRight.append(pill, this.account);
    right.appendChild(topRight);
    this.coords = h('div', 'coords', '');
    right.appendChild(this.coords);
    this.root.append(left, right);
    // portrait phones: a small pill up top (tap = try landscape, X = hide for this session)
    const hint = h('button', 'rotate-hint');
    hint.setAttribute('aria-label', 'Girar para paisagem');
    const icon = h('span', 'phone');
    const txt = h('span', 'txt');
    txt.append(h('b', '', 'GIRE O CELULAR'), h('small', '', 'Melhor na horizontal'));
    const close = h('span', 'x', '✕');
    close.setAttribute('aria-label', 'Fechar aviso');
    hint.append(icon, txt, close);
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem('abduziu.rotateHint') === '0';
    } catch {
      /* private mode */
    }
    if (navigator.maxTouchPoints > 0 && !dismissed) hint.classList.add('touch');
    close.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      hint.classList.remove('touch');
      try {
        sessionStorage.setItem('abduziu.rotateHint', '0');
      } catch {
        /* private mode */
      }
    });
    onTap(hint, () => {
      // Android can rotate for us once in fullscreen; iOS just keeps the hint
      const el = document.documentElement;
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      const lock = () => o.lock?.('landscape').catch(() => undefined);
      if (!document.fullscreenElement && el.requestFullscreen) void el.requestFullscreen({ navigationUI: 'hide' }).then(lock).catch(() => undefined);
      else void lock();
    });
    this.root.appendChild(hint);
  }

  /** Corner readout: which city the saucer is hovering over right now. */
  setLocation(city: string, uf: string, lat: number, lon: number): void {
    this.coords.textContent = `SINAL: ${city.toUpperCase()} — ${uf}\nLAT ${lat.toFixed(2)} · LON ${lon.toFixed(2)}\nOBJETO NÃO IDENTIFICADO`;
  }

  /** Top-right account chip: nickname + division when signed in, a call to action otherwise. */
  setAccount(name: string, sub: string, color: string | null): void {
    this.accountName.textContent = name;
    this.accountSub.textContent = sub;
    this.account.classList.toggle('on', color !== null);
    this.account.style.setProperty('--div', color ?? 'var(--alien-green)');
  }

  refresh(cores: number, dailyBest: number | null, canBuy: boolean): void {
    this.cores.textContent = formatInt(cores);
    this.dailyBtn.textContent = dailyBest ? `INVASÃO DO DIA · RECORDE ${formatInt(dailyBest)}` : 'INVASÃO DO DIA';
    this.metaBtn.textContent = canBuy ? 'Evoluções ●' : 'Evoluções';
    this.metaBtn.style.color = canBuy ? 'var(--gold)' : '';
  }
}
