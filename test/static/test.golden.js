import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { computeGolden, SAMPLE_EVERY } from './golden/golden.mjs';

// Golden master: the calculations on the real game data must give the same results as when the file was
// generated. A failure means the behaviour changed: if it is intended, run `npm run test:golden:update`.
const expected = JSON.parse(fs.readFileSync(new URL('./golden/calc.json', import.meta.url), 'utf8'));
const { result } = computeGolden();

describe('golden master of the build calculations (real game data)', () => {
    it('covers the same units', () => {
        assert.deepEqual(Object.keys(result), Object.keys(expected.units));
    });

    it('gives the same results for every unit', () => {
        const changed = Object.keys(expected.units).filter((id) => {
            const [count, hash] = expected.units[id];
            return !result[id] || result[id].count !== count || result[id].hash !== hash;
        });
        assert.equal(changed.length, 0, `${changed.length} units changed, e.g. ${changed.slice(0, 5).join(', ')}`);
    });

    it('gives the same values for the readable sample', () => {
        for (const [id, values] of Object.entries(expected.sample)) {
            assert.deepEqual(result[id].values, values, `unit ${id}`);
        }
    });
});
