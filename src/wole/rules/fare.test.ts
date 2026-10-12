import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestChange, changeTip, checkChange, fareFor, paymentFor, streakBonus, streakMult } from './fare.ts';
import { mulberry32 } from './util.ts';

test('fares are ₦50 steps and grow with distance', () => {
  const short = fareFor(400, 1, 1, 1);
  const long = fareFor(2400, 1, 1, 1);
  assert.equal(short % 50, 0);
  assert.equal(long % 50, 0);
  assert.ok(long > short);
  assert.equal(fareFor(0, 1, 1, 1), 150);
});

test('passenger and route multipliers scale the fare', () => {
  assert.equal(fareFor(1000, 1, 1, 1), 400);
  assert.equal(fareFor(1000, 1, 1.8, 1), 700);
  assert.equal(fareFor(1000, 1.3, 1, 1), 500);
  assert.equal(fareFor(1000, 1, 0.6, 1), 250);
});

test('payment is the fare or a bigger note, and change is always makeable', () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 500; i++) {
    const fare = 50 * (1 + Math.floor(rng() * 30));
    const paid = paymentFor(fare, rng);
    assert.ok(paid >= fare);
    if (paid > fare) assert.ok(bestChange(paid - fare).length > 0, `change for ${paid - fare}`);
  }
});

test('change check distinguishes short, exact and over', () => {
  assert.deepEqual(checkChange(350, [200, 100]), { status: 'short', given: 300, remaining: 50 });
  assert.equal(checkChange(350, [200, 100, 50]).status, 'exact');
  assert.equal(checkChange(350, [500]).status, 'over');
});

test('best change uses the fewest notes', () => {
  assert.deepEqual(bestChange(750), [500, 200, 50]);
  assert.deepEqual(bestChange(0), []);
});

test('streak multiplier caps at ×3 and bonus follows it', () => {
  assert.equal(streakMult(0), 1);
  assert.equal(streakMult(2), 2);
  assert.equal(streakMult(9), 3);
  assert.equal(streakBonus(400, 0), 0);
  assert.equal(streakBonus(400, 1), 200);
  assert.equal(changeTip(300), 50);
  assert.equal(changeTip(900), 90);
});
