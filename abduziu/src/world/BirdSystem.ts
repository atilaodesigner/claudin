import { BufferAttribute, BufferGeometry, Color, DoubleSide, InstancedMesh, Matrix4, MeshLambertMaterial, Quaternion, Vector3, type Scene } from 'three';
import type { World } from './World';

interface Bird {
  home: Vector3;
  pos: Vector3;
  vel: Vector3;
  state: 0 | 1 | 2; // 0 idle, 1 flying away, 2 gone (waiting to respawn)
  timer: number;
  delay: number;
  phase: number;
  heading: number;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _e = new Vector3(0, 1, 0);

/** Pigeons pecking on sidewalks and squares; they burst into the sky when the saucer shows up. */
export class BirdSystem {
  private readonly mesh: InstancedMesh;
  private readonly birds: Bird[] = [];
  private time = 0;
  onFlee: ((x: number, z: number) => void) | null = null;

  constructor(scene: Scene, world: World, count = 72) {
    const g = new BufferGeometry();
    // tiny body + two wing triangles (flapping is faked with scale)
    const v = [
      0, 0.1, 0.22, -0.07, 0.05, -0.18, 0.07, 0.05, -0.18,
      0, 0.12, 0.05, -0.34, 0.14, -0.05, 0, 0.12, -0.12,
      0, 0.12, 0.05, 0, 0.12, -0.12, 0.34, 0.14, -0.05,
    ];
    g.setAttribute('position', new BufferAttribute(new Float32Array(v), 3));
    g.computeVertexNormals();
    this.mesh = new InstancedMesh(g, new MeshLambertMaterial({ color: 0x8f96a3, side: DoubleSide }), count);
    this.mesh.frustumCulled = false;
    const tints = [0x8f96a3, 0x6f7784, 0xb8bec8, 0x5a5f69];
    // flocks near squares, bars and sidewalks
    const anchors: Vector3[] = [];
    for (const b of world.blocks) {
      if (b.district === 'P' || b.district === 'C' || b.district === 'R' || b.district === 'S') anchors.push(new Vector3(b.cx + (Math.random() - 0.5) * 30, 0, b.cz + (Math.random() - 0.5) * 30));
    }
    for (let i = 0; i < count; i++) {
      const a = anchors[Math.floor(i / 6) % Math.max(1, anchors.length)] ?? new Vector3();
      const home = new Vector3(a.x + (Math.random() - 0.5) * 5, 0, a.z + (Math.random() - 0.5) * 5);
      home.y = world.groundAt(home.x, home.z);
      this.birds.push({ home, pos: home.clone(), vel: new Vector3(), state: 0, timer: 0, delay: 0, phase: Math.random() * 10, heading: Math.random() * 6.28 });
      this.mesh.setColorAt(i, new Color(tints[i % tints.length]));
    }
    scene.add(this.mesh);
  }

  update(dt: number, ufo: Vector3, ufoRadius: number): void {
    this.time += dt;
    const scare = 16 + ufoRadius * 4;
    let fled = false;
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i] as Bird;
      let flap = 1;
      if (b.state === 0) {
        const d = Math.hypot(b.pos.x - ufo.x, b.pos.z - ufo.z);
        if (d < scare) {
          b.state = 1;
          b.delay = Math.random() * 0.35;
          const away = Math.atan2(b.pos.x - ufo.x, b.pos.z - ufo.z) + (Math.random() - 0.5) * 1.2;
          b.vel.set(Math.sin(away) * (6 + Math.random() * 4), 5 + Math.random() * 4, Math.cos(away) * (6 + Math.random() * 4));
          b.heading = away;
          fled = true;
        } else {
          // pecking
          b.pos.y = b.home.y + Math.max(0, Math.sin(this.time * 6 + b.phase)) * 0.04;
          if (Math.random() < dt * 0.3) b.heading += (Math.random() - 0.5) * 1.5;
          flap = 0.25;
        }
      } else if (b.state === 1) {
        if (b.delay > 0) b.delay -= dt;
        else {
          b.pos.addScaledVector(b.vel, dt);
          b.vel.y += dt * 2;
          flap = Math.abs(Math.sin(this.time * 26 + b.phase)) * 1.4 + 0.1;
          if (b.pos.y > 60) {
            b.state = 2;
            b.timer = 18 + Math.random() * 20;
          }
        }
      } else {
        b.timer -= dt;
        if (b.timer <= 0 && Math.hypot(b.home.x - ufo.x, b.home.z - ufo.z) > scare * 1.5) {
          b.state = 0;
          b.pos.copy(b.home);
        }
      }
      _q.setFromAxisAngle(_e, b.heading);
      _s.set(1, b.state === 2 ? 0 : flap, 1).multiplyScalar(b.state === 2 ? 0.0001 : 1.3);
      _m.compose(b.pos, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (fled) this.onFlee?.(ufo.x, ufo.z);
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshLambertMaterial).dispose();
    this.mesh.dispose();
  }
}
