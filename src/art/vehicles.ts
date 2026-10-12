// Vehicles in the West Road Life style: chunky wheels with cream hubs, deep navy glass, rounded satin bodies.
// Each model faces -Z, sits on the ground at y = 0 and is centred along its length.
import * as THREE from 'three';
import type { ModelId, Paint } from '../config/vehicles.ts';
import { C } from './materials.ts';
import { G, Shape, extrudeProfile, shade, sideFlat } from './kit.ts';
import { makeRider } from './people.ts';

export interface WheelSpot {
  readonly x: number;
  readonly z: number;
  readonly r: number;
  readonly w: number;
}

/** A door drawn separately so it can open: buses and danfos slide, cars swing. */
export interface DoorSpec {
  readonly shape: Shape;
  readonly kind: 'slide' | 'swing';
  /** Hinge (swing) or closed position (slide), relative to the vehicle. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Which side of the vehicle it is on. */
  readonly side: -1 | 1;
}

export interface VehicleParts {
  readonly body: Shape;
  readonly wheels: readonly WheelSpot[];
  readonly door: DoorSpec | null;
  /** Rear sticker panel (danfo), drawn with its own text texture. */
  readonly sticker: { readonly y: number; readonly z: number; readonly w: number; readonly h: number } | null;
}

const LAMP = C.lamp;
const DARK = C.black;

// ---------- Wheels ----------
const wheelCache = new Map<string, THREE.BufferGeometry>();

/** Tyre with rounded shoulders and a cream hub; the axle runs along X. */
export function wheelShape(r: number, w: number): Shape {
  const s = new Shape();
  const key = `${r},${w}`;
  let tyre = wheelCache.get(key);
  if (!tyre) {
    const inner = r * 0.56;
    const c = Math.min(w * 0.38, r * 0.28);
    const pts: THREE.Vector2[] = [new THREE.Vector2(inner, -w / 2)];
    for (let i = 0; i <= 4; i++) {
      const a = -Math.PI / 2 + (i / 4) * (Math.PI / 2);
      pts.push(new THREE.Vector2(r - c + Math.cos(a) * c, -w / 2 + c + Math.sin(a) * c));
    }
    for (let i = 0; i <= 4; i++) {
      const a = (i / 4) * (Math.PI / 2);
      pts.push(new THREE.Vector2(r - c + Math.cos(a) * c, w / 2 - c + Math.sin(a) * c));
    }
    pts.push(new THREE.Vector2(inner, w / 2));
    tyre = new THREE.LatheGeometry(pts, 16);
    wheelCache.set(key, tyre);
  }
  s.add(tyre, C.tyre, { rz: Math.PI / 2 });
  s.add(G.cyl(r * 0.58, r * 0.58, w * 0.8, 14), C.hub, { rz: Math.PI / 2 });
  // A small centre cap and two studs on each face, so the wheels are seen to turn.
  for (const side of [-1, 1] as const) {
    s.add(G.cyl(r * 0.2, r * 0.24, 0.04, 8), shade(C.hub, 0.82), { x: side * w * 0.42, rz: Math.PI / 2 });
    s.add(G.box(0.02, r * 0.1, r * 0.1), shade(C.hub, 0.62), { x: side * w * 0.41, y: r * 0.36 });
    s.add(G.box(0.02, r * 0.1, r * 0.1), shade(C.hub, 0.62), { x: side * w * 0.41, y: -r * 0.36 });
  }
  return s;
}

// ---------- Shared details ----------
function headlight(s: Shape, x: number, y: number, z: number, r: number): void {
  s.add(G.cyl(r, r, 0.06, 16), LAMP, { x, y, z, rx: Math.PI / 2 });
  s.add(G.torus(r, r * 0.16, 6, 16), C.chrome, { x, y, z: z + 0.01 });
}

