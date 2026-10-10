import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PaintDef, PaxKind } from '../rules/data.ts';
import { pick } from '../rules/util.ts';
import { lambert, night } from './materials.ts';
import { barrierTexture, billboardTextures, noteTexture, stickerTexture } from './textures.ts';

export const BOX = new THREE.BoxGeometry(1, 1, 1);
export const PLANE = new THREE.PlaneGeometry(1, 1);

/** Unit box scaled into place; `y` is the centre height. */
export function box(w: number, h: number, l: number, material: THREE.Material | number, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(BOX, typeof material === 'number' ? lambert(material) : material);
  mesh.scale.set(w, h, l);
  mesh.position.set(x, y, z);
  return mesh;
}

const WHEEL = new THREE.CylinderGeometry(0.45, 0.45, 0.32, 14).rotateZ(Math.PI / 2);
const SMALL_WHEEL = new THREE.CylinderGeometry(0.34, 0.34, 0.2, 12).rotateZ(Math.PI / 2);

function wheels(group: THREE.Group, geo: THREE.BufferGeometry, xs: number[], zs: number[], y: number): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  for (const x of xs)
    for (const z of zs) {
      const w = new THREE.Mesh(geo, lambert(0x151515));
      w.position.set(x, y, z);
      group.add(w);
      out.push(w);
    }
  return out;
}

// ---------- People ----------
export type FigureKind = PaxKind | 'seller' | 'warden' | 'walker';
const SKIN = [0x5a3a22, 0x6b4428, 0x4a2f1c, 0x7a4e2d];
const SHIRTS = [0xd7263d, 0x1b998b, 0xf46036, 0x2e294e, 0xc5d86d, 0xf2c14e, 0x3c91e6, 0xfafafa, 0x9b5de5];
const WRAPPERS = [0xe76f51, 0x2a9d8f, 0xe9c46a, 0x8338ec, 0xff006e, 0x3a86ff];
const ASO_EBI = [0xd4ac0d, 0x6c3483, 0x0b7a3e, 0xc0392b];
const LOWER = new THREE.CylinderGeometry(0.2, 0.24, 0.62, 8);
const UPPER = new THREE.CylinderGeometry(0.22, 0.24, 0.56, 8);
const ROBE = new THREE.CylinderGeometry(0.24, 0.36, 1.18, 9);
const AGBADA = new THREE.CylinderGeometry(0.3, 0.44, 0.62, 9);
const HEAD = new THREE.SphereGeometry(0.19, 10, 8);
const GELE = new THREE.CylinderGeometry(0.32, 0.2, 0.22, 9);
const CAP = new THREE.CylinderGeometry(0.17, 0.19, 0.16, 9);
const BASIN = new THREE.CylinderGeometry(0.44, 0.3, 0.18, 12);
const STICK = new THREE.CylinderGeometry(0.025, 0.025, 1.2, 5);

