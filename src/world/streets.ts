// Streams the road and its scenery past the player, tile by tile, from instanced pools.
import * as THREE from 'three';
import { cityById, isBridge, type CityId, type LandmarkKind, type Theme } from '../config/cities.ts';
import { BUILDERS, type BuildingArt, type BuildingKind } from '../art/buildings.ts';
import { G, Shape, shade } from '../art/kit.ts';
import { cathedral, skyline, towerBridge, BRIDGE_DECK } from '../art/landmarks.ts';
import { C, matte, satin } from '../art/materials.ts';
import { crowdLooks, makePerson } from '../art/people.ts';
import * as P from '../art/props.ts';
import { signAtlas, waterTexture, type Cell } from '../art/textures.ts';
import { hashString } from '../rules/social.ts';
import { mulberry32, pick, type Rng } from '../rules/util.ts';
import { BUILD_LINE, KERB, Layout, TILE } from './layout.ts';
import { Scatter, at, atlasMaterial, type Handle } from './scatter.ts';
import type { Stage } from './stage.ts';

/** How far ahead and behind the player scenery exists. */
const AHEAD = 420;
const BEHIND = 48;
const BAY_DEPTH = 3.4;

type SideKind = 'street' | 'water' | 'bridge';

interface CityKit {
  readonly id: CityId;
  readonly side: -1 | 1;
  readonly buildings: Readonly<Partial<Record<BuildingKind, { id: string; art: BuildingArt }[]>>>;
  readonly shop: Cell[];
  readonly board: Cell[];
  readonly looks: number;
}

/** Which buildings line each theme, with weights. */
const THEME_BUILDINGS: Readonly<Record<Theme, readonly (readonly [BuildingKind, number])[]>> = {
  'london-street': [['london-shop', 5], ['london-terrace', 4], ['london-pub', 1.5], ['london-modern', 1.5]],
  'london-warehouse': [['london-warehouse', 6], ['london-modern', 1]],
  'london-quay': [['london-warehouse', 3], ['london-terrace', 2], ['london-shop', 2]],
  'london-bridge': [],
  'lagos-marina': [['marina-block', 5], ['old-shop', 2]],
  'lagos-island': [['marina-block', 3], ['old-shop', 4], ['ikeja-block', 1]],
  'lagos-market': [['market-shed', 4], ['old-shop', 3], ['ikeja-block', 2]],
  'lagos-ikeja': [['ikeja-block', 6], ['ikeja-plaza', 1.5], ['old-shop', 1]],
  'lagos-vi': [['vi-tower', 3], ['vi-office', 3]],
  'lagos-lagoon': [['vi-tower', 3], ['vi-office', 2]],
};

/** Side of the road with water for themes that have it (the side away from the stopping bays). */
function sideKind(theme: Theme, sign: -1 | 1, citySide: -1 | 1): SideKind {
  if (isBridge(theme)) return 'bridge';
  if ((theme === 'london-quay' || theme === 'lagos-marina' || theme === 'lagos-lagoon') && sign === -citySide) return 'water';
  return 'street';
}

const weightedPick = <T,>(items: readonly (readonly [T, number])[], rng: Rng): T | null => {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of items) {
    r -= w;
    if (r < 0) return v;
  }
  return items[0]?.[0] ?? null;
};

// ---------- Road pieces (built for the right-hand side, mirrored for the left) ----------
function roadPiece(city: CityId): Shape {
  const s = new Shape();
  const asphalt = city === 'london' ? 0x5b616c : 0x60626a;
  s.add(G.box(KERB * 2, 0.1, TILE), asphalt, { y: -0.05 });
  for (const x of [-1.7, 1.7]) for (let z = -TILE / 2 + 1.5; z < TILE / 2; z += 6) s.add(G.box(0.16, 0.02, 3), C.white, { x, y: 0.005, z });
  for (const x of [-KERB + 0.3, KERB - 0.3]) s.add(G.box(0.14, 0.02, TILE), city === 'london' ? C.white : 0xffd447, { x, y: 0.005 });
  // A little wear down the middle of each lane.
  for (const x of [-3.4, 0, 3.4]) s.add(G.box(1.4, 0.01, TILE), shade(asphalt, 0.94), { x, y: 0.002 });
  return s;
}

