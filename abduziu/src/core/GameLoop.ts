/**
 * requestAnimationFrame driver. Stops when the tab is hidden and resumes cleanly.
 * A frame that throws never stops the loop: the error is reported (once per message) and the
 * next frame is scheduled anyway, so one bad frame can't freeze the game.
 */
export class GameLoop {
  private running = false;
  private rafId = 0;
  private last = 0;
  private readonly reported = new Set<string>();
  /** Errors caught in frames so far (debug / telemetry). */
  errors = 0;
  /** Called once per distinct error message. */
  onError: ((err: unknown) => void) | null = null;

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
    // schedule first: whatever happens in this frame, there is a next one
    this.schedule();
    try {
      this.onFrame(dt, now);
    } catch (err) {
      this.errors++;
      const key = err instanceof Error ? err.message : String(err);
      if (!this.reported.has(key)) {
        this.reported.add(key);
        console.error('[loop] frame error (game keeps running):', err);
        this.onError?.(err);
      }
    }
  };
}
