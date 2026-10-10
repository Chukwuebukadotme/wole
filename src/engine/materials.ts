import * as THREE from 'three';
import { lightPoolTexture } from './textures.ts';

const lambertCache = new Map<number, THREE.MeshLambertMaterial>();
const basicCache = new Map<number, THREE.MeshBasicMaterial>();

/** Shared lit material per colour. */
export function lambert(color: number): THREE.MeshLambertMaterial {
  let m = lambertCache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    lambertCache.set(color, m);
  }
  return m;
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
