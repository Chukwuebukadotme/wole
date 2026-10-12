// Street buildings. Each faces +Z with its front-bottom-centre at the origin and extends back into -Z.
// Sign slots mark where shop signs (drawn with a shared text atlas) go on the facade.
import type { Rng } from '../rules/util.ts';
import { pick } from '../rules/util.ts';
import { C } from './materials.ts';
import { G, Shape, shade } from './kit.ts';

export interface SignSlot {
  readonly x: number;
  readonly y: number;
  /** Distance in front of the facade. */
  readonly z: number;
  readonly w: number;
  readonly h: number;
  /** 'shop' fascia signs or 'board' billboards. */
  readonly kind: 'shop' | 'board';
}

export interface BuildingArt {
  readonly shape: Shape;
  /** Width along the street. */
  readonly w: number;
  readonly signs: readonly SignSlot[];
}

const GLASS = C.glass;
const WARM = 0xffd98e;
const SLATE = 0x4a5468;

/** Sash window with a cream frame and lintel. */
function sash(s: Shape, x: number, y: number, w: number, h: number, frame: number, lintel = true): void {
  s.add(G.rbox(w + 0.16, h + 0.16, 0.12, 0.03), frame, { x, y, z: 0.02 });
  s.add(G.box(w, h, 0.06), GLASS, { x, y, z: 0.08 });
  s.add(G.box(w, 0.05, 0.04), frame, { x, y, z: 0.12 });
  if (lintel) s.add(G.rbox(w + 0.34, 0.16, 0.18, 0.03), frame, { x, y: y + h / 2 + 0.16, z: 0.05 });
  s.add(G.rbox(w + 0.28, 0.08, 0.24, 0.02), frame, { x, y: y - h / 2 - 0.1, z: 0.08 });
}

/** Arched warehouse window. */
function archWindow(s: Shape, x: number, y: number, w: number, h: number, trim: number): void {
  s.add(G.box(w, h, 0.06), GLASS, { x, y, z: 0.05 });
  s.add(G.cyl(w / 2, w / 2, 0.06, 8), GLASS, { x, y: y + h / 2, z: 0.05, rx: Math.PI / 2 });
  s.add(G.torus(w / 2 + 0.08, 0.1, 3, 8, Math.PI), trim, { x, y: y + h / 2, z: 0.08 });
  s.add(G.rbox(w + 0.2, 0.1, 0.2, 0.03), trim, { x, y: y - h / 2 - 0.06, z: 0.08 });
}

function windowBox(s: Shape, x: number, y: number, w: number): void {
  s.add(G.rbox(w, 0.22, 0.28, 0.05), 0x2b2f36, { x, y, z: 0.22 });
  for (let i = 0; i < 3; i++) s.add(G.sphere(0.17, 6, 4), i % 2 ? C.leaf : C.leafDark, { x: x + (i - 1) * w * 0.32, y: y + 0.18, z: 0.24 });
}

function chimney(s: Shape, x: number, y: number, z: number, brick: number): void {
  s.add(G.rbox(0.9, 1.2, 0.6, 0.06), brick, { x, y: y + 0.6, z });
  s.add(G.rbox(1.0, 0.12, 0.7, 0.03), shade(brick, 0.8), { x, y: y + 1.2, z });
  s.pair(G.cyl(0.11, 0.13, 0.36, 8), 0xc0623a, { x: 0.2, y: y + 1.42, z });
}

// ---------- London ----------
const BRICKS = [0xc0643e, 0xb4583a, 0xa5503a, 0xc9774c, 0x9c4a33];
const STOCK = [0xc9a46a, 0xbf9a62, 0xd2b27a];
const DOORS = [0xa8322d, 0x1f3a6b, 0x2f6b4f, 0xffd447, 0x23262d];
const AWNINGS = [0x1f3a6b, 0x2b4a7c, 0x2f6b4f, 0xa8322d, 0x23262d];