function mirrorPair(s: Shape, x: number, y: number, z: number, body: number): void {
  s.pair(G.rbox(0.07, 0.05, 0.05, 0.02), DARK, { x: x - 0.06, y, z });
  s.pair(G.rbox(0.09, 0.16, 0.2, 0.04), body, { x: x + 0.02, y, z });
}

/** Dark arch above each wheel, so wheels read clearly against the body. */
function arches(s: Shape, wheels: readonly WheelSpot[], x: number, depth: number): void {
  for (const w of wheels) if (w.x > 0) s.pair(G.rbox(depth, w.r * 1.1, w.r * 2.5, 0.06), shade(DARK, 1.05), { x, y: w.r * 1.05, z: w.z });
}

// ---------- Models ----------
function doubledecker(p: Paint, side: -1 | 1): VehicleParts {
  const s = new Shape();
  const red = p.body;
  const trim = shade(red, 0.82);
  s.add(G.rbox(2.4, 3.72, 10, 0.34, 3), red, { y: 0.42 + 1.86 });
  s.add(G.rbox(2.42, 0.34, 9.7, 0.12), 0x1c2230, { y: 0.52 });
  // Window bands on both decks, with red pillars between the panes.
  s.pair(G.rbox(0.06, 0.96, 8.1, 0.05), C.glass, { x: 1.2, y: 1.74, z: 0.6 });
  s.pair(G.rbox(0.06, 0.9, 9.1, 0.05), C.glass, { x: 1.2, y: 3.3, z: 0.05 });
  for (let z = -3.2; z <= 4.4; z += 1.52) s.pair(G.rbox(0.07, 0.98, 0.14, 0.03), red, { x: 1.21, y: 1.74, z });
  for (let z = -3.9; z <= 4.4; z += 1.66) s.pair(G.rbox(0.07, 0.92, 0.14, 0.03), red, { x: 1.21, y: 3.3, z });
  s.add(G.rbox(2.36, 0.08, 9.9, 0.03), trim, { y: 2.52 });
  // Front: two windscreens and a blank destination panel.
  s.add(G.rbox(2.08, 1.22, 0.06, 0.06), C.glass, { y: 1.86, z: -5.0 });
  s.add(G.rbox(2.08, 0.9, 0.06, 0.06), C.glass, { y: 3.32, z: -5.0 });
  s.add(G.rbox(1.55, 0.32, 0.06, 0.04), C.cream, { y: 2.72, z: -5.02 });
  headlight(s, 0.82, 0.96, -5.03, 0.15);
  headlight(s, -0.82, 0.96, -5.03, 0.15);
  s.pair(G.rbox(0.18, 0.08, 0.05, 0.02), 0xffa53a, { x: 0.82, y: 0.72, z: -5.02 });
  s.add(G.rbox(2.3, 0.3, 0.2, 0.08), 0x1c2230, { y: 0.56, z: -4.98 });
  // Rear: stacked navy windows, a vent, tail lamps and a yellow plate.
  s.add(G.rbox(1.92, 0.86, 0.06, 0.06), C.glass, { y: 1.88, z: 5.0 });
  s.add(G.rbox(1.92, 0.82, 0.06, 0.06), C.glass, { y: 3.32, z: 5.0 });
  s.add(G.rbox(1.3, 0.28, 0.05, 0.05), shade(red, 0.6), { y: 1.0, z: 5.02 });
  for (let i = 0; i < 4; i++) s.add(G.box(1.2, 0.03, 0.02), 0x1c2230, { y: 0.92 + i * 0.06, z: 5.05 });
  s.pair(G.rbox(0.22, 0.56, 0.06, 0.05), C.tail, { x: 1.0, y: 1.08, z: 5.02 });
  s.add(G.rbox(0.6, 0.18, 0.05, 0.03), C.plate, { y: 0.66, z: 5.04 });
  s.add(G.rbox(2.3, 0.28, 0.2, 0.08), 0x1c2230, { y: 0.56, z: 4.98 });
  mirrorPair(s, 1.34, 2.5, -4.7, DARK);
  const wheels: WheelSpot[] = [
    { x: 1.04, z: -3.25, r: 0.52, w: 0.36 },
    { x: -1.04, z: -3.25, r: 0.52, w: 0.36 },
    { x: 1.04, z: 2.75, r: 0.52, w: 0.36 },
    { x: -1.04, z: 2.75, r: 0.52, w: 0.36 },
  ];
  arches(s, wheels, 1.2, 0.08);
  // Front door on the kerb side, just ahead of the front wheels.
  const door = new Shape();
  door.add(G.rbox(0.06, 1.62, 1.02, 0.05), shade(red, 0.9));
  door.add(G.rbox(0.07, 1.1, 0.8, 0.04), C.glass, { y: 0.16 });
  return { body: s, wheels, door: { shape: door, kind: 'slide', x: side * 1.215, y: 1.35, z: -4.3, side }, sticker: null };
}

