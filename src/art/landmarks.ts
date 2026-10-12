// Set piece: Tower Bridge (the road passes through its towers), plus a far-away skyline that stays on the horizon.
import * as THREE from 'three';
import type { CityId } from '../config/cities.ts';
import { mulberry32, pick } from '../rules/util.ts';
import { C } from './materials.ts';
import { G, Shape, mix, shade } from './kit.ts';

const STONE = 0xd9c3a0;
const STONE_DARK = 0xc2a984;
const ROOF = 0x2a3f6e;
const GOLD = 0xe8b847;
const BLUE = C.bridgeBlue;

/** Half-width of the bridge deck between the railings. */
export const BRIDGE_DECK = 7.6;
/** Towers stand this far either side of the bridge centre. */
export const TOWER_Z = 44;

function turret(s: Shape, x: number, z: number, base: number, h: number): void {
  s.add(G.cyl(1.5, 1.6, h, 8), STONE, { x, y: base + h / 2, z });
  for (let i = 0; i < 3; i++) s.add(G.box(0.5, 1.6, 0.1), C.glass, { x: x + (x > 0 ? -0.1 : 0.1), y: base + 3 + i * 3.4, z: z + (z > 0 ? 1.5 : -1.5) });
  s.add(G.cyl(1.75, 1.75, 0.5, 8), STONE_DARK, { x, y: base + h, z });
  s.add(G.cone(1.7, 5.2, 8), ROOF, { x, y: base + h + 2.8, z });
  s.add(G.cyl(0.08, 0.08, 1.4, 6), GOLD, { x, y: base + h + 5.8, z });
  s.add(G.sphere(0.32, 8, 6), GOLD, { x, y: base + h + 6.3, z });
}

/** One tower of Tower Bridge, centred on the road at z = 0, with an arch the road passes through. */
function bridgeTower(): Shape {
  const s = new Shape();
  const legX = 10.6;
  // Stone piers standing in the river.
  s.add(G.rbox(34, 10, 14, 1.2), STONE_DARK, { y: -5.6 });
  // Two legs either side of the road.
  for (const x of [-legX, legX]) {
    s.add(G.rbox(6, 30, 10, 0.3), STONE, { x, y: 15 });
    for (let y = 4; y < 28; y += 4.2) s.add(G.rbox(6.2, 0.3, 10.2, 0.08), STONE_DARK, { x, y });
    for (const z of [-5.06, 5.06]) for (let y = 6; y < 28; y += 8.4) {
      s.add(G.box(1.1, 2.6, 0.08), C.glass, { x, y, z });
      s.add(G.cyl(0.55, 0.55, 0.08, 10), C.glass, { x, y: y + 1.3, z, rx: Math.PI / 2 });
    }
  }
  // The block above the road and its arch.
  s.add(G.rbox(27.2, 15, 10, 0.3), STONE, { y: 22.5 });
  for (const z of [-5.0, 5.0]) {
    s.add(G.torus(7.4, 0.55, 6, 18, Math.PI), STONE_DARK, { y: 8.4, z });
    for (let i = -2; i <= 2; i++) {
      s.add(G.box(1.2, 3.2, 0.1), C.glass, { x: i * 3.4, y: 22, z });
      s.add(G.cyl(0.6, 0.6, 0.1, 10), C.glass, { x: i * 3.4, y: 23.6, z, rx: Math.PI / 2 });
    }
  }
  // Upper storey, turrets and the central pointed roof.
  s.add(G.rbox(24, 10, 9, 0.3), STONE, { y: 35 });
  for (const z of [-4.56, 4.56]) for (let i = -2; i <= 2; i++) s.add(G.box(1.0, 2.8, 0.1), C.glass, { x: i * 3.6, y: 35, z });
  for (const x of [-11.6, 11.6]) for (const z of [-3.6, 3.6]) turret(s, x, z, 15, 26);
  s.add(G.cone(9.5, 10, 4), ROOF, { y: 45, ry: Math.PI / 4, sx: 1.25, sz: 0.65 });
  s.add(G.cyl(0.12, 0.12, 2.4, 6), GOLD, { y: 51 });
  s.add(G.sphere(0.5, 8, 6), GOLD, { y: 52.4 });
  return s;
}

