import { Vector2 } from 'three';
import { KeyboardInput } from './KeyboardInput';
import { TouchInput } from './TouchInput';

/**
 * Merges touch (floating joystick), mouse drag and keyboard into one move vector
 * in screen space (x = right, y = up), magnitude 0..1.
 */
export class InputManager {
  readonly move = new Vector2();
  readonly touch: TouchInput;
  readonly keyboard: KeyboardInput;
  /** One-shot actions consumed by the game each frame. */
  private actions = new Set<'emp' | 'dash' | 'pause' | 'extract'>();
  enabled = true;
  isTouchDevice: boolean;
  lastMoveTime = 0;

  constructor(surface: HTMLElement, joystickUi: HTMLElement) {
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.touch = new TouchInput(surface, joystickUi);
    this.keyboard = new KeyboardInput((a) => this.trigger(a));
    this.touch.onSwipe = () => this.trigger('dash');
  }

  trigger(action: 'emp' | 'dash' | 'pause' | 'extract'): void {
    if (!this.enabled && action !== 'pause') return;
    this.actions.add(action);
  }

  consume(action: 'emp' | 'dash' | 'pause' | 'extract'): boolean {
    if (this.actions.has(action)) {
      this.actions.delete(action);
      return true;
    }
    return false;
  }

  update(now: number): void {
    this.move.set(0, 0);
    if (!this.enabled) {
      this.touch.cancel();
      this.actions.clear();
      return;
    }
    const k = this.keyboard.vector;
    if (k.lengthSq() > 0) this.move.copy(k);
    const t = this.touch.vector;
    if (t.lengthSq() > this.move.lengthSq()) this.move.copy(t);
    if (this.move.lengthSq() > 1) this.move.normalize();
    if (this.move.lengthSq() > 0.001) this.lastMoveTime = now;
  }

  get isActive(): boolean {
    return this.touch.active || this.keyboard.vector.lengthSq() > 0;
  }
}
