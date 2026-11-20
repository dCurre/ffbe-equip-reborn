import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadBuilderEnv } from './helpers/builderEnv.js';

const ctx = loadBuilderEnv();
// objects built inside the vm sandbox have other prototypes, which strict deepEqual rejects
const j = (value) => JSON.parse(JSON.stringify(value));

const value = (name) => ({ type: 'value', name });
const constant = (n) => ({ type: 'constant', value: n });
const greater = (name, n) => ({ type: '>', value1: value(name), value2: constant(n) });
const element = (name) => ({ type: 'elementCondition', element: name });
const skill = (formulaName) => ({ type: 'skill', formulaName });
const withCondition = (formula, condition) => ({ type: 'condition', formula, condition });

describe('formulaFromEffect', () => {
    it('wraps each supported effect in a typed formula', () => {
        const wrap = (effect) => j(ctx.formulaFromEffect({ effect }));
        assert.deepEqual(wrap({ damage: { coef: 2 } }), { type: 'damage', value: { coef: 2 } });
        assert.deepEqual(wrap({ imperil: { fire: 20 } }), { type: 'imperil', value: { fire: 20 } });
        assert.deepEqual(wrap({ statsBuff: { atk: 50 } }), { type: 'statsBuff', value: { atk: 50 } });
        assert.deepEqual(wrap({ break: { def: 25 } }), { type: 'break', value: { def: 25 } });
        assert.deepEqual(wrap({ imbue: ['fire'] }), { type: 'imbue', value: ['fire'] });
        assert.deepEqual(wrap({ heal: { base: 1 } }), { type: 'heal', value: { base: 1 } });
        assert.deepEqual(wrap({ skillEnhancement: { x: 1 } }), { type: 'skillEnhancement', value: { x: 1 } });
    });

    it('keeps the whole effect for killers, and splits berserk in percent and duration', () => {
        const killers = { killers: [{ name: 'human', physical: 50 }] };
        assert.deepEqual(j(ctx.formulaFromEffect({ effect: killers })), { type: 'killers', value: killers });
        assert.deepEqual(j(ctx.formulaFromEffect({ effect: { berserk: { percent: 100, duration: 3 } } })), { type: 'berserk', value: 100, duration: 3 });
    });

    it('is null for an effect it does not know', () => {
        assert.equal(ctx.formulaFromEffect({ effect: { somethingElse: 1 } }), null);
    });
});

describe('getChainMultiplier', () => {
    const chain = { type: '*', value1: { type: 'chainMultiplier', value: 3 }, value2: skill('physicalDamage') };

    it('reads the multiplier of CHAIN_MULT(x) * formula, also inside a condition', () => {
        assert.equal(ctx.getChainMultiplier(chain), 3);
        assert.equal(ctx.getChainMultiplier(withCondition(chain, element('fire'))), 3);
    });

    it('is 1 without chain multiplier or without formula', () => {
        assert.equal(ctx.getChainMultiplier(skill('physicalDamage')), 1);
        assert.equal(ctx.getChainMultiplier(null), 1);
    });
});

describe('getSimpleConditions', () => {
    it('is empty without condition', () => {
        assert.deepEqual(j(ctx.getSimpleConditions(skill('physicalDamage'))), { forcedElements: [], ailmentImunity: [], elementalResist: {}, various: [] });
    });

    it('collects elements, ailment immunity, elemental resist and the various values through AND', () => {
        const condition = {
            type: 'AND',
            value1: { type: 'AND', value1: element('fire'), value2: greater('resist|poison.percent', 100) },
            value2: { type: 'AND', value1: greater('resist|ice.percent', 50), value2: greater('evade.physical', 100) },
        };
        assert.deepEqual(j(ctx.getSimpleConditions(withCondition(skill('physicalDamage'), condition))), {
            forcedElements: ['fire'],
            ailmentImunity: ['poison'],
            elementalResist: { ice: 50 },
            various: ['evade.physical'],
        });
    });

    it('keeps the highest elemental resist and ignores thresholds that are not simple', () => {
        const condition = {
            type: 'AND',
            value1: greater('resist|ice.percent', 50),
            value2: { type: 'AND', value1: greater('resist|ice.percent', 30), value2: greater('accuracy', 50) },
        };
        const result = j(ctx.getSimpleConditions(withCondition(skill('physicalDamage'), condition)));
        assert.deepEqual(result.elementalResist, { ice: 50 });
        assert.deepEqual(result.various, []); // accuracy needs 100
    });
});

