// Coverage report for the browser scripts loaded through `vm` (Node's --experimental-test-coverage
// does not see them). Runs the tests with NODE_V8_COVERAGE, merges the V8 data of every test process
// and prints, per target file, the uncovered lines and the functions never called.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const STATIC = fileURLToPath(new URL('../static/', import.meta.url));
const TARGETS = ['formula.js', 'builder/common.js'];

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffbe-cov-'));
const run = spawnSync(process.execPath, ['--test', 'test/static/*.js'], {
    env: { ...process.env, NODE_V8_COVERAGE: dir }, encoding: 'utf8', stdio: ['ignore', 'ignore', 'inherit']
});
if (run.status !== 0) { console.error('The tests fail: fix them before reading the coverage.'); process.exit(1); }

// url -> { covered: Uint8Array (1 = executed in at least one process), uncalled: Set of function names }
const files = new Map();
for (const target of TARGETS) {
    const source = fs.readFileSync(path.join(STATIC, target), 'utf8');
    files.set(pathToFileURL(path.join(STATIC, target)).href, { target, source, covered: new Uint8Array(source.length), calledFunctions: new Set(), allFunctions: new Set() });
}

for (const name of fs.readdirSync(dir)) {
    const { result } = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    for (const script of result) {
        const file = files.get(script.url);
        if (!file) continue;
        const counts = new Int32Array(file.source.length);
        const ranges = script.functions.flatMap((fn) => fn.ranges.map((r) => ({ ...r, fn }))).sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
        for (const r of ranges) counts.fill(r.count, r.startOffset, r.endOffset); // inner ranges come after their parent
        counts.forEach((count, offset) => { if (count > 0) file.covered[offset] = 1; });
        for (const fn of script.functions) {
            if (!fn.functionName) continue;
            const key = `${fn.functionName}@${fn.ranges[0].startOffset}`;
            file.allFunctions.add(key);
            if (fn.ranges[0].count > 0) file.calledFunctions.add(key);
        }
    }
}
fs.rmSync(dir, { recursive: true, force: true });

for (const file of files.values()) {
    const lines = file.source.split('\n');
    let offset = 0, code = 0, uncovered = [];
    lines.forEach((line, index) => {
        const start = offset; offset += line.length + 1;
        if (!line.trim() || /^\s*(\/\/|\/\*|\*|\})/.test(line)) return; // blank, comments, closing braces
        code++;
        let executed = false;
        for (let i = 0; i < line.length; i++) if (file.covered[start + i] && line[i].trim()) { executed = true; break; }
        if (!executed) uncovered.push(index + 1);
    });
    const ranges = [];
    for (const n of uncovered) {
        const last = ranges[ranges.length - 1];
        if (last && n - last[1] <= 3) last[1] = n; else ranges.push([n, n]); // merge ranges separated by <= 2 skipped lines
    }
    const uncalled = [...file.allFunctions].filter((f) => !file.calledFunctions.has(f)).map((f) => f.split('@')[0]);
    const percent = (100 * (code - uncovered.length) / code).toFixed(1);
    console.log(`\n${file.target}: ${percent}% of ${code} code lines covered, ${uncalled.length} of ${file.allFunctions.size} functions never called`);
    console.log('  never called:', uncalled.join(', ') || '-');
    console.log('  uncovered line ranges:', ranges.map(([a, b]) => (a === b ? a : `${a}-${b}`)).join(' ') || '-');
}
