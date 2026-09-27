import { BALANCE } from '../config/gameBalance';

const T = BALANCE.threat;
export const MAX_ALERT = T.alertThresholds.length - 1;

export function alertFromThreat(threat: number): number {
  let alert = 0;
  for (let i = 0; i < T.alertThresholds.length; i++) {
    if (threat >= (T.alertThresholds[i] as number)) alert = i;
  }
  return alert;
}

/**
 * Threat accumulates with destruction and slowly with time. The alert level never
 * drops during a run: the city only gets angrier.
 */
export class ThreatSystem {
  threat = 0;
  alert = 0;
  timeAtMaxAlert = 0;
  timeReachedMax: number | null = null;
  /** Debug/tests: freezes passive growth. */
  passive = true;

  reset(): void {
    this.threat = 0;
    this.alert = 0;
    this.timeAtMaxAlert = 0;
    this.timeReachedMax = null;
  }

  /** Returns the new alert level if it changed, otherwise null. */
  add(amount: number, runTime = 0): number | null {
    if (amount <= 0) return null;
    this.threat += amount;
    return this.refresh(runTime);
  }

  update(dt: number, runTime: number): number | null {
    if (this.alert >= MAX_ALERT) this.timeAtMaxAlert += dt;
    if (!this.passive) return null;
    this.threat += T.perSecond * dt;
    return this.refresh(runTime);
  }

  private refresh(runTime: number): number | null {
    const next = alertFromThreat(this.threat);
    if (next > this.alert) {
      this.alert = next;
      if (next >= MAX_ALERT && this.timeReachedMax === null) this.timeReachedMax = runTime;
      return next;
    }
    return null;
  }

  /** 0..1 progress toward the next alert level. */
  get progress(): number {
    if (this.alert >= MAX_ALERT) return 1;
    const lo = T.alertThresholds[this.alert] as number;
    const hi = T.alertThresholds[this.alert + 1] as number;
    return Math.min(1, (this.threat - lo) / (hi - lo));
  }

  setAlert(level: number, runTime = 0): number | null {
    const clamped = Math.max(0, Math.min(MAX_ALERT, level));
    this.threat = Math.max(this.threat, T.alertThresholds[clamped] as number);
    return this.refresh(runTime);
  }
}