describe('addCondition', () => {
    it('wraps a plain formula in a condition and keeps its elements', () => {
        const formula = { ...skill('physicalDamage'), elements: ['fire'] };
        const result = j(ctx.addCondition(formula, element('fire')));
        assert.deepEqual(result, { type: 'condition', formula, condition: element('fire'), elements: ['fire'] });
    });

    it('puts the new condition in AND with the existing one', () => {
        const formula = withCondition(skill('physicalDamage'), element('ice'));
        assert.deepEqual(j(ctx.addCondition(formula, element('fire'))).condition, { type: 'AND', value1: element('fire'), value2: element('ice') });
    });
});

describe('makeSureFormulaHaveSimpleConditions', () => {
    it('adds the missing conditions and the forced elements', () => {
        const wanted = { forcedElements: ['fire'], ailmentImunity: ['poison'], elementalResist: { ice: 50 }, various: ['accuracy'] };
        const result = ctx.makeSureFormulaHaveSimpleConditions(skill('physicalDamage'), wanted);
        assert.deepEqual(j(ctx.getSimpleConditions(result)), wanted);
        assert.deepEqual(j(result.elements), ['fire']);
    });

    it('adds nothing when the formula already has them', () => {
        const formula = withCondition(skill('physicalDamage'), { type: 'AND', value1: element('fire'), value2: greater('resist|ice.percent', 60) });
        const wanted = { forcedElements: ['fire'], ailmentImunity: [], elementalResist: { ice: 50 }, various: [] };
        assert.deepEqual(j(ctx.makeSureFormulaHaveSimpleConditions(formula, wanted)), j(formula));
    });

    it('raises a resist threshold that is too low', () => {
        const formula = withCondition(skill('physicalDamage'), greater('resist|ice.percent', 30));
        const wanted = { forcedElements: [], ailmentImunity: [], elementalResist: { ice: 50 }, various: [] };
        assert.equal(j(ctx.getSimpleConditions(ctx.makeSureFormulaHaveSimpleConditions(formula, wanted))).elementalResist.ice, 50);
    });
});

describe('isSimpleFormula', () => {
    it('accepts skills, base stats and conditions made of simple parts', () => {
        assert.equal(ctx.isSimpleFormula(skill('physicalDamage')), true);
        assert.equal(ctx.isSimpleFormula(value('hp')), true);
        assert.equal(ctx.isSimpleFormula(value('accuracy')), false);
        assert.equal(ctx.isSimpleFormula({ ...value('hp'), lb: true }), false);
        assert.equal(ctx.isSimpleFormula(withCondition(skill('physicalDamage'), { type: 'AND', value1: element('fire'), value2: greater('evade.physical', 100) })), true);
    });

    it('accepts an immunity only at 100, a resist at any value', () => {
        assert.equal(ctx.isSimpleFormula(greater('resist|poison.percent', 100)), true);
        assert.equal(ctx.isSimpleFormula(greater('resist|poison.percent', 50)), false);
        assert.equal(ctx.isSimpleFormula(greater('resist|fire.percent', 40)), true);
        assert.equal(ctx.isSimpleFormula(greater('accuracy', 100)), true);
        assert.equal(ctx.isSimpleFormula(greater('accuracy', 99)), false);
    });

    it('accepts only a few products and the SPR/MAG sum', () => {
        const product = (a, b) => ({ type: '*', value1: value(a), value2: value(b) });
        assert.equal(ctx.isSimpleFormula(product('hp', 'def')), true);
        assert.equal(ctx.isSimpleFormula(product('hp', 'spr')), true);
        assert.equal(ctx.isSimpleFormula(product('atk', 'def')), false);
        assert.equal(ctx.isSimpleFormula({ type: '*', value1: { type: 'chainMultiplier', value: 2 }, value2: skill('physicalDamage') }), true);
        const half = (stat, n) => ({ type: '/', value1: value(stat), value2: constant(n) });
        assert.equal(ctx.isSimpleFormula({ type: '+', value1: half('spr', 2), value2: half('mag', 10) }), true);
        assert.equal(ctx.isSimpleFormula({ type: '+', value1: half('spr', 3), value2: half('mag', 10) }), false);
    });

    it('rejects a type it does not know', () => {
        assert.equal(ctx.isSimpleFormula({ type: '-', value1: value('hp'), value2: value('def') }), false);
    });
});