/** Side profile of an everyday car, van or minibus. Lengths run front (-) to back (+) along the vehicle. */
interface Profile {
  readonly key: string;
  readonly l: number;
  readonly w: number;
  /** Height of the underside. */
  readonly c: number;
  /** Top of the front face, where it rounds into the bonnet. */
  readonly nose: number;
  /** Waist line: bonnet and boot tops, bottom of the side windows. */
  readonly belt: number;
  /** Where the windscreen meets the bonnet. */
  readonly screen: number;
  readonly roofFront: readonly [number, number];
  readonly roofRear: readonly [number, number];
  /** Where the rear window meets the boot. */
  readonly rearBase: number;
  /** Top of the rear face. */
  readonly tail: number;
  readonly axles: readonly number[];
  readonly wheelR: number;
  readonly wheelW: number;
  /** Width of the glasshouse as a share of the body width. */
  readonly house: number;
  /** Window pillars along the side, as positions between the windscreen and rear window. */
  readonly pillars: readonly number[];
}

/** Point on the line from a to b at height y. */
function atHeight(a: readonly [number, number], b: readonly [number, number], y: number): number {
  const t = (y - a[1]) / (b[1] - a[1] || 1e-6);
  return a[0] + (b[0] - a[0]) * t;
}

function lowerShape(p: Profile): THREE.Shape {
  const hl = p.l / 2;
  const r = 0.16;
  const sh = new THREE.Shape();
  sh.moveTo(-hl + r, p.c);
  for (const z of [...p.axles].sort((a, b) => a - b)) {
    // Wheel arch: a cut-out a little larger than the wheel.
    const ra = p.wheelR + 0.07;
    const dy = p.c - p.wheelR;
    const dz = Math.sqrt(Math.max(0.0001, ra * ra - dy * dy));
    const a = Math.atan2(dy, dz);
    sh.lineTo(z - dz, p.c);
    sh.absarc(z, p.wheelR, ra, Math.PI - a, a, true);
  }
  sh.lineTo(hl - r, p.c);
  sh.quadraticCurveTo(hl, p.c, hl, p.c + r);
  sh.lineTo(hl, p.tail - r);
  sh.quadraticCurveTo(hl, p.tail, hl - r, p.tail);
  sh.lineTo(p.rearBase, p.belt);
  sh.lineTo(p.screen, p.belt);
  if (p.screen > -hl + 0.3) {
    sh.lineTo(-hl + 0.45, p.belt - 0.04);
    sh.quadraticCurveTo(-hl, p.belt - 0.06, -hl, p.nose);
  } else sh.lineTo(-hl, p.belt);
  sh.lineTo(-hl, p.c + r);
  sh.quadraticCurveTo(-hl, p.c, -hl + r, p.c);
  return sh;
}

