/**
 * Keyboard, gamepad and touch → one button mask per tick, in SCREEN space
 * (Left/Right = screen left/right). Games convert to world space with `toWorld`
 * because the presentation may be mirrored.
 *
 * Presses are latched until sampled, so a tap shorter than a tick is never lost.
 */

import { Btn } from '@ginga/shared';
import { settings } from '../app/storage';

const KEYMAP: Record<string, number> = {
  KeyA: Btn.Left,
  ArrowLeft: Btn.Left,
  KeyD: Btn.Right,
  ArrowRight: Btn.Right,
  Space: Btn.Jump,
  KeyW: Btn.Jump,
  ArrowUp: Btn.Jump,
  KeyJ: Btn.Touch,
  KeyZ: Btn.Touch,
  KeyK: Btn.Attack,
  KeyX: Btn.Attack,
};

export function toWorld(screen: number, flip: boolean): number {
  if (!flip) return screen;
  const l = screen & Btn.Left ? Btn.Right : 0;
  const r = screen & Btn.Right ? Btn.Left : 0;
  return (screen & ~(Btn.Left | Btn.Right)) | l | r;
}

export class Controls {
  private keys = 0;
  private touch = 0;
  private latched = 0;
  private enabled = true;
  readonly pad: TouchPad;

  constructor(root: HTMLElement) {
    addEventListener('keydown', this.onKey);
    addEventListener('keyup', this.onKey);
    addEventListener('blur', () => (this.keys = 0));
    this.pad = new TouchPad(root, (bits) => {
      this.latched |= bits & ~this.touch;
      this.touch = bits;
    });
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.pad.setVisible(on && this.pad.wanted);
    if (!on) this.keys = this.touch = this.latched = 0;
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    const bit = KEYMAP[e.code];
    if (!bit || !this.enabled) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    e.preventDefault();
    if (e.type === 'keydown') {
      if (!(this.keys & bit)) this.latched |= bit;
      this.keys |= bit;
    } else this.keys &= ~bit;
  };

  private gamepad(): number {
    let b = 0;
    const pads = navigator.getGamepads?.() ?? [];
    for (const gp of pads) {
      if (!gp) continue;
      const ax = gp.axes[0] ?? 0;
      if (ax < -0.4 || gp.buttons[14]?.pressed) b |= Btn.Left;
      if (ax > 0.4 || gp.buttons[15]?.pressed) b |= Btn.Right;
      if (gp.buttons[0]?.pressed || gp.buttons[12]?.pressed) b |= Btn.Jump;
      if (gp.buttons[2]?.pressed) b |= Btn.Touch;
      if (gp.buttons[1]?.pressed || gp.buttons[3]?.pressed) b |= Btn.Attack;
    }
    return b;
  }

  private padPrev = 0;

  /** Buttons for one tick (screen space). */
  sample(): number {
    if (!this.enabled) return 0;
    const gp = this.gamepad();
    this.latched |= gp & ~this.padPrev;
    this.padPrev = gp;
    const b = this.keys | this.touch | gp | this.latched;
    this.latched = 0;
    return b;
  }
}

/** On-screen controls: ◀ ▶ on the left, Pular / Toque / Ataque on the right. */
export class TouchPad {
  readonly el: HTMLElement;
  wanted = matchMedia('(pointer: coarse)').matches;
  private readonly held = new Map<number, number>();

  constructor(root: HTMLElement, private readonly onChange: (bits: number) => void) {
    this.el = document.createElement('div');
    this.el.className = 'touchpad';
    this.el.innerHTML = `
      <div class="tp-side tp-move">
        <button data-bit="${Btn.Left}" aria-label="Esquerda">◀</button>
        <button data-bit="${Btn.Right}" aria-label="Direita">▶</button>
      </div>
      <div class="tp-side tp-act">
        <button class="tp-attack" data-bit="${Btn.Attack}">Ataque</button>
        <button class="tp-touch" data-bit="${Btn.Touch}">Toque</button>
        <button class="tp-jump" data-bit="${Btn.Jump}">Pular</button>
      </div>`;
    root.appendChild(this.el);
    this.el.addEventListener('pointerdown', this.down);
    this.el.addEventListener('pointermove', this.move);
    this.el.addEventListener('pointerup', this.up);
    this.el.addEventListener('pointercancel', this.up);
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('touchstart', () => {
      if (!this.wanted) {
        this.wanted = true;
        this.setVisible(true);
      }
    }, { passive: true, once: true });
    this.applySettings();
    this.setVisible(false);
  }

  applySettings(): void {
    this.el.style.setProperty('--tp-scale', String(settings.touchScale));
    this.el.style.setProperty('--tp-opacity', String(settings.touchOpacity));
    this.el.classList.toggle('left-handed', settings.leftHanded);
  }

  setVisible(on: boolean): void {
    this.el.hidden = !on;
  }

  private bitAt(x: number, y: number): number {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const btn = el?.closest<HTMLElement>('[data-bit]');
    return btn && this.el.contains(btn) ? Number(btn.dataset.bit) : 0;
  }

  private emit(): void {
    let bits = 0;
    for (const b of this.held.values()) bits |= b;
    for (const btn of this.el.querySelectorAll<HTMLElement>('[data-bit]')) btn.classList.toggle('on', (bits & Number(btn.dataset.bit)) !== 0);
    this.onChange(bits);
    if (bits && navigator.vibrate) navigator.vibrate(8);
  }

  private readonly down = (e: PointerEvent): void => {
    e.preventDefault();
    this.el.setPointerCapture?.(e.pointerId);
    this.held.set(e.pointerId, this.bitAt(e.clientX, e.clientY));
    this.emit();
  };

  private readonly move = (e: PointerEvent): void => {
    if (!this.held.has(e.pointerId)) return;
    // slide between ◀ and ▶ without lifting the thumb
    const prev = this.held.get(e.pointerId)!;
    const now = this.bitAt(e.clientX, e.clientY);
    if ((prev & (Btn.Left | Btn.Right)) && now !== prev && now & (Btn.Left | Btn.Right)) {
      this.held.set(e.pointerId, now);
      this.emit();
    }
  };

  private readonly up = (e: PointerEvent): void => {
    this.held.delete(e.pointerId);
    this.emit();
  };
}
