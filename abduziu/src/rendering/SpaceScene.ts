import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Quaternion,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Object3D,
} from 'three';
import { CITIES } from '../config/cities';
import { createEarthTextures, type EarthTextures } from './EarthTextures';

/** Earth radius in scene units. The saucer (radius ~1) orbits a few units above it. */
const R = 100;
/** Saucer altitude above the surface in the menu. */
const ORBIT = 14;
export const DIVE_TIME = 3.4;
export const LAUNCH_TIME = 4.4;

type Phase = 'menu' | 'dive' | 'launch' | 'orbit';

const _v = new Vector3();
const _v2 = new Vector3();
const _q = new Quaternion();
const _m = new Matrix4();
const _m2 = new Matrix4();

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Unit vector for (lat, lon) in the globe's own frame (matches the equirectangular maps). */
function latLonDir(lat: number, lon: number, out: Vector3): Vector3 {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return out.set(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
}

/** Rotation that brings (lat, lon) to +Y with north pointing to -Z (away from the camera). */
function globeFacing(lat: number, lon: number, out: Quaternion): Quaternion {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  const up = latLonDir(lat, lon, new Vector3());
  const east = new Vector3(-Math.sin(lo), 0, -Math.cos(lo));
  const north = new Vector3(-Math.sin(la) * Math.cos(lo), Math.cos(la), Math.sin(la) * Math.sin(lo));
  _m.makeBasis(east, up, north);
  _m2.makeBasis(new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, -1));
  _m2.multiply(_m.transpose());
  return out.setFromRotationMatrix(_m2);
}

/**
 * Orbit scene shown in the menu and around every mission: a hand-painted Earth with
 * clouds, atmosphere and city lights, the Moon, the Sun and a field of stars. The saucer
 * is borrowed from the city scene while this one is on screen.
 */
