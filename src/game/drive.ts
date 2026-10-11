// One drive: the player's speed and lane, money, health, traffic and passenger stops.
import type { AreaDef, CityDef } from '../config/cities.ts';
import type { VehicleDef } from '../config/vehicles.ts';
import { drivePay, fareFor, money, perfectTip, roundMoney } from '../rules/money.ts';
import type { Mode } from '../rules/save.ts';
import { hashString, type Challenge, type DailyDrive, type DriveStats } from '../rules/social.ts';
import { clamp, mulberry32 } from '../rules/util.ts';
import { BAY_X, KERB, LANES, Layout, TILE, type StopPlace } from '../world/layout.ts';
import type { Crowd, Person } from './crowd.ts';
import type { Traffic } from './traffic.ts';

export type Phase = 'countdown' | 'drive' | 'stopped' | 'complete' | 'over';

export interface DriveSetup {
  readonly city: CityDef;
  readonly area: AreaDef;
  readonly mode: Mode;
  readonly passengers: boolean;
  readonly vehicle: VehicleDef;
  readonly seed: number;
  readonly startDist: number;
  readonly daily: DailyDrive | null;
  readonly challenge: Challenge | null;
  /** First drive: teach each action in turn, with light traffic and no damage. */
  readonly tutorial: boolean;
}

/** Message card under the top bar. Yellow for good news and prompts, cream for status. */
export interface Card {
  readonly title: string;
  readonly line: string;
  readonly tone: 'yellow' | 'cream';
}

export type SoundName = 'coin' | 'fare' | 'board' | 'door' | 'crash' | 'whoosh' | 'bell' | 'perfect' | 'complete' | 'over' | 'step';

export interface DriveListener {
  card(card: Card, seconds: number): void;
  pop(text: string, tone: 'good' | 'bad'): void;
  sound(name: SoundName): void;
  damage(reason: string): void;
  /** Coming up to a stop: the conductor or the bus announcement calls its name. */
  shout(stop: string): void;
}

interface Rider {
  readonly destSerial: number;
  readonly destName: string;
  readonly fromSerial: number;
  readonly look: number;
  /** Carried past their stop: they pay half. */
  late: boolean;
}

interface Waiting {
  readonly person: Person;
  readonly destSerial: number;
  readonly destName: string;
}

interface StopVisit {
  readonly stop: StopPlace;
  /** Riders getting off, then people getting on, one at a time. */
  readonly off: Rider[];
  readonly on: Waiting[];
  t: number;
  step: number;
  fares: number;
  perfect: boolean;
  clean: boolean;
}

export interface TutorialStep {
  readonly n: number;
  readonly of: number;
  readonly title: string;
  readonly line: string;
  /** Show LEFT / RIGHT hints on screen. */
  readonly swipeHint: boolean;
}

const SWIPE: TutorialStep = { n: 1, of: 3, title: 'SWIPE LEFT OR RIGHT', line: 'Change lane to avoid traffic.', swipeHint: true };
const HOLD: TutorialStep = { n: 2, of: 3, title: 'HOLD TO SPEED UP', line: 'Hold the road or the Gas button.', swipeHint: false };
const STOP: TutorialStep = { n: 3, of: 3, title: 'STOP IN THE BAY', line: 'Move into the marked bay, then hold Brake.', swipeHint: false };
const BRAKE: TutorialStep = { n: 3, of: 3, title: 'HOLD BRAKE', line: 'Slow down whenever you need to.', swipeHint: false };

