import fs from 'node:fs';
import vm from 'node:vm';

// Loads the optimizer chain (DataStorage -> TypeCombinationGenerator -> BuildOptimizer) in an isolated context,
// without builder.js (bound to the DOM). The few builder.js globals they read are stubbed here.
const ROOT = new URL('../../../static/', import.meta.url);
const SCRIPTS = ['constants.js', 'formula.js', 'builder/common.js', 'builder/unitShift.js', 'builder/unitBuild.js', 'builder/enemyStats.js',
    'builder/treeComparator.js', 'builder/esperTreeComparator.js', 'builder/itemPool.js', 'builder/typeCombinationGenerator.js',
    'builder/buildOptimizer.js', 'builder/dataStorage.js'];

export function loadOptimizerEnv() {
    const ctx = vm.createContext({ console, caracts: [], ownedUnits: null, useElementConditionedMateria: false, builds: [], currentUnitIndex: 0,
        // builder.js / common.js bits the optimizer chain reads (matches() of common.js only uses $().each)
        adventurerIds: ['1500000013', '1500000015', '1500000016', '1500000017', '1500000018'],
        getPlaceHolder: (type) => ({ name: 'Any ' + type, type, placeHolder: true }),
        matches: (a, b) => a.some((v) => b.includes(v)),
        includeAll: (a, b) => b.every((v) => a.includes(v)) });
    for (const file of SCRIPTS) {
        vm.runInContext(fs.readFileSync(new URL(file, ROOT), 'utf8'), ctx, { filename: new URL(file, ROOT).href });
    }
    for (const name of ['UnitBuild', 'EnemyStats', 'DataStorage', 'TypeCombinationGenerator', 'BuildOptimizer', 'ItemPool']) {
        ctx[name] = vm.runInContext(name, ctx);
    }
    return ctx;
}
