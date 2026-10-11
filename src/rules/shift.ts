// The daily shift (the same route and road for everyone that day), result advice, driver titles and challenge links.
import { ROUTES, type RouteId } from './data.ts';

/** Stable 32-bit hash of a string (FNV-1a). */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Today's shift: which route, and the seed that lays out its road, passengers and weather. */
export function dailyShift(dayKey: string): { route: RouteId; seed: number } {
  const seed = hashString(`wole-shift-${dayKey}`);
  const route = ROUTES[seed % ROUTES.length]?.id ?? 'ikorodu';
  return { route, seed };
}

/** "11 Oct" from "2026-10-11". */
export function shortDate(dayKey: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [, m, d] = dayKey.split('-').map(Number);
  return `${d ?? 1} ${months[(m ?? 1) - 1] ?? ''}`.trim();
}

export interface ShiftStats {
  readonly cash: number;
  readonly delivered: number;
  readonly missed: number;
  readonly crashes: number;
  readonly fines: number;
  readonly changeMisses: number;
  readonly bestStreak: number;
  readonly ended: 'crash' | 'fuel' | 'quit' | 'shift' | 'finish';
}

/** A light-hearted title for the share card. */
export function driverTitle(s: ShiftStats): string {
  if (s.crashes >= 3) return "Panel beater's best customer";
  if (s.fines >= 1500) return "The warden's favourite";
  if (s.missed >= 3) return 'Shine-your-eye trainee';
  if (s.delivered >= 30) return 'Oga driver of Lagos';
  if (s.bestStreak >= 4) return 'Streak master';
  if (s.cash >= 5000) return 'Money mover';
  if (s.delivered >= 10) return 'Correct driver';
  if (s.cash <= 0) return 'Danfo apprentice';
  return 'Road warrior';
}

/** One thing to do better next time, most important first. */
export function runAdvice(s: ShiftStats): string {
  if (s.ended === 'fuel') return 'Fuel ran out. When the gauge drops below a quarter, pull into a green FUEL bay and brake.';
  if (s.ended === 'crash') return 'Bodywork finished. Hop barriers (Space or swipe up) and press the horn to move okadas and kekes.';
  if (s.missed >= 2) return 'Passengers missed their stop. When the stop card says someone is getting off, move right early and brake when it says BRAKE NOW.';
  if (s.fines >= 500) return 'Fines ate your money. Stop when the warden raises his hand and keep out of the red BRT lane.';
  if (s.crashes >= 2) return 'Every crash resets your fare streak. Slow down in markets and change lanes earlier.';
  if (s.changeMisses >= 2) return 'Passengers waited for change. Tap the notes as soon as the change panel opens: exact change earns a tip.';
  if (s.bestStreak < 2) return 'Clean drop-offs in a row raise your fares up to ×3. Keep the streak going.';
  return 'Solid shift! Take on the daily shift and challenge a friend to beat it.';
}

export interface Challenge {
  /** Day of the daily shift, e.g. "2026-10-11". */
  readonly day: string;
  readonly score: number;
  readonly name: string;
}

const toBase64 = (text: string): string => {
  let bin = '';
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
};
const fromBase64 = (b64: string): string => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));

/** Pack a challenge into a short URL-safe string. */
export function encodeChallenge(c: Challenge): string {
  const json = JSON.stringify({ d: c.day, s: Math.round(c.score), n: c.name.slice(0, 24) });
  return toBase64(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Read a challenge from a link; anything malformed gives null. */
export function decodeChallenge(code: string | null): Challenge | null {
  if (!code || code.length > 400) return null;
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const json = fromBase64(b64);
    const raw: unknown = JSON.parse(json);
    if (typeof raw !== 'object' || raw === null) return null;
    const { d, s, n } = raw as Record<string, unknown>;
    if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    if (typeof s !== 'number' || !Number.isFinite(s) || s < -100000 || s > 10000000) return null;
    const name = typeof n === 'string' ? n.replace(/[^\p{L}\p{N} .'-]/gu, '').trim().slice(0, 24) : '';
    return { day: d, score: Math.round(s), name: name || 'A friend' };
  } catch {
    return null;
  }
}
