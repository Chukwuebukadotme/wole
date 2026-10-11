import * as THREE from 'three';
import { KERB_X, LANES, LANE_W, ROAD_W, TUNING, laneX, KERB } from '../rules/data.ts';
import { lambert } from './materials.ts';
import { BOX, PLANE, box, makeFigure, makeLamp } from './models.ts';
import { bayTexture, cameraSignTexture, chequerTexture, nameTagTexture, plateTexture, raceBannerTexture, stationSignTexture, stopLineTexture, tollSignTexture } from './textures.ts';

const ZONE_LEN = TUNING.zoneBefore + TUNING.zoneAfter;
const plateCache = new Map<string, THREE.MeshBasicMaterial>();
let shared: {
  stopBay: THREE.MeshLambertMaterial;
  fuelBay: THREE.MeshLambertMaterial;
  line: THREE.MeshBasicMaterial;
  toll: THREE.MeshBasicMaterial;
  camera: THREE.MeshBasicMaterial;
  crossRoad: THREE.MeshLambertMaterial;
  station: Map<number, THREE.MeshBasicMaterial>;
} | null = null;

function mats(): NonNullable<typeof shared> {
  if (!shared) {
    shared = {
      stopBay: new THREE.MeshLambertMaterial({ map: bayTexture('#f6b800', ['BUS', 'STOP']), transparent: true, depthWrite: false }),
      fuelBay: new THREE.MeshLambertMaterial({ map: bayTexture('#2ecc71', ['FUEL', 'BAY'], true), transparent: true, depthWrite: false }),
      line: new THREE.MeshBasicMaterial({ map: stopLineTexture(), transparent: true, depthWrite: false }),
      toll: new THREE.MeshBasicMaterial({ map: tollSignTexture() }),
      camera: new THREE.MeshBasicMaterial({ map: cameraSignTexture() }),
      crossRoad: new THREE.MeshLambertMaterial({ color: 0x3d3d40 }),
      station: new Map(),
    };
  }
  return shared;
}

export function plateMaterial(name: string): THREE.MeshBasicMaterial {
  let m = plateCache.get(name);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: plateTexture('BUS STOP', name) });
    plateCache.set(name, m);
  }
  return m;
}

const BAY_GEO = new THREE.PlaneGeometry(LANE_W - 0.3, ZONE_LEN).rotateX(-Math.PI / 2);

/** Bus stop: yellow bay in the kerb lane, shelter and name plate. Origin = middle of the bay. */
export function makeStop(name: string): { group: THREE.Group; plate: THREE.Mesh } {
  const g = new THREE.Group();
  const bay = new THREE.Mesh(BAY_GEO, mats().stopBay);
  bay.position.set(laneX(KERB), 0.02, 0);
  g.add(bay);
  g.add(box(2.0, 0.12, 4.4, 0x1b6e4f, KERB_X + 2.4, 2.55, 0));
  g.add(box(0.08, 1.6, 4.0, 0x2f3a38, KERB_X + 3.35, 1.4, 0));
  g.add(box(0.6, 0.12, 3.2, 0x8b6b4a, KERB_X + 3.0, 0.65, 0));
  g.add(box(0.1, 2.4, 0.1, 0x3d3d3d, KERB_X + 1.5, 1.35, -2), box(0.1, 2.4, 0.1, 0x3d3d3d, KERB_X + 1.5, 1.35, 2));
  // Name plate at the far end of the bay: readable on approach, clear of the camera once parked.
  g.add(box(0.1, 3.2, 0.1, 0x3d3d3d, KERB_X + 0.75, 1.75, -13));
  const plate = new THREE.Mesh(PLANE, plateMaterial(name));
  plate.scale.set(2.4, 0.82, 1);
  plate.position.set(KERB_X + 0.75, 3.1, -12.94);
  g.add(plate);
  return { group: g, plate };
}

