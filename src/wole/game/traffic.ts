import type * as THREE from 'three';
import { carModelsReady, makeVehicle } from '../engine/cars.ts';
import { makeBarrier, makeBrtBus, makeDanfo, makeFigure, makeKeke, makeNote, makeOkada, makePothole, makePuddle } from '../engine/models.ts';
import { MODEL_SIZE, trafficCar, trafficTruck, type Look } from '../rules/cars.ts';
import { KERB, KERB_X, LANES, PAINTS, laneX, type StretchKind } from '../rules/data.ts';
import { clamp, pick, rand, weighted, type Rng } from '../rules/util.ts';

export type VehicleKind = 'car' | 'danfo' | 'keke' | 'okada' | 'truck' | 'brt';
/** Ordinary traffic picks its own speed and lanes; racers and rival danfos are steered by the game. */
export type Driver = 'traffic' | 'racer' | 'rival';
export type HazardKind = 'barrier' | 'pothole' | 'puddle';
export type WalkerKind = 'pedestrian' | 'hawker';

/** Cars and trucks take their size from their model. */
const SIZE: Readonly<Record<Exclude<VehicleKind, 'car' | 'truck'> | HazardKind, { w: number; l: number }>> = {
  danfo: { w: 2.3, l: 5.6 },
  keke: { w: 1.35, l: 2.6 },
  okada: { w: 0.8, l: 1.9 },
  brt: { w: 2.55, l: 12 },
  barrier: { w: 2.4, l: 0.45 },
  pothole: { w: 2.0, l: 1.5 },
  puddle: { w: 3.0, l: 2.2 },
};
const BASE_LANE_SPEED = [11.5, 9.5, 7.5, 5.5];
const STRETCH_SPEED: Readonly<Record<StretchKind, number>> = { market: 0.62, city: 1, expressway: 1.45, bridge: 1.55 };

interface Flingable {
  mesh: THREE.Group;
  x: number;
  y: number;
  d: number;
  flung: boolean;
  flungT: number;
  vx: number;
  vy: number;
  spin: number;
}
export interface Vehicle extends Flingable {
  kind: VehicleKind;
  /** Pool the mesh returns to. */
  readonly key: string;
  lane: number;
  v: number;
  w: number;
  l: number;
  broken: boolean;
  /** Crossing a junction sideways instead of driving down the road. */
  cross: boolean;
  laneCooldown: number;
  behind: boolean;
  driver: Driver;
  /** Speed a racer or rival wants, in m/s. */
  aim: number;
  /** Pull-away in m/s². */
  accel: number;
  /** How quickly it slides across to a new lane. */
  steer: number;
}
export interface Hazard extends Flingable {
  kind: HazardKind;
  lane: number;
  w: number;
  l: number;
  hit: boolean;
}
export interface Note {
  mesh: THREE.Group;
  lane: number;
  x: number;
  d: number;
}
export interface Walker {
  kind: WalkerKind;
  mesh: THREE.Group;
  x: number;
  d: number;
  fromX: number;
  toX: number;
  walking: boolean;
  triggerAt: number;
  hurry: number;
  dodge: number;
  sold: boolean;
  scared: boolean;
  t: number;
}

export interface StretchInfo {
  readonly kind: StretchKind;
  readonly brt: boolean;
}

/** What the traffic needs to know about the road and the run. */
export interface TrafficEnv {
  readonly dist: number;
  readonly difficulty: number;
  readonly trafficMult: number;
  readonly pedestrianMult: number;
  readonly hawkerMult: number;
  readonly rain: number;
  readonly dark: number;
  /** 0–1: how often luxury cars and exotics turn up. */
  readonly posh: number;
  readonly playing: boolean;
  /** Whether ₦20 notes lie in free lanes. */
  readonly notes: boolean;
  /** Vehicles outside this stretch are removed; null keeps the usual window around the bus. */
  readonly span: { readonly from: number; readonly to: number } | null;
  /** The player's vehicle, which racers and rivals keep clear of. */
  readonly player: { readonly d: number; readonly x: number; readonly l: number };
  stretchAt(d: number): StretchInfo;
  /** True near bus stops and stations, where the kerb lane must stay clear. */
  kerbReserved(d: number): boolean;
  /** Absolute positions where traffic must stop (junction held by the warden). */
  stopLines(): readonly number[];
  /** Places where traffic slows to a crawl (toll gate). */
  slowZones(): readonly { from: number; to: number; speed: number }[];
}