describe('isAttackFormula', () => {
    it('accepts damage skills, constants and their sums and products', () => {
        assert.equal(ctx.isAttackFormula(skill('physicalDamage')), true);
        assert.equal(ctx.isAttackFormula(skill('atkDamageWithFixedMechanism')), true);
        assert.equal(ctx.isAttackFormula({ type: '*', value1: skill('magicalDamage'), value2: constant(2) }), true);
        assert.equal(ctx.isAttackFormula({ type: '+', value1: skill('magicalDamage'), value2: skill('hybridDamage') }), true);
    });

    it('rejects LB damage, other skills and stats', () => {
        assert.equal(ctx.isAttackFormula({ ...skill('physicalDamage'), lb: true }), false);
        assert.equal(ctx.isAttackFormula(skill('heal')), false);
        assert.equal(ctx.isAttackFormula(value('hp')), false);
        assert.equal(ctx.isAttackFormula({ type: '+', value1: skill('physicalDamage'), value2: value('hp') }), false);
    });
});

describe('getSkillIds', () => {
    it('collects the ids through multicast, conditions and operators', () => {
        const a = { type: 'skill', id: '1' };
        const b = { type: 'skill', id: '2' };
        const c = { type: 'skill', id: '3' };
        assert.deepEqual(j(ctx.getSkillIds({ type: 'multicast', skills: [a, b] })), ['1', '2']);
        assert.deepEqual(j(ctx.getSkillIds(withCondition(a, element('fire')))), ['1']);
        assert.deepEqual(j(ctx.getSkillIds({ type: '+', value1: a, value2: { type: '*', value1: b, value2: c } })), ['1', '2', '3']);
        assert.deepEqual(j(ctx.getSkillIds(value('hp'))), []);
    });
});

describe('multicaEffectMatch', () => {
    const effect = { time: 2, type: ['whiteMagic', 'blackMagic'] };

    it('needs the exact number of skills, each of an allowed magic type', () => {
        assert.equal(ctx.multicaEffectMatch(effect, [{ id: '1', magic: 'white' }, { id: '2', magic: 'black' }]), true);
        assert.equal(ctx.multicaEffectMatch(effect, [{ id: '1', magic: 'white' }]), false);
        assert.equal(ctx.multicaEffectMatch(effect, [{ id: '1', magic: 'white' }, { id: '2', magic: 'green' }]), false);
    });

    it('accepts any skill without magic type with allSkills, and the listed skills', () => {
        assert.equal(ctx.multicaEffectMatch({ time: 1, type: ['allSkills'] }, [{ id: '1' }]), true);
        assert.equal(ctx.multicaEffectMatch({ time: 1, type: [], skills: [{ id: '9' }] }, [{ id: '9' }]), true);
        assert.equal(ctx.multicaEffectMatch({ time: 1, type: [], skills: [{ id: '9' }] }, [{ id: '8' }]), false);
    });

    it('refuses the excluded skills', () => {
        assert.equal(ctx.multicaEffectMatch({ time: 1, type: ['allSkills'], excludedSkills: [{ id: '1' }] }, [{ id: '1' }]), false);
    });
});

const unit = () => ({
    lb: { id: 'lb1', name: 'Big Strike' },
    actives: [
        { id: '10', name: 'Fire Slash', effects: [{ effect: { damage: { coef: 2, damageType: 'body', mechanism: 'physical' } } }] },
        { id: '11', name: 'Double', effects: [{ effect: { multicast: { time: 2, type: ['blackMagic'] } } }] },
    ],
    magics: [{ id: '20', name: 'Fira', magic: 'black', effects: [] }],
    passives: [{ id: '30', name: 'Twin Cast', effects: [{ effect: { multicast: { time: 2, type: ['whiteMagic'] } } }] }],
});

