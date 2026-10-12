import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MODEL_SIZE, type ModelId, type Paint } from '../rules/cars.ts';
import { compact, shade } from './compact.ts';
import { basic, night, reflective } from './materials.ts';
import { box, contactShadow, makeCar, makeTruck } from './models.ts';
// Low-poly vehicles from Kenney's Car Kit (CC0, see assets/cars/LICENSE-kenney.txt).
import paletteUrl from '../assets/cars/colormap.png?url';
import deliveryUrl from '../assets/cars/delivery.glb?url';
import refuseUrl from '../assets/cars/garbage-truck.glb?url';
import hatchUrl from '../assets/cars/hatchback-sports.glb?url';
import hyperUrl from '../assets/cars/race-future.glb?url';
import formulaUrl from '../assets/cars/race.glb?url';
import coupeUrl from '../assets/cars/sedan-sports.glb?url';
import saloonUrl from '../assets/cars/sedan.glb?url';
import luxsuvUrl from '../assets/cars/suv-luxury.glb?url';
import jeepUrl from '../assets/cars/suv.glb?url';
import taxiUrl from '../assets/cars/taxi.glb?url';
import pickupUrl from '../assets/cars/truck.glb?url';
import vanUrl from '../assets/cars/van.glb?url';

type FileModel = Exclude<ModelId, 'lorry'>;

/** Each model paints its bodywork from one square of the shared palette: [row, column] of the 4 × 8 grid. */
const FILES: Readonly<Record<FileModel, { url: string; paint: readonly [number, number]; electric?: boolean; openWheel?: boolean }>> = {
  saloon: { url: saloonUrl, paint: [1, 6] },
  hatch: { url: hatchUrl, paint: [1, 3] },
  ehatch: { url: hatchUrl, paint: [1, 3], electric: true },
  coupe: { url: coupeUrl, paint: [1, 6] },
  jeep: { url: jeepUrl, paint: [1, 3] },
  luxsuv: { url: luxsuvUrl, paint: [1, 4] },
  pickup: { url: pickupUrl, paint: [1, 3] },
  taxi: { url: taxiUrl, paint: [1, 4] },
  van: { url: vanUrl, paint: [1, 7] },
  formula: { url: formulaUrl, paint: [1, 6], openWheel: true },
  hyper: { url: hyperUrl, paint: [1, 7], electric: true, openWheel: true },
  boxtruck: { url: deliveryUrl, paint: [1, 3] },
  refuse: { url: refuseUrl, paint: [1, 3] },
};

const PALETTE_SIZE = 128;
const templates = new Map<FileModel, THREE.Group>();
const materials = new Map<string, THREE.MeshStandardMaterial>();
let palette: HTMLImageElement | null = null;
let loading: Promise<void> | null = null;

/** True once the 3D models are in; until then vehicles are drawn as boxes. */
export const carModelsReady = (): boolean => templates.size > 0;

