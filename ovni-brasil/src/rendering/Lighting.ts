import { Color, DirectionalLight, FogExp2, HemisphereLight, Object3D, Scene, Vector3 } from 'three';
import { damp } from '../utils/math';
import type { PostProcessing } from './PostProcessing';
import type { Sky } from './Sky';

interface Mood {
  sun: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  fog: number;
  skyTop: number;
  skyHorizon: number;
  tint: [number, number, number];
  shadowTint: [number, number, number];
  saturation: number;
  exposure: number;
}

/** COLOR SCRIPT: calm (blue/cyan/green) → orange → red; frenzy violet; extraction white. */
const MOODS: Record<'calm' | 'orange' | 'red' | 'redsky' | 'frenzy' | 'extraction', Mood> = {
  calm: {
    sun: 0xfff0d2,
    sunIntensity: 2.7,
    hemiSky: 0xbfe2ff,
    hemiGround: 0x8a7a55,
    hemiIntensity: 1.25,
    fog: 0xbfdcee,
    skyTop: 0x2d7fd8,
    skyHorizon: 0xc4e6fb,
    tint: [1.03, 1.0, 0.95],
    shadowTint: [0.9, 0.98, 1.08],
    saturation: 1.14,
    exposure: 1.0,
  },
  orange: {
    sun: 0xffc78a,
    sunIntensity: 2.6,
    hemiSky: 0xffd1a8,
    hemiGround: 0x8a6a45,
    hemiIntensity: 1.1,
    fog: 0xf0c49a,
    skyTop: 0x4b6fb8,
    skyHorizon: 0xffc58f,
    tint: [1.08, 0.98, 0.88],
    shadowTint: [0.95, 0.92, 1.05],
    saturation: 1.12,
    exposure: 1.0,
  },
  red: {
    sun: 0xff9a7a,
    sunIntensity: 2.4,
    hemiSky: 0xff9d8a,
    hemiGround: 0x6a3b35,
    hemiIntensity: 1.0,
    fog: 0xd9867a,
    skyTop: 0x5b2c5f,
    skyHorizon: 0xff8a6a,
    tint: [1.12, 0.92, 0.88],
    shadowTint: [1.0, 0.86, 0.95],
    saturation: 1.1,
    exposure: 0.98,
  },
  redsky: {
    sun: 0xff6a5a,
    sunIntensity: 2.2,
    hemiSky: 0xff6b62,
    hemiGround: 0x4a1f2a,
    hemiIntensity: 0.95,
    fog: 0xb04a4a,
    skyTop: 0x3a0f2e,
    skyHorizon: 0xff4d4d,
    tint: [1.16, 0.88, 0.86],
    shadowTint: [1.05, 0.8, 0.92],
    saturation: 1.12,
    exposure: 0.96,
  },
  frenzy: {
    sun: 0xe6c8ff,
    sunIntensity: 2.6,
    hemiSky: 0xc9a8ff,
    hemiGround: 0x3a5a6a,
    hemiIntensity: 1.3,
    fog: 0xb8a4f0,
    skyTop: 0x3b1f8f,
    skyHorizon: 0x9fe8ff,
    tint: [1.02, 0.98, 1.12],
    shadowTint: [0.92, 1.05, 1.12],
    saturation: 1.25,
    exposure: 1.04,
  },
  extraction: {
    sun: 0xffffff,
    sunIntensity: 3.2,
    hemiSky: 0xffffff,
    hemiGround: 0x9fd6c0,
    hemiIntensity: 1.6,
    fog: 0xeafff6,
    skyTop: 0x9ad8ff,
    skyHorizon: 0xffffff,
    tint: [1.05, 1.05, 1.05],
    shadowTint: [0.95, 1.05, 1.02],
    saturation: 1.0,
    exposure: 1.1,
  },
};

const _a = new Color();
const _b = new Color();

export class Lighting {
  readonly sun: DirectionalLight;
  readonly hemi: HemisphereLight;
  readonly fog: FogExp2;
  private readonly sunTarget = new Object3D();
  private readonly sunOffset = new Vector3(-70, 110, 48);
  shadowExtent = 60;
  /** Blend weights (0..1) for moods, animated. */
  private alertBlend = 0;
  private frenzyBlend = 0;
  private extractBlend = 0;
  private flicker = 0;

