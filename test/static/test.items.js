import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadBuilderEnv } from './helpers/builderEnv.js';

const ctx = loadBuilderEnv();
// objects built inside the vm sandbox have other prototypes, which strict deepEqual rejects
const j = (value) => JSON.parse(JSON.stringify(value));

describe('getEsperStatBonus', () => {
    const esper = { id: 'ifrit' };

    it('is 1 with no bonus, and for stats that are not base stats', () => {
        assert.equal(ctx.getEsperStatBonus([], 'hp', esper), 1);
        assert.equal(ctx.getEsperStatBonus([{ esperStatsBonus: { all: { hp: 50 } } }], 'lbFillRate', esper), 1);
    });

    it('adds the "all" bonus and the one of the equipped esper', () => {
        const items = [
            { esperStatsBonus: { all: { hp: 20 } } },
            { esperStatsBonus: { ifrit: { hp: 30 }, shiva: { hp: 99 } } },
            null,
        ];
        assert.equal(ctx.getEsperStatBonus(items, 'hp', esper), 1.5);
        assert.equal(ctx.getEsperStatBonus(items, 'atk', esper), 1);
    });

    it('is capped at 3 (+200%)', () => {
        assert.equal(ctx.getEsperStatBonus([{ esperStatsBonus: { all: { hp: 500 } } }], 'hp', esper), 3);
    });
});

describe('areConditionOK', () => {
    it('checks the level and the EX level', () => {
        const item = { levelCondition: 50, exLevelCondition: 3 };
        assert.equal(ctx.areConditionOK(item, [], 40, 5), false);
        assert.equal(ctx.areConditionOK(item, [], 50, 2), false);
        assert.equal(ctx.areConditionOK(item, [], 50, 3), true);
        assert.equal(ctx.areConditionOK(item, [], 0, undefined), true); // no level given: not checked
    });

    it('is true without equip conditions', () => {
        assert.equal(ctx.areConditionOK({}, []), true);
    });

    it('with only weapon types, needs one of them in the hands', () => {
        const item = { equipedConditions: ['sword', 'katana'] };
        assert.equal(ctx.areConditionOK(item, [{ type: 'katana' }, null]), true);
        assert.equal(ctx.areConditionOK(item, [null, { type: 'sword' }]), true);
        assert.equal(ctx.areConditionOK(item, [{ type: 'axe' }, null]), false);
        assert.equal(ctx.areConditionOK(item, []), false);
    });

    it('checks element, equipment type, unarmed and item id', () => {
        const fireSword = { type: 'sword', element: ['fire'], id: '1234' };
        assert.equal(ctx.areConditionOK({ equipedConditions: ['fire'] }, [fireSword]), true);
        assert.equal(ctx.areConditionOK({ equipedConditions: ['ice'] }, [fireSword]), false);
        assert.equal(ctx.areConditionOK({ equipedConditions: ['lightShield'] }, [fireSword, { type: 'lightShield' }]), true);
        assert.equal(ctx.areConditionOK({ equipedConditions: ['unarmed'] }, [null, null]), true);
        assert.equal(ctx.areConditionOK({ equipedConditions: ['unarmed'] }, [fireSword]), false);
        assert.equal(ctx.areConditionOK({ equipedConditions: ['1234'] }, [fireSword]), true);
        assert.equal(ctx.areConditionOK({ equipedConditions: ['999'] }, [fireSword]), false);
    });

    it('matches a card by its id without the level suffix', () => {
        assert.equal(ctx.areConditionOK({ equipedConditions: ['777'] }, [{ id: '777-4' }]), true);
    });

    it('needs all the non-weapon conditions, and any of an inner list', () => {
        const equiped = [{ type: 'sword', element: ['fire'] }];
        assert.equal(ctx.areConditionOK({ equipedConditions: ['fire', 'sword'] }, equiped), true);
        assert.equal(ctx.areConditionOK({ equipedConditions: ['fire', 'axe'] }, equiped), false);
        assert.equal(ctx.areConditionOK({ equipedConditions: [['ice', 'fire']] }, equiped), true);
    });
});

