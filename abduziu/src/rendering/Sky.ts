import {
  BackSide,
  Color,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Gradient sky dome with sun glow and painted high clouds. */
export class Sky {
  readonly mesh: Mesh;
  readonly uniforms = {
    uTop: { value: new Color(0x2f7fd6) },
    uHorizon: { value: new Color(0xbfe6ff) },
    uBottom: { value: new Color(0x9cc7a0) },
    uSunDir: { value: new Vector3(-0.5, 0.45, -0.6).normalize() },
    uSunColor: { value: new Color(0xfff1c9) },
    uCloudTex: { value: null as Texture | null },
    uTime: { value: 0 },
    uCloudTint: { value: new Color(1, 1, 1) },
  };

  constructor(noise: Texture) {
    this.uniforms.uCloudTex.value = noise;
    const mat = new ShaderMaterial({
      uniforms: this.uniforms,
      side: BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uBottom;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform sampler2D uCloudTex;
        uniform float uTime;
        uniform vec3 uCloudTint;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.55));
          col = mix(col, uBottom, 1.0 - smoothstep(-0.25, 0.0, h));
          float sun = max(dot(d, normalize(uSunDir)), 0.0);
          col += uSunColor * (pow(sun, 900.0) * 6.0 + pow(sun, 18.0) * 0.35 + pow(sun, 3.0) * 0.08);
          if (h > 0.02) {
            vec2 cuv = d.xz / (h + 0.18) * 0.22 + vec2(uTime * 0.004, uTime * 0.002);
            float c = texture2D(uCloudTex, cuv).r;
            float c2 = texture2D(uCloudTex, cuv * 2.3 + 0.3).r;
            float cloud = smoothstep(0.48, 0.72, c * 0.7 + c2 * 0.3) * smoothstep(0.02, 0.25, h);
            vec3 cloudCol = mix(uHorizon * 1.1, vec3(1.0), 0.6) * uCloudTint + uSunColor * pow(sun, 6.0) * 0.3;
            col = mix(col, cloudCol, cloud * 0.85);
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.mesh = new Mesh(new SphereGeometry(900, 32, 16), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    this.mesh.name = 'sky';
  }

  follow(camPos: Vector3): void {
    this.mesh.position.copy(camPos);
  }
}

/** Low-poly cumulus puffs floating over the city (the intro descends through them). */
export class Clouds {
  readonly group = new Group();
  private readonly mesh: InstancedMesh;
  private readonly data: Array<{ pos: Vector3; scale: Vector3; speed: number; rot: number; fade: number }> = [];
  private readonly tmpScale = new Vector3();
  private readonly seg = new Vector3();
  private readonly rel = new Vector3();
  readonly material: MeshLambertMaterial;

  constructor(count = 22, extent = 520) {
    const parts = [];
    const offsets = [
      [0, 0, 0, 1],
      [1.1, -0.15, 0.2, 0.75],
      [-1.0, -0.2, -0.1, 0.7],
      [0.4, 0.35, -0.4, 0.65],
      [-0.4, 0.2, 0.5, 0.6],
    ];
    for (const [x, y, z, s] of offsets) {
      const g = new IcosahedronGeometry(1, 1);
      g.scale(s as number, (s as number) * 0.72, s as number);
      g.translate(x as number, y as number, z as number);
      parts.push(g);
    }
    const geo = mergeGeometries(parts);
    this.material = new MeshLambertMaterial({ color: 0xffffff, emissive: 0x9fb8d0, emissiveIntensity: 0.35, flatShading: true });
    this.mesh = new InstancedMesh(geo, this.material, count);
    this.mesh.frustumCulled = false;
    let seed = 1;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < count; i++) {
      const s = 14 + rand() * 22;
      this.data.push({
        pos: new Vector3((rand() * 2 - 1) * extent, 95 + rand() * 60, (rand() * 2 - 1) * extent),
        scale: new Vector3(s * (1.4 + rand()), s, s * (1 + rand() * 0.6)),
        speed: 1.5 + rand() * 2,
        rot: rand() * Math.PI,
        fade: 1,
      });
    }
    this.group.add(this.mesh);
    this.update(0);
  }

  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly up = new Vector3(0, 1, 0);

  /**
   * Drifts the clouds. With camera + focus given, clouds that would sit between the
   * camera and the saucer (a giant late-game UFO flies at cloud height) part and shrink.
   */
  update(dt: number, camera?: Vector3, focus?: Vector3, extent = 520): void {
    for (let i = 0; i < this.data.length; i++) {
      const c = this.data[i]!;
      c.pos.x += c.speed * dt;
      if (c.pos.x > extent) c.pos.x = -extent;
      let target = 1;
      if (camera && focus) {
        this.seg.subVectors(focus, camera);
        const len2 = Math.max(1e-6, this.seg.lengthSq());
        this.rel.subVectors(c.pos, camera);
        const t = Math.max(0, Math.min(1, this.rel.dot(this.seg) / len2));
        const d = this.rel.addScaledVector(this.seg, -t).length();
        const r = c.scale.x * 1.6;
        target = Math.max(0, Math.min(1, (d - r * 0.6) / (r * 0.8)));
      }
      c.fade += (target - c.fade) * Math.min(1, dt * 3);
      this.q.setFromAxisAngle(this.up, c.rot);
      this.m.compose(c.pos, this.q, this.tmpScale.copy(c.scale).multiplyScalar(Math.max(0.001, c.fade)));
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