export class Drive {
  readonly setup: DriveSetup;
  readonly layout: Layout;
  phase: Phase = 'countdown';
  /** Seconds left on the countdown. */
  count = 3;
  dist: number;
  x: number;
  /** Lane slot: 0–2 are the lanes; 3 is the stopping bay. */
  slot: number;
  speed = 0;
  gas = false;
  brake = false;
  health: number;
  money = 0;
  metres = 0;
  invuln = 0;
  shake = 0;
  riders: Rider[] = [];
  visit: StopVisit | null = null;
  tutorial: TutorialStep | null;
  readonly stats = { delivered: 0, missed: 0, stops: 0, cleanStops: 0, perfectStops: 0, crashes: 0, closePasses: 0 };
  /** Set when the drive is over: why it ended. */
  ended: 'complete' | 'damage' | null = null;
  private readonly served = new Set<string>();
  private readonly waiting = new Map<string, Waiting[]>();
  private sinceDamage = 0;
  private gasTime = 0;
  private laneChanges = 0;
  private prevSpeed = 0;
  private combo = 0;
  private comboT = 0;
  private cardKey = '';
  readonly listener: DriveListener;
  private readonly traffic: Traffic;
  private readonly crowd: Crowd;

  constructor(setup: DriveSetup, traffic: Traffic, crowd: Crowd, listener: DriveListener) {
    this.setup = setup;
    this.traffic = traffic;
    this.crowd = crowd;
    this.listener = listener;
    this.layout = new Layout(setup.area, setup.startDist, setup.mode === 'endless');
    this.dist = this.layout.runStart - 6;
    this.slot = this.kerbSlot;
    this.x = LANES[this.slot] ?? 0;
    this.health = setup.vehicle.health;
    this.tutorial = setup.tutorial ? SWIPE : null;
    if (setup.tutorial) this.slot = 1;
    this.x = LANES[this.slot] ?? 0;
  }

  /** Lane nearest the kerb. */
  get kerbSlot(): number {
    return this.setup.city.side < 0 ? 0 : 2;
  }

  get eco(): CityDef['economy'] {
    return this.setup.city.economy;
  }

  get bayX(): number {
    return this.setup.city.side * BAY_X;
  }

  /** Cruising speed; it creeps up the further an endless drive goes. */
  get cruise(): number {
    const km = this.metres / 1000;
    const ramp = this.setup.mode === 'endless' ? Math.min(0.35, km * 0.04) : 0;
    return this.setup.vehicle.cruise * (1 + ramp);
  }

  /** Traffic density: light while learning, heavier deeper into an endless drive. */
  get density(): number {
    if (this.tutorial) return 0.45;
    const km = this.metres / 1000;
    return this.setup.mode === 'endless' ? Math.min(2.1, 1 + km * 0.12) : 1.1;
  }

  get seats(): number {
    return this.setup.vehicle.seats;
  }

  /** Change lane; the bay can only be entered alongside a bay. */
  steer(dir: -1 | 1): void {
    if (this.phase !== 'drive') return;
    // Slots run left to right: the bay sits left of lane 0 in London and right of lane 2 in Lagos.
    const order = this.setup.city.side < 0 ? [3, 0, 1, 2] : [0, 1, 2, 3];
    const i = order.indexOf(this.slot);
    const next = order[i + dir];
    if (next === undefined) return;
    if (next === 3 && !this.bayAhead()) {
      this.listener.sound('step');
      return;
    }
    this.slot = next;
    this.laneChanges++;
    if (this.tutorial === SWIPE && this.laneChanges >= 2) this.nextTutorial();
  }

  private bayAhead(): StopPlace | null {
    const bay = this.layout.bayAt(this.dist + 4);
    if (!bay) return null;
    return this.dist > bay.at - TILE - 2 && this.dist < bay.at + TILE - 9 ? bay : null;
  }

  private slotX(slot: number): number {
    return slot === 3 ? this.bayX : (LANES[slot] ?? 0);
  }

  start(): void {
    this.phase = 'drive';
    this.listener.sound('bell');
    if (this.tutorial) this.listener.card({ title: this.tutorial.title, line: this.tutorial.line, tone: 'cream' }, 999);
  }

  private nextTutorial(): void {
    const t = this.tutorial;
    if (t === SWIPE) this.tutorial = HOLD;
    else if (t === HOLD) this.tutorial = this.setup.passengers ? STOP : BRAKE;
    else {
      this.tutorial = null;
      this.listener.card({ title: 'YOU’RE READY!', line: 'Every metre earns money. Enjoy the drive.', tone: 'yellow' }, 3.5);
      this.listener.sound('perfect');
      return;
    }
    const n = this.tutorial;
    if (n) this.listener.card({ title: n.title, line: n.line, tone: 'cream' }, 999);
    this.listener.sound('perfect');
  }

