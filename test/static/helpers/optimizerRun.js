import fs from 'node:fs';
import { loadOptimizerEnv } from './optimizerEnv.js';
import { makeBaseValues, makeEnemy } from './builderEnv.js';

const GL = new URL('../../../public/GL/', import.meta.url);
const readJson = (name) => JSON.parse(fs.readFileSync(new URL(name, GL), 'utf8'));
const passives = readJson('unitsWithPassives.json');
const withSkills = readJson('unitsWithSkill.json');
const items = readJson('data.json');

// Keeps the first N items of each type by raw stat sum (ids stay grouped, as DataStorage expects): a smaller pool makes the full search fast.
function pruneItems(all, perType) {
    if (perType === Infinity) return all;
    const score = (i) => ['hp', 'mp', 'atk', 'def', 'mag', 'spr'].reduce((sum, k) => sum + (i[k] || 0) + (i[k + '%'] || 0) * 10, 0);
    const kept = new Set();
    const byType = {};
    for (const item of all) (byType[item.type] ||= []).push(item);
    for (const list of Object.values(byType)) {
        list.sort((a, b) => score(b) - score(a) || String(a.id).localeCompare(String(b.id)));
        list.slice(0, perType).forEach((i) => kept.add(i));
    }
    return all.filter((i) => kept.has(i));
}

// Same sequence as optimize() in builder.js + optimizerWebWorker.js, run in one thread.
export function runOptimizer(unitId, skillId, { enemy = {}, maxCombos = Infinity, itemsPerType = Infinity } = {}) {
    const ctx = loadOptimizerEnv();
    const unit = passives[unitId];
    const stats = {};
    for (const stat of Object.keys(unit.stats.maxStats)) stats[stat] = unit.stats.maxStats[stat] + (unit.stats.pots?.[stat] || 0);
    const skill = [...withSkills[unitId].actives, ...withSkills[unitId].magics].find((s) => s.id === skillId);
    const formula = ctx.formulaFromSkill(skill);

    const unitBuild = new ctx.UnitBuild(unit, [], makeBaseValues(stats));
    unitBuild.unitShift.setUnit(unit);
    unitBuild.unitShift.baseValues = makeBaseValues(stats); // setUnit resets them
    unitBuild.level = 100;
    unitBuild.innateElements = [];
    unitBuild.formula = formula;
    const enemyStats = makeEnemy(ctx, enemy);

    const dataStorage = new ctx.DataStorage({ currentBuild: () => unitBuild, ownedUnits: () => null, itemEnchantments: () => null });
    dataStorage.setData(structuredClone(pruneItems(items, itemsPerType)));
    dataStorage.setUnitBuild(unitBuild);
    dataStorage.itemsToExclude = [];
    dataStorage.prepareData([], enemyStats, {}, formula);

    const combos = new ctx.TypeCombinationGenerator(false, false, false, unitBuild, dataStorage.dualWieldSources, dataStorage.equipSources, dataStorage.dataByType, dataStorage.weaponsByTypeAndHands, false, dataStorage).generateTypeCombinations();

    const optimizer = new ctx.BuildOptimizer(dataStorage.itemWithVariation, () => {});
    optimizer.unitBuild = unitBuild;
    Object.assign(optimizer, {
        dataByType: dataStorage.dataByType, dataWithCondition: dataStorage.dataWithCondition, dualWieldSources: dataStorage.dualWieldSources,
        enemyStats, useEspers: false, espers: {}, alreadyUsedEspers: [], goalVariation: 'avg', desirableElements: dataStorage.desirableElements,
    });
    let best = null;
    optimizer.optimizeFor(JSON.parse(JSON.stringify(combos.slice(0, maxCombos))), (build, value, freeSlots) => {
        if (!best || value.avg > best.value.avg) best = { build, value, freeSlots };
    });
    return { ctx, unit, unitBuild, formula, enemyStats, dataStorage, combos, best };
}
