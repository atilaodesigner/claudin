import { BufferAttribute, BufferGeometry, Color } from 'three';
import { KIT, KIT_MODEL_PREFIX } from '../config/kitCatalog';
import type { ModelLibrary } from './ModelLibrary';
import packUrl from './props/props.pack?url';

interface PackedModel {
  id: string;
  n: number;
  off: number;
  min: [number, number, number];
  size: [number, number, number];
}

const _c = new Color();

/**
 * Loads the CC0 kit models (see config/kitCatalog.ts and tools/props) and registers
 * them in the library as `kit:<id>`, shaded like the procedural models: vertex colors
 * with the same baked contact AO, white atlas texel, emissive flag per triangle.
 * If the pack can't be loaded every kit model falls back to a plain box, so a city
 * that places one never breaks.
 */
export async function loadPropPack(lib: ModelLibrary): Promise<number> {
  try {
    const buf = await fetchPack();
    return registerPack(lib, buf);
  } catch (err) {
    console.warn('[PropPack] kit models unavailable, using placeholders', err);
    const box = lib.get('box').geometry;
    for (const e of KIT) lib.addPacked(KIT_MODEL_PREFIX + e.id, box);
    return 0;
  }
}

async function fetchPack(): Promise<ArrayBuffer> {
  const res = await fetch(packUrl);
  if (!res.ok) throw new Error(`props pack HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  // gzip on disk; a server may already have decoded it (Content-Encoding)
  const bytes = new Uint8Array(buf, 0, 2);
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return buf;
  if (typeof DecompressionStream === 'undefined') throw new Error('no DecompressionStream');
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

export function registerPack(lib: ModelLibrary, buf: ArrayBuffer): number {
  const view = new DataView(buf);
  const headLen = view.getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, headLen))) as { v: number; models: PackedModel[] };
  const base = 4 + headLen;
  const white = lib.whiteUV;
  const wu = (white.u0 + white.u1) / 2;
  const wv = (white.v0 + white.v1) / 2;
  for (const m of header.models) {
    const q = new Int16Array(buf, base + m.off, m.n * 9);
    const cols = new Uint8Array(buf, base + m.off + m.n * 18, m.n * 4);
    lib.addPacked(KIT_MODEL_PREFIX + m.id, buildGeometry(m, q, cols, wu, wv));
  }
  return header.models.length;
}

function buildGeometry(m: PackedModel, q: Int16Array, cols: Uint8Array, wu: number, wv: number): BufferGeometry {
  const n = m.n;
  const pos = new Float32Array(n * 9);
  for (let i = 0; i < n * 9; i++) {
    const k = i % 3;
    pos[i] = m.min[k] + ((q[i] as number) + 32768) / 65535 * m.size[k];
  }
  const nrm = new Float32Array(n * 9);
  const col = new Float32Array(n * 9);
  const uv = new Float32Array(n * 6);
  const fx = new Float32Array(n * 6);
  // same contact AO as ModelBuilder.build
  const aoH = Math.min(1.1, Math.max(0.12, m.size[1] * 0.45));
  for (let t = 0; t < n; t++) {
    const o = t * 9;
    const ax = pos[o + 3]! - pos[o]!;
    const ay = pos[o + 4]! - pos[o + 1]!;
    const az = pos[o + 5]! - pos[o + 2]!;
    const bx = pos[o + 6]! - pos[o]!;
    const by = pos[o + 7]! - pos[o + 1]!;
    const bz = pos[o + 8]! - pos[o + 2]!;
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    _c.setRGB(cols[t * 4]! / 255, cols[t * 4 + 1]! / 255, cols[t * 4 + 2]! / 255, 'srgb');
    const emit = cols[t * 4 + 3]! ? 1 : 0;
    for (let v = 0; v < 3; v++) {
      const i = o + v * 3;
      nrm[i] = nx;
      nrm[i + 1] = ny;
      nrm[i + 2] = nz;
      let shade = 1;
      if (!emit) {
        const h = Math.min(1, Math.max(0, pos[i + 1]! / aoH));
        shade = 0.58 + 0.42 * (h * h * (3 - 2 * h));
        if (ny < -0.5) shade *= 0.72;
      }
      col[i] = _c.r * shade;
      col[i + 1] = _c.g * shade;
      col[i + 2] = _c.b * shade;
      const j = (t * 3 + v) * 2;
      uv[j] = wu;
      uv[j + 1] = wv;
      fx[j] = 0;
      fx[j + 1] = emit;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nrm, 3));
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setAttribute('aFx', new BufferAttribute(fx, 2));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
