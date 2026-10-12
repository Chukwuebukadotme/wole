// Before/after views for the realism work: one representative London street, Tower Bridge and the double-decker.
// Usage: TAG=before node tools/playtest.mjs tools/scenarios/compare.mjs
const tag = process.env.TAG ?? 'now';
export default async ({ go, ev, shot, click, phone, size, sleep }) => {
  const views = [
    ['street', 1000],
    ['bridge', 560],
  ];
  for (const [device, setSize] of [['phone', phone], ['desk', () => size(1280, 720)]]) {
    await setSize();
    await go('./?debug', 9000);
    await ev(`__wrl.save.tutorialDone = true; __wrl.save.mode = 'route'; __wrl.save.passengers = true; __wrl.save.cities.london.area = 'river-run'; __wrl.save.cities.london.vehicle = 'doubledecker'; 1`);
    await click('[data-action=play]');
    await sleep(600);
    await ev(`__wrl.fastForward(3.5); 1`);
    for (const [name, at] of views) {
      // Same spot, same traffic every time: clear the cars and park the bus in the middle lane.
      await ev(`(() => { const d = __wrl.drive; d.dist = d.layout.runStart + ${at}; d.slot = 1; d.x = 0; __wrl.traffic.clear(); return 1; })()`);
      await ev(`__wrl.fastForward(0.6); 1`);
      await sleep(2500);
      await shot(`${tag}-${device}-${name}`);
    }
    if (device === 'phone') {
      await ev(`__wrl.perfReset(); 1`);
      await sleep(6000);
      console.log('perf', device, JSON.stringify(await ev('__wrl.perfStats()')));
    }
  }
  // Close-ups of the player's double-decker in the dev gallery.
  await size(800, 500);
  for (const angle of ['front', 'rear']) {
    await go(`./?gallery=${angle}&model=doubledecker`, 4000);
    await shot(`${tag}-bus-${angle}`);
  }
};
