// Surface types and the shared shader that renders them.
// Every vertex carries a surface (roughness, metalness, clear-coat, kind), so one merged mesh can hold paint, glass,
// rubber and chrome — or brick, stone and glass — and still draw in a single call. Fine detail (brick courses, asphalt
// grain, paving speckle, leaf clumps) is procedural in world space, so it never stretches and does not repeat per tile.
import * as THREE from 'three';

export type Surface =
  | 'paint'
  | 'plastic'
  | 'glass'
  | 'rubber'
  | 'chrome'
  | 'gold'
  | 'metal'
  | 'lamp'
  | 'brick'
  | 'stone'
  | 'plaster'
  | 'asphalt'
  | 'paving'
  | 'foliage'
  | 'cloth'
  | 'skin'
  | 'hair'
  | 'wood'
  | 'slate'
  | 'marking';

/** Kinds that get procedural detail in the shader. */
const KIND = { plain: 0, glass: 1, lamp: 2, brick: 3, stone: 4, plaster: 5, asphalt: 6, paving: 7, foliage: 8, cloth: 9, wood: 10, slate: 11 } as const;

/** Roughness, metalness, clear-coat, kind. Paint has a clear coat for controlled highlights; only exposed metal is metallic. */
export const SURFACES: Readonly<Record<Surface, readonly [number, number, number, number]>> = {
  paint: [0.38, 0.0, 1.0, KIND.plain],
  plastic: [0.62, 0.0, 0.0, KIND.plain],
  glass: [0.06, 0.0, 0.0, KIND.glass],
  rubber: [0.93, 0.0, 0.0, KIND.plain],
  chrome: [0.16, 1.0, 0.0, KIND.plain],
  gold: [0.3, 1.0, 0.0, KIND.plain],
  metal: [0.42, 0.45, 0.4, KIND.plain],
  lamp: [0.35, 0.0, 0.0, KIND.lamp],
  brick: [0.9, 0.0, 0.0, KIND.brick],
  stone: [0.82, 0.0, 0.0, KIND.stone],
  plaster: [0.78, 0.0, 0.0, KIND.plaster],
  asphalt: [0.94, 0.0, 0.0, KIND.asphalt],
  paving: [0.86, 0.0, 0.0, KIND.paving],
  foliage: [0.78, 0.0, 0.0, KIND.foliage],
  cloth: [0.95, 0.0, 0.0, KIND.cloth],
  skin: [0.58, 0.0, 0.0, KIND.plain],
  hair: [0.7, 0.0, 0.0, KIND.cloth],
  wood: [0.75, 0.0, 0.0, KIND.wood],
  slate: [0.72, 0.0, 0.0, KIND.slate],
  marking: [0.7, 0.0, 0.0, KIND.plain],
};

/** Shared animation clock for shaders (wind in the trees). */
export const shaderTime = { value: 0 };

const COMMON = /* glsl */ `
varying vec4 vSurf;
varying vec3 vWorldP;
varying vec3 vWorldN;
`;

const VERTEX_PARS = /* glsl */ `
attribute vec4 aSurf;
uniform float uTime;
${COMMON}
`;

// After begin_vertex: pass the surface on; position and normal in the world group's frame (wrapped for precision).
const VERTEX_MAIN = /* glsl */ `
vSurf = aSurf;
vec3 wp = transformed;
vec3 wn = objectNormal;
#ifdef USE_INSTANCING
  wp = (instanceMatrix * vec4(wp, 1.0)).xyz;
  wn = mat3(instanceMatrix) * wn;
#endif
// Leaves move a little in the wind; the higher, the more.
if (abs(aSurf.w - 8.0) < 0.5) {
  float sway = max(0.0, transformed.y - 1.8);
  transformed.x += sin(uTime * 1.3 + wp.z * 0.15 + wp.x * 0.21) * 0.035 * sway;
  transformed.z += cos(uTime * 1.07 + wp.x * 0.17) * 0.025 * sway;
}
vWorldP = mod(wp + 1024.0, vec3(2048.0));
vWorldN = normalize(wn);
`;

