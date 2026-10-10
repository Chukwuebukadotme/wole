import { TUNING } from './data.ts';
import { round50, type Rng } from './util.ts';

/** Coins and notes the conductor can hand back, smallest first. */
export const DENOMS = [50, 100, 200, 500] as const;
const NOTES = [200, 500, 1000, 2000] as const;

/** Fare for a ride of `metres`, always a whole ₦50 step. */
export function fareFor(metres: number, routeScale: number, paxMult: number, eventMult: number): number {
  const raw = (TUNING.fareBase + (TUNING.farePerKm * Math.max(0, metres)) / 1000) * routeScale * paxMult * eventMult;
  return round50(raw);
}

/** What the passenger hands over: exact money, or the next note up (sometimes a bigger one). */
export function paymentFor(fare: number, rng: Rng): number {
  if (rng() < 0.45) return fare;
  const above = NOTES.filter((note) => note > fare);
  const first = above[0];
  if (first === undefined) return fare;
  const second = above[1];
  return second !== undefined && rng() < 0.25 ? second : first;
}

export type ChangeStatus = 'short' | 'exact' | 'over';
export interface ChangeCheck {
  readonly status: ChangeStatus;
  readonly given: number;
  readonly remaining: number;
}

/** Compare the conductor's handed-back money with what is owed. */
export function checkChange(due: number, given: readonly number[]): ChangeCheck {
  const total = given.reduce((sum, value) => sum + value, 0);
  if (total === due) return { status: 'exact', given: total, remaining: 0 };
  if (total > due) return { status: 'over', given: total, remaining: due - total };
  return { status: 'short', given: total, remaining: due - total };
}

/** Fewest notes that make `amount`, used for the hint and the auto-conductor. */
export function bestChange(amount: number): number[] {
  const out: number[] = [];
  let left = amount;
  for (const value of [...DENOMS].reverse()) {
    while (left >= value) {
      out.push(value);
      left -= value;
    }
  }
  return left === 0 ? out : [];
}

/** Fare multiplier from the clean-stop streak: ×1, ×1.5 … ×3. */
export const streakMult = (streak: number): number => 1 + 0.5 * Math.min(4, Math.max(0, streak));

/** Extra the driver earns on top of a fare from the streak, in ₦10 steps. */
export const streakBonus = (fare: number, streak: number): number => Math.round((fare * (streakMult(streak) - 1)) / 10) * 10;

/** Tip for correct change: 10% of the fare, at least ₦50. */
export const changeTip = (fare: number): number => Math.max(50, Math.round(fare / 100) * 10);