function kerb(s: Shape, city: CityId, x: number, len: number, z = 0, ry = 0): void {
  if (city === 'lagos') {
    const n = Math.max(1, Math.round(len));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      s.add(G.rbox(0.32, 0.2, len / n, 0.03), i % 2 ? C.white : 0x2a2d34, { x: x + Math.sin(ry) * t * len, y: 0.1, z: z + Math.cos(ry) * t * len, ry });
    }
  } else s.add(G.rbox(0.32, 0.2, len, 0.04), 0xc8c1b4, { x, y: 0.1, z, ry });
}

function pavement(s: Shape, city: CityId, from: number, to: number): void {
  const slab = city === 'london' ? 0xdcd2bd : 0xd8c9a6;
  const joint = shade(slab, 0.92);
  s.add(G.box(to - from, 0.16, TILE), slab, { x: (from + to) / 2, y: 0.08 });
  for (let z = -TILE / 2 + 1.5; z < TILE / 2; z += 1.5) s.add(G.box(to - from, 0.012, 0.05), joint, { x: (from + to) / 2, y: 0.165, z });
  for (let x = from + 1.5; x < to - 0.2; x += 1.5) s.add(G.box(0.05, 0.012, TILE), joint, { x, y: 0.165 });
}

function ground(s: Shape, city: CityId): void {
  s.add(G.box(110, 0.1, TILE), city === 'london' ? 0xc4b9a2 : 0xcdb98f, { x: BUILD_LINE + 55, y: 0.02 });
}

function streetPiece(city: CityId): Shape {
  const s = new Shape();
  kerb(s, city, KERB + 0.16, TILE);
  pavement(s, city, KERB + 0.32, BUILD_LINE + 0.6);
  ground(s, city);
  if (city === 'london') for (const x of [KERB - 0.42, KERB - 0.6]) s.add(G.box(0.08, 0.02, TILE), 0xffd447, { x, y: 0.006 });
  return s;
}

/** A stopping bay over two tiles: `entry` tapers out from the kerb, the other tapers back. */
function bayPiece(city: CityId, entry: boolean): Shape {
  const s = new Shape();
  const taper = 8;
  const inner = KERB;
  const outer = KERB + BAY_DEPTH;
  const h = TILE / 2;
  // Bay surface: full depth, with a sloped end on the taper side.
  const near = entry ? h : h - taper;
  const far = entry ? -h + taper : -h;
  const pts: [number, number][] = entry
    ? [[inner, h], [inner, -h], [outer, -h], [outer, h - taper]]
    : [[inner, h], [inner, -h], [outer, -h + taper], [outer, h]];
  s.add(G.flat(pts), city === 'london' ? 0x5b616c : 0x60626a, { y: 0.004 });
  // Kerb along the bay and its taper.
  const straightLen = TILE - taper;
  kerb(s, city, outer + 0.16, straightLen, entry ? -taper / 2 : taper / 2);
  const ang = Math.atan2(BAY_DEPTH, taper);
  const tz = entry ? h - taper / 2 : -h + taper / 2;
  kerb(s, city, (inner + outer) / 2 + 0.16, Math.hypot(taper, BAY_DEPTH), tz, entry ? -ang : ang);
  // Pavement behind the bay, plus the wedge beside the taper.
  pavement(s, city, outer + 0.32, BUILD_LINE + 0.6);
  const wedge: [number, number][] = entry
    ? [[inner + 0.2, h], [outer + 0.32, h - taper - 0.1], [outer + 0.32, h]]
    : [[inner + 0.2, -h], [outer + 0.32, -h], [outer + 0.32, -h + taper + 0.1]];
  s.add(G.flat(wedge), city === 'london' ? 0xdcd2bd : 0xd8c9a6, { y: 0.16 });
  ground(s, city);
  // Yellow bay markings: a dashed line along the lane and the bay outline.
  for (let z = -h + 0.5; z < h; z += 1.6) s.add(G.box(0.14, 0.02, 0.9), 0xffd447, { x: inner + 0.12, y: 0.012, z });
  s.add(G.box(0.14, 0.02, Math.abs(far - near) + taper), 0xffd447, { x: outer - 0.2, y: 0.012, z: (near + far) / 2 });
  return s;
}

