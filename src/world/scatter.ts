// Instanced pools: every copy of a model (tree, lamp, building, sign…) draws in one call.
// Instances are added and removed as road tiles stream past; removal swaps in the last instance.
import * as THREE from 'three';
import type { Cell } from '../art/textures.ts';

export interface Handle {
  readonly kind: string;
  index: number;
}

interface Pool {
  readonly mesh: THREE.InstancedMesh;
  readonly owners: Handle[];
  /** Atlas cells per instance (sign pools only). */
  readonly cells: THREE.InstancedBufferAttribute | null;
  /** Animation state per instance (people only): stride phase, swing, wave. */
  readonly anim: THREE.InstancedBufferAttribute | null;
}

const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

/** Material whose texture is looked up per instance from an atlas cell (u, v, du, dv). */
export function atlasMaterial(texture: THREE.Texture): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aCell;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = aCell.xy + uv * aCell.zw;\n#endif');
  };
  m.customProgramCacheKey = () => 'atlas-cell';
  return m;
}

export class Scatter {
  private readonly pools = new Map<string, Pool>();
  readonly group = new THREE.Group();

  /** Register a kind of object. `shadow` makes it cast shadows; ground pieces only receive. */
  kind(id: string, geometry: THREE.BufferGeometry, material: THREE.Material, capacity: number, shadow: 'cast' | 'receive' | 'both' | 'none' = 'both', atlas = false, animated = false): void {
    if (this.pools.has(id)) return;
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = shadow === 'cast' || shadow === 'both';
    mesh.receiveShadow = shadow === 'receive' || shadow === 'both';
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    let cells: THREE.InstancedBufferAttribute | null = null;
    if (atlas) {
      cells = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
      cells.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('aCell', cells);
    }
    let anim: THREE.InstancedBufferAttribute | null = null;
    if (animated) {
      anim = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
      anim.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('aAnim', anim);
    }
    this.group.add(mesh);
    this.pools.set(id, { mesh, owners: [], cells, anim });
  }

  has(id: string): boolean {
    return this.pools.has(id);
  }

  /** Place one instance; null when the pool is full (it is then simply not drawn). */
  place(id: string, matrix: THREE.Matrix4, cell?: Cell): Handle | null {
    const pool = this.pools.get(id);
    if (!pool) return null;
    const i = pool.mesh.count;
    if (i >= pool.mesh.instanceMatrix.count) return null;
    pool.mesh.setMatrixAt(i, matrix);
    pool.mesh.count = i + 1;
    pool.mesh.instanceMatrix.needsUpdate = true;
    if (pool.cells && cell) {
      pool.cells.setXYZW(i, cell.u, cell.v, cell.du, cell.dv);
      pool.cells.needsUpdate = true;
    }
    const h: Handle = { kind: id, index: i };
    pool.owners[i] = h;
    return h;
  }

  /** Move an existing instance. */
  move(h: Handle, matrix: THREE.Matrix4): void {
    const pool = this.pools.get(h.kind);
    if (!pool || h.index < 0) return;
    pool.mesh.setMatrixAt(h.index, matrix);
    pool.mesh.instanceMatrix.needsUpdate = true;
  }

  remove(h: Handle): void {
    const pool = this.pools.get(h.kind);
    if (!pool || h.index < 0) return;
    const last = pool.mesh.count - 1;
    const i = h.index;
    if (i !== last) {
      const m = new THREE.Matrix4();
      pool.mesh.getMatrixAt(last, m);
      pool.mesh.setMatrixAt(i, m);
      if (pool.cells) pool.cells.setXYZW(i, pool.cells.getX(last), pool.cells.getY(last), pool.cells.getZ(last), pool.cells.getW(last));
      if (pool.anim) pool.anim.setXYZW(i, pool.anim.getX(last), pool.anim.getY(last), pool.anim.getZ(last), pool.anim.getW(last));
      const moved = pool.owners[last];
      if (moved) {
        moved.index = i;
        pool.owners[i] = moved;
      }
    }
    pool.mesh.setMatrixAt(last, hidden);
    pool.owners.length = last;
    pool.mesh.count = last;
    pool.mesh.instanceMatrix.needsUpdate = true;
    if (pool.cells) pool.cells.needsUpdate = true;
    h.index = -1;
  }

  /** Set an instance's animation (stride phase, swing amplitude, wave). */
  animate(h: Handle, phase: number, swing: number, wave: number): void {
    const pool = this.pools.get(h.kind);
    if (!pool?.anim || h.index < 0) return;
    pool.anim.setXYZW(h.index, phase, swing, wave, 0);
    pool.anim.needsUpdate = true;
  }

  /** Switch shadow casting for the pools whose id matches. */
  setCastShadow(match: (id: string) => boolean, on: boolean): void {
    for (const [id, pool] of this.pools) if (match(id)) pool.mesh.castShadow = on;
  }

  /** Remove everything (new city or new drive). */
  clear(): void {
    for (const pool of this.pools.values()) {
      for (const h of pool.owners) if (h) h.index = -1;
      pool.owners.length = 0;
      pool.mesh.count = 0;
    }
  }

  /** Free GPU memory for every pool (switching cities). */
  dispose(): void {
    for (const pool of this.pools.values()) {
      pool.mesh.geometry.dispose();
      pool.mesh.dispose();
      this.group.remove(pool.mesh);
    }
    this.pools.clear();
  }

  /** Number of draw calls currently in use, for profiling. */
  activeKinds(): number {
    let n = 0;
    for (const p of this.pools.values()) if (p.mesh.count > 0) n++;
    return n;
  }
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

/** World matrix for something at road distance `d`, sideways `x`, height `y`, turned `ry`. */
export function at(x: number, y: number, d: number, ry = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
  tmpP.set(x, y, -d);
  tmpQ.setFromAxisAngle(Y, ry);
  tmpS.set(sx, sy, sz);
  return tmpM.compose(tmpP, tmpQ, tmpS);
}
