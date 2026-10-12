import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LONDON } from '../config/cities.ts';
import { VEHICLES, type VehicleId } from '../config/vehicles.ts';
import { LANES } from '../world/layout.ts';
import { Crowd } from './crowd.ts';
import { Drive, type DriveListener } from './drive.ts';
import { Traffic } from './traffic.ts';

const quiet: DriveListener = { card() {}, pop() {}, sound() {}, damage() {}, shout() {} };
const STEP = 1 / 120;

function makeDrive(vehicle: VehicleId = 'doubledecker', passengers = false): { d: Drive; traffic: Traffic; hits: string[] } {
  const traffic = new Traffic();
  traffic.setCity('london', -1, vehicle);
  const crowd = new Crowd(new THREE.Group());
  const area = LONDON.areas[0];
  if (!area) throw new Error('no area');
  const hits: string[] = [];
  const d = new Drive(
    { city: LONDON, area, mode: 'route', passengers, vehicle: VEHICLES[vehicle], seed: 7, startDist: 240, daily: null, challenge: null, tutorial: false },
    traffic,
    crowd,
    { ...quiet, damage: (r) => hits.push(r) },
  );
  d.start();
  traffic.clear();
  return { d, traffic, hits };
}

/** Advance as the game does: fixed 1/120 s steps fed by frames of length `frame`. */
function run(d: Drive, seconds: number, frame = 1 / 60, each?: () => void): void {
  let acc = 0;
  for (let t = 0; t < seconds; t += frame) {
    acc += frame;
    while (acc >= STEP) {
      d.update(STEP);
      acc -= STEP;
      each?.();
    }
  }
}

test('braking distance matches the physics and does not depend on the frame rate', () => {
  for (const id of ['doubledecker', 'hatchback', 'motorbike'] as const) {
    const results = [1 / 30, 1 / 60, 1 / 144].map((frame) => {
      const { d, traffic } = makeDrive(id);
      d.speed = d.cruise;
      const start = d.dist;
      d.brake = true;
      run(d, 6, frame, () => traffic.clear());
      return d.dist - start;
    });
    const v = VEHICLES[id];
    const expected = (v.cruise * v.cruise) / (2 * v.brake);
    for (const r of results) assert.ok(Math.abs(r - expected) < 0.3, `${id}: stopped in ${r.toFixed(2)} m, physics says ${expected.toFixed(2)} m`);
    assert.ok(Math.max(...results) - Math.min(...results) < 0.05, `${id}: same stop at 30, 60 and 144 fps`);
  }
});

test('lane changes ease across and settle without overshooting', () => {
  for (const id of ['doubledecker', 'blackcab', 'motorbike'] as const) {
    const { d, traffic } = makeDrive(id);
    d.speed = d.cruise;
    d.slot = 1;
    d.x = LANES[1];
    d.steer(1);
    let maxX = -Infinity;
    let settled = -1;
    let t = 0;
    run(d, 3, 1 / 60, () => {
      traffic.clear();
      t += STEP;
      maxX = Math.max(maxX, d.x);
      if (settled < 0 && Math.abs(d.x - LANES[2]) < 0.05) settled = t;
    });
    assert.ok(maxX - LANES[2] < 0.03, `${id}: overshoot ${(maxX - LANES[2]).toFixed(3)} m`);
    assert.ok(settled > 0.3 && settled < 2.2, `${id}: lane change took ${settled.toFixed(2)} s`);
    assert.ok(Math.abs(d.vx) < 0.05, `${id}: still sliding sideways`);
  }
});

test('speed rises to top with gas and eases back to cruise on release', () => {
  const { d, traffic } = makeDrive('hatchback');
  d.speed = d.cruise;
  d.gas = true;
  let peak = 0;
  run(d, 12, 1 / 60, () => {
    traffic.clear();
    peak = Math.max(peak, d.speed);
  });
  assert.ok(peak <= VEHICLES.hatchback.top + 1e-6 && peak > VEHICLES.hatchback.top - 0.5);
  d.gas = false;
  run(d, 15, 1 / 60, () => traffic.clear());
  assert.ok(Math.abs(d.speed - d.cruise) < 0.05, `back to cruise: ${d.speed.toFixed(2)}`);
});

test('a collision costs one health point, then a short cooldown protects the vehicle', () => {
  const { d, traffic, hits } = makeDrive('sedan');
  d.speed = d.cruise;
  // No random traffic; then one car placed straight across the player's path.
  traffic.reset(d.dist, { dist: d.dist, playerX: 99, playerL: 4, playerW: 2, playerV: 0, cruise: 14, density: 0.0001, seed: 1 }, 1e9);
  const before = d.health;
  (traffic as unknown as { spawn(env: unknown, d: number, rng: () => number): void }).spawn(
    { dist: d.dist, playerX: 99, playerL: 4, playerW: 2, playerV: 0, cruise: 14, density: 1, seed: 1 },
    d.dist + 3,
    () => 0.4,
  );
  const target = traffic.cars[0];
  assert.ok(target, 'test car spawned');
  if (target) target.x = d.x;
  run(d, 0.5);
  assert.equal(d.health, before - 1);
  assert.equal(hits.length, 1);
  assert.ok(d.invuln > 0.5);
});

test('a stop is achievable: from cruising speed the bus can pull in and stop in the bay', () => {
  const { d, traffic } = makeDrive('doubledecker', true);
  const stop = d.layout.nextStop(d.dist);
  assert.ok(stop);
  if (!stop) return;
  d.dist = stop.at - 45;
  d.speed = d.cruise;
  let stoppedAt: number | null = null;
  run(d, 12, 1 / 60, () => {
    traffic.clear();
    if (d.slot !== 3 && stop.at - d.dist < 30) d.steer(-1);
    d.brake = d.slot === 3 && stop.at - d.dist < 16;
    if (d.phase === 'stopped' && stoppedAt === null) stoppedAt = d.dist;
  });
  assert.ok(stoppedAt !== null, 'the bus stopped at the stop');
  if (stoppedAt !== null) assert.ok(Math.abs(stoppedAt - stop.at) <= 17, `stopped ${(stoppedAt - stop.at).toFixed(1)} m from the bay centre`);
});