function houseShape(p: Profile): THREE.Shape {
  const a: [number, number] = [p.screen, p.belt - 0.12];
  const b = p.roofFront;
  const c = p.roofRear;
  const d: [number, number] = [p.rearBase, p.belt - 0.12];
  const lerp2 = (u: readonly [number, number], v: readonly [number, number], t: number): [number, number] => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
  const sh = new THREE.Shape();
  sh.moveTo(...a);
  sh.lineTo(...lerp2(a, b, 0.8));
  sh.quadraticCurveTo(b[0], b[1], ...lerp2(b, c, 0.12));
  sh.lineTo(...lerp2(b, c, 0.9));
  sh.quadraticCurveTo(c[0], c[1], ...lerp2(c, d, 0.2));
  sh.lineTo(...d);
  sh.lineTo(...a);
  return sh;
}

/** Thin glass panel lying on the slope from a to b (in side view), pushed out to sit on the rounded surface. */
function slopeGlass(s: Shape, a: readonly [number, number], b: readonly [number, number], width: number, outward: 1 | -1): void {
  const dz = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dz, dy);
  // Normal pointing out of the vehicle: forwards for the windscreen, backwards for the rear window.
  let nz = -dy / len;
  let ny = dz / len;
  if (Math.sign(nz) !== -outward) {
    nz = -nz;
    ny = -ny;
  }
  const off = 0.07;
  s.add(G.rbox(width, len * 0.86, 0.03, 0.03), C.glass, {
    y: (a[1] + b[1]) / 2 + ny * off,
    z: (a[0] + b[0]) / 2 + nz * off,
    rx: Math.atan2(-ny, nz),
  });
}

/** Body, glasshouse, glass, underside and wheels from a profile. */
function profileBody(p: Profile, paint: Paint, side: -1 | 1): { s: Shape; wheels: WheelSpot[]; door: DoorSpec; hl: number } {
  const s = new Shape();
  const hl = p.l / 2;
  const houseW = p.w * p.house;
  s.add(extrudeProfile(`${p.key}-low`, lowerShape(p), p.w, 0.12), paint.body);
  s.add(extrudeProfile(`${p.key}-house`, houseShape(p), houseW, 0.11), paint.body);
  // Dark underside, so the arches look deep rather than see-through.
  s.add(G.rbox(p.w - 0.3, p.wheelR * 1.6, p.l - 0.5, 0.1), 0x1c1f25, { y: p.c + p.wheelR * 0.4 });
  // Windscreen and rear window follow the glasshouse slopes.
  const y0 = p.belt + 0.03;
  const y1 = p.roofFront[1] - 0.06;
  const a: [number, number] = [p.screen, p.belt - 0.12];
  const d: [number, number] = [p.rearBase, p.belt - 0.12];
  slopeGlass(s, [atHeight(a, p.roofFront, y0), y0], [atHeight(a, p.roofFront, y1), y1], houseW * 0.84, 1);
  const r1 = p.roofRear[1] - 0.08;
  slopeGlass(s, [atHeight(p.roofRear, d, r1), r1], [atHeight(p.roofRear, d, y0), y0], houseW * 0.8, -1);
  // Side windows, split by pillars.
  const top = Math.min(p.roofFront[1], p.roofRear[1]) - 0.1;
  const bottom = p.belt + 0.05;
  const frontAt = (y: number): number => atHeight(a, p.roofFront, y) + 0.1;
  const rearAt = (y: number): number => atHeight(p.roofRear, d, y) - 0.1;
  const edges = [frontAt, ...p.pillars.flatMap((z) => [() => z - 0.06, () => z + 0.06]), rearAt];
  const x = houseW / 2 + 0.012;
  for (let i = 0; i + 1 < edges.length; i += 2) {
    const f = edges[i];
    const r = edges[i + 1];
    if (!f || !r) continue;
    const pts: [number, number][] = [
      [f(bottom), bottom],
      [r(bottom), bottom],
      [r(top), top],
      [f(top), top],
    ];
    const key = `${p.key}-win${i}`;
    s.add(sideFlat(key, pts), C.glass, { x: -x });
    s.add(sideFlat(key, pts), C.glass, { x, sx: -1 });
  }
  const wheels: WheelSpot[] = [];
  for (const z of p.axles) for (const sx of [1, -1]) wheels.push({ x: sx * (p.w / 2 - p.wheelW * 0.55), z, r: p.wheelR, w: p.wheelW });
  // Rear passenger door on the kerb side; it swings out from its front edge.
  const doorZ = p.pillars[0] ?? (p.screen + p.rearBase) / 2;
  const doorL = Math.min(1.0, (p.rearBase - doorZ) * 0.9);
  // The door is the lower panel only; the window above it belongs to the glasshouse.
  const door = new Shape();
  door.add(G.rbox(0.05, p.belt - p.c - 0.16, doorL, 0.04), shade(paint.body, 0.95), { y: (p.belt + p.c) / 2 + 0.02, z: doorL / 2 + 0.05 });
  door.add(G.rbox(0.06, 0.04, 0.22, 0.02), C.chrome, { y: p.belt - 0.14, z: doorL * 0.75 });
  return { s, wheels, door: { shape: door, kind: 'swing', x: side * (p.w / 2 + 0.01), y: 0, z: doorZ + 0.06, side }, hl };
}

