// Motion checks: a lane change caught mid-way (body yaw, steered wheels, roll), braking pitch, and a bus stop with
// people stepping on and off.
export default async ({ go, ev, shot, click, phone, sleep }) => {
  await phone();
  await go('./?debug', 9000);
  await ev(`__wrl.save.tutorialDone = true; __wrl.save.mode = 'route'; __wrl.save.passengers = true; __wrl.save.cities.london.vehicle = 'doubledecker'; 1`);
  await click('[data-action=play]');
  await sleep(600);
  await ev(`__wrl.fastForward(3.5); 1`);
  await ev(`(() => { const d = __wrl.drive; d.dist = d.layout.runStart + 120; d.slot = 1; d.x = 0; __wrl.traffic.clear(); return 1; })()`);
  await ev(`__wrl.fastForward(0.5); __wrl.controls.lane(1); __wrl.fastForward(0.35); 1`);
  await sleep(300);
  await shot('motion-lane');
  console.log('lane', JSON.stringify(await ev(`({ x: __wrl.drive.x, vx: __wrl.drive.vx, yaw: __wrl.player.group.rotation.y })`)));
  // Hard braking from cruise.
  await ev(`__wrl.controls.brake('t', true); __wrl.fastForward(0.4); 1`);
  await sleep(300);
  await shot('motion-brake');
  console.log('brake', JSON.stringify(await ev(`({ speed: __wrl.drive.speed, accel: __wrl.drive.longAccel })`)));
  await ev(`__wrl.controls.brake('t', false); 1`);
  // Drive into the first stop and catch people boarding.
  for (let i = 0; i < 80; i++) {
    const r = await ev(`(() => { const d = __wrl.drive; const s = d.layout.nextStop(d.dist); const to = s.at - d.dist; __wrl.traffic.clear();
      __wrl.controls.brake('p', false);
      if (d.phase === 'stopped') return 'stopped';
      if (to < 32 && d.slot !== 3) d.steer(-1);
      if (d.slot === 3 && to < 15) __wrl.controls.brake('p', true);
      return Math.round(to); })()`);
    if (r === 'stopped') break;
    await ev(`__wrl.fastForward(0.25); 1`);
  }
  await ev(`__wrl.controls.brake('p', false); __wrl.fastForward(1.6); 1`);
  await sleep(500);
  await shot('motion-board');
  await ev(`__wrl.fastForward(1.2); 1`);
  await sleep(500);
  await shot('motion-board2');
};
