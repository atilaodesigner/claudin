/** Moderate haptic feedback via navigator.vibrate (Android). Never continuous. */
export class Haptics {
  enabled = true;
  private last = 0;
  private readonly supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  private vibrate(pattern: number | number[], minGap: number): void {
    if (!this.enabled || !this.supported) return;
    const now = performance.now();
    if (now - this.last < minGap) return;
    this.last = now;
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }

  light(): void {
    this.vibrate(8, 90);
  }

  medium(): void {
    this.vibrate(22, 150);
  }

  strong(): void {
    this.vibrate([40, 30, 60], 300);
  }
}
