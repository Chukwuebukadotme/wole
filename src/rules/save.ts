// Saved progress for West Road Life (London). Wole Wole keeps its own save for Lagos.
import { CITIES, type CityId } from '../config/cities.ts';
import { FLEETS, type VehicleId } from '../config/vehicles.ts';

export type Mode = 'route' | 'endless';

export interface CitySave {
  /** Money earned across all drives in this city's currency. */
  bank: number;
  vehicle: VehicleId;
  area: string;
  best: number;
  bestDist: number;
}

export interface SaveData {
  version: 3;
  city: CityId;
  mode: Mode;
  passengers: boolean;
  cities: Record<CityId, CitySave>;
  /** Best money per city, area and mode, keyed "london:river-run:route". */
  bests: Record<string, number>;
  settings: { music: number; sfx: number; reducedMotion: boolean };
  /** The practice drive has been finished. */
  tutorialDone: boolean;
  /** Name printed on share cards and challenge links. */
  name: string;
  /** Today's daily drive: best money and how many tries. */
  daily: { day: string; best: number | null; tries: number };
  stats: { drives: number; delivered: number; metres: number; perfectStops: number };
}

export const SAVE_KEY = 'westroadlife.save.v3';

const firstArea = (city: CityId): string => CITIES.find((c) => c.id === city)?.areas[0]?.id ?? '';
const firstVehicle = (city: CityId): VehicleId => FLEETS[city][0] ?? 'sedan';

export function defaultSave(): SaveData {
  const fresh = (c: CityId): CitySave => ({ bank: 0, vehicle: firstVehicle(c), area: firstArea(c), best: 0, bestDist: 0 });
  return {
    version: 3,
    city: 'london',
    mode: 'route',
    passengers: true,
    cities: { london: fresh('london') },
    bests: {},
    settings: { music: 0.6, sfx: 0.8, reducedMotion: false },
    tutorialDone: false,
    name: '',
    daily: { day: '', best: null, tries: 0 },
    stats: { drives: 0, delivered: 0, metres: 0, perfectStops: 0 },
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const pos = (v: unknown): number => Math.max(0, num(v, 0));
const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);
const unit = (v: unknown, fallback: number): number => Math.max(0, Math.min(1, num(v, fallback)));

/** Read a stored save of unknown shape, keeping valid fields and defaulting the rest. */
export function parseSave(raw: unknown): SaveData {
  const base = defaultSave();
  if (!isRecord(raw)) return base;
  const city: CityId = 'london';
  const cities = isRecord(raw.cities) ? raw.cities : {};
  const readCity = (id: CityId): CitySave => {
    const c = isRecord(cities[id]) ? cities[id] : {};
    const areas = CITIES.find((x) => x.id === id)?.areas.map((a) => a.id) ?? [];
    const area = str(c.area, '');
    const vehicle = str(c.vehicle, '') as VehicleId;
    return {
      bank: pos(c.bank),
      vehicle: FLEETS[id].includes(vehicle) ? vehicle : firstVehicle(id),
      area: areas.includes(area) ? area : firstArea(id),
      best: pos(c.best),
      bestDist: pos(c.bestDist),
    };
  };
  const bests: Record<string, number> = {};
  if (isRecord(raw.bests)) for (const [k, v] of Object.entries(raw.bests)) if (/^london:[\w-]+:(route|endless|daily)$/.test(k)) bests[k] = pos(v);
  const settings = isRecord(raw.settings) ? raw.settings : {};
  const daily = isRecord(raw.daily) ? raw.daily : {};
  const stats = isRecord(raw.stats) ? raw.stats : {};
  return {
    version: 3,
    city,
    mode: raw.mode === 'endless' ? 'endless' : 'route',
    passengers: raw.passengers !== false,
    cities: { london: readCity('london') },
    bests,
    settings: {
      music: unit(settings.music, base.settings.music),
      sfx: unit(settings.sfx, base.settings.sfx),
      reducedMotion: settings.reducedMotion === true,
    },
    tutorialDone: raw.tutorialDone === true,
    name: str(raw.name, '').slice(0, 24),
    daily: {
      day: /^\d{4}-\d{2}-\d{2}$/.test(str(daily.day, '')) ? str(daily.day, '') : '',
      best: typeof daily.best === 'number' && Number.isFinite(daily.best) ? daily.best : null,
      tries: Math.floor(pos(daily.tries)),
    },
    stats: { drives: Math.floor(pos(stats.drives)), delivered: Math.floor(pos(stats.delivered)), metres: pos(stats.metres), perfectStops: Math.floor(pos(stats.perfectStops)) },
  };
}

/** Key for a personal best. */
export const bestKey = (city: CityId, area: string, mode: Mode | 'daily'): string => `${city}:${area}:${mode}`;