/** Palette texture with one square repainted. Small and without mipmaps, so squares never bleed together. */
function paletteMaterial(model: FileModel, color: Paint): THREE.MeshStandardMaterial {
  const [row, col] = FILES[model].paint;
  const key = color === null ? 'base' : `${row}:${col}:${color}`;
  let m = materials.get(key);
  if (m) return m;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PALETTE_SIZE;
  const g = canvas.getContext('2d');
  if (!g || !palette) throw new Error('Car palette is not loaded');
  g.drawImage(palette, 0, 0, PALETTE_SIZE, PALETTE_SIZE);
  if (color !== null) {
    const cw = PALETTE_SIZE / 8;
    const ch = PALETTE_SIZE / 4;
    const img = g.getImageData(col * cw, row * ch, cw, ch);
    const px = img.data;
    const luma = (i: number): number => 0.299 * (px[i] ?? 0) + 0.587 * (px[i + 1] ?? 0) + 0.114 * (px[i + 2] ?? 0);
    let top = 1;
    for (let i = 0; i < px.length; i += 4) top = Math.max(top, luma(i));
    const tint = new THREE.Color(color);
    for (let i = 0; i < px.length; i += 4) {
      // Keep the model's shading: darker parts of the square stay darker in the new colour.
      const k = Math.min(1.1, luma(i) / top);
      px[i] = Math.min(255, tint.r * 255 * k);
      px[i + 1] = Math.min(255, tint.g * 255 * k);
      px[i + 2] = Math.min(255, tint.b * 255 * k);
    }
    g.putImageData(img, col * cw, row * ch);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  // glTF texture coordinates start at the top of the image.
  map.flipY = false;
  map.generateMipmaps = false;
  map.minFilter = THREE.LinearFilter;
  // Painted bodywork with a soft sheen that picks up the sky.
  m = reflective(new THREE.MeshStandardMaterial({ map, roughness: 0.42, metalness: 0.05 }));
  materials.set(key, m);
  return m;
}

/** Stretch a model to its road size (wheels stay round), face it down the road and add night lights. */
function normalise(source: THREE.Group, model: FileModel): THREE.Group {
  const size = MODEL_SIZE[model];
  const bounds = new THREE.Box3().setFromObject(source);
  const sx = size.w / (bounds.max.x - bounds.min.x);
  const sy = size.h / (bounds.max.y - bounds.min.y);
  const sz = size.l / (bounds.max.z - bounds.min.z);
  const cz = (bounds.max.z + bounds.min.z) / 2;
  const inner = new THREE.Group();
  // The kit's cars face +z; the game drives towards −z.
  inner.rotation.y = Math.PI;
  for (const child of [...source.children]) {
    const wheel = child.name.startsWith('wheel');
    child.position.set(child.position.x * sx, (child.position.y - bounds.min.y) * sy, (child.position.z - cz) * sz);
    child.scale.set(sx, sy, wheel ? sy : sz);
    inner.add(child);
  }
  inner.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      // Swap the kit's material for the game's own; the palette image is loaded separately.
      const old = o.material as THREE.MeshStandardMaterial;
      old.map?.dispose();
      old.dispose();
      o.material = paletteMaterial(model, null);
    }
  });
  // Road wheels spin and the front pair steer; a spare on the tailgate stays put.
  inner.traverse((o) => {
    if (!/^wheel-(front|back)-(left|right)/.test(o.name)) return;
    o.userData.wheel = true;
    o.userData.front = o.name.includes('front');
    o.rotation.order = 'YXZ';
  });
  const g = new THREE.Group();
  g.add(inner, contactShadow(size.w, size.l));
  const n = night();
  const front = -size.l / 2 - 0.02;
  if (FILES[model].openWheel) {
    // Race cars have no headlights, just a rain light under the rear wing.
    g.add(box(0.3, 0.12, 0.05, n.tail, 0, 0.42, -front - 0.15));
    if (FILES[model].electric) g.add(box(size.w * 0.6, 0.05, 0.05, basic(0x4fd1ff), 0, 0.3, front + 0.2));
  } else {
    const y = Math.min(0.9, Math.max(0.45, size.h * 0.38));
    const hx = size.w * 0.3;
    g.add(box(0.3, 0.13, 0.05, n.head, -hx, y, front), box(0.3, 0.13, 0.05, n.head, hx, y, front));
    g.add(box(0.3, 0.14, 0.05, n.tail, -hx, y, -front), box(0.3, 0.14, 0.05, n.tail, hx, y, -front));
    // Electric cars wear a thin blue light bar across the nose.
    if (FILES[model].electric) g.add(box(size.w * 0.7, 0.06, 0.05, basic(0x4fd1ff), 0, y + 0.16, front - 0.01));
  }
  // Each pair of lamps becomes one mesh; the model itself is left as it came.
  compact(g, 'vehicle', (o) => o === inner);
  shade(g, true, true);
  return g;
}

/** Fetch and prepare every model. Safe to call more than once; failures leave the box stand-ins in place. */
export function loadCarModels(): Promise<void> {
  loading ??= (async () => {
    try {
      const img = new Image();
      img.src = paletteUrl;
      await img.decode();
      palette = img;
      const manager = new THREE.LoadingManager();
      // The models ask for "Textures/colormap.png"; point them at the bundled copy.
      manager.setURLModifier((url) => (url.endsWith('colormap.png') ? paletteUrl : url));
      const loader = new GLTFLoader(manager);
      const scenes = new Map<string, Promise<THREE.Group>>();
      const entries = await Promise.all(
        (Object.keys(FILES) as FileModel[]).map(async (model) => {
          const url = FILES[model].url;
          let scene = scenes.get(url);
          if (!scene) {
            scene = loader.loadAsync(url).then((gltf) => gltf.scene);
            scenes.set(url, scene);
          }
          // Two models may share a file, so each gets its own copy.
          return [model, (await scene).clone(true)] as const;
        }),
      );
      for (const [model, scene] of entries) templates.set(model, normalise(scene, model));
    } catch (err) {
      templates.clear();
      console.warn('Car models could not load; using simple shapes instead.', err);
    }
  })();
  return loading;
}

/** A road vehicle in the given paint. Wheels are listed in `userData.wheels` for spinning. */
export function makeVehicle(model: ModelId, color: Paint): THREE.Group {
  const template = model === 'lorry' ? undefined : templates.get(model);
  if (!template) return model === 'lorry' || model === 'boxtruck' || model === 'refuse' ? makeTruck() : makeCar(color ?? undefined);
  const g = template.clone(true);
  const paint = paletteMaterial(model as FileModel, color);
  const wheels: THREE.Object3D[] = [];
  g.traverse((o) => {
    if (o.userData.wheel === true) wheels.push(o);
    // Palette meshes are the only ones with a standard material; the light boxes keep their own materials.
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && o.material.map) o.material = paint;
  });
  g.userData.wheels = wheels;
  // The models face +z inside their group, so their wheels turn forwards about x.
  g.userData.spinRate = 1 / 0.36;
  return g;
}
