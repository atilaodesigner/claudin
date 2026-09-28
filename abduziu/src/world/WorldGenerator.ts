import { BufferAttribute, BufferGeometry, Color } from 'three';
import { ModelBuilder } from '../assets/ModelBuilder';
import type { ModelLibrary } from '../assets/ModelLibrary';
import type { CityDef } from '../config/cities';
import { DISTRICTS, GRID, type DistrictId } from '../config/districts';
import { getObjectDef, type Rarity } from '../config/objects';
import type { TextureAtlas } from '../rendering/TextureAtlas';
import { Rng } from '../utils/rng';
import { CityGrid, HB, HL, type Rect } from './CityGrid';

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

export interface BackdropPlacement {
  model: string;
  x: number;
  z: number;
  rotY: number;
  scale: number;
}

export interface GenResult {
  placements: Placement[];
  npcs: NpcSpawn[];
  wires: Array<[number, number]>;
  blocks: BlockInfo[];
  ground: BufferGeometry;
  calcada: BufferGeometry;
  water: BufferGeometry | null;
  backdrop: BackdropPlacement[];
  grid: CityGrid;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  start: { x: number; z: number };
  roadLines: { xs: number[]; zs: number[] };
  /** Tile size when the city wraps around (arena): leaving one edge enters the opposite one. */
  wrap: { w: number; h: number } | null;
}

