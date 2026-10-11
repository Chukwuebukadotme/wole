import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROUTES } from './data.ts';
import { dailyShift, decodeChallenge, driverTitle, encodeChallenge, hashString, runAdvice, shortDate, type ShiftStats } from './shift.ts';

const base: ShiftStats = { cash: 3000, delivered: 12, missed: 0, crashes: 0, fines: 0, changeMisses: 0, bestStreak: 3, ended: 'shift' };

test('the daily shift is the same for everyone on a day and changes between days', () => {
  assert.deepEqual(dailyShift('2026-10-11'), dailyShift('2026-10-11'));
  assert.ok(ROUTES.some((r) => r.id === dailyShift('2026-10-11').route));
  const seeds = new Set(['2026-10-11', '2026-10-12', '2026-10-13'].map((d) => dailyShift(d).seed));
  assert.equal(seeds.size, 3);
  assert.equal(hashString('a'), hashString('a'));
  assert.equal(shortDate('2026-10-11'), '11 Oct');
});

test('advice points at the biggest problem first', () => {
  assert.match(runAdvice({ ...base, ended: 'fuel', missed: 5 }), /FUEL bay/);
  assert.match(runAdvice({ ...base, ended: 'crash' }), /Bodywork/);
  assert.match(runAdvice({ ...base, missed: 2, fines: 1500 }), /missed their stop/);
  assert.match(runAdvice({ ...base, fines: 500 }), /warden/);
  assert.match(runAdvice(base), /daily shift/);
});

test('driver titles follow how the shift went', () => {
  assert.equal(driverTitle({ ...base, crashes: 3 }), "Panel beater's best customer");
  assert.equal(driverTitle({ ...base, delivered: 31, bestStreak: 0 }), 'Oga driver of Lagos');
  assert.equal(driverTitle({ ...base, cash: 0, delivered: 0, bestStreak: 0 }), 'Danfo apprentice');
});

test('challenge links survive a round trip and reject junk', () => {
  const c = { day: '2026-10-11', score: 4850, name: 'Adé Ọlá' };
  assert.deepEqual(decodeChallenge(encodeChallenge(c)), c);
  assert.match(encodeChallenge(c), /^[A-Za-z0-9_-]+$/);
  assert.equal(decodeChallenge(null), null);
  assert.equal(decodeChallenge('not-base64!!'), null);
  assert.equal(decodeChallenge(encodeChallenge({ ...c, day: 'yesterday' })), null);
  assert.equal(decodeChallenge(encodeChallenge({ ...c, name: '<script>' }))?.name, 'script');
  assert.equal(decodeChallenge(encodeChallenge({ ...c, name: '' }))?.name, 'A friend');
});