describe('skill lookup', () => {
    it('getSkillFromName: case insensitive, finds the LB, actives, magics and passives, ignores _UPGRADED', () => {
        assert.equal(ctx.getSkillFromName('big strike', unit()).id, 'lb1');
        assert.equal(ctx.getSkillFromName('FIRE SLASH', unit()).id, '10');
        assert.equal(ctx.getSkillFromName('fira', unit()).id, '20');
        assert.equal(ctx.getSkillFromName('Twin Cast', unit()).id, '30');
        assert.equal(ctx.getSkillFromName('Fire Slash_UPGRADED', unit()).id, '10');
        assert.equal(ctx.getSkillFromName('Unknown', unit()), undefined);
    });

    it('getSkillFromId: finds actives, magics and passives (not the LB)', () => {
        assert.equal(ctx.getSkillFromId('10', unit()).name, 'Fire Slash');
        assert.equal(ctx.getSkillFromId(20, unit()).name, 'Fira');
        assert.equal(ctx.getSkillFromId('30', unit()).name, 'Twin Cast');
        assert.equal(ctx.getSkillFromId('lb1', unit()), undefined);
    });

    it('getFormulaFromSkillToken: null when the token is not SKILL(...)', () => {
        assert.equal(ctx.getFormulaFromSkillToken('HP', unit()), null);
    });

    it("getFormulaFromSkillToken: builds the formula of the skill found by name or by id", () => {
        const expected = { type: "skill", id: "10", name: "Fire Slash", value: { type: "damage", value: { coef: 2, damageType: "body", mechanism: "physical" } }, stack: false, lb: false };
        assert.deepEqual(j(ctx.getFormulaFromSkillToken("SKILL(Fire Slash)", unit())), expected);
        assert.deepEqual(j(ctx.getFormulaFromSkillToken("SKILL(10)", unit())), expected);
    });
});

describe('parseConstant', () => {
    it('reads a number, also with spaces', () => {
        assert.deepEqual(j(ctx.parseConstant('  250 ', 0)), { type: 'constant', value: 250 });
        assert.deepEqual(j(ctx.parseConstant('1.5', 0)), { type: 'constant', value: 1.5 });
    });

    it('shows an alert and returns nothing for a non number', () => {
        const alerts = [];
        ctx.alert = (message) => alerts.push(message);
        assert.equal(ctx.parseConstant('abc', 4), undefined);
        assert.deepEqual(alerts, ['Error at position 4. Expected constant.']);
    });
});

describe('multicast helpers', () => {
    it('hasMulticast looks only at the active skills', () => {
        assert.equal(ctx.hasMulticast(unit()), true);
        assert.equal(ctx.hasMulticast({ actives: [{ effects: [{ effect: {} }] }] }), false);
    });

    it('getMulticastSkillAbleToMulticast finds the active or passive that allows the skills', () => {
        const black = [{ id: '1', magic: 'black' }, { id: '2', magic: 'black' }];
        const white = [{ id: '3', magic: 'white' }, { id: '4', magic: 'white' }];
        assert.equal(ctx.getMulticastSkillAbleToMulticast(black, unit()).id, '11');
        assert.equal(ctx.getMulticastSkillAbleToMulticast(white, unit()).id, '30');
        assert.equal(ctx.getMulticastSkillAbleToMulticast([{ id: '5', magic: 'green' }], unit()), undefined);
    });
});

describe('hasStack', () => {
    it('is true for a stacking skill, also inside a multicast or a condition', () => {
        const stacking = { type: 'skill', stack: true };
        assert.equal(ctx.hasStack(stacking), true);
        assert.equal(ctx.hasStack({ type: 'multicast', skills: [skill('x'), stacking] }), true);
        assert.equal(ctx.hasStack(withCondition(stacking, element('fire'))), true);
    });

    it('is false without stack, for other formulas and for no formula', () => {
        assert.ok(!ctx.hasStack(skill('physicalDamage')));
        assert.equal(ctx.hasStack({ type: 'multicast', skills: [skill('x')] }), false);
        assert.equal(ctx.hasStack(value('hp')), false);
        assert.equal(ctx.hasStack(null), false);
    });
});
