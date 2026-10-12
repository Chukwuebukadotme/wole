import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TUNING, laneX } from './data.ts';
import { STEP, critical, fixedSteps, laneSpring, nextSpeed, type Spring } from './motion.ts';

/** Drive frames of length `frame` through the fixed-step loop, as the game does. */
function frames(seconds: number, frame: number, step: (h: number) => void): void {
  let carry = 0;
  for (let t = 0; t < seconds - 1e-9; t += frame) carry = fixedSteps(carry, frame, step);
}

test('braking distance matches the physics and is the same at 30, 60 and 144 fps', () => {
  const brake = TUNING.brake;
  const results = [1 / 30, 1 / 60, 1 / 144].map((frame) => {
    let speed: number = TUNING.speedStart;
    let dist = 0;
    frames(3, frame, (h) => {
      speed = nextSpeed(speed, 0, TUNING.speedStart, true, brake, h);
      dist += speed * h;
    });
    assert.equal(speed, 0);
    return dist;
  });
  const expected = (TUNING.speedStart * TUNING.speedStart) / (2 * brake);
  for (const d of results) assert.ok(Math.abs(d - expected) < 0.06, `stopped in ${d.toFixed(3)} m, physics says ${expected.toFixed(3)} m`);
  assert.ok(Math.max(...results) - Math.min(...results) < 1e-9, 'identical at every frame rate');
});

test('releasing the gas eases back to cruise; gas pulls up to top speed', () => {
  let speed: number = TUNING.speedStart;
  frames(12, 1 / 60, (h) => (speed = nextSpeed(speed, TUNING.gasMax, TUNING.speedStart, false, TUNING.brake, h)));
  assert.equal(speed, TUNING.gasMax);
  frames(6, 1 / 60, (h) => (speed = nextSpeed(speed, TUNING.speedStart, TUNING.speedStart, false, TUNING.brake, h)));
  assert.equal(speed, TUNING.speedStart);
});

test('a lane change is as quick as before, never overshoots and settles', () => {
  for (const handling of [0.95, 1, 1.45]) {
    for (const frame of [1 / 30, 1 / 60, 1 / 144]) {
      const s: Spring = { x: laneX(1), v: 0 };
      const target = laneX(2);
      let t = 0;
      let half = -1;
      let settled = -1;
      let peak = -Infinity;
      frames(1.5, frame, (h) => {
        critical(s, target, laneSpring(handling), h);
        t += h;
        peak = Math.max(peak, s.x);
        if (half < 0 && s.x >= (laneX(1) + target) / 2) half = t;
        if (settled < 0 && Math.abs(s.x - target) < 0.05) settled = t;
      });
      assert.ok(peak - target < 0.005, `overshoot ${(peak - target).toFixed(4)} m`);
      // The old slide jumped to full sideways speed at once: halfway in ln 2 / 11h s, within 5 cm in ln(3.2 / 0.05) / 11h s.
      // The spring starts gently, so it is a few hundredths of a second later halfway and no slower to finish.
      const oldHalf = Math.LN2 / (11 * handling);
      const oldSettle = Math.log(3.2 / 0.05) / (11 * handling);
      assert.ok(half > 0 && half < oldHalf + 0.045, `halfway after ${half.toFixed(3)} s (was ${oldHalf.toFixed(3)} s)`);
      assert.ok(settled > 0 && settled < oldSettle + 0.03, `settled after ${settled.toFixed(3)} s (was ${oldSettle.toFixed(3)} s)`);
    }
  }
});

test('a long stall is not replayed in full', () => {
  let steps = 0;
  const carry = fixedSteps(0, 5, () => steps++);
  assert.equal(steps, Math.floor(0.25 / STEP));
  assert.ok(carry < STEP);
});
