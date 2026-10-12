// Street races on stretches of the danfo routes, through normal traffic.
import type { RouteId } from './data.ts';

export interface RaceDef {
  readonly id: string;
  readonly name: string;
  readonly route: RouteId;
  readonly from: string;
  readonly to: string;
  /** Route-local start position in metres. */
  readonly start: number;
  readonly length: number;
  readonly level: number;
  /** Clock time the race runs at. */
  readonly hour: number;
  /** Cars the other racers drive. */
  readonly field: readonly string[];
  /** Share of top speed the other racers hold, lowest to highest. */
  readonly skill: readonly [number, number];
  /** Prize money for 1st, 2nd and 3rd. */
  readonly prizes: readonly [number, number, number];
  readonly blurb: string;
  /** Lays the traffic out the same way every time this race runs. */
  readonly seed: number;
}

export const RACES: readonly RaceDef[] = [
  {
    id: 'ikorodu',
    name: 'Ikorodu Road Sprint',
    route: 'ikorodu',
    from: 'Ketu',
    to: 'Obanikoro',
    start: 620,
    length: 2400,
    level: 1,
    hour: 10,
    field: ['tokunbo', 'farmboss', 'tokunbo', 'hothatch'],
    skill: [0.85, 0.93],
    prizes: [2000, 1200, 600],
    blurb: 'City traffic, then the BRT corridor. No cameras today.',
    seed: 101,
  },
  {
    id: 'bridge',
    name: 'Third Mainland Night Dash',
    route: 'mainland',
    from: 'Ebute Metta',
    to: 'Lagos Island',
    start: 1040,
    length: 2300,
    level: 3,
    hour: 21,
    field: ['hothatch', 'bigboy', 'sunpower', 'tokunbo'],
    skill: [0.87, 0.95],
    prizes: [4000, 2400, 1200],
    blurb: 'Over the lagoon bridge in the dark. Mind the broken-down cars.',
    seed: 202,
  },
  {
    id: 'lekki',
    name: 'Lekki Big Boys Run',
    route: 'lekki',
    from: 'Lekki Phase 1',
    to: 'VGC',
    start: 900,
    length: 3200,
    level: 6,
    hour: 17.8,
    field: ['banana', 'ikoyi', 'sunpower', 'bigboy'],
    skill: [0.88, 0.96],
    prizes: [8000, 4800, 2400],
    blurb: 'Sunset on the expressway against luxury cars.',
    seed: 303,
  },
  {
    id: 'grandprix',
    name: 'Eko Night Grand Prix',
    route: 'lekki',
    from: 'Lekki Phase 1',
    to: 'Ajah',
    start: 900,
    length: 3700,
    level: 8,
    hour: 22,
    field: ['lightning', 'atlantic', 'ikoyi', 'lightning'],
    skill: [0.9, 0.97],
    prizes: [15000, 9000, 4500],
    blurb: 'The fastest cars in Lagos, flat out down Lekki at night.',
    seed: 404,
  },
];

export function raceById(id: string): RaceDef {
  const race = RACES.find((r) => r.id === id);
  if (!race) throw new Error(`Unknown race ${id}`);
  return race;
}

/** For now every race is open from the start; each race keeps its level for the unlocks to come. */
export const ALL_RACES_OPEN = true;

export const unlockedRaces = (level: number): string[] => RACES.filter((r) => ALL_RACES_OPEN || r.level <= level).map((r) => r.id);

/** "1st", "2nd", "3rd", "4th"… */
export function placeText(place: number): string {
  const tens = place % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : place % 10 === 1 ? 'st' : place % 10 === 2 ? 'nd' : place % 10 === 3 ? 'rd' : 'th';
  return `${place}${suffix}`;
}

/** Race clock such as "1:07.4". */
export function raceTime(seconds: number): string {
  const tenths = Math.max(0, Math.round(seconds * 10));
  const m = Math.floor(tenths / 600);
  const s = (tenths % 600) / 10;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

/** Prize for a finishing place; 0 means no prize or did not finish. */
export const racePrize = (race: RaceDef, place: number): number => (place >= 1 ? (race.prizes[place - 1] ?? 0) : 0);

/** XP for a race: finishing counts, winning counts most. */
export const raceXp = (place: number): number => (place < 1 ? 5 : [90, 60, 40][place - 1] ?? 20);
