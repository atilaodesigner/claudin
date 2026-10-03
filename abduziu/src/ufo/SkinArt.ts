import {
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  SphereGeometry,
  TorusGeometry,
  BoxGeometry,
  type Material,
} from 'three';
import type { SkinPattern, SkinTopper } from '../config/cosmetics';

/**
 * Art for the personalised skins: hull patterns drawn on a canvas (mapped on the
 * saucer's lathe: x = around the rim, y = from the belly up to the top) and small
 * toppers that sit on the dome.
 */
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Deterministic noise so a pattern looks the same every time. */
function rand(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Pattern canvas (power of two, tiles around the rim). */
export function patternCanvas(pattern: SkinPattern, colors: readonly number[], size = 256): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const [a = 0xffffff, b = 0x000000, d = 0x888888] = colors;
  const S = size;
  const r = rand(pattern.length * 977 + a);
  g.fillStyle = hex(a);
  g.fillRect(0, 0, S, S);
  switch (pattern) {
    case 'stripes': {
      g.fillStyle = hex(b);
      for (let i = 0; i < 16; i += 2) g.fillRect((i / 16) * S, 0, S / 16, S);
      break;
    }
    case 'rings': {
      g.fillStyle = hex(b);
      for (let i = 0; i < 10; i += 2) g.fillRect(0, (i / 10) * S, S, S / 10);
      g.fillStyle = hex(d);
      g.fillRect(0, S * 0.47, S, S * 0.06);
      break;
    }
    case 'checker': {
      const n = 12;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        if ((x + y) % 2) {
          g.fillStyle = hex(b);
          g.fillRect((x / n) * S, (y / n) * S, S / n, S / n);
        }
      }
      // plaid: thin lines on top
      g.fillStyle = hex(d);
      for (let i = 0; i < n; i += 3) {
        g.fillRect((i / n) * S, 0, 2, S);
        g.fillRect(0, (i / n) * S, S, 2);
      }
      break;
    }
    case 'dots':
    case 'sprinkles':
    case 'seeds': {
      const n = pattern === 'dots' ? 70 : 260;
      for (let i = 0; i < n; i++) {
        const x = r() * S;
        const y = r() * S;
        if (pattern === 'dots') {
          g.fillStyle = hex(r() < 0.5 ? b : d);
          g.beginPath();
          g.arc(x, y, S * (0.018 + r() * 0.02), 0, Math.PI * 2);
          g.fill();
        } else if (pattern === 'sprinkles') {
          g.save();
          g.translate(x, y);
          g.rotate(r() * Math.PI);
          g.fillStyle = hex([b, d, 0xffffff, 0xff4fa3, 0x4dc9ff][Math.floor(r() * 5)] as number);
          g.fillRect(-S * 0.012, -S * 0.004, S * 0.024, S * 0.008);
          g.restore();
        } else {
          // watermelon: red flesh on top with black seeds, green rind on the belly
          if (y < S * 0.5) continue;
          g.fillStyle = hex(d);
          g.beginPath();
          g.ellipse(x, y, S * 0.008, S * 0.014, r() * Math.PI, 0, Math.PI * 2);
          g.fill();
        }
      }
      if (pattern === 'seeds') {
        g.fillStyle = hex(b);
        g.fillRect(0, 0, S, S * 0.48);
        g.fillStyle = '#e8ffe0';
        g.fillRect(0, S * 0.46, S, S * 0.04);
        g.fillStyle = hex(0x2f7d32);
        for (let i = 0; i < 16; i += 2) g.fillRect((i / 16) * S, 0, S / 24, S * 0.46);
      }
      break;
    }
    case 'flag_br': {
      // belly green, rim yellow, top blue with a white band and stars
      g.fillStyle = hex(0x1f9d55);
      g.fillRect(0, 0, S, S * 0.45);
      g.fillStyle = hex(0xffd23f);
      g.fillRect(0, S * 0.45, S, S * 0.2);
      g.fillStyle = hex(0x1b3f9e);
      g.fillRect(0, S * 0.65, S, S * 0.35);
      g.fillStyle = '#ffffff';
      g.fillRect(0, S * 0.76, S, S * 0.04);
      for (let i = 0; i < 40; i++) g.fillRect(r() * S, S * (0.82 + r() * 0.16), 2, 2);
      break;
    }
    case 'camo': {
      for (let i = 0; i < 90; i++) {
        g.fillStyle = hex([b, d][i % 2] as number);
        g.beginPath();
        const x = r() * S;
        const y = r() * S;
        for (let k = 0; k < 7; k++) {
          const ang = (k / 7) * Math.PI * 2;
          const rr = S * (0.03 + r() * 0.05);
          g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
        }
        g.fill();
      }
      break;
    }
    case 'flames': {
      g.fillStyle = hex(b);
      g.fillRect(0, 0, S, S * 0.5);
      for (let i = 0; i < 12; i++) {
        const x = (i / 12) * S;
        const h = S * (0.25 + r() * 0.2);
        g.fillStyle = hex(i % 2 ? b : d);
        g.beginPath();
        g.moveTo(x, S * 0.4);
        g.quadraticCurveTo(x + S * 0.05, S * 0.4 + h * 0.6, x + S * 0.04, S * 0.4 + h);
        g.quadraticCurveTo(x + S * 0.09, S * 0.4 + h * 0.5, x + S / 12, S * 0.4);
        g.fill();
      }
      break;
    }
    case 'zebra': {
      g.fillStyle = hex(b);
      for (let i = 0; i < 22; i++) {
        const x = (i / 22) * S;
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + S * 0.06, S * 0.3, x - S * 0.03, S * 0.6, x + S * 0.04, S);
        g.lineTo(x + S * 0.03, S);
        g.bezierCurveTo(x - S * 0.01, S * 0.6, x + S * 0.05, S * 0.3, x + S * 0.012, 0);
        g.fill();
      }
      break;
    }
    case 'husk': {
      // pamonha: green husk stripes and a string band
      for (let i = 0; i < 24; i++) {
        g.fillStyle = hex(i % 3 === 0 ? b : i % 3 === 1 ? a : d);
        g.fillRect((i / 24) * S, 0, S / 24 + 1, S);
      }
      g.fillStyle = '#efe4c8';
      g.fillRect(0, S * 0.5, S, S * 0.03);
      break;
    }
    case 'pen': {
      // caneta azul: blue barrel with a white label band round the rim and lettering
      g.fillStyle = hex(b);
      g.fillRect(0, S * 0.5, S, S * 0.1);
      g.fillStyle = hex(a);
      g.font = `900 ${Math.round(S * 0.075)}px sans-serif`;
      g.textBaseline = 'middle';
      // canvas rows run belly → top, so the lettering is drawn upside down to read upright
      g.save();
      g.translate(0, S * 0.55);
      g.scale(1, -1);
      for (let i = 0; i < 2; i++) g.fillText('CANETA AZUL', (i / 2) * S + S * 0.04, 0);
      g.restore();
      g.fillStyle = hex(d);
      g.fillRect(0, S * 0.9, S, S * 0.1);
      break;
    }
    case 'galaxy': {
      // nebula clouds + stars
      for (let i = 0; i < 14; i++) {
        const x = r() * S;
        const y = r() * S;
        const rr = S * (0.12 + r() * 0.22);
        const grad = g.createRadialGradient(x, y, 0, x, y, rr);
        const col = hex(i % 2 ? b : d);
        grad.addColorStop(0, `${col}dd`);
        grad.addColorStop(1, `${col}00`);
        g.fillStyle = grad;
        // wrap around the rim so the seam doesn't show
        for (const ox of [-S, 0, S]) g.fillRect(x + ox - rr, y - rr, rr * 2, rr * 2);
      }
      for (let i = 0; i < 260; i++) {
        const s = r() < 0.08 ? 3 : r() < 0.3 ? 2 : 1;
        g.fillStyle = r() < 0.15 ? '#ffe9b3' : '#ffffff';
        g.fillRect(r() * S, r() * S, s, s);
      }
      break;
    }
    case 'pride': {
      // rainbow bands from the belly up
      const cols = [0xff4d5e, 0xff9a3d, 0xffd23f, 0x5dffa0, 0x4dc9ff, 0x8a5aff, 0xff5ad1];
      cols.forEach((col, i) => {
        g.fillStyle = hex(col);
        g.fillRect(0, (i / cols.length) * S, S, S / cols.length + 1);
      });
      // the first colour, if given, tints the very top (where the dome sits)
      g.fillStyle = hex(a);
      g.fillRect(0, S * 0.92, S, S * 0.08);
      break;
    }
  }
  return c;
}