  /** Advance one frame. */
  update(dt: number): void {
    if (this.phase === 'countdown') {
      this.count -= dt;
      if (this.count <= 0) this.start();
      return;
    }
    if (this.phase === 'complete' || this.phase === 'over') {
      this.speed = Math.max(0, this.speed - 8 * dt);
      this.dist += this.speed * dt;
      this.traffic.update(dt, this.env());
      return;
    }
    const v = this.setup.vehicle;
    this.invuln = Math.max(0, this.invuln - dt);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    if (this.phase === 'stopped') this.updateVisit(dt);
    else {
      // Speed: brake beats gas; otherwise settle back to cruising speed.
      const cruise = this.cruise;
      if (this.brake) this.speed = Math.max(0, this.speed - v.brake * dt);
      else if (this.gas) this.speed = Math.min(v.top, this.speed + v.accel * dt);
      else if (this.speed < cruise) this.speed = Math.min(cruise, this.speed + v.accel * 0.8 * dt);
      else this.speed = Math.max(cruise, this.speed - 2.2 * dt);
      if (this.gas && !this.brake) {
        this.gasTime += dt;
        if (this.tutorial === HOLD && this.gasTime > 1.2) this.nextTutorial();
      }
      if (this.tutorial === BRAKE && this.brake && this.speed < cruise * 0.5) this.nextTutorial();
      const moved = this.speed * dt;
      this.dist += moved;
      this.metres += moved;
      this.sinceDamage += moved;
      this.money += drivePay(this.eco, moved, this.speed, v.cruise);
      if (this.sinceDamage >= 1000) {
        this.sinceDamage -= 1000;
        this.bonus(this.eco.cleanKm, 'CLEAN KILOMETRE', 'No damage for a whole kilometre.');
      }
      // Leave the bay when it ends.
      if (this.slot === 3 && !this.bayAhead()) this.slot = this.kerbSlot;
      this.checkStop();
    }
    const tx = this.slotX(this.slot);
    this.x += clamp(tx - this.x, -v.steer * dt, v.steer * dt);
    this.traffic.update(dt, this.env());
    this.collide();
    this.closePasses();
    this.passengers();
    if (this.setup.mode === 'route' && this.dist >= this.layout.routeEnd) this.finish('complete');
    this.prevSpeed = this.speed;
  }

  /** Change in speed this frame, for the body's pitch. */
  get accel(): number {
    return this.speed - this.prevSpeed;
  }

  private env(): Parameters<Traffic['update']>[1] {
    const v = this.setup.vehicle;
    return { dist: this.dist, playerX: this.x, playerL: v.l, playerW: v.w, playerV: this.speed, cruise: v.cruise, density: this.density, seed: this.setup.seed };
  }

  private finish(why: 'complete' | 'damage'): void {
    if (this.ended) return;
    this.ended = why;
    this.phase = why === 'complete' ? 'complete' : 'over';
    this.gas = false;
    this.brake = false;
    this.listener.sound(why === 'complete' ? 'complete' : 'over');
  }

  /** End early from the pause menu (counts as a drive, ends without results). */
  quit(): void {
    this.phase = 'over';
  }

  private collide(): void {
    const v = this.setup.vehicle;
    const hit = this.traffic.hitTest(this.dist, this.x, v.w * 0.92, v.l * 0.94);
    if (!hit || this.invuln > 0) return;
    this.traffic.fling(hit, this.x);
    this.invuln = 1.6;
    this.shake = 1;
    this.speed *= 0.35;
    this.combo = 0;
    this.sinceDamage = 0;
    this.listener.sound('crash');
    const name = MODEL_NAMES[hit.model] ?? 'a car';
    // Learning: bumps cost nothing until the lesson is over.
    if (this.tutorial && this.tutorial !== STOP) {
      this.listener.card({ title: 'CAREFUL!', line: `You bumped ${name}. No damage while you learn.`, tone: 'cream' }, 2.5);
      return;
    }
    this.health -= 1;
    this.stats.crashes++;
    this.listener.damage(`You hit ${name}.`);
    if (this.health <= 0) this.finish('damage');
    else this.listener.card({ title: 'VEHICLE DAMAGED', line: this.health === 1 ? 'One more hit ends the drive.' : 'Avoid another collision.', tone: 'cream' }, 2.6);
  }