/** A person, about 1.6 m tall, standing at y = 0. */
export function makeFigure(kind: FigureKind): THREE.Group {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z = 0, scale = 1): THREE.Mesh => {
    const m = new THREE.Mesh(geo, lambert(color));
    m.position.set(x, y, z);
    m.scale.setScalar(scale);
    g.add(m);
    return m;
  };
  const skin = pick(SKIN);
  const shirt = pick(SHIRTS);
  switch (kind) {
    case 'preacher':
      add(ROBE, 0xfafafa, 0, 0.6);
      g.add(box(0.18, 0.24, 0.06, 0x2b1d14, 0.3, 0.92));
      break;
    case 'baba':
      add(LOWER, 0x2f2a26, 0, 0.31);
      add(AGBADA, pick([0x6c3483, 0x1f4e79, 0xe8dcc0]), 0, 0.9);
      add(CAP, pick([0x6c3483, 0x7b3f00, 0x1f4e79]), 0, 1.55);
      g.add(new THREE.Mesh(STICK, lambert(0x6b4a2b)).translateX(0.42).translateY(0.6));
      break;
    case 'guest': {
      const c = pick(ASO_EBI);
      add(LOWER, c, 0, 0.31);
      add(UPPER, c, 0, 0.89);
      add(GELE, c, 0, 1.6, 0, 1.4);
      break;
    }
    case 'warden':
      add(LOWER, 0x6d1b2b, 0, 0.31);
      add(UPPER, 0xf2c300, 0, 0.89);
      add(CAP, 0xfafafa, 0, 1.55);
      break;
    default: {
      const wrapper = kind === 'trader' || kind === 'seller' || kind === 'hawker';
      add(LOWER, wrapper ? pick(WRAPPERS) : kind === 'student' ? 0x2e4a7a : kind === 'worker' ? 0x23262b : pick([0x2f3e5a, 0x2f2a26, 0x4a4036]), 0, 0.31);
      add(UPPER, kind === 'student' || kind === 'worker' ? 0xf4f6f8 : shirt, 0, 0.89);
    }
  }
  add(HEAD, skin, 0, 1.36);
  if (kind === 'trader') {
    add(BASIN, 0xd9dde0, 0, 1.62);
    add(new THREE.SphereGeometry(0.12, 6, 5), 0xd7263d, 0.12, 1.75);
    add(new THREE.SphereGeometry(0.12, 6, 5), 0xf2c14e, -0.1, 1.74, 0.08);
  } else if (kind === 'seller') add(GELE, pick(WRAPPERS), 0, 1.58);
  else if (kind === 'student') g.add(box(0.38, 0.46, 0.22, pick([0x1b998b, 0xd7263d, 0x141414]), 0, 0.95, 0.25));
  else if (kind === 'worker') {
    g.add(box(0.06, 0.32, 0.02, 0xb03a2e, 0, 0.98, -0.24));
    g.add(box(0.42, 0.3, 0.1, 0x3b2a1e, 0.34, 0.55));
  } else if (kind === 'hawker') {
    g.add(box(0.85, 0.06, 0.6, 0x9c7a4c, 0, 1.6));
    g.add(box(0.65, 0.14, 0.42, pick([0xf2c14e, 0xe76f51, 0x3c91e6]), 0, 1.7));
  } else if ((kind === 'regular' || kind === 'walker') && Math.random() < 0.3) add(CAP, pick(SHIRTS), 0, 1.55);
  if (kind === 'warden') {
    const arm = new THREE.Group();
    arm.position.set(0.3, 1.12, 0);
    arm.add(box(0.12, 0.62, 0.12, 0xf2c300, 0, 0.28, 0));
    arm.add(box(0.14, 0.14, 0.14, 0xfafafa, 0, 0.62, 0));
    g.add(arm);
    g.userData.arm = arm;
    g.add(box(0.12, 0.55, 0.12, 0xf2c300, -0.3, 0.86, 0));
  }
  return g;
}

// ---------- Danfo ----------
export interface DanfoModel {
  readonly group: THREE.Group;
  readonly wheels: THREE.Mesh[];
  readonly door: THREE.Mesh;
  setPaint(paint: PaintDef): void;
  setSticker(text: string): void;
}

const stickerCache = new Map<string, THREE.MeshBasicMaterial>();
function stickerMaterial(text: string): THREE.MeshBasicMaterial {
  let m = stickerCache.get(text);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: stickerTexture(text), transparent: true });
    stickerCache.set(text, m);
  }
  return m;
}

