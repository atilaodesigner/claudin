import type { BufferGeometry } from 'three';
import { ModelBuilder } from '../assets/ModelBuilder';
import type { ModelLibrary } from '../assets/ModelLibrary';
import { CITY, DISTRICTS, type DistrictId } from '../config/districts';
import { getObjectDef, type Rarity } from '../config/objects';
import type { TextureAtlas } from '../rendering/TextureAtlas';
import { Rng } from '../utils/rng';

export interface Placement {
  defId: string;
  modelKey: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  paint: number;
  rarity: Rarity;
  district: DistrictId;
  /** Index into placements of the object this one rests on. */
  parent: number;
  /** Terrain height under the root of this stack. */
  groundY: number;
}

export type NpcKind = 'person' | 'dog' | 'chicken' | 'cow';
export type Persona = 'filmer' | 'runner' | 'pointer' | 'calm' | 'player' | 'dancer' | 'sitter';

export interface NpcSpawn {
  kind: NpcKind;
  x: number;
  z: number;
  rotY: number;
  persona: Persona;
  paint: number;
  district: DistrictId;
  /** Wander radius around the spawn. */
  roam: number;
}

export interface BlockInfo {
  col: number;
  row: number;
  cx: number;
  cz: number;
  district: DistrictId;
}

export interface GenResult {
  placements: Placement[];
  npcs: NpcSpawn[];
  wires: Array<[number, number]>;
  blocks: BlockInfo[];
  ground: BufferGeometry;
  calcada: BufferGeometry;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  start: { x: number; z: number };
  roadLines: { xs: number[]; zs: number[] };
}

const B = CITY.blockSize;
const ROAD = CITY.roadWidth;
const SIDE = CITY.sidewalk;
/** Half size of the block including sidewalk. */
const HB = (B - ROAD) / 2;
/** Half size of the buildable lot. */
const HL = HB - SIDE;

const PERSON_PAINTS = [0xf2c14e, 0x3a86ff, 0x2ec4b6, 0xff595e, 0x8ac926, 0xffffff, 0xff924c, 0x6a4c93, 0x1982c4, 0x06d6a0, 0xffd6a5, 0xe63946];

export class WorldGenerator {
  private rng: Rng;
  private readonly placements: Placement[] = [];
  private readonly npcs: NpcSpawn[] = [];
  private readonly poles: Array<{ index: number; x: number; z: number }> = [];
  private readonly wires: Array<[number, number]> = [];
  private readonly blocks: BlockInfo[] = [];
  private halfW = 0;
  private halfH = 0;
  private skyscraperPlaced = false;
  private radioTowerPlaced = false;
  private statuePlaced = false;

  constructor(
    private readonly lib: ModelLibrary,
    private readonly atlas: TextureAtlas,
    seed: number,
  ) {
    this.rng = new Rng(seed);
  }