/** Brick corner shop: shopfront with an awning, sash windows, window boxes and chimneys. */
function londonShop(rng: Rng): BuildingArt {
  const s = new Shape();
  const brick = pick(BRICKS, rng);
  const trim = C.cream;
  const floors = rng() < 0.5 ? 3 : 4;
  const w = pick([8, 9, 10], rng);
  const d = 8;
  const fh = 3.2;
  const h = 4 + (floors - 1) * fh;
  s.add(G.rbox(w, h, d, 0.12), brick, { y: h / 2, z: -d / 2 });
  // Shopfront.
  const awning = pick(AWNINGS, rng);
  s.add(G.rbox(w - 0.6, 3.4, 0.3, 0.06), awning, { y: 1.75, z: 0.1 });
  s.add(G.box(w - 1.6, 2.1, 0.06), WARM, { x: -0.4, y: 1.45, z: 0.27 });
  for (let x = -w / 2 + 1.4; x < w / 2 - 1.8; x += 1.4) s.add(G.box(0.08, 2.1, 0.06), awning, { x, y: 1.45, z: 0.3 });
  s.add(G.box(0.9, 2.2, 0.06), shade(awning, 0.7), { x: w / 2 - 1.2, y: 1.1, z: 0.29 });
  s.add(G.rbox(w - 0.4, 0.5, 1.5, 0.08), awning, { y: 3.15, z: 0.85, rx: 0.32 });
  s.add(G.rbox(w - 0.3, 0.16, 0.36, 0.04), trim, { y: 3.65, z: 0.16 });
  const signs: SignSlot[] = [{ x: 0, y: 3.88, z: 0.32, w: Math.min(5.2, w - 1.4), h: 0.62, kind: 'shop' }];
  // Upper floors.
  const cols = Math.max(2, Math.round(w / 2.4));
  for (let f = 1; f < floors; f++) {
    const y = 4 + (f - 1) * fh + 1.55;
    s.add(G.rbox(w + 0.06, 0.14, 0.2, 0.03), shade(trim, 0.96), { y: y - 1.55, z: 0.02 });
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + (w / cols) * (c + 0.5);
      sash(s, x, y, 1.0, 1.6, trim);
      if (f === 1 && rng() < 0.6) windowBox(s, x, y - 0.95, 1.1);
    }
  }
  s.add(G.rbox(w + 0.3, 0.42, 0.5, 0.06), trim, { y: h - 0.1, z: -0.05 });
  s.add(G.rbox(w - 0.2, 0.5, d - 0.4, 0.05), SLATE, { y: h + 0.2, z: -d / 2 });
  chimney(s, -w / 2 + 1.4, h, -2.5, brick);
  chimney(s, w / 2 - 1.6, h, -5, brick);
  return { shape: s, w, signs };
}

/** Terraced townhouse: white stucco ground floor, coloured door, railings, tall windows. */
function londonTerrace(rng: Rng): BuildingArt {
  const s = new Shape();
  const brick = pick([...BRICKS, ...STOCK], rng);
  const w = 6;
  const d = 10;
  const h = 13;
  s.add(G.rbox(w, h, d, 0.08), brick, { y: h / 2, z: -d / 2 });
  s.add(G.rbox(w + 0.02, 3.6, d, 0.06), C.white, { y: 1.8, z: -d / 2 + 0.02 });
  s.add(G.rbox(1.2, 2.4, 0.2, 0.05), C.white, { x: -1.3, y: 1.4, z: 0.12 });
  s.add(G.rbox(0.9, 2.1, 0.08, 0.03), pick(DOORS, rng), { x: -1.3, y: 1.25, z: 0.22 });
  s.add(G.cyl(0.45, 0.45, 0.08, 10, ), GLASS, { x: -1.3, y: 2.55, z: 0.2, rx: Math.PI / 2 });
  sash(s, 1.2, 1.9, 1.3, 1.9, C.white, false);
  for (let f = 0; f < 3; f++) for (const x of [-1.3, 1.2]) sash(s, x, 5.2 + f * 2.8, 1.1, 1.9, C.cream);
  // Black railings and a step.
  for (let x = -2.8; x <= 2.8; x += 0.24) if (Math.abs(x + 1.3) > 0.55) s.add(G.box(0.04, 0.9, 0.04), C.black, { x, y: 0.45, z: 0.75 });
  s.add(G.box(5.8, 0.06, 0.06), C.black, { y: 0.88, z: 0.75 });
  s.add(G.rbox(w + 0.3, 0.36, 0.5, 0.06), C.cream, { y: h - 0.1 });
  s.add(G.rbox(w - 0.2, 1.4, d - 2, 0.1), SLATE, { y: h + 0.5, z: -d / 2 });
  chimney(s, 0, h + 1.1, -d / 2, brick);
  return { shape: s, w, signs: [] };
}

/** Pub on a corner: dark painted ground floor with gold lettering board, brick above, hanging baskets. */
function londonPub(rng: Rng): BuildingArt {
  const s = new Shape();
  const brick = pick(BRICKS, rng);
  const paint = pick([0x1f3a2f, 0x1f2f4e, 0x5a1f24], rng);
  const w = 9;
  const d = 9;
  const h = 10.5;
  s.add(G.rbox(w, h, d, 0.12), brick, { y: h / 2, z: -d / 2 });
  s.add(G.rbox(w + 0.1, 3.9, 0.36, 0.06), paint, { y: 1.95, z: 0.12 });
  for (const x of [-2.8, 0.2, 3.0]) s.add(G.box(2.0, 2.0, 0.06), WARM, { x, y: 1.6, z: 0.32 });
  s.add(G.rbox(w + 0.2, 0.7, 0.4, 0.05), paint, { y: 3.55, z: 0.22 });
  s.add(G.box(w - 0.4, 0.06, 0.06), 0xe8b847, { y: 3.2, z: 0.44 });
  for (const x of [-3.2, 3.2]) {
    s.add(G.sphere(0.4, 10, 8), C.leaf, { x, y: 4.6, z: 0.6 });
    s.add(G.sphere(0.18, 8, 6), C.red, { x: x + 0.25, y: 4.6, z: 0.9 });
  }
  for (let f = 0; f < 2; f++) for (const x of [-3, 0, 3]) sash(s, x, 5.8 + f * 2.9, 1.1, 1.7, C.cream);
  s.add(G.rbox(w + 0.3, 0.42, 0.5, 0.06), C.cream, { y: h - 0.1 });
  chimney(s, -2.5, h, -3, brick);
  return { shape: s, w, signs: [{ x: 0, y: 3.55, z: 0.44, w: 5, h: 0.56, kind: 'shop' }] };
}