/** Bumpers, grille, lamps and plate on an everyday car. */
function carFace(s: Shape, p: Profile, paint: Paint, lamp: 'round' | 'wide'): void {
  const hl = p.l / 2;
  const bumperY = p.c + 0.12;
  s.add(G.rbox(p.w * 0.94, 0.2, 0.22, 0.09), DARK, { y: bumperY, z: -hl - 0.02 });
  s.add(G.rbox(p.w * 0.94, 0.2, 0.22, 0.09), DARK, { y: bumperY, z: hl + 0.02 });
  const faceY = (p.nose + p.c) / 2 + 0.1;
  s.add(G.rbox(p.w * 0.36, 0.13, 0.05, 0.04), 0x2a2e36, { y: faceY - 0.04, z: -hl - 0.06 });
  if (lamp === 'round') {
    headlight(s, p.w * 0.32, faceY + 0.04, -hl - 0.06, 0.15);
    headlight(s, -p.w * 0.32, faceY + 0.04, -hl - 0.06, 0.15);
  } else s.pair(G.rbox(p.w * 0.22, 0.13, 0.05, 0.05), LAMP, { x: p.w * 0.32, y: faceY + 0.04, z: -hl - 0.06 });
  s.pair(G.rbox(p.w * 0.2, 0.14, 0.05, 0.05), C.tail, { x: p.w * 0.33, y: p.tail - 0.14, z: hl + 0.06 });
  s.add(G.rbox(0.44, 0.13, 0.04, 0.02), C.white, { y: bumperY + 0.2, z: hl + 0.07 });
  mirrorPair(s, p.w / 2 + 0.06, p.belt + 0.06, p.screen + 0.12, paint.body);
}

const HATCH: Profile = { key: 'hatch', l: 3.8, w: 1.7, c: 0.3, nose: 0.8, belt: 0.98, screen: -0.9, roofFront: [-0.3, 1.46], roofRear: [1.15, 1.48], rearBase: 1.78, tail: 1.0, axles: [-1.2, 1.25], wheelR: 0.36, wheelW: 0.26, house: 0.86, pillars: [0.55] };
const SEDAN: Profile = { key: 'sedan', l: 4.4, w: 1.8, c: 0.3, nose: 0.72, belt: 0.9, screen: -0.88, roofFront: [-0.18, 1.46], roofRear: [0.86, 1.46], rearBase: 1.48, tail: 0.92, axles: [-1.42, 1.42], wheelR: 0.37, wheelW: 0.26, house: 0.86, pillars: [0.35] };
const CAB: Profile = { key: 'cab', l: 4.5, w: 1.9, c: 0.32, nose: 0.92, belt: 1.08, screen: -1.02, roofFront: [-0.72, 1.8], roofRear: [1.82, 1.8], rearBase: 2.04, tail: 1.12, axles: [-1.42, 1.45], wheelR: 0.4, wheelW: 0.28, house: 0.9, pillars: [0.12, 1.15] };
const SUV: Profile = { key: 'suv', l: 4.7, w: 2, c: 0.42, nose: 1.02, belt: 1.2, screen: -1.2, roofFront: [-0.55, 1.9], roofRear: [2.08, 1.9], rearBase: 2.28, tail: 1.24, axles: [-1.55, 1.55], wheelR: 0.44, wheelW: 0.3, house: 0.9, pillars: [0.3, 1.38] };
const VAN: Profile = { key: 'van', l: 5.2, w: 2, c: 0.38, nose: 1.0, belt: 1.24, screen: -1.95, roofFront: [-1.32, 2.4], roofRear: [2.55, 2.4], rearBase: 2.6, tail: 1.24, axles: [-1.7, 1.75], wheelR: 0.4, wheelW: 0.28, house: 0.98, pillars: [-0.95] };

