// Lagos (Wole Wole) before/after views: the same moments at noon and at night, phone and desktop, plus the garage
// and a frame-time sample. Run with TAG=lb (before) or another tag: TAG=la node tools/playtest.mjs tools/scenarios/lagos-compare.mjs
const TAG = process.env.TAG ?? 'lb';
// Software rendering is slow enough that Auto would step down to Low; pin a tier (ignored by builds without tiers).
const TIER = process.env.TIER ?? 'high';

// Clear weather, no first-run guide, a fixed hour; the run then freezes for the screenshot.
const setup = (hour) => `(() => {
  const g = window.__wole;
  g.save.guided = true;
  g.event.startHour = ${hour};
  g.event.weather = 'clear';
  if (g.stage.setQuality) {
    g.save.settings.graphics = '${TIER}';
    g.stage.setQuality('${TIER}');
  }
  return true;
})()`;
const startRun = `(() => {
  const g = window.__wole;
  g.startRun('run');
  const r = g.run;
  r.rain = 0; r.rainTarget = 0; r.nextRainAt = Infinity; r.haze = 0;
  r.body = 99; r.bodyMax = 99;
  return true;
})()`;
const freeze = `(() => { window.__wole.mode = 'paused'; return true; })()`;
const frameTimes = `new Promise((done) => {
  const gaps = [];
  let last = performance.now();
  const tick = (t) => {
    gaps.push(t - last);
    last = t;
    if (gaps.length < 40) requestAnimationFrame(tick);
    else {
      gaps.sort((a, b) => a - b);
      const info = window.__wole.stage.renderer.info.render;
      done({ median: Math.round(gaps[20]), p90: Math.round(gaps[36]), calls: info.calls, tris: info.triangles });
    }
  };
  requestAnimationFrame(tick);
})`;

async function view(t, label, hour, wait) {
  await t.go('./lagos/?debug', 9000);
  await t.ev(setup(hour));
  await t.ev(startRun);
  await t.sleep(wait);
  console.log(label, 'perf', JSON.stringify(await t.ev(frameTimes)));
  await t.ev(freeze);
  await t.sleep(1200);
  await t.shot(`${TAG}-${label}`);
}

export default async (t) => {
  await t.phone();
  await t.go('./lagos/?debug', 9000);
  await t.shot(`${TAG}-phone-title`);
  await view(t, 'phone-noon', 12, 7000);
  await view(t, 'phone-night', 21.5, 7000);
  await t.size(1280, 800);
  await view(t, 'desk-noon', 15, 7000);
  await view(t, 'desk-dusk', 18.4, 7000);
  // Garage: the danfo close up.
  await t.go('./lagos/?debug', 9000);
  await t.ev(`(() => { window.__wole.openGarage(); return true; })()`);
  await t.sleep(3000);
  await t.shot(`${TAG}-desk-garage`);
};
