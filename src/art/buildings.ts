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

// ---------- Lagos ----------
const CONCRETE = [0xefe3c8, 0xe6dcc6, 0xd9cfb8, 0xf2e8d2];
const PAINTS = [0xe9c46a, 0x9fd3c7, 0xf2a07b, 0xc3d4e8, 0xe7b8c8, 0xb8d98f, 0xf6e1a1];
const BANDS = [0xef4b43, 0x12bcc1, 0xffd447, 0x2d5bd0, 0x2a8a5a, 0xef7a2b, 0x7647d8];

/** Black plastic water tank on a stand: on half the roofs in Lagos. */
function waterTank(s: Shape, x: number, y: number, z: number): void {
  s.add(G.rbox(1.6, 0.3, 1.6, 0.05), 0x8a8a8a, { x, y: y + 0.15, z });
  s.add(G.cyl(0.62, 0.68, 1.3, 12), 0x23262d, { x, y: y + 0.95, z });
  s.add(G.cyl(0.35, 0.4, 0.12, 10), 0x23262d, { x, y: y + 1.65, z });
}

function acUnit(s: Shape, x: number, y: number): void {
  s.add(G.rbox(0.8, 0.55, 0.32, 0.05), C.white, { x, y, z: 0.18 });
  s.add(G.cyl(0.18, 0.18, 0.04, 10), 0x9aa3ad, { x: x - 0.15, y, z: 0.36, rx: Math.PI / 2 });
}

/** Barred window: navy glass behind simple burglar-proof bars. */
function barredWindow(s: Shape, x: number, y: number, w: number, h: number, frame: number): void {
  s.add(G.rbox(w + 0.14, h + 0.14, 0.1, 0.03), frame, { x, y, z: 0.03 });
  s.add(G.box(w, h, 0.05), GLASS, { x, y, z: 0.06 });
  for (let i = 1; i < 4; i++) s.add(G.box(0.04, h, 0.04), 0x3a3f48, { x: x - w / 2 + (w / 4) * i, y, z: 0.12 });
}

/** Lagos Island commercial block: tall cream concrete with a navy window grid and colourful awnings. */
function marinaBlock(rng: Rng): BuildingArt {
  const s = new Shape();
  const w = pick([12, 14], rng);
  const d = 12;
  const floors = 6 + Math.floor(rng() * 4);
  const h = 4 + floors * 3.1;
  const wall = pick(CONCRETE, rng);
  s.add(G.rbox(w, h, d, 0.12), wall, { y: h / 2, z: -d / 2 });
  s.add(G.box(w - 1, 2.6, 0.06), WARM, { y: 1.5, z: 0.05 });
  const awning = pick(BANDS, rng);
  s.add(G.rbox(w - 0.6, 0.35, 1.6, 0.06), awning, { y: 3.2, z: 0.8, rx: 0.2 });
  const cols = Math.round(w / 2);
  for (let f = 0; f < floors; f++) {
    const y = 4 + f * 3.1 + 1.5;
    s.add(G.rbox(w + 0.1, 0.18, 0.4, 0.04), shade(wall, 0.92), { y: y - 1.5, z: 0.15 });
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + (w / cols) * (c + 0.5);
      s.add(G.box(w / cols - 0.5, 1.7, 0.06), GLASS, { x, y, z: 0.04 });
      if (rng() < 0.15) acUnit(s, x + 0.4, y - 0.7);
    }
  }
  s.add(G.rbox(w + 0.2, 0.5, 0.4, 0.06), shade(wall, 0.9), { y: h, z: 0 });
  if (rng() < 0.7) waterTank(s, w / 2 - 2, h, -3);
  return { shape: s, w, signs: [{ x: 0, y: 3.85, z: 0.3, w: Math.min(6, w - 2), h: 0.7, kind: 'shop' }] };
}