export class SpaceScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(50, 1, 0.05, 8000);
  private readonly globe = new Group();
  private readonly earthMat: ShaderMaterial;
  private readonly cloudMesh: Mesh;
  private readonly target: Mesh;
  private readonly glow: Mesh;
  private readonly trail: Mesh;
  private readonly sunDir = new Vector3(0.75, 0.62, -0.25).normalize();
  private readonly qMenu = new Quaternion();
  private readonly qFrom = new Quaternion();
  private readonly qTo = new Quaternion();
  private readonly camFrom = new Vector3();
  private readonly lookFrom = new Vector3();
  private readonly look = new Vector3();
  private readonly sPos = new Vector3();
  private ufo: Object3D | null = null;
  private ufoBody: Object3D | null = null;
  private underglow: Object3D | null = null;
  private phase: Phase = 'menu';
  private t = 0;
  private angle = 0.6;
  private portrait = false;
  private textures: EarthTextures;
  /** 0..1 white flash the game overlays (atmospheric entry / leaving the city). */
  flash = 0;
  /** True once the current dive/launch has finished. */
  done = false;

  constructor(hiRes: boolean) {
    this.textures = createEarthTextures(hiRes);
    const tex = this.textures;
    const sun = this.sunDir;

    // lights for the saucer: the Sun and a blue earthshine from below
    const key = new DirectionalLight(0xfff4e6, 3.2);
    key.position.copy(sun).multiplyScalar(100);
    this.scene.add(key);
    this.scene.add(new HemisphereLight(0x1a2438, 0x2f6fb5, 1.1));
    this.scene.background = new Color(0x010207);

    // ── Earth
    this.earthMat = new ShaderMaterial({
      uniforms: {
        uDay: { value: tex.day },
        uLights: { value: tex.lights },
        uSun: { value: sun },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vN;
        varying vec3 vP;
        void main() {
          vUv = uv;
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vP = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uDay;
        uniform sampler2D uLights;
        uniform vec3 uSun;
        varying vec2 vUv;
        varying vec3 vN;
        varying vec3 vP;
        void main() {
          vec3 N = normalize(vN);
          vec3 V = normalize(cameraPosition - vP);
          vec3 day = texture2D(uDay, vUv).rgb;
          vec2 li = texture2D(uLights, vUv).rg;
          float ndl = dot(N, uSun);
          float lit = smoothstep(-0.18, 0.3, ndl);
          vec3 col = day * (0.015 + 1.25 * max(ndl, 0.0));
          // ocean glint
          float spec = pow(max(dot(reflect(-uSun, N), V), 0.0), 60.0) * (1.0 - li.g) * lit;
          col += vec3(1.0, 0.92, 0.8) * spec * 1.4;
          // city lights on the night side
          col += vec3(1.0, 0.72, 0.38) * li.r * (1.0 - lit) * 2.2;
          // atmosphere haze on the lit limb, a hint of sunset at the terminator
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          col += vec3(0.3, 0.58, 1.0) * fres * (0.12 + lit * 1.1);
          col += vec3(1.0, 0.45, 0.15) * fres * smoothstep(0.25, 0.0, abs(ndl)) * 0.5;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const earth = new Mesh(new SphereGeometry(R, 128, 80), this.earthMat);
    this.globe.add(earth);

    const cloudMat = new ShaderMaterial({
      uniforms: { uMap: { value: tex.clouds }, uSun: { value: sun } },
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vN;
        void main() {
          vUv = uv;
          vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uSun;
        varying vec2 vUv;
        varying vec3 vN;
        void main() {
          float a = texture2D(uMap, vUv).r;
          float ndl = dot(normalize(vN), uSun);
          vec3 c = vec3(1.0) * (0.03 + 1.15 * max(ndl, 0.0));
          gl_FragColor = vec4(c, a * 0.92);
        }`,
    });
    this.cloudMesh = new Mesh(new SphereGeometry(R * 1.008, 96, 64), cloudMat);
    this.globe.add(this.cloudMesh);

    const atmo = new Mesh(
      new SphereGeometry(R * 1.07, 96, 64),
      new ShaderMaterial({
        uniforms: { uSun: { value: sun } },
        side: BackSide,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        vertexShader: /* glsl */ `
          varying vec3 vN;
          varying vec3 vP;
          void main() {
            vN = normalize(mat3(modelMatrix) * normal);
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vP = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uSun;
          varying vec3 vN;
          varying vec3 vP;
          void main() {
            vec3 N = normalize(vN);
            vec3 V = normalize(cameraPosition - vP);
            float d = dot(N, V);
            float rim = pow(clamp(1.0 + d * 1.15, 0.0, 1.0), 5.0);
            float lit = smoothstep(-0.35, 0.4, dot(N, uSun));
            gl_FragColor = vec4(vec3(0.3, 0.6, 1.0) * rim * (0.15 + lit * 1.6), 1.0);
          }`,
      }),
    );
    this.scene.add(atmo);

    // city beacons (all campaign cities) + the target ring
    const beaconMat = new MeshBasicMaterial({ color: new Color(0.1, 0.9, 0.35) });
    const beaconGeo = new SphereGeometry(0.16, 8, 6);
    for (const c of CITIES) {
      if (c.id === 'nova_aurora') continue;
      const b = new Mesh(beaconGeo, beaconMat);
      latLonDir(c.lat, c.lon, b.position).multiplyScalar(R * 1.002);
      this.globe.add(b);
    }
    this.target = new Mesh(
      new RingGeometry(0.9, 1.25, 40),
      new MeshBasicMaterial({ color: new Color(0.12, 0.95, 0.4), transparent: true, opacity: 0.9, depthWrite: false, side: DoubleSide }),
    );
    this.target.visible = false;
    this.globe.add(this.target);
    this.scene.add(this.globe);

    // ── stars (a denser band for the Milky Way)
    const n = 4200;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const band = i < 1500;
      let x = Math.random() * 2 - 1;
      let y = Math.random() * 2 - 1;
      let z = Math.random() * 2 - 1;
      if (band) y = (Math.random() - 0.5) * 0.25 + x * 0.35;
      const l = Math.hypot(x, y, z) || 1;
      x /= l;
      y /= l;
      z /= l;
      pos.set([x * 4000, y * 4000, z * 4000], i * 3);
      const b = 0.35 + Math.pow(Math.random(), 3) * 1.8;
      const tint = Math.random();
      col.set([b * (tint < 0.15 ? 0.8 : 1), b * (tint > 0.85 ? 0.85 : 1), b * (tint < 0.15 ? 1.2 : tint > 0.85 ? 0.7 : 1)], i * 3);
    }
    const sg = new BufferGeometry();
    sg.setAttribute('position', new BufferAttribute(pos, 3));
    sg.setAttribute('color', new BufferAttribute(col, 3));
    this.scene.add(new Points(sg, new PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false })));

    // ── Sun and Moon
    const sunTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const ctx = c.getContext('2d') as CanvasRenderingContext2D;
      const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.08, 'rgba(255,250,235,1)');
      g.addColorStop(0.2, 'rgba(255,220,160,0.45)');
      g.addColorStop(0.5, 'rgba(255,190,120,0.08)');
      g.addColorStop(1, 'rgba(255,180,100,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      return new CanvasTexture(c);
    })();
    const sunSprite = new Sprite(new SpriteMaterial({ map: sunTex, color: new Color(3.2, 3, 2.7), blending: AdditiveBlending, depthWrite: false }));
    sunSprite.position.copy(sun).multiplyScalar(3000);
    sunSprite.scale.setScalar(900);
    this.scene.add(sunSprite);
    const moon = new Mesh(new SphereGeometry(16, 32, 20), new MeshStandardMaterial({ map: tex.moon, roughness: 1, metalness: 0 }));
    moon.position.set(-520, 180, -760);
    this.scene.add(moon);

    // ── saucer effects: entry heat shell and engine trail
    this.glow = new Mesh(
      new SphereGeometry(1.7, 24, 16),
      new ShaderMaterial({
        uniforms: { uA: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        vertexShader: /* glsl */ `
          varying vec3 vN;
          varying vec3 vP;
          void main() {
            vN = normalize(mat3(modelMatrix) * normal);
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vP = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uA;
          varying vec3 vN;
          varying vec3 vP;
          void main() {
            float f = 1.0 - abs(dot(normalize(vN), normalize(cameraPosition - vP)));
            vec3 c = mix(vec3(1.0, 0.85, 0.5), vec3(1.0, 0.35, 0.08), f);
            gl_FragColor = vec4(c * pow(f, 3.2) * 1.6 * uA, 1.0);
          }`,
      }),
    );
    this.glow.visible = false;
    this.scene.add(this.glow);
    const trailGeo = new CylinderGeometry(0, 1, 1, 16, 1, true);
    trailGeo.translate(0, -0.5, 0);
    this.trail = new Mesh(
      trailGeo,
      new ShaderMaterial({
        uniforms: { uA: { value: 0 }, uC: { value: new Color(0.4, 1, 0.7) } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        vertexShader: /* glsl */ `
          varying float vY;
          void main() {
            vY = -position.y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uA;
          uniform vec3 uC;
          varying float vY;
          void main() {
            gl_FragColor = vec4(uC * pow(1.0 - vY, 2.0) * 2.2 * uA, 1.0);
          }`,
      }),
    );
    this.trail.visible = false;
    this.scene.add(this.trail);

    globeFacing(-14, -51, this.qMenu);
    this.globe.quaternion.copy(this.qMenu);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / Math.max(1, h);
    this.portrait = w < h;
    this.camera.updateProjectionMatrix();
  }

  /** Borrows the saucer model (it returns to the city scene with {@link releaseUfo}). */
  holdUfo(root: Object3D, body: Object3D, underglow?: Object3D): void {
    this.underglow = underglow ?? null;
    if (this.underglow) this.underglow.visible = false;
    this.ufo = root;
    this.ufoBody = body;
    this.scene.add(root);
    root.visible = true;
    root.scale.setScalar(1);
  }

  releaseUfo(to: Scene): void {
    if (this.underglow) this.underglow.visible = true;
    this.underglow = null;
    if (this.ufo) to.add(this.ufo);
    this.ufo = null;
    this.ufoBody = null;
    this.glow.visible = false;
    this.trail.visible = false;
  }

  setTrailColor(hex: number): void {
    ((this.trail.material as ShaderMaterial).uniforms.uC!.value as Color).setHex(hex).multiplyScalar(1.4);
  }

  /** Saucer parked in orbit over Brazil, the camera slowly circling it. */
  startMenu(): void {
    this.phase = 'menu';
    this.t = 0;
    this.done = false;
    this.flash = 0;
    this.target.visible = false;
    this.glow.visible = false;
    this.trail.visible = false;
    if (this.ufo) this.ufo.visible = true;
  }

  /** From the menu orbit down to (lat, lon): the globe turns, the saucer dives in. */
  startDive(lat: number, lon: number): void {
    this.phase = 'dive';
    this.t = 0;
    this.done = false;
    this.qFrom.copy(this.globe.quaternion);
    globeFacing(lat, lon, this.qTo);
    latLonDir(lat, lon, this.target.position).multiplyScalar(R * 1.004);
    this.target.lookAt(_v.copy(this.target.position).multiplyScalar(2));
    this.target.visible = true;
    this.camFrom.copy(this.camera.position);
    this.lookFrom.copy(this.look);
    if (this.ufo) this.ufo.visible = true;
  }

  /** Leaving (lat, lon): the saucer punches out of the atmosphere and off into space. */
  startLaunch(lat: number, lon: number): void {
    this.phase = 'launch';
    this.t = 0;
    this.done = false;
    globeFacing(lat, lon, this.qTo);
    this.globe.quaternion.copy(this.qTo);
    this.target.visible = false;
    if (this.ufo) this.ufo.visible = true;
  }

  /** Jumps a launch to its end (the results backdrop). */
  skipToOrbit(): void {
    this.phase = 'orbit';
    this.t = 0;
    this.done = true;
    if (this.ufo) this.ufo.visible = false;
  }

  update(dt: number, time: number): void {
    this.t += dt;
    const t = this.t;
    this.cloudMesh.rotation.y += dt * 0.004;
    const cam = this.camera;
    const ufo = this.ufo;
    this.camera.fov = this.portrait ? 64 : 50;
    this.glow.visible = false;
    this.trail.visible = false;
    this.flash = 0;

    if (this.phase === 'menu') {
      this.globe.quaternion.slerp(this.qMenu, 1 - Math.exp(-dt * 1.2));
      this.angle += dt * 0.045;
      const s = this.sPos.set(0, R + ORBIT + Math.sin(time * 0.8) * 0.12, 0);
      if (ufo) {
        ufo.position.copy(s);
        ufo.scale.setScalar(1);
        this.ufoBody?.rotation.set(Math.sin(time * 0.6) * 0.05, 0, Math.cos(time * 0.5) * 0.05);
      }
      this.menuCamera(s);
    } else if (this.phase === 'dive') {
      const T = DIVE_TIME;
      this.globe.quaternion.slerpQuaternions(this.qFrom, this.qTo, smooth(0, 1.5, t));
      const lift = smooth(0, 0.5, t) * 0.8;
      const k = Math.pow(smooth(0.5, T, t), 1.7);
      const y = R + ORBIT + lift - (ORBIT + lift - 2.2) * k;
      const s = this.sPos.set(0, y, 0);
      if (ufo) {
        ufo.position.copy(s);
        this.ufoBody?.rotation.set(-0.35 * smooth(0.2, 0.8, t), 0, Math.sin(t * 6) * 0.04 * k);
      }
      // camera: from the menu framing into a chase shot above and behind the saucer
      const a = this.angle;
      const chase = _v2.set(Math.sin(a) * (6.5 - k * 1.5), y + 3.6 + k * 1.5, Math.cos(a) * (6.5 - k * 1.5));
      const blend = smooth(0.1, 1.2, t);
      cam.position.lerpVectors(this.camFrom, chase, blend);
      this.look.lerpVectors(this.lookFrom, _v2.set(0, y - 3.5, 0), blend);
      cam.lookAt(this.look);
      // re-entry: heat shell and a streak behind
      const heat = smooth(1.5, 3.0, t);
      this.showGlow(s, heat);
      this.showTrail(s, _v2.set(0, 1, 0), heat * 0.8, 2 + heat * 5);
      const pulse = 1 + Math.sin(time * 8) * 0.12 + (1 - smooth(0, 1.6, t)) * 3;
      this.target.scale.setScalar(pulse * (1 - k * 0.6));
      this.flash = smooth(T - 0.75, T - 0.05, t);
      if (t >= T) this.done = true;
    } else if (this.phase === 'launch') {
      const y = R + 1.2 + 2.4 * t + 13 * t * t;
      const x = 2.4 * t * t;
      const s = this.sPos.set(x, y, -9 * t * t);
      if (ufo) {
        ufo.position.copy(s);
        this.ufoBody?.rotation.set(0.25 * smooth(0, 1, t), t * 6, 0.1);
      }
      const vy = 2.4 + 30 * t;
      this.showGlow(s, 1 - smooth(0.2, 1.4, t));
      this.showTrail(s, _v2.set(-4.8 * t, -vy, 18 * t).normalize(), 0.5 + smooth(0.5, 2, t) * 0.7, 3 + vy * 0.35);
      // camera: close on the rising saucer, then pulling back to show the whole planet
      const u = smooth(0.35, 3.4, t);
      const near = _v2.set(7, R + 8 + t * 6, 15);
      cam.position.set(near.x + (R * 0.35 - near.x) * u, near.y + (R * 2.9 - near.y) * u, near.z + (R * 0.45 - near.z) * u);
      this.look.set(s.x * (1 - u), s.y + (R * 0.25 - s.y) * u, s.z * (1 - u));
      cam.lookAt(this.look);
      this.flash = 1 - smooth(0, 0.5, t) + smooth(LAUNCH_TIME - 0.35, LAUNCH_TIME, t) * 0.55;
      if (t >= LAUNCH_TIME) {
        this.phase = 'orbit';
        this.t = 0;
        this.done = true;
        if (ufo) ufo.visible = false;
      }
    } else {
      // results backdrop: a slow drift around the planet
      const a = 0.661 + Math.sin(t * 0.05) * 0.25;
      cam.position.set(Math.sin(a) * R * 0.57, R * 2.9, Math.cos(a) * R * 0.57);
      this.look.set(0, R * 0.25, 0);
      cam.lookAt(this.look);
    }
    cam.updateProjectionMatrix();
  }

  private menuCamera(s: Vector3): void {
    const cam = this.camera;
    const a = this.angle;
    const d = this.portrait ? 9.5 : 7.2;
    cam.position.set(s.x + Math.sin(a) * d, s.y + 1.6, s.z + Math.cos(a) * d);
    if (this.portrait) {
      // saucer in the upper half, the logo below it
      this.look.set(s.x - Math.sin(a) * 3, s.y - 4.2, s.z - Math.cos(a) * 3);
    } else {
      // saucer in the right third, horizon curving along the bottom
      this.look.set(s.x - Math.cos(a) * 2.6 - Math.sin(a) * 3, s.y - 2.4, s.z + Math.sin(a) * 2.6 - Math.cos(a) * 3);
    }
    cam.lookAt(this.look);
  }

  private showGlow(at: Vector3, a: number): void {
    if (a <= 0.01) return;
    this.glow.visible = true;
    this.glow.position.copy(at);
    this.glow.scale.set(1, 1.25, 1);
    (this.glow.material as ShaderMaterial).uniforms.uA!.value = a;
  }

  private showTrail(at: Vector3, back: Vector3, a: number, len: number): void {
    if (a <= 0.01) return;
    this.trail.visible = true;
    this.trail.position.copy(at);
    _q.setFromUnitVectors(_v.set(0, -1, 0), back);
    this.trail.quaternion.copy(_q);
    this.trail.scale.set(1.1, len, 1.1);
    (this.trail.material as ShaderMaterial).uniforms.uA!.value = a;
  }
}
