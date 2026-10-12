// Tile screenshots from tools/out into one contact sheet.
// Usage: SHEET=name COLS=3 WIDTH=1500 IMAGES=a,b,c node tools/playtest.mjs tools/scenarios/sheet.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
export default async ({ out, send, ev, shot, sleep }) => {
  const imgs = (process.env.IMAGES ?? '').split(',').filter(Boolean);
  const cols = Number(process.env.COLS ?? 3);
  const width = Number(process.env.WIDTH ?? 1500);
  const html = `<!doctype html><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},1fr);gap:2px;width:${width}px">${imgs
    .map((i) => `<div style="position:relative"><img src="${i}.png" style="width:100%;display:block"><span style="position:absolute;left:4px;top:2px;color:#fff;font:13px sans-serif;text-shadow:0 0 3px #000">${i}</span></div>`)
    .join('')}</body>`;
  const file = join(out, 'sheet.html');
  writeFileSync(file, html);
  await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `file://${file}` });
  await sleep(1200);
  const h = await ev('document.body.scrollHeight');
  await send('Emulation.setDeviceMetricsOverride', { width, height: h, deviceScaleFactor: 1, mobile: false });
  await sleep(300);
  await shot(process.env.SHEET ?? 'sheet');
};