/** Older Lagos Island shop-house: painted walls, a balcony, wooden shutters and a hand-painted sign. */
function oldShop(rng: Rng): BuildingArt {
  const s = new Shape();
  const w = pick([7, 8], rng);
  const d = 9;
  const floors = rng() < 0.5 ? 2 : 3;
  const h = 3.8 + (floors - 1) * 3;
  const wall = pick(PAINTS, rng);
  s.add(G.rbox(w, h, d, 0.1), wall, { y: h / 2, z: -d / 2 });
  s.add(G.rbox(w + 0.04, 0.6, d, 0.04), shade(wall, 0.85), { y: 0.3, z: -d / 2 + 0.02 });
  // Shop opening with a rolled-up shutter and goods inside.
  s.add(G.box(w - 1.6, 2.6, 0.06), 0x3a2e28, { y: 1.4, z: 0.04 });
  s.add(G.rbox(w - 1.4, 0.35, 0.3, 0.05), 0x9aa3ad, { y: 2.85, z: 0.12 });
  for (let i = 0; i < 4; i++) s.add(G.rbox(0.6, 0.5, 0.4, 0.05), pick(BANDS, rng), { x: -w / 2 + 1.3 + i * ((w - 2.6) / 3), y: 0.45, z: 0.25 });
  const shutter = pick([0x2a8a5a, 0x7a4a2c, 0x2d5bd0], rng);
  for (let f = 1; f < floors; f++) {
    const y = 3.8 + (f - 1) * 3 + 1.4;
    // Balcony slab and railing.
    s.add(G.rbox(w - 0.4, 0.16, 1.2, 0.04), shade(wall, 0.9), { y: y - 1.2, z: 0.6 });
    for (let x = -w / 2 + 0.5; x <= w / 2 - 0.5; x += 0.35) s.add(G.box(0.04, 0.85, 0.04), 0x2b2f36, { x, y: y - 0.7, z: 1.15 });
    s.add(G.box(w - 0.6, 0.06, 0.06), 0x2b2f36, { y: y - 0.28, z: 1.15 });
    for (const x of [-w / 4, w / 4]) {
      s.add(G.box(1.2, 1.8, 0.06), GLASS, { x, y, z: 0.04 });
      s.pair(G.box(0.55, 1.8, 0.06), shutter, { x: x + 0.9, y, z: 0.08 });
      s.add(G.box(0.55, 1.8, 0.06), shutter, { x: x - 0.9, y, z: 0.08 });
    }
  }
  s.add(G.rbox(w + 0.2, 0.4, 0.4, 0.05), C.white, { y: h, z: 0 });
  if (rng() < 0.5) waterTank(s, -w / 2 + 1.6, h, -2.5);
  return { shape: s, w, signs: [{ x: 0, y: 3.3, z: 0.2, w: w - 1.2, h: 0.8, kind: 'shop' }] };
}

/** Ikeja shop block: flat roof, bold colour sign band, burglar bars, AC units and a water tank. */
function ikejaBlock(rng: Rng): BuildingArt {
  const s = new Shape();
  const w = pick([8, 9, 10], rng);
  const d = 10;
  const floors = rng() < 0.55 ? 2 : 3;
  const h = 3.9 + (floors - 1) * 3.1;
  const wall = pick([...CONCRETE, 0xf4f1ea], rng);
  const band = pick(BANDS, rng);
  s.add(G.rbox(w, h, d, 0.1), wall, { y: h / 2, z: -d / 2 });
  s.add(G.box(w - 1.2, 2.5, 0.06), 0x2b3140, { y: 1.35, z: 0.04 });
  s.add(G.box(w - 1.6, 1.4, 0.04), WARM, { y: 1.6, z: 0.08 });
  s.add(G.rbox(w + 0.1, 1.1, 0.4, 0.06), band, { y: 3.25, z: 0.2 });
  const awn = pick([0x2d5bd0, 0xef4b43, 0x2a8a5a, 0xef7a2b], rng);
  if (rng() < 0.6) s.add(G.rbox(w - 0.4, 0.14, 1.4, 0.04), awn, { y: 2.65, z: 0.75, rx: 0.12 });
  const cols = Math.max(2, Math.round(w / 2.6));
  for (let f = 1; f < floors; f++) {
    const y = 3.9 + (f - 1) * 3.1 + 1.5;
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + (w / cols) * (c + 0.5);
      barredWindow(s, x, y, 1.3, 1.4, C.white);
      if (rng() < 0.4) acUnit(s, x + 0.95, y - 0.5);
    }
  }
  s.add(G.rbox(w + 0.1, 0.5, d, 0.05), shade(wall, 0.92), { y: h + 0.2, z: -d / 2 });
  waterTank(s, rng() < 0.5 ? -w / 2 + 1.5 : w / 2 - 1.5, h + 0.4, -3);
  return { shape: s, w, signs: [{ x: 0, y: 3.25, z: 0.42, w: w - 1, h: 0.95, kind: 'shop' }] };
}