/** Blue high-level walkway beam with cream lattice crosses. */
function walkway(len: number): Shape {
  const s = new Shape();
  s.add(G.rbox(2.6, 3.4, len, 0.15), BLUE, {});
  s.add(G.rbox(2.8, 0.3, len, 0.08), shade(BLUE, 0.8), { y: 1.8 });
  s.add(G.rbox(2.8, 0.3, len, 0.08), shade(BLUE, 0.8), { y: -1.8 });
  for (let z = -len / 2 + 2; z < len / 2 - 1; z += 3.2) {
    for (const x of [-1.33, 1.33]) {
      s.add(G.box(0.08, 3.6, 0.22), C.cream, { x, z, rx: 0.75 });
      s.add(G.box(0.08, 3.6, 0.22), C.cream, { x, z, rx: -0.75 });
    }
  }
  s.add(G.rbox(1.2, 1.2, 0.2, 0.1), GOLD, { x: 1.4, z: 0, rz: Math.PI / 4 });
  s.add(G.rbox(1.2, 1.2, 0.2, 0.1), GOLD, { x: -1.4, z: 0, rz: Math.PI / 4 });
  return s;
}

/** Suspension chain hanging from a tower top to the shore. */
function chain(s: Shape, x: number, fromZ: number, toZ: number): void {
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, 30, fromZ), new THREE.Vector3(x, 6, (fromZ + toZ) / 2 + (toZ - fromZ) * 0.05), new THREE.Vector3(x, 5, toZ));
  s.add(new THREE.TubeGeometry(curve, 20, 0.55, 6, false), BLUE);
  for (let t = 0.08; t < 0.95; t += 0.07) {
    const p = curve.getPoint(t);
    if (p.y < 1.8) continue;
    s.add(G.cyl(0.08, 0.08, p.y - 1, 5), BLUE, { x, y: (p.y + 1) / 2, z: p.z });
  }
}

/** Tower Bridge, centred on z = 0, the road running along Z. */
export function towerBridge(): Shape {
  const s = new Shape();
  s.merge(bridgeTower(), { z: -TOWER_Z });
  s.merge(bridgeTower(), { z: TOWER_Z });
  for (const x of [-6.3, 6.3]) s.merge(walkway(TOWER_Z * 2 - 9), { x, y: 39 });
  for (const side of [-1, 1] as const) {
    const x = side * 9.2;
    chain(s, x, -TOWER_Z - 4, -TOWER_Z - 92);
    chain(s, x, TOWER_Z + 4, TOWER_Z + 92);
    // Small stone towers where the chains meet the shore.
    for (const z of [-TOWER_Z - 94, TOWER_Z + 94]) {
      s.add(G.rbox(2.2, 5, 2.2, 0.2), STONE, { x: side * 9.6, y: 2.5, z });
      s.add(G.cone(1.6, 2.4, 4), ROOF, { x: side * 9.6, y: 6.2, z, ry: Math.PI / 4 });
    }
  }
  return s;
}

/** Distant skyline band for a city, built once; it stays on the horizon as the player drives. */
export function skyline(_city: CityId, haze: number): THREE.BufferGeometry {
  const s = new Shape();
  const rng = mulberry32(31);
  const tint = (c: number): number => mix(c, haze, 0.55);
  const glass = [0x5d86b8, 0x7fa2c8, 0x9ab3cc, 0x6c8fb0];
  for (let i = 0; i < 46; i++) {
    const x = (rng() - 0.5) * 1500;
    if (Math.abs(x) < 40) continue;
    const z = -560 - rng() * 260;
    const w = 18 + rng() * 34;
    const h = 30 + rng() * (Math.abs(x) < 400 ? 150 : 70);
    const color = tint(pick(glass, rng));
    if (rng() < 0.2) s.add(G.cyl(w * 0.45, w * 0.5, h, 14), color, { x, y: h / 2, z });
    else s.add(G.rbox(w, h, w * 0.8, 2), color, { x, y: h / 2, z });
    s.add(G.box(w * 0.9, 1.5, w * 0.82), tint(0xe9eef2), { x, y: h * 0.62, z });
  }
  // A glass spire, a domed cathedral and a rounded tower on the London horizon.
  s.add(G.cone(30, 250, 4), tint(0x8fb0cc), { x: 180, y: 125, z: -700, ry: 0.4 });
  s.add(G.cyl(26, 26, 40, 16), tint(0xd8d2c4), { x: -260, y: 20, z: -640 });
  s.add(G.dome(24, 16, 8), tint(0xb8b2a6), { x: -260, y: 40, z: -640 });
  s.add(G.cyl(3, 3, 14, 8), tint(0xd8d2c4), { x: -260, y: 70, z: -640 });
  s.add(G.sphere(20, 14, 12), tint(0x6f8fae), { x: 60, y: 70, z: -760, sy: 3.4 });
  return s.build();
}