type Factory = () => THREE.Group;
const VEHICLE_FACTORY: Readonly<Record<Exclude<VehicleKind, 'car' | 'truck'>, Factory>> = {
  danfo: () => makeDanfo(pick(PAINTS.slice(0, 3)), null, false).group,
  keke: makeKeke,
  okada: makeOkada,
  brt: makeBrtBus,
};
const HAZARD_FACTORY: Readonly<Record<HazardKind, Factory>> = { barrier: makeBarrier, pothole: makePothole, puddle: makePuddle };

export class Traffic {
  readonly vehicles: Vehicle[] = [];
  readonly hazards: Hazard[] = [];
  readonly notes: Note[] = [];
  readonly walkers: Walker[] = [];
  private spawnD = 0;
  private walkerD = 0;
  /** Drives spawning only, so a seeded run lays the road out the same way each time. */
  private rng: Rng = Math.random;
  private readonly pools = new Map<string, THREE.Group[]>();
  private readonly scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  private take(key: string, make: Factory): THREE.Group {
    const pool = this.pools.get(key);
    const mesh = pool?.pop() ?? make();
    if (!mesh.parent) this.scene.add(mesh);
    mesh.visible = true;
    mesh.rotation.set(0, 0, 0);
    mesh.position.set(0, 0, 0);
    return mesh;
  }

  private give(key: string, mesh: THREE.Group): void {
    mesh.visible = false;
    const pool = this.pools.get(key) ?? [];
    pool.push(mesh);
    this.pools.set(key, pool);
  }

  /** Remove everything and start spawning ahead of `fromD`. */
  reset(fromD: number, rng: Rng = Math.random): void {
    this.rng = rng;
    for (const v of this.vehicles) this.give(v.key, v.mesh);
    for (const h of this.hazards) this.give(`h:${h.kind}`, h.mesh);
    for (const n of this.notes) this.give('note', n.mesh);
    for (const w of this.walkers) this.give(`w:${w.kind}`, w.mesh);
    this.vehicles.length = 0;
    this.hazards.length = 0;
    this.notes.length = 0;
    this.walkers.length = 0;
    this.spawnD = fromD + 90;
    this.walkerD = fromD + 60;
  }

  laneFree(lane: number, d: number, gap: number, except?: Vehicle): boolean {
    return (
      !this.vehicles.some((o) => o !== except && !o.flung && !o.cross && o.lane === lane && Math.abs(o.d - d) < gap + o.l / 2) &&
      !this.hazards.some((h) => h.lane === lane && h.kind === 'barrier' && Math.abs(h.d - d) < gap)
    );
  }

  addVehicle(kind: VehicleKind, lane: number, d: number, v: number, broken = false, look?: Look): Vehicle {
    let size: { w: number; l: number };
    let key: string;
    let make: Factory;
    if (kind === 'car' || kind === 'truck') {
      const l = look ?? (kind === 'car' ? trafficCar('city', 0, this.rng) : trafficTruck('city', this.rng));
      size = MODEL_SIZE[l.model];
      // Box stand-ins drawn before the models loaded go to their own pool.
      key = `v:${l.model}:${l.color ?? 'stock'}:${carModelsReady() ? '3d' : 'box'}`;
      make = () => makeVehicle(l.model, l.color);
    } else {
      size = SIZE[kind];
      key = `v:${kind}`;
      make = VEHICLE_FACTORY[kind];
    }
    const vehicle: Vehicle = {
      kind,
      key,
      mesh: this.take(key, make),
      lane,
      x: laneX(lane),
      y: 0,
      d,
      v,
      w: size.w,
      l: size.l,
      broken,
      cross: false,
      laneCooldown: 0,
      behind: false,
      driver: 'traffic',
      aim: 0,
      accel: 3.5,
      steer: 3,
      flung: false,
      flungT: 0,
      vx: 0,
      vy: 0,
      spin: 0,
    };
    this.vehicles.push(vehicle);
    return vehicle;
  }

