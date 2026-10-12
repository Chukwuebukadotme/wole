// Same-direction traffic in three lanes. Vehicles spawn ahead in a seeded pattern, keep their distance,
// change lanes now and then, and never run into the player from behind.
import * as THREE from 'three';
import type { CityId } from '../config/cities.ts';
import { MODEL_SIZE, PLAYER_PAINT, TRAFFIC_MIX, TRAFFIC_PAINTS, type ModelId, type Paint, type VehicleId } from '../config/vehicles.ts';
import { satin } from '../art/materials.ts';
import { vehicleGeometry, vehicleParts } from '../art/vehicles.ts';
import { hashString } from '../rules/social.ts';
import { clamp, mulberry32, pick, type Rng } from '../rules/util.ts';
import { LANES } from '../world/layout.ts';

export interface Car {
  readonly model: ModelId;
  readonly key: string;
  readonly mesh: THREE.Mesh;
  readonly w: number;
  readonly l: number;
  d: number;
  x: number;
  lane: number;
  v: number;
  /** Sideways speed while changing lane. */
  vx: number;
  /** Speed it likes to drive at. */
  cruise: number;
  laneT: number;
  /** Set once hit by the player: it spins aside and leaves the road. */
  flung: { vx: number; vy: number; spin: number; t: number } | null;
  /** Already passed close by the player (close-pass bonus paid once). */
  passed: boolean;
}

export interface TrafficEnv {
  readonly dist: number;
  readonly playerX: number;
  readonly playerL: number;
  readonly playerW: number;
  readonly playerV: number;
  /** Cruise speed of the player's vehicle; traffic drives slower than this. */
  readonly cruise: number;
  /** Traffic density, 1 = normal. */
  readonly density: number;
  /** Seeds the spawn pattern so a shared challenge gets the same traffic. */
  readonly seed: number;
}

const AHEAD = 300;
const BEHIND = 70;

export class Traffic {
  readonly group = new THREE.Group();
  readonly cars: Car[] = [];
  private readonly pools = new Map<string, THREE.Mesh[]>();
  private readonly geos = new Map<string, THREE.BufferGeometry>();
  private city: CityId = 'london';
  private side: -1 | 1 = -1;
  private nextSpawn = 0;
  private spawnIndex = 0;
  /** The player's own model is left out of traffic, so it is never confused with them. */
  private exclude: VehicleId | null = null;

  setCity(city: CityId, side: -1 | 1, exclude: VehicleId | null): void {
    if (city !== this.city) {
      this.clear();
      for (const g of this.geos.values()) g.dispose();
      this.geos.clear();
      this.pools.clear();
    }
    this.city = city;
    this.side = side;
    this.exclude = exclude;
  }

  clear(): void {
    for (const c of this.cars) this.release(c);
    this.cars.length = 0;
  }

  /** Start over at `dist`, with the first cars already on the road ahead. */
  reset(dist: number, env: TrafficEnv, startGap = 45): void {
    this.clear();
    this.nextSpawn = dist + startGap;
    this.spawnIndex = 0;
    this.fill(env, dist + AHEAD);
  }

  private geometry(model: ModelId, paint: Paint, look: number): { key: string; geo: THREE.BufferGeometry } {
    const key = `${model}:${paint.body}:${look}`;
    let geo = this.geos.get(key);
    if (!geo) {
      geo = vehicleGeometry(vehicleParts(model, paint, this.side, look));
      this.geos.set(key, geo);
    }
    return { key, geo };
  }

  private acquire(key: string, geo: THREE.BufferGeometry): THREE.Mesh {
    const pool = this.pools.get(key);
    const mesh = pool?.pop() ?? new THREE.Mesh(geo, satin());
    mesh.castShadow = true;
    mesh.visible = true;
    mesh.rotation.set(0, 0, 0);
    this.group.add(mesh);
    return mesh;
  }

  private release(c: Car): void {
    c.mesh.removeFromParent();
    let pool = this.pools.get(c.key);
    if (!pool) {
      pool = [];
      this.pools.set(c.key, pool);
    }
    pool.push(c.mesh);
  }

  /** Lane speeds: the kerb lane is slowest, the outer lane quickest. */
  private laneSpeed(lane: number, env: TrafficEnv, rng: Rng): number {
    const kerbLane = this.side < 0 ? 0 : 2;
    const fromKerb = Math.abs(lane - kerbLane);
    return env.cruise * (0.42 + fromKerb * 0.12 + rng() * 0.1);
  }

  private spawn(env: TrafficEnv, d: number, rng: Rng): void {
    const mix = TRAFFIC_MIX[this.city].filter(([m]) => m !== this.exclude);
    const total = mix.reduce((s, [, w]) => s + w, 0);
    let r = rng() * total;
    let model: ModelId = mix[0]?.[0] ?? 'sedan';
    for (const [m, w] of mix) {
      r -= w;
      if (r < 0) {
        model = m;
        break;
      }
    }
    const kerbLane = this.side < 0 ? 0 : 2;
    const big = model === 'doubledecker';
    let lane = Math.floor(rng() * 3);
    if (big && rng() < 0.7) lane = kerbLane;
    // Leave room: no two cars side by side in all three lanes.
    const blocked = (ln: number): boolean => this.cars.some((c) => c.lane === ln && Math.abs(c.d - d) < (c.l + MODEL_SIZE[model].l) / 2 + 8);
    if (blocked(lane)) {
      const free = [0, 1, 2].filter((ln) => !blocked(ln));
      if (free.length === 0) return;
      lane = pick(free, rng);
    }
    const sameRow = this.cars.filter((c) => Math.abs(c.d - d) < 14).map((c) => c.lane);
    if (new Set([...sameRow, lane]).size >= 3) return;
    const paints = TRAFFIC_PAINTS[model];
    const paint = paints ? pick(paints, rng) : (PLAYER_PAINT[model as VehicleId] ?? { body: 0xf2efe6, accent: 0x142b4e });
    const look = Math.floor(rng() * 3);
    const { key, geo } = this.geometry(model, paint, look);
    const size = MODEL_SIZE[model];
    const cruise = this.laneSpeed(lane, env, rng) * (model === 'motorbike' ? 1.25 : big ? 0.82 : 1);
    const mesh = this.acquire(key, geo);
    this.cars.push({ model, key, mesh, w: size.w, l: size.l, d, x: LANES[lane] ?? 0, lane, v: cruise, vx: 0, cruise, laneT: 2 + rng() * 6, flung: null, passed: false });
  }

