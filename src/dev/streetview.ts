// Development view: drive slowly down an area with no traffic, to check the scenery. Opened with ?street.
import { areaById, type CityId } from '../config/cities.ts';
import { Layout } from '../world/layout.ts';
import { Stage } from '../world/stage.ts';
import { Streets } from '../world/streets.ts';

export function startStreetView(host: HTMLElement): void {
  const params = new URLSearchParams(window.location.search);
  const city = (params.get('city') === 'lagos' ? 'lagos' : 'london') as CityId;
  const area = areaById(city, params.get('area') ?? '');
  const stage = new Stage(host);
  stage.setCity(city, params.has('haze'));
  const streets = new Streets(stage);
  streets.setCity(city);
  const layout = new Layout(area, 0, params.get('mode') === 'endless');
  let dist = Number(params.get('d') ?? 0);
  const speed = Number(params.get('v') ?? 0);
  const x = Number(params.get('x') ?? (city === 'london' ? -3.4 : 3.4));
  const high = params.has('high');
  streets.start(layout, dist);
  (window as unknown as { __street?: unknown }).__street = { streets, stage, set: (d: number) => (dist = d) };
  let last = performance.now();
  const loop = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    dist += speed * dt;
    stage.resize();
    const cam = stage.camera;
    cam.fov = cam.aspect < 0.8 ? 72 : 52;
    cam.updateProjectionMatrix();
    if (high) cam.position.set(x * 0.6 - 30, 60, 40);
    else cam.position.set(x * 0.7, 7.5, 13);
    cam.lookAt(x * 0.85, high ? 0 : 1.5, high ? -60 : -20);
    stage.follow(dist, x, dt);
    streets.update(dist, dt);
    stage.render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
