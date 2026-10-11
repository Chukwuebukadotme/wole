import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, LAGOS, LONDON, areaById, stretchAt } from '../config/cities.ts';
import { FLEETS, MODEL_SIZE, VEHICLES } from '../config/vehicles.ts';
import { distanceText, drivePay, fareFor, money, perfectTip } from './money.ts';
import { bestKey, defaultSave, migrateWole, parseSave } from './save.ts';
import { dailyDrive, dayKey, decodeChallenge, driveAdvice, encodeChallenge, shortDate } from './social.ts';

test('money reads in each city’s currency and steps', () => {
  assert.equal(money(LONDON.economy, 1240.4), '£1,240');
  assert.equal(money(LAGOS.economy, 12_520), '₦12,500');
  assert.equal(money(LAGOS.economy, 12_530), '₦12,550');
  assert.equal(distanceText(850), '850 m');
  assert.equal(distanceText(2430), '2.4 km');
});

test('driving pays by distance, more when faster, nothing when stopped', () => {
  const eco = LONDON.economy;
  assert.equal(Math.round(drivePay(eco, 1000, 14, 14)), 60);
  assert.ok(drivePay(eco, 1000, 28, 14) > drivePay(eco, 1000, 14, 14));
  assert.equal(drivePay(eco, 1000, 0, 14), 30);
  assert.equal(drivePay(eco, 0, 20, 14), 0);
});

test('fares grow with stops ridden and the vehicle’s fare rate, in money steps', () => {
  assert.equal(fareFor(LONDON.economy, 2, 1), 9);
  assert.equal(fareFor(LONDON.economy, 2, 3), 27);
  assert.equal(fareFor(LAGOS.economy, 1, 1) % 50, 0);
  assert.equal(perfectTip(LAGOS.economy, 300), 100);
  assert.equal(perfectTip(LONDON.economy, 1), 1);
});

test('every area is well formed: stretches cover it, stops sit on streets with room between them', () => {
  for (const city of CITIES) {
    for (const area of city.areas) {
      assert.equal(area.stretches[0]?.from, 0, area.id);
      assert.equal(area.stretches.at(-1)?.to, area.length, area.id);
      for (let i = 1; i < area.stretches.length; i++) assert.equal(area.stretches[i]?.from, area.stretches[i - 1]?.to, area.id);
      let prev = -Infinity;
      for (const stop of area.stops) {
        assert.ok(stop.at - prev >= 300, `${area.id}: ${stop.name} too close to the previous stop`);
        assert.ok(stop.at > 120 && stop.at < area.length - 120, `${area.id}: ${stop.name} too near an end`);
        const theme = stretchAt(area, stop.at).theme;
        assert.notEqual(theme, 'london-bridge', `${area.id}: no boarding on Tower Bridge`);
        prev = stop.at;
      }
      for (const lm of area.landmarks) if (lm.kind === 'tower-bridge') assert.equal(stretchAt(area, lm.at).theme, 'london-bridge');
    }
  }
  assert.equal(areaById('lagos', 'nope').id, 'marina');
});

test('each city has a full fleet of six with sensible stats', () => {
  for (const city of CITIES) {
    assert.equal(FLEETS[city.id].length, 6);
    for (const id of FLEETS[city.id]) {
      const v = VEHICLES[id];
      assert.ok(v.top > v.cruise && v.health >= 2 && v.seats >= 1, id);
      assert.ok(MODEL_SIZE[id].l === v.l);
    }
  }
});

test('saves survive a round trip and damaged fields fall back', () => {
  const s = defaultSave('lagos');
  s.cities.lagos.bank = 25_000;
  s.cities.london.vehicle = 'blackcab';
  s.bests[bestKey('london', 'wapping', 'route')] = 410;
  const back = parseSave(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back, s);
  const junk = parseSave({ city: 'paris', cities: { london: { vehicle: 'danfo', area: 'moon', bank: -5 } }, settings: { music: 7 }, bests: { 'x:y': 3 } });
  assert.equal(junk.city, 'london');
  assert.equal(junk.cities.london.vehicle, 'doubledecker');
  assert.equal(junk.cities.london.area, 'river-run');
  assert.equal(junk.cities.london.bank, 0);
  assert.equal(junk.settings.music, 1);
  assert.deepEqual(junk.bests, {});
});

test('Wole Wole progress moves into Lagos', () => {
  const s = migrateWole({ bank: 18_000, best: { cash: 9_500, dist: 4200 }, name: 'Tunde', stats: { runs: 3, delivered: 40, metres: 9000 }, settings: { muted: true } });
  assert.ok(s);
  assert.equal(s.city, 'lagos');
  assert.equal(s.cities.lagos.bank, 18_000);
  assert.equal(s.cities.lagos.best, 9_500);
  assert.equal(s.name, 'Tunde');
  assert.equal(s.tutorialDone, true);
  assert.equal(s.settings.music, 0);
  assert.equal(migrateWole('nonsense'), null);
});

test('the daily drive is the same for everyone on a day and changes between days', () => {
  assert.deepEqual(dailyDrive('2026-10-11'), dailyDrive('2026-10-11'));
  const days = Array.from({ length: 14 }, (_, i) => dailyDrive(`2026-10-${String(i + 10).padStart(2, '0')}`));
  assert.ok(new Set(days.map((d) => d.seed)).size === 14);
  assert.ok(new Set(days.map((d) => d.city)).size === 2, 'both cities come up within two weeks');
  for (const d of days) assert.ok(FLEETS[d.city].includes(d.vehicle) && areaById(d.city, d.area).id === d.area);
  assert.equal(dayKey(new Date('2026-10-11T23:30:00Z')), '2026-10-12');
  assert.equal(shortDate('2026-10-11'), '11 Oct');
});

test('challenge links survive a round trip and reject junk or old links', () => {
  const c = { city: 'lagos', area: 'ikeja', mode: 'endless', passengers: false, vehicle: 'keke', seed: 3_000_000_000, score: 18_000, name: 'Adé Ọlá', day: null } as const;
  assert.deepEqual(decodeChallenge(encodeChallenge(c)), c);
  assert.match(encodeChallenge(c), /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeChallenge(encodeChallenge({ ...c, day: '2026-10-11' }))?.day, '2026-10-11');
  assert.equal(decodeChallenge(encodeChallenge({ ...c, name: '<b>' }))?.name, 'b');
  assert.equal(decodeChallenge(null), null);
  assert.equal(decodeChallenge('not-base64!!'), null);
  // A Wole Wole daily-shift link.
  assert.equal(decodeChallenge('eyJkIjoiMjAyNi0xMC0xMSIsInMiOjE4NTAsIm4iOiJUdW5kZSJ9'), null);
  // A vehicle from the other city's fleet.
  assert.equal(decodeChallenge(encodeChallenge({ ...c, vehicle: 'blackcab' as 'keke' })), null);
});

test('advice points at the most useful thing first', () => {
  const base = { passengers: true, delivered: 10, missed: 0, stops: 6, perfectStops: 5, crashes: 0, closePasses: 2, ended: 'complete' } as const;
  assert.match(driveAdvice({ ...base, ended: 'damage' })[0], /Damage/);
  assert.match(driveAdvice({ ...base, missed: 3 })[0], /missed/);
  assert.match(driveAdvice({ ...base, perfectStops: 1 })[1], /next stop clean/);
  assert.match(driveAdvice({ ...base, passengers: false })[0], /money by driving/);
  assert.match(driveAdvice(base)[0], /Great drive/);
  assert.match(driveAdvice({ ...base, ended: 'quit', stops: 0, delivered: 0 })[0], /Short drive/);
});
