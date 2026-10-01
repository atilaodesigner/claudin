/**
 * The 2.5D arena (Three.js, WebGL2): the code-built graybox of "Orla do Posto 7½",
 * procedural avatars, ball + blob shadow, contact FX and the side camera.
 *
 * Presentation only: it reads a View (world coordinates) and never feeds the
 * simulation. When `view.flip` is set the dynamic entities are mirrored (x → -x) so
 * the local team is always on the left; the court is symmetric, the decor isn't flipped.
 */

import * as THREE from 'three';
import { BALL, COURT, TIMING, type SimEvent, type Team } from '@ginga/shared';
import { settings } from '../app/storage';
import type { View, ViewPlayer } from '../game/types';

export const TEAM_COLOR: Record<Team, number> = { 0: 0x2d7ff9, 1: 0xff5a36 };
export const TEAM_SYMBOL: Record<Team, string> = { 0: '▲', 1: '●' };
const SAND = 0xf2d29b;
const COURT_Z = 3.2; // visual half depth of the court
const BALL_R = BALL.radius * 1.7; // drawn bigger than the physics ball: it must read at a glance

function toonRamp(): THREE.Texture {
  const data = new Uint8Array([90, 170, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
const RAMP = toonRamp();
const toon = (color: number) => new THREE.MeshToonMaterial({ color, gradientMap: RAMP });
const flat = (color: number) => new THREE.MeshBasicMaterial({ color });

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Inverted-hull outline: a back-face, slightly bigger copy in dark ink. */
function outline(mesh: THREE.Mesh, thickness = 0.035): THREE.Mesh {
  const o = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: 0x14163a, side: THREE.BackSide }));
  o.scale.setScalar(1 + thickness);
  mesh.add(o);
  return o;
}

// ── avatar ───────────────────────────────────────────────────────────────────

const LOOKS = [
  { skin: 0x6b3f2a, hair: 0x1a1110, shorts: 0x1b5f8f, tall: 1.0, braids: true }, // Duda "Maré"
  { skin: 0xb07a52, hair: 0xf3e6c2, shorts: 0xd9481f, tall: 0.92, braids: false }, // Juninho "Brasa"
];

class Avatar {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly torso: THREE.Mesh;
  private readonly head: THREE.Mesh;
  private readonly legF = new THREE.Group();
  private readonly legB = new THREE.Group();
  private readonly shadow: THREE.Mesh;
  private readonly tag: THREE.Sprite;
  private run = 0;
  private squash = 0;
  private wasGrounded = true;

