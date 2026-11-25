import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculateBuildValueWithFormula } from '../../../../core/builder/damage-calculation';
import type { DataStorage } from '../../../../core/builder/data-storage';
import { EnemyStats } from '../../../../core/builder/enemy-stats';
import { getEsperItem } from '../../../../core/builder/item-conditions';
import type { ServerContext } from '../../../shared/services/server-context';
import type { StaticData } from '../../../shared/services/static-data';
import type { Toast } from '../../../shared/services/toast';
import { BuilderState } from './builder-state';
import { formulaByGoal } from './goal';
import { sumKillers } from './result-stats';
import { UnitLoader } from './unit-loader';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

const UNIT = '401013807'; // 2B -Neo Vision-, a physical attacker of the game data

/** The damage of a physical 1x skill against a bird, with a weapon of 300% bird killer and the Esper as given. */
async function damage(esper: any): Promise<number> {
  const all = JSON.parse(readFileSync(join(process.cwd(), 'public/ALL/unitsWithPassives.json'), 'utf8'));
  const s = new BuilderState({ server: () => 'GL' } as unknown as ServerContext);
  s.units.set({ [UNIT]: all[UNIT] });
  const staticData = { get: async () => ({ skills: [], actives: [], magics: [], passives: [], lb: { name: 'LB', effects: [] } }) } as unknown as StaticData;
  const loader = new UnitLoader(s, staticData, { show: () => undefined } as unknown as Toast, { setUnitBuild: () => undefined } as unknown as DataStorage);
  await loader.choose(UNIT);
  const build: any = s.build();
  build.involvedStats = ['atk', 'physicalKiller'];
  const weapon = { id: 'w', name: 'Bird Slayer', type: 'sword', atk: 100, killers: [{ name: 'bird', physical: 300, magical: 300 }], damageVariance: { min: 1, max: 1 } };
  const items: any[] = [weapon, null, null, null, null, null, null, null, null, null, null, getEsperItem(esper)];
  const enemy = new EnemyStats(['bird'], 100, 100, 100, 100, {}, { atk: 0, def: 0, mag: 0, spr: 0 }, { atk: 0, def: 0, mag: 0, spr: 0 }, { atk: 100, def: 100, mag: 100, spr: 100 }, {}, null);
  const result: any = calculateBuildValueWithFormula(items, build, enemy, formulaByGoal['physicalDamage'], 'max', false);
  return result.max;
}

const siren = { name: 'Siren', maxLevel: 3, hp: 7000, mp: 6500, atk: 4500, def: 4900, mag: 6300, spr: 6400 };

describe('the Stat Break killers of an Esper in the damage of a build', () => {
  it('add up to 50% to the 300% killer of the build', async () => {
    const without = await damage(siren);
    const withStatBreak = await damage({ ...siren, limitKillers: [{ name: 'bird', physical: 50, magical: 50 }] });
    expect(Number.isFinite(without) && without > 0).toBe(true);
    // the killer multiplier goes from 1 + 300% to 1 + 350%
    expect(withStatBreak / without).toBeCloseTo(4.5 / 4, 2);
  });

  it('do not count over 50%', async () => {
    const capped = await damage({ ...siren, limitKillers: [{ name: 'bird', physical: 50, magical: 50 }] });
    const over = await damage({ ...siren, limitKillers: [{ name: 'bird', physical: 90, magical: 90 }] });
    expect(over).toBe(capped);
  });
});

describe('the killers summary of a build', () => {
  it('keeps the Limit Break killers of the Esper apart, up to 50% a race', () => {
    const items = [
      { killers: [{ name: 'bird', physical: 200, magical: 100 }] },
      { limitKillers: [{ name: 'bird', physical: 30, magical: 30 }, { name: 'beast', physical: 40, magical: 40 }] },
      { limitKillers: [{ name: 'bird', physical: 40, magical: 10 }] },
    ];
    expect(sumKillers(items)).toEqual([
      { name: 'bird', physical: 200, magical: 100, limitPhysical: 50, limitMagical: 40 },
      { name: 'beast', physical: 0, magical: 0, limitPhysical: 40, limitMagical: 40 },
    ]);
  });
});
