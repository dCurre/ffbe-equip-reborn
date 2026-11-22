import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadBuilderEnv, makeUnitBuild, makeEnemy } from './helpers/builderEnv.js';

const ctx = loadBuilderEnv();
const NO_ITEMS = () => new Array(12).fill(null);
const withItems = (items) => Object.assign(NO_ITEMS(), items);

// Hand calculation of a body attack without weapon, killer or element:
//   base = coef * stat^2 / (enemy stat * (1 + (buff - break) / 100))
//   damage = base * (1 + level / 100) * {min: 0.85, avg: 0.925, max: 1}
function damage(formulaText, { items = NO_ITEMS(), unit = {}, enemy = {}, level = 100, innateElements = [] } = {}) {
    const unitBuild = makeUnitBuild(ctx, { level, ...unit });
    unitBuild.innateElements = innateElements;
    return ctx.calculateBuildValueWithFormula(items, unitBuild, makeEnemy(ctx, enemy), ctx.parseFormula(formulaText), 'avg');
}

describe('calculateBuildValueWithFormula: physical damage', () => {
    it('1x physical ATK damage: ATK 1500 (1000 + 50% buff) against DEF 100 at level 100', () => {
        const result = damage('Maximize P_DAMAGE', { unit: { stats: { atk: 1000 }, buffs: { atk: 50 } } });
        const base = (1500 * 1500) / 100;
        assert.equal(result.max, base * 2);
        assert.equal(result.avg, base * 2 * 0.925);
        assert.equal(result.min, base * 2 * 0.85);
    });

    it('is divided by the enemy DEF', () => {
        const result = damage('Maximize P_DAMAGE', { unit: { stats: { atk: 1000 } }, enemy: { def: 200 } });
        assert.equal(result.max, (1000 * 1000) / 200 * 2);
    });

    it('takes the enemy DEF break and buff into account', () => {
        const broken = damage('Maximize P_DAMAGE', { unit: { stats: { atk: 1000 } }, enemy: { def: 100, breaks: { def: 50 } } });
        assert.equal(broken.max, (1000 * 1000) / (100 * 0.5) * 2);
        const buffed = damage('Maximize P_DAMAGE', { unit: { stats: { atk: 1000 } }, enemy: { def: 100, buffs: { def: 100 } } });
        assert.equal(buffed.max, (1000 * 1000) / (100 * 2) * 2);
    });

    it('scales with the level correction (1 + level / 100)', () => {
        const level80 = damage('Maximize P_DAMAGE', { unit: { stats: { atk: 1000 } }, level: 80 });
        assert.equal(level80.max, (1000 * 1000) / 100 * 1.8);
    });

    it('applies the killers matching the enemy race', () => {
        const items = withItems({ 2: { killers: [{ name: 'human', physical: 50, magical: 0 }] } });
        const result = damage('Maximize P_DAMAGE', { items, unit: { stats: { atk: 1000 } }, enemy: { races: ['human'] } });
        assert.equal(result.max, (1000 * 1000) / 100 * 1.5 * 2);
        const otherRace = damage('Maximize P_DAMAGE', { items, unit: { stats: { atk: 1000 } }, enemy: { races: ['beast'] } });
        assert.equal(otherRace.max, (1000 * 1000) / 100 * 2);
    });

    it('applies the enemy elemental resistance', () => {
        const result = damage('Maximize P_DAMAGE', { unit: { stats: { atk: 1000 } }, enemy: { resists: { fire: 50 } }, innateElements: ['fire'] });
        assert.equal(result.max, (1000 * 1000) / 100 * 0.5 * 2);
    });
});

describe('calculateBuildValueWithFormula: magical damage', () => {
    it('uses MAG and the enemy SPR', () => {
        const result = damage('Maximize M_DAMAGE', { unit: { stats: { mag: 800, atk: 5000 } }, enemy: { def: 1, spr: 200 } });
        assert.equal(result.max, (800 * 800) / 200 * 2);
    });
});

describe('calculateBuildValueWithFormula: stat cap of a skill (use.max)', () => {
    // a magical SPR skill: the stat it uses is limited to `max` (the data has max 99999 in practice)
    const sprSkill = (max) => ({ id: '1', name: 'test', effects: [{ effect: { area: 'ST', target: 'ENEMY',
        damage: { mechanism: 'magical', damageType: 'mind', coef: 1, use: { stat: 'spr', percent: 100, max } } } }] });
    const value = (skillData) => {
        const unitBuild = makeUnitBuild(ctx, { level: 100, stats: { spr: 1000, mag: 1 } });
        const formula = ctx.formulaFromSkill(skillData);
        unitBuild.formula = formula;
        return ctx.calculateBuildValueWithFormula(NO_ITEMS(), unitBuild, makeEnemy(ctx, { spr: 100 }), formula, 'avg');
    };

    it('uses the stat as is below the cap', () => {
        assert.equal(value(sprSkill(99999)).max, (1000 * 1000) / 100 * 2);
    });

    it('limits the stat to the cap (it used to throw a ReferenceError)', () => {
        assert.equal(value(sprSkill(50)).max, (50 * 50) / 100 * 2);
    });
});
