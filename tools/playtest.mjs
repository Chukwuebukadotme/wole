// Headless Chrome play-test driver: runs a scenario module against the dev server and saves screenshots.
// Usage: node tools/playtest.mjs <scenario.mjs> [base-url]
// Screenshots go to tools/out/ (git-ignored). Set PLAYTEST_TMP to choose where the throwaway browser profile lives.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'out');
mkdirSync(out, { recursive: true });
const scenario = resolve(process.argv[2] ?? '');
const base = process.argv[3] ?? 'http://localhost:5199/';
const profile = mkdtempSync(join(process.env.PLAYTEST_TMP ?? tmpdir(), 'wrl-chrome-'));
const port = 9333;
const chrome = spawn(
  process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--disk-cache-size=1',
    '--window-size=1280,800',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
let nextId = 1;
const pending = new Map();
const logs = [];

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) {
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((r, j) => {
          ws.onopen = r;
          ws.onerror = j;
        });
        ws.onmessage = (m) => {
          const msg = JSON.parse(m.data);
          if (msg.id && pending.has(msg.id)) {
            const { res, rej } = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) rej(new Error(JSON.stringify(msg.error)));
            else res(msg.result);
          } else if (msg.method === 'Runtime.consoleAPICalled') {
            logs.push(`[${msg.params.type}] ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
          } else if (msg.method === 'Runtime.exceptionThrown') {
            logs.push(`[exception] ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`);
          }
        };
        return;
      }
    } catch {
      // Chrome is still starting.
    }
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}

const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = nextId++;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });

async function ev(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}

const tools = {
  base,
  out,
  sleep,
  send,
  ev,
  async shot(name) {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    const path = join(out, `${name}.png`);
    writeFileSync(path, Buffer.from(r.data, 'base64'));
    console.log('shot', path);
  },
  click: (selector) => ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('no element ' + ${JSON.stringify(selector)}); el.click(); return true; })()`),
  phone: () => send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }),
  size: (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }),
  async go(path, wait = 4000) {
    await send('Page.navigate', { url: new URL(path, base).href });
    await sleep(wait);
  },
};

try {
  await connect();
  await send('Runtime.enable');
  await send('Page.enable');
  const mod = await import(scenario);
  await mod.default(tools);
} catch (err) {
  console.error('FAILED', err.message);
  process.exitCode = 1;
} finally {
  const shown = logs.filter((l) => !l.includes('[vite]'));
  if (shown.length) console.log('--- console ---\n' + shown.slice(-40).join('\n'));
  try {
    ws?.close();
  } catch {
    // Already closed.
  }
  chrome.kill('SIGKILL');
  await sleep(500);
  rmSync(profile, { recursive: true, force: true });
}
