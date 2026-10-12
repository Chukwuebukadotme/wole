// People who move: passengers waiting at stops, walking to the door and stepping in, stepping off and walking away.
// Legs and arms swing in the vertex shader; the stride is driven by distance walked, so feet do not slide.
import * as THREE from 'three';
import type { CityId } from '../config/cities.ts';
import { crowdLooks, makePerson } from '../art/people.ts';
import { peopleMaterial } from '../art/surfaces.ts';
import { Scatter, type Handle } from '../world/scatter.ts';

/** A place to walk to; `y` lifts them (stepping up into a vehicle). */
export interface Waypoint {
  readonly x: number;
  readonly d: number;
  readonly y?: number;
}

export interface Person {
  readonly look: number;
  x: number;
  d: number;
  y: number;
  /** Facing angle (0 faces down the road, away from the camera). */
  ry: number;
  /** Where they are walking, in order. */
  path: Waypoint[];
  /** Walking speed, m/s. */
  speed: number;
  /** Waving at an arriving vehicle (eased in and out). */
  wave: boolean;
  waveAmount: number;
  /** Stride phase in radians: advances with distance walked. */
  stride: number;
  /** How far the legs swing, eased between standing and walking. */
  swing: number;
  /** Idle breathing phase. */
  breath: number;
  handle: Handle | null;
  /** Called once when the last waypoint is reached. */
  arrive: (() => void) | null;
}

/** Metres per full stride cycle (two steps), so the legs match the ground speed. */
const STRIDE = 1.35;
const PAVEMENT_Y = 0.16;

const tmp = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const p = new THREE.Vector3();
const s = new THREE.Vector3(1, 1, 1);

export class Crowd {
  private readonly scatter = new Scatter();
  readonly people: Person[] = [];
  private city: CityId | null = null;
  looks = 0;

  constructor(world: THREE.Group) {
    world.add(this.scatter.group);
  }

  setCity(city: CityId): void {
    if (this.city === city) return;
    this.clear();
    this.scatter.dispose();
    const looks = crowdLooks(city, 12);
    looks.forEach((look, i) => this.scatter.kind(`p${i}`, makePerson(look).build(), peopleMaterial(), 40, 'cast', false, true));
    this.looks = looks.length;
    this.city = city;
  }

  add(look: number, x: number, d: number, ry = 0, y = PAVEMENT_Y): Person {
    const person: Person = {
      look: look % Math.max(1, this.looks),
      x,
      d,
      y,
      ry,
      path: [],
      speed: 1.35,
      wave: false,
      waveAmount: 0,
      stride: Math.random() * 6,
      swing: 0,
      breath: Math.random() * 6,
      handle: null,
      arrive: null,
    };
    person.handle = this.scatter.place(`p${person.look}`, this.matrix(person, 0));
    this.people.push(person);
    return person;
  }

  /** Send someone along a path; `arrive` runs when they get to the end. */
  walk(person: Person, path: Waypoint[], speed: number, arrive: (() => void) | null = null): void {
    person.path = path;
    person.speed = speed;
    person.arrive = arrive;
  }

  remove(person: Person): void {
    if (person.handle) this.scatter.remove(person.handle);
    person.handle = null;
    const i = this.people.indexOf(person);
    if (i >= 0) this.people.splice(i, 1);
  }

  clear(): void {
    for (const person of [...this.people]) this.remove(person);
  }

  private matrix(person: Person, bob: number): THREE.Matrix4 {
    e.set(0, person.ry, 0);
    q.setFromEuler(e);
    p.set(person.x, person.y + bob, -person.d);
    return tmp.compose(p, q, s);
  }

  update(dt: number, reduceMotion: boolean): void {
    for (const person of [...this.people]) {
      const next = person.path[0];
      let walking = false;
      if (next) {
        const dx = next.x - person.x;
        const dd = next.d - person.d;
        const dist = Math.hypot(dx, dd);
        const step = person.speed * dt;
        if (dist > 0.02) {
          // Turn towards where they are going (0 faces down the road, +d), quickly but not instantly.
          const want = Math.atan2(-dx, dd);
          let turn = want - person.ry;
          turn = Math.atan2(Math.sin(turn), Math.cos(turn));
          person.ry += turn * Math.min(1, dt * 10);
        }
        const moved = Math.min(step, dist);
        if (dist > 1e-4) {
          person.x += (dx / dist) * moved;
          person.d += (dd / dist) * moved;
        }
        if (next.y !== undefined) person.y += (next.y - person.y) * Math.min(1, dt * 8);
        person.stride += (moved / STRIDE) * Math.PI * 2;
        walking = moved > 0;
        if (dist <= step) {
          person.path.shift();
          if (person.path.length === 0) {
            const done = person.arrive;
            person.arrive = null;
            done?.();
            if (!person.handle) continue;
          }
        }
      }
      person.swing += ((walking ? 0.5 : 0.03) - person.swing) * Math.min(1, dt * 8);
      person.waveAmount += ((person.wave && !walking ? 1 : 0) - person.waveAmount) * Math.min(1, dt * 5);
      person.breath += dt * (person.waveAmount > 0.1 ? 6 : 1.6);
      // A small bob on each step while walking; a slow breath when standing.
      const bob = reduceMotion ? 0 : walking ? Math.abs(Math.sin(person.stride)) * 0.035 : Math.sin(person.breath) * 0.006;
      if (!person.handle) continue;
      this.scatter.move(person.handle, this.matrix(person, bob));
      const phase = walking ? person.stride : person.breath;
      this.scatter.animate(person.handle, phase, reduceMotion ? 0 : person.swing, reduceMotion ? 0 : person.waveAmount);
    }
  }
}
