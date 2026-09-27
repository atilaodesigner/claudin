import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Euler,
  IcosahedronGeometry,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { UVRect } from '../rendering/TextureAtlas';

export interface PartOptions {
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
  /** 1 = tinted by the instance paint color. */
  paint?: number;
  /** Emissive factor (lights, signs). */
  emit?: number;
  uv?: UVRect;
  /** Skip baked AO darkening for this part (lights, glass). */
  noAO?: boolean;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _s = new Vector3();
const _p = new Vector3();
const _c = new Color();

interface Part {
  geo: BufferGeometry;
  color: Color;
  paint: number;
  emit: number;
  uv: UVRect | null;
  noAO: boolean;
}

/**
 * Builds stylized low-poly models from primitives, merged into one geometry with
 * vertex colors + paint/emit masks. Everything is designed to render with the single
 * shared world material (see WorldMaterial).
 */
export class ModelBuilder {
  private readonly parts: Part[] = [];
  /** Default white UV so the atlas map is neutral. */
  constructor(private readonly whiteUV: UVRect) {}

  private push(geo: BufferGeometry, color: number, x: number, y: number, z: number, o: PartOptions = {}): this {
    _e.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
    _q.setFromEuler(_e);
    _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    _p.set(x, y, z);
    _m.compose(_p, _q, _s);
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    g.applyMatrix4(_m);
    this.parts.push({ geo: g, color: new Color(color), paint: o.paint ?? 0, emit: o.emit ?? 0, uv: o.uv ?? null, noAO: o.noAO ?? false });
    return this;
  }

  box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, o?: PartOptions): this {
    return this.push(new BoxGeometry(w, h, d), color, x, y, z, o);
  }

  /** Box whose base sits at y. */
  block(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, o?: PartOptions): this {
    return this.box(w, h, d, color, x, y + h / 2, z, o);
  }

  cyl(rTop: number, rBottom: number, h: number, seg: number, color: number, x = 0, y = 0, z = 0, o?: PartOptions): this {
    return this.push(new CylinderGeometry(rTop, rBottom, h, seg, 1), color, x, y, z, o);
  }

  /** Half cylinder lying along Z with the flat side on the ground (hangars, tunnels). */
  halfCyl(r: number, length: number, seg: number, color: number, x = 0, y = 0, z = 0, o?: PartOptions): this {
    const g = new CylinderGeometry(r, r, length, seg, 1, false, -Math.PI / 2, Math.PI);
    g.rotateX(-Math.PI / 2);
    return this.push(g, color, x, y, z, o);
  }

  cone(r: number, h: number, seg: number, color: number, x = 0, y = 0, z = 0, o?: PartOptions): this {
    return this.push(new ConeGeometry(r, h, seg), color, x, y, z, o);
  }

  sphere(r: number, wSeg: number, hSeg: number, color: number, x = 0, y = 0, z = 0, o?: PartOptions): this {
    return this.push(new SphereGeometry(r, wSeg, hSeg), color, x, y, z, o);
  }

  ico(r: number, detail: number, color: number, x = 0, y = 0, z = 0, o?: PartOptions): this {
    return this.push(new IcosahedronGeometry(r, detail), color, x, y, z, o);
  }

  dodeca(r: number, color: number, x = 0, y = 0, z = 0, o?: PartOptions): this {
    return this.push(new DodecahedronGeometry(r, 0), color, x, y, z, o);
  }

  torus(R: number, r: number, radialSeg: number, tubularSeg: number, color: number, x = 0, y = 0, z = 0, o?: PartOptions): this {
    return this.push(new TorusGeometry(R, r, radialSeg, tubularSeg), color, x, y, z, o);
  }

  /** Flat quad facing +Z (rotate with ry). Used for signs with atlas UVs. */
  quad(w: number, h: number, color: number, x = 0, y = 0, z = 0, o?: PartOptions): this {
    return this.push(new PlaneGeometry(w, h), color, x, y, z, o);
  }

