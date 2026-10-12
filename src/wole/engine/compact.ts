// Fewer draw calls, same look: the plain-coloured parts of a model merge into one mesh whose vertices carry the
// colour. Vehicle parts also carry a surface (paint, glass, rubber, chrome), so the merged body shines and reflects
// the sky where paint and glass would. Parts that share any other material (lamps, contact shadows) merge too.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SURFACES, vehicleMaterial, type Surface } from '../../art/surfaces.ts';
import { lambertVC, plainColor } from './materials.ts';

/** Vehicle colours that are not paint. */
const VEHICLE_SURFACE: ReadonlyMap<number, Surface> = new Map([
  [0x1f2b33, 'glass'],
  [0x2a3a44, 'glass'],
  [0x151515, 'rubber'],
  [0xb9bdc2, 'chrome'],
  [0x232323, 'plastic'],
  [0x222222, 'plastic'],
  [0x2b2b2b, 'plastic'],
  [0x141414, 'plastic'],
  [0x3d3d3d, 'metal'],
]);

const tint = new THREE.Color();
const rel = new THREE.Matrix4();
const inv = new THREE.Matrix4();

/** Swap the 2nd and 3rd vertex of every triangle (a mirrored part would otherwise face inwards). */
function flipWinding(g: THREE.BufferGeometry): void {
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name) as THREE.BufferAttribute;
    for (let i = 0; i + 2 < a.count; i += 3)
      for (let k = 0; k < a.itemSize; k++) {
        const t = a.getComponent(i + 1, k);
        a.setComponent(i + 1, k, a.getComponent(i + 2, k));
        a.setComponent(i + 2, k, t);
      }
  }
}

/** A part's triangles in the root's frame, keeping only the named attributes. */
function inRootFrame(mesh: THREE.Mesh, keep: readonly string[]): THREE.BufferGeometry {
  const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const g = new THREE.BufferGeometry();
  for (const name of keep) {
    const a = src.getAttribute(name);
    if (a) g.setAttribute(name, a);
  }
  rel.multiplyMatrices(inv, mesh.matrixWorld);
  g.applyMatrix4(rel);
  if (rel.determinant() < 0) flipWinding(g);
  return g;
}

/** Colour (and, for vehicles, surface) on every vertex. A part can name its surface in `userData.surface`. */
function painted(mesh: THREE.Mesh, hex: number | null, vehicle: boolean): THREE.BufferGeometry {
  const g = inRootFrame(mesh, hex === null ? ['position', 'normal', 'color', 'aSurf'] : ['position', 'normal']);
  const n = g.getAttribute('position').count;
  if (hex !== null) {
    tint.setHex(hex);
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.set([tint.r, tint.g, tint.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    if (vehicle) {
      const s = SURFACES[(mesh.userData.surface as Surface | undefined) ?? VEHICLE_SURFACE.get(hex) ?? 'paint'];
      const surf = new Float32Array(n * 4);
      // Glass stays the game's flat dark glass (no painted sheen); reflections come from the sky.
      for (let i = 0; i < n; i++) surf.set([s[0], s[1], s[2], 0], i * 4);
      g.setAttribute('aSurf', new THREE.BufferAttribute(surf, 4));
    }
  }
  return g;
}

/**
 * Merge every plain-coloured part under `root` (skipping anything `keep` names, with its children) into one mesh,
 * then merge leftover parts that share a material. Returns the merged plain mesh, or null if there was none.
 */
export function compact(root: THREE.Object3D, kind: 'vehicle' | 'world', keep: (o: THREE.Object3D) => boolean = () => false): THREE.Mesh | null {
  root.updateMatrixWorld(true);
  inv.copy(root.matrixWorld).invert();
  const vehicle = kind === 'vehicle';
  const target = vehicle ? vehicleMaterial() : lambertVC();
  const plainParts: THREE.BufferGeometry[] = [];
  const merged: THREE.Mesh[] = [];
  const others = new Map<THREE.Material, THREE.Mesh[]>();
  const visit = (o: THREE.Object3D): void => {
    if (o !== root && keep(o)) return;
    if (o instanceof THREE.Mesh && o.visible && !Array.isArray(o.material)) {
      const hex = plainColor(o.material);
      // Parts already merged this way (a seller inside a stall) join as they are.
      if (hex !== null || o.material === target) {
        plainParts.push(painted(o, hex, vehicle));
        merged.push(o);
      } else if (o.children.length === 0 && o.geometry.getAttribute('uv')) {
        const list = others.get(o.material) ?? [];
        list.push(o);
        others.set(o.material, list);
      }
    }
    for (const c of [...o.children]) visit(c);
  };
  visit(root);

  let plainMesh: THREE.Mesh | null = null;
  if (plainParts.length > 0) {
    const geo = mergeGeometries(plainParts);
    for (const p of plainParts) p.dispose();
    if (geo) plainMesh = new THREE.Mesh(geo, target);
  }
  for (const [material, list] of others) {
    if (list.length < 2) continue;
    const parts = list.map((m) => inRootFrame(m, ['position', 'normal', 'uv']));
    const geo = mergeGeometries(parts);
    for (const p of parts) p.dispose();
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, material);
    mesh.renderOrder = list[0]?.renderOrder ?? 0;
    root.add(mesh);
    merged.push(...list);
  }
  // Deepest parts first, so children that stay are lifted out before their parent goes.
  const gone = new Set(merged);
  for (const m of [...merged].reverse()) {
    for (const c of [...m.children]) if (!gone.has(c as THREE.Mesh)) root.attach(c);
    m.removeFromParent();
  }
  if (plainMesh) root.add(plainMesh);
  return plainMesh;
}

/** Sun shadows: opaque parts cast if `cast`; every part receives if `receive`. */
export function shade(root: THREE.Object3D, cast: boolean, receive: boolean): void {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = o.material as THREE.Material;
    o.castShadow = cast && !m.transparent;
    o.receiveShadow = receive;
  });
}
