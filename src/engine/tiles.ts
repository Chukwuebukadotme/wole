import * as THREE from 'three';
import { KERB_X, LANE_W, ROAD_W, TILE, laneX, type RouteDef, type StretchKind } from '../rules/data.ts';
import { sideBlocked, stretchAt } from '../rules/route.ts';
import { mod, pick, rand } from '../rules/util.ts';
import { lambert, night } from './materials.ts';
import { BOX, PLANE, billboardMaterials, makeBillboard, makeLamp, makePalm, makeStall } from './models.ts';
import {
  brtLaneTexture,
  buntingTexture,
  facadeVariants,
  grassTexture,
  groundTexture,
  kerbTexture,
  pavementTexture,
  railingTexture,
  roadTexture,
  waterTexture,
  type FacadeVariant,
} from './textures.ts';

export interface TileContext {
  readonly route: RouteDef;
  readonly runStart: number;
  readonly festive: boolean;
}

interface BuildingSlot {
  readonly group: THREE.Group;
  readonly body: THREE.Mesh;
  readonly front: THREE.Mesh;
  readonly awning: THREE.Mesh;
}

interface Side {
  readonly sign: -1 | 1;
  readonly buildings: BuildingSlot[];
  readonly stalls: THREE.Group[];
  readonly palms: THREE.Group[];
  readonly lamp: THREE.Group;
  readonly billboard: THREE.Group;
}

interface Tile {
  index: number;
  kind: StretchKind;
  readonly group: THREE.Group;
  readonly brt: THREE.Mesh;
  readonly land: THREE.Group;
  readonly sidewalks: THREE.Group;
  readonly verges: THREE.Group;
  readonly bridge: THREE.Group;
  readonly bunting: THREE.Mesh;
  readonly sides: readonly [Side, Side];
}

const AHEAD_TILES = 11;

/** Shared look for tile surfaces, created once. */
class Surfaces {
  readonly road = new THREE.MeshLambertMaterial({ map: roadTexture() });
  readonly brt = new THREE.MeshLambertMaterial({ map: brtLaneTexture(), transparent: true, depthWrite: false });
  readonly pavement = new THREE.MeshLambertMaterial({ map: pavementTexture() });
  readonly kerb = new THREE.MeshLambertMaterial({ map: kerbTexture() });
  readonly grass = new THREE.MeshLambertMaterial({ map: grassTexture() });
  readonly ground = new THREE.MeshLambertMaterial({ map: groundTexture() });
  readonly water = new THREE.MeshLambertMaterial({ map: waterTexture() });
  readonly railing = new THREE.MeshLambertMaterial({ map: railingTexture() });
  readonly bunting = new THREE.MeshBasicMaterial({ map: buntingTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false });
  readonly facades: { variant: FacadeVariant; material: THREE.MeshLambertMaterial }[];
  readonly awnings = [0x1b998b, 0xd7263d, 0x2e5eaa, 0xf46036, 0x3f3f3f].map((c) => lambert(c));

  constructor() {
    const n = night();
    this.facades = facadeVariants().map((variant) => {
      const material = new THREE.MeshLambertMaterial({ map: variant.map, emissiveMap: variant.glow, emissive: 0xffd9a0, emissiveIntensity: 0 });
      n.facades.push(material);
      return { variant, material };
    });
  }
}

function strip(width: number, material: THREE.Material, x: number, y: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, TILE).rotateX(-Math.PI / 2), material);
  m.position.set(x, y, 0);
  return m;
}

