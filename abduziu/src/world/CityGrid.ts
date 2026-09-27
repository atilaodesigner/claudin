import type { CityDef } from '../config/cities';
import { GRID, WET, type DistrictId } from '../config/districts';

const B = GRID.blockSize;
const ROAD = GRID.roadWidth;
/** Half size of the block including sidewalk. */
export const HB = (B - ROAD) / 2;
/** Half size of the buildable lot. */
export const HL = HB - GRID.sidewalk;
/** How far water extends past the city edge (sea to the horizon). */
const SEA_EXT = 900;

export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

function inside(r: Rect, x: number, z: number): boolean {
  return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
}

/**
 * The city's block grid and its topology: which road segments exist, where the water
 * and the sand are, and what the ground height is at any point. Shared by the
 * generator, the world, traffic and police so they all agree.
 *
 * Cells span from road centerline to road centerline; vertical road line c sits at
 * x = -halfW + c*B, horizontal line r at z = -halfH + r*B.
 */
export class CityGrid {
  readonly cols: number;
  readonly rows: number;
  readonly halfW: number;
  readonly halfH: number;
  private readonly bridgeX: ReadonlySet<number>;
  private readonly bridgeZ: ReadonlySet<number>;

  constructor(readonly city: CityDef) {
    this.rows = city.layout.length;
    this.cols = (city.layout[0] as string).length;
    this.halfW = (this.cols * B) / 2;
    this.halfH = (this.rows * B) / 2;
    this.bridgeX = new Set(city.bridges?.x ?? []);
    this.bridgeZ = new Set(city.bridges?.z ?? []);
  }

  cell(col: number, row: number): DistrictId | null {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    return (this.city.layout[row] as string)[col] as DistrictId;
  }

  colAt(x: number): number {
    return Math.floor((x + this.halfW) / B);
  }

  rowAt(z: number): number {
    return Math.floor((z + this.halfH) / B);
  }

  centerX(col: number): number {
    return -this.halfW + (col + 0.5) * B;
  }

  centerZ(row: number): number {
    return -this.halfH + (row + 0.5) * B;
  }

  isWet(d: DistrictId | null): boolean {
    return d !== null && WET.has(d);
  }

  /** Road between two cells? Outside the grid inherits the wetness of the inner cell. */
  private corridor(a: DistrictId | null, b: DistrictId | null, bridge: boolean): boolean {
    const wa = a === null ? this.isWet(b) : this.isWet(a);
    const wb = b === null ? this.isWet(a) : this.isWet(b);
    if (wa && wb) return bridge && (a === 'W' || b === 'W');
    return true;
  }

  /** Vertical road line `line` (0..cols) within row `row`. */
  vRoad(line: number, row: number): boolean {
    return this.corridor(this.cell(line - 1, row), this.cell(line, row), this.bridgeX.has(line));
  }

  /** Horizontal road line `line` (0..rows) within column `col`. */
  hRoad(line: number, col: number): boolean {
    return this.corridor(this.cell(col, line - 1), this.cell(col, line), this.bridgeZ.has(line));
  }

  isBridgeV(line: number, row: number): boolean {
    return this.bridgeX.has(line) && this.cell(line - 1, row) === 'W' && this.cell(line, row) === 'W';
  }

  isBridgeH(line: number, col: number): boolean {
    return this.bridgeZ.has(line) && this.cell(col, line - 1) === 'W' && this.cell(col, line) === 'W';
  }

  /** Does the road on a side of this block exist? side: 0 north (-z), 1 south, 2 west (-x), 3 east. */
  sideRoad(col: number, row: number, side: 0 | 1 | 2 | 3): boolean {
    if (side === 0) return this.hRoad(row, col);
    if (side === 1) return this.hRoad(row + 1, col);
    if (side === 2) return this.vRoad(col, row);
    return this.vRoad(col + 1, row);
  }

  /** Neighbor across a side (null outside). */
  neighbor(col: number, row: number, side: 0 | 1 | 2 | 3): DistrictId | null {
    if (side === 0) return this.cell(col, row - 1);
    if (side === 1) return this.cell(col, row + 1);
    if (side === 2) return this.cell(col - 1, row);
    return this.cell(col + 1, row);
  }

  /** Is the neighbor across this side water (or the sea beyond the edge)? */
  waterSide(col: number, row: number, side: 0 | 1 | 2 | 3): boolean {
    const n = this.neighbor(col, row, side);
    if (n === null) return this.isWet(this.cell(col, row));
    return n === 'W';
  }

