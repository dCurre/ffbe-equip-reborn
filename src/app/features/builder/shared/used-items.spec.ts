import { describe, expect, it } from 'vitest';
import { DataStorage } from '../../../../core/builder/data-storage';
import { UnitBuild } from '../../../../core/builder/unit-build';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

function setup() {
  const current = new UnitBuild();
  const other = new UnitBuild();
  other.build = [{ id: 'sword-1', type: 'sword' }, null, null, null, null, null, null, null, null, null, null, { id: 'ifrit' }];
  const storage = new DataStorage({
    currentBuild: () => current,
    ownedUnits: () => null,
    itemEnchantments: () => null,
    allBuilds: () => ({ builds: [current, other], index: 0 }),
  });
  return { current, storage: storage as any };
}

describe('the items the other builds use', () => {
  it('counts the items and the Esper of the other tabs, whatever build the caller passes', () => {
    const { current, storage } = setup();
    storage.calculateAlreadyUsedItems([current], 0);
    expect(storage.alreadyUsedItems['sword-1']).toBe(1);
    expect(storage.alreadyUsedEspers).toEqual(['ifrit']);
  });

  it('does not count the items of the build being worked on', () => {
    const { current, storage } = setup();
    current.build = [{ id: 'axe-1', type: 'axe' }];
    storage.calculateAlreadyUsedItems([current], 0);
    expect(storage.alreadyUsedItems['axe-1']).toBeUndefined();
  });
});
