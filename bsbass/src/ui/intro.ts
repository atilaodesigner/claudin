// Abertura: logo animada da Gueto Game Studio (SVG + Web Animations, feita
// em código) e depois o vídeo da logo BSBASS. Enquanto isso o jogo carrega
// assets, monta a cidade e compila os shaders por trás. Toque/tecla pula.

const RED = '#ff1411';

// ---------- logo GUETO (coordenadas do arquivo original 1860×846) ----------
const C = 22; // chanfro dos cantos
const LETTERS: { d: string; x: number }[] = [
  // G: barra de cima, haste, base, braço direito com o dente
  { x: 397, d: `M${270 + C} 270 H${525 - C} L525 ${270 + C} V335 H338 V445 H457 V410 H398 V388 L383 365 H525 V${498 - C} L${525 - C} 498 H${270 + C} L270 ${498 - C} V${270 + C} Z` },
  { x: 670, d: `M545 270 H615 V445 H725 V270 H795 V${498 - C} L${795 - C} 498 H${545 + C} L545 ${498 - C} Z` },
  { x: 933, d: `M${815 + C} 270 H1052 V335 H883 V360 H1048 V415 H883 V445 H1052 V498 H${815 + C} L815 ${498 - C} V${270 + C} Z` },
  { x: 1196, d: 'M1080 270 H1312 V335 H1230 V498 H1160 V335 H1080 Z' },
  { x: 1462, d: `M${1334 + C} 270 H${1590 - C} L1590 ${270 + C} V${498 - C} L${1590 - C} 498 H${1334 + C} L1334 ${498 - C} V${270 + C} Z M1397 335 V445 H1523 V335 Z` },
];
const FRAME = 'M215 548 V214 H1648 V548 Z';
const FRAME_LEN = 2 * (1648 - 215) + 2 * (548 - 214);
const SUB = 'GAME STUDIO';

function gueto(): string {
  const letters = LETTERS.map((l, i) => `<path class="gl" data-i="${i}" d="${l.d}" fill-rule="evenodd" style="transform-origin:${l.x}px 384px"/>`).join('');
  // "GAME STUDIO" letra por letra, espaçado como no original
  const sub = [...SUB]
    .map((ch, i) => (ch === ' ' ? '' : `<text class="gs" x="${410 + i * 107}" y="668">${ch}</text>`))
    .join('');
  return `
<svg class="gueto" viewBox="150 150 1560 560" role="img" aria-label="Gueto Game Studio">
  <defs>
    <filter id="gg" x="-20%" y="-40%" width="140%" height="180%">
      <feGaussianBlur stdDeviation="9" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g class="gshake">
    <path class="gframe" d="${FRAME}" fill="none" stroke="${RED}" stroke-width="28" stroke-dasharray="${FRAME_LEN}" stroke-dashoffset="${FRAME_LEN}" filter="url(#gg)"/>
    <g class="gsplit c" fill="#1ff4ff">${letters}</g>
    <g class="gsplit r" fill="#ff2a8a">${letters}</g>
    <g class="gmain" fill="${RED}">${letters}</g>
    <g class="gsub" fill="#fff">${sub}</g>
  </g>
</svg>`;
}

const ease = 'cubic-bezier(.2,.9,.25,1)';

export class Intro {
  readonly el: HTMLDivElement;
  private video: HTMLVideoElement;
  private bar: HTMLElement;
  private label: HTMLElement;
  private hint: HTMLElement;
  private skipStage: (() => void) | null = null;
  private ready = false;
  private videoEnded = false;
  private onVideoEnd: (() => void) | null = null;

