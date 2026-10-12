// Street furniture and greenery. Each prop stands on the ground at the origin; anything with a front faces +Z.
import { mulberry32, pick } from '../rules/util.ts';
import { C } from './materials.ts';
import { G, Shape, shade } from './kit.ts';

const NAVY = C.ink;
const GOLD = 0xe8b847;
const TRUNK = 0x7a5233;

/** Round, puffy broadleaf tree. */
export function treeRound(seed: number, size = 1): Shape {
  const s = new Shape();
  const rng = mulberry32(seed);
  const h = (3.6 + rng() * 1.2) * size;
  s.add(G.cyl(0.16 * size, 0.24 * size, h, 8), TRUNK, { y: h / 2 });
  s.add(G.cyl(0.08 * size, 0.1 * size, 1.2 * size, 6), TRUNK, { x: 0.35 * size, y: h - 0.4 * size, rz: -0.6 });
  const greens = [C.leaf, C.leafDark, 0x7cc05a, 0x5aa04a];
  const puffs = [
    [0, 0.9, 0, 1.35],
    [0.9, 0.5, 0.2, 1.0],
    [-0.85, 0.55, -0.1, 1.0],
    [0.2, 0.6, 0.85, 0.95],
    [-0.2, 0.5, -0.85, 0.95],
    [0.1, 1.7, 0.1, 0.95],
    [0.6, 1.3, -0.5, 0.8],
  ] as const;
  for (const [x, y, z, r] of puffs) s.add(G.sphere(r * size, 10, 7), pick(greens, rng), { x: x * size, y: h + y * size, z: z * size });
  return s;
}

/** London heritage lamp post: navy column, gold band, lantern. */
export function lampLondon(): Shape {
  const s = new Shape();
  s.add(G.cyl(0.18, 0.24, 0.8, 10), NAVY, { y: 0.4 });
  s.add(G.cyl(0.08, 0.12, 4.6, 8), NAVY, { y: 3.0 });
  s.add(G.cyl(0.13, 0.13, 0.14, 10), GOLD, { y: 1.1 });
  s.add(G.torus(0.45, 0.05, 6, 12, Math.PI), NAVY, { x: 0.45, y: 5.3, ry: Math.PI / 2, rz: 0 });
  s.add(G.cyl(0.22, 0.12, 0.5, 8), NAVY, { x: 0.9, y: 5.1 });
  s.add(G.sphere(0.18, 10, 8), C.lamp, { x: 0.9, y: 4.8 });
  return s;
}

export function bollard(): Shape {
  const s = new Shape();
  s.add(G.cyl(0.13, 0.15, 0.85, 10), NAVY, { y: 0.42 });
  s.add(G.cyl(0.14, 0.14, 0.08, 10), C.yellow, { y: 0.7 });
  s.add(G.dome(0.13, 10, 4), NAVY, { y: 0.85 });
  return s;
}

export function bin(): Shape {
  const s = new Shape();
  s.add(G.cyl(0.3, 0.27, 0.9, 12), NAVY, { y: 0.45 });
  s.add(G.cyl(0.31, 0.31, 0.08, 12), C.yellow, { y: 0.8 });
  s.add(G.dome(0.31, 12, 4), NAVY, { y: 0.92, sy: 0.4 });
  return s;
}

export function planter(seed: number): Shape {
  const s = new Shape();
  const rng = mulberry32(seed);
  s.add(G.rbox(1.6, 0.6, 0.7, 0.08), NAVY, { y: 0.3 });
  for (let i = 0; i < 4; i++) s.add(G.sphere(0.32, 7, 5), pick([C.leaf, C.leafDark, 0x7cc05a], rng), { x: -0.55 + i * 0.37, y: 0.72, z: (rng() - 0.5) * 0.2 });
  for (let i = 0; i < 3; i++) s.add(G.sphere(0.1, 5, 3), pick([C.red, C.yellow, 0xe85d9c, C.white], rng), { x: -0.4 + i * 0.4, y: 0.95, z: 0.15 });
  return s;
}

/** Glass bus shelter with a navy roof and red bench; an advert panel at one end. */
export function shelter(_kind: 'london'): Shape {
  const s = new Shape();
  const w = 3.2;
  const frame = NAVY;
  for (const x of [-w / 2, w / 2]) for (const z of [-0.6, 0.6]) s.add(G.rbox(0.09, 2.4, 0.09, 0.03), frame, { x, y: 1.2, z });
  s.add(G.rbox(w + 0.4, 0.14, 1.7, 0.05), frame, { y: 2.45 });
  s.add(G.rbox(w - 0.4, 0.04, 1.2, 0.02), C.lamp, { y: 2.37 });
  s.add(G.box(w, 1.7, 0.04), 0xa9cfe0, { y: 1.25, z: -0.6 });
  s.add(G.box(0.04, 1.7, 1.1), 0xa9cfe0, { x: w / 2, y: 1.25 });
  s.add(G.rbox(0.1, 1.6, 1.0, 0.03), C.red, { x: -w / 2, y: 1.3 });
  s.add(G.rbox(1.9, 0.12, 0.42, 0.04), C.red, { y: 0.55, z: -0.25 });
  s.pair(G.box(0.06, 0.5, 0.3), frame, { x: 0.8, y: 0.28, z: -0.25 });
  return s;
}

