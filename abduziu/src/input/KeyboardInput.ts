import { Vector2 } from 'three';

type Action = 'emp' | 'dash' | 'pause' | 'extract';

/** WASD / arrows to fly, Space = EMP, Shift = dash, E = extract, Esc/P = pause. */
export class KeyboardInput {
  readonly vector = new Vector2();
  private readonly down = new Set<string>();

  constructor(private readonly onAction: (a: Action) => void) {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const code = e.code;
      if (!this.down.has(code)) {
        if (code === 'Space') this.onAction('emp');
        else if (code === 'ShiftLeft' || code === 'ShiftRight') this.onAction('dash');
        else if (code === 'Escape' || code === 'KeyP') this.onAction('pause');
        else if (code === 'KeyE') this.onAction('extract');
      }
      this.down.add(code);
      if (code.startsWith('Arrow') || code === 'Space') e.preventDefault();
      this.refresh();
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.refresh();
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.refresh();
    });
  }

  private refresh(): void {
    const d = this.down;
    const x = (d.has('KeyD') || d.has('ArrowRight') ? 1 : 0) - (d.has('KeyA') || d.has('ArrowLeft') ? 1 : 0);
    const y = (d.has('KeyW') || d.has('ArrowUp') ? 1 : 0) - (d.has('KeyS') || d.has('ArrowDown') ? 1 : 0);
    this.vector.set(x, y);
    if (x !== 0 && y !== 0) this.vector.normalize();
  }
}