  /** A car crossing the junction sideways at absolute position `d`. */
  addCrossCar(d: number, dir: -1 | 1): void {
    const car = this.addVehicle('car', -1, d, 0, false, trafficCar('city', 0));
    car.cross = true;
    car.x = -dir * 42;
    car.vx = dir * 10;
    car.mesh.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  }

  /** BRT bus coming up behind the player in the BRT lane. */
  addBrtBehind(dist: number): Vehicle {
    const bus = this.addVehicle('brt', 0, dist - 85, 18);
    bus.behind = true;
    return bus;
  }

  private laneSpeed(lane: number, stretch: StretchInfo, kind: VehicleKind): number {
    if (kind === 'brt') return 16;
    return (BASE_LANE_SPEED[lane] ?? 8) * STRETCH_SPEED[stretch.kind];
  }

  /** Lay out traffic all the way to `until` at once (races, where rivals run far from the bus). */
  prespawn(env: TrafficEnv, until: number): void {
    this.spawnTraffic(env, until);
  }

  private spawnTraffic(env: TrafficEnv, until = env.dist + 240): void {
    const rng = this.rng;
    while (this.spawnD < until) {
      const d = this.spawnD;
      const s = env.stretchAt(d);
      const lanes = [0, 1, 2, 3].filter((l) => !(s.brt && l === 0) && !(l === KERB && env.kerbReserved(d)));
      for (let i = lanes.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const a = lanes[i];
        const b = lanes[j];
        if (a !== undefined && b !== undefined) {
          lanes[i] = b;
          lanes[j] = a;
        }
      }
      const busy = s.kind === 'market' ? 0.62 : s.kind === 'bridge' ? 0.42 : s.kind === 'expressway' ? 0.4 : 0.35;
      const two = rng() < clamp((busy + 0.3 * env.difficulty) * env.trafficMult, 0, 0.9);
      const count = Math.min(lanes.length - 1, two ? 2 : 1);
      // The first stretch of a run eases in: a mostly clear kerb lane and fewer hazards.
      const warmup = Math.min(1, env.difficulty * 5);
      for (let i = 0; i < count; i++) {
        const lane = lanes[i];
        if (lane === undefined) continue;
        if (lane === KERB && rng() > 0.35 + 0.65 * warmup) continue;
        const hazardChance = (s.kind === 'market' ? 0.2 : s.kind === 'city' ? 0.16 : s.kind === 'expressway' ? 0.1 : 0.06) * (0.4 + 0.6 * warmup);
        if (rng() < hazardChance + 0.08 * env.difficulty) {
          if (s.kind === 'bridge') {
            const truck = rng() < 0.4;
            const look = truck ? trafficTruck(s.kind, rng) : trafficCar(s.kind, env.posh, rng);
            if (this.laneFree(lane, d, 14)) this.addVehicle(truck ? 'truck' : 'car', lane, d, 0, true, look);
          } else {
            let kind: HazardKind = rng() < 0.5 ? 'barrier' : 'pothole';
            if (kind === 'pothole' && env.rain > 0.3 && rng() < 0.6) kind = 'puddle';
            if (this.laneFree(lane, d, 10)) this.addHazard(kind, lane, d);
          }
          continue;
        }
        const kind: VehicleKind =
          lane === KERB
            ? weighted([['keke', 0.55], ['okada', 0.45]] as const, rng)
            : s.kind === 'market'
              ? weighted([['keke', 0.3], ['okada', 0.3], ['danfo', 0.25], ['car', 0.1], ['truck', 0.05]] as const, rng)
              : s.kind === 'city'
                ? weighted([['car', 0.4], ['danfo', 0.22], ['keke', 0.12], ['okada', 0.14], ['truck', 0.12]] as const, rng)
                : weighted([['car', 0.55], ['danfo', 0.22], ['truck', 0.15], ['okada', s.kind === 'bridge' ? 0 : 0.08]] as const, rng);
        const look = kind === 'car' ? trafficCar(s.kind, env.posh, rng) : kind === 'truck' ? trafficTruck(s.kind, rng) : undefined;
        const length = look ? MODEL_SIZE[look.model].l : kind === 'car' || kind === 'truck' ? 0 : SIZE[kind].l;
        if (this.laneFree(lane, d, length + 8)) this.addVehicle(kind, lane, d, this.laneSpeed(lane, s, kind), false, look);
      }
      if (s.brt && rng() < 0.2 && this.laneFree(0, d, 20)) this.addVehicle('brt', 0, d, 16);
      const free = lanes.slice(count);
      if (env.notes && free.length > 0 && rng() < 0.4) {
        const lane = pick(free, rng);
        if (this.laneFree(lane, d + 12, 10))
          for (let k = 0; k < 5; k++) this.notes.push({ mesh: this.take('note', makeNote), lane, x: laneX(lane), d: d + 6 + k * 3 });
      }
      const spacing = s.kind === 'market' ? 0.8 : s.kind === 'expressway' || s.kind === 'bridge' ? 1.15 : 1;
      this.spawnD += (rand(28, 50, rng) - 12 * env.difficulty) * spacing;
    }
  }

