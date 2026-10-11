import { CARS } from './cars.ts';
import {
  HORNS,
  MISSIONS,
  PAINTS,
  ROUTES,
  STICKERS,
  TUNING,
  UPGRADES,
  type HornId,
  type MissionEvent,
  type RouteId,
  type UpgradeId,
} from './data.ts';
import { RACES } from './races.ts';

export interface MissionState {
  readonly id: MissionEvent;
  readonly target: number;
  progress: number;
  readonly reward: number;
  readonly xp: number;
}

export interface SaveData {
  version: 2;
  bank: number;
  xp: number;
  best: { cash: number; dist: number };
  owned: { paint: string[]; sticker: string[]; horn: string[]; car: string[] };
  equip: { paint: string; sticker: string; horn: HornId; car: string };
  upgrades: Record<UpgradeId, number>;
  missions: MissionState[];
  stats: { runs: number; delivered: number; metres: number; races: number; wins: number };
  /** Best time in seconds (0 = not finished yet) and wins, per race. */
  races: Record<string, { best: number; wins: number }>;
  race: string;
  daily: { lastDay: string; streak: number };
  settings: { autoChange: boolean; muted: boolean };
  route: RouteId;
  seenHelp: boolean;
  /** The guided first pickup and drop-off is finished. */
  guided: boolean;
  /** One-time tips already shown, by id. */
  tips: string[];
}

export function defaultSave(): SaveData {
  return {
    version: 2,
    bank: 0,
    xp: 0,
    best: { cash: 0, dist: 0 },
    owned: { paint: ['eko'], sticker: ['permanent'], horn: ['classic'], car: ['danfo'] },
    equip: { paint: 'eko', sticker: 'permanent', horn: 'classic', car: 'danfo' },
    upgrades: { tank: 0, brakes: 0, body: 0, seats: 0 },
    missions: [],
    stats: { runs: 0, delivered: 0, metres: 0, races: 0, wins: 0 },
    races: {},
    race: 'ikorodu',
    daily: { lastDay: '', streak: 0 },
    settings: { autoChange: false, muted: false },
    route: 'ikorodu',
    seenHelp: false,
    guided: false,
    tips: [],
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);
const ids = (v: unknown, valid: readonly string[], required: string): string[] => {
  const list = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && valid.includes(x)) : [];
  return Array.from(new Set([required, ...list]));
};

/** Read a stored save of unknown shape, keeping valid fields and defaulting the rest. */
export function parseSave(raw: unknown): SaveData {
  const base = defaultSave();
  if (!isRecord(raw)) return base;
  const owned = isRecord(raw.owned) ? raw.owned : {};
  const equip = isRecord(raw.equip) ? raw.equip : {};
  const upgrades = isRecord(raw.upgrades) ? raw.upgrades : {};
  const best = isRecord(raw.best) ? raw.best : {};
  const stats = isRecord(raw.stats) ? raw.stats : {};
  const daily = isRecord(raw.daily) ? raw.daily : {};
  const settings = isRecord(raw.settings) ? raw.settings : {};
  const paints = ids(owned.paint, PAINTS.map((p) => p.id), 'eko');
  const stickers = ids(owned.sticker, STICKERS.map((s) => s.id), 'permanent');
  const horns = ids(owned.horn, HORNS.map((h) => h.id), 'classic');
  const cars = ids(owned.car, CARS.map((c) => c.id), 'danfo');
  const equipPaint = str(equip.paint, 'eko');
  const equipSticker = str(equip.sticker, 'permanent');
  const equipHorn = str(equip.horn, 'classic');
  const equipCar = str(equip.car, 'danfo');
  const rawRaces = isRecord(raw.races) ? raw.races : {};
  const races: SaveData['races'] = {};
  for (const r of RACES) {
    const rec = rawRaces[r.id];
    if (isRecord(rec)) races[r.id] = { best: Math.max(0, num(rec.best, 0)), wins: Math.max(0, Math.floor(num(rec.wins, 0))) };
  }
  const race = str(raw.race, 'ikorodu');
  const missionIds = MISSIONS.map((m) => m.id) as readonly string[];
  const missions: MissionState[] = Array.isArray(raw.missions)
    ? raw.missions.flatMap((m): MissionState[] => {
        if (!isRecord(m) || typeof m.id !== 'string' || !missionIds.includes(m.id)) return [];
        const target = num(m.target, 0);
        if (target <= 0) return [];
        return [{ id: m.id as MissionEvent, target, progress: Math.max(0, num(m.progress, 0)), reward: num(m.reward, 500), xp: num(m.xp, 100) }];
      }).slice(0, 3)
    : [];
  const upgradeLevel = (id: UpgradeId): number => {
    const max = UPGRADES.find((u) => u.id === id)?.prices.length ?? 0;
    return Math.max(0, Math.min(max, Math.floor(num(upgrades[id], 0))));
  };
  const route = str(raw.route, 'ikorodu');
  return {
    version: 2,
    bank: Math.max(0, num(raw.bank, 0)),
    xp: Math.max(0, num(raw.xp, 0)),
    best: { cash: Math.max(0, num(best.cash, 0)), dist: Math.max(0, num(best.dist, 0)) },
    owned: { paint: paints, sticker: stickers, horn: horns, car: cars },
    equip: {
      paint: paints.includes(equipPaint) ? equipPaint : 'eko',
      sticker: stickers.includes(equipSticker) ? equipSticker : 'permanent',
      horn: (horns.includes(equipHorn) ? equipHorn : 'classic') as HornId,
      car: cars.includes(equipCar) ? equipCar : 'danfo',
    },
    upgrades: { tank: upgradeLevel('tank'), brakes: upgradeLevel('brakes'), body: upgradeLevel('body'), seats: upgradeLevel('seats') },
    missions,
    stats: {
      runs: Math.max(0, num(stats.runs, 0)),
      delivered: Math.max(0, num(stats.delivered, 0)),
      metres: Math.max(0, num(stats.metres, 0)),
      races: Math.max(0, num(stats.races, 0)),
      wins: Math.max(0, num(stats.wins, 0)),
    },
    races,
    race: RACES.some((r) => r.id === race) ? race : 'ikorodu',
    daily: { lastDay: str(daily.lastDay, ''), streak: Math.max(0, num(daily.streak, 0)) },
    settings: { autoChange: bool(settings.autoChange, false), muted: bool(settings.muted, false) },
    route: ROUTES.some((r) => r.id === route) ? (route as RouteId) : 'ikorodu',
    seenHelp: bool(raw.seenHelp, false),
    // Players who already drove before the guide existed skip it.
    guided: bool(raw.guided, num(stats.runs, 0) > 0),
    tips: Array.isArray(raw.tips) ? raw.tips.filter((t): t is string => typeof t === 'string').slice(0, 64) : [],
  };
}

