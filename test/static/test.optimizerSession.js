import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { core } from './helpers/core.js';
import { runOptimizer } from './helpers/optimizerRun.js';

// The optimizer Web Worker speaks JSON messages. Drive its session with them (the way builder.js does) and check that
// it finds the same build as calling the optimizer directly.
describe('OptimizerSession (the logic of the optimizer Web Worker)', () => {
    it('finds the same best build as the direct optimizer, through JSON messages', () => {
        const { unit, unitBuild, formula, enemyStats, dataStorage, combos, best } = runOptimizer('100000102', '201130', { enemy: { def: 500, spr: 300 }, itemsPerType: 40, maxCombos: 4 });
        const sent = (message) => JSON.parse(JSON.stringify(message)); // what crosses postMessage(JSON.stringify(...))
        const answers = [];
        const session = new core.OptimizerSession((answer) => answers.push(sent(answer)));
        session.handle(sent({ type: 'init', allItemVersions: dataStorage.itemWithVariation, number: 3 }));
        session.handle(sent({
            type: 'setData', unit, fixedItems: [], baseValues: unitBuild.baseValues, level: 100, exAwakeningLevel: 0, innateElements: [],
            monsterAttackFormula: null, formula, dataByType: dataStorage.dataByType, dataWithCondition: dataStorage.dataWithCondition,
            enemyStats, useEspers: false, espers: {}, alreadyUsedEspers: [], goalVariation: 'avg', desirableElements: dataStorage.desirableElements,
        }));
        session.handle(sent({ type: 'optimize', typeCombinations: combos.slice(0, 4) }));

        const found = answers.filter((a) => a.type === 'betterBuildFound');
        const sessionBest = found.reduce((top, a) => (!top || a.value.avg > top.value.avg ? a : top), null);
        assert.equal(sessionBest.value.avg, best.value.avg);
        const ids = (build) => build.slice(0, 11).map((item) => (item ? item.id : null));
        assert.deepEqual(ids(sessionBest.build), ids(best.build));
        assert.deepEqual(answers.at(-1), { type: 'finished', number: 3 });
    });

    it('refuses a message sent before init', () => {
        const session = new core.OptimizerSession(() => {});
        assert.throws(() => session.handle({ type: 'optimize', typeCombinations: [] }), /before "init"/);
    });
});