  constructor(parent: HTMLElement = document.body) {
    const el = document.createElement('div');
    el.id = 'intro';
    el.innerHTML = `
      <div class="i-glow"></div>
      <div class="i-stage i-gueto">${gueto()}<small class="i-apr">APRESENTA</small></div>
      <div class="i-stage i-bsbass"><video muted playsinline preload="auto">
        <source src="./intro/bsbass-logo.webm" type="video/webm"/>
        <source src="./intro/bsbass-logo.mp4" type="video/mp4"/>
      </video></div>
      <div class="i-lines"></div>
      <div class="i-foot"><span class="i-label">CARREGANDO A QUEBRADA</span><div class="i-bar"><i></i></div></div>
      <small class="i-hint">TOQUE PRA PULAR</small>`;
    parent.appendChild(el);
    this.el = el;
    this.video = el.querySelector('video')!;
    this.bar = el.querySelector('.i-bar i')!;
    this.label = el.querySelector('.i-label')!;
    this.hint = el.querySelector('.i-hint')!;
    this.video.addEventListener('ended', () => this.endVideo());
    this.video.addEventListener('error', () => this.endVideo());
    const skip = (e: Event) => {
      if (e instanceof KeyboardEvent && ['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
      this.skipStage?.();
    };
    el.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    this.cleanup = () => window.removeEventListener('keydown', skip);
  }

  private cleanup: () => void;

  setProgress(f: number, label?: string): void {
    this.bar.style.transform = `scaleX(${Math.max(0, Math.min(1, f))})`;
    if (label) this.label.textContent = label;
  }

  /** logo da Gueto (~3,4 s) */
  gueto(): Promise<void> {
    const root = this.el.querySelector<HTMLElement>('.i-gueto')!;
    const q = <T extends Element>(s: string) => [...root.querySelectorAll<T>(s)];
    const anims: Animation[] = [];
    const A = (el: Element, k: Keyframe[], o: KeyframeAnimationOptions) => anims.push(el.animate(k, { fill: 'both', ...o }));
    root.classList.add('on');

    // 1. rastro de luz vermelho desenha a moldura (lanterna passando)
    A(q('.gframe')[0]!, [{ strokeDashoffset: `${FRAME_LEN}px`, opacity: 0.2 }, { strokeDashoffset: '0px', opacity: 1 }], { duration: 950, easing: 'cubic-bezier(.6,0,.3,1)' });
    // 2. letras entram de lado derrapando, uma por uma
    q<SVGPathElement>('.gmain .gl').forEach((p, i) => {
      A(p, [
        { transform: 'translateX(-260px) skewX(-32deg) scaleX(1.5)', opacity: 0, filter: 'blur(10px)' },
        { transform: 'translateX(18px) skewX(8deg) scaleX(0.96)', opacity: 1, filter: 'blur(0px)', offset: 0.72 },
        { transform: 'translateX(0) skewX(0) scaleX(1)', opacity: 1, filter: 'blur(0px)' },
      ], { duration: 520, delay: 520 + i * 105, easing: ease });
    });
    // separação de cor (ciano/rosa) que assenta no impacto
    for (const [cls, dx] of [['.c', -14], ['.r', 14]] as const) {
      A(q(`.gsplit${cls}`)[0]!, [
        { transform: `translateX(${dx * 3}px)`, opacity: 0 },
        { transform: `translateX(${dx * 3}px)`, opacity: 0.85, offset: 0.35 },
        { transform: `translateX(${dx}px)`, opacity: 0.6, offset: 0.7 },
        { transform: 'translateX(0)', opacity: 0 },
      ], { duration: 700, delay: 980, easing: 'ease-out' });
    }
    // 3. impacto: tranco na tela + moldura pulsa
    A(q('.gshake')[0]!, [
      { transform: 'translate(0,0) scale(1)' },
      { transform: 'translate(-7px,4px) scale(1.035)', offset: 0.12 },
      { transform: 'translate(6px,-3px) scale(1.01)', offset: 0.3 },
      { transform: 'translate(-2px,1px) scale(1.004)', offset: 0.55 },
      { transform: 'translate(0,0) scale(1)' },
    ], { duration: 520, delay: 1370, easing: 'ease-out' });
    A(q('.gframe')[0]!, [{ strokeWidth: '28px' }, { strokeWidth: '40px', offset: 0.2 }, { strokeWidth: '28px' }], { duration: 600, delay: 1370 });
    A(this.el.querySelector('.i-glow')!, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0.35 }], { duration: 1600, delay: 1370 });
    // 4. GAME STUDIO acende letra por letra, com tremida de neon
    q('.gs').forEach((t, i) => {
      A(t, [
        { opacity: 0, transform: 'translateY(26px)' },
        { opacity: 1, transform: 'translateY(-3px)', offset: 0.5 },
        { opacity: 0.35, offset: 0.62 },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 460, delay: 1620 + i * 45, easing: ease });
    });
    A(root.querySelector('.i-apr')!, [{ opacity: 0, letterSpacing: '1.4em' }, { opacity: 0.7, letterSpacing: '0.7em' }], { duration: 700, delay: 2250, easing: ease });
    // 5. sai em glitch: fatias deslocadas e some
    const exit = () =>
      root.animate([
        { opacity: 1, transform: 'none', clipPath: 'inset(0 0 0 0)', filter: 'none' },
        { opacity: 1, transform: 'translateX(-18px) skewX(-6deg)', clipPath: 'inset(22% 0 48% 0)', offset: 0.2 },
        { opacity: 0.9, transform: 'translateX(24px)', clipPath: 'inset(60% 0 12% 0)', offset: 0.4 },
        { opacity: 0.8, transform: 'translateX(-8px) scaleY(0.2)', clipPath: 'inset(44% 0 44% 0)', filter: 'brightness(3)', offset: 0.7 },
        { opacity: 0, transform: 'scaleY(0.01) scaleX(1.4)', clipPath: 'inset(49.5% 0 49.5% 0)', filter: 'brightness(4)' },
      ], { duration: 380, easing: 'steps(6, end)', fill: 'forwards' }).finished;

    return new Promise((resolve) => {
      let done = false;
      const finish = async (fast: boolean) => {
        if (done) return;
        done = true;
        this.skipStage = null;
        clearTimeout(timer);
        if (fast) anims.forEach((a) => a.finish());
        await Promise.race([exit().catch(() => undefined), new Promise((r) => setTimeout(r, 600))]);
        root.classList.remove('on');
        resolve();
      };
      const timer = window.setTimeout(() => void finish(false), 3050);
      this.skipStage = () => void finish(true);
    });
  }

