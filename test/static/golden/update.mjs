// Regenerates test/static/golden/calc.json (npm run test:golden:update).
// Run it only when a change of the calculation results is intended, and review the diff.
import fs from 'node:fs';
import { computeGolden, SAMPLE_EVERY } from './golden.mjs';

const { result } = computeGolden();
const ids = Object.keys(result);
const units = Object.fromEntries(ids.map((id) => [id, [result[id].count, result[id].hash]]));
// A readable sample (full values), so a failure on these units shows the numbers that changed.
const sample = Object.fromEntries(ids.filter((_, index) => index % SAMPLE_EVERY === 0).map((id) => [id, result[id].values]));

fs.writeFileSync(new URL('./calc.json', import.meta.url), JSON.stringify({ units, sample }, null, 1) + '\n');
console.log(`${ids.length} units, ${Object.keys(sample).length} in the readable sample`);