  /** Triangular prism (gable roof). Ridge along X. */
  prism(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, o?: PartOptions): this {
    const hw = w / 2;
    const hd = d / 2;
    const v = [
      // front triangle (z+)
      -hw, 0, hd, hw, 0, hd, 0, h, hd,
      // back triangle (z-)
      hw, 0, -hd, -hw, 0, -hd, 0, h, -hd,
      // left slope
      -hw, 0, -hd, -hw, 0, hd, 0, h, hd,
      -hw, 0, -hd, 0, h, hd, 0, h, -hd,
      // right slope
      hw, 0, hd, hw, 0, -hd, 0, h, -hd,
      hw, 0, hd, 0, h, -hd, 0, h, hd,
      // bottom
      -hw, 0, -hd, hw, 0, -hd, hw, 0, hd,
      -hw, 0, -hd, hw, 0, hd, -hw, 0, hd,
    ];
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(v), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array((v.length / 3) * 2), 2));
    g.computeVertexNormals();
    return this.push(g, color, x, y, z, o);
  }

  /** Four-sided hip roof (pyramid frustum). */
  hipRoof(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, o?: PartOptions): this {
    const g = new CylinderGeometry(0.0001, Math.SQRT1_2, 1, 4, 1);
    g.rotateY(Math.PI / 4);
    g.scale(w, h, d);
    g.translate(0, h / 2, 0);
    return this.push(g, color, x, y, z, o);
  }

  /** Straight tube between two points (wires, rails, rebar). */
  strut(ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number, color: number, seg = 5, o?: PartOptions): this {
    const dir = new Vector3(bx - ax, by - ay, bz - az);
    const len = dir.length();
    const g = new CylinderGeometry(r, r, len, seg, 1);
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize());
    g.applyQuaternion(q);
    g.translate((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    return this.push(g, color, 0, 0, 0, o);
  }

  /** Mirror helper for symmetric parts along X. */
  mirrorX(fn: (sign: number) => void): this {
    fn(1);
    fn(-1);
    return this;
  }

  get partCount(): number {
    return this.parts.length;
  }

  /**
   * Merge and bake: vertex colors, paint/emit attribute, baked contact AO (darker near
   * the ground and on downward faces), atlas UVs.
   */
  build(options: { ao?: boolean } = {}): BufferGeometry {
    const ao = options.ao ?? true;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of this.parts) {
      p.geo.computeBoundingBox();
      const bb = p.geo.boundingBox;
      if (bb) {
        minY = Math.min(minY, bb.min.y);
        maxY = Math.max(maxY, bb.max.y);
      }
    }
    const height = Math.max(0.01, maxY - Math.max(0, minY));
    const aoH = Math.min(1.1, Math.max(0.12, height * 0.45));

    const prepared: BufferGeometry[] = [];
    for (const p of this.parts) {
      const g = p.geo;
      const pos = g.getAttribute('position') as BufferAttribute;
      const nrm = g.getAttribute('normal') as BufferAttribute;
      const count = pos.count;
      const colors = new Float32Array(count * 3);
      const fx = new Float32Array(count * 2);
      const uvs = new Float32Array(count * 2);
      const srcUv = g.getAttribute('uv') as BufferAttribute | undefined;
      for (let i = 0; i < count; i++) {
        let shade = 1;
        if (ao && !p.noAO) {
          const y = pos.getY(i);
          const t = Math.min(1, Math.max(0, y / aoH));
          shade *= 0.58 + 0.42 * (t * t * (3 - 2 * t));
          const ny = nrm ? nrm.getY(i) : 0;
          if (ny < -0.5) shade *= 0.72;
        }
        _c.copy(p.color).multiplyScalar(shade);
        colors[i * 3] = _c.r;
        colors[i * 3 + 1] = _c.g;
        colors[i * 3 + 2] = _c.b;
        fx[i * 2] = p.paint;
        fx[i * 2 + 1] = p.emit;
        const r = p.uv ?? this.whiteUV;
        if (p.uv && srcUv) {
          uvs[i * 2] = r.u0 + (r.u1 - r.u0) * srcUv.getX(i);
          uvs[i * 2 + 1] = r.v0 + (r.v1 - r.v0) * srcUv.getY(i);
        } else {
          uvs[i * 2] = (r.u0 + r.u1) / 2;
          uvs[i * 2 + 1] = (r.v0 + r.v1) / 2;
        }
      }
      const clean = new BufferGeometry();
      clean.setAttribute('position', pos);
      clean.setAttribute('normal', nrm ?? new BufferAttribute(new Float32Array(count * 3), 3));
      clean.setAttribute('color', new BufferAttribute(colors, 3));
      clean.setAttribute('uv', new BufferAttribute(uvs, 2));
      clean.setAttribute('aFx', new BufferAttribute(fx, 2));
      prepared.push(clean);
    }
    const merged = mergeGeometries(prepared, false);
    if (!merged) throw new Error('ModelBuilder: merge failed');
    for (const g of prepared) g.dispose();
    for (const p of this.parts) p.geo.dispose();
    this.parts.length = 0;
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    return merged;
  }
}
