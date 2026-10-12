// Lagos (Wole Wole) motion and play checks: lane change, braking, a stop with boarding, pause/resume and repeated runs.
// Prints the measured body motion and saves frozen frames as lm-*.png.
const setup = `(() => {
  const g = __wole;
  g.save.guided = true;
  g.event.startHour = 15.5;
  g.event.weather = 'clear';
  g.save.settings.graphics = 'high';
  g.stage.setQuality('high');
  g.startRun('run');
  const r = g.run;
  r.rain = 0; r.rainTarget = 0; r.nextRainAt = Infinity; r.haze = 0;
  r.body = 99; r.bodyMax = 99;
  return true;
})()`;
const pose = `(() => { const g = __wole; return { mode: g.mode, speed: +g.speed.toFixed(2), x: +g.x.toFixed(2), vx: +g.vx.toFixed(2), yawDeg: +(g.yaw * 57.3).toFixed(1), rollDeg: +(g.roll.x * 57.3).toFixed(2), pitchDeg: +(g.pitch.x * 57.3).toFixed(2), steerDeg: +(g.steerAngle * 57.3).toFixed(1) }; })()`;
const freeze = `(() => { __wole.mode = 'paused'; return true; })()`;
const unfreeze = `(() => { __wole.mode = 'play'; return true; })()`;

export default async ({ go, ev, shot, size, sleep }) => {
  await size(1280, 800);
  await go('./lagos/?debug', 9000);
  await ev(setup);
  await sleep(2500);

  // Lane change to the right, frozen part-way.
  await ev(`(() => { __wole.laneChange(1); return true; })()`);
  await sleep(150);
  await ev(freeze);
  console.log('lane change', JSON.stringify(await ev(pose)));
  await sleep(600);
  await shot('lm-lane');
  await ev(unfreeze);
  await sleep(1500);
  console.log('after lane change', JSON.stringify(await ev(pose)));

  // Hard braking from speed, frozen while the nose is down.
  await ev(`(() => { __wole.setGas(true); return true; })()`);
  await sleep(2500);
  await ev(`(() => { __wole.setGas(false); __wole.setBrake(true); return true; })()`);
  await sleep(350);
  await ev(freeze);
  console.log('braking', JSON.stringify(await ev(pose)));
  await sleep(600);
  await shot('lm-brake');
  await ev(unfreeze);
  await sleep(2500);
  console.log('stopped', JSON.stringify(await ev(pose)));
  await ev(`(() => { __wole.setBrake(false); return true; })()`);

  // Pause and resume through the game's own controls: distance must not move while paused.
  await sleep(1500);
  await ev(`(() => { __wole.pause(); return true; })()`);
  const d0 = await ev('__wole.dist');
  await sleep(1500);
  const d1 = await ev('__wole.dist');
  await ev(`(() => { __wole.resume(); return true; })()`);
  await sleep(4500);
  const d2 = await ev('__wole.dist');
  console.log('pause', JSON.stringify({ heldWhilePaused: d1 === d0, movedAfterResume: +(d2 - d1).toFixed(1), mode: await ev('__wole.mode') }));

  // Pull into the next stop in the kerb lane, with the road cleared, and watch the boarding.
  await ev(`(() => {
    const g = __wole;
    const st = g.nextStop();
    g.lane = 3; g.x = 4.8; g.vx = 0;
    g.dist = st.at - 22;
    g.speed = 6;
    g.traffic.reset(g.dist);
    g.setBrake(true);
    return true;
  })()`);
  let parkedAt = 0;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    if (await ev('!!__wole.run.parked')) {
      parkedAt = i;
      break;
    }
  }
  console.log('parked', await ev('JSON.stringify(__wole.run.parked)'), 'after', parkedAt * 0.25, 's');
  await sleep(500);
  await ev(freeze);
  await sleep(500);
  await shot('lm-board-1');
  await ev(unfreeze);
  await sleep(900);
  await ev(freeze);
  console.log('boarding', JSON.stringify(await ev(`(() => { const st = __wole.nextStop(); return { waiting: st.waiting.length, movers: st.movers.map((m) => ({ board: m.board, stage: m.stage, y: +m.mesh.position.y.toFixed(2) })), seats: __wole.run.riders.length }; })()`)));
  await sleep(500);
  await shot('lm-board-2');
  await ev(unfreeze);
  await ev(`(() => { __wole.setBrake(false); return true; })()`);

  // Three short runs back to back: no errors, and the scene does not grow.
  const counts = [];
  for (let i = 0; i < 3; i++) {
    await ev(`(() => { __wole.endRun('quit'); return true; })()`);
    await sleep(2500);
    await ev(setup);
    await sleep(3500);
    counts.push(await ev(`(() => { let n = 0; __wole.stage.scene.traverse((o) => { if (o.isMesh && o.visible) n++; }); return { visibleMeshes: n, geometries: __wole.stage.renderer.info.memory.geometries }; })()`));
  }
  console.log('after repeated runs', JSON.stringify(counts), 'mode', await ev('__wole.mode'));
};
