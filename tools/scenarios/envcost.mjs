// What the sky environment lighting costs per frame (same view, Low tier, with and without it).
export default async ({ go, ev, click, phone, sleep }) => {
  await phone();
  await go('./?debug', 9000);
  await ev(`__wrl.save.tutorialDone = true; 1`);
  await click('[data-action=play]');
  await sleep(600);
  await ev(`__wrl.fastForward(3.5); __wrl.drive.dist = __wrl.drive.layout.runStart + 1000; __wrl.traffic.clear(); __wrl.fastForward(0.5); __wrl.controls.pause(); __wrl.applyQuality('low'); 1`);
  const env = await ev(`(window.__env = __wrl.stage.scene.environment, 1)`);
  void env;
  for (const [label, js] of [['with environment', `__wrl.stage.scene.environment = window.__env`], ['without environment', `__wrl.stage.scene.environment = null`]]) {
    await ev(`${js}; 1`);
    await sleep(2500);
    await ev(`__wrl.perfReset(); 1`);
    await sleep(5000);
    console.log(label, JSON.stringify(await ev('__wrl.perfStats()')));
  }
};
