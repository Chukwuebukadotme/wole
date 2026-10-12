import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trafficCar, trafficTruck, type ModelId } from './cars.ts';
import { mulberry32 } from './util.ts';

const sample = (n: number, draw: () => ModelId): Map<ModelId, number> => {
  const counts = new Map<ModelId, number>();
  for (let i = 0; i < n; i++) {
    const m = draw();
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return counts;
};

test('exotics only appear on fast roads', () => {
  const rng = mulberry32(3);
  for (const stretch of ['market', 'city'] as const) {
    const counts = sample(4000, () => trafficCar(stretch, 1, rng).model);
    assert.equal(counts.get('formula') ?? 0, 0);
    assert.equal(counts.get('hyper') ?? 0, 0);
  }
  const fast = sample(4000, () => trafficCar('expressway', 1, rng).model);
  assert.ok((fast.get('formula') ?? 0) + (fast.get('hyper') ?? 0) > 0);
});

test('posh roads carry more luxury cars', () => {
  const rng = mulberry32(5);
  const luxury = (posh: number): number => {
    const counts = sample(6000, () => trafficCar('expressway', posh, rng).model);
    return (counts.get('luxsuv') ?? 0) + (counts.get('coupe') ?? 0);
  };
  assert.ok(luxury(1) > luxury(0.2) * 1.8);
});

test('everyday saloons stay the most common car and trucks stay trucks', () => {
  const rng = mulberry32(9);
  const counts = sample(4000, () => trafficCar('city', 0.2, rng).model);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  assert.equal(top?.[0], 'saloon');
  for (let i = 0; i < 200; i++) assert.ok(['lorry', 'boxtruck', 'refuse'].includes(trafficTruck('city', rng).model));
  for (let i = 0; i < 200; i++) assert.notEqual(trafficTruck('bridge', rng).model, 'refuse');
});