  generate(): GenResult {
    const layout = CITY.layout;
    const rows = layout.length;
    const cols = (layout[0] as string).length;
    const halfW = (cols * B) / 2;
    const halfH = (rows * B) / 2;
    this.halfW = halfW;
    this.halfH = halfH;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const d = (layout[row] as string)[col] as DistrictId;
        const cx = -halfW + (col + 0.5) * B;
        const cz = -halfH + (row + 0.5) * B;
        this.blocks.push({ col, row, cx, cz, district: d });
      }
    }
    // commercial gets one gas station; the most central finance block gets the skyscraper
    let gasPlaced = false;
    for (const blk of this.blocks) {
      const r = this.rng.fork(blk.col * 31 + blk.row * 7);
      const prev = this.rng;
      this.rng = r;
      switch (blk.district) {
        case 'R':
          this.genResidential(blk);
          break;
        case 'V':
          this.genFavela(blk);
          break;
        case 'C':
          if (!gasPlaced && blk.row === 4) {
            this.genGasStation(blk);
            gasPlaced = true;
          } else this.genCommercial(blk);
          break;
        case 'P':
          this.genPraca(blk);
          break;
        case 'S':
          this.genSoccer(blk);
          break;
        case 'I':
          this.genIndustrial(blk);
          break;
        case 'F':
          this.genFinancial(blk);
          break;
        case 'B':
          this.genBase(blk);
          break;
        case 'U':
          this.genRural(blk);
          break;
      }
      this.genStreet(blk);
      this.rng = prev;
    }
    this.genOutskirts(halfW, halfH);
    this.buildWires();

    const startBlock = this.blocks.find((b) => b.col === CITY.start.col && b.row === CITY.start.row) as BlockInfo;
    const xs: number[] = [];
    const zs: number[] = [];
    for (let c = 0; c <= cols; c++) xs.push(-halfW + c * B);
    for (let r = 0; r <= rows; r++) zs.push(-halfH + r * B);

    return {
      placements: this.placements,
      npcs: this.npcs,
      wires: this.wires,
      blocks: this.blocks,
      ground: this.buildGround(halfW, halfH, cols, rows),
      calcada: this.buildCalcada(),
      bounds: { minX: -halfW - 30, maxX: halfW + 30, minZ: -halfH - 30, maxZ: halfH + 30 },
      start: { x: startBlock.cx, z: startBlock.cz + HB + ROAD / 2 },
      roadLines: { xs, zs },
    };
  }

  // ───────────────────────────────────────────── helpers

  private place(defId: string, x: number, y: number, z: number, rotY: number, district: DistrictId, parent = -1, variant = -1): number {
    const def = getObjectDef(defId);
    const r = this.rng;
    const paint = def.paints && def.paints.length > 0 ? r.pick(def.paints) : 0xffffff;
    let rarity: Rarity = def.rarity ?? 'normal';
    if (!def.rarity && def.tier <= 8) {
      const roll = r.next();
      if (roll < 0.004) rarity = 'epico';
      else if (roll < 0.018) rarity = 'raro';
      else if (roll < 0.06) rarity = 'incomum';
    }
    const modelKey = this.lib.variantKey(def.model, variant >= 0 ? variant : r.int(0, 999));
    const groundY = parent >= 0 ? (this.placements[parent] as Placement).groundY : this.groundAt(x, z);
    this.placements.push({ defId, modelKey, x, y: y + groundY, z, rotY, paint, rarity, district, parent, groundY });
    return this.placements.length - 1;
  }

  /** Height of the ground surface (road, sidewalk, lot) at a point. */
  groundAt(x: number, z: number): number {
    const col = Math.floor((x + this.halfW) / B);
    const row = Math.floor((z + this.halfH) / B);
    const layout = CITY.layout;
    if (row < 0 || row >= layout.length || col < 0 || col >= (layout[0] as string).length) return 0;
    const d = (layout[row] as string)[col] as DistrictId;
    const lx = Math.abs(x - (-this.halfW + (col + 0.5) * B));
    const lz = Math.abs(z - (-this.halfH + (row + 0.5) * B));
    if (d === 'P' && lx <= HB && lz <= HB) return 0.24;
    if (lx <= HL && lz <= HL) return 0.23;
    if (lx <= HB && lz <= HB) return 0.18;
    return 0.02;
  }

  private top(index: number): number {
    const p = this.placements[index] as Placement;
    return p.y + this.lib.get(p.modelKey).height;
  }

  /** Rotates a local offset by rotY and adds to (x,z). */
  private local(x: number, z: number, rotY: number, lx: number, lz: number): [number, number] {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    return [x + lx * c + lz * s, z - lx * s + lz * c];
  }

  private person(x: number, z: number, d: DistrictId, persona?: Persona, roam = 6): void {
    const r = this.rng;
    const p: Persona = persona ?? r.weighted([
      { item: 'filmer' as Persona, weight: 3 },
      { item: 'runner' as Persona, weight: 5 },
      { item: 'pointer' as Persona, weight: 1.5 },
      { item: 'calm' as Persona, weight: 1 },
    ]);
    this.npcs.push({ kind: 'person', x, z, rotY: r.range(0, Math.PI * 2), persona: p, paint: r.pick(PERSON_PAINTS), district: d, roam });
  }

  private animal(kind: NpcKind, x: number, z: number, d: DistrictId, roam = 5): void {
    this.npcs.push({ kind, x, z, rotY: this.rng.range(0, Math.PI * 2), persona: 'calm', paint: 0xffffff, district: d, roam });
  }

  private scatterProps(d: DistrictId, cx: number, cz: number, halfX: number, halfZ: number, count: number): void {
    const table = DISTRICTS[d].props.map((p) => ({ item: p.id, weight: p.w }));
    for (let i = 0; i < count; i++) {
      const id = this.rng.weighted(table);
      this.place(id, cx + this.rng.range(-halfX, halfX), 0, cz + this.rng.range(-halfZ, halfZ), this.rng.range(0, Math.PI * 2), d);
    }
  }

  private maybeRare(d: DistrictId, cx: number, cz: number, spread: number): void {
    const def = DISTRICTS[d];
    if (def.rares.length === 0 || !this.rng.chance(def.rareChance)) return;
    const id = this.rng.weighted(def.rares.map((r) => ({ item: r.id, weight: r.w })));
    this.place(id, cx + this.rng.range(-spread, spread), 0, cz + this.rng.range(-spread, spread), this.rng.range(0, Math.PI * 2), d);
  }

  private parkedCar(x: number, z: number, rotY: number, d: DistrictId, heavy = false): void {
    const r = this.rng;
    const table = heavy
      ? [
          { item: 'van', weight: 2 },
          { item: 'caminhonete', weight: 2 },
          { item: 'perua', weight: 1 },
          { item: 'hatch', weight: 3 },
          { item: 'seda', weight: 2 },
          { item: 'food_truck', weight: 0.6 },
        ]
      : [
          { item: 'hatch', weight: 5 },
          { item: 'seda', weight: 3 },
          { item: 'besourinho', weight: 1.5 },
          { item: 'taxi', weight: 1 },
          { item: 'perua', weight: 0.8 },
          { item: 'caminhonete', weight: 0.8 },
          { item: 'moto', weight: 1.4 },
        ];
    this.place(r.weighted(table), x, 0, z, rotY + (r.chance(0.5) ? Math.PI : 0), d);
  }

  // ───────────────────────────────────────────── streets (sidewalk + curb stuff for every block)

  private genStreet(blk: BlockInfo): void {
    const { cx, cz, district: d } = blk;
    const r = this.rng;
    const sides: Array<{ nx: number; nz: number }> = [
      { nx: 0, nz: -1 },
      { nx: 0, nz: 1 },
      { nx: -1, nz: 0 },
      { nx: 1, nz: 0 },
    ];
    const urban = d !== 'U' && d !== 'B';
    for (const s of sides) {
      const alongX = s.nz !== 0;
      const rotRoad = alongX ? Math.PI / 2 : 0;
      // poles near the curb, every ~14m
      if (urban || r.chance(0.5)) {
        for (let t = -HB + 5; t <= HB - 5; t += 14) {
          const px = cx + (alongX ? t : s.nx * (HB - 0.6));
          const pz = cz + (alongX ? s.nz * (HB - 0.6) : t);
          const idx = this.place('poste', px, 0, pz, alongX ? (s.nz > 0 ? 0 : Math.PI) : s.nx > 0 ? Math.PI / 2 : -Math.PI / 2, d);
          this.poles.push({ index: idx, x: px, z: pz });
        }
      }
      if (!urban) continue;
      // parked cars along the curb
      const parkOffset = HB + 1.5;
      for (let t = -HB + 4; t <= HB - 4; t += r.range(6.5, 11)) {
        if (!r.chance(d === 'F' || d === 'C' ? 0.6 : 0.42)) continue;
        const px = cx + (alongX ? t : s.nx * parkOffset);
        const pz = cz + (alongX ? s.nz * parkOffset : t);
        this.parkedCar(px, pz, rotRoad, d, d === 'C' || d === 'F');
      }
      // sidewalk life
      const sideOffset = HB - SIDE / 2;
      const nProps = Math.round(r.range(3, 6) * DISTRICTS[d].propDensity);
      for (let i = 0; i < nProps; i++) {
        const t = r.range(-HB + 2, HB - 2);
        const px = cx + (alongX ? t : s.nx * (sideOffset + r.range(-0.8, 0.8)));
        const pz = cz + (alongX ? s.nz * (sideOffset + r.range(-0.8, 0.8)) : t);
        const table = DISTRICTS[d].props.map((p) => ({ item: p.id, weight: p.w }));
        this.place(r.weighted(table), px, 0, pz, r.range(0, Math.PI * 2), d);
      }
      if (r.chance(0.5)) {
        const t = r.range(-HB + 6, HB - 6);
        this.place(r.chance(0.6) ? 'arvore' : 'ipe', cx + (alongX ? t : s.nx * (sideOffset - 0.2)), 0, cz + (alongX ? s.nz * (sideOffset - 0.2) : t), r.range(0, 6), d);
      }
      const walkers = Math.round(r.range(0.2, 1.3) * (d === 'C' || d === 'F' ? 1.5 : 1));
      for (let i = 0; i < walkers; i++) {
        const t = r.range(-HB + 3, HB - 3);
        this.person(cx + (alongX ? t : s.nx * sideOffset), cz + (alongX ? s.nz * sideOffset : t), d);
      }
    }
    // corner stuff
    if (urban && r.chance(0.35)) this.place('semaforo', cx + HB - 0.8, 0, cz + HB - 0.8, Math.PI / 4, d);
    if (urban && r.chance(0.3)) this.place('placa_rua', cx - HB + 0.8, 0, cz - HB + 0.8, 0, d);
  }

  // ───────────────────────────────────────────── districts

  private house(x: number, z: number, rotY: number, d: DistrictId): void {
    const r = this.rng;
    const slab = r.chance(0.55);
    const hIdx = this.place(slab ? 'casa_laje' : 'casa_telhado', x, 0, z, rotY, d);
    if (slab) {
      const top = 3.26;
      const [tx, tz] = this.local(x, z, rotY, 1.6, -1.6);
      this.place('caixa_dagua', tx, top, tz, r.range(0, 6), d, hIdx);
      if (r.chance(0.7)) {
        const [ax, az] = this.local(x, z, rotY, 2.6, 2.2);
        this.place('antena_tv', ax, top, az, r.range(0, 6), d, hIdx);
      }
      if (r.chance(0.5)) {
        const [bx, bz] = this.local(x, z, rotY, 1.4, 0.8);
        this.place(r.pick(['cadeira', 'vaso', 'caixa', 'engradado']), bx, top, bz, r.range(0, 6), d, hIdx);
      }
    } else {
      const rIdx = this.place('telhado', x, 2.9, z, rotY, d, hIdx);
      if (r.chance(0.6)) this.place('antena_tv', x, this.top(rIdx) - 0.2, z, r.range(0, 6), d, rIdx);
    }
    if (r.chance(0.5)) {
      const [ax, az] = this.local(x, z, rotY, -3.75, -1.5);
      this.place('ar_cond', ax, 1.6, az, rotY - Math.PI / 2, d, hIdx);
    }
    // backyard
    const [yx, yz] = this.local(x, z, rotY, 0, -7.2);
    if (r.chance(0.22)) {
      this.place('piscina', yx, 0, yz, rotY + Math.PI / 2, d);
      if (r.chance(0.6)) this.place('piscina_boia', yx + r.range(-1, 1), 0.25, yz + r.range(-1, 1), r.range(0, 6), d);
    } else {
      const items = ['churrasqueira', 'cadeira', 'cadeira', 'mesa_bar', 'bicicleta', 'vaso', 'isopor', 'caixa', 'guarda_sol'];
      const n = r.int(2, 4);
      for (let i = 0; i < n; i++) {
        const [px, pz] = this.local(x, z, rotY, r.range(-3, 3), -7.2 + r.range(-1.5, 1.5));
        this.place(r.pick(items), px, 0, pz, r.range(0, 6), d);
      }
      if (r.chance(0.3)) this.animal('dog', yx, yz, d, 3);
      if (r.chance(0.25)) {
        const [tx, tz] = this.local(x, z, rotY, r.chance(0.5) ? -3.4 : 3.4, -8.5);
        this.place(r.chance(0.5) ? 'coqueiro' : 'arvore', tx, 0, tz, r.range(0, 6), d);
      }
    }
    // front yard
    const [fx, fz] = this.local(x, z, rotY, r.range(-2, 2), 4.9);
    if (r.chance(0.4)) this.place(r.pick(['moto', 'bicicleta', 'vaso', 'lixeira', 'botijao']), fx, 0, fz, r.range(0, 6), d);
    if (r.chance(0.22)) this.person(fx, fz + 0.5, d, r.chance(0.5) ? 'calm' : undefined, 3);
  }

  private genResidential(blk: BlockInfo): void {
    const { cx, cz, district: d } = blk;
    const r = this.rng;
    const lotW = (HL * 2) / 3;
    for (let i = 0; i < 3; i++) {
      const lx = cx - HL + lotW * (i + 0.5);
      // south row faces +Z, north row faces -Z
      this.house(lx + r.range(-0.6, 0.6), cz + HL - 6.2, 0, d);
      this.house(lx + r.range(-0.6, 0.6), cz - HL + 6.2, Math.PI, d);
    }
    // corner bar with plastic chairs (the Brazilian classic)
    if (r.chance(0.4)) {
      const bx = cx + HB - 3;
      const bz = cz + r.range(-6, 6);
      for (let i = 0; i < 3; i++) {
        const tx = bx - 1.2;
        const tz = bz + (i - 1) * 2.4;
        this.place('mesa_bar', tx, 0, tz, 0, d);
        this.place('cadeira', tx - 0.9, 0, tz, Math.PI / 2, d);
        this.place('cadeira', tx + 0.9, 0, tz, -Math.PI / 2, d);
        this.place('engradado', tx + 0.2, 0, tz + 0.9, 0.3, d);
        this.person(tx - 0.9, tz, d, 'sitter', 0);
      }
    }
    this.maybeRare(d, cx, cz, 12);
  }

  private genFavela(blk: BlockInfo): void {
    const { cx, cz, district: d } = blk;
    const r = this.rng;
    const step = 6.6;
    const n = Math.floor((HL * 2) / step);
    for (let ix = 0; ix < n; ix++) {
      for (let iz = 0; iz < n; iz++) {
        if (r.chance(0.12)) continue;
        const x = cx - HL + step * (ix + 0.5) + r.range(-0.4, 0.4);
        const z = cz - HL + step * (iz + 0.5) + r.range(-0.4, 0.4);
        const rot = r.int(0, 3) * (Math.PI / 2);
        const h = this.place('sobrado', x, 0, z, rot, d);
        const [tx, tz] = this.local(x, z, rot, -0.8, -0.8);
        if (r.chance(0.85)) this.place('caixa_dagua', tx, 8.38, tz, r.range(0, 6), d, h);
        if (r.chance(0.4)) {
          const [ax, az] = this.local(x, z, rot, 1.3, 1.6);
          this.place(r.pick(['antena_tv', 'caixa_som', 'cadeira', 'vaso']), ax, 5.8, az, r.range(0, 6), d, h);
        }
      }
    }
    // alleys life
    this.scatterProps(d, cx, cz, HL, HL, 10);
    for (let i = 0; i < 6; i++) this.person(cx + r.range(-HL, HL), cz + r.range(-HL, HL), d, undefined, 4);
    this.maybeRare(d, cx, cz, 10);
  }

  private genCommercial(blk: BlockInfo): void {
    const { cx, cz, district: d } = blk;
    const r = this.rng;
    const shopW = 11.8;
    for (let i = 0; i < 3; i++) {
      const lx = cx - HL + 1 + shopW * i + shopW / 2;
      this.shop(lx, cz + HL - 5.2, 0, d);
      this.shop(lx, cz - HL + 5.2, Math.PI, d);
    }
    // central plaza: feira, food trucks and kiosks
    const mode = r.int(0, 2);
    if (mode === 0) {
      for (let i = 0; i < 6; i++) {
        const x = cx - 12 + (i % 3) * 12;
        const z = cz - 3 + Math.floor(i / 3) * 6;
        this.place('barraca_feira', x, 0, z, 0, d);
        this.person(x + r.range(-1, 1), z + 1.8, d, 'calm', 3);
      }
      this.place('caixa', cx - 14, 0, cz + 7, 0.3, d);
      this.place('caixa', cx - 13.2, 0, cz + 7.5, 1.1, d);
    } else if (mode === 1) {
      this.place('food_truck', cx - 8, 0, cz, Math.PI / 2, d);
      this.place('food_truck', cx + 8, 0, cz, -Math.PI / 2, d);
      this.place('quiosque', cx, 0, cz, 0, d);
      for (let i = 0; i < 6; i++) {
        this.place('mesa_bar', cx + r.range(-6, 6), 0, cz + r.range(-6, 6), r.range(0, 6), d);
        this.place('cadeira', cx + r.range(-6, 6), 0, cz + r.range(-6, 6), r.range(0, 6), d);
      }
      for (let i = 0; i < 5; i++) this.person(cx + r.range(-6, 6), cz + r.range(-6, 6), d, undefined, 4);
    } else {
      for (let i = 0; i < 8; i++) {
        const x = cx - 14 + (i % 4) * 9.2;
        const z = cz - 3.5 + Math.floor(i / 4) * 7;
        if (r.chance(0.75)) this.parkedCar(x, z, 0, d, true);
      }
      this.place('outdoor', cx, 0, cz, 0, d, -1, r.int(0, 4));
    }
    this.scatterProps(d, cx, cz, HL - 12, 8, 6);
    // street furniture on the sidewalk
    this.place('ponto_onibus', cx + r.range(-10, 10), 0, cz + HB - 1.4, 0, d);
    this.place(r.chance(0.5) ? 'banca' : 'orelhao', cx + r.range(-14, 14), 0, cz - HB + 1.4, Math.PI, d);
    this.maybeRare(d, cx, cz, 10);
  }

  private shop(x: number, z: number, rotY: number, d: DistrictId): void {
    const r = this.rng;
    const idx = this.place('loja', x, 0, z, rotY, d);
    const [tx, tz] = this.local(x, z, rotY, r.range(-3, 3), -2);
    this.place('caixa_dagua', tx, 7.3, tz, r.range(0, 6), d, idx);
    if (r.chance(0.5)) {
      const [ax, az] = this.local(x, z, rotY, r.range(-4, 4), 2);
      this.place(r.pick(['ar_cond', 'antena_tv']), ax, 7.3, az, r.range(0, 6), d, idx);
    }
    // stuff in front of the shop
    const [fx, fz] = this.local(x, z, rotY, r.range(-3, 3), 6.3);
    if (r.chance(0.6)) {
      this.place('mesa_bar', fx, 0, fz, 0, d);
      this.place('cadeira', fx + 0.9, 0, fz, -Math.PI / 2, d);
      if (r.chance(0.5)) this.person(fx - 0.9, fz, d, 'sitter', 0);
    }
  }

  private genGasStation(blk: BlockInfo): void {
    const { cx, cz, district: d } = blk;
    this.place('posto', cx, 0, cz + 6, 0, d);
    this.parkedCar(cx - 3.2, cz + 8, 0, d);
    this.parkedCar(cx + 3.2, cz + 5, 0, d);
    this.place('caminhao', cx - 12, 0, cz - 10, Math.PI / 2, d);
    this.place('outdoor', cx + 13, 0, cz - 12, -0.4, d, -1, 0);
    this.place('lixeira', cx + 5, 0, cz - 2, 0, d);
    this.place('botijao', cx + 6, 0, cz - 2.5, 0, d);
    this.place('botijao', cx + 6.6, 0, cz - 2, 0, d);
    this.person(cx + 4, cz + 10, d, 'filmer', 3);
  }

  private genPraca(blk: BlockInfo): void {
    const { cx, cz, district: d } = blk;
    const r = this.rng;
    if (!this.statuePlaced) {
      this.place('estatua', cx, 0, cz, 0, d);
      this.statuePlaced = true;
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = 15;
      this.place(i % 2 ? 'ipe' : 'coqueiro', cx + Math.cos(a) * rr, 0, cz + Math.sin(a) * rr, r.range(0, 6), d);
      this.place('banco_praca', cx + Math.cos(a + 0.3) * 9, 0, cz + Math.sin(a + 0.3) * 9, -a - 0.3 - Math.PI / 2, d);
    }
    this.place('quiosque', cx - 10, 0, cz + 10, 0, d);
    this.place('carrinho_pipoca', cx + 7, 0, cz - 5, 1, d);
    this.place('banca', cx + 12, 0, cz + 10, -0.8, d);
    this.scatterProps(d, cx, cz, HL, HL, 10);
    for (let i = 0; i < 9; i++) this.person(cx + r.range(-14, 14), cz + r.range(-14, 14), d, undefined, 6);
  }

  private genSoccer(blk: BlockInfo): void {
    const { cx, cz, district: d } = blk;
    const r = this.rng;
    this.place('trave', cx, 0, cz - 15.5, 0, d);
    this.place('trave', cx, 0, cz + 15.5, Math.PI, d);
    this.place('bola', cx + r.range(-3, 3), 0, cz + r.range(-3, 3), 0, d);
    for (let i = 0; i < 10; i++) this.person(cx + r.range(-10, 10), cz + r.range(-12, 12), d, 'player', 10);
    // spectators on the side with coolers and chairs
    for (let i = 0; i < 7; i++) {
      const z = cz - 14 + i * 4.5;
      this.place('cadeira', cx + 17.5, 0, z, -Math.PI / 2, d);
      this.person(cx + 18.3, z, d, i % 3 === 0 ? 'filmer' : 'sitter', 0);
      if (i % 2 === 0) this.place('isopor', cx + 18.8, 0, z + 1.6, 0.4, d);
    }
    this.scatterProps(d, cx, cz, HL, HL, 6);
    for (let i = 0; i < 3; i++) this.place('moto', cx - 18, 0, cz - 8 + i * 2.2, Math.PI / 2, d);
  }

  private genIndustrial(blk: BlockInfo): void {
    const { cx, cz, district: d } = blk;
    const r = this.rng;
    const variant = (blk.col + blk.row) % 3;
    if (variant === 0) {
      this.place('galpao', cx - 8, 0, cz, 0, d);
      this.containerStack(cx + 12, cz - 12, d);
      this.containerStack(cx + 12, cz + 4, d);
      this.place('caminhao', cx + 12, 0, cz + 14, Math.PI / 2, d);
    } else if (variant === 1) {
      for (let i = 0; i < 3; i++) this.place('silo', cx - 12 + i * 8, 0, cz - 10, 0, d);
      this.place('guindaste', cx + 10, 0, cz + 8, r.range(0, 6), d);
      this.containerStack(cx - 8, cz + 10, d);
      this.place('carreta', cx + 2, 0, cz - 1, Math.PI / 2, d);
    } else {
      this.place('galpao', cx + 7, 0, cz, 0, d);
      this.containerStack(cx - 13, cz - 13, d);
      this.containerStack(cx - 13, cz + 2, d);
      this.place('caixa_elevada', cx - 12, 0, cz + 14, 0, d);
    }
    for (let i = 0; i < 3; i++) this.place(r.chance(0.5) ? 'empilhadeira' : 'caminhonete', cx + r.range(-16, 16), 0, cz + r.range(-16, 16), r.range(0, 6), d);
    this.scatterProps(d, cx, cz, HL, HL, 12);
    for (let i = 0; i < 3; i++) this.person(cx + r.range(-16, 16), cz + r.range(-16, 16), d, undefined, 5);
    this.maybeRare(d, cx, cz, 12);
  }

  private containerStack(x: number, z: number, d: DistrictId): void {
    const r = this.rng;
    for (let row = 0; row < 3; row++) {
      let parent = -1;
      const levels = r.int(1, 3);
      for (let lvl = 0; lvl < levels; lvl++) {
        parent = this.place('conteiner', x + row * 2.8, lvl * 2.6, z, 0, d, parent);
      }
    }
  }

  private genFinancial(blk: BlockInfo): void {
    const { cx, cz, district: d } = blk;
    const r = this.rng;
    if (!this.skyscraperPlaced && blk.row === 1 && blk.col === 4) {
      this.place('arranha_ceu', cx, 0, cz, 0, d);
      this.skyscraperPlaced = true;
      this.place('onibus_articulado', cx - 16, 0, cz + 16, Math.PI / 2, d);
    } else if (!this.radioTowerPlaced && blk.row === 0 && blk.col === 5) {
      this.place('torre_transmissao', cx + 10, 0, cz + 10, 0, d);
      this.radioTowerPlaced = true;
      this.tower('predio', cx - 9, cz - 9, d);
    } else {
      const layout = r.int(0, 2);
      if (layout === 0) {
        this.tower('torre_escritorio', cx - 9, cz - 9, d);
        this.tower('predio', cx + 10, cz + 10, d);
        this.tower('predio', cx + 10, cz - 10, d);
      } else if (layout === 1) {
        this.tower('predio', cx - 10, cz - 10, d);
        this.tower('predio', cx - 10, cz + 10, d);
        this.tower('torre_escritorio', cx + 9, cz, d);
      } else {
        this.tower('torre_escritorio', cx, cz - 8, d);
        this.place('outdoor', cx - 10, 0, cz + 13, 0, d, -1, r.int(0, 4));
        this.place('onibus', cx + 8, 0, cz + 12, Math.PI / 2, d);
      }
    }
    this.scatterProps(d, cx, cz, HL, HL, 6);
    for (let i = 0; i < 4; i++) this.person(cx + r.range(-18, 18), cz + r.range(-18, 18), d, undefined, 5);
    this.maybeRare(d, cx, cz, 12);
  }

  private tower(id: string, x: number, z: number, d: DistrictId): void {
    const r = this.rng;
    const idx = this.place(id, x, 0, z, r.int(0, 3) * (Math.PI / 2), d);
    if (id === 'predio') {
      const roof = 36.6;
      this.place('caixa_dagua', x - 4, roof, z + 3.5, r.range(0, 6), d, idx);
      this.place('caixa_dagua', x - 1.5, roof, z + 4, r.range(0, 6), d, idx);
      this.place('antena_tv', x + 5, roof, z + 5, 0, d, idx);
      this.place('ar_cond', x - 5, roof, z - 5, 0, d, idx);
    } else {
      const roof = 56.5;
      this.place('ar_cond', x + 6, roof, z + 6, 0, d, idx);
      this.place('ar_cond', x - 6, roof, z + 6, 0, d, idx);
    }
  }

  private genBase(blk: BlockInfo): void {
    const { cx, cz, district: d } = blk;
    const r = this.rng;
    const variant = (blk.col * 3 + blk.row) % 4;
    if (variant === 0) {
      this.place('hangar', cx, 0, cz - 4, 0, d);
      this.place('jato', cx - 4, 0, cz + 16, Math.PI, d);
      this.place('jato', cx + 6, 0, cz + 16, Math.PI, d);
    } else if (variant === 1) {
      this.place('radar', cx - 8, 0, cz - 8, 0, d);
      this.place('antiaereo', cx + 12, 0, cz + 12, r.range(0, 6), d);
      this.place('antiaereo', cx - 12, 0, cz + 12, r.range(0, 6), d);
      this.place('helicoptero', cx + 10, 0, cz - 8, 0.4, d);
    } else if (variant === 2) {
      this.place('torre_controle', cx, 0, cz, 0, d);
      this.place('caminhao_mil', cx - 14, 0, cz + 10, Math.PI / 2, d);
      this.place('caminhao_mil', cx - 14, 0, cz + 2, Math.PI / 2, d);
      this.place('antiaereo', cx + 14, 0, cz - 14, r.range(0, 6), d);
    } else {
      this.place('hangar', cx + 4, 0, cz + 2, Math.PI / 2, d);
      this.place('radar', cx - 13, 0, cz - 13, 0, d);
      this.place('helicoptero', cx - 12, 0, cz + 14, 1.2, d);
    }
    for (let i = 0; i < 3; i++) this.place('silo', cx + 15 - i * 0.1, 0, cz - 16 + i * 7.5, 0, d);
    this.scatterProps(d, cx, cz, HL, HL, 8);
    for (let i = 0; i < 3; i++) this.person(cx + r.range(-16, 16), cz + r.range(-16, 16), d, 'runner', 6);
    this.maybeRare(d, cx, cz, 14);
  }

  private genRural(blk: BlockInfo): void {
    const { cx, cz, district: d } = blk;
    const r = this.rng;
    const hx = cx + r.range(-6, 6);
    const hz = cz + r.range(-6, 6);
    const hIdx = this.place('casa_telhado', hx, 0, hz, r.int(0, 3) * (Math.PI / 2), d);
    this.place('telhado', hx, 2.9, hz, (this.placements[hIdx] as Placement).rotY, d, hIdx);
    for (let i = 0; i < 4; i++) this.animal('cow', cx + r.range(-18, 18), cz + r.range(-18, 18), d, 8);
    for (let i = 0; i < 7; i++) this.animal('chicken', hx + r.range(-8, 8), hz + r.range(-8, 8), d, 4);
    for (let i = 0; i < 6; i++) this.place(r.pick(['coqueiro', 'arvore', 'ipe']), cx + r.range(-19, 19), 0, cz + r.range(-19, 19), r.range(0, 6), d);
    this.parkedCar(hx + 8, hz, 0, d, true);
    this.animal('dog', hx + 3, hz + 5, d, 5);
    this.scatterProps(d, cx, cz, HL, HL, 7);
    this.maybeRare(d, cx, cz, 14);
    if (r.chance(0.5)) this.person(hx + 4, hz + 4, d, 'calm', 4);
  }

  /** Decorative ring outside the city so the horizon never looks empty. */
  private genOutskirts(halfW: number, halfH: number): void {
    const r = this.rng;
    for (let i = 0; i < 90; i++) {
      const side = r.int(0, 3);
      const t = r.range(-1, 1);
      const out = r.range(8, 60);
      let x = 0;
      let z = 0;
      if (side === 0) [x, z] = [t * (halfW + 40), -halfH - out];
      else if (side === 1) [x, z] = [t * (halfW + 40), halfH + out];
      else if (side === 2) [x, z] = [-halfW - out, t * (halfH + 40)];
      else [x, z] = [halfW + out, t * (halfH + 40)];
      this.place(r.pick(['coqueiro', 'arvore', 'arvore', 'ipe']), x, 0, z, r.range(0, 6), 'U');
    }
  }

  private buildWires(): void {
    // connect consecutive poles along the same street side (short spans only)
    const byLine = new Map<string, Array<{ index: number; x: number; z: number }>>();
    for (const p of this.poles) {
      const kx = `x:${Math.round(p.x * 2)}`;
      const kz = `z:${Math.round(p.z * 2)}`;
      (byLine.get(kx) ?? byLine.set(kx, []).get(kx)!).push(p);
      (byLine.get(kz) ?? byLine.set(kz, []).get(kz)!).push(p);
    }
    const seen = new Set<string>();
    for (const [key, list] of byLine) {
      if (list.length < 2) continue;
      const alongZ = key.startsWith('x:');
      list.sort((a, b) => (alongZ ? a.z - b.z : a.x - b.x));
      for (let i = 0; i < list.length - 1; i++) {
        const a = list[i]!;
        const b = list[i + 1]!;
        const dist = Math.hypot(a.x - b.x, a.z - b.z);
        if (dist > 20) continue;
        // not every street is a spaghetti of cables
        if (((a.index * 7 + b.index * 13) % 10) > 6) continue;
        const k = a.index < b.index ? `${a.index}-${b.index}` : `${b.index}-${a.index}`;
        if (seen.has(k)) continue;
        seen.add(k);
        this.wires.push([a.index, b.index]);
      }
    }
  }

  // ───────────────────────────────────────────── ground

  private buildGround(halfW: number, halfH: number, cols: number, rows: number): BufferGeometry {
    const g = new ModelBuilder(this.atlas.white);
    const ext = 700;
    g.box(ext * 2, 0.2, ext * 2, 0x78a650, 0, -0.12, 0);
    g.box(halfW * 2 + ROAD, 0.1, halfH * 2 + ROAD, 0x45474d, 0, -0.03, 0);
    for (const blk of this.blocks) {
      const def = DISTRICTS[blk.district];
      const praca = blk.district === 'P';
      if (!praca) g.box(HB * 2, 0.18, HB * 2, blk.district === 'U' ? 0x9c8f73 : 0xc9c4b8, blk.cx, 0.09, blk.cz);
      // curb lip
      if (blk.district !== 'U') g.box(HB * 2 + 0.3, 0.1, HB * 2 + 0.3, 0xa39f95, blk.cx, 0.05, blk.cz);
      if (!praca) g.box(HL * 2, 0.06, HL * 2, def.groundColor, blk.cx, 0.2, blk.cz);
      if (blk.district === 'S') {
        g.box(24, 0.02, 34, 0x5f9e3f, blk.cx, 0.24, blk.cz);
        const line = 0xf4f4f0;
        g.box(24, 0.02, 0.2, line, blk.cx, 0.26, blk.cz);
        g.box(0.2, 0.02, 34, line, blk.cx - 12, 0.26, blk.cz).box(0.2, 0.02, 34, line, blk.cx + 12, 0.26, blk.cz);
        g.box(24, 0.02, 0.2, line, blk.cx, 0.26, blk.cz - 17).box(24, 0.02, 0.2, line, blk.cx, 0.26, blk.cz + 17);
        g.torus(4, 0.1, 3, 24, line, blk.cx, 0.26, blk.cz, { rx: Math.PI / 2, sz: 0.1 });
      }
      if (blk.district === 'B') {
        g.box(10, 0.02, HL * 2, 0x55575c, blk.cx - 12, 0.25, blk.cz);
        for (let i = -3; i <= 3; i++) g.box(0.4, 0.02, 3, 0xf4f4f0, blk.cx - 12, 0.27, blk.cz + i * 5.5);
      }
    }
    // lane markings: yellow dashed center line on every road, zebra crossings at every approach
    const up = { rx: -Math.PI / 2, noAO: true };
    for (let c = 0; c <= cols; c++) {
      const x = -halfW + c * B;
      for (let z = -halfH; z < halfH; z += 5) {
        const m = (z + halfH) % B;
        if (m < 9 || m > B - 11) continue;
        g.quad(0.22, 2.4, 0xf2c12e, x, 0.05, z + 1.2, up);
      }
    }
    for (let rr = 0; rr <= rows; rr++) {
      const z = -halfH + rr * B;
      for (let x = -halfW; x < halfW; x += 5) {
        const m = (x + halfW) % B;
        if (m < 9 || m > B - 11) continue;
        g.quad(2.4, 0.22, 0xf2c12e, x + 1.2, 0.05, z, up);
      }
    }
    const off = ROAD / 2 + 1.8;
    for (let c = 0; c <= cols; c++) {
      for (let rr = 0; rr <= rows; rr++) {
        const x = -halfW + c * B;
        const z = -halfH + rr * B;
        for (let i = -4; i <= 4; i++) {
          if (rr < rows) g.quad(0.7, 2.6, 0xf1f1ec, x + i * 1.35, 0.05, z + off, up);
          if (rr > 0) g.quad(0.7, 2.6, 0xf1f1ec, x + i * 1.35, 0.05, z - off, up);
          if (c < cols) g.quad(2.6, 0.7, 0xf1f1ec, x + off, 0.05, z + i * 1.35, up);
          if (c > 0) g.quad(2.6, 0.7, 0xf1f1ec, x - off, 0.05, z + i * 1.35, up);
        }
      }
    }
    return g.build({ ao: false });
  }

  private buildCalcada(): BufferGeometry {
    const g = new ModelBuilder(this.atlas.white);
    for (const blk of this.blocks) {
      if (blk.district === 'P') {
        g.box(HB * 2, 0.24, HB * 2, 0xffffff, blk.cx, 0.12, blk.cz);
      } else if (blk.district === 'F' || blk.district === 'C') {
        // sidewalk strips in calçada portuguesa
        g.box(HB * 2, 0.2, SIDE, 0xffffff, blk.cx, 0.1, blk.cz + HB - SIDE / 2);
        g.box(HB * 2, 0.2, SIDE, 0xffffff, blk.cx, 0.1, blk.cz - HB + SIDE / 2);
      }
    }
    const geo = g.build({ ao: false });
    // planar world UVs (4m tile)
    const pos = geo.getAttribute('position');
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 4, pos.getZ(i) / 4);
    uv.needsUpdate = true;
    return geo;
  }
}
