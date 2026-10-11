// Development view: every vehicle and a crowd of people on a plain ground, for checking the art. Opened with ?gallery.
import * as THREE from 'three';
import type { CityId } from '../config/cities.ts';
import { PLAYER_PAINT, type ModelId } from '../config/vehicles.ts';
import { G, Shape } from '../art/kit.ts';
import { matte, satin } from '../art/materials.ts';
import { crowdLooks, makePerson } from '../art/people.ts';
import { vehicleGeometry, vehicleParts } from '../art/vehicles.ts';
import { Stage } from '../world/stage.ts';

export function startGallery(host: HTMLElement): void {
  const params = new URLSearchParams(window.location.search);
  const city = (params.get('city') === 'lagos' ? 'lagos' : 'london') as CityId;
  const view = params.get('gallery') || 'front';
  const stage = new Stage(host);
  stage.setCity(city, false);
  const ground = new Shape().add(G.box(200, 0.1, 200), 0xd9cdb6, { y: -0.05 }).build();
  const groundMesh = new THREE.Mesh(ground, matte());
  groundMesh.receiveShadow = true;
  stage.scene.add(groundMesh);
  const single = params.get('model') as ModelId | null;
  const models: ModelId[] = single ? [single] : city === 'london' ? ['doubledecker', 'blackcab', 'hatchback', 'sedan', 'suv', 'motorbike', 'van'] : ['danfo', 'sedan', 'taxi', 'keke', 'suv', 'okada', 'brt'];
  let x = single ? -1e-3 : -14;
  for (const id of models) {
    const paint = PLAYER_PAINT[id as keyof typeof PLAYER_PAINT] ?? { body: 0xf2efe6, accent: 0x142b4e };
    const parts = vehicleParts(id, paint, city === 'london' ? -1 : 1);
    const mesh = new THREE.Mesh(vehicleGeometry(parts), satin());
    const w = mesh.geometry.boundingBox?.max.x ?? 1;
    if (!single) x += w + 0.9;
    mesh.position.set(single ? 0 : x, 0, 0);
    if (!single) x += w + 0.9;
    mesh.castShadow = true;
    stage.scene.add(mesh);
  }
  const looks = crowdLooks(city, 12);
  looks.forEach((look, i) => {
    const m = new THREE.Mesh(makePerson(look).build(), matte());
    m.position.set(-10 + i * 1.3, 0, single ? 40 : 6);
    m.rotation.y = view === 'people' ? Math.PI : 0;
    m.castShadow = true;
    stage.scene.add(m);
  });
  const cam = stage.camera;
  const place = (): void => {
    stage.resize();
    if (single) {
      const l = (single === 'doubledecker' || single === 'brt' ? 11 : single === 'motorbike' || single === 'okada' || single === 'keke' ? 4.2 : 6.5);
      if (view === 'rear') cam.position.set(l * 0.45, l * 0.42, l * 0.95);
      else cam.position.set(-l * 0.62, l * 0.36, -l * 0.8);
      cam.lookAt(0, single === 'doubledecker' ? 1.8 : 0.85, 0);
      return;
    }
    if (view === 'rear') cam.position.set(2, 9, 22);
    else if (view === 'people') cam.position.set(-2, 2.2, 13);
    else cam.position.set(-6, 7, -18);
    cam.lookAt(view === 'people' ? -2 : 2, view === 'people' ? 1.2 : 1, view === 'people' ? 6 : 0);
  };
  window.addEventListener('resize', place);
  place();
  const loop = (): void => {
    stage.follow(0, 2, 0);
    stage.render();
    requestAnimationFrame(loop);
  };
  loop();
}