  /** começa o vídeo da BSBASS (não espera acabar) */
  startVideo(): void {
    const stage = this.el.querySelector<HTMLElement>('.i-bsbass')!;
    stage.classList.add('on');
    this.el.classList.add('loading');
    const p = this.video.play();
    // sem autoplay (economia de dados, etc.): pula pro final
    if (p) p.catch(() => this.endVideo());
    // rede lenta travando o vídeo: não segura o jogador pra sempre
    window.setTimeout(() => this.endVideo(), 14000);
    this.skipStage = () => {
      if (this.ready) this.endVideo();
    };
  }

  private endVideo(): void {
    if (this.videoEnded) return;
    this.videoEnded = true;
    this.onVideoEnd?.();
  }

  /** o jogo terminou de carregar: libera o pulo */
  setReady(): void {
    this.ready = true;
    this.setProgress(1, 'PRONTO');
    this.hint.classList.add('on');
  }

  videoDone(): Promise<void> {
    return this.videoEnded ? Promise.resolve() : new Promise((r) => (this.onVideoEnd = r));
  }

  /** some com a abertura (o menu já está renderizando por trás) */
  async finish(): Promise<void> {
    this.cleanup();
    this.skipStage = null;
    const fade = this.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => undefined);
    // com a GPU sobrecarregada a animação pode atrasar: não prende a tela
    await Promise.race([fade, new Promise((r) => setTimeout(r, 900))]);
    this.el.remove();
  }
}
