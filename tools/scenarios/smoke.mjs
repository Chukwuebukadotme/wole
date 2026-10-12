// Smoke test: repeated drives, pause and resume, restart, finishing a route, results, and no console errors.
export default async ({ go, ev, click, phone, sleep }) => {
  await phone();
  await go('./?debug', 9000);
  await ev(`__wrl.save.tutorialDone = true; __wrl.save.passengers = true; __wrl.save.mode = 'route'; 1`);
  for (let run = 1; run <= 3; run++) {
    if (run === 1) await click('[data-action=play]');
    await sleep(500);
    await ev(`__wrl.fastForward(3.5); __wrl.controls.gas('t', true); __wrl.fastForward(4); __wrl.controls.gas('t', false); 1`);
    await ev(`__wrl.controls.pause(); 1`);
    await sleep(300);
    const paused = await ev(`__wrl.state`);
    await click('[data-action=resume]');
    await ev(`__wrl.resumeT = 0.01; 1`);
    await sleep(600);
    await ev(`__wrl.fastForward(4); 1`);
    const st = await ev(`JSON.stringify({ state: __wrl.state, phase: __wrl.drive && __wrl.drive.phase, dist: __wrl.debug().dist, people: __wrl.debug().people, cars: __wrl.debug().cars })`);
    console.log(`run ${run}: paused=${paused} ${st}`);
    if (run < 3) {
      await ev(`__wrl.controls.pause(); 1`);
      await sleep(200);
      await click('[data-action=restart]');
      await sleep(800);
    }
  }
  // Finish the route and open the results.
  await ev(`(() => { const d = __wrl.drive; d.dist = d.layout.routeEnd - 30; return 1; })()`);
  await ev(`__wrl.fastForward(8); 1`);
  await sleep(1500);
  console.log('end state', await ev(`__wrl.state`));
  await click('[data-action=results]');
  await sleep(500);
  console.log('results shown', await ev(`!!document.querySelector('.results')`), 'saved bank', await ev(`JSON.parse(localStorage.getItem('westroadlife.save.v3')).cities.london.bank`));
};