  isWaterAt(x: number, z: number): boolean {
    const col0 = this.colAt(x);
    const row0 = this.rowAt(z);
    const col = Math.max(0, Math.min(this.cols - 1, col0));
    const row = Math.max(0, Math.min(this.rows - 1, row0));
    const d = this.cell(col, row);
    if (d === 'W') return inside(this.waterRect(col, row, true), x, z);
    // beyond the edge the sea continues past border beaches
    if (d === 'A' && (col0 !== col || row0 !== row)) return !inside(this.sandRect(col, row), x, z);
    return false;
  }

  /** Extra sea beyond border beaches (rendering). */
  seaBeyondBeach(col: number, row: number): Rect[] {
    const out: Rect[] = [];
    const x0 = -this.halfW + col * B;
    const z0 = -this.halfH + row * B;
    if (row === 0) out.push({ x0, x1: x0 + B, z0: z0 - SEA_EXT, z1: z0 });
    if (row === this.rows - 1) out.push({ x0, x1: x0 + B, z0: z0 + B, z1: z0 + B + SEA_EXT });
    if (col === 0) out.push({ x0: x0 - SEA_EXT, x1: x0, z0, z1: z0 + B });
    if (col === this.cols - 1) out.push({ x0: x0 + B, x1: x0 + B + SEA_EXT, z0, z1: z0 + B });
    return out;
  }

  /** Water surface of a W cell: full cell minus the half-roads that exist around it. */
  waterRect(col: number, row: number, extend: boolean): Rect {
    const x0 = -this.halfW + col * B;
    const z0 = -this.halfH + row * B;
    const r: Rect = { x0, x1: x0 + B, z0, z1: z0 + B };
    if (this.sideRoad(col, row, 0)) r.z0 += ROAD / 2;
    else if (extend && row === 0) r.z0 -= SEA_EXT;
    if (this.sideRoad(col, row, 1)) r.z1 -= ROAD / 2;
    else if (extend && row === this.rows - 1) r.z1 += SEA_EXT;
    if (this.sideRoad(col, row, 2)) r.x0 += ROAD / 2;
    else if (extend && col === 0) r.x0 -= SEA_EXT;
    if (this.sideRoad(col, row, 3)) r.x1 -= ROAD / 2;
    else if (extend && col === this.cols - 1) r.x1 += SEA_EXT;
    return r;
  }

  /** Sand of an A cell: the block plus the corridors that have no road. */
  sandRect(col: number, row: number): Rect {
    const cx = this.centerX(col);
    const cz = this.centerZ(row);
    return {
      x0: this.sideRoad(col, row, 2) ? cx - HB : cx - B / 2,
      x1: this.sideRoad(col, row, 3) ? cx + HB : cx + B / 2,
      z0: this.sideRoad(col, row, 0) ? cz - HB : cz - B / 2,
      z1: this.sideRoad(col, row, 1) ? cz + HB : cz + B / 2,
    };
  }

  /** True on an existing road surface (lanes of the grid, bridges included). */
  isRoadAt(x: number, z: number): boolean {
    const fc = (x + this.halfW) / B;
    const fr = (z + this.halfH) / B;
    const lineC = Math.round(fc);
    const lineR = Math.round(fr);
    const dx = Math.abs(fc - lineC) * B;
    const dz = Math.abs(fr - lineR) * B;
    const onV = dx <= ROAD / 2 && lineC >= 0 && lineC <= this.cols;
    const onH = dz <= ROAD / 2 && lineR >= 0 && lineR <= this.rows;
    if (!onV && !onH) return false;
    const row = Math.floor(fr);
    const col = Math.floor(fc);
    if (onV && onH) {
      // intersection: open if any of the four arms exists
      return this.vRoad(lineC, lineR - 1) || this.vRoad(lineC, lineR) || this.hRoad(lineR, lineC - 1) || this.hRoad(lineR, lineC);
    }
    if (onV) return row >= 0 && row < this.rows && this.vRoad(lineC, row);
    return col >= 0 && col < this.cols && this.hRoad(lineR, col);
  }

  /** Ground surface height (water sits lower so things sink a bit). */
  groundAt(x: number, z: number): number {
    if (this.isWaterAt(x, z)) return -0.3;
    const col = this.colAt(x);
    const row = this.rowAt(z);
    const d = this.cell(col, row);
    if (d === null) return 0;
    const lx = Math.abs(x - this.centerX(col));
    const lz = Math.abs(z - this.centerZ(row));
    if (d === 'A') {
      const s = this.sandRect(col, row);
      return x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 ? 0.2 : 0.02;
    }
    if ((d === 'P' || d === 'L') && lx <= HB && lz <= HB) return 0.24;
    if (lx <= HL && lz <= HL) return 0.23;
    if (lx <= HB && lz <= HB) return 0.18;
    return 0.02;
  }
}
