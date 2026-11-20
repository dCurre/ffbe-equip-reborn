import fs from 'node:fs';
import vm from 'node:vm';

// The calculation code is made of plain browser scripts (globals, no exports). Like the optimizer
// Web Worker does, load them in an isolated context; the browser-only parts are not needed.
const ROOT = new URL('../../../static/', import.meta.url);
const SCRIPTS = ['constants.js', 'formula.js', 'builder/common.js', 'builder/unitShift.js', 'builder/unitBuild.js', 'builder/enemyStats.js'];

export function loadBuilderEnv() {
    // `caracts` is declared in builder.js and filled by formulaFromSkill
    const ctx = vm.createContext({ console, caracts: [] });
    for (const file of SCRIPTS) {
        vm.runInContext(fs.readFileSync(new URL(file, ROOT), 'utf8'), ctx, { filename: new URL(file, ROOT).href });
    }
    // `class` and `const` declarations are not properties of the context: expose what the tests need
    ctx.UnitBuild = vm.runInContext('UnitBuild', ctx);
    ctx.EnemyStats = vm.runInContext('EnemyStats', ctx);
    return ctx;
}

const BASE_STATS = ['hp', 'mp', 'atk', 'def', 'mag', 'spr'];

// Same shape as readStatsValues() in builder.js. `stats` = total value per stat, `buffs` = buff % per stat.
export function makeBaseValues(stats = {}, buffs = {}) {
    const baseValues = {};
    for (const stat of BASE_STATS) {
        const total = stats[stat] ?? 0;
        baseValues[stat] = { base: total, pots: 0, total, buff: buffs[stat] ?? 0 };
    }
    baseValues.lbFillRate = { total: 0, buff: 0 };
    baseValues.mitigation = { physical: 0, magical: 0, global: 0 };
    baseValues.drawAttacks = 0;
    baseValues.lbDamage = 0;
    baseValues.currentStack = 0;
    baseValues.killerBuffs = [];
    baseValues.elementBuffs = {};
    return baseValues;
}

export function makeUnitBuild(ctx, { stats, buffs, level = 100 } = {}) {
    const unitBuild = new ctx.UnitBuild({ max_rarity: 6, sixStarForm: false, stats: { maxStats: {} } }, undefined, makeBaseValues(stats, buffs));
    unitBuild.level = level;
    unitBuild.innateElements = [];
    return unitBuild;
}

const ELEMENTS = ['fire', 'ice', 'lightning', 'water', 'earth', 'wind', 'light', 'dark'];

// resists / imperils: {element: value}; breaks / buffs: {stat: value} (percent), the others default to 0.
export function makeEnemy(ctx, { def = 100, spr = 100, races = [], resists = {}, imperils = {}, breaks = {}, buffs = {} } = {}) {
    const stats = (values) => ({ atk: 0, def: 0, mag: 0, spr: 0, ...values });
    const byElement = (values) => Object.fromEntries(ELEMENTS.map((element) => [element, values[element] ?? 0]));
    // imperils also accept weapon types (sword: 30, ...), which are not elements
    const withWeapons = (values) => ({ ...byElement(values), ...Object.fromEntries(Object.entries(values).filter(([key]) => !ELEMENTS.includes(key))) });
    return new ctx.EnemyStats(races, 1000, 1000, def, spr, byElement(resists), stats(breaks), stats(buffs), stats({}), withWeapons(imperils), null);
}