  private closePasses(): void {
    const v = this.setup.vehicle;
    for (const c of this.traffic.cars) {
      if (c.passed || c.flung) continue;
      if (c.d > this.dist - (v.l + c.l) / 2 + 0.5) continue;
      c.passed = true;
      const gap = Math.abs(c.x - this.x) - (v.w + c.w) / 2;
      if (gap < 0.9 && gap > -0.05 && this.speed > c.v + 4 && this.invuln <= 0) {
        this.combo = Math.min(5, this.combo + 1);
        this.comboT = 3;
        this.stats.closePasses++;
        const pay = this.eco.closePass * this.combo;
        this.money += pay;
        this.listener.pop(`CLOSE PASS${this.combo > 1 ? ` ×${this.combo}` : ''} +${money(this.eco, pay)}`, 'good');
        this.listener.sound('whoosh');
      }
    }
  }

  private bonus(amount: number, title: string, line: string): void {
    this.money += amount;
    this.listener.card({ title: `${title} +${money(this.eco, amount)}`, line, tone: 'yellow' }, 2.4);
    this.listener.sound('coin');
  }

  // ---------- Passengers ----------
  private destinations(stop: StopPlace, rng: () => number): { serial: number; name: string } | null {
    const stops = this.setup.area.stops;
    const n = stops.length;
    const last = this.setup.mode === 'route' ? n - 1 : Infinity;
    const ahead = 1 + Math.floor(rng() * 3);
    const serial = Math.min(stop.serial + ahead, last === Infinity ? stop.serial + ahead : last);
    if (serial <= stop.serial) return null;
    return { serial, name: stops[serial % n]?.name ?? '' };
  }

  /** Waiting groups for stops coming up; riders that miss their stop. */
  private passengers(): void {
    if (!this.setup.passengers) return;
    const side = this.setup.city.side;
    for (const stop of this.layout.stopsIn(this.dist - 40, this.dist + 260)) {
      if (this.waiting.has(stop.key) || this.served.has(stop.key)) continue;
      const rng = mulberry32(hashString(`${this.setup.seed}:${stop.key}`));
      const count = this.setup.mode === 'route' && stop.index === this.setup.area.stops.length - 1 ? 0 : Math.max(1, Math.round(stop.stop.busy * (0.5 + rng() * 0.6)));
      const group: Waiting[] = [];
      for (let i = 0; i < count; i++) {
        const dest = this.destinations(stop, rng);
        if (!dest) continue;
        const person = this.crowd.add(Math.floor(rng() * 40), side * (KERB + 3.4 + 1.2 + rng() * 1.6), stop.at - 4 + rng() * 9, side < 0 ? -Math.PI / 2 : Math.PI / 2);
        group.push({ person, destSerial: dest.serial, destName: dest.name });
      }
      this.waiting.set(stop.key, group);
    }
    // Wave when the vehicle is coming; tidy up stops left behind.
    for (const [key, group] of this.waiting) {
      const at = group[0]?.person.d ?? 0;
      for (const w of group) w.person.wave = this.dist > at - 70 && this.dist < at + 5;
      if (at < this.dist - 80) {
        for (const w of group) this.crowd.remove(w.person);
        this.waiting.delete(key);
      }
    }
    // Riders carried past their stop.
    const next = this.layout.nextStop(this.dist);
    for (const r of this.riders) {
      if (r.late) continue;
      const stopAt = this.stopDistance(r.destSerial);
      if (stopAt !== null && this.dist > stopAt + TILE + 2) {
        r.late = true;
        this.stats.missed++;
        this.listener.card({ title: 'MISSED STOP', line: `A rider wanted ${r.destName}. They’ll get off next stop.`, tone: 'cream' }, 2.6);
        this.listener.sound('step');
      }
    }
    // Approach prompt.
    if (next && !this.served.has(next.key) && this.phase === 'drive') {
      const ahead = next.at - this.dist;
      const off = this.riders.some((r) => r.late || r.destSerial === next.serial);
      const group = this.waiting.get(next.key) ?? [];
      const room = this.seats - this.riders.length;
      if ((off || (group.length > 0 && room > 0)) && ahead < 170 && ahead > -TILE) {
        const key = `${next.key}:${this.slot === 3 ? 'in' : 'ahead'}`;
        if (this.cardKey !== key) {
          if (!this.cardKey.startsWith(next.key)) this.listener.shout(next.stop.name);
          this.cardKey = key;
          const where = ahead > 12 ? `STOP AHEAD / ${Math.max(10, Math.round(ahead / 10) * 10)} m` : 'STOP HERE';
          this.listener.card(this.slot === 3 ? { title: 'IN THE BAY', line: 'Hold Brake to stop by the shelter.', tone: 'yellow' } : { title: where, line: 'Move into the bay and hold Brake.', tone: 'yellow' }, 4);
        }
      }
    }
  }