/** Filling station on the right: forecourt, canopy, pumps, price board, green fuel bay. */
export function makeStation(price: number): THREE.Group {
  const m = mats();
  let sign = m.station.get(price);
  if (!sign) {
    sign = new THREE.MeshBasicMaterial({ map: stationSignTexture(price) });
    m.station.set(price, sign);
  }
  const g = new THREE.Group();
  const bay = new THREE.Mesh(BAY_GEO, m.fuelBay);
  bay.position.set(laneX(KERB), 0.02, 0);
  g.add(bay);
  const forecourt = new THREE.Mesh(new THREE.PlaneGeometry(16, 40).rotateX(-Math.PI / 2), lambert(0x9a958b));
  forecourt.position.set(KERB_X + 8, 0.16, 0);
  g.add(forecourt);
  g.add(box(11, 0.6, 16, 0xf6b800, KERB_X + 8.5, 5.2, 0), box(11.1, 0.18, 16.1, 0x0f5c4d, KERB_X + 8.5, 4.85, 0));
  for (const z of [-5, 5]) {
    g.add(box(0.5, 4.8, 0.5, 0xe8e2d4, KERB_X + 5, 2.5, z), box(0.5, 4.8, 0.5, 0xe8e2d4, KERB_X + 12, 2.5, z));
    g.add(box(0.8, 1.5, 0.5, 0xd7263d, KERB_X + 6.5, 0.9, z), box(0.82, 0.3, 0.52, 0xfafafa, KERB_X + 6.5, 1.45, z));
  }
  g.add(box(0.2, 5, 0.2, 0x3d3d3d, KERB_X + 1.2, 2.5, 17));
  const board = new THREE.Mesh(PLANE, sign);
  board.scale.set(3, 1.5, 1);
  board.position.set(KERB_X + 1.2, 5.6, 17.1);
  g.add(board);
  const attendant = makeFigure('worker');
  attendant.position.set(KERB_X + 5.6, 0.16, 2);
  g.add(attendant);
  return g;
}

export interface JunctionVisual {
  readonly group: THREE.Group;
  readonly warden: THREE.Group;
  readonly arm: THREE.Group | null;
  readonly signal: THREE.Mesh;
}

/** Junction: stop line, cross street and a traffic warden on a podium. Origin = stop line. */
export function makeJunction(): JunctionVisual {
  const m = mats();
  const g = new THREE.Group();
  const line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 0.6).rotateX(-Math.PI / 2), m.line);
  line.position.set(0, 0.025, 0);
  g.add(line);
  const cross = new THREE.Mesh(new THREE.PlaneGeometry(140, 10).rotateX(-Math.PI / 2), m.crossRoad);
  cross.position.set(0, 0.2, -6);
  g.add(cross);
  for (let i = 0; i < 8; i++) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 3).rotateX(-Math.PI / 2), m.line);
    stripe.position.set(-ROAD_W / 2 + 1 + i * (ROAD_W / 8), 0.024, 2.4);
    g.add(stripe);
  }
  const podium = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.5, 14), lambert(0xf6b800));
  podium.position.set(-(KERB_X + 1.6), 0.4, -1.2);
  g.add(podium);
  const warden = makeFigure('warden');
  warden.position.set(-(KERB_X + 1.6), 0.65, -1.2);
  warden.rotation.y = -Math.PI / 2;
  g.add(warden);
  const signal = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), new THREE.MeshBasicMaterial({ color: 0xd7263d }));
  signal.position.set(-(KERB_X + 1.6), 3.4, -1.2);
  g.add(signal, box(0.1, 1.2, 0.1, 0x3d3d3d, -(KERB_X + 1.6), 2.6, -1.2));
  for (const sign of [-1, 1] as const) {
    const lamp = makeLamp(-sign);
    lamp.position.set(sign * (KERB_X + 1.1), 0.15, -12);
    g.add(lamp);
  }
  const arm = (warden.userData.arm as THREE.Group | undefined) ?? null;
  return { group: g, warden, arm, signal };
}