function waterPiece(city: CityId): Shape {
  const s = new Shape();
  kerb(s, city, KERB + 0.16, TILE);
  pavement(s, city, KERB + 0.32, 8.7);
  s.merge(P.railing(TILE, C.ink), { x: 8.45, ry: Math.PI / 2 });
  s.add(G.rbox(0.8, 3.4, TILE, 0.06), 0xb5a88f, { x: 9.1, y: -1.55 });
  s.add(G.rbox(0.9, 0.16, TILE, 0.04), 0xd6cbb4, { x: 9.1, y: 0.1 });
  return s;
}

function bridgePiece(): Shape {
  const s = new Shape();
  kerb(s, 'london', KERB + 0.16, TILE);
  s.add(G.box(BRIDGE_DECK - KERB - 0.3, 0.2, TILE), 0xcfc6b3, { x: (KERB + 0.3 + BRIDGE_DECK) / 2, y: 0.1 });
  s.add(G.rbox(0.6, 3.4, TILE, 0.08), C.bridgeBlue, { x: BRIDGE_DECK + 0.3, y: -1.5 });
  s.add(G.rbox(0.7, 0.18, TILE, 0.05), C.cream, { x: BRIDGE_DECK + 0.3, y: 0.25 });
  for (let z = -TILE / 2 + 1; z < TILE / 2; z += 2) s.add(G.rbox(0.12, 1.1, 0.12, 0.03), C.cream, { x: BRIDGE_DECK + 0.3, y: 0.9, z });
  s.add(G.rbox(0.16, 0.12, TILE, 0.04), C.bridgeBlue, { x: BRIDGE_DECK + 0.3, y: 1.45 });
  s.add(G.rbox(0.12, 0.08, TILE, 0.03), C.bridgeBlue, { x: BRIDGE_DECK + 0.3, y: 0.9 });
  s.add(G.box(KERB * 2 + 6, 1.5, TILE), 0x8a8f96, { x: -BRIDGE_DECK, y: -1.0, sx: 0.001 });
  return s;
}

/** Sagging power cables from one pole to the next, one tile ahead. */
function cables(): Shape {
  const s = new Shape();
  for (const x of [-0.9, 0, 0.9]) {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, 8.6, 0), new THREE.Vector3(x, 7.4, -TILE / 2), new THREE.Vector3(x, 8.6, -TILE));
    s.add(new THREE.TubeGeometry(curve, 10, 0.025, 4, false), 0x2a2d34);
  }
  return s;
}

const mirrorLeft = (right: Shape): Shape => new Shape().merge(right, { sx: -1 });

export class Streets {
  private readonly scatter = new Scatter();
  private readonly tiles = new Map<number, Handle[]>();
  private readonly landmarks = new Map<string, THREE.Mesh>();
  private readonly landmarkGeo = new Map<LandmarkKind, THREE.BufferGeometry>();
  private readonly water: THREE.Mesh;
  private readonly waterMap: THREE.CanvasTexture;
  private skylineMesh: THREE.Mesh | null = null;
  private kit: CityKit | null = null;
  private layout: Layout | null = null;
  private signMaterial: THREE.MeshStandardMaterial | null = null;
  private drift = 0;
  private readonly stage: Stage;

