import { h, onTap } from './dom';

export interface DebugStats {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  objects: number;
  dynamic: number;
  npcs: number;
  enemies: number;
  bullets: number;
  missiles: number;
  particles: number;
  threat: number;
  alert: number;
  tier: number;
  beamTier: number;
  level: number;
  capacity: number;
  beamRadius: number;
  scale: number;
  quality: string;
  renderScale: number;
  multiDraw: boolean;
  time: number;
}

/** ?debug=1 — stats and cheats for development. */
export class DebugPanel {
  readonly root: HTMLDivElement;
  private readonly stats: HTMLPreElement;
  private readonly btns: HTMLDivElement;
  private collapsed = false;
  private timer = 0;

  constructor(parent: HTMLElement, cheats: Record<string, () => void>) {
    this.root = h('div', 'debug panel interactive');
    const head = h('div', '', 'DEBUG');
    const col = h('button', 'collapse', '–');
    onTap(col, () => {
      this.collapsed = !this.collapsed;
      this.stats.style.display = this.collapsed ? 'none' : '';
      this.btns.style.display = this.collapsed ? 'none' : '';
    });
    head.appendChild(col);
    this.stats = h('pre', '');
    this.stats.style.margin = '4px 0';
    this.stats.style.whiteSpace = 'pre-wrap';
    this.btns = h('div', 'btns');
    for (const [name, fn] of Object.entries(cheats)) {
      const b = h('button', '', name);
      onTap(b, fn);
      this.btns.appendChild(b);
    }
    this.root.append(head, this.stats, this.btns);
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    parent.appendChild(this.root);
  }

  update(dt: number, s: DebugStats): void {
    this.timer -= dt;
    if (this.timer > 0 || this.collapsed) return;
    this.timer = 0.25;
    this.stats.textContent =
      `FPS ${s.fps.toFixed(0)} (${s.frameMs.toFixed(1)}ms)\n` +
      `draw ${s.drawCalls}  tris ${(s.triangles / 1000).toFixed(0)}k\n` +
      `geo ${s.geometries}  tex ${s.textures}\n` +
      `quality ${s.quality} x${s.renderScale.toFixed(2)} md:${s.multiDraw ? 'y' : 'n'}\n` +
      `objects ${s.objects}  dyn ${s.dynamic}  npc ${s.npcs}\n` +
      `enemies ${s.enemies}  bul ${s.bullets}  mis ${s.missiles}\n` +
      `particles ${s.particles}\n` +
      `threat ${s.threat.toFixed(1)}  alert ${s.alert}\n` +
      `tier ${s.tier.toFixed(2)}  beam ${s.beamTier.toFixed(2)}\n` +
      `lvl ${s.level}  cap ${s.capacity}  R ${s.beamRadius.toFixed(1)}\n` +
      `scale ${s.scale.toFixed(2)}  t ${s.time.toFixed(0)}s`;
  }
}