function blackcab(p: Paint, side: -1 | 1): VehicleParts {
  const { s, wheels, door } = profileBody(CAB, p, side);
  carFace(s, CAB, p, 'round');
  // The cab's chrome grille and amber roof sign.
  s.add(G.rbox(0.62, 0.4, 0.06, 0.06), C.chrome, { y: 0.78, z: -2.29 });
  for (let i = 0; i < 4; i++) s.add(G.box(0.52, 0.03, 0.02), 0x30343c, { y: 0.64 + i * 0.09, z: -2.33 });
  s.add(G.rbox(0.56, 0.17, 0.26, 0.06), p.accent, { y: 1.9, z: 0.1 });
  s.add(G.rbox(0.4, 0.06, 0.27, 0.03), shade(p.accent, 1.3), { y: 1.91, z: 0.1 });
  return { body: s, wheels, door, sticker: null };
}

function hatchback(p: Paint, side: -1 | 1): VehicleParts {
  const { s, wheels, door } = profileBody(HATCH, p, side);
  carFace(s, HATCH, p, 'round');
  return { body: s, wheels, door, sticker: null };
}

function sedan(p: Paint, side: -1 | 1): VehicleParts {
  const { s, wheels, door } = profileBody(SEDAN, p, side);
  carFace(s, SEDAN, p, 'wide');
  return { body: s, wheels, door, sticker: null };
}

function suv(p: Paint, side: -1 | 1): VehicleParts {
  const { s, wheels, door } = profileBody(SUV, p, side);
  carFace(s, SUV, p, 'wide');
  s.pair(G.rbox(0.06, 0.2, 2.2, 0.05), p.accent, { x: 1.0, y: 0.6 });
  s.pair(G.rbox(0.06, 0.06, 2.4, 0.03), DARK, { x: 0.72, y: 2.0, z: 0.75 });
  s.add(G.rbox(1.0, 0.3, 0.06, 0.06), C.chrome, { y: 0.92, z: -2.42 });
  for (let i = 0; i < 3; i++) s.add(G.box(0.9, 0.04, 0.02), 0x30343c, { y: 0.84 + i * 0.09, z: -2.46 });
  // Spare wheel on the tailgate, under a painted cover.
  s.add(G.cyl(0.38, 0.38, 0.18, 20), DARK, { y: 0.98, z: 2.46, rx: Math.PI / 2 });
  s.add(G.cyl(0.31, 0.34, 0.08, 20), p.body, { y: 0.98, z: 2.57, rx: Math.PI / 2 });
  return { body: s, wheels, door, sticker: null };
}

