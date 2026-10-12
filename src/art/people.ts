// Rounded adults about five heads tall, in local clothes. Each look merges into one geometry so crowds can be instanced.
import type { CityId } from '../config/cities.ts';
import { mulberry32, pick, type Rng } from '../rules/util.ts';
import { C } from './materials.ts';
import { G, Shape, shade } from './kit.ts';

type Hair = 'short' | 'afro' | 'puffs' | 'braids' | 'bald' | 'cap' | 'gele' | 'beanie' | 'long' | 'bun' | 'fila';
type Outfit = 'trousers' | 'dress' | 'kaftan' | 'shorts' | 'coat';
type Extra = 'none' | 'backpack' | 'bag' | 'tote' | 'tray' | 'umbrella';

export interface Look {
  readonly skin: number;
  readonly hair: Hair;
  readonly hairColor: number;
  readonly outfit: Outfit;
  readonly top: number;
  readonly bottom: number;
  /** Second colour for patterned cloth, gele and bags. */
  readonly pattern: number;
  readonly shoes: number;
  readonly extra: Extra;
  /** Slightly taller or shorter. */
  readonly height: number;
}

const HAIR_LONDON = [0x1d1612, 0x3b2a1f, 0x6b4a2b, 0xc79a52, 0x8a3b22];
const BRIGHT = [0xef4b43, 0x12bcc1, 0xffd447, 0x7647d8, 0x2a8a5a, 0xef7a2b, 0xe85d9c, 0x2d5bd0];
const LONDON_TOPS = [0x2d5bd0, 0xef4b43, 0x12bcc1, 0x7647d8, 0x2b2f36, 0xf2efe6, 0x609d55, 0xc98a2b, 0x8a9099];
const LONDON_BOTTOMS = [0x1d2a44, 0x2b2f36, 0x3a4a6a, 0x6b6f78, 0xd8c8a6];
const SHOES = [0xf7f4ec, 0x23262d, 0x6b4a2b];

/** A random look for a Londoner. */
export function randomLook(_city: CityId, rng: Rng): Look {
  const skin = pick(C.skin, rng);
  const height = 0.94 + rng() * 0.12;
  const woman = rng() < 0.5;
  return {
    skin,
    hair: woman ? pick(['long', 'bun', 'puffs', 'braids', 'short', 'beanie'] as const, rng) : pick(['short', 'short', 'cap', 'bald', 'beanie', 'afro'] as const, rng),
    hairColor: pick(HAIR_LONDON, rng),
    outfit: pick(woman ? (['trousers', 'coat', 'dress'] as const) : (['trousers', 'coat', 'trousers', 'shorts'] as const), rng),
    top: pick(LONDON_TOPS, rng),
    bottom: pick(LONDON_BOTTOMS, rng),
    pattern: pick(BRIGHT, rng),
    shoes: pick(SHOES, rng),
    extra: pick(['none', 'none', 'backpack', 'bag', 'tote', 'umbrella'] as const, rng),
    height,
  };
}

function hairShape(s: Shape, look: Look, headY: number, r: number): void {
  const hc = look.hairColor;
  switch (look.hair) {
    case 'short':
      s.add(G.dome(r * 1.04, 10, 4), hc, { y: headY + r * 0.08, sy: 0.75 });
      break;
    case 'afro':
      s.add(G.sphere(r * 1.28, 10, 6), hc, { y: headY + r * 0.35, z: r * 0.15 });
      break;
    case 'puffs':
      s.add(G.dome(r * 1.03, 10, 4), hc, { y: headY + r * 0.1, sy: 0.7 });
      s.pair(G.sphere(r * 0.52, 7, 5), hc, { x: r * 0.82, y: headY + r * 0.7 });
      break;
    case 'braids':
      s.add(G.dome(r * 1.05, 10, 4), hc, { y: headY + r * 0.06, sy: 0.82 });
      for (let i = 0; i < 6; i++) s.add(G.capsule(r * 0.13, r * 1.3, 1, 4), hc, { x: (i - 2.5) * r * 0.28, y: headY - r * 0.55, z: r * 0.62 });
      break;
    case 'bun':
      s.add(G.dome(r * 1.04, 10, 4), hc, { y: headY + r * 0.06, sy: 0.82 });
      s.add(G.sphere(r * 0.45, 7, 5), hc, { y: headY + r * 0.9, z: r * 0.45 });
      break;
    case 'long':
      s.add(G.dome(r * 1.06, 10, 4), hc, { y: headY + r * 0.05, sy: 0.85 });
      s.add(G.rbox(r * 1.9, r * 1.8, r * 0.7, r * 0.3), hc, { y: headY - r * 0.7, z: r * 0.55 });
      break;
    case 'cap':
      s.add(G.dome(r * 1.06, 10, 4), look.pattern, { y: headY + r * 0.12, sy: 0.72 });
      s.add(G.rbox(r * 1.3, r * 0.1, r * 0.9, r * 0.05), look.pattern, { y: headY + r * 0.2, z: -r * 0.95 });
      break;
    case 'beanie':
      s.add(G.dome(r * 1.1, 10, 4), look.pattern, { y: headY + r * 0.05, sy: 0.95 });
      s.add(G.sphere(r * 0.22, 8, 6), C.white, { y: headY + r * 1.1 });
      break;
    case 'fila':
      // A soft Yoruba cap, folded to one side.
      s.add(G.cyl(r * 0.92, r * 1.02, r * 0.75, 10), look.pattern, { y: headY + r * 0.65, rz: 0.18 });
      break;
    case 'gele': {
      // A tall, fanned head-wrap in the outfit's print colour.
      const g = look.pattern;
      s.add(G.sphere(r * 1.12, 10, 7), g, { y: headY + r * 0.55, sy: 0.85 });
      s.add(G.torus(r * 0.8, r * 0.32, 5, 10), shade(g, 0.88), { y: headY + r * 1.0, rx: 1.2 });
      s.add(G.sphere(r * 0.6, 7, 5), shade(g, 1.12), { y: headY + r * 1.45, z: -r * 0.2, sx: 1.6, sy: 0.8 });
      break;
    }
    case 'bald':
      break;
  }
}

