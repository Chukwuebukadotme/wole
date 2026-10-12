// Frame cost of each graphics tier on the same London view (phone size).
export default async ({ go, ev, click, phone, sleep }) => {
  await phone();
  await go('./?debug', 9000);
  await ev(`__wrl.save.tutorialDone = true; __wrl.save.cities.london.area = 'river-run'; 1`);
  await click('[data-action=play]');
  await sleep(600);
  await ev(`__wrl.fastForward(3.5); 1`);
  await ev(`(() => { const d = __wrl.drive; d.dist = d.layout.runStart + 1000; d.slot = 1; d.x = 0; __wrl.traffic.clear(); return 1; })()`);
  await ev(`__wrl.fastForward(0.5); __wrl.controls.pause(); 1`);
  for (const tier of ['high', 'medium', 'low']) {
    await ev(`__wrl.applyQuality('${tier}'); 1`);
    await sleep(2500);
    await ev(`__wrl.perfReset(); 1`);
    await sleep(5000);
    console.log(tier, JSON.stringify(await ev('__wrl.perfStats()')));
  }
};