function bike(p: Paint, jacket: number, trousers: number, helmet: number, skin: number): VehicleParts {
  const s = new Shape();
  s.add(G.rbox(0.42, 0.3, 0.64, 0.14), p.body, { y: 0.98, z: -0.12 });
  s.add(G.rbox(0.34, 0.12, 0.62, 0.06), DARK, { y: 1.05, z: 0.4 });
  s.add(G.rbox(0.3, 0.16, 0.42, 0.08), p.body, { y: 1.02, z: 0.8 });
  s.add(G.rbox(0.34, 0.34, 0.48, 0.08), 0x5b616b, { y: 0.62 });
  s.add(G.cyl(0.06, 0.06, 0.72, 10), C.chrome, { x: 0.2, y: 0.5, z: 0.45, rx: Math.PI / 2 });
  s.pair(G.cyl(0.03, 0.03, 0.72, 8), DARK, { x: 0.09, y: 0.82, z: -0.6, rx: 0.32 });
  s.add(G.rbox(0.16, 0.06, 0.5, 0.03), p.body, { y: 0.74, z: -0.72 });
  s.add(G.rbox(0.26, 0.22, 0.18, 0.08), p.body, { y: 1.1, z: -0.6 });
  headlight(s, 0, 1.1, -0.7, 0.085);
  s.add(G.cyl(0.025, 0.025, 0.72, 8), DARK, { y: 1.24, z: -0.44, rz: Math.PI / 2 });
  s.add(G.rbox(0.14, 0.08, 0.05, 0.02), C.tail, { y: 1.03, z: 1.02 });
  s.merge(makeRider(jacket, trousers, helmet, skin), { y: 0, z: 0.3 });
  const wheels: WheelSpot[] = [
    { x: 0, z: -0.74, r: 0.34, w: 0.15 },
    { x: 0, z: 0.74, r: 0.34, w: 0.15 },
  ];
  return { body: s, wheels, door: null, sticker: null };
}

function van(p: Paint): VehicleParts {
  const { s, wheels } = profileBody(VAN, p, 1);
  carFace(s, VAN, p, 'wide');
  s.add(G.rbox(2.02, 0.12, 3.9, 0.04), p.accent, { y: 1.0, z: 0.6 });
  s.add(G.box(0.03, 1.6, 0.02), shade(p.body, 0.8), { y: 1.5, z: 2.63 });
  return { body: s, wheels, door: null, sticker: null };
}

const RIDER_LOOKS: readonly { jacket: number; trousers: number; helmet: number }[] = [
  { jacket: 0x2d5bd0, trousers: 0x1d2a44, helmet: 0x7647d8 },
  { jacket: 0xef7a2b, trousers: 0x2a2f3a, helmet: 0x23262d },
  { jacket: 0x2a8a5a, trousers: 0x1d2a44, helmet: 0xffd447 },
];

/** Build any vehicle. `side` is the kerb side, which decides the passenger door; `look` varies riders. */
export function vehicleParts(id: ModelId, paint: Paint, side: -1 | 1, look = 0): VehicleParts {
  const rider = RIDER_LOOKS[look % RIDER_LOOKS.length] ?? RIDER_LOOKS[0];
  const skin = C.skin[(look * 3 + 1) % C.skin.length] ?? C.skin[2];
  switch (id) {
    case 'doubledecker':
      return doubledecker(paint, side);
    case 'blackcab':
      return blackcab(paint, side);
    case 'hatchback':
      return hatchback(paint, side);
    case 'sedan':
      return sedan(paint, side);
    case 'suv':
      return suv(paint, side);
    case 'motorbike':
      return bike(paint, paint.accent, rider?.trousers ?? 0x1d2a44, paint.body, skin);
    case 'van':
      return van(paint);
  }
}

/** One merged geometry with the wheels and door in place: for traffic and garage thumbnails. */
export function vehicleGeometry(parts: VehicleParts): THREE.BufferGeometry {
  const s = new Shape().merge(parts.body);
  for (const w of parts.wheels) s.merge(wheelShape(w.r, w.w), { x: w.x, y: w.r, z: w.z });
  if (parts.door) s.merge(parts.door.shape, { x: parts.door.x, y: parts.door.y, z: parts.door.z });
  return s.build();
}
