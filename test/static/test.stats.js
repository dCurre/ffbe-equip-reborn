import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadBuilderEnv, makeUnitBuild, makeEnemy } from './helpers/builderEnv.js';

const ctx = loadBuilderEnv();
const NO_ITEMS = () => new Array(12).fill(null);
const withItems = (items) => Object.assign(NO_ITEMS(), items); // {slotIndex: item}

describe('calculateStatValue', () => {
    it('returns the base value with no equipment and no buff', () => {
        const unitBuild = makeUnitBuild(ctx, { stats: { hp: 5000, def: 500 } });
        assert.equal(ctx.calculateStatValue(NO_ITEMS(), 'hp', unitBuild).total, 5000);
        assert.equal(ctx.calculateStatValue(NO_ITEMS(), 'def', unitBuild).total, 500);
    });

    it('applies the buff percent on the base value (flat for HP)', () => {
        const unitBuild = makeUnitBuild(ctx, { stats: { atk: 1000, def: 500, hp: 5000 }, buffs: { atk: 50, def: 100, hp: 300 } });
        assert.equal(ctx.calculateStatValue(NO_ITEMS(), 'atk', unitBuild).total, 1500);
        assert.equal(ctx.calculateStatValue(NO_ITEMS(), 'def', unitBuild).total, 1000);
        assert.equal(ctx.calculateStatValue(NO_ITEMS(), 'hp', unitBuild).total, 5300); // HP buff is a flat value
    });

    it('adds the berserk percent to the ATK buff', () => {
        const unitBuild = makeUnitBuild(ctx, { stats: { atk: 1000 } });
        assert.equal(ctx.calculateStatValue(NO_ITEMS(), 'atk', unitBuild, 100).total, 2000);
    });

    it('adds the flat stat of the equipment', () => {
        const unitBuild = makeUnitBuild(ctx, { stats: { def: 500 } });
        assert.equal(ctx.calculateStatValue(withItems({ 2: { def: 100 } }), 'def', unitBuild).total, 600);
    });

    it('adds the percent stat of the equipment on the base value', () => {
        const unitBuild = makeUnitBuild(ctx, { stats: { def: 500 } });
        const items = withItems({ 2: { def: 100, 'def%': 10 } });
        assert.equal(ctx.calculateStatValue(items, 'def', unitBuild).total, 650); // 500 + 100 + 10% of 500
    });

    it('caps the cumulated percent bonus at 400%', () => {
        const unitBuild = makeUnitBuild(ctx, { stats: { def: 500 } });
        const items = withItems({ 2: { 'def%': 300 }, 3: { 'def%': 200 } });
        // 500 + 300% (1500) + only 100% of the second item (500)
        assert.equal(ctx.calculateStatValue(items, 'def', unitBuild).total, 2500);
    });

    it('does not round the total of the non-ATK stats (current behaviour)', () => {
        // The Math.floor at the end of calculateStatValue is assigned to a variable that is never used
        // afterwards, so the returned total keeps the decimals. To review with the build algorithm.
        const unitBuild = makeUnitBuild(ctx, { stats: { def: 501 } });
        assert.equal(ctx.calculateStatValue(withItems({ 2: { 'def%': 10 } }), 'def', unitBuild).total, 551.1);
    });

    it('splits the ATK between both hands when dual wielding', () => {
        const unitBuild = makeUnitBuild(ctx, { stats: { atk: 1000 } });
        const items = withItems({ 0: { type: 'sword', atk: 100 }, 1: { type: 'dagger', atk: 50 } });
        const atk = ctx.calculateStatValue(items, 'atk', unitBuild);
        assert.equal(atk.right, 1100);
        assert.equal(atk.left, 1050);
        assert.equal(atk.total, 1150);
    });

    it('gives all the ATK to the right hand with a single weapon', () => {
        const unitBuild = makeUnitBuild(ctx, { stats: { atk: 1000 } });
        const atk = ctx.calculateStatValue(withItems({ 0: { type: 'sword', atk: 100 } }), 'atk', unitBuild);
        assert.equal(atk.right, 1100);
        assert.equal(atk.left, 0);
        assert.equal(atk.total, 1100);
    });
});

describe('getStatBonusCap', () => {
    it('returns the cap of each special stat, 400 by default', () => {
        const caps = { lbDamage: 300, lbPerTurn: 12, lbFillRate: 1000, jumpDamage: 800, evoMag: 300, chainMastery: 6, drawAttacks: 100, accuracy: 100, def: 400, atk: 400 };
        for (const [stat, cap] of Object.entries(caps)) {
            assert.equal(ctx.getStatBonusCap(stat), cap, stat);
        }
    });
});

describe('getElementCoef', () => {
    it('is 0 without elements', () => {
        assert.equal(ctx.getElementCoef([], makeEnemy(ctx)), 0);
    });

    it('is the enemy resistance minus the imperil, as a fraction', () => {
        const enemy = makeEnemy(ctx, { resists: { fire: 50 }, imperils: { fire: 20 } });
        assert.equal(ctx.getElementCoef(['fire'], enemy), 0.3);
    });

    it('averages the elements', () => {
        const enemy = makeEnemy(ctx, { resists: { fire: 50, ice: -100 } });
        assert.equal(ctx.getElementCoef(['fire', 'ice'], enemy), -0.25);
    });
});

describe('getWeaponImperilCoef', () => {
    it('is 1 without imperil', () => {
        assert.equal(ctx.getWeaponImperilCoef({ type: 'sword' }, null, makeEnemy(ctx)), 1);
    });

    it('adds the imperil of the weapon type', () => {
        const enemy = makeEnemy(ctx);
        enemy.imperils.sword = 50;
        assert.equal(ctx.getWeaponImperilCoef({ type: 'sword' }, null, enemy), 1.5);
    });
});