// ---------- Levels ----------
/** XP needed to go from `level` to the next. */
export const xpToNext = (level: number): number => 300 + 200 * (level - 1);

export function levelInfo(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let left = xp;
  while (left >= xpToNext(level)) {
    left -= xpToNext(level);
    level++;
  }
  return { level, into: left, need: xpToNext(level) };
}

export const unlockedRoutes = (level: number): RouteId[] => ROUTES.filter((r) => r.unlockLevel <= level).map((r) => r.id);

// ---------- Bus stats from upgrades ----------
export const tankSize = (s: SaveData): number => TUNING.baseTank + 10 * s.upgrades.tank;
export const seatCount = (s: SaveData): number => TUNING.baseSeats + 2 * s.upgrades.seats;
export const bodyMax = (s: SaveData): number => TUNING.baseBody + s.upgrades.body;
export const brakeFactor = (s: SaveData): number => 1 + 0.15 * s.upgrades.brakes;

// ---------- Garage ----------
export type ShopKind = 'paint' | 'sticker' | 'horn' | 'car';
export type BuyResult = { ok: true } | { ok: false; reason: 'owned' | 'level' | 'money' | 'unknown' | 'maxed' };

function catalogItem(kind: ShopKind, id: string): { price: number; level: number } | undefined {
  if (kind === 'paint') return PAINTS.find((p) => p.id === id);
  if (kind === 'sticker') return STICKERS.find((p) => p.id === id);
  if (kind === 'car') return CARS.find((c) => c.id === id);
  return HORNS.find((p) => p.id === id);
}

export function buyItem(s: SaveData, kind: ShopKind, id: string): BuyResult {
  const item = catalogItem(kind, id);
  if (!item) return { ok: false, reason: 'unknown' };
  if (s.owned[kind].includes(id)) return { ok: false, reason: 'owned' };
  if (levelInfo(s.xp).level < item.level) return { ok: false, reason: 'level' };
  if (s.bank < item.price) return { ok: false, reason: 'money' };
  s.bank -= item.price;
  s.owned[kind].push(id);
  return { ok: true };
}

export function equipItem(s: SaveData, kind: ShopKind, id: string): boolean {
  if (!s.owned[kind].includes(id)) return false;
  if (kind === 'horn') s.equip.horn = id as HornId;
  else s.equip[kind] = id;
  return true;
}

export function upgradePrice(s: SaveData, id: UpgradeId): number | null {
  const def = UPGRADES.find((u) => u.id === id);
  const price = def?.prices[s.upgrades[id]];
  return price ?? null;
}

export function buyUpgrade(s: SaveData, id: UpgradeId): BuyResult {
  const price = upgradePrice(s, id);
  if (price === null) return { ok: false, reason: 'maxed' };
  if (s.bank < price) return { ok: false, reason: 'money' };
  s.bank -= price;
  s.upgrades[id] += 1;
  return { ok: true };
}

/** Daily visit bonus: ₦200 per consecutive day, up to 7 days. */
export function recordDaily(s: SaveData, today: string, yesterday: string): { bonus: number; streak: number } {
  if (s.daily.lastDay === today) return { bonus: 0, streak: s.daily.streak };
  s.daily.streak = s.daily.lastDay === yesterday ? s.daily.streak + 1 : 1;
  s.daily.lastDay = today;
  const bonus = 200 * Math.min(7, s.daily.streak);
  s.bank += bonus;
  return { bonus, streak: s.daily.streak };
}
