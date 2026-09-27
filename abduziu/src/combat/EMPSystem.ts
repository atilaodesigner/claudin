import { BALANCE } from '../config/gameBalance';

/** EMP ability: short charge, big blast, visible cooldown. Also drives the auto-EMP upgrade. */
export class EMPSystem {
  cooldown = 0;
  maxCooldown: number = BALANCE.player.empCooldown;
  charging = 0;
  private autoTimer = 0;
  /** Set when a blast should happen this frame: radius multiplier. */
  pendingBlast = 0;

  reset(): void {
    this.cooldown = 0;
    this.charging = 0;
    this.autoTimer = 0;
    this.pendingBlast = 0;
  }

  get ready(): boolean {
    return this.cooldown <= 0 && this.charging <= 0;
  }

  get fraction(): number {
    return this.maxCooldown > 0 ? 1 - Math.max(0, this.cooldown) / this.maxCooldown : 1;
  }

  trigger(maxCooldown: number): boolean {
    if (!this.ready) return false;
    this.maxCooldown = maxCooldown;
    this.charging = BALANCE.player.empChargeTime;
    return true;
  }

  update(dt: number, autoPeriod: number): void {
    this.pendingBlast = 0;
    if (this.charging > 0) {
      this.charging -= dt;
      if (this.charging <= 0) {
        this.pendingBlast = 1;
        this.cooldown = this.maxCooldown;
      }
    } else if (this.cooldown > 0) {
      this.cooldown -= dt;
    }
    if (autoPeriod > 0) {
      this.autoTimer += dt;
      if (this.autoTimer >= autoPeriod) {
        this.autoTimer = 0;
        if (this.pendingBlast === 0) this.pendingBlast = 0.7;
      }
    }
  }

  /** Free blast (synergy TEMPESTADE MAGNÉTICA). */
  forceBlast(mult: number): void {
    this.pendingBlast = Math.max(this.pendingBlast, mult);
  }
}
