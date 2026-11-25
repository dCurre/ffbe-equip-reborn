import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculateBuildValueWithFormula } from '../../../../core/builder/damage-calculation';
import type { DataStorage } from '../../../../core/builder/data-storage';
import { EnemyStats } from '../../../../core/builder/enemy-stats';
import type { ServerContext } from '../../../shared/services/server-context';
import type { StaticData } from '../../../shared/services/static-data';
import type { Toast } from '../../../shared/services/toast';
import { BuilderState } from './builder-state';
import { defaultMonsterAttackFormula, formulaByGoal } from './goal';
import { resultStats } from './result-stats';
import { UnitLoader } from './unit-loader';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

const UNIT = '401013807';
const enemy = () =>
  new EnemyStats(['bird'], 100, 100, 100, 100, {}, { atk: 0, def: 0, mag: 0, spr: 0 }, { atk: 0, def: 0, mag: 0, spr: 0 }, { atk: 100, def: 100, mag: 100, spr: 100 }, {}, defaultMonsterAttackFormula);

async function setup(): Promise<any> {
  const all = JSON.parse(readFileSync(join(process.cwd(), 'public/ALL/unitsWithPassives.json'), 'utf8'));
  const s = new BuilderState({ server: () => 'GL' } as unknown as ServerContext);
  s.units.set({ [UNIT]: all[UNIT] });
  const staticData = { get: async () => ({ skills: [], actives: [], magics: [], passives: [], lb: { name: 'LB', effects: [] } }) } as unknown as StaticData;
  const loader = new UnitLoader(s, staticData, { show: () => undefined } as unknown as Toast, { setUnitBuild: () => undefined } as unknown as DataStorage);
  await loader.choose(UNIT);
  const build: any = s.build();
  build.involvedStats = ['atk', 'physicalKiller'];
  build.formula = formulaByGoal['physicalDamage'];
  build.build[0] = { id: 'w', name: 'Sword', type: 'sword', atk: 300, damageVariance: { min: 1, max: 1 } };
  return build;
}

describe('the value of the goal in the result', () => {
  it('is the one the search would find, and follows the items of the build', async () => {
    const build = await setup();
    // a value left by an old search must not be shown
    build.buildValue = { min: 1, avg: 1, max: 1 };
    const goalOf = (): number => resultStats(build, enemy(), 'max').damage.find((line: any) => line.kind === 'build' || line.kind === 'physical')!.value.max;

    const expected = calculateBuildValueWithFormula(build.build, build, enemy(), build.formula, 'max').max;
    expect(goalOf()).toBe(expected);
    expect(expected).toBeGreaterThan(1);

    build.build[0] = null;
    const without = calculateBuildValueWithFormula(build.build, build, enemy(), build.formula, 'max').max;
    expect(goalOf()).toBe(without);
    expect(without).toBeLessThan(expected);
  });
});
