import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DataStorage } from '../../../../core/builder/data-storage';
import { findBestItemVersion } from '../../../../core/builder/item-conditions';
import { UnitBuild } from '../../../../core/builder/unit-build';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

/** The version of an item the build gets (`findBestItemVersion` with the real data of the game). */
function versionFor(itemId: string, weapons: (string | null)[]): any {
  const data = JSON.parse(readFileSync('public/ALL/data.json', 'utf8'));
  const build = new UnitBuild();
  const storage: any = new DataStorage({
    currentBuild: () => build,
    ownedUnits: () => null,
    itemEnchantments: () => null,
    allBuilds: () => ({ builds: [build], index: 0 }),
  } as any);
  storage.setData(data);
  const equipped: any[] = Array(12).fill(null);
  weapons.forEach((type, index) => {
    if (type) equipped[index] = { id: `weapon-${index}`, type };
  });
  const item = data.find((entry: any) => entry.id === itemId);
  return findBestItemVersion(equipped, item, storage.itemWithVariation, { id: 'unit', roles: ['physicalAttacker'], sex: 'female' });
}

describe('items with an effect that depends on the weapon', () => {
  // Spirit Tiger Mask: HP +100% and ATK +70 always; the killer and the ATK of a single weapon only with a katana or a great sword
  const MASK = '403056200';

  it('give their killer with a weapon of the condition', () => {
    for (const weapons of [['katana'], ['greatSword'], ['katana', 'dagger']]) {
      const mask = versionFor(MASK, weapons);
      expect(mask.killers).toEqual([{ name: 'beast', physical: 75, magical: 75 }]);
      expect(mask.oneWeaponMastery).toEqual({ atk: 50 });
      expect(mask.hp).toBe(7500);
    }
  });

  it('keep their stats, without the killer, with any other weapon or none', () => {
    for (const weapons of [['sword'], [null, null], ['dagger', 'dagger']]) {
      const mask = versionFor(MASK, weapons);
      expect(mask.access).not.toContain('Conditions not met');
      expect(mask).toMatchObject({ hp: 7500, 'hp%': 100, atk: 70 });
      expect(mask.killers).toBeUndefined();
    }
  });


  // Souls Joined through Prayer, the TMR of Knights of Grandshelt: the killers against demons and humans with a great sword or a katana
  it('give the killers of a materia only with a weapon of the condition', () => {
    const MATERIA = '504243341';
    for (const weapons of [['katana'], ['greatSword'], ['greatSword', null]]) {
      expect(versionFor(MATERIA, weapons).killers).toEqual([
        { name: 'demon', physical: 75, magical: 75 },
        { name: 'human', physical: 75, magical: 75 },
      ]);
    }
    for (const weapons of [['sword'], [null, null], ['dagger', 'dagger']]) {
      expect(versionFor(MATERIA, weapons).access).toContain('Conditions not met');
    }
  });
});