/** Bus stop pole with a plain red ring sign (no operator branding). */
export function stopSign(_kind: 'london'): Shape {
  const s = new Shape();
  s.add(G.cyl(0.05, 0.06, 2.8, 8), NAVY, { y: 1.4 });
  s.add(G.rbox(0.66, 0.66, 0.06, 0.08), C.white, { y: 2.85 });
  s.add(G.torus(0.22, 0.06, 6, 18), C.red, { y: 2.85, z: 0.04 });
  s.add(G.rbox(0.42, 0.08, 0.03, 0.02), C.red, { y: 2.85, z: 0.06 });
  s.add(G.rbox(0.3, 0.6, 0.1, 0.04), C.white, { y: 1.7, z: 0.06 });
  return s;
}

/** Railing panel, `len` metres long. */
export function railing(len: number, color = NAVY): Shape {
  const s = new Shape();
  const posts = Math.max(2, Math.round(len / 2) + 1);
  for (let i = 0; i < posts; i++) {
    const x = -len / 2 + (len / (posts - 1)) * i;
    s.add(G.cyl(0.06, 0.07, 1.1, 6), color, { x, y: 0.55 });
    s.add(G.sphere(0.08, 6, 4), color, { x, y: 1.12 });
  }
  s.add(G.rbox(len, 0.07, 0.07, 0.03), color, { y: 1.0 });
  s.add(G.rbox(len, 0.05, 0.05, 0.02), color, { y: 0.55 });
  return s;
}

export function phoneBox(): Shape {
  const s = new Shape();
  s.add(G.rbox(1.0, 2.5, 1.0, 0.06), C.red, { y: 1.25 });
  s.add(G.rbox(1.1, 0.22, 1.1, 0.08), C.red, { y: 2.6 });
  s.add(G.dome(0.5, 12, 4), C.red, { y: 2.68, sy: 0.4 });
  s.add(G.box(0.8, 0.16, 1.02), 0x1f2f4e, { y: 2.32 });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) s.add(G.box(0.3, 0.3, 1.02), C.glass, { x: -0.18 + c * 0.36, y: 0.9 + r * 0.36 });
  return s;
}

export function postBox(): Shape {
  const s = new Shape();
  s.add(G.cyl(0.3, 0.32, 1.3, 14), C.red, { y: 0.65 });
  s.add(G.dome(0.33, 14, 5), C.red, { y: 1.3, sy: 0.45 });
  s.add(G.cyl(0.34, 0.34, 0.08, 14), shade(C.red, 0.7), { y: 1.28 });
  s.add(G.rbox(0.3, 0.05, 0.05, 0.02), C.black, { y: 1.05, z: 0.3 });
  return s;
}

/** Small white motor boat for the Marina and lagoon. */
export function boat(seed: number): Shape {
  const s = new Shape();
  const rng = mulberry32(seed);
  const stripe = pick([NAVY, C.teal, C.red], rng);
  s.add(G.rbox(2.2, 0.9, 6, 0.4), C.white, { y: 0.2 });
  s.add(G.cone(1.1, 1.8, 10), C.white, { y: 0.2, z: -3.6, rx: -Math.PI / 2, sx: 1, sz: 0.4 });
  s.add(G.rbox(2.24, 0.14, 5.4, 0.05), stripe, { y: 0.35 });
  s.add(G.rbox(1.5, 0.8, 1.8, 0.2), C.white, { y: 1.05, z: 0.6 });
  s.add(G.rbox(1.4, 0.4, 0.06, 0.04), C.glass, { y: 1.2, z: -0.32 });
  if (rng() < 0.5) {
    s.add(G.cyl(0.05, 0.05, 6, 6), 0xd9d3c4, { y: 3.5, z: 0.4 });
    s.add(G.cone(1.0, 4.0, 3), C.white, { x: 0.05, y: 3.6, z: 1.2, sz: 0.1 });
  }
  return s;
}

/** Quay edge: stone wall with a cap, seen from the road side. */
export function quayEdge(len: number): Shape {
  const s = new Shape();
  s.add(G.rbox(1.2, 1.2, len, 0.06), 0xb7aa92, { y: -0.45 });
  s.add(G.rbox(1.3, 0.16, len, 0.04), 0xd6cbb4, { y: 0.15 });
  return s;
}