export interface TollVisual {
  readonly group: THREE.Group;
  readonly arms: THREE.Group[];
}

/** Toll plaza across the road with a barrier arm per lane. Origin = barrier line. */
export function makeToll(): TollVisual {
  const m = mats();
  const g = new THREE.Group();
  // Canopy sits above the chase camera (about 7–8.6 m) so it never sweeps across the view.
  g.add(box(ROAD_W + 4, 0.8, 6, 0x16365c, 0, 9.6, -1.5));
  const sign = new THREE.Mesh(PLANE, m.toll);
  sign.scale.set(ROAD_W + 3, 0.8, 1);
  sign.position.set(0, 9.6, 1.52);
  g.add(sign);
  for (let i = 0; i <= LANES; i++) {
    const x = -ROAD_W / 2 + i * LANE_W;
    g.add(box(0.8, 2.4, 4, 0xe8e2d4, x, 1.2, -1.5), box(0.5, 6.8, 0.5, 0x5b5f66, x, 5.8, -1.5));
  }
  const arms: THREE.Group[] = [];
  for (let lane = 0; lane < LANES; lane++) {
    const pivot = new THREE.Group();
    pivot.position.set(laneX(lane) - LANE_W / 2 + 0.45, 1.05, 0.6);
    const bar = new THREE.Mesh(BOX, lambert(0xd7263d));
    bar.scale.set(LANE_W - 0.6, 0.14, 0.14);
    bar.position.x = (LANE_W - 0.6) / 2;
    const white = box(0.5, 0.15, 0.15, 0xfafafa, (LANE_W - 0.6) / 2, 0, 0);
    pivot.add(bar, white);
    g.add(pivot);
    arms.push(pivot);
  }
  return { group: g, arms };
}

/** BRT enforcement camera on the median side. Origin = camera line. */
export function makeBrtCamera(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.18, 6, 0.18, 0x5b5f66, -(KERB_X + 1.2), 3, 0), box(1.6, 0.14, 0.14, 0x5b5f66, -(KERB_X + 0.5), 5.9, 0));
  g.add(box(0.5, 0.35, 0.7, 0x2b2b2b, -(KERB_X - 0.2), 5.65, 0));
  const sign = new THREE.Mesh(PLANE, mats().camera);
  sign.scale.set(1.8, 0.9, 1);
  sign.position.set(-(KERB_X + 1.2), 3.6, 0.1);
  g.add(sign);
  return g;
}

/** Race start or finish gantry across the whole road, with a chequered line. Origin = the line. */
export function makeRaceGate(word: 'START' | 'FINISH'): THREE.Group {
  const g = new THREE.Group();
  // Banner height matches the toll canopy, above the chase camera.
  g.add(box(ROAD_W + 3, 1.3, 0.3, 0x141414, 0, 9.6, 0));
  const banner = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({ map: raceBannerTexture(word) }));
  banner.scale.set(ROAD_W + 2.6, 1.1, 1);
  banner.position.set(0, 9.6, 0.16);
  g.add(banner);
  for (const sign of [-1, 1] as const) g.add(box(0.45, 10.2, 0.45, 0x5b5f66, sign * (KERB_X + 1), 5.1, 0));
  const line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 1.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: chequerTexture(), transparent: true, depthWrite: false }));
  line.position.y = 0.025;
  g.add(line);
  return g;
}

/** Name tag that floats above a racer or rival; dispose it when the race ends. */
export function makeNameTag(name: string, color: string, height: number, width = 1.9): THREE.Sprite {
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTagTexture(name, color) }));
  tag.scale.set(width, width * 0.28, 1);
  tag.position.y = height + 0.75;
  tag.name = 'nametag';
  return tag;
}

export function removeNameTag(holder: THREE.Object3D): void {
  const tag = holder.getObjectByName('nametag');
  if (!(tag instanceof THREE.Sprite)) return;
  tag.removeFromParent();
  tag.material.map?.dispose();
  tag.material.dispose();
}