export class Tiles {
  private readonly tiles: Tile[] = [];
  private readonly surf = new Surfaces();
  private readonly scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    for (let i = 0; i <= AHEAD_TILES + 1; i++) this.tiles.push(this.makeTile());
  }

  private makeTile(): Tile {
    const s = this.surf;
    const group = new THREE.Group();
    group.add(strip(ROAD_W, s.road, 0, 0));
    const brt = strip(LANE_W - 0.2, s.brt, laneX(0), 0.012);
    group.add(brt);

    const land = new THREE.Group();
    for (const sign of [-1, 1] as const) {
      land.add(strip(0.45, s.kerb, sign * (KERB_X + 0.22), 0.17));
      const face = new THREE.Mesh(BOX, lambert(0x55524c));
      face.scale.set(0.06, 0.16, TILE);
      face.position.set(sign * (KERB_X + 0.03), 0.08, 0);
      land.add(face);
      land.add(strip(200, s.ground, sign * (KERB_X + 5 + 100), 0.0));
    }
    const sidewalks = new THREE.Group();
    sidewalks.add(strip(5, s.pavement, -(KERB_X + 2.5), 0.15), strip(5, s.pavement, KERB_X + 2.5, 0.15));
    const verges = new THREE.Group();
    verges.add(strip(5, s.grass, -(KERB_X + 2.5), 0.05), strip(5, s.grass, KERB_X + 2.5, 0.05));
    land.add(sidewalks, verges);

    const bridge = new THREE.Group();
    const deck = new THREE.Mesh(BOX, lambert(0x8f8a80));
    deck.scale.set(ROAD_W + 1.4, 1.2, TILE);
    deck.position.y = -0.62;
    bridge.add(deck);
    for (const sign of [-1, 1] as const) {
      const rail = new THREE.Mesh(BOX, s.railing);
      rail.scale.set(0.5, 0.95, TILE);
      rail.position.set(sign * (KERB_X + 0.45), 0.47, 0);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 8, 10), lambert(0x7d786f));
      pillar.position.set(sign * (KERB_X - 1.5), -5, 0);
      const water = strip(320, s.water, sign * (KERB_X + 160), -8);
      bridge.add(rail, pillar, water);
    }

    const bunting = new THREE.Mesh(PLANE, s.bunting);
    bunting.scale.set(ROAD_W + 4, 1.2, 1);
    bunting.position.set(0, 7.2, 0);

    const sides = ([-1, 1] as const).map((sign): Side => {
      const buildings: BuildingSlot[] = [];
      for (let k = 0; k < 3; k++) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(BOX, lambert(0xe3d5b8));
        const front = new THREE.Mesh(PLANE, this.surf.facades[0]?.material ?? lambert(0xe3d5b8));
        const awning = new THREE.Mesh(BOX, this.surf.awnings[0] ?? lambert(0x1b998b));
        g.add(body, front, awning);
        buildings.push({ group: g, body, front, awning });
      }
      const stalls = [makeStall(), makeStall()];
      const palms = [makePalm(), makePalm()];
      const lamp = makeLamp(-sign);
      const billboard = makeBillboard();
      return { sign, buildings, stalls, palms, lamp, billboard };
    }) as unknown as readonly [Side, Side];

    for (const side of sides) {
      for (const b of side.buildings) group.add(b.group);
      group.add(...side.stalls, ...side.palms, side.lamp, side.billboard);
    }
    group.add(land, bridge, bunting);
    this.scene.add(group);
    return { index: -1, kind: 'city', group, brt, land, sidewalks, verges, bridge, bunting, sides };
  }

  /** Rebuild every tile around `dist` (start of a run or route change). */
  reset(dist: number, ctx: TileContext): void {
    const first = Math.floor(dist / TILE) - 1;
    this.tiles.forEach((tile, i) => this.configure(tile, first + i, ctx));
    this.update(dist, ctx);
  }

  /** Recycle tiles that fell behind and position all tiles relative to the bus. */
  update(dist: number, ctx: TileContext): void {
    const first = Math.floor(dist / TILE) - 1;
    const last = first + this.tiles.length - 1;
    const free = this.tiles.filter((t) => t.index < first || t.index > last);
    if (free.length > 0) {
      const used = new Set(this.tiles.map((t) => t.index));
      let next = first;
      for (const tile of free) {
        while (used.has(next)) next++;
        used.add(next);
        this.configure(tile, next, ctx);
      }
    }
    for (const t of this.tiles) t.group.position.z = -((t.index + 0.5) * TILE - dist);
  }

  /** Stretch kind under the bus, for sky and audio choices. */
  kindAt(dist: number, ctx: TileContext): StretchKind {
    return stretchAt(ctx.route, dist - ctx.runStart).kind;
  }

  private configure(tile: Tile, index: number, ctx: TileContext): void {
    tile.index = index;
    const start = index * TILE;
    const local = mod(start - ctx.runStart, ctx.route.length);
    const stretch = stretchAt(ctx.route, local + TILE / 2);
    tile.kind = stretch.kind;
    const bridge = stretch.kind === 'bridge';
    tile.brt.visible = stretch.brt === true;
    tile.land.visible = !bridge;
    tile.bridge.visible = bridge;
    tile.sidewalks.visible = stretch.kind === 'city' || stretch.kind === 'market';
    tile.verges.visible = stretch.kind === 'expressway';
    tile.bunting.visible = ctx.festive && !bridge && index % 3 === 0;
    const pillarsVisible = index % 2 === 0;
    for (const child of tile.bridge.children) if (child instanceof THREE.Mesh && child.geometry instanceof THREE.CylinderGeometry) child.visible = pillarsVisible;
    for (const side of tile.sides) this.configureSide(side, stretch.kind, ctx, local, index);
  }

  private configureSide(side: Side, kind: StretchKind, ctx: TileContext, local: number, index: number): void {
    const { sign } = side;
    const hideAll = (): void => {
      for (const b of side.buildings) b.group.visible = false;
      for (const s of side.stalls) s.visible = false;
      for (const p of side.palms) p.visible = false;
      side.lamp.visible = false;
      side.billboard.visible = false;
    };
    hideAll();
    if (kind === 'bridge') {
      side.lamp.visible = (index + (sign > 0 ? 1 : 0)) % 2 === 0;
      side.lamp.position.set(sign * (KERB_X + 0.45), 0.9, 0);
      return;
    }
    // Local z inside the tile: +15 is the near edge, -15 the far edge.
    const zFor = (offset: number): number => TILE / 2 - offset;
    const blocked = (from: number, to: number, what: 'building' | 'stall'): boolean =>
      [from, (from + to) / 2, to].some((o) => sideBlocked(ctx.route, local + o, sign, what));

    const setback = kind === 'expressway' ? 10 : 0;
    let cursor = rand(0, 2);
    for (const slot of side.buildings) {
      if (kind === 'expressway' && slot !== side.buildings[0]) break;
      const options = this.surf.facades.filter((f) => f.variant.len <= TILE - cursor);
      if (options.length === 0) break;
      const { variant, material } = pick(options);
      const from = cursor;
      cursor += variant.len + rand(0.3, 1.5);
      if (blocked(from, from + variant.len, 'building')) continue;
      const depth = variant.id === 'wall' ? 0.5 : rand(6, 9);
      slot.group.visible = true;
      slot.group.position.set(sign * (KERB_X + 5 + setback + depth / 2), 0, zFor(from + variant.len / 2));
      slot.body.scale.set(depth, variant.height, variant.len);
      slot.body.position.y = variant.height / 2;
      slot.body.material = lambert(variant.wall);
      slot.front.material = material;
      slot.front.scale.set(variant.len, variant.height, 1);
      slot.front.position.set(-sign * (depth / 2 + 0.02), variant.height / 2, 0);
      slot.front.rotation.y = -sign * (Math.PI / 2);
      slot.awning.visible = variant.awning;
      if (variant.awning) {
        slot.awning.material = pick(this.surf.awnings);
        slot.awning.scale.set(1.3, 0.1, variant.len * 0.75);
        slot.awning.position.set(-sign * (depth / 2 + 0.65), 2.9, 0);
      }
    }

    if (kind === 'market') {
      side.stalls.forEach((stall, k) => {
        const offset = 7 + k * 15 + rand(-2, 2);
        if (blocked(offset - 2, offset + 2, 'stall')) return;
        stall.visible = true;
        stall.position.set(sign * (KERB_X + 2.6), 0.15, zFor(offset));
        stall.rotation.y = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
      });
    }

    const lampOffset = 4 + (index % 2) * 13;
    if (!blocked(lampOffset - 1, lampOffset + 1, 'stall')) {
      side.lamp.visible = true;
      side.lamp.position.set(sign * (KERB_X + 1.1), kind === 'expressway' ? 0.05 : 0.15, zFor(lampOffset));
    }
    if (kind === 'expressway' || (kind === 'city' && Math.random() < 0.5)) {
      const palm = side.palms[0];
      const offset = 20 + rand(-3, 3);
      if (palm && !blocked(offset - 1, offset + 1, 'stall')) {
        palm.visible = true;
        palm.position.set(sign * (KERB_X + (kind === 'expressway' ? 2.6 : 3.8)), 0.1, zFor(offset));
      }
    }
    if (kind === 'expressway' && sign < 0) {
      const palm = side.palms[1];
      if (palm) {
        palm.visible = true;
        palm.position.set(sign * (KERB_X + 3.4), 0.05, zFor(8));
      }
    }
    if (kind === 'expressway' && index % 4 === (sign > 0 ? 1 : 3) && !blocked(10, 20, 'building')) {
      side.billboard.visible = true;
      side.billboard.position.set(sign * (KERB_X + 7), 0, zFor(15));
      side.billboard.rotation.y = sign > 0 ? -0.6 : 0.6;
      const board = side.billboard.userData.board as THREE.Mesh | undefined;
      if (board) board.material = pick(billboardMaterials());
    }
  }
}
