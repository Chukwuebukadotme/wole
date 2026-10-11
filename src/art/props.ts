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

/** Coconut palm with a gently curved trunk. */
export function palm(seed: number, size = 1): Shape {
  const s = new Shape();
  const rng = mulberry32(seed);
  const h = (6.5 + rng() * 2.5) * size;
  const lean = (rng() - 0.5) * 0.5;
  const segs = 7;
  let x = 0;
  let y = 0;
  for (let i = 0; i < segs; i++) {
    const seg = h / segs;
    const a = lean * (i / segs);
    s.add(G.cyl(0.17 * size, 0.21 * size, seg * 1.05, 8), i % 2 ? 0x9a7a52 : 0x8a6b45, { x: x + Math.sin(a) * seg * 0.5, y: y + seg * 0.5, rz: -a });
    x += Math.sin(a) * seg;
    y += Math.cos(a) * seg;
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rng() * 0.3;
    const len = (2.4 + rng() * 0.6) * size;
    s.add(G.rbox(0.62 * size, 0.08, len, 0.04), i % 2 ? 0x4f9a3e : 0x5fae48, {
      x: x + Math.sin(a) * len * 0.42,
      y: y - 0.25 * size,
      z: Math.cos(a) * len * 0.42,
      ry: a,
      rx: 0.5,
    });
  }
  for (let i = 0; i < 3; i++) s.add(G.sphere(0.16 * size, 8, 6), 0x7a5a2a, { x: x + Math.cos(i * 2.1) * 0.25, y: y - 0.3 * size, z: Math.sin(i * 2.1) * 0.25 });
  s.add(G.sphere(0.35 * size, 10, 8), 0x4f9a3e, { x, y: y - 0.05, z: 0 });
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

/** Modern Lagos street light: tall pole with a long arm. */
export function lampLagos(): Shape {
  const s = new Shape();
  s.add(G.cyl(0.2, 0.26, 0.6, 10), 0x6b7380, { y: 0.3 });
  s.add(G.cyl(0.09, 0.13, 7.4, 8), NAVY, { y: 4.0 });
  s.add(G.rbox(1.8, 0.1, 0.12, 0.04), NAVY, { x: 0.85, y: 7.6, rz: 0.08 });
  s.add(G.rbox(0.7, 0.14, 0.32, 0.06), NAVY, { x: 1.75, y: 7.55 });
  s.add(G.rbox(0.6, 0.04, 0.26, 0.02), C.lamp, { x: 1.75, y: 7.47 });
  return s;
}

/** Globe lamp on the Marina waterfront. */
export function lampGlobe(): Shape {
  const s = new Shape();
  s.add(G.cyl(0.14, 0.2, 0.5, 10), NAVY, { y: 0.25 });
  s.add(G.cyl(0.07, 0.09, 3.2, 8), NAVY, { y: 2.0 });
  s.add(G.sphere(0.32, 12, 10), C.white, { y: 3.85 });
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
export function shelter(kind: 'london' | 'lagos'): Shape {
  const s = new Shape();
  const w = 3.2;
  const frame = kind === 'london' ? NAVY : 0x2b3a55;
  for (const x of [-w / 2, w / 2]) for (const z of [-0.6, 0.6]) s.add(G.rbox(0.09, 2.4, 0.09, 0.03), frame, { x, y: 1.2, z });
  s.add(G.rbox(w + 0.4, 0.14, 1.7, 0.05), frame, { y: 2.45 });
  s.add(G.rbox(w - 0.4, 0.04, 1.2, 0.02), C.lamp, { y: 2.37 });
  s.add(G.box(w, 1.7, 0.04), 0xa9cfe0, { y: 1.25, z: -0.6 });
  s.add(G.box(0.04, 1.7, 1.1), 0xa9cfe0, { x: w / 2, y: 1.25 });
  s.add(G.rbox(0.1, 1.6, 1.0, 0.03), kind === 'london' ? C.red : C.yellow, { x: -w / 2, y: 1.3 });
  s.add(G.rbox(1.9, 0.12, 0.42, 0.04), C.red, { y: 0.55, z: -0.25 });
  s.pair(G.box(0.06, 0.5, 0.3), frame, { x: 0.8, y: 0.28, z: -0.25 });
  return s;
}

/** Bus stop pole: a plain red ring sign in London, a blue bus sign in Lagos. */
export function stopSign(kind: 'london' | 'lagos'): Shape {
  const s = new Shape();
  s.add(G.cyl(0.05, 0.06, 2.8, 8), NAVY, { y: 1.4 });
  if (kind === 'london') {
    s.add(G.rbox(0.66, 0.66, 0.06, 0.08), C.white, { y: 2.85 });
    s.add(G.torus(0.22, 0.06, 6, 18), C.red, { y: 2.85, z: 0.04 });
    s.add(G.rbox(0.42, 0.08, 0.03, 0.02), C.red, { y: 2.85, z: 0.06 });
    s.add(G.rbox(0.3, 0.6, 0.1, 0.04), C.white, { y: 1.7, z: 0.06 });
  } else {
    s.add(G.rbox(0.62, 0.62, 0.06, 0.08), 0x2d5bd0, { y: 2.8 });
    s.add(G.rbox(0.38, 0.24, 0.03, 0.05), C.white, { y: 2.84, z: 0.05 });
    s.add(G.box(0.3, 0.06, 0.02), 0x2d5bd0, { y: 2.88, z: 0.07 });
    s.pair(G.cyl(0.05, 0.05, 0.03, 8), C.white, { x: 0.11, y: 2.68, z: 0.05, rx: Math.PI / 2 });
  }
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

/** Lagos market stall: a table piled with produce under a big umbrella. */
export function marketStall(seed: number): Shape {
  const s = new Shape();
  const rng = mulberry32(seed);
  s.add(G.rbox(1.6, 0.08, 1.0, 0.03), 0x9a6a3e, { y: 0.8 });
  for (const [x, z] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]] as const) s.add(G.box(0.07, 0.8, 0.07), 0x7a5233, { x, y: 0.4, z });
  const produce = [0xef7a2b, 0xffd447, 0xef4b43, 0x6fb34f, 0xe9c46a, 0x8a4a9a];
  for (let i = 0; i < 9; i++) s.add(G.sphere(0.13 + rng() * 0.05, 6, 4), pick(produce, rng), { x: -0.6 + (i % 5) * 0.3, y: 0.95 + Math.floor(i / 5) * 0.12, z: -0.25 + (i % 3) * 0.25 });
  s.add(G.rbox(0.5, 0.35, 0.4, 0.06), pick([0x2d5bd0, 0xef4b43, 0x12bcc1], rng), { x: 0.9, y: 0.18, z: 0.5 });
  s.merge(umbrella(seed + 1), { x: 0, y: 0, z: -0.1 });
  return s;
}

/** Big two-colour market umbrella. */
export function umbrella(seed: number): Shape {
  const s = new Shape();
  const rng = mulberry32(seed);
  const pairs = [
    [0xef4b43, C.white],
    [0x12bcc1, 0xffd447],
    [0x2d5bd0, C.white],
    [0xffd447, 0x2a8a5a],
    [0xef7a2b, 0x2d5bd0],
  ] as const;
  const [a, b] = pick(pairs, rng);
  s.add(G.cyl(0.04, 0.04, 2.5, 6), 0xd9d3c4, { y: 1.25 });
  const panels = 8;
  for (let i = 0; i < panels; i++) {
    const ang = (i / panels) * Math.PI * 2;
    s.add(G.cone(0.82, 0.55, 3), i % 2 ? a : b, { x: Math.sin(ang) * 0.56, y: 2.42, z: Math.cos(ang) * 0.56, ry: ang, rx: 0.42, sz: 0.55 });
  }
  s.add(G.cone(1.25, 0.5, panels), a, { y: 2.55 });
  return s;
}

/** Ikeja power pole with a cross-arm; cables are drawn between poles. */
export function powerPole(): Shape {
  const s = new Shape();
  s.add(G.cyl(0.12, 0.16, 9, 8), 0x8a8f96, { y: 4.5 });
  s.add(G.rbox(2.2, 0.14, 0.14, 0.03), 0x6b6f78, { y: 8.4 });
  for (const x of [-0.9, 0, 0.9]) s.add(G.cyl(0.06, 0.06, 0.22, 6), C.white, { x, y: 8.6 });
  s.add(G.rbox(0.5, 0.7, 0.4, 0.05), 0x6b6f78, { y: 7.2, z: 0.25 });
  return s;
}

/** Billboard frame on two legs; the picture is a separate textured board. */
export function billboard(): Shape {
  const s = new Shape();
  for (const x of [-2.4, 2.4]) s.add(G.rbox(0.3, 6, 0.3, 0.05), NAVY, { x, y: 3 });
  s.add(G.rbox(8.4, 3.4, 0.3, 0.12), NAVY, { y: 7.2 });
  s.add(G.rbox(8, 0.12, 0.6, 0.04), NAVY, { y: 5.4, z: 0.3 });
  for (const x of [-2.8, 0, 2.8]) s.add(G.rbox(0.4, 0.18, 0.4, 0.05), NAVY, { x, y: 9.1, z: 0.3, rx: -0.4 });
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

/** Concrete flower bed with black-and-white striped kerb, as on Lagos avenues. */
export function stripedBed(len: number, seed: number): Shape {
  const s = new Shape();
  const rng = mulberry32(seed);
  const n = Math.round(len / 0.8);
  for (let i = 0; i < n; i++) s.add(G.box(0.8, 0.32, 0.25), i % 2 ? C.white : 0x23262d, { x: -len / 2 + 0.4 + i * 0.8, y: 0.16, z: 0.5 });
  s.add(G.box(len, 0.25, 1.0), 0x7a5a3a, { y: 0.12 });
  for (let i = 0; i < len / 0.9; i++) s.add(G.sphere(0.32, 6, 4), pick([C.leaf, C.leafDark, 0x7cc05a], rng), { x: -len / 2 + 0.5 + i * 0.9, y: 0.45, z: (rng() - 0.5) * 0.3 });
  return s;
}
