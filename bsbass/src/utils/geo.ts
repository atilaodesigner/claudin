// Monta geometria "na mão" (posições, normais, uvs, cores) pra juntar
// milhares de pecinhas num único draw call.

import * as THREE from 'three';

export type RGB = [number, number, number];
export type UVRect = [number, number, number, number]; // u0 v0 u1 v1

const WHITE: RGB = [1, 1, 1];
const FULL: UVRect = [0, 0, 1, 1];

export class GeoBuilder {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  // transformação corrente (rotação em Y + translação)
  private c = 1;
  private s = 0;
  private tx = 0;
  private ty = 0;
  private tz = 0;

  setTransform(x: number, y: number, z: number, rotY: number): void {
    this.tx = x;
    this.ty = y;
    this.tz = z;
    this.c = Math.cos(rotY);
    this.s = Math.sin(rotY);
  }

  resetTransform(): void {
    this.setTransform(0, 0, 0, 0);
  }

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  private vert(x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number, col: RGB): void {
    // rotation.y: x' = x c + z s ; z' = -x s + z c
    this.pos.push(this.tx + x * this.c + z * this.s, this.ty + y, this.tz - x * this.s + z * this.c);
    this.nor.push(nx * this.c + nz * this.s, ny, -nx * this.s + nz * this.c);
    this.uv.push(u, v);
    this.col.push(col[0], col[1], col[2]);
  }

  /** quad a-b-c-d (anti-horário visto de frente) */
  quad(
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
    uv: UVRect = FULL,
    col: RGB = WHITE,
  ): void {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const i = this.vertexCount;
    this.vert(a[0], a[1], a[2], nx, ny, nz, uv[0], uv[1], col);
    this.vert(b[0], b[1], b[2], nx, ny, nz, uv[2], uv[1], col);
    this.vert(c[0], c[1], c[2], nx, ny, nz, uv[2], uv[3], col);
    this.vert(d[0], d[1], d[2], nx, ny, nz, uv[0], uv[3], col);
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  /** parede vertical virada pra +Z local, de x0..x1, y0..y1, no plano z */
  wallZ(x0: number, x1: number, y0: number, y1: number, z: number, uv: UVRect = FULL, col: RGB = WHITE): void {
    this.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], uv, col);
  }

  /** caixa alinhada (no referencial corrente). faces: +z -z +x -x +y (-y opcional) */
  box(
    cx: number, cy: number, cz: number,
    sx: number, sy: number, sz: number,
    col: RGB = WHITE,
    uvs: { side?: UVRect; front?: UVRect; top?: UVRect } = {},
    bottom = false,
  ): void {
    const x0 = cx - sx / 2, x1 = cx + sx / 2;
    const y0 = cy - sy / 2, y1 = cy + sy / 2;
    const z0 = cz - sz / 2, z1 = cz + sz / 2;
    const side = uvs.side ?? FULL, front = uvs.front ?? side, top = uvs.top ?? side;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], front, col); // +z
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], side, col); // -z
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], side, col); // +x
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], side, col); // -x
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top, col); // +y
    if (bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], top, col);
  }

  /** cilindro vertical simples */
  cylinder(cx: number, y0: number, cz: number, r0: number, r1: number, h: number, seg: number, col: RGB, capTop = true): void {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p = (a: number, r: number, y: number): [number, number, number] => [cx + Math.sin(a) * r, y, cz + Math.cos(a) * r];
      this.quad(p(a0, r0, y0), p(a1, r0, y0), p(a1, r1, y0 + h), p(a0, r1, y0 + h), FULL, col);
      if (capTop && r1 > 0.001) {
        const i0 = this.vertexCount;
        const c: [number, number, number] = [cx, y0 + h, cz];
        const pa = p(a0, r1, y0 + h), pb = p(a1, r1, y0 + h);
        this.vert(c[0], c[1], c[2], 0, 1, 0, 0.5, 0.5, col);
        this.vert(pa[0], pa[1], pa[2], 0, 1, 0, 0, 0, col);
        this.vert(pb[0], pb[1], pb[2], 0, 1, 0, 1, 0, col);
        this.idx.push(i0, i0 + 1, i0 + 2);
      }
    }
  }

  /** triângulo solto (normal calculada) */
  tri(a: [number, number, number], b: [number, number, number], c: [number, number, number], col: RGB): void {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const i = this.vertexCount;
    this.vert(a[0], a[1], a[2], nx, ny, nz, 0, 0, col);
    this.vert(b[0], b[1], b[2], nx, ny, nz, 1, 0, col);
    this.vert(c[0], c[1], c[2], nx, ny, nz, 0, 1, col);
    this.idx.push(i, i + 1, i + 2);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.vertexCount > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

const tmp = new THREE.Color();

/** cor sRGB (0xRRGGBB) -> RGB linear pro atributo de vértice, com ganho opcional */
export function hex(h: number, k = 1): RGB {
  tmp.setHex(h);
  return [tmp.r * k, tmp.g * k, tmp.b * k];
}
