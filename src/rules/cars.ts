// Vehicles on the road. Every name is invented; none copies a real make or model.
import type { StretchKind } from './data.ts';
import { pick, weighted, type Rng } from './util.ts';

/** A body shape. "lorry" is drawn in code; the rest are low-poly 3D models. */
export type ModelId =
  | 'saloon'
  | 'hatch'
  | 'ehatch'
  | 'coupe'
  | 'jeep'
  | 'luxsuv'
  | 'pickup'
  | 'taxi'
  | 'van'
  | 'formula'
  | 'hyper'
  | 'boxtruck'
  | 'refuse'
  | 'lorry';

export interface ModelSize {
  readonly w: number;
  readonly l: number;
  readonly h: number;
}

/** Size on the road in metres; the 3D models are stretched to fit. */
export const MODEL_SIZE: Readonly<Record<ModelId, ModelSize>> = {
  saloon: { w: 1.85, l: 4.4, h: 1.5 },
  hatch: { w: 1.8, l: 4.0, h: 1.5 },
  ehatch: { w: 1.8, l: 4.0, h: 1.5 },
  coupe: { w: 1.9, l: 4.5, h: 1.35 },
  jeep: { w: 1.95, l: 4.6, h: 1.85 },
  luxsuv: { w: 2.0, l: 4.9, h: 1.85 },
  pickup: { w: 1.9, l: 5.0, h: 1.75 },
  taxi: { w: 1.85, l: 4.4, h: 1.65 },
  van: { w: 1.95, l: 4.9, h: 2.0 },
  formula: { w: 1.9, l: 4.8, h: 1.05 },
  hyper: { w: 2.0, l: 4.6, h: 1.15 },
  boxtruck: { w: 2.3, l: 6.2, h: 2.9 },
  refuse: { w: 2.4, l: 6.8, h: 3.0 },
  lorry: { w: 2.5, l: 7.6, h: 3.4 },
};

/** Paint colours. `null` keeps the model's own colour. */
export type Paint = number | null;

const C = {
  silver: 0xb8bcc2,
  white: 0xeeeeea,
  black: 0x1c1e22,
  champagne: 0xc8b48a,
  navy: 0x24345a,
  wine: 0x7a1f2b,
  red: 0xc0392b,
  green: 0x2f6b4f,
  orange: 0xe67e22,
  blue: 0x1f5fbf,
  yellow: 0xf1c40f,
  pearl: 0xe8e2d0,
  gold: 0xb8963e,
  teal: 0x16a085,
} as const;

interface MixEntry {
  readonly model: ModelId;
  readonly weight: number;
  /** How much more common the model gets on posh roads (route posh = 1). */
  readonly posh: number;
  readonly colors: readonly Paint[];
}

const CAR_MIX: readonly MixEntry[] = [
  { model: 'saloon', weight: 30, posh: 0, colors: [C.silver, C.white, C.black, C.champagne, C.navy, C.wine, C.green] },
  { model: 'taxi', weight: 10, posh: -0.5, colors: [null] },
  { model: 'van', weight: 8, posh: 0, colors: [C.white, C.silver, C.blue] },
  { model: 'hatch', weight: 9, posh: 0, colors: [null, C.red, C.white, C.orange, C.silver] },
  { model: 'ehatch', weight: 3, posh: 1, colors: [C.white, C.teal, C.silver] },
  { model: 'pickup', weight: 8, posh: 0, colors: [C.white, C.silver, C.red, C.green] },
  { model: 'jeep', weight: 10, posh: 0.5, colors: [C.black, C.white, C.silver, C.green, C.navy] },
  { model: 'luxsuv', weight: 4, posh: 2.5, colors: [C.black, C.white, C.pearl, C.gold] },
  { model: 'coupe', weight: 2.5, posh: 2.5, colors: [C.red, C.black, C.white, C.blue, C.yellow] },
  { model: 'formula', weight: 0.4, posh: 4, colors: [null, C.yellow, C.black] },
  { model: 'hyper', weight: 0.3, posh: 4, colors: [null, C.white, C.teal] },
];

const TRUCK_MIX: readonly MixEntry[] = [
  { model: 'lorry', weight: 5, posh: 0, colors: [null] },
  { model: 'boxtruck', weight: 3, posh: 0, colors: [null, C.white, C.blue, C.red] },
  { model: 'refuse', weight: 2, posh: -0.5, colors: [null] },
];

const LUXURY: readonly ModelId[] = ['luxsuv', 'coupe'];
const EXOTIC: readonly ModelId[] = ['formula', 'hyper'];

function mixWeight(e: MixEntry, stretch: StretchKind, posh: number): number {
  let w = e.weight * Math.max(0, 1 + e.posh * posh);
  if (stretch === 'market' && (LUXURY.includes(e.model) || EXOTIC.includes(e.model))) w *= 0.25;
  // Exotics only open up on fast roads.
  if (EXOTIC.includes(e.model) && stretch !== 'expressway' && stretch !== 'bridge') w = 0;
  if (e.model === 'refuse' && (stretch === 'expressway' || stretch === 'bridge')) w = 0;
  return w;
}

export interface Look {
  readonly model: ModelId;
  readonly color: Paint;
}

