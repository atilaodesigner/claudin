import { Color, MeshStandardMaterial, Vector2, Vector3, type Texture } from 'three';

/** Uniforms shared by every world material (one update drives the whole city). */
export const worldUniforms = {
  uTime: { value: 0 },
  /** City lights / signs emissive strength. EMP makes it flicker. */
  uEmitStrength: { value: 1 },
  uCloudTex: { value: null as Texture | null },
  /** x: cloud scale, y: shadow strength, z: grit scale */
  uCloudParams: { value: new Vector3(0.0042, 0.3, 0.35) },
  uCloudOffset: { value: new Vector2() },
  /** Beam spotlight on the ground: xyz = center, w = radius. */
  uBeamSpot: { value: new Vector3(0, -999, 0) },
  uBeamRadius: { value: 0 },
  uBeamColor: { value: new Color(0.35, 1.0, 0.55) },
  uBeamIntensity: { value: 0 },
};

export interface WorldMaterialOptions {
  map?: Texture | null;
  grit?: number;
  roughness?: number;
  metalness?: number;
  /** Per-material tint (used by standalone meshes; batched meshes use per-instance color). */
  tint?: number;
  name?: string;
}

export interface WorldMaterialUniforms {
  uTint: { value: Color };
  uFlash: { value: Color };
  uRim: { value: number };
  uRimColor: { value: Color };
  uGrit: { value: number };
}

const VERT_HEADER = /* glsl */ `
attribute vec2 aFx;
uniform vec3 uTint;
varying float vEmit;
varying vec3 vWorldPosFx;
`;

const COLOR_VERTEX = /* glsl */ `
#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
  vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR
  vColor.rgb *= color;
#endif
vec3 fxTint = uTint;
#ifdef USE_INSTANCING_COLOR
  fxTint = instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
  fxTint = getBatchingColor( getIndirectIndex( gl_DrawID ) ).rgb;
#endif
#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
  vColor.rgb *= mix( vec3( 1.0 ), fxTint, aFx.x );
#endif
vEmit = aFx.y;
`;

const WORLDPOS_VERTEX = /* glsl */ `
#include <worldpos_vertex>
{
  vec4 fxWorld = vec4( transformed, 1.0 );
  #ifdef USE_BATCHING
    fxWorld = batchingMatrix * fxWorld;
  #endif
  #ifdef USE_INSTANCING
    fxWorld = instanceMatrix * fxWorld;
  #endif
  fxWorld = modelMatrix * fxWorld;
  vWorldPosFx = fxWorld.xyz;
}
`;

const FRAG_HEADER = /* glsl */ `
uniform float uEmitStrength;
uniform sampler2D uCloudTex;
uniform vec3 uCloudParams;
uniform vec2 uCloudOffset;
uniform vec3 uFlash;
uniform float uRim;
uniform vec3 uRimColor;
uniform float uGrit;
uniform vec3 uBeamSpot;
uniform float uBeamRadius;
uniform vec3 uBeamColor;
uniform float uBeamIntensity;
varying float vEmit;
varying vec3 vWorldPosFx;
`;

const MAP_FRAGMENT = /* glsl */ `
#include <map_fragment>
if ( uGrit > 0.0 ) {
  float g = texture2D( uCloudTex, vWorldPosFx.xz * uCloudParams.z ).r;
  float g2 = texture2D( uCloudTex, vWorldPosFx.xz * uCloudParams.z * 0.13 + 0.37 ).r;
  diffuseColor.rgb *= mix( 1.0, 0.8 + g * 0.3 + (g2 - 0.5) * 0.25, uGrit );
}
`;

const LIGHTS_FRAGMENT = /* glsl */ `
#include <lights_fragment_begin>
{
  float cloud = texture2D( uCloudTex, vWorldPosFx.xz * uCloudParams.x + uCloudOffset ).r;
  float cloudShadow = 1.0 - uCloudParams.y * smoothstep( 0.46, 0.7, cloud );
  reflectedLight.directDiffuse *= cloudShadow;
  reflectedLight.directSpecular *= cloudShadow;
}
`;

const EMISSIVE_FRAGMENT = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * vEmit * uEmitStrength * 2.2;
totalEmissiveRadiance += uFlash;
if ( uRim > 0.0 ) {
  float fres = 1.0 - clamp( dot( normalize( normal ), normalize( vViewPosition ) ), 0.0, 1.0 );
  totalEmissiveRadiance += uRimColor * pow( fres, 2.0 ) * uRim;
}
if ( uBeamIntensity > 0.0 ) {
  vec2 d = vWorldPosFx.xz - uBeamSpot.xz;
  float r = length( d ) / max( uBeamRadius, 0.001 );
  float ring = 1.0 - smoothstep( 0.82, 1.0, r );
  float heightFade = 1.0 - smoothstep( uBeamSpot.y * 0.2, uBeamSpot.y, vWorldPosFx.y );
  totalEmissiveRadiance += uBeamColor * ring * heightFade * uBeamIntensity * ( 0.35 + 0.65 * smoothstep( 0.7, 1.0, r ) );
}
`;

/**
 * MeshStandardMaterial patched for the stylized city:
 * - vertex colors × per-instance paint mask (car bodies, house walls...)
 * - emissive mask (signs, lights) driven by a global strength (EMP flicker)
 * - fake cloud shadows scrolling over everything
 * - tractor beam light pool on whatever is under the UFO
 */
export function createWorldMaterial(opts: WorldMaterialOptions = {}): MeshStandardMaterial & { fx: WorldMaterialUniforms } {
  const mat = new MeshStandardMaterial({
    vertexColors: true,
    map: opts.map ?? null,
    roughness: opts.roughness ?? 0.78,
    metalness: opts.metalness ?? 0.04,
  }) as MeshStandardMaterial & { fx: WorldMaterialUniforms };
  mat.name = opts.name ?? 'world';
  const fx: WorldMaterialUniforms = {
    uTint: { value: new Color(opts.tint ?? 0xffffff) },
    uFlash: { value: new Color(0, 0, 0) },
    uRim: { value: 0 },
    uRimColor: { value: new Color(0.3, 1.0, 0.5) },
    uGrit: { value: opts.grit ?? 0 },
  };
  mat.fx = fx;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, worldUniforms, fx);
    shader.vertexShader = VERT_HEADER + shader.vertexShader
      .replace('#include <color_vertex>', COLOR_VERTEX)
      .replace('#include <worldpos_vertex>', WORLDPOS_VERTEX);
    shader.fragmentShader = FRAG_HEADER + shader.fragmentShader
      .replace('#include <map_fragment>', MAP_FRAGMENT)
      .replace('#include <lights_fragment_begin>', LIGHTS_FRAGMENT)
      .replace('#include <emissivemap_fragment>', EMISSIVE_FRAGMENT);
  };
  mat.customProgramCacheKey = () => 'world-fx-v1';
  return mat;
}