/** Shopping plaza with a glass front and coloured fascia. */
function ikejaPlaza(rng: Rng): BuildingArt {
  const s = new Shape();
  const w = 14;
  const d = 12;
  const h = 11;
  const wall = pick(CONCRETE, rng);
  s.add(G.rbox(w, h, d, 0.15), wall, { y: h / 2, z: -d / 2 });
  for (let f = 0; f < 3; f++) s.add(G.box(w - 1, 2.2, 0.06), f === 0 ? WARM : GLASS, { y: 1.4 + f * 3.4, z: 0.04 });
  for (let f = 0; f < 3; f++) s.add(G.rbox(w + 0.1, 0.6, 0.35, 0.05), pick(BANDS, rng), { y: 2.9 + f * 3.4, z: 0.18 });
  return { shape: s, w, signs: [{ x: 0, y: 6.3, z: 0.4, w: 7, h: 0.55, kind: 'shop' }] };
}

/** Market shed: corrugated roof, open front piled with goods. */
function marketShed(rng: Rng): BuildingArt {
  const s = new Shape();
  const w = pick([6, 7, 8], rng);
  const d = 6;
  const roof = pick([0xa65a3a, 0x6c7a89, 0x3f6fa8, 0x8a8f96], rng);
  const wall = pick(PAINTS, rng);
  s.add(G.rbox(w, 3, d, 0.08), wall, { y: 1.5, z: -d / 2 - 0.4 });
  s.add(G.box(w - 0.8, 2.3, 0.06), 0x3a2e28, { y: 1.2, z: -0.38 });
  s.add(G.rbox(w + 0.6, 0.12, d + 1.4, 0.03), roof, { y: 3.35, z: -d / 2 + 0.2, rx: 0.12 });
  for (let i = 0; i < 6; i++) s.add(G.box(0.04, 0.02, d + 1.3), shade(roof, 0.8), { x: -w / 2 + (i + 0.5) * (w / 6), y: 3.43, z: -d / 2 + 0.2, rx: 0.12 });
  for (let i = 0; i < 5; i++) s.add(G.sphere(0.32, 8, 6), pick([0xef7a2b, 0xffd447, 0xef4b43, 0x6fb34f, 0xe9c46a], rng), { x: -w / 2 + 0.8 + i * ((w - 1.6) / 4), y: 0.9, z: 0.1 });
  s.add(G.rbox(w - 0.6, 0.7, 0.9, 0.05), 0x7a4a2c, { y: 0.35, z: 0.3 });
  return { shape: s, w, signs: [{ x: 0, y: 2.75, z: 0.06, w: w - 1.2, h: 0.55, kind: 'shop' }] };
}

