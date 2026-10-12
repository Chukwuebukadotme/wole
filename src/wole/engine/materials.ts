import * as THREE from 'three';
import { lightPoolTexture } from './textures.ts';

const lambertCache = new Map<number, THREE.MeshLambertMaterial>();
const basicCache = new Map<number, THREE.MeshBasicMaterial>();
/** The colour of each shared plain material, so models can merge their plain parts into one mesh. */
const plain = new WeakMap<THREE.Material, number>();

/** Shared lit material per colour. */
export function lambert(color: number): THREE.MeshLambertMaterial {
  let m = lambertCache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    lambertCache.set(color, m);
    plain.set(m, color);
  }
  return m;
}

/** Colour of a shared plain lit material, or null for anything textured, glowing or one-off. */
export function plainColor(m: THREE.Material | THREE.Material[]): number | null {
  return Array.isArray(m) ? null : (plain.get(m) ?? null);
}

const glossy: THREE.MeshStandardMaterial[] = [];
let environment: THREE.Texture | null = null;
let reflectionLevel = 0.7;

/** Register a glossy material (car paint) so it reflects the sky, dimming with the daylight. */
export function reflective<M extends THREE.MeshStandardMaterial>(m: M): M {
  m.envMap = environment;
  m.envMapIntensity = reflectionLevel;
  glossy.push(m);
  return m;
}

/** Sky reflections for every glossy material; null switches them off (low graphics). */
export function setEnvironment(tex: THREE.Texture | null): void {
  environment = tex;
  for (const m of glossy) {
    m.envMap = tex;
    m.needsUpdate = true;
  }
}

/** How strongly glossy things reflect the sky: full by day, faint at night. */
export function setReflectionLevel(k: number): void {
  if (Math.abs(k - reflectionLevel) < 0.01) return;
  reflectionLevel = k;
  for (const m of glossy) m.envMapIntensity = k;
}

let vertexLambert: THREE.MeshLambertMaterial | null = null;

/** Lit material that takes its colour from the mesh's vertices: many parts, one draw call. */
export function lambertVC(): THREE.MeshLambertMaterial {
  vertexLambert ??= new THREE.MeshLambertMaterial({ vertexColors: true });
  return vertexLambert;
}

/** Shared unlit material per colour. */
export function basic(color: number): THREE.MeshBasicMaterial {
  let m = basicCache.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color });
    basicCache.set(color, m);
  }
  return m;
}

/** Materials that change with darkness; created once the DOM exists. */
export interface NightMaterials {
  readonly facades: THREE.MeshLambertMaterial[];
  readonly lamp: THREE.MeshBasicMaterial;
  readonly pool: THREE.MeshBasicMaterial;
  readonly head: THREE.MeshBasicMaterial;
  readonly tail: THREE.MeshBasicMaterial;
  readonly skyline: THREE.MeshBasicMaterial[];
}

let nightMats: NightMaterials | null = null;

export function night(): NightMaterials {
  if (!nightMats) {
    nightMats = {
      facades: [],
      lamp: new THREE.MeshBasicMaterial({ color: 0x77705f }),
      pool: new THREE.MeshBasicMaterial({ map: lightPoolTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      head: new THREE.MeshBasicMaterial({ color: 0xd8d2bd }),
      tail: new THREE.MeshBasicMaterial({ color: 0x8a1c1c }),
      skyline: [],
    };
  }
  return nightMats;
}

const dayLamp = new THREE.Color(0x77705f);
const nightLamp = new THREE.Color(0xffe2a0);
const dayHead = new THREE.Color(0xd8d2bd);
const nightHead = new THREE.Color(0xfffbe6);
const dayTail = new THREE.Color(0x8a1c1c);
const nightTail = new THREE.Color(0xff3b30);

/** Apply a darkness level from 0 (day) to 1 (night). */
export function setNightLevel(n: number): void {
  const m = night();
  for (const f of m.facades) f.emissiveIntensity = n * 1.1;
  for (const s of m.skyline) s.opacity = n * 0.9;
  m.lamp.color.lerpColors(dayLamp, nightLamp, n);
  m.head.color.lerpColors(dayHead, nightHead, n);
  m.tail.color.lerpColors(dayTail, nightTail, n);
  m.pool.opacity = n * 0.6;
}
