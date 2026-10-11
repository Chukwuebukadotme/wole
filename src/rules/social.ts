// The daily drive (same road for everyone that day), challenge links and result advice.
import { CITIES, type CityId } from '../config/cities.ts';
import { FLEETS, type VehicleId } from '../config/vehicles.ts';
import type { Mode } from './save.ts';

/** Stable 32-bit hash of a string (FNV-1a). */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Calendar day in West Africa Time (an hour ahead of London), e.g. "2026-10-11". */
export const dayKey = (now: Date): string => new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);

/** "11 Oct" from "2026-10-11". */
export function shortDate(day: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [, m, d] = day.split('-').map(Number);
  return `${d ?? 1} ${months[(m ?? 1) - 1] ?? ''}`.trim();
}

export interface DailyDrive {
  readonly day: string;
  readonly city: CityId;
  readonly area: string;
  readonly vehicle: VehicleId;
  /** Lays out the traffic and passengers so everyone gets the same road. */
  readonly seed: number;
}

/** Today's drive: city, area and vehicle are picked from the date, so everyone drives the same thing. */
export function dailyDrive(day: string): DailyDrive {
  const seed = hashString(`west-road-life:${day}`);
  const city = CITIES[seed % CITIES.length] ?? CITIES[0];
  if (!city) throw new Error('No cities');
  const area = city.areas[Math.floor(seed / 7) % city.areas.length] ?? city.areas[0];
  const fleet = FLEETS[city.id];
  const vehicle = fleet[Math.floor(seed / 131) % fleet.length] ?? fleet[0] ?? 'sedan';
  return { day, city: city.id, area: area?.id ?? '', vehicle, seed };
}

/** Everything a friend needs to drive the same road and try to beat a score. */
export interface Challenge {
  readonly city: CityId;
  readonly area: string;
  readonly mode: Mode;
  readonly passengers: boolean;
  readonly vehicle: VehicleId;
  readonly seed: number;
  readonly score: number;
  readonly name: string;
  /** Set when the drive was a daily drive. */
  readonly day: string | null;
}

const toBase64 = (text: string): string => {
  let bin = '';
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
};
const fromBase64 = (b64: string): string => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));

/** Pack a challenge into a short URL-safe string. */
export function encodeChallenge(c: Challenge): string {
  const json = JSON.stringify({
    v: 3,
    c: c.city,
    a: c.area,
    m: c.mode === 'endless' ? 'e' : 'r',
    p: c.passengers ? 1 : 0,
    x: c.vehicle,
    r: c.seed >>> 0,
    s: Math.round(c.score),
    n: c.name.slice(0, 24),
    ...(c.day ? { d: c.day } : {}),
  });
  return toBase64(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Read a challenge from a link; anything malformed (including old Wole Wole links) gives null. */
export function decodeChallenge(code: string | null): Challenge | null {
  if (!code || code.length > 600) return null;
  try {
    const raw: unknown = JSON.parse(fromBase64(code.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof raw !== 'object' || raw === null) return null;
    const o = raw as Record<string, unknown>;
    if (o.v !== 3) return null;
    const city = CITIES.find((x) => x.id === o.c);
    if (!city) return null;
    const area = city.areas.find((a) => a.id === o.a);
    if (!area) return null;
    const vehicle = FLEETS[city.id].find((v) => v === o.x);
    if (!vehicle) return null;
    if (typeof o.s !== 'number' || !Number.isFinite(o.s) || o.s < 0 || o.s > 1e9) return null;
    if (typeof o.r !== 'number' || !Number.isInteger(o.r) || o.r < 0 || o.r > 0xffffffff) return null;
    const day = typeof o.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.d) ? o.d : null;
    const name = typeof o.n === 'string' ? o.n.replace(/[^\p{L}\p{N} .'-]/gu, '').trim().slice(0, 24) : '';
    return { city: city.id, area: area.id, mode: o.m === 'e' ? 'endless' : 'route', passengers: o.p !== 0, vehicle, seed: o.r, score: Math.round(o.s), name: name || 'A friend', day };
  } catch {
    return null;
  }
}

export interface DriveStats {
  readonly passengers: boolean;
  readonly delivered: number;
  readonly missed: number;
  readonly stops: number;
  readonly perfectStops: number;
  readonly crashes: number;
  readonly closePasses: number;
  readonly ended: 'complete' | 'damage' | 'quit';
}

/** Two short lines of advice for the results card, most useful first. */
export function driveAdvice(s: DriveStats): [string, string] {
  if (s.ended === 'damage') return ['Damage ended this drive.', 'Change lanes early and leave a gap.'];
  if (s.passengers && s.missed >= 2) return ['Riders missed their stops.', 'Move into the bay early, then hold Brake.'];
  if (s.passengers && s.stops > 0 && s.perfectStops < s.stops / 2) return ['Nice drive. Brake a little earlier', 'to keep your next stop clean.'];
  if (s.crashes >= 2) return ['Every bump costs health.', 'Watch the lane ahead before you swipe.'];
  if (!s.passengers) return ['You earned money by driving.', 'Turn passengers on for fares on top.'];
  if (s.closePasses >= 8) return ['Brave driving!', 'Close passes add up fast.'];
  return ['Great drive.', 'Share it and see if a friend can beat it.'];
}
