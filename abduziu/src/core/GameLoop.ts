/** requestAnimationFrame driver. Stops when the tab is hidden and resumes cleanly. */
export class GameLoop {
  private running = false;
  private rafId = 0;
  private last = 0;

  constructor(private readonly onFrame: (dtSeconds: number, nowMs: number) => void) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseInternal();
      } else if (this.running) {
        this.last = performance.now();
        this.schedule();
      }
    });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.schedule();
  }

  stop(): void {
    this.running = false;
    this.pauseInternal();
  }

  private pauseInternal(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private schedule(): void {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    this.rafId = 0;
    if (!this.running) return;
    const dt = (now - this.last) / 1000;
    this.last = now;
    this.onFrame(dt, now);
    this.schedule();
  };
}
