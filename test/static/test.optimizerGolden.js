import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { computeOptimizerGolden } from './golden/optimizer.mjs';

// Golden master of the optimizer (full search, reduced item pool). A failure means the optimizer now picks another
// build or value: if intended, run `npm run test:golden:update`.
const expected = JSON.parse(fs.readFileSync(new URL('./golden/optimizer.json', import.meta.url), 'utf8'));
const actual = computeOptimizerGolden();

describe('golden master of the build optimizer (real GL data, reduced item pool)', () => {
    for (const [key, value] of Object.entries(expected)) {
        it(`gives the same build for ${key}`, () => {
            assert.deepEqual(actual[key], value);
        });
    }
});
