// Packs the CC0 kit models listed in src/config/kitCatalog.ts into one binary the game
// loads at boot (src/assets/props/props.pack, gzip, imported with ?url so Vite hashes it).
//   node --experimental-strip-types pack.mjs            (needs `npm run fetch` first)
//
// Per model: flat triangles, positions quantized to int16 inside the model's bounds,
// one sRGB color + flags byte per triangle. Colors come from the kit's colormap texture
// (sampled at the triangle's UV centroid) or from the material's base color.
// Models are scaled to the catalog size, centered on X/Z, sitting on y = 0, and turned
// so their long side runs along Z (like the procedural vehicles).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KIT } from '../../src/config/kitCatalog.ts';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '../../src/assets/props/props.pack');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const textures = new Map();

// older kits (no colormap) wrote sRGB values into baseColorFactor instead of linear
const LEGACY_FACTOR_KITS = new Set(['furniture-kit', 'nature-kit', 'space-kit', 'racing-kit']);

const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function texture(tex) {
  if (!tex) return null;
  const key = tex.getURI() + ':' + tex.getImage()?.byteLength;
  if (!textures.has(key)) textures.set(key, PNG.sync.read(Buffer.from(tex.getImage())));
  return textures.get(key);
}

function sample(png, u, v) {
  u -= Math.floor(u);
  v -= Math.floor(v);
  const x = Math.min(png.width - 1, Math.floor(u * png.width));
  const y = Math.min(png.height - 1, Math.floor(v * png.height));
  const i = (y * png.width + x) * 4;
  return [png.data[i] / 255, png.data[i + 1] / 255, png.data[i + 2] / 255];
}

function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}

function xf(m, x, y, z) {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}

/** Triangles of one GLB: [{p: [9 floats], c: [r,g,b linear], e: 0|1}] */
async function trianglesOf(file, off, legacy) {
  const doc = await io.read(file);
  const tris = [];
  const visit = (node, parent) => {
    const m = mul(parent, node.getMatrix());
    const mesh = node.getMesh();
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        if (prim.getMode() !== 4) continue;
        const pos = prim.getAttribute('POSITION');
        const uv = prim.getAttribute('TEXCOORD_0');
        const col = prim.getAttribute('COLOR_0');
        const idx = prim.getIndices();
        const mat = prim.getMaterial();
        const raw = mat ? mat.getBaseColorFactor() : [1, 1, 1, 1];
        const base = legacy ? raw.map((v, j) => (j < 3 ? srgbToLin(v) : v)) : raw;
        const png = mat ? texture(mat.getBaseColorTexture()) : null;
        // KHR_texture_transform (offset / scale) on the color map
        const tt = mat?.getBaseColorTextureInfo()?.getExtension('KHR_texture_transform');
        const uvOff = tt ? tt.getOffset() : [0, 0];
        const uvScale = tt ? tt.getScale() : [1, 1];
        const em = mat ? mat.getEmissiveFactor() : [0, 0, 0];
        const emit = em[0] + em[1] + em[2] > 0.3 ? 1 : 0;
        const n = idx ? idx.getCount() : pos.getCount();
        const a = [0, 0, 0];
        const t = [0, 0];
        for (let i = 0; i < n; i += 3) {
          const p = [];
          let uu = 0;
          let vv = 0;
          const vc = [0, 0, 0];
          for (let k = 0; k < 3; k++) {
            const vi = idx ? idx.getScalar(i + k) : i + k;
            pos.getElement(vi, a);
            p.push(...xf(m, a[0] + off.x, a[1] + off.y, a[2] + off.z));
            if (uv) {
              uv.getElement(vi, t);
              uu += t[0] / 3;
              vv += t[1] / 3;
            }
            if (col) {
              const cc = [1, 1, 1, 1];
              col.getElement(vi, cc);
              vc[0] += cc[0] / 3;
              vc[1] += cc[1] / 3;
              vc[2] += cc[2] / 3;
            }
          }
          let c = [base[0], base[1], base[2]];
          if (png && uv) c = sample(png, uu * uvScale[0] + uvOff[0], vv * uvScale[1] + uvOff[1]).map((s, j) => srgbToLin(s) * c[j]);
          if (col) c = c.map((x, j) => x * vc[j]);
          tris.push({ p, c, e: emit });
        }
      }
    }
    for (const ch of node.listChildren()) visit(ch, m);
  };
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const scene of doc.getRoot().listScenes()) for (const node of scene.listChildren()) visit(node, I);
  return tris;
}

