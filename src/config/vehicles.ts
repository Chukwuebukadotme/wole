import type { CityId } from './cities.ts';

/** Vehicles the player can drive. Sizes follow the West Road Life modelling sheet (metres). */
export type VehicleId = 'doubledecker' | 'blackcab' | 'hatchback' | 'sedan' | 'suv' | 'motorbike';
/** Vehicles that only appear in traffic. */
export type TrafficOnlyId = 'van';
export type ModelId = VehicleId | TrafficOnlyId;

/** Body styles share camera framing, engine sound and door behaviour. */
export type BodyStyle = 'bus' | 'car' | 'bike';

export interface VehicleDef {
  readonly id: VehicleId;
  readonly name: string;
  readonly style: BodyStyle;
  /** Width, length and height in metres. */
  readonly w: number;
  readonly l: number;
  readonly h: number;
  readonly seats: number;
  /** Fare multiplier per rider: private hire and cabs charge more than buses. */
  readonly fareMult: number;
  /** Speeds in m/s; accelerations in m/s². */
  readonly cruise: number;
  readonly top: number;
  readonly accel: number;
  readonly brake: number;
  /** Sideways speed when changing lane, m/s. */
  readonly steer: number;
  /** Hits it can take before the drive ends. */
  readonly health: number;
  /** One line for the garage. */
  readonly line: string;
}

export const VEHICLES: Readonly<Record<VehicleId, VehicleDef>> = {
  doubledecker: { id: 'doubledecker', name: 'Red double-decker', style: 'bus', w: 2.4, l: 10, h: 4.1, seats: 16, fareMult: 1, cruise: 12.5, top: 19.5, accel: 2.6, brake: 8, steer: 3.4, health: 4, line: 'Room for a crowd. Slow to turn.' },
  blackcab: { id: 'blackcab', name: 'Black cab', style: 'car', w: 1.9, l: 4.5, h: 1.8, seats: 4, fareMult: 3, cruise: 14, top: 30, accel: 5, brake: 11, steer: 5.2, health: 3, line: 'Few riders, big fares.' },
  hatchback: { id: 'hatchback', name: 'Teal hatchback', style: 'car', w: 1.7, l: 3.8, h: 1.5, seats: 3, fareMult: 2.5, cruise: 14.5, top: 33, accel: 6.2, brake: 12, steer: 6.2, health: 3, line: 'Small, quick and nimble.' },
  sedan: { id: 'sedan', name: 'Coral sedan', style: 'car', w: 1.8, l: 4.4, h: 1.5, seats: 3, fareMult: 2.5, cruise: 14.5, top: 35, accel: 5.6, brake: 12, steer: 5.6, health: 3, line: 'An everyday car for private hire.' },
  suv: { id: 'suv', name: 'Navy SUV', style: 'car', w: 2, l: 4.7, h: 1.9, seats: 5, fareMult: 2, cruise: 14, top: 32, accel: 5, brake: 11, steer: 4.8, health: 4, line: 'Tough, roomy and steady.' },
  motorbike: { id: 'motorbike', name: 'Violet motorcycle', style: 'bike', w: 0.8, l: 2.1, h: 2, seats: 1, fareMult: 3.5, cruise: 15, top: 38, accel: 8, brake: 13, steer: 7.5, health: 2, line: 'The fastest way through traffic.' },
};

/** Player fleets, in garage order. */
export const FLEETS: Readonly<Record<CityId, readonly VehicleId[]>> = {
  london: ['doubledecker', 'blackcab', 'hatchback', 'sedan', 'suv', 'motorbike'],
};

export const vehicleById = (id: VehicleId): VehicleDef => VEHICLES[id];

/** Size of every model, for traffic collisions. */
export const MODEL_SIZE: Readonly<Record<ModelId, { w: number; l: number; h: number }>> = {
  ...Object.fromEntries(Object.values(VEHICLES).map((v) => [v.id, { w: v.w, l: v.l, h: v.h }])),
  van: { w: 2, l: 5.2, h: 2.4 },
} as Record<ModelId, { w: number; l: number; h: number }>;

/** Paint for one model: body plus a second accent colour. */
export interface Paint {
  readonly body: number;
  readonly accent: number;
}

/** The paint a model wears when the player drives it. */
export const PLAYER_PAINT: Readonly<Record<VehicleId, Paint>> = {
  doubledecker: { body: 0xef4b43, accent: 0x142b4e },
  blackcab: { body: 0x1a1d24, accent: 0xffb23e },
  hatchback: { body: 0x12bcc1, accent: 0x142b4e },
  sedan: { body: 0xef5b4c, accent: 0x142b4e },
  suv: { body: 0x1f2f5a, accent: 0x2a2d33 },
  motorbike: { body: 0x7647d8, accent: 0x2d5bd0 },
};

/** Paint variety for ordinary traffic. */
export const TRAFFIC_PAINTS: Readonly<Partial<Record<ModelId, readonly Paint[]>>> = {
  hatchback: [
    { body: 0x12bcc1, accent: 0x142b4e },
    { body: 0xffd447, accent: 0x142b4e },
    { body: 0xf2efe6, accent: 0x142b4e },
    { body: 0x609d55, accent: 0x142b4e },
  ],
  sedan: [
    { body: 0xef5b4c, accent: 0x142b4e },
    { body: 0xc9ced6, accent: 0x142b4e },
    { body: 0xf2efe6, accent: 0x142b4e },
    { body: 0x3a6fd8, accent: 0x142b4e },
    { body: 0x2b2f36, accent: 0x142b4e },
  ],
  suv: [
    { body: 0x1f2f5a, accent: 0x2a2d33 },
    { body: 0x23262c, accent: 0x2a2d33 },
    { body: 0xe9e6dd, accent: 0x2a2d33 },
    { body: 0x8a9099, accent: 0x2a2d33 },
  ],
  motorbike: [
    { body: 0x7647d8, accent: 0x2d5bd0 },
    { body: 0xef4b43, accent: 0x142b4e },
  ],
  van: [
    { body: 0xf2efe6, accent: 0x142b4e },
    { body: 0x9aa3ad, accent: 0x142b4e },
  ],
};

/** Who drives in each city, with how often they appear. */
export const TRAFFIC_MIX: Readonly<Record<CityId, readonly (readonly [ModelId, number])[]>> = {
  london: [
    ['blackcab', 5],
    ['hatchback', 4],
    ['sedan', 4],
    ['suv', 3],
    ['van', 2],
    ['doubledecker', 2],
    ['motorbike', 2],
  ],
};