/** Standing adult facing -Z, feet on the ground. */
export function makePerson(look: Look): Shape {
  const s = new Shape();
  const k = look.height;
  const legLen = 0.6 * k;
  const hipY = 0.1 + legLen + 0.1;
  const torsoH = 0.56 * k;
  const torsoY = hipY + torsoH / 2 + 0.02;
  const shoulderY = torsoY + torsoH / 2 - 0.06;
  const headR = 0.19;
  const headY = shoulderY + 0.1 + headR;
  // Shoes and legs.
  s.pair(G.rbox(0.13, 0.09, 0.27, 0.045), look.shoes, { x: 0.1, y: 0.045, z: -0.04 });
  const legColor = look.outfit === 'dress' || look.outfit === 'shorts' ? look.skin : look.bottom;
  s.pair(G.capsule(0.085, legLen, 1, 6), legColor, { x: 0.1, y: 0.1 + legLen / 2 + 0.04 });
  if (look.outfit === 'shorts') s.pair(G.capsule(0.1, legLen * 0.35, 2, 6), look.bottom, { x: 0.1, y: hipY - legLen * 0.2 });
  // Body and clothes.
  s.add(G.rbox(0.38, 0.22, 0.25, 0.09), look.outfit === 'dress' || look.outfit === 'kaftan' ? look.top : look.bottom, { y: hipY });
  s.add(G.rbox(0.44, torsoH, 0.27, 0.12), look.top, { y: torsoY });
  if (look.outfit === 'dress') {
    s.add(G.cyl(0.22, 0.36, legLen * 0.85, 10), look.top, { y: hipY - legLen * 0.38 });
    s.add(G.cyl(0.36, 0.36, 0.07, 10), look.pattern, { y: hipY - legLen * 0.78 });
    s.add(G.cyl(0.23, 0.26, 0.06, 10), look.pattern, { y: hipY - legLen * 0.1 });
  } else if (look.outfit === 'kaftan') {
    s.add(G.cyl(0.24, 0.3, legLen * 0.62, 10), look.top, { y: hipY - legLen * 0.26 });
    s.add(G.rbox(0.12, torsoH * 0.6, 0.02, 0.01), look.pattern, { y: torsoY + 0.05, z: -0.14 });
  } else if (look.outfit === 'coat') {
    s.add(G.cyl(0.25, 0.29, legLen * 0.5, 10), look.top, { y: hipY - legLen * 0.15 });
    s.add(G.rbox(0.03, torsoH * 0.9, 0.02, 0.01), shade(look.top, 0.7), { y: torsoY - 0.05, z: -0.145 });
  } else {
    s.add(G.rbox(0.45, 0.06, 0.28, 0.03), look.pattern, { y: torsoY + torsoH * 0.12 });
  }
  // Arms hang slightly out from the body.
  const armLen = 0.46 * k;
  s.pair(G.capsule(0.068, armLen, 1, 5), look.top, { x: 0.28, y: shoulderY - armLen / 2 + 0.02, rz: 0.1 });
  s.pair(G.sphere(0.07, 6, 4), look.skin, { x: 0.31, y: shoulderY - armLen - 0.02 });
  // Neck, head and a friendly face.
  s.add(G.cyl(0.065, 0.075, 0.1, 6), look.skin, { y: shoulderY + 0.07 });
  s.add(G.sphere(headR, 10, 7), look.skin, { y: headY });
  s.pair(G.sphere(0.03, 5, 3), 0x1b1512, { x: 0.068, y: headY + 0.02, z: -headR * 0.92 });
  s.add(G.sphere(0.035, 5, 3), shade(look.skin, 0.85), { y: headY - 0.04, z: -headR * 0.98 });
  s.pair(G.sphere(0.04, 5, 3), shade(look.skin, 0.9), { x: headR * 0.97, y: headY });
  hairShape(s, look, headY, headR);
  // Things people carry.
  switch (look.extra) {
    case 'backpack':
      s.add(G.rbox(0.36, 0.42, 0.18, 0.08), look.pattern, { y: torsoY + 0.02, z: 0.22 });
      break;
    case 'bag':
      s.add(G.rbox(0.1, 0.24, 0.24, 0.05), look.pattern, { x: -0.3, y: hipY + 0.05 });
      s.add(G.rbox(0.02, 0.5, 0.02, 0.01), shade(look.pattern, 0.7), { x: -0.26, y: torsoY + 0.1, rz: -0.5 });
      break;
    case 'tote':
      s.add(G.rbox(0.28, 0.3, 0.12, 0.05), C.cream, { x: 0.36, y: shoulderY - armLen - 0.12 });
      s.add(G.sphere(0.09, 5, 4), C.leaf, { x: 0.36, y: shoulderY - armLen + 0.04 });
      break;
    case 'tray': {
      // Hawker's tray: a round enamel tray piled with goods.
      const top = headY + headR * 1.75;
      s.add(G.cyl(0.38, 0.32, 0.07, 12), C.white, { y: top });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        s.add(G.sphere(0.09, 5, 4), pick([0xef7a2b, 0xffd447, 0xef4b43, 0x6fb34f], mulberry32(i + 3)), { x: Math.cos(a) * 0.2, y: top + 0.08, z: Math.sin(a) * 0.2 });
      }
      s.add(G.sphere(0.11, 6, 4), 0xffd447, { y: top + 0.14 });
      break;
    }
    case 'umbrella':
      s.add(G.cyl(0.012, 0.012, 0.9, 6), C.black, { x: 0.32, y: shoulderY + 0.2 });
      s.add(G.cone(0.55, 0.22, 12), look.pattern, { x: 0.32, y: shoulderY + 0.7 });
      break;
    case 'none':
      break;
  }
  return s;
}

