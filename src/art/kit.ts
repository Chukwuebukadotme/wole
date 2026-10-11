// Building blocks for the rounded cartoon look: parts are coloured per vertex and merged into one geometry,
// so a whole bus, house or tree draws in a single call with a single shared material.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Base shapes. All are centred on the origin; cylinders and capsules stand along +Y. */
export const G = {
  /** Box with rounded edges; the radius is clamped to fit. */
  rbox(w: number, h: number, d: number, r = 0.08, segments?: number): THREE.BufferGeometry {
    const radius = Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
    // Rounding under 5 cm cannot be seen in play, so tiny details are plain boxes (12 triangles, not 100+).
    if (radius < 0.05 && segments === undefined) return G.box(w, h, d);
    const seg = segments ?? (radius < 0.12 ? 1 : 2);
    return cached(`rb${r3(w)},${r3(h)},${r3(d)},${r3(radius)},${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, radius));
  },
  box(w: number, h: number, d: number): THREE.BufferGeometry {
    return cached(`b${r3(w)},${r3(h)},${r3(d)}`, () => new THREE.BoxGeometry(w, h, d));
  },
  cyl(rTop: number, rBottom: number, h: number, seg = 14): THREE.BufferGeometry {
    return cached(`c${r3(rTop)},${r3(rBottom)},${r3(h)},${seg}`, () => new THREE.CylinderGeometry(rTop, rBottom, h, seg));
  },
  sphere(r: number, ws = 14, hs = 10): THREE.BufferGeometry {
    return cached(`s${r3(r)},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
  },
  /** Top half of a sphere, flat side down. */
  dome(r: number, ws = 14, hs = 6): THREE.BufferGeometry {
    return cached(`d${r3(r)},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, Math.PI / 2));
  },
  capsule(r: number, len: number, cap = 4, radial = 10): THREE.BufferGeometry {
    return cached(`k${r3(r)},${r3(len)},${cap},${radial}`, () => new THREE.CapsuleGeometry(r, len, cap, radial));
  },
  cone(r: number, h: number, seg = 12): THREE.BufferGeometry {
    return cached(`n${r3(r)},${r3(h)},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
  },
  torus(r: number, tube: number, rs = 8, ts = 18, arc = Math.PI * 2): THREE.BufferGeometry {
    return cached(`t${r3(r)},${r3(tube)},${rs},${ts},${r3(arc)}`, () => new THREE.TorusGeometry(r, tube, rs, ts, arc));
  },
  /** Flat polygon lying on the ground (facing up), from [x, z] corners; not cached. */
  flat(pts: readonly (readonly [number, number])[]): THREE.BufferGeometry {
    const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  },
  /** Flat quad facing +Z. */
  plane(w: number, h: number): THREE.BufferGeometry {
    return cached(`p${r3(w)},${r3(h)}`, () => new THREE.PlaneGeometry(w, h));
  },
};

/**
 * A side profile (x = along the vehicle, front at -x; y = up) extruded across the width, with rounded edges.
 * The result runs along Z (front at -Z) and is `width` wide, centred on x = 0.
 */
export function extrudeProfile(key: string, shape: THREE.Shape, width: number, round = 0.08): THREE.BufferGeometry {
  return cached(`x${key},${r3(width)},${r3(round)}`, () => {
    const depth = Math.max(0.01, width - 2 * round);
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: round, bevelSize: round * 0.6, bevelSegments: 2, curveSegments: 5 });
    g.rotateY(-Math.PI / 2).translate(depth / 2, 0, 0);
    return g;
  });
}

/** A flat outline (x along the vehicle, y up), for windows on a vehicle's side; it faces -X. */
export function sideFlat(key: string, pts: readonly (readonly [number, number])[]): THREE.BufferGeometry {
  return cached(`f${key}`, () => {
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    return new THREE.ShapeGeometry(shape).rotateY(-Math.PI / 2);
  });
}

/** Position, rotation (radians) and scale for a part. */
export interface Place {
  readonly x?: number;
  readonly y?: number;
  readonly z?: number;
  readonly rx?: number;
  readonly ry?: number;
  readonly rz?: number;
  readonly sx?: number;
  readonly sy?: number;
  readonly sz?: number;
  /** Uniform scale, applied on top of sx/sy/sz. */
  readonly s?: number;
}

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpColor = new THREE.Color();

export function matrixFor(p: Place): THREE.Matrix4 {
  const s = p.s ?? 1;
  tmpEuler.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0, 'YXZ');
  tmpQuat.setFromEuler(tmpEuler);
  tmpPos.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  tmpScale.set((p.sx ?? 1) * s, (p.sy ?? 1) * s, (p.sz ?? 1) * s);
  return tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
}

function flipWinding(g: THREE.BufferGeometry): void {
  const idx = g.index;
  if (!idx) return;
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, a);
  }
}

/** Prepare a part for merging: only position, normal and colour, always indexed. */
function prepared(src: THREE.BufferGeometry, color: number, m: THREE.Matrix4): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', src.getAttribute('position').clone());
  const normal = src.getAttribute('normal');
  if (normal) g.setAttribute('normal', normal.clone());
  if (src.index) g.setIndex(src.index.clone());
  else g.setIndex(Array.from({ length: src.getAttribute('position').count }, (_, i) => i));
  g.applyMatrix4(m);
  // Mirrored parts (negative scale) need their winding flipped to stay lit from outside.
  if (m.determinant() < 0) flipWinding(g);
  const count = g.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  tmpColor.setHex(color);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** A model under construction: coloured parts that merge into one geometry. */
export class Shape {
  private readonly parts: THREE.BufferGeometry[] = [];

  /** Add a base shape with a colour at a place. */
  add(geo: THREE.BufferGeometry, color: number, p: Place = {}): this {
    this.parts.push(prepared(geo, color, matrixFor(p)));
    return this;
  }

  /** Add a part on both sides, mirrored across x = 0 (pass the right-hand x). */
  pair(geo: THREE.BufferGeometry, color: number, p: Place): this {
    this.add(geo, color, p);
    return this.add(geo, color, { ...p, x: -(p.x ?? 0), ry: -(p.ry ?? 0), rz: -(p.rz ?? 0) });
  }

  /** Copy another shape's parts in, moved to a place (a negative scale mirrors them). */
  merge(other: Shape, p: Place = {}): this {
    const m = matrixFor(p).clone();
    const mirrored = m.determinant() < 0;
    for (const part of other.parts) {
      const g = part.clone();
      g.applyMatrix4(m);
      if (mirrored) flipWinding(g);
      this.parts.push(g);
    }
    return this;
  }

  get empty(): boolean {
    return this.parts.length === 0;
  }

  /** Merge everything into one geometry. */
  build(): THREE.BufferGeometry {
    if (this.parts.length === 0) return new THREE.BufferGeometry();
    const g = mergeGeometries(this.parts, false);
    if (!g) throw new Error('Could not merge model parts');
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Darken (f < 1) or lighten (f > 1) a colour. */
export function shade(hex: number, f: number): number {
  const c = new THREE.Color(hex);
  if (f < 1) c.multiplyScalar(f);
  else c.lerp(new THREE.Color(0xffffff), Math.min(1, f - 1));
  return c.getHex();
}

/** Blend two colours. */
export function mix(a: number, b: number, t: number): number {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}