const textures = new Map<string, CanvasTexture>();

/** Hull texture. Rows run belly (v = 0) → top (v = 1) like the lathe's UVs. */
export function patternTexture(pattern: SkinPattern, colors: readonly number[]): CanvasTexture {
  const key = `${pattern}:${colors.join(',')}`;
  let t = textures.get(key);
  if (!t) {
    t = new CanvasTexture(patternCanvas(pattern, colors, 512));
    t.colorSpace = SRGBColorSpace;
    t.flipY = false;
    t.anisotropy = 4;
    textures.set(key, t);
  }
  return t;
}

const swatches = new Map<string, string>();

/** Small image of the pattern for the shop (flipped so the top of the hull is up). */
export function patternSwatch(pattern: SkinPattern, colors: readonly number[]): string {
  const key = `${pattern}:${colors.join(',')}`;
  let url = swatches.get(key);
  if (!url) {
    const src = patternCanvas(pattern, colors, 128);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    g.translate(0, 128);
    g.scale(1, -1);
    g.drawImage(src, 0, 0);
    url = c.toDataURL('image/png');
    swatches.set(key, url);
  }
  return url;
}

const topperTemplates = new Map<SkinTopper, Group>();

/** Topper instance (shares geometry/materials with every other saucer wearing it). */
export function topperFor(id: SkinTopper): Group {
  let t = topperTemplates.get(id);
  if (!t) {
    t = buildTopper(id);
    topperTemplates.set(id, t);
  }
  return t.clone();
}