describe('findBestItemVersion', () => {
    const unit = { id: 7, sex: 'male', roles: [] };

    it('returns the item itself when it has a single version and conditions are met', () => {
        const item = { id: '1', name: 'Sword', type: 'sword' };
        assert.equal(ctx.findBestItemVersion([], item, {}, unit), item);
    });

    it('returns a "Conditions not met" stub when they are not, keeping notStackable', () => {
        const item = { id: '1', name: 'Blade', type: 'sword', equipedConditions: ['axe'], special: ['notStackable', 'other'], atk: 99 };
        const result = j(ctx.findBestItemVersion([], item, {}, unit));
        assert.deepEqual(result, { id: '1', name: 'Blade', type: 'sword', access: ['Conditions not met'], special: ['notStackable'] });
    });

    it('returns a stub when the unit is not allowed to use the item', () => {
        const item = { id: '1', name: 'Blade', type: 'sword', exclusiveUnits: [99] };
        assert.deepEqual(j(ctx.findBestItemVersion([], item, {}, unit).access), ['Conditions not met']);
    });

    it('picks the most specific version the unit can use', () => {
        const generic = { id: '5', atk: 10 };
        const specific = { id: '5', atk: 50, exclusiveUnits: [7] };
        const variations = () => ({ 5: [generic, specific] });
        assert.equal(ctx.findBestItemVersion([], { id: '5' }, variations(), unit), specific);
        assert.equal(ctx.findBestItemVersion([], { id: '5' }, variations(), { ...unit, id: 8 }), generic);
    });

    it('applies the enhancements to the chosen version', () => {
        const variations = { 5: [{ id: '5', atk: 10 }] };
        const result = ctx.findBestItemVersion([], { id: '5', enhancements: ['hp_def_1'] }, variations, unit);
        assert.equal(result.atk, 10);
        assert.equal(result['hp%'], 20);
        assert.equal(result['def%'], 20);
    });
});

describe('combineTwoItems', () => {
    it('sums the simple stats without changing the inputs', () => {
        const item1 = { atk: 10, 'atk%': 5 };
        const item2 = { atk: 5, 'hp%': 10, lbFillRate: 20 };
        assert.deepEqual(j(ctx.combineTwoItems(item1, item2)), { atk: 15, 'atk%': 5, 'hp%': 10, lbFillRate: 20 });
        assert.deepEqual(j(item1), { atk: 10, 'atk%': 5 });
        assert.deepEqual(j(item2), { atk: 5, 'hp%': 10, lbFillRate: 20 });
    });

    it('sums evade, LB per turn, equipment bonuses and resists', () => {
        const item1 = { evade: { physical: 10 }, lbPerTurn: { min: 1, max: 2 }, dualWielding: { atk: 10 }, resist: [{ name: 'fire', percent: 10 }] };
        const item2 = { evade: { physical: 5, magical: 20 }, lbPerTurn: { min: 2, max: 3 }, dualWielding: { atk: 5, def: 5 }, resist: [{ name: 'ice', percent: 20 }] };
        assert.deepEqual(j(ctx.combineTwoItems(item1, item2)), {
            evade: { physical: 15, magical: 20 },
            lbPerTurn: { min: 3, max: 5 },
            dualWielding: { atk: 15, def: 5 },
            resist: [{ name: 'fire', percent: 10 }, { name: 'ice', percent: 20 }],
        });
    });

    it('merges the killers of the same race and adds the new ones', () => {
        const item1 = { killers: [{ name: 'dragon', physical: 50 }] };
        const item2 = { killers: [{ name: 'dragon', physical: 50, magical: 20 }, { name: 'human', physical: 30 }] };
        assert.deepEqual(j(ctx.combineTwoItems(item1, item2)).killers, [
            { name: 'dragon', physical: 100, magical: 20 },
            { name: 'human', physical: 30 },
        ]);
    });

    it('sums static stats and evoke boosts, and concatenates the specials', () => {
        const item1 = { staticStats: { hp: 100 }, evokeDamageBoost: { Ifrit: 10 }, special: ['a'] };
        const item2 = { staticStats: { hp: 50, atk: 5 }, evokeDamageBoost: { Ifrit: 5, Shiva: 20 }, special: ['b'] };
        assert.deepEqual(j(ctx.combineTwoItems(item1, item2)), {
            staticStats: { hp: 150, atk: 5 },
            evokeDamageBoost: { Ifrit: 15, Shiva: 20 },
            special: ['a', 'b'],
        });
    });
});

