import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { damp } from '../utils/math';

interface Stage {
  level: number;
  obj: Group | Mesh;
  reveal: number;
}

/**
 * Procedural saucer that visibly evolves with the run level:
 * 1 small disc → 5 more lights → 10 outer spinning ring → 15 energy core →
 * 20 dual gravity rings → 25 massive fins → 30+ skyline-dominating machine.
 */
export class UFOVisuals {
  readonly root = new Group();
  /** Tilt/bob pivot (children spin inside it). */
  readonly body = new Group();
  readonly hull: Mesh;
  readonly dome: Mesh;
  readonly lightsMat: ShaderMaterial;
  readonly hatchMat: MeshBasicMaterial;
  private readonly spinner = new Group();
  private readonly ring1: Mesh;
  private readonly ring2: Mesh;
  private readonly core: Mesh;
  private readonly fins = new Group();
  private readonly halo: Points;
  private readonly stages: Stage[] = [];
  private readonly hullMat: MeshStandardMaterial;
  private readonly accentColor = new Color(0x5dffa0);
  private readonly targetAccent = new Color(0x5dffa0);
  private time = 0;
  energy = 0;
  damageFlash = 0;

  constructor(envMap: Texture | null) {
    this.root.add(this.body);
    this.body.add(this.spinner);

    // classic lens saucer profile
    const pts: Vector2[] = [];
    const profile: Array<[number, number]> = [
      [0.0, -0.34],
      [0.35, -0.33],
      [0.62, -0.26],
      [0.86, -0.12],
      [1.0, -0.02],
      [1.02, 0.02],
      [0.95, 0.09],
      [0.72, 0.18],
      [0.45, 0.24],
      [0.0, 0.26],
    ];
    for (const [x, y] of profile) pts.push(new Vector2(x, y));
    this.hullMat = new MeshStandardMaterial({ color: 0xc9d2dc, metalness: 0.82, roughness: 0.26, envMap, envMapIntensity: 1.3 });
    this.hull = new Mesh(new LatheGeometry(pts, 48), this.hullMat);
    this.hull.castShadow = true;
    this.spinner.add(this.hull);

    // panel seams + rim band
    const band = new Mesh(new CylinderGeometry(1.025, 1.025, 0.05, 48, 1, true), new MeshStandardMaterial({ color: 0x3b4450, metalness: 0.9, roughness: 0.35, envMap }));
    this.spinner.add(band);

    const domeMat = new MeshStandardMaterial({
      color: 0x7dffc8,
      emissive: 0x1d8f6a,
      emissiveIntensity: 0.9,
      metalness: 0.1,
      roughness: 0.08,
      transparent: true,
      opacity: 0.78,
      envMap,
      envMapIntensity: 2,
    });
    this.dome = new Mesh(new SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    this.dome.position.y = 0.2;
    this.body.add(this.dome);

    // chasing rim lights (one draw call, animated in shader)
    const lightGeos: BufferGeometry[] = [];
    const N = 16;
    for (let i = 0; i < N; i++) {
      const g = new SphereGeometry(0.055, 8, 6);
      const a = (i / N) * Math.PI * 2;
      g.translate(Math.cos(a) * 0.99, 0.0, Math.sin(a) * 0.99);
      const idx = new Float32Array(g.getAttribute('position').count).fill(i / N);
      g.setAttribute('aIndex', new BufferAttribute(idx, 1));
      lightGeos.push(g);
    }
    this.lightsMat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new Color(0x5dffa0) }, uEnergy: { value: 0 }, uCount: { value: 3 } },
      vertexShader: /* glsl */ `
        attribute float aIndex;
        varying float vI;
        void main(){ vI = aIndex; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uColor; uniform float uEnergy; uniform float uCount;
        varying float vI;
        void main(){
          float chase = fract(vI * uCount - uTime * (0.6 + uEnergy * 1.8));
          float b = 0.35 + pow(1.0 - chase, 6.0) * (2.2 + uEnergy * 3.0);
          gl_FragColor = vec4(uColor * b, 1.0);
        }`,
    });
    const lights = new Mesh(mergeGeometries(lightGeos), this.lightsMat);
    this.spinner.add(lights);

    // beam hatch under the ship
    this.hatchMat = new MeshBasicMaterial({ color: 0x9dffc0, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false });
    const hatch = new Mesh(new CircleGeometry(0.3, 32), this.hatchMat);
    hatch.rotation.x = Math.PI / 2;
    hatch.position.y = -0.345;
    this.body.add(hatch);

    // lvl 10: outer spinning ring
    const ringMat = new MeshStandardMaterial({ color: 0x8994a3, metalness: 0.85, roughness: 0.3, envMap, emissive: 0x0d3b2a, emissiveIntensity: 0.6 });
    this.ring1 = new Mesh(new TorusGeometry(1.35, 0.055, 8, 64), ringMat);
    this.ring1.rotation.x = Math.PI / 2;
    this.addStage(10, this.ring1);

    // lvl 15: energy core
    const coreMat = new MeshBasicMaterial({ color: 0x9dffd0, blending: AdditiveBlending, transparent: true, depthWrite: false });
    this.core = new Mesh(new SphereGeometry(0.2, 16, 12), coreMat);
    this.core.position.y = 0.32;
    this.addStage(15, this.core);

    // lvl 20: second gravity ring (tilted, counter-rotating)
    this.ring2 = new Mesh(new TorusGeometry(1.62, 0.045, 8, 64), ringMat);
    this.addStage(20, this.ring2);

    // lvl 25: massive fins
    const finMat = new MeshStandardMaterial({ color: 0x5b6573, metalness: 0.85, roughness: 0.3, envMap });
    for (let i = 0; i < 6; i++) {
      const fin = new Mesh(new CylinderGeometry(0.02, 0.09, 0.9, 4), finMat);
      const a = (i / 6) * Math.PI * 2;
      fin.position.set(Math.cos(a) * 0.9, -0.22, Math.sin(a) * 0.9);
      fin.rotation.z = Math.cos(a) * 0.9;
      fin.rotation.x = -Math.sin(a) * 0.9;
      this.fins.add(fin);
    }
    this.addStage(25, this.fins);

    // lvl 30: particle halo
    const haloGeo = new BufferGeometry();
    const HN = 160;
    const hp = new Float32Array(HN * 3);
    for (let i = 0; i < HN; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.9 + Math.random() * 0.6;
      hp[i * 3] = Math.cos(a) * r;
      hp[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
      hp[i * 3 + 2] = Math.sin(a) * r;
    }
    haloGeo.setAttribute('position', new BufferAttribute(hp, 3));
    const haloMat = new ShaderMaterial({
      uniforms: { uColor: { value: this.accentColor } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: `void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = 90.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; void main(){ vec2 c = gl_PointCoord - 0.5; float a = 1.0 - smoothstep(0.0, 0.5, length(c)); gl_FragColor = vec4(uColor * a * 1.5, a); }`,
    });
    this.halo = new Points(haloGeo, haloMat);
    this.addStage(30, this.halo as unknown as Mesh);

    const underglow = new Mesh(
      new CircleGeometry(1.1, 32),
      new MeshBasicMaterial({ color: 0x3dff9a, transparent: true, opacity: 0.18, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
    );
    underglow.rotation.x = Math.PI / 2;
    underglow.position.y = -0.36;
    this.body.add(underglow);
  }

  private addStage(level: number, obj: Group | Mesh): void {
    obj.visible = false;
    obj.scale.setScalar(0.001);
    this.body.add(obj);
    this.stages.push({ level, obj, reveal: 0 });
  }

  setAccent(hex: number): void {
    this.targetAccent.setHex(hex);
  }

  /** Returns true if a new stage became visible this call (for fanfare). */
  setLevel(level: number): boolean {
    let revealed = false;
    for (const s of this.stages) {
      if (level >= s.level && !s.obj.visible) {
        s.obj.visible = true;
        revealed = true;
      }
    }
    this.lightsMat.uniforms.uCount!.value = level >= 5 ? 4 : 2;
    return revealed;
  }

  update(dt: number, beamLoad: number): void {
    this.time += dt;
    this.accentColor.lerp(this.targetAccent, 1 - Math.exp(-4 * dt));
    this.energy = damp(this.energy, beamLoad, 4, dt);
    const u = this.lightsMat.uniforms;
    u.uTime!.value = this.time;
    (u.uColor!.value as Color).copy(this.accentColor);
    u.uEnergy!.value = this.energy;
    this.hatchMat.color.copy(this.accentColor).multiplyScalar(1.2 + this.energy * 1.6 + Math.sin(this.time * 9) * 0.2);

    this.spinner.rotation.y += dt * (0.6 + this.energy * 2.4);
    this.ring1.rotation.z += dt * (1.2 + this.energy * 3);
    this.ring2.rotation.y += dt * -0.9;
    this.ring2.rotation.x = 1.2 + Math.sin(this.time * 0.7) * 0.25;
    this.fins.rotation.y -= dt * 0.4;
    this.halo.rotation.y += dt * 0.5;
    const coreS = 1 + Math.sin(this.time * 5) * 0.12 + this.energy * 0.4;
    for (const s of this.stages) {
      if (!s.obj.visible) continue;
      s.reveal = Math.min(1, s.reveal + dt * 1.8);
      const e = 1 + Math.sin(Math.min(1, s.reveal) * Math.PI) * 0.35;
      const sc = s.reveal * e * (s.obj === this.core ? coreS : 1);
      s.obj.scale.setScalar(Math.max(0.001, sc));
    }
    (this.core.material as MeshBasicMaterial).color.copy(this.accentColor).multiplyScalar(2.2 + this.energy * 2);

    const dome = this.dome.material as MeshStandardMaterial;
    dome.emissive.copy(this.accentColor).multiplyScalar(0.35 + this.energy * 0.5);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 4);
    this.hullMat.emissive.setRGB(this.damageFlash * 1.5, this.damageFlash * 0.2, this.damageFlash * 0.1);
  }
}