  private addHazard(kind: HazardKind, lane: number, d: number): void {
    const size = SIZE[kind];
    this.hazards.push({ kind, mesh: this.take(`h:${kind}`, HAZARD_FACTORY[kind]), lane, x: laneX(lane), y: 0, d, w: size.w, l: size.l, hit: false, flung: false, flungT: 0, vx: 0, vy: 0, spin: 0 });
  }

  private spawnWalkers(env: TrafficEnv): void {
    while (this.walkerD < env.dist + 210) {
      const d = this.walkerD;
      const s = env.stretchAt(d);
      const nightCut = 1 - env.dark * 0.5;
      const pedChance = (s.kind === 'market' ? 0.5 : s.kind === 'city' ? 0.12 : 0) * env.pedestrianMult * nightCut;
      const hawkChance = (s.kind === 'market' ? 0.45 : s.kind === 'city' ? 0.08 : 0) * env.hawkerMult;
      if (Math.random() < pedChance && !env.kerbReserved(d)) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const mesh = this.take('w:pedestrian', () => makeFigure('walker'));
        this.walkers.push({ kind: 'pedestrian', mesh, x: side * (KERB_X + 1.2), d, fromX: side * (KERB_X + 1.2), toX: -side * (KERB_X + 1.2), walking: false, triggerAt: rand(35, 70), hurry: 1, dodge: 0, sold: false, scared: false, t: Math.random() * 5 });
      }
      if (Math.random() < hawkChance) {
        const line = pick([0, 1, 2]);
        const x = laneX(line) + 1.6;
        const mesh = this.take('w:hawker', () => makeFigure('hawker'));
        this.walkers.push({ kind: 'hawker', mesh, x, d: d + 10, fromX: x, toX: x, walking: false, triggerAt: 0, hurry: 1, dodge: 0, sold: false, scared: false, t: Math.random() * 5 });
      }
      this.walkerD += rand(25, 45);
    }
  }

  /** Okadas and kekes ahead in `lane` swerve away; pedestrians hurry. Returns how many vehicles moved. */
  honk(dist: number, lane: number, env: TrafficEnv): number {
    let moved = 0;
    for (const v of this.vehicles) {
      if (v.flung || v.cross || (v.kind !== 'okada' && v.kind !== 'keke')) continue;
      const ahead = v.d - dist;
      if (ahead < 3 || ahead > 40 || v.lane !== lane) continue;
      const brt = env.stretchAt(v.d).brt;
      const options = [v.lane - 1, v.lane + 1].filter((l) => l >= 0 && l < LANES && !(brt && l === 0) && this.laneFree(l, v.d, 9, v));
      if (options.length > 0) {
        v.lane = pick(options);
        moved++;
      }
    }
    for (const w of this.walkers) if (w.kind === 'pedestrian' && w.d - dist > 0 && w.d - dist < 55) w.hurry = 2.6;
    return moved;
  }

  update(dt: number, env: TrafficEnv): void {
    if (env.playing) {
      this.spawnTraffic(env);
      this.spawnWalkers(env);
    }
    const D = env.dist;
    const stopLines = env.stopLines();
    const slow = env.slowZones();
    const byLane: Vehicle[][] = [[], [], [], []];
    for (const v of this.vehicles) if (!v.flung && !v.cross) byLane[v.lane]?.push(v);
    const walkersInLane = (lane: number): Walker[] => this.walkers.filter((w) => w.kind === 'pedestrian' && w.walking && Math.abs(w.x - laneX(lane)) < 1.5);

    byLane.forEach((list, lane) => {
      list.sort((a, b) => b.d - a.d);
      let leader: Vehicle | null = null;
      const peds = walkersInLane(lane);
      for (const v of list) {
        const s = env.stretchAt(v.d);
        let limit = Number.POSITIVE_INFINITY;
        if (leader) limit = leader.d - (leader.l + v.l) / 2 - 2.5;
        for (const line of stopLines) if (v.d < line && line - v.d < 130) limit = Math.min(limit, line - v.l / 2 - 1);
        for (const h of this.hazards) if (h.kind === 'barrier' && !h.flung && h.lane === lane && h.d > v.d) limit = Math.min(limit, h.d - v.l / 2 - 2.5);
        for (const p of peds) if (p.d > v.d) limit = Math.min(limit, p.d - v.l / 2 - 2);
        const ai = v.driver !== 'traffic';
        const you = env.player;
        if (ai && you.d > v.d && Math.abs(you.x - laneX(lane)) < 2) limit = Math.min(limit, you.d - (you.l + v.l) / 2 - 1.5);
        let desired = v.broken ? 0 : ai ? v.aim : this.laneSpeed(lane, s, v.kind);
        for (const z of slow) if (v.d > z.from && v.d < z.to) desired = Math.min(desired, z.speed);
        const gap = limit - v.d;
        const follow = gap <= 0 ? 0 : Math.min(desired, gap * 1.1);
        v.v += clamp(follow - v.v, -(ai ? 14 : 9) * dt, v.accel * dt);
        if (v.v < 0) v.v = 0;
        v.d = Math.min(v.d + v.v * dt, Math.max(v.d, limit));
        v.laneCooldown = Math.max(0, v.laneCooldown - dt);
        if (!ai && !v.broken && !v.behind && v.laneCooldown <= 0 && gap < 14 && desired - follow > 2) {
          const options = [lane - 1, lane + 1].filter(
            (l) => l >= 0 && l < LANES && !(s.brt && l === 0 && v.kind !== 'brt') && !(l === KERB && env.kerbReserved(v.d)) && this.laneFree(l, v.d, 10, v),
          );
          if (options.length > 0) {
            v.lane = pick(options);
            v.laneCooldown = 3;
          } else v.laneCooldown = 1;
        }
        leader = v;
      }
    });

    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      if (!v) continue;
      if (v.flung) {
        if (this.moveFlung(v, dt)) {
          this.removeVehicle(i);
          continue;
        }
      } else if (v.cross) {
        v.x += v.vx * dt;
      } else {
        v.x += (laneX(v.lane) - v.x) * Math.min(1, dt * v.steer);
      }
      v.mesh.position.set(v.x, v.y, -(v.d - D));
      const kerbExit = v.driver === 'traffic' && !v.flung && !v.cross && v.lane === KERB && env.kerbReserved(v.d) && v.d > D + 20;
      // A BRT bus chasing the player and a rival danfo get a longer leash; the game retires a rival that gets away.
      const tooFarBehind = v.d < D - (v.behind || v.driver === 'rival' ? 150 : 30);
      const tooFarAhead = v.d > D + 340 && v.driver !== 'rival';
      const outside = env.span ? v.d < env.span.from || v.d > env.span.to : tooFarBehind || tooFarAhead;
      if (outside || (v.cross && Math.abs(v.x) > 46) || kerbExit) this.removeVehicle(i);
    }

    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      if (!h) continue;
      if (h.flung && this.moveFlung(h, dt)) {
        this.give(`h:${h.kind}`, h.mesh);
        this.hazards.splice(i, 1);
        continue;
      }
      h.mesh.position.set(h.x, h.y, -(h.d - D));
      if (h.d < D - 25) {
        this.give(`h:${h.kind}`, h.mesh);
        this.hazards.splice(i, 1);
      }
    }

    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      if (!n) continue;
      n.mesh.rotation.y += dt * 3;
      n.mesh.position.set(n.x, Math.sin(n.d * 0.7 + D * 0.05) * 0.12, -(n.d - D));
      if (n.d < D - 15) this.removeNote(i);
    }

    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const w = this.walkers[i];
      if (!w) continue;
      w.t += dt;
      if (w.kind === 'pedestrian') {
        if (!w.walking && w.d - D < w.triggerAt) w.walking = true;
        if (w.walking && w.dodge <= 0) {
          const dir = Math.sign(w.toX - w.x);
          const step = 1.3 * w.hurry * dt;
          if (Math.abs(w.toX - w.x) <= step) {
            w.x = w.toX;
            w.walking = false;
            w.triggerAt = -1e9;
          } else w.x += dir * step;
          w.mesh.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
        }
      }
      if (w.dodge > 0) {
        w.dodge -= dt;
        w.x += Math.sign(w.fromX - w.x || 1) * 6 * dt;
      }
      const hop = w.dodge > 0 ? Math.sin(w.dodge * 9) * 0.5 : w.walking ? Math.abs(Math.sin(w.t * 9)) * 0.06 : 0;
      w.mesh.position.set(w.x, Math.max(0, hop) + (Math.abs(w.x) > KERB_X ? 0.15 : 0), -(w.d - D));
      if (w.kind === 'hawker') w.mesh.rotation.y = Math.sin(w.t * 0.8) * 0.6;
      if (w.d < D - 20) {
        this.give(`w:${w.kind}`, w.mesh);
        this.walkers.splice(i, 1);
      }
    }
  }

  private moveFlung(o: Flingable, dt: number): boolean {
    o.flungT += dt;
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    o.vy -= 20 * dt;
    if (o.y < 0) {
      o.y = 0;
      o.vy *= -0.3;
      o.vx *= 0.6;
    }
    o.mesh.rotation.y += o.spin * dt;
    o.mesh.rotation.z += o.spin * 0.3 * dt;
    return o.flungT > 1.8;
  }

  /** Knock something out of the way after a crash. */
  fling(o: Vehicle | Hazard, fromX: number): void {
    o.flung = true;
    o.flungT = 0;
    o.vx = (o.x >= fromX ? 1 : -1) * rand(5, 9);
    o.vy = rand(5, 8);
    o.spin = rand(-6, 6);
  }

  removeVehicle(i: number): void {
    const v = this.vehicles[i];
    if (!v) return;
    this.give(v.key, v.mesh);
    this.vehicles.splice(i, 1);
  }

  removeNote(i: number): void {
    const n = this.notes[i];
    if (!n) return;
    this.give('note', n.mesh);
    this.notes.splice(i, 1);
  }
}
