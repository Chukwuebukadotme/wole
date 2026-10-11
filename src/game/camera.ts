// Chase camera framed per vehicle: the whole vehicle sits in the lower middle of the screen, above the controls,
// whether it is a double-decker or a motorbike. Also the home showcase and the garage orbit.
import * as THREE from 'three';
import { clamp, lerp } from '../rules/util.ts';

export type CameraMode = 'drive' | 'home' | 'garage';

export interface Framing {
  readonly x: number;
  readonly l: number;
  readonly h: number;
  /** 0–1 share of top speed, for the speed-up effect. */
  readonly rush: number;
  readonly shake: number;
}

export class ChaseCamera {
  mode: CameraMode = 'home';
  private x = 0;
  private fov = 60;
  private orbit = 0.6;
  private readonly look = new THREE.Vector3();
  reduceMotion = false;

  /** Jump straight to the target framing (no easing), e.g. at the start of a drive. */
  snap(cam: THREE.PerspectiveCamera, f: Framing): void {
    this.x = f.x;
    this.update(cam, 1, f, true);
  }

  update(cam: THREE.PerspectiveCamera, dt: number, f: Framing, snap = false): void {
    const portrait = cam.aspect < 0.85;
    const scale = Math.max(f.l * 0.52, f.h * 1.55, 3.1);
    // On wide screens the menus take the right-hand side, so menu shots put the vehicle left of centre.
    const side = cam.aspect > 1.25 && this.mode !== 'drive' ? Math.min(5, scale * 0.9) : 0;
    const k = snap ? 1 : Math.min(1, dt * 4);
    this.x = lerp(this.x, f.x, snap ? 1 : Math.min(1, dt * 3.5));
    let baseFov: number;
    if (this.mode === 'garage') {
      // A slow swing around the front three-quarter view, staying over the road and clear of the shops.
      this.orbit += dt * 0.3;
      const a = 0.55 + Math.sin(this.orbit) * 0.35;
      const r = scale * (portrait ? 2.4 : 2.0) + 2.5;
      cam.position.set(f.x - Math.sin(a) * Math.min(r, 9.5), scale * 0.75 + 1.4, -Math.cos(a) * r);
      // The camera faces back towards the screen here, so the sideways shift is reversed.
      this.look.set(f.x - side, f.h * (portrait ? 0.1 : 0.45), portrait ? 1.5 : 0);
      baseFov = portrait ? 60 : 45;
    } else if (this.mode === 'home') {
      // The kit's home shot: behind the vehicle, which stands in the middle of the screen above the menu.
      const back = scale * 2.3 + 4;
      const up = scale * 0.95 + 2.2;
      cam.position.set(this.x * 0.82 + side * 0.4, up, back);
      // Aim a little below and beyond the vehicle so it sits just above the middle of the screen.
      this.look.set(this.x * 0.82 + side, portrait ? -1.0 : 0.2, portrait ? -f.l * 0.2 : -(scale * 1.6 + 6));
      baseFov = portrait ? 66 : 50;
    } else {
      const back = scale * 2.45 + 3.6;
      const up = scale * 1.12 + 2.3;
      cam.position.set(this.x * 0.86, up, back);
      this.look.set(this.x * 0.9, f.h * 0.35, -(scale * 2.1 + 7));
      // Keep the three lanes in view on narrow phones.
      const minHFov = 44;
      const fromH = (2 * Math.atan(Math.tan((minHFov * Math.PI) / 360) / cam.aspect) * 180) / Math.PI;
      baseFov = clamp(portrait ? Math.max(68, fromH) : 55, 50, 82);
    }
    const target = baseFov + (this.reduceMotion ? 0 : f.rush * 7);
    this.fov = snap ? target : this.fov + (target - this.fov) * k;
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
    if (f.shake > 0 && !this.reduceMotion) {
      const s = f.shake * 0.35;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
    }
    cam.lookAt(this.look);
  }
}