  constructor(
    scene: Scene,
    private readonly sky: Sky,
    private readonly post: PostProcessing,
  ) {
    this.hemi = new HemisphereLight(MOODS.calm.hemiSky, MOODS.calm.hemiGround, MOODS.calm.hemiIntensity);
    this.sun = new DirectionalLight(MOODS.calm.sun, MOODS.calm.sunIntensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 420;
    this.sun.target = this.sunTarget;
    this.fog = new FogExp2(MOODS.calm.fog, 0.0028);
    scene.fog = this.fog;
    scene.add(this.hemi, this.sun, this.sunTarget);
    sky.uniforms.uSunDir.value.copy(this.sunOffset).normalize();
  }

  setShadowQuality(enabled: boolean, mapSize: number): void {
    this.sun.castShadow = enabled;
    if (this.sun.shadow.mapSize.x !== mapSize) {
      this.sun.shadow.mapSize.set(mapSize, mapSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  /** Emulates city lights/sun dimming (EMP). */
  pulseFlicker(amount: number): void {
    this.flicker = Math.max(this.flicker, amount);
  }

  update(dt: number, focus: Vector3, cameraDistance: number, alert: number, frenzy: boolean, extraction: boolean): void {
    // shadow frustum follows the action, snapped to texels to avoid shimmering
    const ext = Math.max(40, Math.min(220, cameraDistance * 1.35));
    if (Math.abs(ext - this.shadowExtent) > 4) {
      this.shadowExtent = ext;
      const cam = this.sun.shadow.camera;
      cam.left = -ext;
      cam.right = ext;
      cam.top = ext;
      cam.bottom = -ext;
      cam.updateProjectionMatrix();
    }
    const texel = (this.shadowExtent * 2) / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / texel) * texel;
    const fz = Math.round(focus.z / texel) * texel;
    this.sunTarget.position.set(fx, 0, fz);
    this.sun.position.set(fx + this.sunOffset.x, this.sunOffset.y, fz + this.sunOffset.z);

    const alertTarget = alert <= 2 ? 0 : alert <= 3 ? 0.5 : alert <= 5 ? 1 : 1.5;
    this.alertBlend = damp(this.alertBlend, alertTarget, 1.2, dt);
    this.frenzyBlend = damp(this.frenzyBlend, frenzy ? 1 : 0, frenzy ? 5 : 2, dt);
    this.extractBlend = damp(this.extractBlend, extraction ? 1 : 0, 2.5, dt);
    this.flicker = Math.max(0, this.flicker - dt * 1.8);

    // base mood from alert (calm→orange→red→redsky)
    const a = this.alertBlend;
    const [m0, m1, t] = a < 0.5 ? [MOODS.calm, MOODS.orange, a / 0.5] : a < 1 ? [MOODS.orange, MOODS.red, (a - 0.5) / 0.5] : [MOODS.red, MOODS.redsky, Math.min(1, (a - 1) / 0.5)];
    const mix = (key: 'sun' | 'hemiSky' | 'hemiGround' | 'fog' | 'skyTop' | 'skyHorizon', out: Color) => {
      out.setHex(m0[key]).lerp(_b.setHex(m1[key]), t);
      if (this.frenzyBlend > 0.001) out.lerp(_b.setHex(MOODS.frenzy[key]), this.frenzyBlend);
      if (this.extractBlend > 0.001) out.lerp(_b.setHex(MOODS.extraction[key]), this.extractBlend);
      return out;
    };
    const num = (key: 'sunIntensity' | 'hemiIntensity' | 'saturation' | 'exposure') => {
      let v = m0[key] + (m1[key] - m0[key]) * t;
      v += (MOODS.frenzy[key] - v) * this.frenzyBlend;
      v += (MOODS.extraction[key] - v) * this.extractBlend;
      return v;
    };
    mix('sun', this.sun.color);
    this.sun.intensity = num('sunIntensity') * (1 - this.flicker * 0.55);
    mix('hemiSky', this.hemi.color);
    mix('hemiGround', this.hemi.groundColor);
    this.hemi.intensity = num('hemiIntensity') * (1 - this.flicker * 0.3);
    mix('fog', this.fog.color);
    mix('skyTop', this.sky.uniforms.uTop.value);
    mix('skyHorizon', this.sky.uniforms.uHorizon.value);
    this.sky.uniforms.uBottom.value.copy(this.fog.color);
    this.sky.uniforms.uSunColor.value.copy(this.sun.color);
    // fog thins as the camera pulls back so a giant UFO still sees the skyline
    const density = 0.0036 / Math.pow(Math.max(1, cameraDistance / 18), 0.62);
    this.fog.density = damp(this.fog.density, density, 2, dt);

    const g = this.post.grade;
    const tintMix = (arrKey: 'tint' | 'shadowTint', out: Color) => {
      const x0 = m0[arrKey];
      const x1 = m1[arrKey];
      out.setRGB(x0[0] + (x1[0] - x0[0]) * t, x0[1] + (x1[1] - x0[1]) * t, x0[2] + (x1[2] - x0[2]) * t);
      const f = MOODS.frenzy[arrKey];
      out.lerp(_a.setRGB(f[0], f[1], f[2]), this.frenzyBlend);
      const e = MOODS.extraction[arrKey];
      out.lerp(_a.setRGB(e[0], e[1], e[2]), this.extractBlend);
    };
    tintMix('tint', g.tint);
    tintMix('shadowTint', g.shadowTint);
    g.saturation = num('saturation');
    g.exposure = num('exposure');
  }
}