const std = (color: number, o: { metal?: number; rough?: number; emissive?: number } = {}): Material =>
  new MeshStandardMaterial({ color, metalness: o.metal ?? 0.1, roughness: o.rough ?? 0.6, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissive ? 0.9 : 0 });

/** Topper sitting on the dome (dome top is at y ≈ 0.62 in body space, radius 0.42). */
export function buildTopper(id: SkinTopper): Group {
  const g = new Group();
  const add = (m: Mesh, x = 0, y = 0, z = 0) => {
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  switch (id) {
    case 'cangaceiro': {
      const leather = std(0x7a4a26, { rough: 0.8 });
      add(new Mesh(new CylinderGeometry(0.2, 0.26, 0.16, 16), leather), 0, 0.62, 0);
      const brim = add(new Mesh(new TorusGeometry(0.28, 0.05, 6, 24, Math.PI), leather), 0, 0.6, 0);
      brim.rotation.set(0, 0, 0);
      add(new Mesh(new TorusGeometry(0.28, 0.05, 6, 24, Math.PI), leather), 0, 0.6, 0).rotation.set(0, Math.PI, 0.6);
      for (let i = 0; i < 5; i++) add(new Mesh(new SphereGeometry(0.025, 6, 5), std(0xffd23f, { metal: 0.9, rough: 0.2 })), -0.12 + i * 0.06, 0.64, 0.23);
      break;
    }
    case 'palha': {
      const straw = std(0xe3c27a, { rough: 0.9 });
      add(new Mesh(new CylinderGeometry(0.5, 0.5, 0.03, 24), straw), 0, 0.58, 0);
      add(new Mesh(new CylinderGeometry(0.2, 0.24, 0.18, 16), straw), 0, 0.68, 0);
      add(new Mesh(new CylinderGeometry(0.245, 0.245, 0.05, 16), std(0xc0392b)), 0, 0.62, 0);
      break;
    }
    case 'bone': {
      const cap = std(0xd7263d);
      add(new Mesh(new SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap), 0, 0.5, 0);
      add(new Mesh(new BoxGeometry(0.34, 0.03, 0.26), cap), 0, 0.52, 0.32);
      add(new Mesh(new SphereGeometry(0.04, 6, 4), cap), 0, 0.8, 0);
      break;
    }
    case 'helice': {
      add(new Mesh(new SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0xffd23f)), 0, 0.5, 0);
      add(new Mesh(new CylinderGeometry(0.02, 0.02, 0.16, 6), std(0x333333)), 0, 0.86, 0);
      const prop = new Group();
      prop.name = 'spin';
      for (const [c, r] of [[0xd7263d, 0], [0x1d5fbf, Math.PI]] as const) {
        const blade = new Mesh(new BoxGeometry(0.34, 0.015, 0.08), std(c));
        blade.position.x = Math.cos(r) * 0.17;
        prop.add(blade);
      }
      prop.position.y = 0.95;
      g.add(prop);
      break;
    }
    case 'chifres': {
      const horn = std(0xe9e1cf, { rough: 0.5 });
      for (const s of [-1, 1]) {
        const h = add(new Mesh(new ConeGeometry(0.06, 0.32, 8), horn), s * 0.22, 0.66, 0);
        h.rotation.z = -s * 0.6;
      }
      break;
    }
    case 'aureola': {
      add(new Mesh(new TorusGeometry(0.26, 0.03, 8, 32), new MeshBasicMaterial({ color: 0xfff1a8 })), 0, 0.95, 0).rotation.x = Math.PI / 2;
      break;
    }
    case 'antenas': {
      for (const s of [-1, 1]) {
        const stem = add(new Mesh(new CylinderGeometry(0.012, 0.012, 0.4, 6), std(0x2a2a2a)), s * 0.12, 0.78, 0);
        stem.rotation.z = -s * 0.35;
        add(new Mesh(new SphereGeometry(0.05, 8, 6), new MeshBasicMaterial({ color: 0x7dff9b })), s * 0.2, 0.97, 0);
      }
      break;
    }
    case 'cartola': {
      const black = std(0x15151a, { rough: 0.4 });
      add(new Mesh(new CylinderGeometry(0.34, 0.34, 0.025, 24), black), 0, 0.6, 0);
      add(new Mesh(new CylinderGeometry(0.2, 0.2, 0.36, 20), black), 0, 0.79, 0);
      add(new Mesh(new CylinderGeometry(0.205, 0.205, 0.06, 20), std(0xd7263d)), 0, 0.66, 0);
      break;
    }
    case 'unicornio': {
      add(new Mesh(new ConeGeometry(0.06, 0.42, 10), std(0xfff1a8, { metal: 0.6, rough: 0.2, emissive: 0x6a5a10 })), 0, 0.82, 0.08).rotation.x = 0.25;
      break;
    }
    case 'tampa_caneta': {
      const blue = std(0x1d4ed8, { rough: 0.35 });
      add(new Mesh(new CylinderGeometry(0.1, 0.12, 0.42, 16), blue), 0, 0.82, 0);
      add(new Mesh(new SphereGeometry(0.1, 12, 8), blue), 0, 1.03, 0);
      add(new Mesh(new BoxGeometry(0.04, 0.32, 0.03), blue), 0, 0.82, 0.12);
      break;
    }
    case 'cuia': {
      add(new Mesh(new SphereGeometry(0.18, 14, 10), std(0x6b8c3a)), 0, 0.72, 0);
      add(new Mesh(new CylinderGeometry(0.13, 0.14, 0.04, 14), std(0xd8c08a, { metal: 0.8, rough: 0.3 })), 0, 0.88, 0);
      const bomba = add(new Mesh(new CylinderGeometry(0.012, 0.012, 0.4, 6), std(0xd3d7dc, { metal: 1, rough: 0.2 })), 0.06, 1.0, 0);
      bomba.rotation.z = -0.3;
      break;
    }
    case 'vela': {
      add(new Mesh(new CylinderGeometry(0.035, 0.035, 0.3, 10), std(0xff4fa3)), 0, 0.78, 0);
      add(new Mesh(new SphereGeometry(0.035, 8, 6), new MeshBasicMaterial({ color: 0xffc35a })), 0, 0.96, 0).scale.set(1, 1.6, 1);
      break;
    }
    case 'laranja': {
      // the capybara meme: an orange balanced on top
      add(new Mesh(new SphereGeometry(0.17, 14, 10), std(0xf77f00, { rough: 0.7 })), 0, 0.75, 0).scale.set(1, 0.92, 1);
      add(new Mesh(new BoxGeometry(0.08, 0.02, 0.04), std(0x3f9b44)), 0.02, 0.91, 0);
      break;
    }
    case 'orelhas': {
      const fur = std(0xc98a4b, { rough: 0.9 });
      for (const s of [-1, 1]) {
        const e = add(new Mesh(new ConeGeometry(0.1, 0.24, 4), fur), s * 0.24, 0.66, 0);
        e.rotation.z = -s * 0.45;
      }
      break;
    }
    case 'penas': {
      const cols = [0xff4fa3, 0xffd23f, 0x4dc9ff, 0x5dffa0, 0xb36bff];
      cols.forEach((c, i) => {
        const f = add(new Mesh(new ConeGeometry(0.05, 0.5, 6), new MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35 })), (i - 2) * 0.08, 0.86, -0.05);
        f.rotation.z = (i - 2) * 0.22;
      });
      break;
    }
    case 'laco': {
      const pink = std(0xff4fa3);
      for (const s of [-1, 1]) add(new Mesh(new ConeGeometry(0.1, 0.18, 4), pink), s * 0.1, 0.66, 0).rotation.z = (s * Math.PI) / 2;
      add(new Mesh(new SphereGeometry(0.05, 8, 6), pink), 0, 0.66, 0);
      break;
    }
  }
  return g;
}
