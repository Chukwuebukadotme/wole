// The player's vehicle: model, wheels, door and a little suspension life.
import * as THREE from 'three';
import { PLAYER_PAINT, type VehicleDef } from '../config/vehicles.ts';
import { satin } from '../art/materials.ts';
import { Shape } from '../art/kit.ts';
import { stickerTexture } from '../art/textures.ts';
import { vehicleParts, wheelShape, type DoorSpec } from '../art/vehicles.ts';

const STICKERS = ['NO CONDITION IS PERMANENT', 'GOD DEY', 'NO TELL MY FATHER', 'OYA ENTER', 'EKO O NI BAJE'];

/** What the vehicle is doing this frame, for the body's motion. */
export interface Motion {
  /** Forward speed, m/s. */
  readonly speed: number;
  /** Sideways speed and acceleration (lane changes), m/s and m/s². */
  readonly vx: number;
  readonly ax: number;
  /** Forward acceleration, m/s² (negative when braking). */
  readonly accel: number;
  readonly doorOpen: boolean;
  readonly reduceMotion: boolean;
}

/** Damped spring towards a target: returns the new value and velocity. */
function spring(value: number, vel: number, target: number, stiffness: number, damping: number, dt: number): [number, number] {
  const v = vel + (stiffness * (target - value) - damping * vel) * dt;
  return [value + v * dt, v];
}

export class PlayerVehicle {
  /** Positioned on the road and turned with the vehicle's heading. */
  readonly group = new THREE.Group();
  /** Body, door and sticker: pitches, rolls and bounces on the suspension above the wheels. */
  private readonly rig = new THREE.Group();
  /** Wheels stay on the road; front ones steer. */
  private wheels: { pivot: THREE.Group; mesh: THREE.Mesh; r: number; front: boolean }[] = [];
  private door: { mesh: THREE.Mesh; spec: DoorSpec } | null = null;
  private doorOpen = 0;
  private heave = 0;
  private heaveV = 0;
  private pitch = 0;
  private pitchV = 0;
  private roll = 0;
  private rollV = 0;
  private yaw = 0;
  def: VehicleDef | null = null;

  constructor() {
    this.group.add(this.rig);
  }