/** Newer block of flats: cream panels with glass bands and balconies. */
function londonModern(rng: Rng): BuildingArt {
  const s = new Shape();
  const w = 12;
  const d = 12;
  const floors = 5 + Math.floor(rng() * 3);
  const h = 4.2 + floors * 3;
  const panel = pick([0xe9e1cf, 0xd9d3c4, 0xc9a46a], rng);
  s.add(G.rbox(w, h, d, 0.15), panel, { y: h / 2, z: -d / 2 });
  s.add(G.box(w - 1, 3.2, 0.06), WARM, { y: 1.7, z: 0.05 });
  s.add(G.rbox(w + 0.2, 0.3, 1.4, 0.06), 0x2b2f36, { y: 3.6, z: 0.6 });
  for (let f = 0; f < floors; f++) {
    const y = 4.2 + f * 3 + 1.4;
    s.add(G.box(w - 0.8, 1.7, 0.06), GLASS, { y, z: 0.04 });
    if (f % 2 === 0) s.add(G.rbox(w - 2, 0.12, 0.9, 0.04), panel, { y: y - 1.0, z: 0.45 });
    if (f % 2 === 0) s.add(G.box(w - 2, 0.7, 0.04), 0xcfe3ea, { y: y - 0.6, z: 0.9 });
  }
  return { shape: s, w, signs: [{ x: 0, y: 3.95, z: 0.62, w: 5, h: 0.5, kind: 'shop' }] };
}

/** Wapping warehouse: tall brick with arched windows, loading doors and a crane jib. */
function londonWarehouse(rng: Rng): BuildingArt {
  const s = new Shape();
  const brick = pick([...BRICKS, ...STOCK], rng);
  const trim = pick([C.cream, 0xe9c48c], rng);
  const w = pick([12, 14], rng);
  const d = 14;
  const floors = 5;
  const h = floors * 3.4 + 0.6;
  s.add(G.rbox(w, h, d, 0.1), brick, { y: h / 2, z: -d / 2 });
  const cols = Math.round(w / 2.6);
  for (let f = 0; f < floors; f++) {
    const y = 1.6 + f * 3.4;
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + (w / cols) * (c + 0.5);
      if (Math.abs(x) < 0.8) continue;
      archWindow(s, x, y, 1.2, 1.6, trim);
    }
    // Loading doors stacked up the middle, navy painted.
    s.add(G.rbox(1.5, 2.3, 0.14, 0.04), C.ink, { y: y + 0.2, z: 0.07 });
    s.add(G.box(1.7, 0.12, 0.6), C.black, { y: y - 1.0, z: 0.3 });
  }
  // Crane jib with its hook.
  s.add(G.rbox(0.25, 0.25, 2.2, 0.05), C.ink, { y: h - 1.2, z: 1.0 });
  s.add(G.rbox(0.18, 1.6, 0.18, 0.04), C.ink, { y: h - 1.9, z: 0.15, rx: 0.6 });
  s.add(G.box(0.03, 1.4, 0.03), C.black, { y: h - 1.9, z: 2.0 });
  s.add(G.torus(0.12, 0.04, 5, 8, Math.PI * 1.4), C.black, { y: h - 2.6, z: 2.0 });
  s.add(G.rbox(w + 0.2, 0.5, 0.4, 0.05), shade(brick, 0.85), { y: h, z: 0 });
  s.add(G.rbox(w - 0.4, 2.2, d - 1, 0.1), SLATE, { y: h + 1.0, z: -d / 2, sz: 0.9 });
  for (let x = -w / 2 + 0.6; x <= w / 2 - 0.6; x += 3) s.add(G.sphere(0.25, 8, 6), 0xd9cdb6, { x, y: 0.5, z: 0.4 });
  return { shape: s, w, signs: [] };
}

export type BuildingKind = 'london-shop' | 'london-terrace' | 'london-pub' | 'london-modern' | 'london-warehouse';

export const BUILDERS: Readonly<Record<BuildingKind, (rng: Rng) => BuildingArt>> = {
  'london-shop': londonShop,
  'london-terrace': londonTerrace,
  'london-pub': londonPub,
  'london-modern': londonModern,
  'london-warehouse': londonWarehouse,
};
