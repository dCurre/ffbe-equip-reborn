// Takes a screenshot of one page in headless Chrome over CDP, to compare the old site with the Angular one.
// Usage: node tools/screenshotPage.mjs <url> <out.png> <chromePath> [theme=dark|light] [width=1400] [height=900] [fullPage=1] [fakeDrive.json]
// fakeDrive.json maps a Google Drive file name (`units_GL.json`) to its content: the page then behaves as logged in with that
// data, and no request reaches Google (to look at the pages that need the user's data).
// The theme is written to localStorage `theme` before the page loads (both sites read that key).
// Use WINDOWS-style paths (C:/...) on Windows.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const [url, out, chrome, theme = 'dark', width = '1400', height = '900', fullPage = '1', fakeDrivePath] = process.argv.slice(2);
const fakeDrive = fakeDrivePath ? JSON.parse(fs.readFileSync(fakeDrivePath, 'utf8')) : null;
if (!url || !out || !chrome) {
  console.error('Usage: node tools/screenshotPage.mjs <url> <out.png> <chromePath> [theme] [width] [height] [fullPage]');
  process.exit(1);
}

const port = 9334;
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shot-'));
const proc = spawn(
  chrome,
  ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`, '--no-first-run', '--disable-gpu', 'about:blank'],
  { stdio: 'ignore' },
);

try {
  let wsUrl;
  for (let i = 0; i < 50 && !wsUrl; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl;
    } catch {
      // Chrome is not ready yet
    }
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  const answerDrive = (requestId, requestUrl, method) => {
    const names = Object.keys(fakeDrive);
    const file = /\/files\/(\d+)\?alt=media/.exec(requestUrl);
    const body = file ? fakeDrive[names[Number(file[1])]] : { files: names.map((name, i) => ({ id: String(i), name })) };
    ws.send(
      JSON.stringify({
        id: ++id,
        method: 'Fetch.fulfillRequest',
        params: {
          requestId,
          responseCode: 200,
          responseHeaders: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Access-Control-Allow-Origin', value: '*' },
            { name: 'Access-Control-Allow-Headers', value: '*' },
            { name: 'Access-Control-Allow-Methods', value: '*' },
          ],
          body: Buffer.from(method === 'OPTIONS' ? '' : JSON.stringify(body)).toString('base64'),
        },
      }),
    );
  };
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      pending.get(d.id)(d);
      pending.delete(d.id);
    } else if (d.method === 'Fetch.requestPaused') {
      answerDrive(d.params.requestId, d.params.request.url, d.params.request.method);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const i = ++id;
      pending.set(i, resolve);
      ws.send(JSON.stringify({ id: i, method, params }));
    });

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: Number(width), height: Number(height), deviceScaleFactor: 1, mobile: Number(width) < 700 });
  const fakeLogin = fakeDrive
    ? `localStorage.setItem('googleDriveToken', JSON.stringify({ accessToken: 'fake', expiresAt: Date.now() + 3600000 }));`
    : '';
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try { localStorage.setItem('theme', '${theme}'); ${fakeLogin} } catch (e) {}`,
  });
  if (fakeDrive) await send('Fetch.enable', { patterns: [{ urlPattern: 'https://www.googleapis.com/*' }] });
  await send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 4000)); // lets the page, its data and its fonts load
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage === '1' });
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  console.log(`saved ${out}`);
  ws.close();
} finally {
  proc.kill();
}
