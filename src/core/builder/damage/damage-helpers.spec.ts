import { describe, expect, it } from 'vitest';
import { addItemKillers, emptyKillerByRace } from './damage-helpers';

const enemy = { races: ['beast'] };
const item = (killers: object[], limitKillers?: object[]) => ({ killers, limitKillers });
const total = (items: object[]) => {
  const byRace = emptyKillerByRace();
  addItemKillers(byRace, items, enemy, 'physical');
  return byRace['beast'];
};

describe('the killers of the build', () => {
  it('stop at 300% per race', () => {
    expect(total([item([{ name: 'beast', physical: 200 }]), item([{ name: 'beast', physical: 200 }])])).toBe(300);
  });

  it('count the Stat Break killers of the Esper on top of the 300%, up to 50%', () => {
    const esper = item([], [{ name: 'beast', physical: 50, magical: 50 }]);
    expect(total([item([{ name: 'beast', physical: 400 }]), esper])).toBe(350);
    // without other killers they count by themselves
    expect(total([esper])).toBe(50);
  });

  it('cap the Stat Break killers at 50% per race, and only count the ones of the enemy', () => {
    const esper = item([], [{ name: 'beast', physical: 40 }, { name: 'beast', physical: 40 }, { name: 'bird', physical: 50 }]);
    expect(total([esper])).toBe(50);
  });
});