/** The yellow-bus silhouette. `unique` gives it its own paint materials (the player's bus). */
export function makeDanfo(paint: PaintDef, sticker: string | null, unique: boolean): DanfoModel {
  const g = new THREE.Group();
  const bodyMat = unique ? new THREE.MeshLambertMaterial({ color: paint.body }) : lambert(paint.body);
  const stripeMat = unique ? new THREE.MeshLambertMaterial({ color: paint.stripe }) : lambert(paint.stripe);
  const roofMat = unique ? new THREE.MeshLambertMaterial({ color: paint.roof }) : lambert(paint.roof);
  const doorMat = unique ? new THREE.MeshLambertMaterial({ color: new THREE.Color(paint.body).multiplyScalar(0.85) }) : lambert(paint.body);
  const n = night();
  g.add(box(2.3, 1.9, 5.6, bodyMat, 0, 1.45, 0));
  g.add(box(2.32, 0.08, 5.62, roofMat, 0, 2.44, 0));
  g.add(box(2.34, 0.13, 5.64, stripeMat, 0, 1.0, 0), box(2.34, 0.07, 5.64, stripeMat, 0, 1.2, 0));
  g.add(box(2.36, 0.6, 4.3, 0x1f2b33, 0, 1.95, 0.35));
  g.add(box(2.1, 0.72, 0.06, 0x2a3a44, 0, 1.95, -2.82), box(2.0, 0.55, 0.06, 0x2a3a44, 0, 1.95, 2.82));
  g.add(box(2.36, 0.24, 0.18, 0x2b2b2b, 0, 0.62, -2.86), box(2.36, 0.24, 0.18, 0x2b2b2b, 0, 0.62, 2.86));
  g.add(box(0.42, 0.18, 0.05, n.head, -0.75, 0.98, -2.84), box(0.42, 0.18, 0.05, n.head, 0.75, 0.98, -2.84));
  g.add(box(0.3, 0.2, 0.05, n.tail, -0.85, 0.98, 2.84), box(0.3, 0.2, 0.05, n.tail, 0.85, 0.98, 2.84));
  const ws = wheels(g, WHEEL, [-1.08, 1.08], [-1.8, 1.8], 0.45);
  const door = box(0.06, 1.35, 1.0, doorMat, 1.17, 1.32, -1.6);
  g.add(door);
  const stickerMesh = new THREE.Mesh(PLANE, stickerMaterial(sticker ?? 'NO CONDITION IS PERMANENT'));
  stickerMesh.scale.set(2.1, 0.4, 1);
  stickerMesh.position.set(0, 1.5, 2.86);
  stickerMesh.visible = sticker !== null;
  g.add(stickerMesh);
  return {
    group: g,
    wheels: ws,
    door,
    setPaint(p: PaintDef): void {
      if (!unique) return;
      bodyMat.color.setHex(p.body);
      stripeMat.color.setHex(p.stripe);
      roofMat.color.setHex(p.roof);
      doorMat.color.setHex(p.body).multiplyScalar(0.85);
    },
    setSticker(text: string): void {
      stickerMesh.material = stickerMaterial(text);
      stickerMesh.visible = true;
    },
  };
}

// ---------- Other road users ----------
const CAR_COLORS = [0xc0392b, 0xecf0f1, 0x2c3e50, 0x7f8c8d, 0x16a085, 0x1f4e79, 0x8e44ad, 0xd4ac0d, 0x5d6d7e];

/** Box-built saloon, used until the 3D car models have loaded. */
export function makeCar(color?: number): THREE.Group {
  const g = new THREE.Group();
  const c = color ?? pick(CAR_COLORS);
  const n = night();
  g.add(box(1.8, 0.72, 4.2, c, 0, 0.68, 0), box(1.62, 0.5, 2.1, 0x1f2b33, 0, 1.28, 0.2), box(1.6, 0.1, 2.0, c, 0, 1.56, 0.2));
  g.add(box(0.3, 0.16, 0.05, n.tail, -0.6, 0.85, 2.11), box(0.3, 0.16, 0.05, n.tail, 0.6, 0.85, 2.11));
  g.add(box(0.32, 0.14, 0.05, n.head, -0.6, 0.8, -2.11), box(0.32, 0.14, 0.05, n.head, 0.6, 0.8, -2.11));
  wheels(g, SMALL_WHEEL, [-0.85, 0.85], [-1.35, 1.35], 0.34);
  return g;
}

export function makeKeke(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.3, 0.75, 2.2, 0xf2c300, 0, 0.75, 0.15), box(1.32, 0.12, 2.24, 0x1e8449, 0, 0.98, 0.15));
  g.add(box(0.85, 0.85, 0.6, 0xf2c300, 0, 0.8, -1.05), box(1.36, 0.08, 2.0, 0x1e8449, 0, 1.8, 0.05));
  g.add(box(0.06, 0.8, 0.06, 0x222222, -0.62, 1.38, 0.95), box(0.06, 0.8, 0.06, 0x222222, 0.62, 1.38, 0.95), box(0.06, 0.8, 0.06, 0x222222, 0, 1.4, -0.75));
  g.add(box(0.3, 0.14, 0.05, night().tail, 0, 0.7, 1.26));
  wheels(g, SMALL_WHEEL, [-0.6, 0.6], [0.85], 0.3);
  wheels(g, SMALL_WHEEL, [0], [-1.15], 0.3);
  return g;
}

