// Soft contact shadows: a dark, blurred ellipse under each vehicle, person and tree. They ground things everywhere,
// including beyond the sun's shadow map, and all of them draw in one call.
import * as THREE from 'three';

let shadowTexture: THREE.CanvasTexture | null = null;

/** Radial falloff, darkest in the middle. */
export function blobTexture(): THREE.CanvasTexture {
  if (shadowTexture) return shadowTexture;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.85)');
    grad.addColorStop(0.45, 'rgba(0,0,0,0.6)');
    grad.addColorStop(0.8, 'rgba(0,0,0,0.18)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  shadowTexture = new THREE.CanvasTexture(c);
  return shadowTexture;
}

/** Material for contact shadows: darkens what is under it without writing depth. */
export function blobMaterial(opacity = 0.42): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity, color: 0x1a1e28, polygonOffset: true, polygonOffsetFactor: -2 });
}

/** Ground plane of 1 × 1 m facing up. */
export const blobGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const p = new THREE.Vector3();
const sc = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

/** Contact shadows for moving things, rebuilt every frame. */
export class Blobs {
  readonly mesh: THREE.InstancedMesh;
  private n = 0;

  constructor(capacity = 160) {
    this.mesh = new THREE.InstancedMesh(blobGeometry, blobMaterial(), capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  begin(): void {
    this.n = 0;
  }

  /** A shadow under something at sideways x and road distance d, `w` wide and `l` long, turned `ry`. */
  add(x: number, d: number, y: number, w: number, l: number, ry = 0): void {
    if (this.n >= this.mesh.instanceMatrix.count) return;
    p.set(x, y + 0.012, -d);
    q.setFromAxisAngle(Y, ry);
    sc.set(w, 1, l);
    this.mesh.setMatrixAt(this.n++, m.compose(p, q, sc));
  }

  end(): void {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
