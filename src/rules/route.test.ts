import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROUTES, TILE, WEEKDAY_EVENTS } from './data.ts';
import { eventFor, isHarmattanSeason, previousDayKey, watDayKey } from './daily.ts';
import { getRoute, placements, sideBlocked, stretchAt } from './route.ts';

test('every route is tile-aligned, ordered and internally consistent', () => {
  for (const r of ROUTES) {
    assert.equal(r.length % TILE, 0, `${r.id} length`);
    let cursor = 0;
    for (const s of r.stretches) {
      assert.equal(s.from, cursor, `${r.id} stretch gap at ${s.from}`);
      assert.equal(s.from % TILE, 0);
      assert.ok(s.to > s.from);
      cursor = s.to;
    }
    assert.equal(cursor, r.length, `${r.id} stretches cover the route`);
    const stops = r.stops.map((s) => s.at);
    assert.deepEqual([...stops].sort((a, b) => a - b), stops, `${r.id} stops in order`);
    for (const stop of r.stops) assert.notEqual(stretchAt(r, stop.at).kind, 'bridge', `${r.id} stop ${stop.name} on a bridge`);
    for (const p of [...r.stations, ...r.junctions, ...r.tolls]) {
      for (const stop of stops) assert.ok(Math.abs(p - stop) >= 60, `${r.id}: feature at ${p} too close to stop at ${stop}`);
    }
  }
});

test('stretch lookup wraps around laps', () => {
  const r = getRoute('mainland');
  assert.equal(stretchAt(r, 2000).kind, 'bridge');
  assert.equal(stretchAt(r, 2000 + r.length).kind, 'bridge');
  assert.equal(stretchAt(r, -100).kind, 'market');
});

test('placements find features across lap boundaries', () => {
  const r = getRoute('ikorodu');
  const found = placements(r, 'stop', r.stops.map((s) => s.at), 1000, 1000 + r.length - 200, 1000 + r.length + 200);
  assert.deepEqual(found.map((p) => [p.lap, p.index]), [[0, 8], [1, 0]]);
  assert.equal(found[1]?.at, 1000 + r.length + 150);
  assert.equal(found[1]?.key, 'stop:1:0');
});

test('roadside space is kept clear near stations and junctions', () => {
  const r = getRoute('ikorodu');
  assert.equal(sideBlocked(r, 990, 1, 'building'), true);
  assert.equal(sideBlocked(r, 990, -1, 'building'), false);
  assert.equal(sideBlocked(r, 1536, -1, 'building'), true);
  assert.equal(sideBlocked(r, 150, 1, 'stall'), true);
  assert.equal(sideBlocked(r, 150, 1, 'building'), false);
});

test('daily events follow West Africa Time', () => {
  assert.equal(WEEKDAY_EVENTS.length, 7);
  assert.equal(eventFor(new Date('2026-10-01T10:00:00Z')).id, 'independence');
  // 23:30 UTC on Saturday is already Sunday in Lagos.
  assert.equal(eventFor(new Date('2026-10-10T23:30:00Z')).id, 'church');
  assert.equal(watDayKey(new Date('2026-10-10T23:30:00Z')), '2026-10-11');
  assert.equal(previousDayKey('2026-03-01'), '2026-02-28');
  assert.equal(isHarmattanSeason(new Date('2026-12-15T12:00:00Z')), true);
  assert.equal(isHarmattanSeason(new Date('2026-07-15T12:00:00Z')), false);
});