export function makeOkada(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.3, 0.45, 1.7, 0x2b2b2b, 0, 0.6, 0), box(0.55, 0.7, 0.36, pick(SHIRTS), 0, 1.25, 0.15));
  const helmet = new THREE.Mesh(HEAD, lambert(pick([0xd7263d, 0x141414, 0xfafafa, 0x2e5eaa])));
  helmet.scale.setScalar(1.3);
  helmet.position.set(0, 1.82, 0.1);
  g.add(helmet);
  if (Math.random() < 0.5) g.add(box(0.5, 0.6, 0.34, pick(SHIRTS), 0, 1.2, 0.55));
  g.add(box(0.16, 0.1, 0.05, night().tail, 0, 0.75, 0.86));
  wheels(g, SMALL_WHEEL, [0], [-0.75, 0.75], 0.34);
  return g;
}

export function makeTruck(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.4, 2.1, 2.0, pick([0x1f4e79, 0xc0392b, 0xecf0f1, 0x27ae60]), 0, 1.45, -2.8), box(2.2, 0.7, 0.06, 0x2a3a44, 0, 1.9, -3.82));
  g.add(box(2.5, 2.8, 5.4, pick([0xf1ece1, 0x7b8f47, 0xa0522d, 0xb9c4c9]), 0, 1.95, 0.95));
  g.add(box(0.3, 0.2, 0.05, night().tail, -1, 0.8, 3.66), box(0.3, 0.2, 0.05, night().tail, 1, 0.8, 3.66));
  wheels(g, WHEEL, [-1.1, 1.1], [-2.8, 0.6, 2.6], 0.45);
  return g;
}

export function makeBrtBus(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.55, 2.6, 12, 0x1f4e9c, 0, 1.75, 0), box(2.58, 0.18, 12.02, 0xfafafa, 0, 1.1, 0));
  g.add(box(2.6, 0.75, 10.5, 0x1f2b33, 0, 2.3, 0.4), box(2.3, 0.9, 0.06, 0x2a3a44, 0, 2.2, -6.02));
  g.add(box(0.4, 0.2, 0.05, night().head, -0.8, 1.0, -6.03), box(0.4, 0.2, 0.05, night().head, 0.8, 1.0, -6.03));
  g.add(box(0.35, 0.22, 0.05, night().tail, -0.9, 1.0, 6.03), box(0.35, 0.22, 0.05, night().tail, 0.9, 1.0, 6.03));
  wheels(g, WHEEL, [-1.15, 1.15], [-4.2, 3.8], 0.45);
  return g;
}

// ---------- Road items ----------
let barrierMat: THREE.MeshLambertMaterial | null = null;
export function makeBarrier(): THREE.Group {
  barrierMat ??= new THREE.MeshLambertMaterial({ map: barrierTexture() });
  const g = new THREE.Group();
  const b = new THREE.Mesh(BOX, barrierMat);
  b.scale.set(2.4, 0.55, 0.3);
  b.position.y = 0.6;
  g.add(b, box(0.12, 0.6, 0.5, 0x3d3d3d, -1, 0.3, 0), box(0.12, 0.6, 0.5, 0x3d3d3d, 1, 0.3, 0));
  return g;
}

const DISC = new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2);
export function makePothole(): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.Mesh(DISC, lambert(0x1c1b1a));
  m.scale.set(1.0, 1, 0.75);
  m.position.y = 0.015;
  g.add(m);
  return g;
}

let puddleMat: THREE.MeshLambertMaterial | null = null;
export function makePuddle(): THREE.Group {
  puddleMat ??= new THREE.MeshLambertMaterial({ color: 0x8fa4b4, transparent: true, opacity: 0.75 });
  const g = new THREE.Group();
  const m = new THREE.Mesh(DISC, puddleMat);
  m.scale.set(1.5, 1, 1.1);
  m.position.y = 0.016;
  g.add(m);
  return g;
}

