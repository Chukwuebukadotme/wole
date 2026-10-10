import { INDEPENDENCE, WEEKDAY_EVENTS, type DayEvent } from './data.ts';

const WAT_OFFSET_MS = 60 * 60 * 1000;
const watDate = (now: Date): Date => new Date(now.getTime() + WAT_OFFSET_MS);

/** Calendar day in West Africa Time, e.g. "2026-10-01". */
export const watDayKey = (now: Date): string => watDate(now).toISOString().slice(0, 10);

/** The day before a WAT day key. */
export function previousDayKey(dayKey: string): string {
  const t = Date.parse(`${dayKey}T00:00:00Z`) - 24 * 60 * 60 * 1000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Today's event: Independence Day on 1 October, otherwise the weekday event. */
export function eventFor(now: Date): DayEvent {
  const wat = watDate(now);
  if (wat.getUTCMonth() === 9 && wat.getUTCDate() === 1) return INDEPENDENCE;
  const event = WEEKDAY_EVENTS[wat.getUTCDay()];
  if (!event) throw new Error('weekday events must cover all seven days');
  return event;
}

/** Harmattan season (November to February) adds morning haze. */
export function isHarmattanSeason(now: Date): boolean {
  const month = watDate(now).getUTCMonth();
  return month === 10 || month === 11 || month === 0 || month === 1;
}
