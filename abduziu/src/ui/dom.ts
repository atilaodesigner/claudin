/** Tiny DOM helpers (no framework: fast to load, zero dependencies). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

export function append<T extends HTMLElement>(parent: HTMLElement, child: T): T {
  parent.appendChild(child);
  return child;
}

/** Sets text only when it changed (avoids layout thrash every frame). */
export function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

export function setFill(bar: HTMLElement, frac: number): void {
  const fill = bar.firstElementChild as HTMLElement | null;
  if (!fill) return;
  const v = `scaleX(${Math.max(0, Math.min(1, frac)).toFixed(3)})`;
  if (fill.style.transform !== v) fill.style.transform = v;
}

export function bar(cls = ''): HTMLDivElement {
  const b = h('div', `bar ${cls}`);
  b.appendChild(h('div', 'fill'));
  return b;
}

export function toggleClass(el: HTMLElement, cls: string, on: boolean): void {
  if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on);
}

export function onTap(el: HTMLElement, fn: (e: Event) => void): void {
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    fn(e);
  });
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
}

export class Screen {
  readonly root: HTMLDivElement;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(parent: HTMLElement, cls: string) {
    this.root = h('div', `screen hidden ${cls}`);
    parent.appendChild(this.root);
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden');
  }

  show(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
    this.root.classList.remove('hidden');
    requestAnimationFrame(() => this.root.classList.add('visible'));
  }

  hide(): void {
    this.root.classList.remove('visible');
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.root.classList.add('hidden'), 260);
  }

  hideNow(): void {
    this.root.classList.remove('visible');
    this.root.classList.add('hidden');
  }
}
