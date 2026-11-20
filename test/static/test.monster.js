import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadBuilderEnv, makeUnitBuild, makeEnemy } from './helpers/builderEnv.js';

const ctx = loadBuilderEnv();
const NO_ITEMS = () => new Array(12).fill(null);
const skill = (formulaName) => ({ type: 'skill', formulaName });

// unit: DEF 500, SPR 200; enemy: ATK 1000, MAG 400
function setup({ buildMitigation, unitMitigation, enemyBuffs, enemyBreaks } = {}) {
    const unitBuild = makeUnitBuild(ctx, { stats: { def: 500, spr: 200 } });
    if (buildMitigation) Object.assign(unitBuild.baseValues.mitigation, buildMitigation);
    if (unitMitigation) unitBuild.unit.mitigation = unitMitigation;
    const enemy = makeEnemy(ctx, { buffs: enemyBuffs, breaks: enemyBreaks });
    enemy.atk = 1000;
    enemy.mag = 400;
    return { unitBuild, enemy };
}

const damage = (formula, options, context) => {
    const { unitBuild, enemy } = setup(options);
    return JSON.parse(JSON.stringify(ctx.calculateMonsterDamage(formula, NO_ITEMS(), unitBuild, enemy, context)));
};

describe('calculateMonsterDamage', () => {
    it('physical: ATK² / DEF of the unit', () => {
        const result = damage(skill('physicalDamage'));
        assert.deepEqual(result, { min: 2000, avg: 2000, max: 2000, switchWeapons: false }); // 1000² / 500
    });

    it('magical: MAG² / SPR of the unit', () => {
        assert.equal(damage(skill('magicalDamage')).avg, 800); // 400² / 200
    });

    it('hybrid: average of the physical and the magical damage', () => {
        assert.equal(damage(skill('hybridDamage')).avg, 1400); // (2000 + 800) / 2
    });

    it('applies the enemy ATK buff and break', () => {
        assert.equal(damage(skill('physicalDamage'), { enemyBuffs: { atk: 50 } }).avg, 4500); // ATK 1500
        assert.equal(damage(skill('physicalDamage'), { enemyBreaks: { atk: 50 } }).avg, 500); // ATK 500
    });

    it('applies the mitigation of the unit, the global one and the physical/magical one', () => {
        assert.equal(damage(skill('physicalDamage'), { unitMitigation: { physical: 20 } }).avg, 1600);
        assert.equal(damage(skill('physicalDamage'), { buildMitigation: { global: 10, physical: 50 } }).avg, 2000 * 0.9 * 0.5);
        assert.equal(damage(skill('magicalDamage'), { buildMitigation: { global: 10, magical: 50 } }).avg, 800 * 0.9 * 0.5);
    });

    it('uses the already calculated DEF / SPR when given', () => {
        assert.equal(damage(skill('physicalDamage'), {}, { alreadyCalculatedValues: { def: 1000 } }).avg, 1000);
        assert.equal(damage(skill('magicalDamage'), {}, { alreadyCalculatedValues: { spr: 400 } }).avg, 400);
    });

    it('fixed physical mechanism does 1 damage; ATK with fixed mechanism ignores the unit mitigation', () => {
        assert.equal(damage(skill('fixedDamageWithPhysicalMechanism')).avg, 1);
        const options = { unitMitigation: { physical: 50 }, buildMitigation: { global: 10 } };
        assert.equal(damage(skill('atkDamageWithFixedMechanism'), options, { alreadyCalculatedValues: {} }).avg, 2000 * 0.9);
    });

    it('atkDamageWithFixedMechanism works without context, like the other formulas (builder.js calls it so)', () => {
        const formula = skill('atkDamageWithFixedMechanism');
        assert.equal(damage(formula).avg, 2000);
        assert.equal(damage(formula).avg, damage(formula, {}, { alreadyCalculatedValues: { def: 500 } }).avg);
    });

    it('combines constants, sums and products', () => {
        const sum = { type: '+', value1: skill('physicalDamage'), value2: { type: 'constant', value: 100 } };
        assert.equal(damage(sum).avg, 2100);
        const product = { type: '*', value1: sum, value2: { type: 'constant', value: 2 } };
        assert.equal(damage(product).avg, 4200);
    });
});

describe('getChainMult', () => {
    it('is 4 by default and adds the chain mastery of the equipment', () => {
        const unitBuild = makeUnitBuild(ctx, {});
        assert.equal(ctx.getChainMult(unitBuild, NO_ITEMS()), 4);
        assert.equal(ctx.getChainMult(unitBuild, [{ chainMastery: 50 }, null, { chainMastery: 100 }]), 5.5);
    });

    it('is capped at 6', () => {
        assert.equal(ctx.getChainMult(makeUnitBuild(ctx, {}), [{ chainMastery: 500 }]), 6);
    });

    it('is capped at 6 also with dual wield mastery (starts from 8)', () => {
        const unitBuild = makeUnitBuild(ctx, {});
        unitBuild.unit.skills = [{ improvedTDW: true }];
        const twoWeapons = [{ type: 'sword' }, { type: 'sword' }];
        assert.equal(ctx.getChainMult(unitBuild, twoWeapons), 6);
        assert.equal(ctx.getChainMult(unitBuild, [{ type: 'sword' }, { type: 'lightShield' }]), 4); // shield: not dual wielding
    });
});