const B = GRID.blockSize;
const ROAD = GRID.roadWidth;
const SIDE = GRID.sidewalk;
const HALF_PI = Math.PI / 2;
const SIDES = [0, 1, 2, 3] as const;
/** Outward normal of each block side (0 north, 1 south, 2 west, 3 east). */
const SIDE_N: ReadonlyArray<[number, number]> = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

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
  private trioPlaced = false;
  private mercadaoPlaced = false;
  private festaPlaced = 0;
  private readonly grid: CityGrid;

  constructor(
    private readonly lib: ModelLibrary,
    private readonly atlas: TextureAtlas,
    seed: number,
    private readonly city: CityDef,
    /** Seamless tile (arena): no outskirts/backdrop, ground and water end exactly at the tile edge. */
    private readonly wrap = false,
  ) {
    this.rng = new Rng(seed);
    this.grid = new CityGrid(city);
  }

  private has(feature: CityDef['features'][number]): boolean {
    return this.city.features.includes(feature);
  }

  generate(): GenResult {
    const layout = this.city.layout;
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
        case 'W':
          this.genWater(blk);
          break;
        case 'A':
          this.genBeach(blk);
          break;
        case 'K':
          this.genColonial(blk);
          break;
        case 'Q':
          this.genSuperquadra(blk);
          break;
        case 'G':
          this.genEsplanada(blk);
          break;
        case 'M':
          this.genForest(blk);
          break;
        case 'L':
          this.genLandmark(blk);
          break;
      }
      if (blk.district !== 'W') this.genStreet(blk);
      this.rng = prev;
    }
    this.genCityFeatures();
    if (!this.wrap) this.genOutskirts(halfW, halfH);
    this.buildWires();

    const start = this.city.start;
    const startBlock = (this.blocks.find((b) => b.col === start.col && b.row === start.row) ?? this.blocks[0]) as BlockInfo;
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
      water: this.buildWater(),
      backdrop: this.wrap ? [] : this.backdrop(),
      grid: this.grid,
      // a wrapping tile spans the city plus one road width, so the seam is a double avenue
      bounds: this.wrap ? { minX: -halfW - ROAD / 2, maxX: halfW + ROAD / 2, minZ: -halfH - ROAD / 2, maxZ: halfH + ROAD / 2 } : { minX: -halfW - 30, maxX: halfW + 30, minZ: -halfH - 30, maxZ: halfH + 30 },
      wrap: this.wrap ? { w: halfW * 2 + ROAD, h: halfH * 2 + ROAD } : null,
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

  /** Height of the ground surface (road, sidewalk, lot, sand, water) at a point. */
  groundAt(x: number, z: number): number {
    return this.grid.groundAt(x, z);
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

  /** District prop table plus this city's local extras. */
  private propTable(d: DistrictId): Array<{ item: string; weight: number }> {
    const base = DISTRICTS[d].props.map((p) => ({ item: p.id, weight: p.w }));
    for (const p of this.city.extraProps?.[d] ?? []) base.push({ item: p.id, weight: p.w });
    return base;
  }

  private scatterProps(d: DistrictId, cx: number, cz: number, halfX: number, halfZ: number, count: number): void {
    const table = this.propTable(d);
    if (table.length === 0) return;
    for (let i = 0; i < count; i++) {
      const id = this.rng.weighted(table);
      this.place(id, cx + this.rng.range(-halfX, halfX), 0, cz + this.rng.range(-halfZ, halfZ), this.rng.range(0, Math.PI * 2), d);
    }
  }

  private maybeRare(d: DistrictId, cx: number, cz: number, spread: number): void {
    const def = DISTRICTS[d];
    const local = this.city.extraRares?.[d] ?? [];
    const table = [...def.rares, ...local].map((r) => ({ item: r.id, weight: r.w }));
    const chance = local.length > 0 ? Math.max(def.rareChance, 0.14) : def.rareChance;
    if (table.length === 0 || !this.rng.chance(chance)) return;
    const id = this.rng.weighted(table);
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
          { item: 'lotacao', weight: 1.2 },
          { item: 'uno_escada', weight: 0.8 },
        ]
      : [
          { item: 'hatch', weight: 5 },
          { item: 'seda', weight: 3 },
          { item: 'besourinho', weight: 1.5 },
          { item: 'taxi', weight: 1 },
          { item: 'perua', weight: 0.8 },
          { item: 'caminhonete', weight: 0.8 },
          { item: 'moto', weight: 1.4 },
          { item: 'quadradinho', weight: 1.4 },
          { item: 'brasilia_amarela', weight: 0.5 },
          { item: 'uno_escada', weight: 0.7 },
          { item: 'opala', weight: 0.6 },
          { item: 'carro_pamonha', weight: 0.35 },
          { item: 'moto_entrega', weight: 0.6 },
        ];
    this.place(r.weighted(table), x, 0, z, rotY + (r.chance(0.5) ? Math.PI : 0), d);
  }

  // ───────────────────────────────────────────── streets (sidewalk + curb stuff for every block)

  private genStreet(blk: BlockInfo): void {
    const { cx, cz, district: d, col, row } = blk;
    const r = this.rng;
    const urban = d !== 'U' && d !== 'B' && d !== 'M';
    const table = this.propTable(d);
    for (const side of SIDES) {
      // no street where the block meets water or sand (beaches, rivers)
      if (!this.grid.sideRoad(col, row, side)) continue;
      const [nx, nz] = SIDE_N[side] as [number, number];
      const alongX = nz !== 0;
      const rotRoad = alongX ? HALF_PI : 0;
      // poles near the curb, every ~14m
      if (d !== 'M' && (urban || r.chance(0.5))) {
        for (let t = -HB + 5; t <= HB - 5; t += 14) {
          const px = cx + (alongX ? t : nx * (HB - 0.6));
          const pz = cz + (alongX ? nz * (HB - 0.6) : t);
          const idx = this.place('poste', px, 0, pz, alongX ? (nz > 0 ? 0 : Math.PI) : nx > 0 ? HALF_PI : -HALF_PI, d);
          this.poles.push({ index: idx, x: px, z: pz });
        }
      }
      if (!urban) continue;
      // parked cars along the curb
      const parkOffset = HB + 1.5;
      for (let t = -HB + 4; t <= HB - 4; t += r.range(6.5, 11)) {
        if (!r.chance(d === 'F' || d === 'C' ? 0.6 : d === 'A' ? 0.3 : 0.42)) continue;
        const px = cx + (alongX ? t : nx * parkOffset);
        const pz = cz + (alongX ? nz * parkOffset : t);
        this.parkedCar(px, pz, rotRoad, d, d === 'C' || d === 'F');
      }
      // sidewalk life
      const sideOffset = HB - SIDE / 2;
      const nProps = table.length ? Math.round(r.range(3, 6) * DISTRICTS[d].propDensity) : 0;
      for (let i = 0; i < nProps; i++) {
        const t = r.range(-HB + 2, HB - 2);
        const px = cx + (alongX ? t : nx * (sideOffset + r.range(-0.8, 0.8)));
        const pz = cz + (alongX ? nz * (sideOffset + r.range(-0.8, 0.8)) : t);
        this.place(r.weighted(table), px, 0, pz, r.range(0, Math.PI * 2), d);
      }
      if (r.chance(0.5)) {
        const t = r.range(-HB + 6, HB - 6);
        const tree = d === 'A' ? 'coqueiro' : this.city.id === 'manaus' && r.chance(0.4) ? 'palmeira_acai' : r.chance(0.6) ? 'arvore' : 'ipe';
        this.place(tree, cx + (alongX ? t : nx * (sideOffset - 0.2)), 0, cz + (alongX ? nz * (sideOffset - 0.2) : t), r.range(0, 6), d);
      }
      const walkers = Math.round(r.range(0.2, 1.3) * (d === 'C' || d === 'F' || d === 'K' || d === 'L' ? 1.5 : 1));
      for (let i = 0; i < walkers; i++) {
        const t = r.range(-HB + 3, HB - 3);
        this.person(cx + (alongX ? t : nx * sideOffset), cz + (alongX ? nz * sideOffset : t), d);
      }
    }
    // corner stuff (only where both streets exist)
    if (urban && this.grid.sideRoad(col, row, 1) && this.grid.sideRoad(col, row, 3) && r.chance(0.35)) this.place('semaforo', cx + HB - 0.8, 0, cz + HB - 0.8, Math.PI / 4, d);
    if (urban && this.grid.sideRoad(col, row, 0) && this.grid.sideRoad(col, row, 2) && r.chance(0.3)) this.place('placa_rua', cx - HB + 0.8, 0, cz - HB + 0.8, 0, d);
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
      const items = ['churrasqueira', 'cadeira', 'cadeira', 'mesa_bar', 'bicicleta', 'vaso', 'isopor', 'caixa', 'guarda_sol', 'tanque', 'varal', 'rede_dormir', 'filtro_barro', 'gaiola', 'ventilador', 'cama_elastica', 'carrinho_rolima'];
      const n = r.int(2, 4);
      for (let i = 0; i < n; i++) {
        const [px, pz] = this.local(x, z, rotY, r.range(-3, 3), -7.2 + r.range(-1.5, 1.5));
        this.place(r.pick(items), px, 0, pz, r.range(0, 6), d);
      }
      if (r.chance(0.3)) this.animal('dog', yx, yz, d, 3);
      if (r.chance(0.25)) {
        const [tx, tz] = this.local(x, z, rotY, r.chance(0.5) ? -3.4 : 3.4, -8.5);
        this.place(r.pick(['coqueiro', 'arvore', 'mangueira', 'jaqueira', 'cajueiro']), tx, 0, tz, r.range(0, 6), d);
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
    const church = r.chance(0.12) ? (r.chance(0.35) ? 'igreja_matriz' : 'capela') : null;
    for (let i = 0; i < 3; i++) {
      const lx = cx - HL + lotW * (i + 0.5);
      // south row faces +Z, north row faces -Z
      this.house(lx + r.range(-0.6, 0.6), cz + HL - 6.2, 0, d);
      if (church && i === 1) this.place(church, lx, 0, cz - HL + (church === 'capela' ? 5.2 : 10.2), Math.PI, d);
      else this.house(lx + r.range(-0.6, 0.6), cz - HL + 6.2, Math.PI, d);
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
    // central plaza: feira, food trucks and kiosks (Salvador: a trio elétrico and its pipoca)
    let mode = r.int(0, 4);
    if (mode === 4 && this.mercadaoPlaced) mode = 0;
    if (mode === 3 && this.festaPlaced >= 2) mode = 1;
    if (this.has('trio') && !this.trioPlaced) {
      this.trioPlaced = true;
      this.place('trio_eletrico', cx, 0, cz, HALF_PI, d);
      for (let i = 0; i < 12; i++) this.person(cx + r.range(-14, 14), cz + r.range(-9, 9), d, i % 4 === 0 ? 'filmer' : 'dancer', 4);
      this.place('baiana_acaraje', cx - 14, 0, cz + 8, 0.4, d);
      this.place('isopor', cx + 12, 0, cz - 8, 0, d);
    } else if (mode === 0) {
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
    } else if (mode === 3) {
      // festa: a carnival float in the carnival capitals, a ferris wheel elsewhere
      this.festaPlaced++;
      const carnaval = this.city.id === 'rio' || this.city.id === 'recife' || this.city.id === 'salvador';
      this.place(carnaval ? 'carro_alegorico' : 'roda_gigante', cx, 0, cz, HALF_PI, d);
      for (const [x, z] of [[-15, -6], [15, 6], [-15, 6]] as const) this.place(r.pick(['carrinho_churros', 'carrinho_picole', 'carrinho_hotdog', 'carrinho_pipoca']), cx + x, 0, cz + z, r.range(0, 6), d);
      for (let i = 0; i < 8; i++) this.person(cx + r.range(-14, 14), cz + r.range(-8, 8), d, i % 3 === 0 ? 'filmer' : 'dancer', 4);
    } else if (mode === 4) {
      this.mercadaoPlaced = true;
      this.place('mercadao', cx, 0, cz - 1, 0, d);
      this.place('carroca', cx - 15, 0, cz + 8, 0.3, d);
      for (let i = 0; i < 4; i++) this.person(cx + r.range(-10, 10), cz + 9 + r.range(-1, 1), d, 'calm', 3);
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
    if (r.chance(0.08)) {
      this.place('borracharia', x, 0, z - Math.cos(rotY) * 0.6, rotY, d);
      return;
    }
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
    this.place(this.rng.pick(['caminhao', 'caminhao_gas', 'caminhao_pipa', 'onibus_excursao']), cx - 12, 0, cz - 10, Math.PI / 2, d);
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
    } else if (r.chance(0.7)) {
      this.place('coreto', cx, 0, cz, r.range(0, 6), d);
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
    this.maybeRare(d, cx, cz, 12);
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
    this.place(r.pick(['caminhao_lixo', 'betoneira', 'caminhao_pipa', 'caminhao_gas']), cx + r.range(-6, 6), 0, cz + 16, HALF_PI, d);
    if (r.chance(0.6)) this.place('cacamba', cx - 16, 0, cz + r.range(-6, 6), 0, d);
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
      if (this.has('helipads') && r.chance(0.25)) this.place('heli_civil', x + 1.5, roof, z - 2.5, r.range(0, 6), d, idx);
    } else {
      const roof = 56.5;
      this.place('ar_cond', x + 6, roof, z + 6, 0, d, idx);
      this.place('ar_cond', x - 6, roof, z + 6, 0, d, idx);
      if (this.has('helipads') && r.chance(0.7)) this.place('heli_civil', x, roof, z - 1, r.range(0, 6), d, idx);
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
    const ruralTrees = this.city.id === 'nova_aurora' || this.city.id === 'sao_paulo' ? ['arvore', 'ipe', 'araucaria', 'mangueira', 'jaqueira'] : ['coqueiro', 'arvore', 'ipe', 'mangueira', 'cajueiro', 'jaqueira'];
    for (let i = 0; i < 6; i++) this.place(r.pick(ruralTrees), cx + r.range(-19, 19), 0, cz + r.range(-19, 19), r.range(0, 6), d);
    // the sítio's extras: a mud hut, a tractor, a chapel or a phone tower on the corner
    const ex = hx > cx ? cx - 13 : cx + 13;
    const ez = hz > cz ? cz - 13 : cz + 13;
    const extra = r.weighted([
      { item: 'pau_a_pique', weight: 3 },
      { item: 'torre_celular', weight: 2 },
      { item: 'capela', weight: 1 },
      { item: 'trator', weight: 2 },
      { item: 'none', weight: 2 },
    ]);
    if (extra !== 'none') this.place(extra, ex, 0, ez, r.int(0, 3) * HALF_PI, d);
    this.parkedCar(hx + 8, hz, 0, d, true);
    this.animal('dog', hx + 3, hz + 5, d, 5);
    this.scatterProps(d, cx, cz, HL, HL, 7);
    this.maybeRare(d, cx, cz, 14);
    if (r.chance(0.5)) this.person(hx + 4, hz + 4, d, 'calm', 4);
  }

  // ───────────────────────────────────────────── regional districts

  /** Rivers, bays and the sea: boats, floating houses, palafitas near the shore. */
  private genWater(blk: BlockInfo): void {
    const { cx, cz, col, row, district: d } = blk;
    const r = this.rng;
    const g = this.grid;
    const rect = g.waterRect(col, row, false);
    const pad = 7;
    const n = this.city.boats.length ? r.int(0, 2) : 0;
    const table = this.city.boats.map((b) => ({ item: b.id, weight: b.w }));
    for (let i = 0; i < n; i++) {
      const x = r.range(rect.x0 + pad, rect.x1 - pad);
      const z = r.range(rect.z0 + pad, rect.z1 - pad);
      this.place(r.weighted(table), x, 0, z, r.range(0, Math.PI * 2), d);
    }
    // life along the banks
    for (const side of SIDES) {
      const n2 = g.neighbor(col, row, side);
      if (n2 === null || g.isWet(n2)) continue;
      const [nx, nz] = SIDE_N[side] as [number, number];
      const alongX = nz !== 0;
      const edge = alongX ? (nz < 0 ? rect.z0 : rect.z1) : nx < 0 ? rect.x0 : rect.x1;
      const inward = alongX ? -nz : -nx;
      if (this.has('palafitas')) {
        for (let t = -18; t <= 18; t += 12) {
          if (!r.chance(0.7)) continue;
          const off = edge + inward * 7;
          const [x, z] = alongX ? [cx + t + r.range(-2, 2), off] : [off, cz + t + r.range(-2, 2)];
          this.place('palafita', x, 0.3, z, alongX ? (nz < 0 ? Math.PI : 0) : nx < 0 ? -HALF_PI : HALF_PI, d);
        }
      }
      if (this.has('jacares') && r.chance(0.6)) {
        const t = r.range(-20, 20);
        const off = edge + inward * 2.5;
        const [x, z] = alongX ? [cx + t, off] : [off, cz + t];
        this.place('jacare', x, 0.2, z, r.range(0, Math.PI * 2), d);
      }
    }
    if (this.city.secret === 'boto' && r.chance(0.18)) this.place('boto', cx + r.range(-12, 12), 0.1, cz + r.range(-12, 12), r.range(0, 6), d);
  }

  /** Sand, umbrellas, kiosks and the calçadão on the land side. */
  private genBeach(blk: BlockInfo): void {
    const { cx, cz, col, row, district: d } = blk;
    const r = this.rng;
    const g = this.grid;
    // direction toward the water (sum of wet neighbors)
    let wx = 0;
    let wz = 0;
    for (const side of SIDES) {
      if (!g.waterSide(col, row, side)) continue;
      const [nx, nz] = SIDE_N[side] as [number, number];
      wx += nx;
      wz += nz;
    }
    if (wx === 0 && wz === 0) wz = 1;
    const len = Math.hypot(wx, wz);
    wx /= len;
    wz /= len;
    const faceLand = Math.atan2(-wx, -wz);
    // rows of umbrellas with chairs and people
    const sand = g.sandRect(col, row);
    const spanX = (sand.x1 - sand.x0) / 2 - 4;
    const spanZ = (sand.z1 - sand.z0) / 2 - 4;
    for (let i = 0; i < 9; i++) {
      const x = cx + r.range(-spanX, spanX) * 0.8;
      const z = cz + r.range(-spanZ, spanZ) * 0.8;
      this.place('guarda_sol', x, 0, z, r.range(0, 6), d);
      this.place('cadeira_praia', x + 0.9, 0, z + 0.4, faceLand + Math.PI + r.range(-0.3, 0.3), d);
      if (r.chance(0.6)) this.place('cadeira_praia', x - 0.9, 0, z + 0.4, faceLand + Math.PI + r.range(-0.3, 0.3), d);
      if (r.chance(0.5)) this.person(x, z + 1.2, d, 'sitter', 1);
      if (r.chance(0.3)) this.place(r.pick(['isopor', 'prancha', 'bola', 'coco']), x + r.range(-1.5, 1.5), 0, z + r.range(-1.5, 1.5), r.range(0, 6), d);
    }
    this.scatterProps(d, cx, cz, spanX, spanZ, 8);
    // kiosk and coconut trees on the land side, boats pulled up on the water side
    this.place('quiosque', cx - wx * 13 + r.range(-6, 6) * Math.abs(wz), 0, cz - wz * 13 + r.range(-6, 6) * Math.abs(wx), 0, d);
    for (let i = 0; i < 5; i++) {
      const t = -16 + i * 8;
      this.place('coqueiro', cx - wx * 17 + t * Math.abs(wz), 0, cz - wz * 17 + t * Math.abs(wx), r.range(0, 6), d);
    }
    if (r.chance(0.5)) this.place('barraca_praia', cx - wx * 6 + r.range(-10, 10) * Math.abs(wz), 0, cz - wz * 6 + r.range(-10, 10) * Math.abs(wx), faceLand, d);
    if (r.chance(0.4)) this.place('rede_volei', cx + r.range(-6, 6), 0, cz + r.range(-6, 6), faceLand + HALF_PI, d);
    if (this.has('lifeguards') && (col + row) % 2 === 0) this.place('salva_vidas', cx + wx * 8, 0, cz + wz * 8, faceLand, d);
    if (this.has('shark_signs')) this.place('placa_tubarao', cx + wx * 14 + r.range(-8, 8) * Math.abs(wz), 0, cz + wz * 14 + r.range(-8, 8) * Math.abs(wx), faceLand, d);
    if (this.has('jangadas') && r.chance(0.7)) this.place('jangada', cx + wx * 18 + r.range(-10, 10) * Math.abs(wz), 0, cz + wz * 18 + r.range(-10, 10) * Math.abs(wx), faceLand + HALF_PI, d);
    for (let i = 0; i < 5; i++) this.person(cx + r.range(-spanX, spanX), cz + r.range(-spanZ, spanZ), d, r.pick(['player', 'calm', 'filmer', 'runner'] as Persona[]), 6);
    this.maybeRare(d, cx, cz, 12);
  }

  /** Centro histórico: colorful colonial row houses around a cobbled largo. */
  private genColonial(blk: BlockInfo): void {
    const { cx, cz, district: d } = blk;
    const r = this.rng;
    const edge = HL - 4.6;
    for (let i = 0; i < 5; i++) {
      const x = cx - 12.8 + i * 6.4;
      this.place('sobrado_colonial', x, 0, cz + edge, 0, d);
      this.place('sobrado_colonial', x, 0, cz - edge, Math.PI, d);
    }
    for (let i = 0; i < 2; i++) {
      const z = cz - 3.4 + i * 6.8;
      this.place('sobrado_colonial', cx + edge, 0, z, HALF_PI, d);
      this.place('sobrado_colonial', cx - edge, 0, z, -HALF_PI, d);
    }
    // largo: a bandstand or tables, vendors, tourists
    const coreto = r.chance(0.45);
    if (coreto) this.place('coreto', cx, 0, cz, r.range(0, 6), d);
    for (let i = 0; i < (coreto ? 0 : 4); i++) {
      const x = cx + r.range(-6, 6);
      const z = cz + r.range(-5, 5);
      this.place('mesa_bar', x, 0, z, 0, d);
      this.place('cadeira', x + 0.9, 0, z, -HALF_PI, d);
      this.person(x - 0.9, z, d, 'sitter', 0);
    }
    this.scatterProps(d, cx, cz, 7, 6, 6);
    for (let i = 0; i < 6; i++) this.person(cx + r.range(-7, 7), cz + r.range(-6, 6), d, r.chance(0.5) ? 'filmer' : 'dancer', 3);
    this.maybeRare(d, cx, cz, 6);
  }

  /** Brasília's superquadras: slabs on pilotis over a sea of lawn and ipês. */
  private genSuperquadra(blk: BlockInfo): void {
    const { cx, cz, district: d } = blk;
    const r = this.rng;
    const v = (blk.col + blk.row) % 3;
    if (v === 0) {
      this.place('bloco_pilotis', cx, 0, cz - 10, 0, d);
      this.place('bloco_pilotis', cx, 0, cz + 10, Math.PI, d);
    } else if (v === 1) {
      this.place('bloco_pilotis', cx - 10, 0, cz, HALF_PI, d);
      this.place('bloco_pilotis', cx + 10, 0, cz, -HALF_PI, d);
    } else {
      this.place('bloco_pilotis', cx, 0, cz - 8, 0, d);
      for (let i = 0; i < 6; i++) this.parkedCar(cx - 14 + i * 5.6, cz + 12, HALF_PI, d);
      this.place('banca', cx + 12, 0, cz + 4, 0, d);
    }
    for (let i = 0; i < 7; i++) this.place(r.chance(0.55) ? 'ipe' : 'arvore', cx + r.range(-18, 18), 0, cz + r.range(-18, 18), r.range(0, 6), d);
    this.scatterProps(d, cx, cz, HL, HL, 6);
    for (let i = 0; i < 4; i++) this.person(cx + r.range(-16, 16), cz + r.range(-16, 16), d, undefined, 6);
    this.maybeRare(d, cx, cz, 14);
  }

  /** Esplanada: one ministry slab per block, lawn and a few official cars. */
  private genEsplanada(blk: BlockInfo): void {
    const { cx, cz, district: d } = blk;
    const r = this.rng;
    this.place('ministerio', cx, 0, cz - 6, 0, d);
    for (let i = 0; i < 5; i++) this.parkedCar(cx - 12 + i * 6, cz + 14, HALF_PI, d, true);
    this.scatterProps(d, cx, cz, HL, 4, 6);
    for (let i = 0; i < 3; i++) this.person(cx + r.range(-16, 16), cz + r.range(8, 16), d, 'runner', 5);
    this.maybeRare(d, cx, cz, 12);
  }

  /** Floresta: a samaúma, dense trees and Amazon fauna. */
  private genForest(blk: BlockInfo): void {
    const { cx, cz, district: d } = blk;
    const r = this.rng;
    if (r.chance(0.55)) this.place('samauma', cx + r.range(-6, 6), 0, cz + r.range(-6, 6), r.range(0, 6), d);
    const trees = ['arvore', 'arvore', 'palmeira_acai', 'bananeira', 'coqueiro', 'ipe', 'jaqueira', 'mangueira'];
    for (let i = 0; i < 24; i++) this.place(r.pick(trees), cx + r.range(-HB + 2, HB - 2), 0, cz + r.range(-HB + 2, HB - 2), r.range(0, 6), d);
    this.scatterProps(d, cx, cz, HL, HL, 6);
    if (r.chance(0.5)) this.place('preguica', cx + r.range(-12, 12), 0, cz + r.range(-12, 12), r.range(0, 6), d);
    this.maybeRare(d, cx, cz, 12);
  }

  /** Cartão-postal block: the landmark in a plaza full of tourists. */
  private genLandmark(blk: BlockInfo): void {
    const { cx, cz, col, row, district: d } = blk;
    const r = this.rng;
    const lm = this.city.landmarks.find((l) => l.col === col && l.row === row);
    if (!lm) {
      this.genPraca(blk);
      return;
    }
    const x = cx + (lm.dx ?? 0);
    const z = cz + (lm.dz ?? 0);
    const idx = this.place(lm.id, x, 0, z, lm.rot ?? 0, d);
    if (lm.id === 'arcos_lapa' && this.has('bondinho')) this.place('bondinho', x - 6, 16.45, z, HALF_PI, d, idx);
    const model = this.lib.get(getObjectDef(lm.id).model);
    const clear = Math.max(model.halfX, model.halfZ) + 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      const rr = Math.min(HL - 1, clear + 1.5);
      if (rr < clear) continue;
      this.place('banco_praca', cx + Math.cos(a) * rr, 0, cz + Math.sin(a) * rr, -a - HALF_PI, d);
    }
    this.place('carrinho_pipoca', cx + HL - 3, 0, cz + HL - 3, 1, d);
    this.scatterProps(d, cx, cz, HL - 1, HL - 1, 5);
    for (let i = 0; i < 8; i++) {
      const a = r.range(0, Math.PI * 2);
      const rr = r.range(Math.min(clear, HL - 2), HL - 1);
      this.person(cx + Math.cos(a) * rr, cz + Math.sin(a) * rr, d, r.chance(0.6) ? 'filmer' : 'pointer', 3);
    }
  }

  /** One-off city touches that don't belong to a single district generator. */
  private genCityFeatures(): void {
    if (this.has('estaiada')) {
      // the cable-stayed bridge crosses the river on road line 4
      const row = this.city.layout.findIndex((l) => l.startsWith('WWWW'));
      if (row >= 0) this.place('ponte_estaiada', -this.halfW + 4 * B, 0.3, this.grid.centerZ(row), 0, 'W');
    }
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
      if (this.grid.isWaterAt(x, z)) continue;
      const trees = this.city.id === 'manaus' ? ['arvore', 'palmeira_acai', 'arvore'] : this.city.id === 'brasilia' ? ['ipe', 'arvore', 'pequi'] : ['coqueiro', 'arvore', 'arvore', 'ipe'];
      this.place(r.pick(trees), x, 0, z, r.range(0, 6), 'U');
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
    const grid = this.grid;
    if (this.wrap) g.box(halfW * 2 + ROAD, 0.2, halfH * 2 + ROAD, this.city.look.grass, 0, -0.12, 0);
    else g.box(1400, 0.2, 1400, this.city.look.grass, 0, -0.12, 0);
    g.box(halfW * 2 + ROAD, 0.1, halfH * 2 + ROAD, 0x45474d, 0, -0.03, 0);
    for (const blk of this.blocks) {
      const d = blk.district;
      if (d === 'W') continue;
      const def = DISTRICTS[d];
      if (d === 'A') {
        const s = grid.sandRect(blk.col, blk.row);
        g.box(s.x1 - s.x0, 0.22, s.z1 - s.z0, def.groundColor, (s.x0 + s.x1) / 2, 0.09, (s.z0 + s.z1) / 2);
        // wet sand toward the water
        for (const side of SIDES) {
          if (!grid.waterSide(blk.col, blk.row, side)) continue;
          const [nx, nz] = SIDE_N[side] as [number, number];
          const w = nz !== 0 ? s.x1 - s.x0 : 5;
          const dd = nz !== 0 ? 5 : s.z1 - s.z0;
          const x = nz !== 0 ? (s.x0 + s.x1) / 2 : nx > 0 ? s.x1 - 2.5 : s.x0 + 2.5;
          const z = nx !== 0 ? (s.z0 + s.z1) / 2 : nz > 0 ? s.z1 - 2.5 : s.z0 + 2.5;
          g.box(w, 0.22, dd, 0xcdb98a, x, 0.095, z);
        }
        continue;
      }
      const plaza = d === 'P' || d === 'L';
      if (!plaza) g.box(HB * 2, 0.18, HB * 2, d === 'U' || d === 'M' ? 0x9c8f73 : 0xc9c4b8, blk.cx, 0.09, blk.cz);
      // curb lip
      if (d !== 'U' && d !== 'M') g.box(HB * 2 + 0.3, 0.1, HB * 2 + 0.3, 0xa39f95, blk.cx, 0.05, blk.cz);
      if (!plaza) g.box(HL * 2, 0.06, HL * 2, d === 'Q' || d === 'G' || d === 'R' || d === 'U' ? this.lawn(def.groundColor) : def.groundColor, blk.cx, 0.2, blk.cz);
      if (d === 'S') {
        g.box(24, 0.02, 34, 0x5f9e3f, blk.cx, 0.24, blk.cz);
        const line = 0xf4f4f0;
        g.box(24, 0.02, 0.2, line, blk.cx, 0.26, blk.cz);
        g.box(0.2, 0.02, 34, line, blk.cx - 12, 0.26, blk.cz).box(0.2, 0.02, 34, line, blk.cx + 12, 0.26, blk.cz);
        g.box(24, 0.02, 0.2, line, blk.cx, 0.26, blk.cz - 17).box(24, 0.02, 0.2, line, blk.cx, 0.26, blk.cz + 17);
        g.torus(4, 0.1, 3, 24, line, blk.cx, 0.26, blk.cz, { rx: HALF_PI, sz: 0.1 });
      }
      if (d === 'B') {
        g.box(10, 0.02, HL * 2, 0x55575c, blk.cx - 12, 0.25, blk.cz);
        for (let i = -3; i <= 3; i++) g.box(0.4, 0.02, 3, 0xf4f4f0, blk.cx - 12, 0.27, blk.cz + i * 5.5);
      }
      if (d === 'G') g.box(HL * 2, 0.02, 7, 0x8e897f, blk.cx, 0.24, blk.cz + 14);
    }
    // bridges: deck + railings over the water
    const deck = 0x4a4c52;
    for (let c = 0; c <= cols; c++) {
      for (let rr = 0; rr < rows; rr++) {
        if (!grid.isBridgeV(c, rr)) continue;
        const x = -halfW + c * B;
        const z = grid.centerZ(rr);
        g.box(ROAD, 0.16, B - ROAD, deck, x, 0.02, z).box(ROAD + 1.2, 0.5, B - ROAD, 0x8e897f, x, -0.3, z);
        g.mirrorX((sg) => g.box(0.35, 1.0, B - ROAD, 0xd6d1c4, x + sg * (ROAD / 2 + 0.3), 0.5, z));
      }
    }
    for (let rr = 0; rr <= rows; rr++) {
      for (let c = 0; c < cols; c++) {
        if (!grid.isBridgeH(rr, c)) continue;
        const z = -halfH + rr * B;
        const x = grid.centerX(c);
        g.box(B - ROAD, 0.16, ROAD, deck, x, 0.02, z).box(B - ROAD, 0.5, ROAD + 1.2, 0x8e897f, x, -0.3, z);
        g.box(B - ROAD, 1.0, 0.35, 0xd6d1c4, x, 0.5, z + ROAD / 2 + 0.3).box(B - ROAD, 1.0, 0.35, 0xd6d1c4, x, 0.5, z - ROAD / 2 - 0.3);
      }
    }
    // lane markings: yellow dashed center line on every existing road, zebra crossings at every approach
    const up = { rx: -HALF_PI, noAO: true };
    for (let c = 0; c <= cols; c++) {
      const x = -halfW + c * B;
      for (let z = -halfH; z < halfH; z += 5) {
        const m = (z + halfH) % B;
        if (m < 9 || m > B - 11) continue;
        const row = Math.floor((z + halfH) / B);
        if (!grid.vRoad(c, row)) continue;
        g.quad(0.22, 2.4, 0xf2c12e, x, grid.isBridgeV(c, row) ? 0.11 : 0.05, z + 1.2, up);
      }
    }
    for (let rr = 0; rr <= rows; rr++) {
      const z = -halfH + rr * B;
      for (let x = -halfW; x < halfW; x += 5) {
        const m = (x + halfW) % B;
        if (m < 9 || m > B - 11) continue;
        const col = Math.floor((x + halfW) / B);
        if (!grid.hRoad(rr, col)) continue;
        g.quad(2.4, 0.22, 0xf2c12e, x + 1.2, grid.isBridgeH(rr, col) ? 0.11 : 0.05, z, up);
      }
    }
    const off = ROAD / 2 + 1.8;
    for (let c = 0; c <= cols; c++) {
      for (let rr = 0; rr <= rows; rr++) {
        const x = -halfW + c * B;
        const z = -halfH + rr * B;
        const s1 = rr < rows && grid.vRoad(c, rr);
        const s0 = rr > 0 && grid.vRoad(c, rr - 1);
        const e1 = c < cols && grid.hRoad(rr, c);
        const e0 = c > 0 && grid.hRoad(rr, c - 1);
        for (let i = -4; i <= 4; i++) {
          if (s1) g.quad(0.7, 2.6, 0xf1f1ec, x + i * 1.35, 0.05, z + off, up);
          if (s0) g.quad(0.7, 2.6, 0xf1f1ec, x + i * 1.35, 0.05, z - off, up);
          if (e1) g.quad(2.6, 0.7, 0xf1f1ec, x + off, 0.05, z + i * 1.35, up);
          if (e0) g.quad(2.6, 0.7, 0xf1f1ec, x - off, 0.05, z + i * 1.35, up);
        }
      }
    }
    return g.build({ ao: false });
  }

  /** Lawns follow the city's grass so dry Brasília and humid Manaus read differently. */
  private lawn(districtColor: number): number {
    return new Color(districtColor).lerp(new Color(this.city.look.grass), 0.55).getHex();
  }

  private buildCalcada(): BufferGeometry {
    const g = new ModelBuilder(this.atlas.white);
    for (const blk of this.blocks) {
      const d = blk.district;
      if (d === 'P' || d === 'L') {
        g.box(HB * 2, 0.24, HB * 2, 0xffffff, blk.cx, 0.12, blk.cz);
      } else if (d === 'F' || d === 'C' || d === 'K') {
        // sidewalk strips in calçada portuguesa
        g.box(HB * 2, 0.2, SIDE, 0xffffff, blk.cx, 0.1, blk.cz + HB - SIDE / 2);
        g.box(HB * 2, 0.2, SIDE, 0xffffff, blk.cx, 0.1, blk.cz - HB + SIDE / 2);
      } else if (d === 'A') {
        // the calçadão runs along the avenue on the land side of the beach
        for (const side of SIDES) {
          if (!this.grid.sideRoad(blk.col, blk.row, side)) continue;
          const [nx, nz] = SIDE_N[side] as [number, number];
          if (nz !== 0) g.box(HB * 2, 0.24, SIDE + 1, 0xffffff, blk.cx, 0.12, blk.cz + nz * (HB - (SIDE + 1) / 2));
          else g.box(SIDE + 1, 0.24, HB * 2, 0xffffff, blk.cx + nx * (HB - (SIDE + 1) / 2), 0.12, blk.cz);
        }
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

  /** Water surface: flat quads with a west→east tint (Encontro das Águas in Manaus). */
  private buildWater(): BufferGeometry | null {
    const rects: Rect[] = [];
    for (const blk of this.blocks) {
      if (blk.district === 'W') rects.push(this.grid.waterRect(blk.col, blk.row, true));
      else if (blk.district === 'A') rects.push(...this.grid.seaBeyondBeach(blk.col, blk.row));
    }
    if (this.wrap) {
      // clip the sea to the tile so copies side by side don't overlap
      const ex = this.halfW + ROAD / 2;
      const ez = this.halfH + ROAD / 2;
      for (const r of rects) {
        r.x0 = Math.max(-ex, r.x0);
        r.x1 = Math.min(ex, r.x1);
        r.z0 = Math.max(-ez, r.z0);
        r.z1 = Math.min(ez, r.z1);
      }
      for (let i = rects.length - 1; i >= 0; i--) {
        const r = rects[i] as Rect;
        if (r.x1 - r.x0 < 0.5 || r.z1 - r.z0 < 0.5) rects.splice(i, 1);
      }
    }
    if (rects.length === 0) return null;
    const west = new Color(this.city.look.water[0]);
    const east = new Color(this.city.look.water[1]);
    const col = new Color();
    const tint = (x: number) => {
      // a wrapping tile needs one flat tone, or the seam shows as a colour step
      if (this.wrap) return col.copy(west).lerp(east, 0.5);
      const t = Math.min(1, Math.max(0, (x + B * 0.5) / (B * 2)));
      return col.copy(west).lerp(east, t * t * (3 - 2 * t));
    };
    const pos: number[] = [];
    const colors: number[] = [];
    const y = 0.07;
    for (const r of rects) {
      const w = r.x1 - r.x0;
      const steps = Math.max(1, Math.ceil(w / (w > 200 ? 120 : 20)));
      for (let i = 0; i < steps; i++) {
        const xa = r.x0 + (w * i) / steps;
        const xb = r.x0 + (w * (i + 1)) / steps;
        const ca = tint(xa).toArray([]) as number[];
        const cb = tint(xb).toArray([]) as number[];
        pos.push(xa, y, r.z0, xa, y, r.z1, xb, y, r.z1, xa, y, r.z0, xb, y, r.z1, xb, y, r.z0);
        colors.push(...ca, ...ca, ...cb, ...ca, ...cb, ...cb);
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
    // streak texture repeats every ~24 m; on a wrapping tile it must repeat a whole number of times
    const pw = this.halfW * 2 + ROAD;
    const ph = this.halfH * 2 + ROAD;
    const ux = this.wrap ? pw / Math.round(pw / 24) : 24;
    const uz = this.wrap ? ph / Math.round(ph / 24) : 24;
    const uvs = new Float32Array((pos.length / 3) * 2);
    for (let i = 0; i < pos.length / 3; i++) {
      uvs[i * 2] = (pos[i * 3] as number) / ux;
      uvs[i * 2 + 1] = (pos[i * 3 + 2] as number) / uz;
    }
    geo.setAttribute('uv', new BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    return geo;
  }

  private backdrop(): BackdropPlacement[] {
    const out: BackdropPlacement[] = [];
    for (const bd of this.city.backdrop ?? []) {
      let x = 0;
      let z = 0;
      if (bd.side === 'n') [x, z] = [bd.along * this.halfW, -this.halfH - bd.out];
      else if (bd.side === 's') [x, z] = [bd.along * this.halfW, this.halfH + bd.out];
      else if (bd.side === 'e') [x, z] = [this.halfW + bd.out, bd.along * this.halfH];
      else [x, z] = [-this.halfW - bd.out, bd.along * this.halfH];
      out.push({ model: bd.model, x, z, rotY: bd.rot ?? 0, scale: bd.scale ?? 1 });
    }
    return out;
  }
}
