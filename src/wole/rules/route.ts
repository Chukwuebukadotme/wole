import { ROUTES, type RouteDef, type RouteId, type Stretch } from './data.ts';
import { mod } from './util.ts';

export function getRoute(id: RouteId): RouteDef {
  const route = ROUTES.find((r) => r.id === id);
  if (!route) throw new Error(`Unknown route ${id}`);
  return route;
}

/** Stretch at a route-local position (positions wrap every lap). */
export function stretchAt(route: RouteDef, local: number): Stretch {
  const x = mod(local, route.length);
  const found = route.stretches.find((s) => x >= s.from && x < s.to);
  const fallback = route.stretches[route.stretches.length - 1];
  if (!fallback) throw new Error(`Route ${route.id} has no stretches`);
  return found ?? fallback;
}

/** One occurrence of a route feature on a particular lap. */
export interface Placement {
  readonly index: number;
  readonly lap: number;
  /** Absolute distance from the start of the game world. */
  readonly at: number;
  readonly key: string;
}

/** Route features (stops, stations, …) whose absolute position falls in [from, to). */
export function placements(
  route: RouteDef,
  kind: string,
  positions: readonly number[],
  runStart: number,
  from: number,
  to: number,
): Placement[] {
  const out: Placement[] = [];
  const lapFrom = Math.max(0, Math.floor((from - runStart) / route.length));
  const lapTo = Math.floor((to - runStart) / route.length);
  for (let lap = lapFrom; lap <= lapTo; lap++) {
    positions.forEach((p, index) => {
      const at = runStart + lap * route.length + p;
      if (at >= from && at < to) out.push({ index, lap, at, key: `${kind}:${lap}:${index}` });
    });
  }
  return out;
}

/** Whether roadside content must leave room for a stop, station, junction or toll here. */
export function sideBlocked(route: RouteDef, local: number, side: -1 | 1, what: 'building' | 'stall'): boolean {
  const x = mod(local, route.length);
  const near = (p: number, r: number): boolean => Math.abs(x - p) < r || Math.abs(x - p - route.length) < r || Math.abs(x - p + route.length) < r;
  if (route.junctions.some((j) => near(j + 6, 7))) return true;
  if (route.tolls.some((t) => near(t, 14))) return true;
  if (side === 1 && route.stations.some((s) => near(s, 27))) return true;
  if (side === 1 && what === 'stall' && route.stops.some((s) => near(s.at, 18))) return true;
  return false;
}

/** Serial number of a stop across laps, used to count stops ridden. */
export const stopSerial = (route: RouteDef, lap: number, index: number): number => lap * route.stops.length + index;
