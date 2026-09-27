import { Vector2 } from 'three';

/**
 * Floating joystick: the first finger (or mouse button) anywhere on the play surface
 * sets an anchor; dragging away steers. The anchor follows when you drag past the
 * radius so direction changes stay instant. A quick flick triggers a dash.
 */
export class TouchInput {
  readonly vector = new Vector2();
  active = false;
  radius = 64;
  onSwipe: (() => void) | null = null;
  private pointerId: number | null = null;
  private readonly anchor = new Vector2();
  private readonly current = new Vector2();
  private readonly ring: HTMLElement;
  private readonly knob: HTMLElement;
  private downTime = 0;
  private lastPositions: Array<{ x: number; y: number; t: number }> = [];

  constructor(
    private readonly surface: HTMLElement,
    ui: HTMLElement,
  ) {
    this.ring = ui;
    this.knob = ui.querySelector('.joy-knob') as HTMLElement;
    surface.addEventListener('pointerdown', this.onDown, { passive: false });
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    surface.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setRadius(px: number): void {
    this.radius = px;
  }

  private readonly onDown = (e: PointerEvent): void => {
    if (this.pointerId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.anchor.set(e.clientX, e.clientY);
    this.current.copy(this.anchor);
    this.active = true;
    this.downTime = performance.now();
    this.lastPositions = [{ x: e.clientX, y: e.clientY, t: this.downTime }];
    this.updateVector();
    this.ring.classList.add('visible');
    this.ring.style.transform = `translate(${this.anchor.x}px, ${this.anchor.y}px)`;
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.current.set(e.clientX, e.clientY);
    const now = performance.now();
    this.lastPositions.push({ x: e.clientX, y: e.clientY, t: now });
    if (this.lastPositions.length > 6) this.lastPositions.shift();
    // drag the anchor along when past the radius
    const dx = this.current.x - this.anchor.x;
    const dy = this.current.y - this.anchor.y;
    const len = Math.hypot(dx, dy);
    const max = this.radius * 1.15;
    if (len > max) {
      this.anchor.x = this.current.x - (dx / len) * max;
      this.anchor.y = this.current.y - (dy / len) * max;
      this.ring.style.transform = `translate(${this.anchor.x}px, ${this.anchor.y}px)`;
    }
    this.detectFlick(now);
    this.updateVector();
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.cancel();
  };

  private detectFlick(now: number): void {
    const first = this.lastPositions[0];
    const last = this.lastPositions[this.lastPositions.length - 1];
    if (!first || !last) return;
    const dt = last.t - first.t;
    if (dt <= 0 || dt > 120) return;
    const dist = Math.hypot(last.x - first.x, last.y - first.y);
    const speed = dist / dt; // px per ms
    if (speed > 2.4 && dist > this.radius * 1.6 && now - this.downTime > 60) {
      this.onSwipe?.();
      this.lastPositions = [last];
    }
  }

  cancel(): void {
    this.pointerId = null;
    this.active = false;
    this.vector.set(0, 0);
    this.ring.classList.remove('visible');
    this.knob.style.transform = 'translate(-50%, -50%)';
  }

  private updateVector(): void {
    const dx = this.current.x - this.anchor.x;
    const dy = this.current.y - this.anchor.y;
    let x = dx / this.radius;
    let y = -dy / this.radius;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    const mag = Math.min(1, len);
    // dead zone + soft response curve
    const dead = 0.08;
    const shaped = mag < dead ? 0 : Math.pow((mag - dead) / (1 - dead), 1.15);
    const scale = len > 0 ? shaped / Math.min(1, len) : 0;
    this.vector.set(x * scale, y * scale);
    const kx = Math.max(-1, Math.min(1, dx / this.radius)) * this.radius * 0.55;
    const ky = Math.max(-1, Math.min(1, dy / this.radius)) * this.radius * 0.55;
    this.knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
  }

  get surfaceElement(): HTMLElement {
    return this.surface;
  }
}
