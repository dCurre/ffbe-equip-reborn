import { describe, expect, it } from 'vitest';
import { oldLinkToData, shortLinkToData, stateData } from './state-hash';

describe('state hash', () => {
  const units = { '206000121': { id: '206000121', max_rarity: 5 }, '206000125': { id: '206000125', max_rarity: 7 } };

  it('reads the short link format', () => {
    const { data, error } = shortLinkToData(
      [
        [206000127, 120, [540, 90, 0, 40, 65, 40]],
        [13, 2],
        [310001700, 0, 403044500],
      ],
      units,
    );
    expect(error).toBeUndefined();
    const unit = data.units[0];
    expect(unit.id).toBe('206000125');
    expect(unit.level).toBe(120);
    expect(unit.pots).toEqual({ hp: 540, mp: 90, atk: 0, def: 40, mag: 65, spr: 40 });
    expect(unit.items).toEqual([
      { id: '310001700', slot: 0, pinned: false },
      { id: '403044500', slot: 2, pinned: false },
    ]);
    expect(data.itemSelector.additionalFilters).toEqual(['excludeNotReleasedYet']);
  });

  it('refuses an unknown unit', () => {
    expect(shortLinkToData([[999999927, 120, [0, 0, 0, 0, 0, 0]], [1, 1], []], units).error).toBe('Unknown unit id');
  });

  it('reads the oldest link format', () => {
    const data = oldLinkToData(
      {
        unit: '2060001',
        rarity: 7,
        goal: 'physicalDamage',
        enemyRaces: ['beast'],
        equipmentToUse: 'all',
        excludePremium: true,
      },
      (goal) => `goal:${goal}`,
    );
    expect(data.units[0].goal).toBe('goal:physicalDamage');
    expect(data.monster.races).toEqual(['beast']);
    expect(data.itemSelector).toEqual({ mainSelector: 'all', additionalFilters: ['excludePremium'] });
  });

  it('writes the version 2 data', () => {
    const data = stateData([{ id: '1' }], { races: [] }, 'all', ['excludePremium']);
    expect(data).toEqual({
      version: 2,
      units: [{ id: '1' }],
      monster: { races: [] },
      itemSelector: { mainSelector: 'all', additionalFilters: ['excludePremium'] },
    });
  });
});
