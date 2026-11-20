import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runOptimizer } from './helpers/optimizerRun.js';

// End-to-end optimizer on real GL data: Rain, "Power Break" (physical damage) vs a def 500 enemy.
// Only the first combinations of types are run: the full search takes minutes in a single thread
// (the browser splits it across Web Workers).
const ENEMY = { def: 500, spr: 300 };
const COMBOS = 12;
const run = () => runOptimizer('100000102', '201130', { enemy: ENEMY, maxCombos: COMBOS });
const first = run();

describe('build optimizer (real GL data, first type combinations)', () => {
    it('finds a build with a finite positive value', () => {
        assert.ok(Number.isFinite(first.best.value.avg) && first.best.value.avg > 0);
    });

    it('reports the same value as a direct calculation of the build', () => {
        const { ctx, unitBuild, enemyStats, formula, best } = first;
        const value = ctx.calculateBuildValueWithFormula(best.build, unitBuild, enemyStats, formula, 'avg');
        assert.equal(value.avg, best.value.avg);
    });

    it('beats the unit with nothing equipped', () => {
        const { ctx, unitBuild, enemyStats, formula, best } = first;
        const naked = ctx.calculateBuildValueWithFormula([], unitBuild, enemyStats, formula, 'avg');
        assert.ok(best.value.avg > naked.avg);
    });

    it('puts only equippable item types in each slot', () => {
        const { unitBuild, best } = first;
        best.build.slice(0, 11).forEach((item, slot) => {
            if (item && !item.placeHolder) assert.ok(unitBuild.equipable[slot].includes(item.type), `slot ${slot}: ${item.name} (${item.type})`);
        });
    });

    it('never uses more copies of an item than are available, nor two unstackable ones', () => {
        const { ctx, best } = first;
        const counts = {};
        for (const item of best.build.slice(0, 11)) if (item && !item.placeHolder) counts[item.id] = (counts[item.id] || 0) + 1;
        for (const [id, count] of Object.entries(counts)) {
            const item = best.build.find((i) => i && i.id === id);
            assert.ok(count <= 4, `${item.name} x${count}`);
            if (!ctx.isStackable(item)) assert.equal(count, 1, item.name);
        }
    });

    it('is deterministic', () => {
        const second = run();
        assert.equal(second.best.value.avg, first.best.value.avg);
        const ids = (r) => JSON.stringify(r.best.build.map((i) => i && i.id));
        assert.equal(ids(second), ids(first));
    });
});