let noteMat: THREE.MeshBasicMaterial | null = null;
export function makeNote(): THREE.Group {
  noteMat ??= new THREE.MeshBasicMaterial({ map: noteTexture(), side: THREE.DoubleSide });
  const g = new THREE.Group();
  const m = new THREE.Mesh(PLANE, noteMat);
  m.scale.set(0.95, 0.48, 1);
  m.position.y = 1.3;
  g.add(m);
  return g;
}

// ---------- Street furniture ----------
let palmLeaves: THREE.BufferGeometry | null = null;
let palmLeafMat: THREE.MeshLambertMaterial | null = null;
const TRUNK = new THREE.CylinderGeometry(0.14, 0.22, 6.5, 7);
function leavesGeometry(): THREE.BufferGeometry {
  if (palmLeaves) return palmLeaves;
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 7; k++) {
    const leaf = new THREE.PlaneGeometry(2.8, 0.6).translate(1.4, 0, 0);
    leaf.rotateZ(-0.45);
    leaf.rotateY((k / 7) * Math.PI * 2);
    leaf.translate(0, 6.4, 0);
    parts.push(leaf);
  }
  palmLeaves = mergeGeometries(parts);
  return palmLeaves;
}
export function makePalm(): THREE.Group {
  palmLeafMat ??= new THREE.MeshLambertMaterial({ color: 0x2f7d32, side: THREE.DoubleSide });
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(TRUNK, lambert(0x8b6b4a));
  trunk.position.y = 3.25;
  g.add(trunk, new THREE.Mesh(leavesGeometry(), palmLeafMat));
  return g;
}

const POOL = new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2);
/** Street lamp whose arm reaches toward the road (`towardRoad` = -1 or 1 in x). */
export function makeLamp(towardRoad: number): THREE.Group {
  const n = night();
  const g = new THREE.Group();
  g.add(box(0.14, 7, 0.14, 0x6b6f75, 0, 3.5, 0), box(2.2, 0.12, 0.14, 0x6b6f75, towardRoad * 1.1, 6.95, 0));
  g.add(box(0.55, 0.18, 0.32, n.lamp, towardRoad * 2.1, 6.82, 0));
  const pool = new THREE.Mesh(POOL, n.pool);
  pool.position.set(towardRoad * 3.2, 0.03, 0);
  g.add(pool);
  return g;
}

const UMBRELLA = new THREE.CylinderGeometry(0.05, 1.6, 0.55, 10);
const UMBRELLA_COLORS = [0xd7263d, 0x1b998b, 0xf2c14e, 0x3c91e6, 0xf46036, 0x008751];
export function makeStall(): THREE.Group {
  const g = new THREE.Group();
  const umbrella = new THREE.Mesh(UMBRELLA, lambert(pick(UMBRELLA_COLORS)));
  umbrella.position.y = 2.35;
  g.add(umbrella, box(0.06, 2.3, 0.06, 0x3d3d3d, 0, 1.15, 0));
  g.add(box(1.6, 0.75, 1.0, 0x8b6b4a, 0, 0.53, 0), box(1.5, 0.16, 0.9, pick([0xd7263d, 0xf2c14e, 0x2a9d8f, 0xe76f51]), 0, 0.99, 0));
  const seller = makeFigure('seller');
  seller.position.set(0, 0, 0.9);
  g.add(seller);
  return g;
}

let billboardMats: THREE.MeshBasicMaterial[] | null = null;
export function makeBillboard(): THREE.Group {
  billboardMats ??= billboardTextures().map((map) => new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide }));
  const g = new THREE.Group();
  g.add(box(0.25, 6, 0.25, 0x5b5f66, -2.4, 3, 0), box(0.25, 6, 0.25, 0x5b5f66, 2.4, 3, 0));
  const board = new THREE.Mesh(PLANE, pick(billboardMats));
  board.scale.set(7, 3.5, 1);
  board.position.y = 7.2;
  g.add(board);
  g.userData.board = board;
  return g;
}

export const billboardMaterials = (): THREE.MeshBasicMaterial[] => {
  billboardMats ??= billboardTextures().map((map) => new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide }));
  return billboardMats;
};
