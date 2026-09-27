import { ACESFilmicToneMapping, NoToneMapping, PCFShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';

export interface RendererCallbacks {
  onContextLost: () => void;
  onContextRestored: () => void;
}

/** Thin wrapper over WebGLRenderer: DPR clamping, render scale, resize and context loss. */
export class Renderer {
  readonly gl: WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  width = 1;
  height = 1;
  /** Device pixel ratio cap set by the quality manager. */
  maxDpr = 2;
  /** Fraction of the capped DPR actually rendered (adaptive). */
  renderScale = 1;
  readonly supportsMultiDraw: boolean;
  readonly supportsHalfFloatRT: boolean;
  /** Software rasterizer (no GPU): forces the lightest quality. */
  readonly isSoftware: boolean;
  readonly gpuName: string;
  contextLost = false;
  private readonly resizeListeners: Array<(w: number, h: number) => void> = [];

  constructor(container: HTMLElement, callbacks: RendererCallbacks) {
    this.gl = new WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
      alpha: false,
      preserveDrawingBuffer: false,
    });
    this.canvas = this.gl.domElement;
    this.canvas.id = 'game-canvas';
    container.appendChild(this.canvas);

    this.gl.outputColorSpace = SRGBColorSpace;
    this.gl.toneMapping = ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.0;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = PCFShadowMap;
    this.gl.shadowMap.autoUpdate = true;
    this.gl.info.autoReset = false;

    const ext = this.gl.extensions;
    this.supportsMultiDraw = ext.has('WEBGL_multi_draw');
    this.supportsHalfFloatRT = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');
    let gpu = '';
    try {
      const ctx = this.gl.getContext();
      const dbg = ctx.getExtension('WEBGL_debug_renderer_info');
      gpu = dbg ? String(ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    } catch {
      gpu = '';
    }
    this.gpuName = gpu;
    this.isSoftware = /swiftshader|llvmpipe|software/i.test(gpu);

    this.canvas.addEventListener(
      'webglcontextlost',
      (e) => {
        e.preventDefault();
        this.contextLost = true;
        callbacks.onContextLost();
      },
      false,
    );
    this.canvas.addEventListener(
      'webglcontextrestored',
      () => {
        this.contextLost = false;
        callbacks.onContextRestored();
      },
      false,
    );

    const onResize = () => this.resize();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 120));
    this.resize();
  }

  onResize(fn: (w: number, h: number) => void): void {
    this.resizeListeners.push(fn);
  }

  get pixelRatio(): number {
    return Math.min(window.devicePixelRatio || 1, this.maxDpr) * this.renderScale;
  }

  setPostProcessingEnabled(enabled: boolean): void {
    // When post is on, tone mapping happens in the composite pass instead.
    this.gl.toneMapping = enabled ? NoToneMapping : ACESFilmicToneMapping;
  }

  resize(): void {
    const w = Math.max(1, Math.floor(window.innerWidth));
    const h = Math.max(1, Math.floor(window.innerHeight));
    this.width = w;
    this.height = h;
    this.gl.setPixelRatio(this.pixelRatio);
    this.gl.setSize(w, h, true);
    for (const fn of this.resizeListeners) fn(w, h);
  }

  applyPixelRatio(): void {
    this.gl.setPixelRatio(this.pixelRatio);
    this.gl.setSize(this.width, this.height, true);
    for (const fn of this.resizeListeners) fn(this.width, this.height);
  }
}
