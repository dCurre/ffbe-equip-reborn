import {
  choiceFromFormula,
  formulaByGoal,
  goalOptions,
  parseChainMultiplier,
  resolveGoal,
  withConditions,
} from './goal';

const emptyUnit = () => ({
  lb: { name: 'Burst', minEffects: [], maxEffects: [], effects: [] },
  actives: [],
  passives: [],
  magics: [],
});

describe('builder goal', () => {
  it('offers the default goals first, then the skills of the unit', () => {
    const options = goalOptions(emptyUnit());
    expect(options[0].value).toBe('heal');
    expect(options.some((o) => o.value === 'physicalDamage' && o.kind === 'damage')).toBe(true);
    expect(options.find((o) => o.value === 'hp')?.kind).toBe('stat');
  });

  it('gives the formula of a default goal', () => {
    expect(resolveGoal('physicalDamage', emptyUnit())).toEqual({
      goal: 'physicalDamage',
      formula: formulaByGoal['physicalDamage'],
    });
    expect(resolveGoal('', emptyUnit())).toBeNull();
  });

  it('reads the chain multiplier', () => {
    expect(parseChainMultiplier('')).toBe(1);
    expect(parseChainMultiplier('2,5')).toBe(2.5);
    expect(parseChainMultiplier('max')).toBe('MAX');
    expect(parseChainMultiplier('abc')).toBe(1);
  });

  it('wraps the formula with the chain multiplier', () => {
    const conditions = { forcedElements: [], ailmentImunity: [], elementalResist: {}, various: [] };
    const formula = withConditions(formulaByGoal['atk'], conditions, 2);
    expect(JSON.stringify(formula)).toContain('chainMultiplier');
  });

  it('finds the choice again from a formula', () => {
    const pots = { atk: 10, mag: 20 };
    expect(choiceFromFormula(null, null, emptyUnit(), pots).choice).toBe('magicalDamage');
    expect(choiceFromFormula(null, null, emptyUnit(), { atk: 20, mag: 10 }).choice).toBe('physicalDamage');
    expect(choiceFromFormula('hp', formulaByGoal['hp'], emptyUnit(), pots).choice).toBe('hp');
    expect(choiceFromFormula('custom', formulaByGoal['mag'], emptyUnit(), pots).choice).toBe('mag');
  });
});
