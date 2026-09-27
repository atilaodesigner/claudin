/**
 * Coarse max-height grid of static structures. Used for UFO rooftop clearance and
 * for missiles hitting buildings (the "hide behind a building" emergent moment).
 */
export class HeightField {
  readonly heights: Float32Array;
  readonly owner: Int32Array;
  readonly cols: number;
  readonly rows: number;

  constructor(
    readonly minX: number,
    readonly minZ: number,
    readonly width: number,
    readonly depth: number,
    readonly cell = 2,
  ) {
    this.cols = Math.ceil(width / cell);
    this.rows = Math.ceil(depth / cell);
    this.heights = new Float32Array(this.cols * this.rows);
    this.owner = new Int32Array(this.cols * this.rows).fill(-1);
  }

  private index(x: number, z: number): number {
    const cx = Math.floor((x - this.minX) / this.cell);
    const cz = Math.floor((z - this.minZ) / this.cell);
    if (cx < 0 || cz < 0 || cx >= this.cols || cz >= this.rows) return -1;
    return cz * this.cols + cx;
  }

  heightAt(x: number, z: number): number {
    const i = this.index(x, z);
    return i < 0 ? 0 : (this.heights[i] as number);
  }

  /** Max height inside a circle (sampled). */
  maxInRadius(x: number, z: number, r: number): number {
    let h = this.heightAt(x, z);
    const steps = r > 6 ? 12 : 8;
    for (let ring = 1; ring <= 2; ring++) {
      const rr = (r * ring) / 2;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        h = Math.max(h, this.heightAt(x + Math.cos(a) * rr, z + Math.sin(a) * rr));
      }
    }
    return h;
  }

  /** Stamps an axis-aligned footprint with a height, remembering the owner. */
  stamp(uid: number, x: number, z: number, halfX: number, halfZ: number, top: number): void {
    const c0 = Math.max(0, Math.floor((x - halfX - this.minX) / this.cell));
    const c1 = Math.min(this.cols - 1, Math.floor((x + halfX - this.minX) / this.cell));
    const r0 = Math.max(0, Math.floor((z - halfZ - this.minZ) / this.cell));
    const r1 = Math.min(this.rows - 1, Math.floor((z + halfZ - this.minZ) / this.cell));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * this.cols + c;
        if (top > (this.heights[i] as number)) {
          this.heights[i] = top;
          this.owner[i] = uid;
        }
      }
    }
  }

  /** Clears cells owned by uid; returns cell centers that need re-stamping. */
  clearOwner(uid: number, x: number, z: number, halfX: number, halfZ: number, out: number[]): number[] {
    out.length = 0;
    const c0 = Math.max(0, Math.floor((x - halfX - this.minX) / this.cell));
    const c1 = Math.min(this.cols - 1, Math.floor((x + halfX - this.minX) / this.cell));
    const r0 = Math.max(0, Math.floor((z - halfZ - this.minZ) / this.cell));
    const r1 = Math.min(this.rows - 1, Math.floor((z + halfZ - this.minZ) / this.cell));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * this.cols + c;
        if (this.owner[i] === uid) {
          this.heights[i] = 0;
          this.owner[i] = -1;
          out.push(i);
        }
      }
    }
    return out;
  }

  cellCenter(i: number): { x: number; z: number } {
    const c = i % this.cols;
    const r = Math.floor(i / this.cols);
    return { x: this.minX + (c + 0.5) * this.cell, z: this.minZ + (r + 0.5) * this.cell };
  }

  setCell(i: number, h: number, uid: number): void {
    if (h > (this.heights[i] as number)) {
      this.heights[i] = h;
      this.owner[i] = uid;
    }
  }
}
