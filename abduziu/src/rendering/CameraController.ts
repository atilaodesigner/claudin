import { PerspectiveCamera, Vector3 } from 'three';
import { clamp, damp } from '../utils/math';
import { noise1 } from '../utils/noise';

/**
 * Tilted diorama camera: follow + look-ahead + lag, zoom by UFO size and speed,
 * dynamic FOV, trauma-based shake, punch impulses and dramatic zooms.
 */
export class CameraController {
  readonly camera: PerspectiveCamera;
  /** World point the camera looks at (smoothed). */
  readonly focus = new Vector3();
  private readonly desiredFocus = new Vector3();
  private readonly lookAhead = new Vector3();
  distance = 18;
  private distanceTarget = 18;
  private fovTarget = 50;
  pitch = 0.94;
  private trauma = 0;
  private punch = 0;
  private time = 0;
  shakeScale = 1;
  /** Extra zoom multipliers for cinematic beats. */
  private dramaZoom = 1;
  private dramaTimer = 0;
  private aspect = 16 / 9;
  /** When set, the camera is driven by a script (intro/extraction). */
  override: ((cam: PerspectiveCamera, dt: number) => void) | null = null;

  constructor() {
    this.camera = new PerspectiveCamera(50, 16 / 9, 0.5, 2200);
    this.camera.position.set(0, 30, 30);
  }

  resize(w: number, h: number): void {
    this.aspect = w / h;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount * this.shakeScale);
  }

  impulse(amount: number): void {
    this.punch = Math.min(1.2, this.punch + amount * Math.max(0.3, this.shakeScale));
  }

  /** Short dramatic zoom (negative = push in, positive = pull out). */
  dramatic(mult: number, seconds: number): void {
    this.dramaZoom = mult;
    this.dramaTimer = seconds;
  }

  /** Moves the rig by an offset without any easing (wrapping arena crossed its seam). */
  shift(dx: number, dz: number): void {
    this.focus.x += dx;
    this.focus.z += dz;
    this.desiredFocus.x += dx;
    this.desiredFocus.z += dz;
    this.camera.position.x += dx;
    this.camera.position.z += dz;
  }

  snapTo(target: Vector3, ufoScale: number): void {
    this.focus.set(target.x, target.y * 0.58, target.z);
    this.desiredFocus.copy(this.focus);
    this.distance = this.distanceFor(ufoScale, 0);
    this.distanceTarget = this.distance;
    this.place(0);
  }

  private distanceFor(ufoScale: number, speedFactor: number): number {
    let d = 21 * Math.pow(ufoScale, 0.92) * (1 + speedFactor * 0.14);
    // portrait / narrow screens need more distance to show the same width
    if (this.aspect < 1.25) d *= 1 + (1.25 - this.aspect) * 0.75;
    return d;
  }

  update(realDt: number, target: Vector3, velocity: Vector3, ufoScale: number, maxSpeed: number, extraZoom: number, fovBoost: number): void {
    this.time += realDt;
    if (this.override) {
      this.override(this.camera, realDt);
      return;
    }
    const speed = Math.hypot(velocity.x, velocity.z);
    const speedFactor = clamp(speed / Math.max(1, maxSpeed), 0, 1.4);

    this.lookAhead.set(velocity.x, 0, velocity.z).multiplyScalar(0.32);
    const maxAhead = 6 * ufoScale;
    if (this.lookAhead.length() > maxAhead) this.lookAhead.setLength(maxAhead);
    this.desiredFocus.set(target.x + this.lookAhead.x, target.y * 0.58, target.z + this.lookAhead.z);
    this.focus.x = damp(this.focus.x, this.desiredFocus.x, 4.2, realDt);
    this.focus.z = damp(this.focus.z, this.desiredFocus.z, 4.2, realDt);
    this.focus.y = damp(this.focus.y, this.desiredFocus.y, 3, realDt);

    if (this.dramaTimer > 0) {
      this.dramaTimer -= realDt;
      if (this.dramaTimer <= 0) this.dramaZoom = 1;
    }
    this.distanceTarget = this.distanceFor(ufoScale, speedFactor) * extraZoom * this.dramaZoom;
    // a giant saucer over a skyline needs a more top-down view so towers don't hide it
    const pitchTarget = 0.94 + Math.min(0.32, Math.max(0, ufoScale - 1) * 0.075);
    this.pitch = damp(this.pitch, pitchTarget, 1.5, realDt);
    // pull out faster than push in: growth must be felt immediately
    this.distance = damp(this.distance, this.distanceTarget, this.distanceTarget > this.distance ? 2.2 : 1.4, realDt);

    this.fovTarget = 50 + speedFactor * 5 + fovBoost;
    this.camera.fov = damp(this.camera.fov, this.fovTarget, 4, realDt);
    this.camera.updateProjectionMatrix();

    this.trauma = Math.max(0, this.trauma - realDt * 1.4);
    this.punch = Math.max(0, this.punch - realDt * 3.5);
    this.place(realDt);
  }

  private place(_dt: number): void {
    const d = this.distance * (1 - this.punch * 0.08);
    const cam = this.camera;
    cam.position.set(this.focus.x, this.focus.y + Math.sin(this.pitch) * d, this.focus.z + Math.cos(this.pitch) * d);
    cam.lookAt(this.focus.x, this.focus.y, this.focus.z);
    const shake = this.trauma * this.trauma;
    if (shake > 0.0001) {
      const amp = shake * (0.6 + d * 0.02);
      cam.position.x += noise1(this.time * 22) * amp;
      cam.position.y += noise1(this.time * 22 + 40) * amp * 0.7;
      cam.position.z += noise1(this.time * 22 + 80) * amp * 0.5;
      cam.rotation.z += noise1(this.time * 18 + 120) * shake * 0.05;
    }
    cam.near = Math.max(0.3, d * 0.03);
    cam.far = 2200;
    cam.updateProjectionMatrix();
  }
}
