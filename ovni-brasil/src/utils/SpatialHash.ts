/**
 * Uniform grid over the XZ plane. Items are numeric ids so queries are allocation free
 * (the caller passes an output array that gets reused every frame).
 */
export class SpatialHash {
  private readonly cells = new Map<number, number[]>();
  private readonly itemCell = new Map<number, number>();

  constructor(private readonly cellSize: number) {}

  private key(cx: number, cz: number): number {
    return ((cx + 2048) << 12) | (cz + 2048);
  }

  insert(id: number, x: number, z: number): void {
    const k = this.key(Math.floor(x / this.cellSize), Math.floor(z / this.cellSize));
    const prev = this.itemCell.get(id);
    if (prev === k) return;
    if (prev !== undefined) this.removeFromCell(prev, id);
    let cell = this.cells.get(k);
    if (!cell) {
      cell = [];
      this.cells.set(k, cell);
    }
    cell.push(id);
    this.itemCell.set(id, k);
  }

  remove(id: number): void {
    const k = this.itemCell.get(id);
    if (k === undefined) return;
    this.removeFromCell(k, id);
    this.itemCell.delete(id);
  }

  private removeFromCell(k: number, id: number): void {
    const cell = this.cells.get(k);
    if (!cell) return;
    const i = cell.indexOf(id);
    if (i >= 0) {
      cell[i] = cell[cell.length - 1] as number;
      cell.pop();
    }
  }

  /** Collects ids whose cell overlaps the circle. Caller filters by exact distance. */
  query(x: number, z: number, radius: number, out: number[]): number[] {
    out.length = 0;
    const cs = this.cellSize;
    const x0 = Math.floor((x - radius) / cs);
    const x1 = Math.floor((x + radius) / cs);
    const z0 = Math.floor((z - radius) / cs);
    const z1 = Math.floor((z + radius) / cs);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const cell = this.cells.get(this.key(cx, cz));
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) out.push(cell[i] as number);
      }
    }
    return out;
  }

  clear(): void {
    this.cells.clear();
    this.itemCell.clear();
  }
}
