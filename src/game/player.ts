// The player's vehicle: model, wheels, door and a little suspension life.
import * as THREE from 'three';
import { PLAYER_PAINT, type VehicleDef } from '../config/vehicles.ts';
import { satin } from '../art/materials.ts';
import { Shape } from '../art/kit.ts';
import { stickerTexture } from '../art/textures.ts';
import { vehicleParts, wheelShape, type DoorSpec } from '../art/vehicles.ts';

const STICKERS = ['NO CONDITION IS PERMANENT', 'GOD DEY', 'NO TELL MY FATHER', 'OYA ENTER', 'EKO O NI BAJE'];

export class PlayerVehicle {
  readonly group = new THREE.Group();
  /** Body, wheels and door; tilts and bounces inside the group. */
  private readonly rig = new THREE.Group();
  private wheels: { mesh: THREE.Mesh; r: number }[] = [];
  private door: { mesh: THREE.Mesh; spec: DoorSpec } | null = null;
  private doorOpen = 0;
  private bob = 0;
  private bobV = 0;
  private pitch = 0;
  def: VehicleDef | null = null;

  constructor() {
    this.group.add(this.rig);
  }

  /** Swap in a vehicle; `side` is the kerb side for the passenger door. */
  build(def: VehicleDef, side: -1 | 1, sticker = 0): void {
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
      const mesh = new THREE.Mesh(wheelShape(w.r, w.w).build(), satin());
      mesh.position.set(w.x, w.r, w.z);
      mesh.castShadow = true;
      this.rig.add(mesh);
      return { mesh, r: w.r };
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
    this.bob = 0;
    this.bobV = 0;
  }

  /** Jolt the suspension; bigger numbers bounce harder. */
  kick(strength: number): void {
    this.bobV -= strength;
  }

  /**
   * Animate for one frame.
   * `lean` is sideways speed (for body roll), `accel` the change in speed (for pitch), `open` whether the door is open.
   */
  update(dt: number, speed: number, lean: number, accel: number, open: boolean, still: boolean): void {
    for (const w of this.wheels) w.mesh.rotation.x -= (speed * dt) / w.r;
    const roll = Math.max(-0.07, Math.min(0.07, -lean * 0.012));
    this.rig.rotation.z += (roll - this.rig.rotation.z) * Math.min(1, dt * 8);
    const targetPitch = Math.max(-0.035, Math.min(0.05, -accel * 0.006));
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 6);
    this.rig.rotation.x = this.pitch;
    this.bobV += (-110 * this.bob - 10 * this.bobV) * dt;
    this.bob += this.bobV * dt;
    // A gentle idle rumble when moving, unless motion is reduced.
    const rumble = still ? 0 : Math.sin(performance.now() * 0.03) * 0.004 * Math.min(1, speed / 10);
    this.rig.position.y = this.bob + rumble;
    this.doorOpen += ((open ? 1 : 0) - this.doorOpen) * Math.min(1, dt * 6);
    const d = this.door;
    if (d) {
      if (d.spec.kind === 'slide') {
        d.mesh.position.z = d.spec.z + this.doorOpen * 1.0;
        d.mesh.position.x = d.spec.x + d.spec.side * this.doorOpen * 0.12;
      } else d.mesh.rotation.y = d.spec.side * this.doorOpen * 1.0;
    }
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