const parts = [];
const header = { v: 1, models: [] };
let bytes = 0;
const warnings = [];
for (const e of KIT) {
  const list = typeof e.src === 'string' ? [{ src: e.src }] : e.src;
  let tris = [];
  for (const part of list) {
    const file = join(here, 'source', part.src + '.glb');
    tris = tris.concat(await trianglesOf(file, { x: part.x ?? 0, y: part.y ?? 0, z: part.z ?? 0 }, LEGACY_FACTOR_KITS.has(part.src.split('/')[0])));
  }
  if (!tris.length) throw new Error(`${e.id}: no triangles in ${JSON.stringify(e.src)}`);
  // bounds → long side along Z, scale, center, sit on the ground
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  const grow = () => {
    min = [Infinity, Infinity, Infinity];
    max = [-Infinity, -Infinity, -Infinity];
    for (const t of tris) for (let i = 0; i < 9; i++) {
      const k = i % 3;
      if (t.p[i] < min[k]) min[k] = t.p[i];
      if (t.p[i] > max[k]) max[k] = t.p[i];
    }
  };
  grow();
  const turn = ((e.ry ?? 0) * Math.PI) / 180 + (max[0] - min[0] > (max[2] - min[2]) * 1.15 ? Math.PI / 2 : 0);
  if (turn) {
    const cs = Math.cos(turn);
    const sn = Math.sin(turn);
    for (const t of tris) for (let i = 0; i < 9; i += 3) {
      const x = t.p[i];
      const z = t.p[i + 2];
      t.p[i] = x * cs + z * sn;
      t.p[i + 2] = -x * sn + z * cs;
    }
    grow();
  }
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const scale = e.h ? e.h / size[1] : e.s / Math.max(...size);
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[2] + max[2]) / 2;
  for (const t of tris) for (let i = 0; i < 9; i += 3) {
    t.p[i] = (t.p[i] - cx) * scale;
    t.p[i + 1] = (t.p[i + 1] - min[1]) * scale;
    t.p[i + 2] = (t.p[i + 2] - cz) * scale;
  }
  const bmin = [-(size[0] * scale) / 2, 0, -(size[2] * scale) / 2];
  const bsize = [size[0] * scale, size[1] * scale, size[2] * scale];
  // pack: int16 xyz × 3 per triangle, then rgb + flags per triangle
  const n = tris.length;
  const pos = new Int16Array(n * 9);
  const col = new Uint8Array(n * 4);
  tris.forEach((t, i) => {
    for (let j = 0; j < 9; j++) {
      const k = j % 3;
      const q = bsize[k] > 0 ? (t.p[j] - bmin[k]) / bsize[k] : 0.5;
      pos[i * 9 + j] = Math.round(Math.min(1, Math.max(0, q)) * 65535) - 32768;
    }
    for (let k = 0; k < 3; k++) col[i * 4 + k] = Math.round(Math.min(1, Math.max(0, linToSrgb(t.c[k]))) * 255);
    col[i * 4 + 3] = t.e;
  });
  header.models.push({ id: e.id, n, off: bytes, min: bmin.map((v) => +v.toFixed(4)), size: bsize.map((v) => +v.toFixed(4)) });
  parts.push(Buffer.from(pos.buffer), Buffer.from(col.buffer));
  bytes += pos.byteLength + col.byteLength;
  if (n > 4000) warnings.push(`${e.id}: ${n} triangles`);
}
const json = Buffer.from(JSON.stringify(header));
const pad = (4 - ((json.length + 4) % 4)) % 4;
const head = Buffer.alloc(4);
head.writeUInt32LE(json.length + pad);
mkdirSync(dirname(OUT), { recursive: true });
const raw = Buffer.concat([head, json, Buffer.alloc(pad, 32), ...parts]);
const gz = gzipSync(raw, { level: 9 });
writeFileSync(OUT, gz);
const total = header.models.reduce((s, m) => s + m.n, 0);
console.log(`${header.models.length} models, ${total} triangles, ${(raw.length / 1024).toFixed(0)} KB raw, ${(gz.length / 1024).toFixed(0)} KB gzip → ${OUT}`);
for (const w of warnings) console.log('  heavy:', w);
