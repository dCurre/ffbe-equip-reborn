import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadBuilderEnv, makeUnitBuild, makeEnemy } from './helpers/builderEnv.js';

const ctx = loadBuilderEnv();
const NO_ITEMS = () => new Array(12).fill(null);
const withItems = (items) => Object.assign(NO_ITEMS(), items);

// The formula types that are not a damage: values, constants, chain multiplier, heal, element condition and the effects.
function calculate(formula, { items = NO_ITEMS(), stats = { atk: 1000, hp: 5000, mp: 200, mag: 400, spr: 300 }, buffs = { atk: 50 } } = {}) {
    const unitBuild = makeUnitBuild(ctx, { stats, buffs });
    unitBuild.innateElements = [];
    const text = typeof formula === 'string';
    return ctx.calculateBuildValueWithFormula(items, unitBuild, makeEnemy(ctx), text ? ctx.parseFormula(formula) : formula, 'avg');
}
const same = (value) => ({ min: value, avg: value, max: value, switchWeapons: false });

describe('calculateBuildValueWithFormula: values and constants', () => {
    it('a stat is its total with the buff, for the three variations', () => {
        assert.deepEqual(calculate('ATK'), same(1500));
        assert.deepEqual(calculate('HP'), same(5000));
    });

    it('a constant is itself', () => {
        assert.deepEqual(calculate('5'), same(5));
    });

    it('the chain multiplier multiplies the formula (MAX is the cap of the build)', () => {
        assert.deepEqual(calculate('CHAIN_MULT(2) * ATK'), same(3000));
        assert.deepEqual(calculate('CHAIN_MULT(MAX) * ATK'), same(6000));
    });

    it('operators combine the values', () => {
        assert.deepEqual(calculate('ATK + HP'), same(6500));
        assert.deepEqual(calculate('HP / 5'), same(1000));
    });
});

describe('calculateBuildValueWithFormula: heal', () => {
    it('adds the base to the coefficient times (SPR / 2 + MAG / 10)', () => {
        const result = calculate({ type: 'heal', value: { base: 100, coef: 2 } });
        const expected = 100 + (300 / 2 + 400 / 10) * 2;
        assert.equal(result.max, expected);
        assert.equal(result.avg, 100 + (300 / 2 + 400 / 10) * 2 * 0.925);
        assert.equal(result.min, 100 + (300 / 2 + 400 / 10) * 2 * 0.85);
    });

    it('splits the heal when the skill heals several times', () => {
        const result = calculate({ type: 'heal', value: { base: 100, coef: 2, split: 2 } });
        assert.equal(result.max, 100 / 2 + (300 / 2 + 400 / 10) * (2 / 2));
    });
});

describe('calculateBuildValueWithFormula: element condition', () => {
    const condition = (element) => ({ type: 'elementCondition', element });
    const fireWeapon = withItems({ 0: { type: 'sword', element: ['fire'] } });

    it('is true when a weapon has the element', () => {
        assert.equal(calculate(condition('fire'), { items: fireWeapon }), true);
    });

    it('is false for another element or without weapon element', () => {
        assert.equal(calculate(condition('ice'), { items: fireWeapon }), false);
        assert.equal(calculate(condition('fire')), false);
    });

    it('"none" is true only when no weapon has an element', () => {
        assert.equal(calculate(condition('none')), true);
        assert.equal(calculate(condition('none'), { items: fireWeapon }), false);
    });
});
