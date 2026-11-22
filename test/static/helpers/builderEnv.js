import { core } from './core.js';

// The calculation core is TypeScript (src/core, compiled by npm test): a plain copy of its exports, so a test can add what it needs.
export function loadBuilderEnv() {
    return { ...core };
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
