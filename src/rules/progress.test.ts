import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEvent, claim, fillMissions, startRun } from './missions.ts';
import {
  bodyMax,
  buyItem,
  buyUpgrade,
  defaultSave,
  equipItem,
  levelInfo,
  parseSave,
  recordDaily,
  seatCount,
  unlockedRoutes,
  xpToNext,
} from './progress.ts';
import { mulberry32 } from './util.ts';

test('a damaged save keeps valid fields and defaults the rest', () => {
  const s = parseSave({ bank: 5000, owned: { paint: ['lagoon', 'not-a-paint'] }, equip: { paint: 'lagoon', horn: 'nope' }, upgrades: { tank: 99 }, route: 'mars' });
  assert.equal(s.bank, 5000);
  assert.deepEqual(s.owned.paint, ['eko', 'lagoon']);
  assert.equal(s.equip.paint, 'lagoon');
  assert.equal(s.equip.horn, 'classic');
  assert.equal(s.upgrades.tank, 3);
  assert.equal(s.route, 'ikorodu');
  assert.deepEqual(parseSave('garbage'), defaultSave());
});

test('levels follow the XP curve and unlock routes', () => {
  assert.equal(levelInfo(0).level, 1);
  assert.equal(levelInfo(xpToNext(1)).level, 2);
  assert.equal(levelInfo(xpToNext(1) + xpToNext(2)).level, 3);
  assert.deepEqual(unlockedRoutes(1), ['ikorodu']);
  assert.deepEqual(unlockedRoutes(3), ['ikorodu', 'mainland']);
  assert.deepEqual(unlockedRoutes(6), ['ikorodu', 'mainland', 'lekki']);
});

test('buying checks money and level, equipping needs ownership', () => {
  const s = defaultSave();
  assert.deepEqual(buyItem(s, 'paint', 'lagoon'), { ok: false, reason: 'money' });
  s.bank = 10000;
  assert.deepEqual(buyItem(s, 'paint', 'eagles'), { ok: false, reason: 'level' });
  assert.deepEqual(buyItem(s, 'paint', 'lagoon'), { ok: true });
  assert.equal(s.bank, 7000);
  assert.deepEqual(buyItem(s, 'paint', 'lagoon'), { ok: false, reason: 'owned' });
  assert.equal(equipItem(s, 'paint', 'asoebi'), false);
  assert.equal(equipItem(s, 'paint', 'lagoon'), true);
  assert.equal(s.equip.paint, 'lagoon');
});

test('upgrades change bus stats and stop at their max level', () => {
  const s = defaultSave();
  s.bank = 100000;
  assert.equal(seatCount(s), 12);
  assert.deepEqual(buyUpgrade(s, 'seats'), { ok: true });
  assert.deepEqual(buyUpgrade(s, 'seats'), { ok: true });
  assert.deepEqual(buyUpgrade(s, 'seats'), { ok: false, reason: 'maxed' });
  assert.equal(seatCount(s), 16);
  buyUpgrade(s, 'body');
  assert.equal(bodyMax(s), 4);
});

test('daily bonus grows on consecutive days and resets after a gap', () => {
  const s = defaultSave();
  assert.deepEqual(recordDaily(s, '2026-10-05', '2026-10-04'), { bonus: 200, streak: 1 });
  assert.deepEqual(recordDaily(s, '2026-10-05', '2026-10-04'), { bonus: 0, streak: 1 });
  assert.deepEqual(recordDaily(s, '2026-10-06', '2026-10-05'), { bonus: 400, streak: 2 });
  assert.deepEqual(recordDaily(s, '2026-10-09', '2026-10-08'), { bonus: 200, streak: 1 });
});

test('missions progress, complete, pay out and refill', () => {
  const rng = mulberry32(3);
  const missions = [
    { id: 'deliver' as const, target: 3, progress: 0, reward: 800, xp: 120 },
    { id: 'earnRun' as const, target: 5000, progress: 4000, reward: 800, xp: 120 },
  ];
  fillMissions(missions, 1, rng);
  assert.equal(missions.length, 3);
  startRun(missions);
  assert.equal(missions[1]?.progress, 0, 'run missions reset at run start');
  assert.equal(applyEvent(missions, 'deliver', 2).length, 0);
  assert.equal(applyEvent(missions, 'deliver', 1).length, 1);
  assert.equal(applyEvent(missions, 'earnRun', 6000).length, 1);
  const reward = claim(missions, 1, rng);
  assert.equal(reward.count, 2);
  assert.equal(reward.bank, 1600);
  assert.equal(missions.length, 3);
});