  constructor(readonly slot: number, team: Team, look: (typeof LOOKS)[number], label: string) {
    const kit = TEAM_COLOR[team];
    const k = look.tall;
    this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24 * k, 0.55 * k, 6, 12), toon(kit));
    this.torso.position.y = 1.18 * k;
    outline(this.torso);
    const skin = toon(look.skin);
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.19 * k, 16, 12), skin);
    this.head.position.y = 1.72 * k;
    outline(this.head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2 * k, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.1), toon(look.hair));
    hair.position.y = 0.03;
    this.head.add(hair);
    if (look.braids) {
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.45, 4, 8), toon(look.hair));
      tail.position.set(-0.17, -0.12, 0);
      tail.rotation.z = -0.5;
      this.head.add(tail);
    }
    // eyes: tell which way the player faces (toward the net)
    const eye = flat(0x10122b);
    for (const z of [-0.07, 0.07]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), eye);
      e.position.set(0.16 * k, 0.03, z);
      this.head.add(e);
    }
    for (const [leg, z] of [
      [this.legF, 0.1],
      [this.legB, -0.1],
    ] as const) {
      leg.position.set(0, 0.86 * k, z);
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.085 * k, 0.62 * k, 4, 8), skin);
      thigh.position.y = -0.42 * k;
      outline(thigh, 0.06);
      const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * k, 0.11 * k, 0.28 * k, 10), toon(look.shorts));
      shorts.position.y = -0.1 * k;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.26 * k, 0.07, 0.12), skin);
      foot.position.set(0.07, -0.84 * k, 0);
      leg.add(thigh, shorts, foot);
    }
    this.body.add(this.torso, this.head, this.legF, this.legB);
    this.root.add(this.body);

    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.38, 20), new THREE.MeshBasicMaterial({ color: 0x6b3f1f, transparent: true, opacity: 0.35, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.01;

    this.tag = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: canvasTexture(512, 96, (c) => {
          c.font = '700 44px system-ui, sans-serif';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.lineWidth = 8;
          c.strokeStyle = 'rgba(20,22,58,0.85)';
          c.fillStyle = team === 0 ? '#8fc0ff' : '#ffb4a0';
          const txt = `${TEAM_SYMBOL[team]} ${label}`;
          c.strokeText(txt, 256, 48);
          c.fillText(txt, 256, 48);
        }),
        depthTest: false,
      }),
    );
    this.tag.scale.set(2.6, 0.49, 1);
    this.tag.position.y = 2.35 * k;
    this.tag.renderOrder = 10;
    this.root.add(this.tag);
  }

  get shadowMesh(): THREE.Mesh {
    return this.shadow;
  }

  update(p: ViewPlayer, sx: number, face: 1 | -1, tick: number, dt: number, showTag: boolean): void {
    this.root.position.set(sx, p.y, 0);
    this.body.scale.x = face; // face the net (mirrors the rig)
    this.shadow.position.x = sx;
    const hs = Math.max(0.45, 1 - p.y * 0.3);
    this.shadow.scale.setScalar(hs);
    this.tag.visible = showTag;

    // landing squash
    if (p.grounded && !this.wasGrounded) this.squash = 1;
    this.wasGrounded = p.grounded;
    this.squash = Math.max(0, this.squash - dt * 6);
    const sq = settings.reduceMotion ? 0 : this.squash * 0.12;
    this.body.scale.y = 1 - sq;
    this.body.scale.z = 1 + sq * 0.5;

    // locomotion
    const speed = Math.abs(p.vx);
    this.run += dt * (4 + speed * 2.2);
    let swing = p.grounded ? Math.sin(this.run) * Math.min(1, speed / 4) * 0.7 : 0;
    let front = swing;
    let back = -swing;
    let lean = p.grounded ? -Math.sign(p.vx) * face * Math.min(0.15, speed * 0.03) : 0;
    let headDip = 0;
    if (!p.grounded) {
      front = -0.5;
      back = 0.4;
    }

    // action poses: wind-up → strike → follow-through, timed on the sim's windows
    const a = p.act;
    if (a) {
      const tm = a.kind === 'serve' ? TIMING.serve : a.kind === 'touch' ? (a.air ? TIMING.touchAir : TIMING.touchGround) : a.air ? TIMING.attackAir : TIMING.attackGround;
      const wind = Math.min(1, a.t / Math.max(1, tm.startup));
      const strike = Math.max(0, Math.min(1, (a.t - tm.startup) / Math.max(1, tm.active)));
      if (a.kind === 'attack' || a.kind === 'serve') {
        front = 0.9 * wind - 2.4 * strike;
        back = 0.2;
        lean = -0.25 * strike;
      } else {
        front = -1.1 * wind;
        back = 0.15;
      }
      swing = 0;
    } else if (p.lastTick >= 0 && tick - p.lastTick < 14) {
      const k = 1 - (tick - p.lastTick) / 14;
      if (p.lastPart === 'head') headDip = 0.35 * k;
      if (p.lastPart === 'chest') lean = 0.25 * k;
    }
    this.legF.rotation.z = front;
    this.legB.rotation.z = back;
    this.torso.rotation.z = lean;
    this.head.position.x = headDip * 0.25;
    this.head.rotation.z = -headDip;
  }
}

// ── contact FX ───────────────────────────────────────────────────────────────

interface Burst {
  sprite: THREE.Sprite;
  life: number;
  max: number;
  grow: number;
}

