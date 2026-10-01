import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  FloatType,
  NearestFilter,
  RGBAFormat,
  SRGBColorSpace,
  Sphere,
  TextureLoader,
  Uint8BufferAttribute,
  Vector3,
  type Texture,
} from 'three';

/**
 * Pedestrian characters made in Tripo, rigged (Mixamo skeleton) and baked by
 * `tools/crowd` into `public/crowd/<id>.bin` + `<id>.webp`. Add a new one there and list it here.
 */
export const CROWD_CHARACTERS: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'huehue', name: 'HUEHUE' },
  { id: 'cabeca_guidao', name: 'CABEÇA DE GUIDÃO' },
  { id: 'manoel_gomes', name: 'MANOEL GOMES' },
];

export type CrowdClipName = 'run' | 'afraid' | 'freaky' | 'swim';

export interface CrowdClip {
  name: string;
  /** First row of this clip in the animation texture. */
  start: number;
  frames: number;
  duration: number;
  /** Ground speed of the original motion (units/s): playback rate = pedestrian speed / speed. */
  speed: number;
  /** Average hip position of the clip (game space). */
  pivot: [number, number, number];
  /** Swim baked belly-up: spine along +Z, belly to +Y, centred on the hips. */
  bellyUp?: boolean;
}

export interface CrowdCharacter {
  id: string;
  name: string;
  geometry: BufferGeometry;
  /** Same vertices, ~1/4 of the triangles: far pedestrians. */
  lod1: BufferGeometry;
  /** Bone rows (3 texels per bone) × frames, RGBA float. */
  anim: DataTexture;
  map: Texture;
  bones: number;
  height: number;
  clips: Record<CrowdClipName, CrowdClip>;
}

interface Header {
  version: number;
  id: string;
  vertexCount: number;
  bones: number;
  frames: number;
  height: number;
  clips: CrowdClip[];
  layout: { name: string; type: string; offset: number; length: number }[];
}

const ARRAYS = { Float32Array, Uint16Array, Uint32Array, Uint8Array } as const;

function parse(buf: ArrayBuffer): { header: Header; parts: Record<string, Float32Array | Uint16Array | Uint32Array | Uint8Array> } {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x52434241) throw new Error('not a crowd asset');
  const jlen = dv.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, jlen))) as Header;
  const parts: Record<string, Float32Array | Uint16Array | Uint32Array | Uint8Array> = {};
  for (const p of header.layout) {
    const Ctor = ARRAYS[p.type as keyof typeof ARRAYS];
    parts[p.name] = new Ctor(buf, 8 + jlen + p.offset, p.length);
  }
  return { header, parts };
}

async function loadOne(base: string, id: string, name: string): Promise<CrowdCharacter> {
  const [bin, map] = await Promise.all([
    fetch(`${base}${id}.bin`).then((r) => {
      if (!r.ok) throw new Error(`${id}.bin: ${r.status}`);
      return r.arrayBuffer();
    }),
    new TextureLoader().loadAsync(`${base}${id}.webp`),
  ]);
  const { header, parts } = parse(bin);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(parts.position as Float32Array, 3));
  g.setAttribute('normal', new BufferAttribute(parts.normal as Float32Array, 3));
  g.setAttribute('uv', new BufferAttribute(parts.uv as Float32Array, 2));
  g.setAttribute('skinIndex', new Uint8BufferAttribute(parts.skinIndex as Uint8Array, 4));
  g.setAttribute('skinWeight', new Uint8BufferAttribute(parts.skinWeight as Uint8Array, 4, true));
  // the world material reads a paint/emissive mask: none on characters
  g.setAttribute('aFx', new BufferAttribute(new Float32Array(header.vertexCount * 2), 2));
  g.setIndex(new BufferAttribute(parts.index as Uint16Array, 1));
  // poses move vertices around: a generous fixed bound
  g.boundingSphere = new Sphere(new Vector3(0, header.height * 0.5, 0), header.height * 1.2);
  const lod1 = new BufferGeometry();
  for (const k of Object.keys(g.attributes)) lod1.setAttribute(k, g.getAttribute(k));
  lod1.setIndex(new BufferAttribute(parts.index1 as Uint16Array, 1));
  lod1.boundingSphere = g.boundingSphere.clone();

  const anim = new DataTexture(parts.anim as Float32Array, header.bones * 3, header.frames, RGBAFormat, FloatType);
  anim.magFilter = NearestFilter;
  anim.minFilter = NearestFilter;
  anim.generateMipmaps = false;
  anim.needsUpdate = true;

  map.flipY = false; // glTF UVs
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 4;
  map.needsUpdate = true;

  const clips = {} as Record<CrowdClipName, CrowdClip>;
  for (const c of header.clips) clips[c.name as CrowdClipName] = c;
  for (const need of ['run', 'afraid', 'freaky', 'swim'] as const) if (!clips[need]) throw new Error(`${id}: missing clip ${need}`);
  return { id, name, geometry: g, lod1, anim, map, bones: header.bones, height: header.height, clips };
}

/** Loads every crowd character; a broken one is skipped (the city keeps the procedural pedestrian). */
export async function loadCrowd(base = 'crowd/'): Promise<CrowdCharacter[]> {
  const out = await Promise.all(
    CROWD_CHARACTERS.map((c) =>
      loadOne(base, c.id, c.name).catch((err) => {
        console.warn(`[crowd] could not load ${c.id}`, err);
        return null;
      }),
    ),
  );
  return out.filter((c): c is CrowdCharacter => c !== null);
}
