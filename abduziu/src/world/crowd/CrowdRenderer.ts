import {
  BufferGeometry,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshDepthMaterial,
  RGBADepthPacking,
  type DataTexture,
  type Scene,
} from 'three';
import { createWorldMaterial } from '../../rendering/WorldMaterial';
import type { CrowdCharacter, CrowdClip } from './CrowdAssets';

/**
 * GPU crowd: every pedestrian of a character is one instance of a single mesh, skinned in the
 * vertex shader from the baked bone texture (no skeleton, no mixer per pedestrian). Each instance
 * carries its own pair of frames + blend, so nobody runs in sync. Two LODs share the vertices.
 */

const PARS = /* glsl */ `
attribute vec4 skinIndex;
attribute vec4 skinWeight;
attribute vec3 aCrowd;
attribute float aCrowdRim;
uniform highp sampler2D uCrowdAnim;
varying float vCrowdRim;
mat4 crowdBone( float bone, float frame ) {
  int x = int( bone ) * 3;
  int y = int( frame );
  vec4 r0 = texelFetch( uCrowdAnim, ivec2( x, y ), 0 );
  vec4 r1 = texelFetch( uCrowdAnim, ivec2( x + 1, y ), 0 );
  vec4 r2 = texelFetch( uCrowdAnim, ivec2( x + 2, y ), 0 );
  return mat4( r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0 );
}
mat4 crowdPose( float frame ) {
  mat4 m = skinWeight.x * crowdBone( skinIndex.x, frame );
  if ( skinWeight.y > 0.0 ) m += skinWeight.y * crowdBone( skinIndex.y, frame );
  if ( skinWeight.z > 0.0 ) m += skinWeight.z * crowdBone( skinIndex.z, frame );
  if ( skinWeight.w > 0.0 ) m += skinWeight.w * crowdBone( skinIndex.w, frame );
  return m;
}
`;
const SKIN = /* glsl */ `
mat4 crowdM = crowdPose( aCrowd.x ) * ( 1.0 - aCrowd.z ) + crowdPose( aCrowd.y ) * aCrowd.z;
`;

function patchVertex(src: string, withNormals: boolean): string {
  let s = PARS + src;
  if (withNormals) {
    s = s.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${SKIN}\nobjectNormal = normalize( mat3( crowdM ) * objectNormal );`);
    s = s.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = ( crowdM * vec4( transformed, 1.0 ) ).xyz;\nvCrowdRim = aCrowdRim;');
  } else {
    s = s.replace('#include <begin_vertex>', `#include <begin_vertex>\n${SKIN}\ntransformed = ( crowdM * vec4( transformed, 1.0 ) ).xyz;\nvCrowdRim = aCrowdRim;`);
  }
  return s;
}

function crowdMaterials(map: CrowdCharacter['map'], anim: DataTexture) {
  const mat = createWorldMaterial({ map, name: 'crowd', roughness: 0.82 });
  mat.vertexColors = false;
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    base.call(mat, shader, renderer);
    shader.uniforms.uCrowdAnim = { value: anim };
    shader.vertexShader = patchVertex(shader.vertexShader, true);
    // abduction glow: per instance (the city's rim is a per-material uniform)
    shader.fragmentShader = `varying float vCrowdRim;\n${shader.fragmentShader}`
      .replace('if ( uRim > 0.0 ) {', 'float uRimC = max( uRim, vCrowdRim );\nif ( uRimC > 0.0 ) {')
      .replace('pow( fres, 2.0 ) * uRim;', 'pow( fres, 2.0 ) * uRimC;');
  };
  mat.customProgramCacheKey = () => 'world-fx-crowd-v1';
  const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  depth.onBeforeCompile = (shader) => {
    shader.uniforms.uCrowdAnim = { value: anim };
    shader.vertexShader = patchVertex(shader.vertexShader, false);
  };
  depth.customProgramCacheKey = () => 'crowd-depth-v1';
  return { mat, depth };
}

interface Lod {
  mesh: InstancedMesh;
  frames: InstancedBufferAttribute;
  rim: InstancedBufferAttribute;
  count: number;
}

const CAPACITY = 256;

function makeLod(scene: Scene, geometry: BufferGeometry, ch: CrowdCharacter, mats: ReturnType<typeof crowdMaterials>, name: string): Lod {
  const g = new BufferGeometry(); // own instanced attributes, shared vertex data
  for (const k of Object.keys(geometry.attributes)) g.setAttribute(k, geometry.getAttribute(k));
  g.setIndex(geometry.index);
  g.boundingSphere = geometry.boundingSphere;
  const frames = new InstancedBufferAttribute(new Float32Array(CAPACITY * 3), 3);
  const rim = new InstancedBufferAttribute(new Float32Array(CAPACITY), 1);
  frames.setUsage(DynamicDrawUsage);
  rim.setUsage(DynamicDrawUsage);
  g.setAttribute('aCrowd', frames);
  g.setAttribute('aCrowdRim', rim);
  const mesh = new InstancedMesh(g, mats.mat, CAPACITY);
  mesh.name = `crowd:${ch.id}:${name}`;
  mesh.customDepthMaterial = mats.depth;
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  scene.add(mesh);
  return { mesh, frames, rim, count: 0 };
}

export class CrowdRenderer {
  private readonly lods: Lod[][] = [];

  constructor(
    scene: Scene,
    readonly chars: readonly CrowdCharacter[],
  ) {
    for (const ch of chars) {
      const mats = crowdMaterials(ch.map, ch.anim);
      // memes shine gold (walking around and in the beam)
      if (ch.meme) mats.mat.fx.uRimColor.value.setHex(0xffc84a);
      this.lods.push([makeLod(scene, ch.geometry, ch, mats, 'lod0'), makeLod(scene, ch.lod1, ch, mats, 'lod1')]);
    }
  }

  begin(): void {
    for (const pair of this.lods) for (const l of pair) l.count = 0;
  }

  /**
   * One pedestrian this frame. `time` is the clip-local time in seconds (wraps).
   * @param far use the light mesh
   */
  add(char: number, matrix: Matrix4, clip: CrowdClip, time: number, far: boolean, rim = 0): void {
    const l = this.lods[char]?.[far ? 1 : 0];
    if (!l || l.count >= CAPACITY) return;
    const i = l.count++;
    l.mesh.setMatrixAt(i, matrix);
    const f = (((time / clip.duration) % 1) + 1) % 1 * clip.frames;
    const a = Math.floor(f);
    l.frames.setXYZ(i, clip.start + a, clip.start + ((a + 1) % clip.frames), f - a);
    l.rim.setX(i, rim);
  }

  end(): void {
    for (const pair of this.lods) {
      for (const l of pair) {
        l.mesh.count = l.count;
        if (l.count === 0) continue;
        l.mesh.instanceMatrix.needsUpdate = true;
        l.frames.needsUpdate = true;
        l.rim.needsUpdate = true;
      }
    }
  }

  /** Hides everything (menu, between worlds). */
  clear(): void {
    this.begin();
    this.end();
  }
}
