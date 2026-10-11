import type { Economy } from '../config/cities.ts';
import { clamp } from './util.ts';

/** Round to the city's money step (whole pounds, ₦50 in Lagos). */
export const roundMoney = (eco: Economy, amount: number): number => Math.round(amount / eco.step) * eco.step;

/** "£1,240" or "₦12,500". */
export function money(eco: Economy, amount: number): string {
  const value = roundMoney(eco, amount);
  const sign = value < 0 ? '−' : '';
  return `${sign}${eco.symbol}${Math.abs(value).toLocaleString('en-GB')}`;
}

/** Pay for driving `metres` at `speed` (m/s) when the vehicle cruises at `cruise`: faster pays more, stopped pays nothing. */
export function drivePay(eco: Economy, metres: number, speed: number, cruise: number): number {
  const ratio = clamp(speed / Math.max(1, cruise), 0, 2.4);
  return (eco.perKm / 1000) * metres * (0.5 + 0.5 * ratio);
}

/** Fare for one rider who rode `stops` stops in a vehicle with `fareMult`. */
export function fareFor(eco: Economy, stops: number, fareMult: number): number {
  return Math.max(eco.step, roundMoney(eco, (eco.fareBase + eco.farePerStop * Math.max(1, stops)) * fareMult));
}

/** Tip for a perfect stop: a quarter of the fares paid there, at least one money step. */
export const perfectTip = (eco: Economy, fares: number): number => Math.max(eco.step, roundMoney(eco, fares * 0.25));

/** "850 m" or "2.4 km". */
export const distanceText = (m: number): string => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