  /** Absolute distance of a stop by serial number. */
  private stopDistance(serial: number): number | null {
    const n = this.setup.area.stops.length;
    const lap = Math.floor(serial / n);
    const off = this.setup.area.stops[serial % n];
    if (!off) return null;
    return this.layout.runStart + lap * this.layout.lap + Math.round(off.at / TILE) * TILE;
  }

  /** Stopped in a bay: start a visit. */
  private checkStop(): void {
    if (this.slot !== 3 || this.speed > 0.4 || !this.setup.passengers) return;
    const bay = this.layout.bayAt(this.dist);
    if (!bay || this.served.has(bay.key)) return;
    if (Math.abs(this.dist - bay.at) > 17) return;
    this.served.add(bay.key);
    this.speed = 0;
    const off = this.riders.filter((r) => r.late || r.destSerial <= bay.serial);
    this.riders = this.riders.filter((r) => !off.includes(r));
    const group = this.waiting.get(bay.key) ?? [];
    const room = this.seats - this.riders.length;
    const on = group.slice(0, Math.max(0, room));
    this.waiting.set(bay.key, group.slice(on.length));
    this.visit = { stop: bay, off, on, t: 0, step: 0, fares: 0, perfect: Math.abs(this.dist - bay.at) <= 4, clean: this.sinceDamage > 150 };
    this.stats.stops++;
    if (this.visit.clean) this.stats.cleanStops++;
    this.phase = 'stopped';
    this.brake = false;
    this.listener.sound('door');
    const n = on.length;
    this.listener.card(
      n > 0 ? { title: `BOARDING / ${n} RIDER${n === 1 ? '' : 'S'}`, line: 'Stopped safely. Doors opening.', tone: 'cream' } : { title: 'DOORS OPENING', line: off.length ? 'Passengers getting off.' : 'Nobody waiting here.', tone: 'cream' },
      2.5,
    );
  }

  /** Progress of the current stop, 0–1, for the boarding bar. */
  get visitProgress(): number {
    const v = this.visit;
    if (!v) return 0;
    const total = v.off.length + v.on.length + 1;
    return clamp(v.step / total, 0, 1);
  }

