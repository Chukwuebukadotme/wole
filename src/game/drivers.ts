// Lane choices for the cars the game steers: racers and rival danfos.
import { KERB, LANES, laneX } from '../rules/data.ts';
import type { Traffic, Vehicle } from './traffic.ts';

/** The player's vehicle as other drivers see it. */
export interface Body {
  readonly d: number;
  readonly x: number;
  readonly l: number;
  readonly v: number;
}

/** Open road ahead of `me` in `lane` (up to `look` metres) and the speed of whatever ends it. */
export function laneView(me: Vehicle, lane: number, traffic: Traffic, you: Body, look: number): { gap: number; speed: number } {
  const x = laneX(lane);
  let gap = look;
  let speed = Number.POSITIVE_INFINITY;
  const consider = (d: number, l: number, v: number, ox: number): void => {
    // Anything keeping pace with us is not in the way.
    if (Math.abs(ox - x) > 1.9 || v >= me.aim - 1) return;
    const ahead = d - me.d - (l + me.l) / 2;
    if (ahead > -0.5 && ahead < gap) {
      gap = Math.max(0, ahead);
      speed = v;
    }
  };
  for (const o of traffic.vehicles) if (o !== me && !o.flung && !o.cross) consider(o.d, o.l, o.v, o.x);
  for (const h of traffic.hazards) if (h.kind === 'barrier' && !h.flung) consider(h.d, h.l, 0, h.x);
  consider(you.d, you.l, you.v, you.x);
  return { gap, speed };
}

/** Whether `me` can slide into `lane` without touching anyone alongside or just behind. */
export function sideClear(me: Vehicle, lane: number, traffic: Traffic, you: Body): boolean {
  const x = laneX(lane);
  const near = (d: number, l: number, ox: number, v: number): boolean => {
    if (Math.abs(ox - x) > 2.1) return false;
    const reach = (l + me.l) / 2 + 3;
    // Something faster coming up from behind needs more room.
    const behind = d < me.d ? Math.max(0, v - me.v) * 1.2 : 0;
    return d - me.d < reach && me.d - d < reach + behind;
  };
  if (traffic.vehicles.some((o) => o !== me && !o.flung && !o.cross && near(o.d, o.l, o.x, o.v))) return false;
  if (traffic.hazards.some((h) => h.kind === 'barrier' && !h.flung && near(h.d, h.l, h.x, 0))) return false;
  return !near(you.d, you.l, you.x, you.v);
}

/** Stay in lane while the road is open; otherwise move one lane towards wherever `me` can go fastest. */
export function chooseLane(me: Vehicle, traffic: Traffic, you: Body, look: number, allowed: (lane: number) => boolean = () => true): number {
  // How fast `me` could soon go in a lane: open road is full speed, otherwise the blocker's speed plus a little for the room.
  const pace = (lane: number): number => {
    const view = laneView(me, lane, traffic, you, look);
    return view.gap >= look ? me.aim : Math.min(me.aim, view.speed + view.gap * 0.2);
  };
  const here = pace(me.lane);
  if (here >= me.aim - 0.5) return me.lane;
  let best = me.lane;
  let bestPace = here + 1.5;
  for (const dir of [-1, 1] as const) {
    const lane = me.lane + dir;
    if (lane < 0 || lane >= LANES || !allowed(lane) || !sideClear(me, lane, traffic, you)) continue;
    let p = pace(lane);
    // A clear lane beyond makes this one a stepping stone.
    const beyond = lane + dir;
    if (beyond >= 0 && beyond < LANES && allowed(beyond)) p = Math.max(p, pace(beyond) * 0.85);
    // The kerb lane is full of kekes and okadas; only take it for a clear gain.
    if (lane === KERB) p -= 2;
    if (p > bestPace) {
      best = lane;
      bestPace = p;
    }
  }
  return best;
}
