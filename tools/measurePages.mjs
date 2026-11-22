// Measures the pages of the site in headless Chrome over CDP (FCP, load, long tasks, heap, DOM nodes, transferred bytes).
// Usage: node tools/measurePages.mjs <siteDir> <chromePath> [cpuSlowdown]   (env PAGES=a.html,b.html to pick pages)
// Serves <siteDir> on port 3999 with gzip (like GitHub Pages), cold cache, not logged in. Use WINDOWS-style paths (C:/...) on Windows.
// Measured on the old site on 2026-11-20. Reuse it after the migration to compare.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import os from 'node:os';

const [rootArg, chrome, slow = '1'] = process.argv.slice(2); const root = path.resolve(rootArg);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/homepage.html';
    const file = path.join(root, p);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    const ext = path.extname(file);
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'max-age=600' };
    const raw = fs.readFileSync(file);
    if (['.html', '.js', '.css', '.json'].includes(ext)) {
        headers['Content-Encoding'] = 'gzip';
        res.writeHead(200, headers);
        return res.end(zlib.gzipSync(raw, { level: 6 }));
    }
    res.writeHead(200, headers);
    res.end(raw);
});
await new Promise((r) => server.listen(3999, r));

const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'));
const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${userDir}`, '--no-first-run', '--disable-gpu', '--window-size=1400,900', 'about:blank'], { stdio: 'ignore' });
let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try { wsUrl = (await (await fetch('http://127.0.0.1:9333/json/list')).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch { /* not ready */ }
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const listeners = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else listeners.forEach((l) => l(d)); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Page.enable'); await send('Network.enable'); await send('Performance.enable');
await send('Emulation.setCPUThrottlingRate', { rate: Number(slow) });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__lt = 0; window.__ltMax = 0;
  new PerformanceObserver(l => l.getEntries().forEach(e => { window.__lt += e.duration; window.__ltMax = Math.max(window.__ltMax, e.duration); })).observe({type:'longtask', buffered:true});` });

const pages = process.env.PAGES ? process.env.PAGES.split(',') : ['homepage.html', 'contribute.html', 'encyclopedia.html', 'espers.html', 'units.html', 'inventory.html', 'unitSearch.html', 'builder.html'];
const out = [];
for (const page of pages) {
    let bytes = 0, reqs = 0, same = 0; const big = [];
    const sizes = new Map();
    const l = (d) => {
        if (d.method === 'Network.requestWillBeSent') { reqs++; sizes.set(d.params.requestId, d.params.request.url); }
        if (d.method === 'Network.loadingFinished') { bytes += d.params.encodedDataLength; const u = sizes.get(d.params.requestId); if (u && d.params.encodedDataLength > 300000) big.push(`${u.split('/').slice(-2).join('/')}:${Math.round(d.params.encodedDataLength / 1024)}K`); }
    };
    listeners.push(l);
    await send('Network.clearBrowserCache'); await send('Network.setCacheDisabled', { cacheDisabled: true });
    await send('Page.navigate', { url: 'about:blank' });
    await new Promise((r) => setTimeout(r, 300));
    const t0 = Date.now();
    await send('Page.navigate', { url: `http://127.0.0.1:3999/${page}` });
    // wait until the page has had 2.5 s without network activity (max 60 s)
    let last = reqs, quietSince = Date.now(), lastBytes = bytes;
    while (Date.now() - t0 < 60000) {
        await new Promise((r) => setTimeout(r, 250));
        if (reqs !== last || bytes !== lastBytes) { last = reqs; lastBytes = bytes; quietSince = Date.now(); }
        if (Date.now() - quietSince > 2500) break;
    }
    const settled = quietSince - t0;
    const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value;
    const nav = await ev(`(() => { const n = performance.getEntriesByType('navigation')[0]; const f = performance.getEntriesByType('paint').find(p => p.name==='first-contentful-paint'); return {dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: f ? Math.round(f.startTime) : null, longTaskTotal: Math.round(window.__lt), longTaskMax: Math.round(window.__ltMax), nodes: document.getElementsByTagName('*').length}; })()`);
    const metrics = (await send('Performance.getMetrics')).result.metrics;
    const heap = Math.round(metrics.find((m) => m.name === 'JSHeapUsedSize').value / 1048576);
    out.push({ page, ...nav, heapMB: heap, transferKB: Math.round(bytes / 1024), requests: reqs, networkQuietAtMs: settled, big: big.join(' ') });
    listeners.splice(listeners.indexOf(l), 1);
}
console.log(JSON.stringify(out, null, 1));
ws.close(); proc.kill(); server.close();
process.exit(0);