  /** Swap in a vehicle; `side` is the kerb side for the passenger door. */
  build(def: VehicleDef, side: -1 | 1, sticker = 0): void {
    for (const c of [...this.group.children]) if (c !== this.rig) this.group.remove(c);
    for (const c of [...this.rig.children]) {
      this.rig.remove(c);
      if (c instanceof THREE.Mesh) c.geometry.dispose();
    }
    this.def = def;
    const parts = vehicleParts(def.id, PLAYER_PAINT[def.id], side, 0);
    const body = new THREE.Mesh(parts.body.build(), satin());
    body.castShadow = true;
    body.receiveShadow = true;
    this.rig.add(body);
    this.wheels = parts.wheels.map((w) => {
      const pivot = new THREE.Group();
      pivot.position.set(w.x, w.r, w.z);
      const mesh = new THREE.Mesh(wheelShape(w.r, w.w).build(), satin());
      // Spin about the axle first, then steer about the vertical.
      mesh.rotation.order = 'YXZ';
      mesh.castShadow = true;
      pivot.add(mesh);
      this.group.add(pivot);
      return { pivot, mesh, r: w.r, front: w.z < -0.2 };
    });
    this.door = null;
    if (parts.door) {
      const mesh = new THREE.Mesh(parts.door.shape.build(), satin());
      mesh.position.set(parts.door.x, parts.door.y, parts.door.z);
      mesh.castShadow = true;
      this.rig.add(mesh);
      this.door = { mesh, spec: parts.door };
    }
    if (parts.sticker) {
      const tex = stickerTexture(STICKERS[sticker % STICKERS.length] ?? STICKERS[0] ?? '');
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(parts.sticker.w, parts.sticker.h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, transparent: true }));
      plate.position.set(0, parts.sticker.y, parts.sticker.z);
      this.rig.add(plate);
    }
    this.doorOpen = 0;
    this.heave = this.heaveV = this.pitch = this.pitchV = this.roll = this.rollV = this.yaw = 0;
  }

  /** Jolt the suspension (a bump or a hit); bigger numbers bounce harder. */
  kick(strength: number): void {
    this.heaveV -= strength;
    this.pitchV -= strength * 0.06;
  }

  /** Animate one frame from the vehicle's motion. Heavier vehicles move more slowly on softer springs. */
  update(dt: number, m: Motion): void {
    const heavy = this.def?.style === 'bus' ? 1 : 0;
    // Wheels turn with the distance travelled; front wheels steer into lane changes.
    const heading = Math.max(-0.18, Math.min(0.18, -Math.atan2(m.vx, Math.max(6, m.speed))));
    this.yaw += (heading * 0.75 - this.yaw) * Math.min(1, dt * 10);
    this.group.rotation.y = this.yaw;
    const steer = Math.max(-0.4, Math.min(0.4, heading * 2.4));
    for (const w of this.wheels) {
      w.mesh.rotation.x -= (m.speed * dt) / w.r;
      w.mesh.rotation.y = w.front ? steer : 0;
    }
    if (m.reduceMotion) {
      this.rig.rotation.set(0, 0, 0);
      this.rig.position.y = 0;
    } else {
      // Nose dives under braking and squats under power; the body leans out of lane changes; springs settle it.
      const pitchTarget = Math.max(-0.05, Math.min(0.03, m.accel * (heavy ? 0.0055 : 0.0042)));
      const rollTarget = Math.max(-0.07, Math.min(0.07, m.ax * (heavy ? 0.016 : 0.011)));
      const k = heavy ? 55 : 90;
      const c = heavy ? 9 : 13;
      [this.pitch, this.pitchV] = spring(this.pitch, this.pitchV, pitchTarget, k, c, dt);
      [this.roll, this.rollV] = spring(this.roll, this.rollV, rollTarget, k, c, dt);
      [this.heave, this.heaveV] = spring(this.heave, this.heaveV, 0, heavy ? 70 : 110, heavy ? 8 : 11, dt);
      this.rig.rotation.set(this.pitch, 0, this.roll);
      // A faint road rumble at speed.
      const rumble = Math.sin(performance.now() * 0.031) * 0.003 * Math.min(1, m.speed / 12);
      this.rig.position.y = this.heave + rumble;
    }
    this.doorOpen += ((m.doorOpen ? 1 : 0) - this.doorOpen) * Math.min(1, dt * 5);
    const d = this.door;
    if (d) {
      if (d.spec.kind === 'slide') {
        d.mesh.position.z = d.spec.z + this.doorOpen * 1.0;
        d.mesh.position.x = d.spec.x + d.spec.side * this.doorOpen * 0.12;
      } else d.mesh.rotation.y = d.spec.side * this.doorOpen * 1.0;
    }
  }

  /** How far open the door is, 0–1 (passengers wait for it). */
  get doorAmount(): number {
    return this.doorOpen;
  }

  /** Length and height for camera framing. */
  get size(): { l: number; h: number; w: number } {
    return { l: this.def?.l ?? 4.4, h: this.def?.h ?? 1.5, w: this.def?.w ?? 1.8 };
  }
}

/** A merged copy of a player vehicle for menus and thumbnails. */
export function vehicleShape(def: VehicleDef, side: -1 | 1): Shape {
  const parts = vehicleParts(def.id, PLAYER_PAINT[def.id], side, 0);
  const s = new Shape().merge(parts.body);
  for (const w of parts.wheels) s.merge(wheelShape(w.r, w.w), { x: w.x, y: w.r, z: w.z });
  if (parts.door) s.merge(parts.door.shape, { x: parts.door.x, y: parts.door.y, z: parts.door.z });
  return s;
}