/** Rider seated on a motorcycle, leaning forward, with a helmet; placed relative to the bike's seat. */
export function makeRider(jacket: number, trousers: number, helmet: number, skin: number): Shape {
  const s = new Shape();
  s.pair(G.capsule(0.09, 0.36, 3, 8), trousers, { x: 0.17, y: 1.08, z: -0.16, rx: Math.PI / 2 - 0.3 });
  s.pair(G.capsule(0.08, 0.36, 3, 8), trousers, { x: 0.2, y: 0.8, z: -0.36, rx: 0.15 });
  s.pair(G.rbox(0.13, 0.1, 0.26, 0.04), C.white, { x: 0.2, y: 0.58, z: -0.42 });
  s.add(G.rbox(0.36, 0.2, 0.26, 0.08), trousers, { y: 1.14, z: 0.05 });
  s.add(G.rbox(0.46, 0.56, 0.3, 0.13), jacket, { y: 1.48, z: -0.06, rx: -0.38 });
  s.pair(G.capsule(0.07, 0.42, 3, 8), jacket, { x: 0.25, y: 1.42, z: -0.38, rx: -1.1 });
  s.pair(G.sphere(0.07, 8, 6), 0x2a2d34, { x: 0.3, y: 1.26, z: -0.68 });
  s.add(G.cyl(0.06, 0.07, 0.08, 8), skin, { y: 1.8, z: -0.2 });
  s.add(G.sphere(0.21, 16, 12), helmet, { y: 1.95, z: -0.24 });
  s.add(G.rbox(0.3, 0.13, 0.12, 0.05), C.glass, { y: 1.93, z: -0.42 });
  return s;
}

/** A fixed set of looks per city for crowds; seeded so they never change between visits. */
export function crowdLooks(city: CityId, count: number): Look[] {
  const rng = mulberry32(1066);
  return Array.from({ length: count }, () => randomLook(city, rng));
}