describe('applyEnhancements', () => {
    it('returns the same item without enhancements', () => {
        const item = { id: '1', atk: 10 };
        assert.equal(ctx.applyEnhancements(item, undefined), item);
    });

    it('adds the enhancement bonuses and keeps the original item', () => {
        const item = { id: '1', atk: 10, 'hp%': 5 };
        const result = ctx.applyEnhancements(item, ['hp_def_1']);
        assert.deepEqual(j(result), { id: '1', atk: 10, 'hp%': 25, 'def%': 20, enhancements: ['hp_def_1'], originalItem: item });
        assert.equal(result.originalItem, item);
        assert.deepEqual(j(item), { id: '1', atk: 10, 'hp%': 5 }); // unchanged
    });

    it('looks the numeric enhancements up in the item enchantments', () => {
        const itemEnchantments = { 42: { enchant: { atk: 30 } } };
        const result = ctx.applyEnhancements({ id: '1', atk: 10 }, [42, 999], itemEnchantments);
        assert.equal(result.atk, 40); // 999 is unknown: ignored
    });

    it('uses the per-item value of special_1', () => {
        const result = ctx.applyEnhancements({ id: '303007400', atk: 0 }, ['special_1']);
        assert.equal(result['atk%'], 20);
        assert.deepEqual(j(result.resist), [{ name: 'fire', percent: 20 }]);
    });
});

describe('item flags', () => {
    it('isStackable is false only with the notStackable special', () => {
        assert.equal(ctx.isStackable({}), true);
        assert.equal(ctx.isStackable({ special: ['twoHanded'] }), true);
        assert.equal(ctx.isStackable({ special: ['notStackable'] }), false);
    });

    it('hasDualWield / hasDualWieldOrPartialDualWield', () => {
        assert.ok(ctx.hasDualWield({ special: ['dualWield'] }));
        assert.ok(!ctx.hasDualWield({ special: ['twoHanded'] }));
        assert.ok(!ctx.hasDualWield({}));
        assert.ok(ctx.hasDualWieldOrPartialDualWield({ special: ['dualWield'] }));
        assert.ok(ctx.hasDualWieldOrPartialDualWield({ partialDualWield: [{ x: 1 }] }));
        assert.ok(!ctx.hasDualWieldOrPartialDualWield({}));
    });
});

describe('getEsperItem', () => {
    it('turns an esper into an item with its stats divided by 100', () => {
        const esper = { name: 'Ifrit', hp: 1250, mp: 99, atk: 300, def: 0, mag: 450, spr: 100, maxLevel: 60, rarity: 5, 'hp%': 10, evade: { physical: 5 } };
        const item = ctx.getEsperItem(esper);
        assert.deepEqual(j({ ...item, originalEsper: undefined }), {
            name: 'Ifrit', id: 'Ifrit', type: 'esper', hp: 12, mp: 0, atk: 3, def: 0, mag: 4, spr: 1,
            access: ['story'], maxLevel: 60, rarity: 5, evade: { physical: 5 }, 'hp%': 10,
        });
        assert.equal(item.originalEsper, esper);
    });
});