function starTexture(): THREE.Texture {
  return canvasTexture(128, 128, (c) => {
    c.translate(64, 64);
    c.fillStyle = '#fff8ec';
    c.beginPath();
    for (let i = 0; i < 16; i++) {
      const r = i % 2 ? 22 : 60;
      const a = (i / 16) * Math.PI * 2;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
  });
}

function puffTexture(): THREE.Texture {
  return canvasTexture(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(242,210,155,0.95)');
    g.addColorStop(1, 'rgba(242,210,155,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
}

// ── scene ────────────────────────────────────────────────────────────────────

export class Scene3D {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 200);
  private readonly avatars = new Map<number, Avatar>();
  private readonly ball: THREE.Mesh;
  private readonly ballShadow: THREE.Mesh;
  private readonly landing: THREE.Mesh;
  private readonly trail: THREE.Mesh[] = [];
  private readonly bursts: Burst[] = [];
  private readonly starTex = starTexture();
  private readonly puffTex = puffTexture();
  private readonly fxLayer = new THREE.Group();
  private readonly offBall: HTMLElement;
  private camX = 0;
  private camY = 3.1;
  private shake = 0;
  private spin = 0;
  private flip = false;
  private lastSlots = '';

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = canvasTexture(4, 256, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#8c6bb1');
      g.addColorStop(0.45, '#ff9a6b');
      g.addColorStop(0.8, '#ffd9a0');
      g.addColorStop(1, '#ffe9c4');
      c.fillStyle = g;
      c.fillRect(0, 0, 4, 256);
    });
    this.scene.fog = new THREE.Fog(0xffc89a, 30, 95);
    this.scene.add(new THREE.HemisphereLight(0xfff1dd, 0xc9955a, 1.6));
    const sun = new THREE.DirectionalLight(0xffe0b0, 2.2);
    sun.position.set(-8, 14, 10);
    this.scene.add(sun);

    this.buildArena();

    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 24, 16),
      new THREE.MeshToonMaterial({
        gradientMap: RAMP,
        map: canvasTexture(256, 128, (c) => {
          c.fillStyle = '#fff6e0';
          c.fillRect(0, 0, 256, 128);
          c.strokeStyle = '#1b2a6b';
          c.lineWidth = 12;
          for (const x of [40, 125, 210]) {
            c.beginPath();
            c.moveTo(x, 0);
            c.bezierCurveTo(x + 40, 40, x - 40, 88, x, 128);
            c.stroke();
          }
          c.fillStyle = '#ffd23f';
          c.fillRect(0, 56, 256, 16);
        }),
      }),
    );
    outline(this.ball, 0.12);
    this.scene.add(this.ball);
    this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(BALL_R * 1.4, 20), new THREE.MeshBasicMaterial({ color: 0x6b3f1f, transparent: true, opacity: 0.65, depthWrite: false }));
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.position.y = 0.015;
    this.scene.add(this.ballShadow);
    this.landing = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.33, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
    this.landing.rotation.x = -Math.PI / 2;
    this.landing.position.y = 0.02;
    this.scene.add(this.landing);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_R * (0.9 - i * 0.08), 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      this.trail.push(m);
      this.scene.add(m);
    }
    this.scene.add(this.fxLayer);

    this.offBall = document.createElement('div');
    this.offBall.className = 'offball';
    this.offBall.hidden = true;
    overlay.appendChild(this.offBall);
    this.resize();
    addEventListener('resize', this.resize);
  }

  private readonly resize = (): void => {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // fit the whole playable width (court + free zones) plus a margin, at any aspect
    // (the far end of the free zones may leave the frame: players rarely go that deep)
    const halfW = COURT.half + 2.4;
    const hTan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect;
    this.dist = Math.max(halfW / hTan, 16);
    this.camera.updateProjectionMatrix();
  };
  private dist = 22;

  private buildArena(): void {
    const s = this.scene;
    // sand
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 80),
      new THREE.MeshToonMaterial({
        gradientMap: RAMP,
        color: SAND,
        map: canvasTexture(512, 512, (c) => {
          c.fillStyle = '#f2d29b';
          c.fillRect(0, 0, 512, 512);
          for (let i = 0; i < 2600; i++) {
            c.fillStyle = Math.random() < 0.5 ? 'rgba(201,149,90,0.25)' : 'rgba(255,240,210,0.35)';
            c.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
          }
        }),
      }),
    );
    (sand.material as THREE.MeshToonMaterial).map!.wrapS = THREE.RepeatWrapping;
    (sand.material as THREE.MeshToonMaterial).map!.wrapT = THREE.RepeatWrapping;
    (sand.material as THREE.MeshToonMaterial).map!.repeat.set(24, 12);
    sand.rotation.x = -Math.PI / 2;
    s.add(sand);

    // court lines (a line on the sand is "in")
    const lineMat = flat(0xffffff);
    const L = COURT.half;
    const addLine = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.012, z);
      s.add(m);
    };
    addLine(2 * L + 0.1, 0.1, 0, COURT_Z);
    addLine(2 * L + 0.1, 0.1, 0, -COURT_Z);
    addLine(0.1, 2 * COURT_Z, -L, 0);
    addLine(0.1, 2 * COURT_Z, L, 0);
    // chinelos marking the corners (running joke)
    const chinelo = (x: number, z: number, color: number, rot: number) => {
      const g = new THREE.Group();
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.12), toon(color));
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), toon(0xffffff));
      strap.rotation.x = Math.PI / 2;
      strap.position.set(0.03, 0.02, 0);
      g.add(sole, strap);
      g.position.set(x, 0.02, z);
      g.rotation.y = rot;
      s.add(g);
    };
    chinelo(-L - 0.25, COURT_Z + 0.25, 0x2ec27e, 0.4);
    chinelo(L + 0.25, COURT_Z + 0.25, 0xffd23f, -0.5);
    chinelo(-L - 0.3, -COURT_Z - 0.3, 0xff5a36, 2.2);
    chinelo(L + 0.3, -COURT_Z - 0.2, 0x2d7ff9, 1.1);

    // net: posts, mesh down to the sand (it's solid for the ball), blue-white tape
    const postMat = toon(0xf4f4f4);
    for (const z of [-COURT_Z - 0.4, COURT_Z + 0.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, COURT.netTop + 0.3, 10), postMat);
      post.position.set(0, (COURT.netTop + 0.3) / 2, z);
      outline(post, 0.2);
      s.add(post);
    }
    const netTex = canvasTexture(256, 256, (c) => {
      c.clearRect(0, 0, 256, 256);
      c.strokeStyle = 'rgba(20,22,58,0.55)';
      c.lineWidth = 3;
      for (let i = 0; i <= 256; i += 32) {
        c.beginPath();
        c.moveTo(i, 0);
        c.lineTo(i, 256);
        c.moveTo(0, i);
        c.lineTo(256, i);
        c.stroke();
      }
    });
    netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping;
    netTex.repeat.set((2 * COURT_Z + 0.8) / 0.5, COURT.netTop / 0.5);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(2 * COURT_Z + 0.8, COURT.netTop), new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    net.rotation.y = Math.PI / 2;
    net.position.set(0, COURT.netTop / 2, 0);
    s.add(net);
    const tape = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 2 * COURT_Z + 0.8),
      new THREE.MeshBasicMaterial({
        map: canvasTexture(256, 8, (c) => {
          for (let i = 0; i < 16; i++) {
            c.fillStyle = i % 2 ? '#ffffff' : '#2d7ff9';
            c.fillRect(i * 16, 0, 16, 8);
          }
        }),
      }),
    );
    tape.position.set(0, COURT.netTop - 0.05, 0);
    s.add(tape);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, COURT.netTop - 0.1, 2 * COURT_Z + 0.8), new THREE.MeshBasicMaterial({ color: 0x14163a, transparent: true, opacity: 0.35, depthWrite: false }));
    band.position.set(0, (COURT.netTop - 0.1) / 2, 0);
    s.add(band);

    // calçadão (original wave pattern), kiosk, umbrellas, chairs, bikes, buildings, hill
    const walk = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 6),
      new THREE.MeshBasicMaterial({
        map: canvasTexture(512, 64, (c) => {
          c.fillStyle = '#f7f0e2';
          c.fillRect(0, 0, 512, 64);
          c.strokeStyle = '#2b2b2b';
          c.lineWidth = 7;
          for (let row = 0; row < 3; row++) {
            c.beginPath();
            for (let x = 0; x <= 512; x += 4) {
              const y = 12 + row * 20 + Math.sin((x / 512) * Math.PI * 8 + row) * 5;
              if (x === 0) c.moveTo(x, y);
              else c.lineTo(x, y);
            }
            c.stroke();
          }
        }),
      }),
    );
    (walk.material as THREE.MeshBasicMaterial).map!.wrapS = THREE.RepeatWrapping;
    (walk.material as THREE.MeshBasicMaterial).map!.repeat.set(10, 1);
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(0, 0.03, -16);
    s.add(walk);

    const rnd = mulberry(7);
    const buildingColors = [0xf6e3c6, 0xe8b27d, 0xcfe3e8, 0xf2c9b1, 0xdad3f0, 0xfff2d8];
    for (let x = -90; x < 90; ) {
      const w = 7 + rnd() * 8;
      const h = 14 + rnd() * 26;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 6), toon(buildingColors[Math.floor(rnd() * buildingColors.length)]!));
      b.position.set(x + w / 2, h / 2, -42 - rnd() * 6);
      s.add(b);
      // window rows
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.8, h * 0.85),
        new THREE.MeshBasicMaterial({
          transparent: true,
          map: canvasTexture(64, 128, (c) => {
            c.fillStyle = 'rgba(40,60,110,0.35)';
            for (let yy = 6; yy < 128; yy += 12) for (let xx = 4; xx < 64; xx += 12) c.fillRect(xx, yy, 7, 7);
          }),
        }),
      );
      win.position.set(0, 0, 3.01);
      b.add(win);
      x += w + 0.6;
    }
    const hill = new THREE.Mesh(new THREE.SphereGeometry(30, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x5d8f4e));
    hill.scale.set(1.4, 0.9, 0.4);
    hill.position.set(-30, 0, -55);
    s.add(hill);

    // kiosk "Coco & Cia"
    const kiosk = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 2), toon(0x2ec27e));
    base.position.y = 1.1;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 4), toon(0xffd23f));
    roof.position.y = 2.8;
    roof.rotation.y = Math.PI / 4;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.6),
      new THREE.MeshBasicMaterial({
        map: canvasTexture(256, 64, (c) => {
          c.fillStyle = '#fff8ec';
          c.fillRect(0, 0, 256, 64);
          c.fillStyle = '#d9481f';
          c.font = '900 italic 38px system-ui, sans-serif';
          c.textAlign = 'center';
          c.fillText('COCO & CIA', 128, 46);
        }),
      }),
    );
    sign.position.set(0, 2.0, 1.01);
    kiosk.add(base, roof, sign);
    kiosk.position.set(-15, 0, -12);
    s.add(kiosk);

    // umbrellas + chairs (behind the court)
    const umbrella = (x: number, z: number, c1: number) => {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), toon(0xffffff));
      pole.position.y = 1.1;
      const top = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.5, 8), toon(c1));
      top.position.y = 2.2;
      const chair = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 1), toon(0xffffff));
      chair.position.set(0.8, 0.35, 0.3);
      chair.rotation.z = 0.5;
      g.add(pole, top, chair);
      g.position.set(x, 0, z);
      s.add(g);
    };
    umbrella(-12, -8, 0xff5a36);
    umbrella(12, -9, 0x2d7ff9);
    umbrella(17, -7, 0xffd23f);
    umbrella(-19, -9, 0x2ec27e);
    // cooler box and bikes
    const cooler = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.4), toon(0x2d7ff9));
    cooler.position.set(-10.5, 0.22, -6);
    s.add(cooler);
    for (const bx of [9, 9.8]) {
      const bike = new THREE.Group();
      for (const wx of [-0.5, 0.5]) {
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 6, 18), toon(0x14163a));
        wheel.position.set(wx, 0.33, 0);
        bike.add(wheel);
      }
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.05), toon(bx === 9 ? 0xff5a36 : 0x2ec27e));
      frame.position.y = 0.6;
      bike.add(frame);
      bike.position.set(bx, 0, -14);
      s.add(bike);
    }
    // crowd cards on the promenade, with a caramelo dog
    const crowd = new THREE.Group();
    const skin = [0x6b3f2a, 0x8d5a3b, 0xb07a52, 0xd9a47a, 0xf0c9a0];
    const shirt = [0xff5a36, 0x2d7ff9, 0xffd23f, 0x2ec27e, 0xffffff, 0x8c6bb1];
    for (let i = 0; i < 60; i++) {
      const person = new THREE.Group();
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.6, 4, 8), toon(shirt[Math.floor(rnd() * shirt.length)]!));
      b.position.y = 0.75;
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), toon(skin[Math.floor(rnd() * skin.length)]!));
      h.position.y = 1.35;
      person.add(b, h);
      person.position.set(-28 + i * 0.95 + rnd() * 0.4, 0, -17.5 - rnd() * 1.5);
      person.userData.phase = rnd() * 6;
      crowd.add(person);
    }
    const dog = new THREE.Group();
    const dogBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.45, 4, 8), toon(0xc98a3e));
    dogBody.rotation.z = Math.PI / 2;
    dogBody.position.y = 0.35;
    const dogHead = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), toon(0xc98a3e));
    dogHead.position.set(0.35, 0.55, 0);
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.2, 3, 6), toon(0xc98a3e));
    tail.position.set(-0.35, 0.5, 0);
    tail.name = 'tail';
    dog.add(dogBody, dogHead, tail);
    dog.position.set(4.2, 0, -15.8);
    crowd.add(dog);
    this.crowd = crowd;
    this.dogTail = tail;
    s.add(crowd);
  }

  private crowd!: THREE.Group;
  private dogTail!: THREE.Mesh;
  private cheer = 0;

  private avatarFor(p: ViewPlayer): Avatar {
    let a = this.avatars.get(p.slot);
    if (!a) {
      a = new Avatar(p.slot, p.team, LOOKS[p.slot % LOOKS.length]!, p.isBot ? `${p.name} · BOT` : p.name);
      this.avatars.set(p.slot, a);
      this.scene.add(a.root, a.shadowMesh);
    }
    return a;
  }

  private sx(x: number): number {
    return this.flip ? -x : x;
  }

  /** React to a simulation event (FX, camera). Sounds live in audio/. */
  onEvent(e: SimEvent): void {
    if (e.k === 'contact') {
      const perfect = e.grade === 'perfect';
      this.burst(this.starTex, this.sx(e.x), e.y, perfect ? 0xffd23f : 0xfff8ec, perfect ? 0.9 : 0.6, 0.18);
      if (e.kind === 'attack' && e.speed > 14 && !settings.reduceMotion) this.shake = Math.min(1, this.shake + 0.5);
    } else if (e.k === 'ground') {
      this.burst(this.puffTex, this.sx(e.x), 0.15, 0xffffff, 1.4, 0.45);
      this.burst(this.puffTex, this.sx(e.x) + 0.3, 0.1, 0xffffff, 1.0, 0.4);
    } else if (e.k === 'point') {
      this.cheer = 1;
      if (!settings.reduceMotion) this.shake = Math.min(1, this.shake + 0.3);
    } else if (e.k === 'net') {
      this.burst(this.puffTex, 0, e.y, 0xffffff, 0.5, 0.25);
    }
  }

  private burst(tex: THREE.Texture, x: number, y: number, color: number, size: number, life: number): void {
    if (settings.reduceFx && tex === this.puffTex) return;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false }));
    sprite.position.set(x, y, -0.05); // drawn behind the ball
    sprite.scale.setScalar(size * 0.4);
    this.fxLayer.add(sprite);
    this.bursts.push({ sprite, life, max: life, grow: size });
  }

  render(v: View, dt: number, now: number): void {
    this.flip = v.flip;
    const slots = v.players.map((p) => `${p.slot}:${p.name}:${p.isBot}`).join('|');
    if (slots !== this.lastSlots) {
      for (const a of this.avatars.values()) this.scene.remove(a.root, a.shadowMesh);
      this.avatars.clear();
      this.lastSlots = slots;
    }
    for (const p of v.players) {
      const face = ((p.team === 0 ? 1 : -1) * (this.flip ? -1 : 1)) as 1 | -1;
      this.avatarFor(p).update(p, this.sx(p.x), face, v.tick, dt, true);
    }

    // ball, shadow, spin, trail
    const bx = this.sx(v.ball.x);
    const by = Math.max(BALL_R, v.ball.y);
    this.ball.position.set(bx, by, 0);
    this.spin += (this.flip ? 1 : -1) * v.ball.vx * dt * 3;
    this.ball.rotation.z = this.spin;
    this.ballShadow.position.x = bx;
    const hh = Math.min(1, by / 6);
    this.ballShadow.scale.setScalar(1 - hh * 0.4);
    (this.ballShadow.material as THREE.MeshBasicMaterial).opacity = 0.7 - hh * 0.35;
    const speed = Math.hypot(v.ball.vx, v.ball.vy);
    for (let i = this.trail.length - 1; i > 0; i--) this.trail[i]!.position.copy(this.trail[i - 1]!.position);
    this.trail[0]!.position.copy(this.ball.position);
    const trailOn = speed > 13 && !v.ball.held && !settings.reduceFx;
    this.trail.forEach((m, i) => ((m.material as THREE.MeshBasicMaterial).opacity = trailOn ? 0.35 * (1 - i / this.trail.length) : 0));

    // training hint: where the ball comes down
    this.landing.visible = v.landingHint && !v.ball.held && (v.phase === 'rally' || v.phase === 'serve');
    if (this.landing.visible) {
      const g = BALL.gravity;
      const disc = v.ball.vy * v.ball.vy + 2 * g * (v.ball.y - BALL.radius);
      const t = disc > 0 ? (v.ball.vy + Math.sqrt(disc)) / g : 0;
      this.landing.position.x = this.sx(v.ball.x + v.ball.vx * t);
    }

    // FX
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i]!;
      b.life -= dt;
      const k = 1 - b.life / b.max;
      b.sprite.scale.setScalar(b.grow * (0.4 + k * 0.9));
      b.sprite.material.opacity = 1 - k;
      b.sprite.material.rotation += dt * 2;
      if (b.life <= 0) {
        this.fxLayer.remove(b.sprite);
        b.sprite.material.dispose();
        this.bursts.splice(i, 1);
      }
    }
    this.cheer = Math.max(0, this.cheer - dt * 0.6);
    this.crowd.children.forEach((c) => {
      if (c.userData.phase !== undefined) c.position.y = Math.max(0, Math.sin(now * 0.012 + (c.userData.phase as number)) * 0.25 * this.cheer);
    });
    this.dogTail.rotation.z = Math.sin(now * (0.01 + this.cheer * 0.03)) * 0.6;

    // camera: whole court, gentle follow; rises for high balls; never cuts
    const tx = Math.max(-1, Math.min(1, bx * 0.12));
    const ty = 3.1 + Math.max(0, by - 5) * 0.5;
    const k = 1 - Math.exp(-dt * 3);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    this.shake = Math.max(0, this.shake - dt * 5);
    const sh = settings.reduceMotion ? 0 : this.shake * 0.08;
    const jx = (Math.random() - 0.5) * sh;
    const jy = (Math.random() - 0.5) * sh;
    this.camera.position.set(this.camX + jx, this.camY + 1.6 + jy, this.dist);
    this.camera.lookAt(this.camX + jx, this.camY - 0.2 + jy, 0);
    this.renderer.render(this.scene, this.camera);

    // off-screen ball indicator (when it goes above the frame)
    const p = this.ball.position.clone().project(this.camera);
    const above = p.y > 1;
    this.offBall.hidden = !above;
    if (above) {
      this.offBall.style.left = `${((p.x + 1) / 2) * 100}%`;
      this.offBall.textContent = `▲ ${by.toFixed(0)} m`;
    }
  }

  dispose(): void {
    removeEventListener('resize', this.resize);
    this.renderer.dispose();
    this.offBall.remove();
  }
}

function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