const FRAGMENT_PARS = /* glsl */ `
${COMMON}
float sHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float sNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), u.x), mix(sHash(i + vec2(0.0, 1.0)), sHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
// Planar coordinates on the face the surface points along: walls use (along, up), floors use (x, z).
vec2 sPlane() {
  vec3 n = abs(vWorldN);
  if (n.y > n.x && n.y > n.z) return vWorldP.xz;
  if (n.x > n.z) return vec2(vWorldP.z, vWorldP.y);
  return vec2(vWorldP.x, vWorldP.y);
}
bool sWall() { vec3 n = abs(vWorldN); return n.y < 0.7; }
// Running-bond blocks: returns mortar (1 in the joint) and a per-block random value.
vec2 sBlocks(vec2 uv, vec2 size, float joint) {
  float row = floor(uv.y / size.y);
  float x = uv.x + mod(row, 2.0) * 0.5 * size.x;
  vec2 cell = vec2(floor(x / size.x), row);
  vec2 f = vec2(fract(x / size.x) * size.x, fract(uv.y / size.y) * size.y);
  float m = min(min(f.x, size.x - f.x), min(f.y, size.y - f.y));
  return vec2(1.0 - smoothstep(joint * 0.35, joint, m), sHash(cell));
}
int sKind() { return int(vSurf.w + 0.5); }
// How visible a pattern with the given period (metres) is at this pixel: fades out before it would alias.
float sVis(float period, float footprint) { return 1.0 - smoothstep(0.18, 0.5, footprint / period); }
// Surface detail: colour multiplier (rgb) and height for bump (a).
vec4 sDetail() {
  int k = sKind();
  vec2 uv = sPlane();
  // World size of this pixel on the surface.
  float fp = max(length(fwidth(vWorldP)), 1e-4);
  if (k == 3 && sWall()) {
    float v = sVis(0.19, fp);
    vec2 b = sBlocks(uv, vec2(0.46, 0.19), 0.03);
    vec3 tint = vec3(0.9 + b.y * 0.2 * v) * (0.96 + sNoise(uv * 9.0) * 0.08 * sVis(0.11, fp));
    tint = mix(tint, vec3(1.28, 1.24, 1.16), b.x * v);
    return vec4(tint, mix(0.5, 1.0 - b.x, v));
  }
  if (k == 4 && sWall()) {
    // Dressed stone: large blocks with fine, light joints and a gentle mottle.
    float v = sVis(0.6, fp);
    vec2 b = sBlocks(uv, vec2(1.6, 0.6), 0.018);
    vec3 tint = vec3(0.97 + b.y * 0.06 * v) * (0.96 + sNoise(uv * 3.0) * 0.08 * sVis(0.33, fp));
    tint = mix(tint, vec3(0.93), b.x * v);
    return vec4(tint, mix(0.5, 1.0 - b.x * 0.5, v));
  }
  if (k == 5 || k == 3 || k == 4) {
    float n = sNoise(uv * 7.0) * 0.6 * sVis(0.14, fp) + sNoise(uv * 23.0) * 0.4 * sVis(0.045, fp);
    return vec4(vec3(0.97 + n * 0.07), n);
  }
  if (k == 6) {
    float grain = sNoise(uv * 38.0) * 0.55 * sVis(0.026, fp) + sNoise(uv * 11.0) * 0.45 * sVis(0.09, fp);
    float patches = sNoise(uv * 0.22) * 0.6 + sNoise(uv * 0.9) * 0.4;
    vec3 tint = vec3(0.93 + grain * 0.14) * (0.94 + patches * 0.1);
    return vec4(tint, grain);
  }
  if (k == 7) {
    vec2 slab = floor(uv / 1.5);
    float n = sNoise(uv * 30.0) * sVis(0.033, fp);
    vec3 tint = vec3(0.95 + sHash(slab) * 0.08 * sVis(1.5, fp)) * (0.97 + n * 0.06);
    return vec4(tint, n * 0.6);
  }
  if (k == 8) {
    float clump = sNoise(vWorldP.xy * 1.3 + vWorldP.zx * 0.9);
    float leaf = sNoise(vWorldP.xz * 9.0 + vWorldP.y * 7.0) * sVis(0.11, fp);
    return vec4(vec3(0.82 + clump * 0.3) * (0.94 + leaf * 0.12), leaf);
  }
  if (k == 9) {
    float weave = sNoise(uv * 60.0) * 0.5 * sVis(0.017, fp) + sNoise(uv * 14.0) * 0.5 * sVis(0.07, fp);
    return vec4(vec3(0.96 + weave * 0.08), weave);
  }
  if (k == 10) {
    float grain = sNoise(vec2(uv.x * 2.0, uv.y * 26.0)) * 0.7 * sVis(0.04, fp) + sNoise(uv * 8.0) * 0.3;
    return vec4(vec3(0.9 + grain * 0.18), grain);
  }
  if (k == 11) {
    float v = sVis(0.24, fp);
    vec2 b = sBlocks(vec2(vWorldP.x + vWorldP.z, vWorldP.y * 2.2), vec2(0.42, 0.24), 0.02);
    return vec4(vec3(0.92 + b.y * 0.12 * v) * (1.0 - b.x * 0.25 * v), mix(0.5, 1.0 - b.x, v));
  }
  if (k == 1) {
    // Glass: a soft diagonal sheen, as in the kit's windows.
    float sheen = smoothstep(0.55, 1.0, sin((vWorldP.x + vWorldP.z) * 0.9 + vWorldP.y * 1.6) * 0.5 + 0.5);
    return vec4(vec3(1.0 + sheen * 0.45), 0.0);
  }
  return vec4(1.0, 1.0, 1.0, 0.0);
}
// Bump from a procedural height, using screen-space derivatives (as three.js does for bump maps).
vec3 sBump(vec3 surfPos, vec3 surfNorm, float height, float scale, float faceDirection) {
  vec2 dHdxy = vec2(dFdx(height), dFdy(height)) * scale;
  vec3 vSigmaX = normalize(dFdx(surfPos));
  vec3 vSigmaY = normalize(dFdy(surfPos));
  vec3 vN = surfNorm;
  vec3 R1 = cross(vSigmaY, vN);
  vec3 R2 = cross(vN, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surfNorm - vGrad);
}
`;

