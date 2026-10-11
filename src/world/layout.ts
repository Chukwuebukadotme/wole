// Where things are along the road for one drive: stretches, stops and their bays, landmarks.
// Distances are absolute metres from the start of the game world; a drive starts on a tile boundary.
import { stretchAt, type AreaDef, type LandmarkKind, type Stretch, type StopDef } from '../config/cities.ts';

export const TILE = 24;
export const LANE_W = 3.4;
/** Lane centres, left to right. */
export const LANES = [-LANE_W, 0, LANE_W] as const;
/** Kerb line either side of the three lanes. */
export const KERB = 5.1;
/** Centre of a stopping bay, beside the kerb lane (times the city's side). */
export const BAY_X = 6.8;
/** Shop fronts stand this far from the road centre. */
export const BUILD_LINE = 11.5;

export interface StopPlace {
  readonly stop: StopDef;
  readonly index: number;
  readonly lap: number;
  /** Bay centre, absolute. The bay runs one tile either side. */
  readonly at: number;
  readonly key: string;
  /** Count of stops passed since the drive started, for fares. */
  readonly serial: number;
}

export interface LandmarkPlace {
  readonly kind: LandmarkKind;
  readonly at: number;
  readonly key: string;
}

export class Layout {
  readonly area: AreaDef;
  readonly runStart: number;
  /** Lap length rounded to whole tiles, so endless laps line up. */
  readonly lap: number;
  readonly endless: boolean;
  private readonly stopOffsets: readonly number[];

  constructor(area: AreaDef, runStart: number, endless: boolean) {
    this.area = area;
    this.runStart = Math.round(runStart / TILE) * TILE;
    this.lap = Math.round(area.length / TILE) * TILE;
    this.endless = endless;
    this.stopOffsets = area.stops.map((s) => Math.round(s.at / TILE) * TILE);
  }

  /** Where route mode ends. */
  get routeEnd(): number {
    return this.runStart + this.lap;
  }

  /** Stretch at an absolute distance; before the start it continues the first stretch, after a route's end the last. */
  stretch(d: number): Stretch {
    const local = d - this.runStart;
    if (local < 0) return stretchAt(this.area, 0);
    if (!this.endless && local >= this.lap) return stretchAt(this.area, this.area.length - 1);
    return stretchAt(this.area, ((local % this.lap) + this.lap) % this.lap);
  }

  /** Stops whose bay centre lies in [from, to). */
  stopsIn(from: number, to: number): StopPlace[] {
    const out: StopPlace[] = [];
    const n = this.stopOffsets.length;
    const lapFrom = Math.max(0, Math.floor((from - this.runStart) / this.lap) - 1);
    const lapTo = this.endless ? Math.floor((to - this.runStart) / this.lap) : 0;
    for (let lap = lapFrom; lap <= lapTo; lap++) {
      this.stopOffsets.forEach((off, index) => {
        const at = this.runStart + lap * this.lap + off;
        const stop = this.area.stops[index];
        if (stop && at >= from && at < to) out.push({ stop, index, lap, at, key: `stop:${lap}:${index}`, serial: lap * n + index });
      });
    }
    return out;
  }

  /** The stop whose bay covers distance d (bay spans one tile either side of its centre). */
  bayAt(d: number): StopPlace | null {
    return this.stopsIn(d - TILE, d + TILE + 0.001).find((s) => d >= s.at - TILE && d <= s.at + TILE) ?? null;
  }

  /** Next stop ahead of d (its bay centre beyond d - 10 m, so a bay you are in still counts). */
  nextStop(d: number): StopPlace | null {
    return this.stopsIn(d - 10, d + this.lap + 10)[0] ?? null;
  }

  landmarksIn(from: number, to: number): LandmarkPlace[] {
    const out: LandmarkPlace[] = [];
    const lapFrom = Math.max(0, Math.floor((from - this.runStart) / this.lap) - 1);
    const lapTo = this.endless ? Math.floor((to - this.runStart) / this.lap) + 1 : 0;
    for (let lap = lapFrom; lap <= lapTo; lap++)
      this.area.landmarks.forEach((lm, i) => {
        const at = this.runStart + lap * this.lap + lm.at;
        if (at >= from && at < to) out.push({ kind: lm.kind, at, key: `lm:${lap}:${i}` });
      });
    return out;
  }

  /** Whether a landmark needs space at distance d (no buildings there). */
  nearLandmark(d: number, reach = 40): boolean {
    return this.landmarksIn(d - reach, d + reach).length > 0;
  }
}