/** Victoria Island glass tower on a cream podium with planters. */
function viTower(rng: Rng): BuildingArt {
  const s = new Shape();
  const w = 16;
  const d = 16;
  const floors = 12 + Math.floor(rng() * 7);
  const h = 6 + floors * 3.3;
  const glass = pick([0x2f6fb8, 0x3a85c8, 0x2c5f9e, 0x5aa0d8], rng);
  const frame = pick([C.cream, 0xe6edf2, 0xd9d3c4], rng);
  s.add(G.rbox(w, 6, d, 0.15), frame, { y: 3, z: -d / 2 });
  s.add(G.box(w - 2, 3.6, 0.06), WARM, { y: 2.2, z: 0.05 });
  const tw = w - 3;
  s.add(G.rbox(tw, h - 6, d - 3, 0.3), glass, { y: 6 + (h - 6) / 2, z: -d / 2 - 0.5 });
  for (let f = 0; f < floors; f += 1) s.add(G.box(tw + 0.08, 0.14, 0.1), frame, { y: 6 + f * 3.3, z: -1.95 });
  for (let x = -tw / 2 + 1.2; x <= tw / 2 - 1.2; x += 2.6) s.add(G.box(0.12, h - 6, 0.1), shade(frame, 0.95), { x, y: 6 + (h - 6) / 2, z: -1.95 });
  s.add(G.rbox(tw + 0.6, 1.2, d - 2.4, 0.2), frame, { y: h + 0.4, z: -d / 2 - 0.5 });
  for (const x of [-w / 2 + 1.2, w / 2 - 1.2]) {
    s.add(G.rbox(2, 0.7, 1.2, 0.08), 0xcfc6b0, { x, y: 0.35, z: 0.8 });
    s.add(G.sphere(0.6, 10, 8), C.leaf, { x, y: 0.95, z: 0.8 });
  }
  return { shape: s, w, signs: [{ x: 0, y: 4.6, z: 0.08, w: 6, h: 0.6, kind: 'shop' }] };
}

/** Mid-rise Victoria Island office: cream bands and long blue windows. */
function viOffice(rng: Rng): BuildingArt {
  const s = new Shape();
  const w = 14;
  const d = 12;
  const floors = 5 + Math.floor(rng() * 3);
  const h = 4 + floors * 3.2;
  const frame = pick([C.cream, 0xeee8db, 0xd9d3c4], rng);
  const glass = pick([0x3a85c8, 0x2f6fb8, 0x49a3c9], rng);
  s.add(G.rbox(w, h, d, 0.2), frame, { y: h / 2, z: -d / 2 });
  s.add(G.box(w - 1, 2.8, 0.06), WARM, { y: 1.6, z: 0.05 });
  for (let f = 0; f < floors; f++) s.add(G.box(w - 0.6, 1.9, 0.08), glass, { y: 4 + f * 3.2 + 1.5, z: 0.05 });
  // Rounded glass corner tower.
  s.add(G.cyl(2.6, 2.6, h + 2, 18), glass, { x: w / 2 - 2.2, y: (h + 2) / 2, z: -2.4 });
  for (let f = 0; f <= floors; f++) s.add(G.cyl(2.7, 2.7, 0.18, 18), frame, { x: w / 2 - 2.2, y: 4 + f * 3.2, z: -2.4 });
  return { shape: s, w, signs: [{ x: -2, y: 3.4, z: 0.08, w: 5.5, h: 0.55, kind: 'shop' }] };
}

export type BuildingKind =
  | 'london-shop'
  | 'london-terrace'
  | 'london-pub'
  | 'london-modern'
  | 'london-warehouse'
  | 'marina-block'
  | 'old-shop'
  | 'ikeja-block'
  | 'ikeja-plaza'
  | 'market-shed'
  | 'vi-tower'
  | 'vi-office';

export const BUILDERS: Readonly<Record<BuildingKind, (rng: Rng) => BuildingArt>> = {
  'london-shop': londonShop,
  'london-terrace': londonTerrace,
  'london-pub': londonPub,
  'london-modern': londonModern,
  'london-warehouse': londonWarehouse,
  'marina-block': marinaBlock,
  'old-shop': oldShop,
  'ikeja-block': ikejaBlock,
  'ikeja-plaza': ikejaPlaza,
  'market-shed': marketShed,
  'vi-tower': viTower,
  'vi-office': viOffice,
};
