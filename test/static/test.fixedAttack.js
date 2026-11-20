import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadBuilderEnv, makeUnitBuild, makeEnemy } from './helpers/builderEnv.js';

const ctx = loadBuilderEnv();
const NO_ITEMS = () => new Array(12).fill(null);
const withItems = (items) => Object.assign(NO_ITEMS(), items);

// Skills as they come from the game data: attack type "None" is the wiki's Fixed attack type, copied as
// mechanism "none" (Covering Fire, Mug...); the damage type says the stat. See formulaFromEffect (formula.js).
const skill = (damage, target = 'ENEMY') => ({ id: '1', name: 'test', effects: [{ effect: { damage, area: 'ST', target } }] });
const fixed = (damage) => skill({ mechanism: 'none', coef: 1, ...damage });

function value(skillData, { items = NO_ITEMS(), unit = {}, enemy = {}, innateElements = [] } = {}) {
    const unitBuild = makeUnitBuild(ctx, { level: 100, ...unit });
    unitBuild.innateElements = innateElements;
    const formula = ctx.formulaFromSkill(skillData);
    unitBuild.formula = formula;
    return ctx.calculateBuildValueWithFormula(items, unitBuild, makeEnemy(ctx, enemy), formula, 'avg');
}

describe('Fixed attack type (mechanism "none")', () => {
    it('body damage uses ATK against DEF (Covering Fire: 1.2x, level 100)', () => {
        const result = value(fixed({ damageType: 'body', coef: 1.2, delay: 1 }), { unit: { stats: { atk: 1000 } } });
        assert.equal(result.max, 1.2 * (1000 * 1000) / 100 * 2);
    });

    it('mind damage uses MAG against SPR', () => {
        const result = value(fixed({ damageType: 'mind' }), { unit: { stats: { mag: 800, atk: 5000 } }, enemy: { def: 1, spr: 200 } });
        assert.equal(result.max, (800 * 800) / 200 * 2);
    });

    it('without damage type it is hybrid: mean of the ATK/DEF and MAG/SPR parts', () => {
        const result = value(fixed({}), { unit: { stats: { atk: 1000, mag: 800 } }, enemy: { def: 100, spr: 200 } });
        assert.equal(result.max, ((1000 * 1000) / 100 + (800 * 800) / 200) / 2 * 2);
    });

    it('ignores the killers, which a normal attack applies', () => {
        const items = withItems({ 2: { killers: [{ name: 'human', physical: 50, magical: 50 }] } });
        const args = { items, unit: { stats: { atk: 1000 } }, enemy: { races: ['human'] } };
        const base = (1000 * 1000) / 100 * 2;
        assert.equal(value(fixed({ damageType: 'body' }), args).max, base);
        assert.equal(value(skill({ mechanism: 'physical', damageType: 'body', coef: 1 }), args).max, base * 1.5);
    });

    it('is not doubled by dual wield, unlike a normal attack', () => {
        const dagger = { type: 'dagger', atk: 100, damageVariance: { min: 1, avg: 1, max: 1 } };
        const args = { items: withItems({ 0: dagger, 1: dagger }), unit: { stats: { atk: 1000 } } };
        const fixedDamage = value(fixed({ damageType: 'body' }), args).max;
        const normalDamage = value(skill({ mechanism: 'physical', damageType: 'body', coef: 1 }), args).max;
        assert.ok(fixedDamage > 0 && normalDamage > fixedDamage * 1.5, `fixed ${fixedDamage}, normal ${normalDamage}`);
    });

    it('still takes the enemy elemental resistance into account', () => {
        const result = value(fixed({ damageType: 'body' }), { unit: { stats: { atk: 1000 } }, enemy: { resists: { fire: 50 } }, innateElements: ['fire'] });
        assert.equal(result.max, (1000 * 1000) / 100 * 0.5 * 2);
    });

    it('does not offer as goal the effects that are not an attack on enemies (HP cost, token damage to an ally)', () => {
        assert.equal(ctx.formulaFromSkill(skill({ mechanism: 'none', damageType: 'body', coef: 0 }, 'SELF')), null);
        assert.equal(ctx.formulaFromSkill(skill({ mechanism: 'none', damageType: 'body', coef: 0.01 }, 'ALLY')), null);
    });

    it('leaves the game data untouched', () => {
        const data = skill({ mechanism: 'none', damageType: 'body', coef: 1 });
        ctx.formulaFromSkill(data);
        assert.deepEqual(data.effects[0].effect.damage, { mechanism: 'none', damageType: 'body', coef: 1 });
    });
});

describe('damage effect without mechanism', () => {
    it('is a normal attack of the stat given by the damage type (killers apply)', () => {
        const items = withItems({ 2: { killers: [{ name: 'human', physical: 50, magical: 0 }] } });
        const result = value(skill({ coef: 1, damageType: 'body' }), { items, unit: { stats: { atk: 1000 } }, enemy: { races: ['human'] } });
        assert.equal(result.max, (1000 * 1000) / 100 * 1.5 * 2);
    });
});
