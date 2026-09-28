/**
 * Ball physics on Rapier (deterministic build), locked to the X/Y plane.
 *
 * Only the ball and the static court live here: players never collide with the ball
 * (contacts are game queries, see sim.ts). The whole physical state is the ball's
 * position and velocity, so restoring a snapshot into any world reproduces the same
 * trajectory (verified in B0: identical traces after restore into a fresh world).
 */

import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { BALL, COURT, DT } from './params';

let ready: Promise<void> | null = null;

/** Must resolve before creating any BallPhysics (loads the WASM). */
export function initPhysics(): Promise<void> {
  ready ??= RAPIER.init();
  return ready;
}

export class BallPhysics {
  private readonly world: RAPIER.World;
  private readonly body: RAPIER.RigidBody;

  constructor() {
    const w = new RAPIER.World({ x: 0, y: -BALL.gravity, z: 0 });
    w.timestep = DT;
    // sand
    w.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 5).setTranslation(0, -0.5, 0).setRestitution(BALL.restitutionGround).setFriction(0.6));
    // net: solid panel from the sand to the top, rounded tape on top
    const h = COURT.netTop / 2;
    w.createCollider(RAPIER.ColliderDesc.cuboid(COURT.netHalf, h, 5).setTranslation(0, h, 0).setRestitution(BALL.restitutionNet));
    w.createCollider(
      RAPIER.ColliderDesc.capsule(4.9, COURT.netHalf)
        .setTranslation(0, COURT.netTop, 0)
        .setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 })
        .setRestitution(BALL.restitutionNet),
    );
    const body = w.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, 1, 0)
        .setCcdEnabled(true)
        .enabledTranslations(true, true, false)
        .lockRotations() // spin is presentation-only; the state has no angular velocity
        .setLinearDamping(BALL.damping),
    );
    w.createCollider(RAPIER.ColliderDesc.ball(BALL.radius).setRestitution(BALL.restitutionGround).setDensity(1), body);
    this.world = w;
    this.body = body;
  }

  set(x: number, y: number, vx: number, vy: number): void {
    this.body.setTranslation({ x, y, z: 0 }, true);
    this.body.setLinvel({ x: vx, y: vy, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  /** Advances one tick and returns the new state (speed clamped to BALL.maxSpeed). */
  step(): { x: number; y: number; vx: number; vy: number } {
    this.world.step();
    const t = this.body.translation();
    const v = this.body.linvel();
    let vx = v.x;
    let vy = v.y;
    const sp = Math.sqrt(vx * vx + vy * vy);
    if (sp > BALL.maxSpeed) {
      const k = BALL.maxSpeed / sp;
      vx *= k;
      vy *= k;
      this.body.setLinvel({ x: vx, y: vy, z: 0 }, true);
    }
    return { x: t.x, y: t.y, vx, vy };
  }

  free(): void {
    this.world.free();
  }
}