  /** Spawn along the road up to `limit`, in a pattern fixed by the seed and the distance. */
  private fill(env: TrafficEnv, limit: number): void {
    while (this.nextSpawn < limit) {
      const rng = mulberry32(hashString(`${env.seed}:t:${this.spawnIndex}`));
      this.spawnIndex++;
      const gap = clamp((26 + rng() * 26) / env.density, 9, 60);
      this.nextSpawn += gap;
      if (this.nextSpawn > env.dist + 60) this.spawn(env, this.nextSpawn, rng);
    }
  }

  update(dt: number, env: TrafficEnv): void {
    this.fill(env, env.dist + AHEAD);
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (!c) continue;
      if (c.flung) {
        const f = c.flung;
        f.t += dt;
        c.x += f.vx * dt;
        c.d += c.v * dt;
        c.v = Math.max(0, c.v - 12 * dt);
        c.mesh.rotation.y += f.spin * dt;
        if (f.t > 2.2 || Math.abs(c.x) > 30) {
          this.release(c);
          this.cars.splice(i, 1);
          continue;
        }
      } else this.drive(c, dt, env);
      if (c.d < env.dist - BEHIND || c.d > env.dist + AHEAD + 120) {
        this.release(c);
        this.cars.splice(i, 1);
        continue;
      }
      c.mesh.position.set(c.x, 0, -c.d);
    }
  }

  private drive(c: Car, dt: number, env: TrafficEnv): void {
    // Keep a gap to whatever is ahead in this lane, including the player.
    let want = c.cruise;
    const ahead = this.leader(c);
    if (ahead) {
      const gap = ahead.d - c.d - (ahead.l + c.l) / 2;
      if (gap < 18) want = Math.min(want, ahead.v * clamp(gap / 14, 0, 1.1));
    }
    const playerAhead = env.dist - c.d - (env.playerL + c.l) / 2;
    const playerOverlap = Math.abs(env.playerX - c.x) < (env.playerW + c.w) / 2 + 0.3;
    if (playerOverlap && playerAhead > -1 && playerAhead < 22) want = Math.min(want, env.playerV * clamp(playerAhead / 10, 0, 1));
    const accel = want > c.v ? 3 : 8;
    c.v += clamp(want - c.v, -accel * dt, accel * dt);
    c.v = Math.max(0, c.v);
    c.d += c.v * dt;
    // Now and then move to a free lane, never into the player's path.
    c.laneT -= dt;
    if (c.laneT <= 0) {
      c.laneT = 4 + Math.random() * 7;
      const blocked = ahead && ahead.d - c.d < 26;
      const bike = c.model === 'motorbike';
      if (blocked || bike || Math.random() < 0.25) {
        const options = [c.lane - 1, c.lane + 1].filter((ln) => ln >= 0 && ln <= 2 && this.laneFree(c, ln, env));
        if (options.length) c.lane = pick(options);
      }
    }
    // Ease across to the new lane and turn the nose the way it is going.
    const target = LANES[c.lane] ?? 0;
    const w = 2.2;
    c.vx = clamp(c.vx + (w * w * (target - c.x) - 2 * w * c.vx) * dt, -3, 3);
    c.x += c.vx * dt;
    c.mesh.rotation.y = clamp(-Math.atan2(c.vx, Math.max(4, c.v)) * 0.8, -0.14, 0.14);
  }

  private leader(c: Car): Car | null {
    let best: Car | null = null;
    for (const o of this.cars) {
      if (o === c || o.flung || o.d <= c.d) continue;
      if (Math.abs(o.x - c.x) > (o.w + c.w) / 2 + 0.2 && o.lane !== c.lane) continue;
      if (!best || o.d < best.d) best = o;
    }
    return best;
  }

  private laneFree(c: Car, lane: number, env: TrafficEnv): boolean {
    const x = LANES[lane] ?? 0;
    if (Math.abs(env.playerX - x) < 2.4 && Math.abs(env.dist - c.d) < 40) return false;
    return !this.cars.some((o) => o !== c && !o.flung && (o.lane === lane || Math.abs(o.x - x) < 2) && Math.abs(o.d - c.d) < (o.l + c.l) / 2 + 10);
  }

  /** First car the player is touching, if any. */
  hitTest(d: number, x: number, w: number, l: number): Car | null {
    for (const c of this.cars) {
      if (c.flung) continue;
      if (Math.abs(c.x - x) < (c.w + w) / 2 - 0.12 && Math.abs(c.d - d) < (c.l + l) / 2 - 0.15) return c;
    }
    return null;
  }

  /** Knock a car aside after a hit. */
  fling(c: Car, fromX: number): void {
    const dir = c.x >= fromX ? 1 : -1;
    c.flung = { vx: dir * 6, vy: 0, spin: dir * 2.5, t: 0 };
    c.v *= 0.6;
  }
}
