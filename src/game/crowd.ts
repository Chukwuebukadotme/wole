// People who move: passengers waiting at stops, walking to the door, stepping off at their stop.
import * as THREE from 'three';
import type { CityId } from '../config/cities.ts';
import { matte } from '../art/materials.ts';
import { crowdLooks, makePerson } from '../art/people.ts';
import { Scatter, type Handle } from '../world/scatter.ts';

export interface Person {
  readonly look: number;
  x: number;
  d: number;
  /** Facing angle (0 faces down the road, away from the camera). */
  ry: number;
  /** Where they are walking to, if anywhere. */
  target: { x: number; d: number } | null;
  speed: number;
  /** Waving at an arriving vehicle. */
  wave: boolean;
  phase: number;
  handle: Handle | null;
  /** Called once when they reach their target. */
  arrive: (() => void) | null;
}

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
    looks.forEach((look, i) => this.scatter.kind(`p${i}`, makePerson(look).build(), matte(), 40, 'cast'));
    this.looks = looks.length;
    this.city = city;
  }

  add(look: number, x: number, d: number, ry = 0): Person {
    const person: Person = { look: look % Math.max(1, this.looks), x, d, ry, target: null, speed: 1.4, wave: false, phase: Math.random() * 6, handle: null, arrive: null };
    person.handle = this.scatter.place(`p${person.look}`, this.matrix(person, 0));
    this.people.push(person);
    return person;
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
    e.set(0, person.ry, person.wave ? Math.sin(person.phase * 2) * 0.08 : 0);
    q.setFromEuler(e);
    p.set(person.x, 0.16 + bob, -person.d);
    return tmp.compose(p, q, s);
  }

  update(dt: number, reduceMotion: boolean): void {
    for (const person of [...this.people]) {
      person.phase += dt * (person.target ? 9 : person.wave ? 6 : 1.5);
      let bob = 0;
      if (person.target) {
        const dx = person.target.x - person.x;
        const dd = person.target.d - person.d;
        const dist = Math.hypot(dx, dd);
        const step = person.speed * dt;
        // Face the way they walk: 0 is down the road (-z in the world, +d).
        person.ry = Math.atan2(-dx, dd);
        if (dist <= step) {
          person.x = person.target.x;
          person.d = person.target.d;
          person.target = null;
          const done = person.arrive;
          person.arrive = null;
          done?.();
          if (!person.handle) continue;
        } else {
          person.x += (dx / dist) * step;
          person.d += (dd / dist) * step;
        }
        bob = reduceMotion ? 0 : Math.abs(Math.sin(person.phase)) * 0.06;
      } else if (person.wave && !reduceMotion) bob = Math.abs(Math.sin(person.phase)) * 0.12;
      if (person.handle) this.scatter.move(person.handle, this.matrix(person, bob));
    }
  }
}