  constructor(stage: Stage) {
    this.stage = stage;
    stage.world.add(this.scatter.group);
    this.waterMap = waterTexture();
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a8fd0, map: this.waterMap, roughness: 0.35, metalness: 0.05 }));
    this.water.position.y = -3;
    this.water.receiveShadow = true;
    stage.scene.add(this.water);
  }

  get city(): CityId | null {
    return this.kit?.id ?? null;
  }

  /** Build a city's models (once per switch; takes a moment). */
  setCity(city: CityId): void {
    if (this.kit?.id === city) return;
    this.clearTiles();
    this.scatter.dispose();
    for (const m of this.landmarks.values()) m.removeFromParent();
    this.landmarks.clear();
    const def = cityById(city);
    const side = def.side;
    const S = this.scatter;
    const reg = (id: string, shape: Shape, cap: number, mat: 'satin' | 'matte' = 'matte', shadow: 'cast' | 'receive' | 'both' | 'none' = 'both'): void =>
      S.kind(id, shape.build(), mat === 'satin' ? satin() : matte(), cap, shadow);
    const road = roadPiece(city);
    reg('road', road, 40, 'matte', 'receive');
    const street = streetPiece(city);
    reg('street-R', street, 40, 'matte', 'receive');
    reg('street-L', mirrorLeft(street), 40, 'matte', 'receive');
    const bayIn = bayPiece(city, true);
    const bayOut = bayPiece(city, false);
    const sideTag = side > 0 ? 'R' : 'L';
    reg(`bayin-${sideTag}`, side > 0 ? bayIn : mirrorLeft(bayIn), 6, 'matte', 'receive');
    reg(`bayout-${sideTag}`, side > 0 ? bayOut : mirrorLeft(bayOut), 6, 'matte', 'receive');
    const water = waterPiece(city);
    reg('water-R', water, 40, 'matte', 'both');
    reg('water-L', mirrorLeft(water), 40, 'matte', 'both');
    if (city === 'london') {
      const bridge = bridgePiece();
      reg('bridge-R', bridge, 40, 'satin', 'both');
      reg('bridge-L', mirrorLeft(bridge), 40, 'satin', 'both');
    }
    // Buildings: a few seeded variants of each kind the city uses.
    const kinds = new Set<BuildingKind>();
    for (const area of def.areas) for (const st of area.stretches) for (const [k] of THEME_BUILDINGS[st.theme]) kinds.add(k);
    const buildings: Partial<Record<BuildingKind, { id: string; art: BuildingArt }[]>> = {};
    for (const k of kinds) {
      const variants = k === 'market-shed' || k === 'ikeja-block' || k === 'london-shop' ? 4 : 3;
      buildings[k] = Array.from({ length: variants }, (_, v) => {
        const art = BUILDERS[k](mulberry32(hashString(`${k}:${v}`)));
        const id = `b:${k}:${v}`;
        // Buildings receive shadows but do not cast them: the kit's art keeps shadows short and local.
        S.kind(id, art.shape.build(), matte(), 26, 'receive');
        return { id, art };
      });
    }
    // Props.
    for (let v = 0; v < 3; v++) reg(`tree${v}`, P.treeRound(v * 17 + 3, 0.95 + v * 0.08), 90);
    reg('bin', P.bin(), 40, 'satin');
    reg('planter', P.planter(4), 50, 'satin');
    reg('railing', P.railing(TILE), 30, 'satin');
    reg('shelter', P.shelter(city), 8, 'satin');
    reg('stopsign', P.stopSign(city), 8, 'satin');
    for (let v = 0; v < 2; v++) reg(`boat${v}`, P.boat(v * 7 + 2), 20, 'satin');
    if (city === 'london') {
      reg('lamp', P.lampLondon(), 70, 'satin');
      reg('bollard', P.bollard(), 80, 'satin');
      reg('phonebox', P.phoneBox(), 10, 'satin');
      reg('postbox', P.postBox(), 10, 'satin');
    } else {
      reg('lamp', P.lampLagos(), 70, 'satin');
      reg('globe', P.lampGlobe(), 50, 'satin');
      for (let v = 0; v < 3; v++) reg(`palm${v}`, P.palm(v * 13 + 5, 0.9 + v * 0.1), 70);
      for (let v = 0; v < 3; v++) reg(`stall${v}`, P.marketStall(v * 11 + 1), 50);
      for (let v = 0; v < 2; v++) reg(`umbrella${v}`, P.umbrella(v * 5 + 9), 50);
      reg('pole', P.powerPole(), 30);
      reg('cables', cables(), 30, 'matte', 'none');
      reg('billboard', P.billboard(), 10, 'satin');
      reg('bed', P.stripedBed(TILE - 4, 3), 30);
    }
    // Standing people on the pavements.
    const looks = crowdLooks(city, 12);
    looks.forEach((look, i) => reg(`idle${i}`, makePerson(look), 40, 'matte', 'cast'));
    // Shop signs and billboards share one atlas texture.
    const atlas = signAtlas(city);
    this.signMaterial?.map?.dispose();
    this.signMaterial = atlasMaterial(atlas.texture);
    S.kind('sign', new THREE.PlaneGeometry(1, 1), this.signMaterial, 260, 'none', true);
    S.kind('board', new THREE.PlaneGeometry(1, 1), this.signMaterial, 12, 'none', true);
    this.kit = { id: city, side, buildings, shop: atlas.shop, board: atlas.board, looks: looks.length };
    // Landmarks and skyline.
    for (const g of this.landmarkGeo.values()) g.dispose();
    this.landmarkGeo.clear();
    if (city === 'london') this.landmarkGeo.set('tower-bridge', towerBridge().build());
    else this.landmarkGeo.set('cathedral', cathedral().build());
    if (this.skylineMesh) {
      this.skylineMesh.geometry.dispose();
      this.skylineMesh.removeFromParent();
    }
    this.skylineMesh = new THREE.Mesh(skyline(city, city === 'london' ? 0xcde7f6 : 0xe3ecee), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    this.stage.far.add(this.skylineMesh);
    (this.water.material as THREE.MeshStandardMaterial).color.setHex(city === 'london' ? 0x5ea3d4 : 0x3f98d4);
  }

  /** Start a drive: rebuild everything around `dist`. */
  start(layout: Layout, dist: number): void {
    this.layout = layout;
    this.clearTiles();
    for (const m of this.landmarks.values()) m.removeFromParent();
    this.landmarks.clear();
    this.update(dist, 0);
  }

  private clearTiles(): void {
    for (const handles of this.tiles.values()) for (const h of handles) this.scatter.remove(h);
    this.tiles.clear();
  }

  /** Stream tiles in and out around the player. */
  update(dist: number, dt: number): void {
    const layout = this.layout;
    if (!layout || !this.kit) return;
    const first = Math.floor((dist - BEHIND) / TILE);
    const last = Math.floor((dist + AHEAD) / TILE);
    for (const [i, handles] of this.tiles) {
      if (i >= first && i <= last) continue;
      for (const h of handles) this.scatter.remove(h);
      this.tiles.delete(i);
    }
    for (let i = first; i <= last; i++) if (!this.tiles.has(i)) this.tiles.set(i, this.buildTile(i, layout, this.kit));
    // Landmarks within view.
    const wanted = layout.landmarksIn(dist - 260, dist + AHEAD + 260);
    const keys = new Set(wanted.map((w) => w.key));
    for (const [k, m] of this.landmarks) if (!keys.has(k)) {
      m.removeFromParent();
      this.landmarks.delete(k);
    }
    for (const lm of wanted) {
      if (this.landmarks.has(lm.key)) continue;
      const geo = this.landmarkGeo.get(lm.kind);
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, matte());
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (lm.kind === 'cathedral') {
        mesh.position.set(this.kit.side * 34, 0, -lm.at);
        mesh.rotation.y = -this.kit.side * (Math.PI / 2);
      } else mesh.position.set(0, 0, -lm.at);
      this.stage.world.add(mesh);
      this.landmarks.set(lm.key, mesh);
    }
    // The water stays under the camera; its ripples scroll with the road and drift a little.
    this.water.position.x = this.stage.camera.position.x;
    this.water.position.z = this.stage.camera.position.z;
    this.drift = (this.drift + dt * 0.01) % 1;
    this.waterMap.offset.set(this.drift, ((((-dist / 60) % 1) + 1) % 1));
  }

  /** Lay out one tile: road, both sides, buildings, props and people. */
  private buildTile(i: number, layout: Layout, kit: CityKit): Handle[] {
    const S = this.scatter;
    const out: Handle[] = [];
    const put = (id: string, m: THREE.Matrix4, cell?: Cell): void => {
      const h = S.place(id, m, cell);
      if (h) out.push(h);
    };
    const d0 = i * TILE;
    const dm = d0 + TILE / 2;
    const theme = layout.stretch(dm).theme;
    const rng = mulberry32(hashString(`${layout.area.id}:${i}`));
    put('road', at(0, 0, dm));
    const bay = layout.bayAt(dm);
    for (const sign of [-1, 1] as const) {
      const tag = sign > 0 ? 'R' : 'L';
      const kind = sideKind(theme, sign, kit.side);
      const isBaySide = sign === kit.side && bay !== null && kind === 'street';
      const entry = isBaySide && dm > (bay?.at ?? 0);
      if (kind === 'bridge') put(`bridge-${tag}`, at(0, 0, dm));
      else if (kind === 'water') put(`water-${tag}`, at(0, 0, dm));
      else if (isBaySide) put(`${entry ? 'bayin' : 'bayout'}-${tag}`, at(0, 0, dm));
      else put(`street-${tag}`, at(0, 0, dm));
      const ry = -sign * (Math.PI / 2);
      const x = (o: number): number => sign * o;
      const z = (o: number): number => d0 + o;
      if (kind === 'bridge') {
        for (const o of [6, 18]) put('lamp', at(x(BRIDGE_DECK - 0.4), 0.2, z(o), sign > 0 ? Math.PI : 0));
        continue;
      }
      if (kind === 'water') {
        put(kit.id === 'london' ? 'lamp' : 'globe', at(x(8.0), 0.16, z(12), sign > 0 ? Math.PI : 0));
        if (kit.id === 'lagos' && rng() < 0.7) put(`palm${Math.floor(rng() * 3)}`, at(x(6.9), 0.16, z(4 + rng() * 6)));
        if (rng() < 0.35) put(`boat${Math.floor(rng() * 2)}`, at(x(26 + rng() * 50), -2.9, z(rng() * TILE), rng() * Math.PI * 2));
        if (rng() < 0.5) this.idlePerson(put, x(6.6 + rng() * 1.2), z(rng() * TILE), rng, kit);
        continue;
      }
      // Street side: buildings along the building line.
      const landmark = layout.nearLandmark(dm, 34) && sign === kit.side && kit.id === 'lagos';
      if (!landmark) this.buildings(put, theme, sign, d0, rng, kit);
      else put(`tree${Math.floor(rng() * 3)}`, at(x(14), 0, z(12)));
      // Street furniture between the kerb and the shops.
      const lampX = isBaySide ? KERB + BAY_DEPTH + 0.8 : KERB + 0.7;
      if ((i + (sign > 0 ? 1 : 0)) % 2 === 0) put('lamp', at(x(lampX), 0.16, z(12), sign > 0 ? Math.PI : 0));
      if (isBaySide && bay) {
        const off = bay.at - d0;
        if (entry) {
          put('stopsign', at(x(KERB + BAY_DEPTH + 0.9), 0.16, z(TILE - 3), ry));
        } else {
          put('shelter', at(x(KERB + BAY_DEPTH + 2.6), 0.16, z(Math.max(3, off + 2)), ry));
        }
        continue;
      }
      this.furniture(put, theme, sign, d0, i, rng, kit);
    }
    return out;
  }

  private buildings(put: (id: string, m: THREE.Matrix4, cell?: Cell) => void, theme: Theme, sign: -1 | 1, d0: number, rng: Rng, kit: CityKit): void {
    const choices = THEME_BUILDINGS[theme];
    if (choices.length === 0) return;
    let cursor = rng() * 1.5;
    let guard = 0;
    while (cursor < TILE - 4 && guard++ < 6) {
      const k = weightedPick(choices, rng);
      const variants = k ? kit.buildings[k] : undefined;
      if (!variants || variants.length === 0) break;
      const v = pick(variants, rng);
      const w = v.art.w;
      if (cursor + w > TILE + 4) break;
      const centre = d0 + cursor + w / 2;
      const ry = -sign * (Math.PI / 2);
      const m = at(sign * BUILD_LINE, 0, centre, ry).clone();
      put(v.id, m);
      for (const slot of v.art.signs) {
        const cells = slot.kind === 'board' ? kit.board : kit.shop;
        const cell = cells.length ? pick(cells, rng) : undefined;
        const local = new THREE.Matrix4().compose(new THREE.Vector3(slot.x, slot.y, slot.z), new THREE.Quaternion(), new THREE.Vector3(slot.w, slot.h, 1));
        put('sign', m.clone().multiply(local), cell);
      }
      cursor += w + (rng() < 0.3 ? 0.6 + rng() * 1.2 : 0.05);
    }
  }

  private furniture(put: (id: string, m: THREE.Matrix4, cell?: Cell) => void, theme: Theme, sign: -1 | 1, d0: number, i: number, rng: Rng, kit: CityKit): void {
    const x = (o: number): number => sign * o;
    const z = (o: number): number => d0 + o;
    const face = sign > 0 ? -Math.PI / 2 : Math.PI / 2;
    const tree = (o: number, xo = 8.6): void => put(`tree${Math.floor(rng() * 3)}`, at(x(xo), 0.16, z(o), rng() * 6));
    switch (theme) {
      case 'london-street':
      case 'london-quay':
        if (rng() < 0.65) tree(4 + rng() * 4);
        if (rng() < 0.45) tree(16 + rng() * 4);
        if (rng() < 0.5) put('bollard', at(x(KERB + 0.5), 0.16, z(2 + rng() * 20)));
        if (rng() < 0.3) put('bin', at(x(KERB + 0.6), 0.16, z(8 + rng() * 8)));
        if (rng() < 0.08) put('phonebox', at(x(9.6), 0.16, z(6 + rng() * 12), face));
        else if (rng() < 0.1) put('postbox', at(x(KERB + 0.8), 0.16, z(6 + rng() * 12)));
        if (rng() < 0.12) put('planter', at(x(9.8), 0.16, z(3 + rng() * 18), face));
        break;
      case 'london-warehouse':
        for (let o = 3; o < TILE; o += 4) if (rng() < 0.7) put('bollard', at(x(KERB + 0.5), 0.16, z(o)));
        if (rng() < 0.3) tree(12);
        break;
      case 'lagos-island':
      case 'lagos-marina':
        if (rng() < 0.45) tree(4 + rng() * 10);
        if (rng() < 0.35) put(`umbrella${Math.floor(rng() * 2)}`, at(x(8.8), 0.16, z(14 + rng() * 6)));
        if (rng() < 0.2) put(`stall${Math.floor(rng() * 3)}`, at(x(9.4), 0.16, z(rng() * 20), face));
        break;
      case 'lagos-market':
        // Wole Wole's markets: stalls and umbrellas crowding the pavement.
        for (let o = 2; o < TILE - 1; o += 3.4 + rng() * 2) {
          const r = rng();
          if (r < 0.45) put(`stall${Math.floor(rng() * 3)}`, at(x(7.6 + rng() * 2), 0.16, z(o), face + (rng() - 0.5) * 0.4));
          else if (r < 0.75) put(`umbrella${Math.floor(rng() * 2)}`, at(x(7.2 + rng() * 2.6), 0.16, z(o)));
        }
        break;
      case 'lagos-ikeja':
        if (sign === -kit.side) {
          put('pole', at(x(KERB + 0.8), 0.16, z(TILE / 2), face));
          put('cables', at(x(KERB + 0.8), 0.16, z(TILE / 2), face + (sign > 0 ? Math.PI / 2 : -Math.PI / 2)));
          if (i % 5 === 0) put('billboard', at(x(BUILD_LINE - 1.5), 0, z(12), face));
        }
        if (rng() < 0.5) tree(6 + rng() * 12);
        if (rng() < 0.35) put(`umbrella${Math.floor(rng() * 2)}`, at(x(9.2), 0.16, z(rng() * TILE)));
        break;
      case 'lagos-vi':
      case 'lagos-lagoon':
        put(`palm${Math.floor(rng() * 3)}`, at(x(8.2), 0.16, z(5)));
        put(`palm${Math.floor(rng() * 3)}`, at(x(8.2), 0.16, z(17)));
        if (i % 2 === 0) put('bed', at(x(6.3), 0.16, z(12), Math.PI / 2));
        else if (rng() < 0.6) put('planter', at(x(9.6), 0.16, z(11), face));
        break;
      case 'london-bridge':
        break;
    }
    const people = theme === 'lagos-market' ? 4 : theme.startsWith('lagos') ? 2 : 1.4;
    for (let k = 0; k < people; k++) if (rng() < (people - k > 1 ? 0.9 : people - k)) this.idlePerson(put, x(6.4 + rng() * 4), z(rng() * TILE), rng, kit);
  }

  private idlePerson(put: (id: string, m: THREE.Matrix4) => void, x: number, d: number, rng: Rng, kit: CityKit): void {
    put(`idle${Math.floor(rng() * kit.looks)}`, at(x, 0.16, d, rng() * Math.PI * 2));
  }

  /** Draw-call count for profiling. */
  activeKinds(): number {
    return this.scatter.activeKinds();
  }
}