let detailOn = true;

/** Patch a standard or physical material so it reads per-vertex surfaces; detail follows the graphics setting. */
function patch(m: THREE.MeshStandardMaterial): void {
  m.onBeforeCompile = (shader) => {
    const detail = detailOn;
    shader.uniforms.uTime = shaderTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX_MAIN}`);
    let fs = shader.fragmentShader.replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}\n${detail ? '#define SURFACE_DETAIL' : ''}`);
    fs = fs.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
vec4 sd = vec4(1.0, 1.0, 1.0, 0.0);
#ifdef SURFACE_DETAIL
  sd = sDetail();
#endif
diffuseColor.rgb *= sd.rgb;`,
    );
    fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = clamp(vSurf.x + (sd.a - 0.5) * 0.12 * step(0.5, vSurf.x), 0.04, 1.0);`);
    fs = fs.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\nmetalnessFactor = vSurf.y;`);
    fs = fs.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
#ifdef SURFACE_DETAIL
  int bk = sKind();
  if (bk >= 3 && bk != 8) normal = sBump(-vViewPosition, normal, sd.a, bk == 3 || bk == 4 ? 0.9 : 0.35, faceDirection);
#endif`,
    );
    // Lamps and lit shop windows glow a little.
    fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\nif (sKind() == 2) totalEmissiveRadiance += diffuseColor.rgb * 0.55;`);
    if (m instanceof THREE.MeshPhysicalMaterial) fs = fs.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>\nmaterial.clearcoat *= vSurf.z;`);
    shader.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => `surface-${m.type}-${detailOn ? 1 : 0}`;
}

// People: legs and arms tagged in the model swing from hip and shoulder in the vertex shader, driven per person by
// aAnim = (stride phase, swing amplitude, wave, unused).
const LIMB_PARS = /* glsl */ `
attribute vec3 aLimb;
attribute vec4 aAnim;
mat3 lRotX(float a) { float c = cos(a); float s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 lRotZ(float a) { float c = cos(a); float s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
mat3 limbRotation() {
  float id = aLimb.x;
  if (id < 0.5) return mat3(1.0);
  bool leg = id < 2.5;
  float side = (abs(id - 1.0) < 0.5 || abs(id - 3.0) < 0.5) ? -1.0 : 1.0;
  float swing = sin(aAnim.x + (side > 0.0 ? 3.14159 : 0.0)) * aAnim.y;
  if (!leg) swing *= -0.85;
  // A wave raises the right arm and rocks it.
  if (id > 3.5 && aAnim.z > 0.01) return lRotZ(aAnim.z * (2.5 + sin(aAnim.x * 3.0) * 0.3));
  return lRotX(swing);
}
`;

let peopleMat: THREE.MeshStandardMaterial | null = null;

/** Walking, waving people: the world material plus limb animation. */
export function peopleMaterial(): THREE.MeshStandardMaterial {
  if (!peopleMat) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1 });
    patch(m);
    const surface = m.onBeforeCompile;
    m.onBeforeCompile = (shader, renderer) => {
      surface(shader, renderer);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${LIMB_PARS}`)
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nmat3 limbR = limbRotation();\nobjectNormal = limbR * objectNormal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec3 limbPivot = vec3(aLimb.z, aLimb.y, 0.0);\ntransformed = limbR * (transformed - limbPivot) + limbPivot;');
    };
    m.customProgramCacheKey = () => `people-${detailOn ? 1 : 0}`;
    peopleMat = m;
  }
  return peopleMat;
}

let vehicleMat: THREE.MeshPhysicalMaterial | null = null;
let worldMat: THREE.MeshStandardMaterial | null = null;

/** Vehicles and street furniture: physical material with a clear coat where the surface asks for one. */
export function vehicleMaterial(): THREE.MeshPhysicalMaterial {
  if (!vehicleMat) {
    vehicleMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, metalness: 1, clearcoat: 1, clearcoatRoughness: 0.18 });
    patch(vehicleMat);
  }
  return vehicleMat;
}

/** Buildings, roads, trees and people: standard material with procedural surface detail. */
export function worldMaterial(): THREE.MeshStandardMaterial {
  if (!worldMat) {
    worldMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1 });
    patch(worldMat);
  }
  return worldMat;
}

let reflections: THREE.Texture | null = null;
let reflectionsOn = true;

/** Sky reflections for vehicles and painted street furniture. */
export function setReflections(tex: THREE.Texture | null, on = reflectionsOn): void {
  reflections = tex ?? reflections;
  reflectionsOn = on;
  const m = vehicleMaterial();
  m.envMap = on ? reflections : null;
  m.envMapIntensity = 0.75;
  m.needsUpdate = true;
}

/** Turn procedural detail on or off (graphics quality). */
export function setSurfaceDetail(on: boolean): void {
  if (on === detailOn) return;
  detailOn = on;
  for (const m of [vehicleMat, worldMat, peopleMat]) if (m) m.needsUpdate = true;
}