  private updateVisit(dt: number): void {
    const v = this.visit;
    if (!v) {
      this.phase = 'drive';
      return;
    }
    v.t += dt;
    const side = this.setup.city.side;
    const veh = this.setup.vehicle;
    const doorX = side * (Math.abs(this.x) + veh.w / 2 + 0.4);
    const doorD = this.dist + veh.l * 0.3;
    const pace = 0.5;
    const total = v.off.length + v.on.length;
    while (v.t >= pace * (v.step + 1) && v.step < total) {
      if (v.step < v.off.length) {
        const r = v.off[v.step];
        if (r) {
          const stops = Math.max(1, v.stop.serial - r.fromSerial);
          const fare = roundMoney(this.eco, fareFor(this.eco, stops, veh.fareMult) * (r.late ? 0.5 : 1));
          this.money += fare;
          v.fares += fare;
          this.stats.delivered++;
          this.listener.pop(`+${money(this.eco, fare)}`, 'good');
          this.listener.sound('fare');
          const person = this.crowd.add(r.look, doorX, doorD);
          person.target = { x: side * (KERB + 3.4 + 2.6), d: doorD + 3 + Math.random() * 6 };
          person.arrive = () => this.crowd.remove(person);
        }
      } else {
        const w = v.on[v.step - v.off.length];
        if (w) {
          w.person.wave = false;
          w.person.speed = 2.2;
          w.person.target = { x: doorX, d: doorD };
          const rider: Rider = { destSerial: w.destSerial, destName: w.destName, fromSerial: v.stop.serial, look: w.person.look, late: false };
          w.person.arrive = () => this.crowd.remove(w.person);
          this.riders.push(rider);
          this.listener.sound('board');
        }
      }
      v.step++;
    }
    const waitWalk = v.on.length ? 1.2 : 0.4;
    if (v.step >= total && v.t > pace * total + waitWalk) {
      // Done: perfect-stop tip, delivery card, then pull away.
      if (v.fares > 0) {
        if (v.perfect) {
          const tip = perfectTip(this.eco, v.fares);
          this.money += tip;
          this.stats.perfectStops++;
          this.listener.card({ title: `PERFECT STOP +${money(this.eco, tip)}`, line: `Tip on +${money(this.eco, v.fares)} in fares.`, tone: 'yellow' }, 2.6);
          this.listener.sound('perfect');
        } else this.listener.card({ title: 'PASSENGERS DELIVERED', line: `+${money(this.eco, v.fares)} / added to your earnings`, tone: 'yellow' }, 2.6);
      } else if (v.perfect) {
        this.stats.perfectStops++;
        this.listener.card({ title: 'PERFECT STOP', line: 'Right by the shelter. Nice braking.', tone: 'yellow' }, 2.2);
      }
      this.visit = null;
      this.phase = 'drive';
      this.listener.sound('door');
      if (this.tutorial === STOP) this.nextTutorial();
    }
  }

  /** Next stop a rider is going to (or the next stop), for the top bar. */
  get nextName(): string {
    if (this.riders.length) {
      const soonest = this.riders.reduce((a, b) => (b.destSerial < a.destSerial ? b : a));
      return soonest.destName;
    }
    const next = this.layout.nextStop(this.dist + 20);
    if (!next) return 'ROUTE END';
    if (this.setup.mode === 'route' && next.at >= this.layout.routeEnd) return 'ROUTE END';
    return next.stop.name;
  }

  /** Metres left to the finish in route mode. */
  get toFinish(): number {
    return Math.max(0, this.layout.routeEnd - this.dist);
  }

  /** Everything the results screen and advice need. */
  driveStats(): DriveStats {
    return {
      passengers: this.setup.passengers,
      delivered: this.stats.delivered,
      missed: this.stats.missed,
      stops: this.stats.stops,
      perfectStops: this.stats.perfectStops,
      crashes: this.stats.crashes,
      closePasses: this.stats.closePasses,
      ended: this.ended === 'complete' ? 'complete' : this.ended === 'damage' ? 'damage' : 'quit',
    };
  }

  /** Remove waiting people (drive over). */
  dispose(): void {
    for (const group of this.waiting.values()) for (const w of group) this.crowd.remove(w.person);
    this.waiting.clear();
  }
}

/** How a crash names the other vehicle. */
const MODEL_NAMES: Readonly<Record<string, string>> = {
  doubledecker: 'a double-decker',
  blackcab: 'a black cab',
  hatchback: 'a hatchback',
  sedan: 'a car',
  suv: 'an SUV',
  motorbike: 'a motorcycle',
  danfo: 'a danfo',
  taxi: 'a taxi',
  keke: 'a keke',
  okada: 'an okada',
  van: 'a van',
  brt: 'a BRT bus',
};