function pickLook(mix: readonly MixEntry[], stretch: StretchKind, posh: number, rng: Rng): Look {
  const e = weighted(mix.map((m) => [m, mixWeight(m, stretch, posh)] as const), rng);
  return { model: e.model, color: pick(e.colors, rng) };
}

/** A car for traffic: everyday models everywhere, luxury cars and exotics more often on posh roads. */
export const trafficCar = (stretch: StretchKind, posh: number, rng: Rng = Math.random): Look => pickLook(CAR_MIX, stretch, posh, rng);
/** A lorry, box truck or refuse truck. */
export const trafficTruck = (stretch: StretchKind, rng: Rng = Math.random): Look => pickLook(TRUCK_MIX, stretch, 0, rng);

// ---------- Cars you can own (for races) ----------
export type CarClass = 'everyday' | 'suv' | 'luxury' | 'electric' | 'exotic';
export const CLASS_LABEL: Readonly<Record<CarClass, string>> = { everyday: 'Everyday', suv: 'SUV', luxury: 'Luxury', electric: 'Electric', exotic: 'Exotic' };

export interface CarDef {
  readonly id: string;
  readonly name: string;
  readonly cls: CarClass;
  readonly model: ModelId | 'danfo';
  readonly paint: Paint;
  /** CSS colour for the garage swatch and race HUD. */
  readonly swatch: string;
  readonly price: number;
  readonly level: number;
  /** Top speed in m/s. */
  readonly top: number;
  /** Pull-away in m/s². */
  readonly accel: number;
  /** How quickly it changes lanes; the danfo is 1. */
  readonly handling: number;
  /** Knocks it can take in a race before it is out. */
  readonly hits: number;
  readonly electric: boolean;
}

export const CARS: readonly CarDef[] = [
  { id: 'danfo', name: 'Your danfo', cls: 'everyday', model: 'danfo', paint: null, swatch: '#f6b800', price: 0, level: 1, top: 36, accel: 5, handling: 1, hits: 3, electric: false },
  { id: 'tokunbo', name: 'Tokunbo Saloon', cls: 'everyday', model: 'saloon', paint: C.silver, swatch: '#b8bcc2', price: 12000, level: 1, top: 40, accel: 6, handling: 1.1, hits: 3, electric: false },
  { id: 'hothatch', name: 'Yaba Hot Hatch', cls: 'everyday', model: 'hatch', paint: C.orange, swatch: '#e67e22', price: 18000, level: 2, top: 42, accel: 7, handling: 1.3, hits: 3, electric: false },
  { id: 'farmboss', name: 'Farm Boss Pickup', cls: 'suv', model: 'pickup', paint: C.white, swatch: '#eeeeea', price: 22000, level: 2, top: 39, accel: 5.5, handling: 0.95, hits: 5, electric: false },
  { id: 'bigboy', name: 'Big Boy Jeep', cls: 'suv', model: 'jeep', paint: C.black, swatch: '#1c1e22', price: 35000, level: 3, top: 43, accel: 6, handling: 1, hits: 5, electric: false },
  { id: 'sunpower', name: 'Sun-Power E-Hatch', cls: 'electric', model: 'ehatch', paint: C.teal, swatch: '#16a085', price: 40000, level: 3, top: 44, accel: 9, handling: 1.2, hits: 3, electric: true },
  { id: 'banana', name: 'Banana Island SUV', cls: 'luxury', model: 'luxsuv', paint: C.pearl, swatch: '#e8e2d0', price: 70000, level: 4, top: 48, accel: 7, handling: 1.05, hits: 6, electric: false },
  { id: 'ikoyi', name: 'Ikoyi Coupé', cls: 'luxury', model: 'coupe', paint: C.red, swatch: '#c0392b', price: 90000, level: 5, top: 52, accel: 8, handling: 1.25, hits: 3, electric: false },
  { id: 'lightning', name: 'Lekki Lightning', cls: 'exotic', model: 'formula', paint: null, swatch: '#e0533d', price: 160000, level: 7, top: 60, accel: 10, handling: 1.45, hits: 3, electric: false },
  { id: 'atlantic', name: 'Atlantic Hyper-E', cls: 'exotic', model: 'hyper', paint: null, swatch: '#4a5fd0', price: 220000, level: 8, top: 62, accel: 13, handling: 1.5, hits: 3, electric: true },
];

export function carById(id: string): CarDef {
  const car = CARS.find((c) => c.id === id);
  if (!car) throw new Error(`Unknown car ${id}`);
  return car;
}

/** Garage line such as "Luxury · 187 km/h · 3 hits"; the danfo's hits come from its upgrades. */
export function carSummary(car: CarDef, hits = car.hits): string {
  const cls = car.electric && car.cls !== 'electric' ? `${CLASS_LABEL[car.cls]} electric` : CLASS_LABEL[car.cls];
  return `${cls} · ${Math.round(car.top * 3.6)} km/h · ${hits} hit${hits === 1 ? '' : 's'}`;
}

/** Garage stat bars, each 0–1 against the best car in the game. */
export function carStats(car: CarDef, hits = car.hits): [string, number][] {
  return [
    ['Speed', car.top / 62],
    ['Pick-up', car.accel / 13],
    ['Handling', car.handling / 1.5],
    ['Toughness', Math.min(1, hits / 6)],
  ];
}
