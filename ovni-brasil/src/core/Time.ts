import { clamp, damp } from '../utils/math';

/**
 * Game clock. Separates real time (UI, audio) from game time (world simulation) and
 * implements slow motion and hit-stop without interrupting the flow.
 */
export class Time {
  /** Unscaled delta (seconds), clamped to avoid spiral of death after tab switches. */
  realDelta = 0;
  /** Scaled simulation delta. */
  delta = 0;
  /** Total simulated run time (affected by time scale). */
  elapsed = 0;
  realElapsed = 0;
  scale = 1;
  paused = false;

  private slowTarget = 1;
  private slowTimer = 0;
  private hitStopTimer = 0;
  private reduceMotion = false;

  setReduceMotion(v: boolean): void {
    this.reduceMotion = v;
  }

  tick(rawDeltaSeconds: number): void {
    this.realDelta = clamp(rawDeltaSeconds, 0, 1 / 15);
    this.realElapsed += this.realDelta;

    if (this.slowTimer > 0) {
      this.slowTimer -= this.realDelta;
      if (this.slowTimer <= 0) this.slowTarget = 1;
    }
    // ease in/out of slow-mo so it never feels like a hard cut
    this.scale = damp(this.scale, this.slowTarget, this.slowTarget < this.scale ? 30 : 7, this.realDelta);

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= this.realDelta;
      this.delta = this.realDelta * 0.04;
    } else {
      this.delta = this.paused ? 0 : this.realDelta * this.scale;
    }
    if (this.paused) this.delta = 0;
    this.elapsed += this.delta;
  }

  /** Slow motion: scale 0.2..0.6 for 0.4..0.8s real time (design rule: never interrupt flow). */
  slowMo(scale: number, durationSeconds: number): void {
    if (this.reduceMotion) scale = Math.max(scale, 0.6);
    if (this.slowTimer > 0 && scale > this.slowTarget) return;
    this.slowTarget = scale;
    this.slowTimer = Math.min(durationSeconds, 0.9);
  }

  hitStop(durationSeconds: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, Math.min(durationSeconds, 0.12));
  }

  resetRun(): void {
    this.elapsed = 0;
    this.scale = 1;
    this.slowTarget = 1;
    this.slowTimer = 0;
    this.hitStopTimer = 0;
    this.paused = false;
  }
}
