// One frozen Lagos view at a chosen hour, with the sun and shadow state printed.
const HOUR = Number(process.env.HOUR ?? 15.5);
export default async ({ go, ev, shot, size, sleep }) => {
  await size(1280, 800);
  await go('./lagos/?debug', 9000);
  await ev(`(() => { const g = __wole; g.save.guided = true; g.event.startHour = ${HOUR}; g.event.weather = 'clear'; g.save.settings.graphics = 'high'; g.stage.setQuality('high'); g.startRun('run'); const r = g.run; r.rain = 0; r.rainTarget = 0; r.nextRainAt = Infinity; r.haze = 0; return true; })()`);
  await sleep(4000);
  await ev(`(() => { __wole.mode = 'paused'; return true; })()`);
  await sleep(800);
  console.log(JSON.stringify(await ev(`(() => {
    const s = __wole.stage;
    let casters = 0, receivers = 0;
    s.scene.traverse((o) => { if (o.isMesh && o.visible) { if (o.castShadow) casters++; if (o.receiveShadow) receivers++; } });
    return { cast: s.sun.castShadow, enabled: s.renderer.shadowMap.enabled, map: !!s.sun.shadow.map, pos: s.sun.position.toArray().map(v => +v.toFixed(1)), target: s.sun.target.position.toArray().map(v => +v.toFixed(1)), sun: +s.sun.intensity.toFixed(2), hemi: +s.hemi.intensity.toFixed(2), casters, receivers, quality: s.quality };
  })()`)));
  if (process.env.DIM) {
    // Freeze the sky with almost no fill light, to see the sun's shadows on their own.
    await ev(`(() => { const s = __wole.stage; s.setSky = () => {}; s.hemi.intensity = 0.15; return true; })()`);
    await sleep(800);
  }
  await shot(process.env.NAME ?? 'dbg');
};
