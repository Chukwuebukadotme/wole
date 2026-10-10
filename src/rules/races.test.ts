import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARS, carById, carSummary } from './cars.ts';
import { buyItem, defaultSave, equipItem, parseSave } from './progress.ts';
import { RACES, placeText, racePrize, raceTime, raceXp, unlockedRaces } from './races.ts';
import { getRoute } from './route.ts';

test('places and race clocks read naturally', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 11, 12, 13, 21, 22].map(placeText), ['1st', '2nd', '3rd', '4th', '5th', '11th', '12th', '13th', '21st', '22nd']);
  assert.equal(raceTime(0), '0:00.0');
  assert.equal(raceTime(67.44), '1:07.4');
  assert.equal(raceTime(59.96), '1:00.0');
});

test('prizes go to the top three only', () => {
  const race = RACES[0];
  assert.ok(race);
  assert.equal(racePrize(race, 1), race.prizes[0]);
  assert.equal(racePrize(race, 3), race.prizes[2]);
  assert.equal(racePrize(race, 4), 0);
  assert.equal(racePrize(race, 0), 0);
  assert.ok(raceXp(1) > raceXp(2) && raceXp(2) > raceXp(4) && raceXp(4) > raceXp(0));
});

test('every race fits its route, avoids the toll and fields real cars', () => {
  for (const race of RACES) {
    const route = getRoute(race.route);
    assert.ok(race.start >= 0 && race.start + race.length <= route.length, race.id);
    for (const toll of route.tolls) assert.ok(toll < race.start || toll > race.start + race.length + 400, `${race.id} crosses a toll`);
    assert.equal(race.field.length, 4, race.id);
    for (const id of race.field) assert.notEqual(carById(id).model, 'danfo');
  }
  assert.deepEqual(unlockedRaces(1), ['ikorodu']);
  assert.equal(unlockedRaces(99).length, RACES.length);
});

test('cars are bought with bank money, start with the danfo and survive a save round trip', () => {
  const s = defaultSave();
  assert.deepEqual(s.owned.car, ['danfo']);
  assert.equal(s.equip.car, 'danfo');
  s.bank = 15000;
  assert.deepEqual(buyItem(s, 'car', 'hothatch'), { ok: false, reason: 'level' });
  assert.deepEqual(buyItem(s, 'car', 'tokunbo'), { ok: true });
  assert.equal(s.bank, 3000);
  assert.ok(equipItem(s, 'car', 'tokunbo'));
  s.races.ikorodu = { best: 71.5, wins: 2 };
  const back = parseSave(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.owned.car, ['danfo', 'tokunbo']);
  assert.equal(back.equip.car, 'tokunbo');
  assert.deepEqual(back.races.ikorodu, { best: 71.5, wins: 2 });
});

test('a damaged save drops unknown cars and races', () => {
  const s = parseSave({ owned: { car: ['tokunbo', 'spaceship'] }, equip: { car: 'spaceship' }, races: { ikorodu: { best: 'fast' }, moon: { best: 3 } }, race: 'moon' });
  assert.deepEqual(s.owned.car, ['danfo', 'tokunbo']);
  assert.equal(s.equip.car, 'danfo');
  assert.deepEqual(s.races, { ikorodu: { best: 0, wins: 0 } });
  assert.equal(s.race, 'ikorodu');
});

test('car prices climb with class and every car reads well in the garage', () => {
  for (const car of CARS) assert.match(carSummary(car), /^[A-Za-z ]+ · \d+ km\/h · \d+ hits?$/);
  const price = (id: string): number => carById(id).price;
  assert.ok(price('tokunbo') < price('bigboy') && price('bigboy') < price('banana') && price('banana') < price('lightning'));
});
