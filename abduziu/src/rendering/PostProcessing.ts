import {
  BufferGeometry,
  Camera,
  Color,
  Float32BufferAttribute,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';

const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const BRIGHT_FRAG = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 texel;
uniform float threshold;
varying vec2 vUv;
void main() {
  // 4-tap box downsample with soft threshold (keeps bloom stable, no fireflies)
  vec3 c = texture2D(tInput, vUv + texel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tInput, vUv + texel * vec2(1.0, -1.0)).rgb;
  c += texture2D(tInput, vUv + texel * vec2(-1.0, 1.0)).rgb;
  c += texture2D(tInput, vUv + texel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  float l = max(max(c.r, c.g), c.b);
  float soft = clamp(l - threshold + 0.5, 0.0, 1.0);
  soft = soft * soft * 0.5;
  float contrib = max(soft, l - threshold) / max(l, 1e-4);
  gl_FragColor = vec4(min(c * contrib, vec3(24.0)), 1.0);
}`;

const DOWN_FRAG = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tInput, vUv).rgb * 4.0;
  c += texture2D(tInput, vUv + texel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tInput, vUv + texel * vec2(1.0, -1.0)).rgb;
  c += texture2D(tInput, vUv + texel * vec2(-1.0, 1.0)).rgb;
  c += texture2D(tInput, vUv + texel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}`;

const BLUR_FRAG = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 dir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tInput, vUv).rgb * 0.227027;
  c += texture2D(tInput, vUv + dir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tInput, vUv - dir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tInput, vUv + dir * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(tInput, vUv - dir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;

const UP_FRAG = /* glsl */ `
uniform sampler2D tInput;
uniform sampler2D tBase;
uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tInput, vUv + texel * vec2(-1.0, 0.0)).rgb;
  c += texture2D(tInput, vUv + texel * vec2(1.0, 0.0)).rgb;
  c += texture2D(tInput, vUv + texel * vec2(0.0, -1.0)).rgb;
  c += texture2D(tInput, vUv + texel * vec2(0.0, 1.0)).rgb;
  gl_FragColor = vec4(texture2D(tBase, vUv).rgb + c * 0.25, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float bloomStrength;
uniform float exposure;
uniform float saturation;
uniform float contrast;
uniform vec3 tint;
uniform vec3 shadowTint;
uniform float vignette;
uniform float chroma;
uniform float flash;
uniform vec3 flashColor;
uniform float damage;
uniform float time;
uniform float grain;
uniform vec2 resolution;
varying vec2 vUv;

vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 ACESFilmic(vec3 color) {
  const mat3 ACESInputMat = mat3(
    vec3(0.59719, 0.07600, 0.02840),
    vec3(0.35458, 0.90834, 0.13383),
    vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(
    vec3(1.60475, -0.10208, -0.00327),
    vec3(-0.53108, 1.10813, -0.07276),
    vec3(-0.07367, -0.00605, 1.07602));
  color *= exposure / 0.6;
  color = ACESInputMat * color;
  color = RRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 uv = vUv;
  vec2 fromCenter = uv - 0.5;
  vec3 col;
  if (chroma > 0.0005) {
    vec2 off = fromCenter * chroma;
    col.r = texture2D(tScene, uv + off).r;
    col.g = texture2D(tScene, uv).g;
    col.b = texture2D(tScene, uv - off).b;
  } else {
    col = texture2D(tScene, uv).rgb;
  }
  col += texture2D(tBloom, uv).rgb * bloomStrength;
  col = ACESFilmic(col);

  // grading: split tint + saturation + contrast (all cheap, all in display space)
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col * shadowTint, col * tint, smoothstep(0.0, 0.7, l));
  col = mix(vec3(l), col, saturation);
  col = (col - 0.5) * contrast + 0.5;

  float v = smoothstep(0.85, 0.2, length(fromCenter * vec2(resolution.x / resolution.y, 1.0) * 0.9));
  col *= mix(1.0 - vignette, 1.0, v);
  col = mix(col, vec3(0.75, 0.04, 0.05), damage * (1.0 - v) * 0.85);
  col = mix(col, flashColor, flash);
  col = clamp(col, 0.0, 1.0);
  col = toSRGB(col);
  col += (hash(uv * resolution + time) - 0.5) * grain;
  gl_FragColor = vec4(col, 1.0);
}`;

export interface GradeSettings {
  exposure: number;
  saturation: number;
  contrast: number;
  tint: Color;
  shadowTint: Color;
  vignette: number;
  bloomStrength: number;
  bloomThreshold: number;
}

/**
 * Lightweight custom post stack for mobile: HDR scene target → soft-threshold bloom at
 * 1/4 & 1/8 resolution → single composite pass (tone map, grade, vignette, event FX).
 */
export class PostProcessing {
  enabled = true;
  bloomEnabled = true;
  msaa = 4;
  readonly grade: GradeSettings = {
    exposure: 1.0,
    saturation: 1.12,
    contrast: 1.04,
    tint: new Color(1.02, 1.0, 0.96),
    shadowTint: new Color(0.92, 0.98, 1.06),
    vignette: 0.22,
    bloomStrength: 0.55,
    bloomThreshold: 1.05,
  };
  /** Transient event FX (decay automatically). */
  chroma = 0;
  flash = 0;
  readonly flashColor = new Color(1, 1, 1);
  damage = 0;
  reduceFlashes = false;

  private sceneRT: WebGLRenderTarget;
  private readonly rtQuarter: WebGLRenderTarget;
  private readonly rtEighthA: WebGLRenderTarget;
  private readonly rtEighthB: WebGLRenderTarget;
  private readonly rtBloom: WebGLRenderTarget;
  private readonly quad: Mesh;
  private readonly quadScene = new Scene();
  private readonly quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly brightMat: ShaderMaterial;
  private readonly downMat: ShaderMaterial;
  private readonly blurMat: ShaderMaterial;
  private readonly upMat: ShaderMaterial;
  private readonly compositeMat: ShaderMaterial;
  private width = 1;
  private height = 1;
  private readonly hdrType;

  constructor(
    private readonly renderer: WebGLRenderer,
    supportsHalfFloat: boolean,
  ) {
    this.hdrType = supportsHalfFloat ? HalfFloatType : UnsignedByteType;
    if (!supportsHalfFloat) this.enabled = false;
    const rtOpts = { type: this.hdrType, format: RGBAFormat, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false };
    this.sceneRT = new WebGLRenderTarget(1, 1, { ...rtOpts, depthBuffer: true, samples: this.msaa });
    this.rtQuarter = new WebGLRenderTarget(1, 1, rtOpts);
    this.rtEighthA = new WebGLRenderTarget(1, 1, rtOpts);
    this.rtEighthB = new WebGLRenderTarget(1, 1, rtOpts);
    this.rtBloom = new WebGLRenderTarget(1, 1, rtOpts);

    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const mk = (frag: string, uniforms: Record<string, { value: unknown }>) =>
      new ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });

    this.brightMat = mk(BRIGHT_FRAG, { tInput: { value: null }, texel: { value: new Vector2() }, threshold: { value: 1 } });
    this.downMat = mk(DOWN_FRAG, { tInput: { value: null }, texel: { value: new Vector2() } });
    this.blurMat = mk(BLUR_FRAG, { tInput: { value: null }, dir: { value: new Vector2() } });
    this.upMat = mk(UP_FRAG, { tInput: { value: null }, tBase: { value: null }, texel: { value: new Vector2() } });
    this.compositeMat = mk(COMPOSITE_FRAG, {
      tScene: { value: null },
      tBloom: { value: null },
      bloomStrength: { value: 0.5 },
      exposure: { value: 1 },
      saturation: { value: 1 },
      contrast: { value: 1 },
      tint: { value: new Color() },
      shadowTint: { value: new Color() },
      vignette: { value: 0.2 },
      chroma: { value: 0 },
      flash: { value: 0 },
      flashColor: { value: new Color(1, 1, 1) },
      damage: { value: 0 },
      time: { value: 0 },
      grain: { value: 0.018 },
      resolution: { value: new Vector2(1, 1) },
    });
    this.quad = new Mesh(geo, this.compositeMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  setMsaa(samples: number): void {
    if (samples === this.msaa) return;
    this.msaa = samples;
    this.sceneRT.dispose();
    this.sceneRT = new WebGLRenderTarget(this.width, this.height, {
      type: this.hdrType,
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: true,
      samples,
    });
  }

  setSize(cssW: number, cssH: number, pixelRatio: number): void {
    const w = Math.max(1, Math.floor(cssW * pixelRatio));
    const h = Math.max(1, Math.floor(cssH * pixelRatio));
    this.width = w;
    this.height = h;
    this.sceneRT.setSize(w, h);
    this.rtQuarter.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
    this.rtEighthA.setSize(Math.max(1, w >> 3), Math.max(1, h >> 3));
    this.rtEighthB.setSize(Math.max(1, w >> 3), Math.max(1, h >> 3));
    this.rtBloom.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
    (this.compositeMat.uniforms.resolution!.value as Vector2).set(w, h);
  }

  flashScreen(amount: number, color = 0xffffff): void {
    const a = this.reduceFlashes ? amount * 0.25 : amount;
    this.flash = Math.max(this.flash, a);
    this.flashColor.setHex(color);
  }

  pulseChroma(amount: number): void {
    this.chroma = Math.max(this.chroma, this.reduceFlashes ? amount * 0.3 : amount);
  }

  update(realDt: number): void {
    this.flash = Math.max(0, this.flash - realDt * 2.6);
    this.chroma = Math.max(0, this.chroma - realDt * 0.05);
    this.damage = Math.max(0, this.damage - realDt * 1.6);
  }

  private pass(mat: ShaderMaterial, target: WebGLRenderTarget | null): void {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  /**
   * Geometry drawn into the frame before the main scene (arena wrap copies). Drawn first
   * so the main scene's transparent effects (beam, particles) stay on top of it.
   */
  prePass: (() => void) | null = null;

  private renderScene(scene: Scene, camera: Camera): void {
    const r = this.renderer;
    if (!this.prePass) {
      r.render(scene, camera);
      return;
    }
    r.clear();
    this.prePass();
    r.autoClear = false;
    r.render(scene, camera);
    r.autoClear = true;
  }

  render(scene: Scene, camera: Camera, time: number): void {
    const r = this.renderer;
    if (!this.enabled) {
      r.setRenderTarget(null);
      this.renderScene(scene, camera);
      return;
    }
    r.setRenderTarget(this.sceneRT);
    this.renderScene(scene, camera);

    const g = this.grade;
    if (this.bloomEnabled) {
      const b = this.brightMat.uniforms;
      b.tInput!.value = this.sceneRT.texture;
      (b.texel!.value as Vector2).set(1 / this.width, 1 / this.height);
      b.threshold!.value = g.bloomThreshold;
      this.pass(this.brightMat, this.rtQuarter);

      const d = this.downMat.uniforms;
      d.tInput!.value = this.rtQuarter.texture;
      (d.texel!.value as Vector2).set(1 / this.rtQuarter.width, 1 / this.rtQuarter.height);
      this.pass(this.downMat, this.rtEighthA);

      const bl = this.blurMat.uniforms;
      bl.tInput!.value = this.rtEighthA.texture;
      (bl.dir!.value as Vector2).set(1 / this.rtEighthA.width, 0);
      this.pass(this.blurMat, this.rtEighthB);
      bl.tInput!.value = this.rtEighthB.texture;
      (bl.dir!.value as Vector2).set(0, 1 / this.rtEighthA.height);
      this.pass(this.blurMat, this.rtEighthA);

      // upsample 1/8 onto 1/4 for a wider, smoother halo
      const u = this.upMat.uniforms;
      u.tInput!.value = this.rtEighthA.texture;
      u.tBase!.value = this.rtQuarter.texture;
      (u.texel!.value as Vector2).set(1 / this.rtEighthA.width, 1 / this.rtEighthA.height);
      this.pass(this.upMat, this.rtBloom);
    }

    const c = this.compositeMat.uniforms;
    c.tScene!.value = this.sceneRT.texture;
    c.tBloom!.value = this.rtBloom.texture;
    c.bloomStrength!.value = this.bloomEnabled ? g.bloomStrength : 0;
    c.exposure!.value = g.exposure;
    c.saturation!.value = g.saturation;
    c.contrast!.value = g.contrast;
    (c.tint!.value as Color).copy(g.tint);
    (c.shadowTint!.value as Color).copy(g.shadowTint);
    c.vignette!.value = g.vignette;
    c.chroma!.value = this.chroma;
    c.flash!.value = Math.min(0.85, this.flash);
    (c.flashColor!.value as Color).copy(this.flashColor);
    c.damage!.value = Math.min(1, this.damage);
    c.time!.value = time % 100;
    this.pass(this.compositeMat, null);
  }

  dispose(): void {
    this.sceneRT.dispose();
    this.rtQuarter.dispose();
    this.rtEighthA.dispose();
    this.rtEighthB.dispose();
    this.rtBloom.dispose();
  }
}
