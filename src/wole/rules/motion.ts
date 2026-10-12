// Motion shared by the bus, the cars and the tests: fixed simulation steps and damped springs.
import { TUNING } from './data.ts';

/** Fixed simulation step: driving, stopping and collisions come out the same at any frame rate. */
export const STEP = 1 / 120;

/** Run whole steps for a frame of `dt` seconds; returns the time left over for the next frame. */
export function fixedSteps(carry: number, dt: number, step: (h: number) => void): number {
  // A long stall (a background tab) is not replayed in full.
  let acc = Math.min(carry + dt, 0.25);
  while (acc >= STEP) {
    step(STEP);
    acc -= STEP;
  }
  return acc;
}

/** Position and velocity along one axis. */
export interface Spring {
  x: number;
  v: number;
}

/** Advance a damped spring towards `target` (stiffness `k`, damping `c`); returns its acceleration. */
export function springStep(s: Spring, target: number, k: number, c: number, dt: number): number {
  const a = k * (target - s.x) - c * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
  return a;
}

/** Critically damped spring of natural frequency `w`: the quickest settle with no overshoot. */
export function critical(s: Spring, target: number, w: number, dt: number): number {
  return springStep(s, target, w * w, 2 * w, dt);
}

/** Lane-change spring frequency for a ride's handling (the danfo is 1). */
export const laneSpring = (handling: number): number => 17 * handling;

/**
 * One step of the bus's speed: brake or coast down to `target`, otherwise pull up to it
 * (briskly below cruise, gently above it on the gas).
 */
export function nextSpeed(speed: number, target: number, cruise: number, braking: boolean, brake: number, dt: number): number {
  if (speed > target) return Math.max(target, speed - (braking ? brake : TUNING.coast) * dt);
  return Math.min(target, speed + (speed < cruise ? TUNING.accel : TUNING.gasAccel) * dt);
}
