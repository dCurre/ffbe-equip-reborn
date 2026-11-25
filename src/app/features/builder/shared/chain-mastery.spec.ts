import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DataStorage } from '../../../../core/builder/data-storage';
import { getChainMult } from '../../../../core/builder/damage/damage-helpers';
import { calculateStatValue } from '../../../../core/builder/stat-calculation';
import type { ServerContext } from '../../../shared/services/server-context';
import type { StaticData } from '../../../shared/services/static-data';
import type { Toast } from '../../../shared/services/toast';
import { BuilderState } from './builder-state';
import { UnitLoader } from './unit-loader';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

const IBARA = '401010107';
const IBARA_BS = '401010117';

/** The chain mastery of the unit with two weapons or one, as the calculation sees it (the items, then the passives that apply). */
async function chain(id: string, weapons: number, secondHand = 'rod'): Promise<{ stat: number; multiplier: number }> {
  const all = JSON.parse(readFileSync(join(process.cwd(), 'public/ALL/unitsWithPassives.json'), 'utf8'));
  const s = new BuilderState({ server: () => 'GL' } as unknown as ServerContext);
  s.units.set({ [id]: all[id] });
  const staticData = { get: async () => ({ skills: [], actives: [], magics: [], passives: [], lb: { name: 'LB', effects: [] } }) } as unknown as StaticData;
  const loader = new UnitLoader(s, staticData, { show: () => undefined } as unknown as Toast, { setUnitBuild: () => undefined } as unknown as DataStorage);
  await loader.choose(id);
  const build: any = s.build();
  build.level = 120;
  build.setExAwakeningLevel(3);
  const hand = (n: number, type: string) => ({ id: `${type}-${n}`, name: type, type, mag: 100 });
  const equipped: any[] = [hand(0, 'rod'), weapons > 1 ? hand(1, secondHand) : null, ...Array(10).fill(null)];
  build.unitShift.build = equipped;
  const passives = build.unit.skills.filter(
    (skill: any) => (!skill.levelCondition || skill.levelCondition <= 120) && (!skill.exLevelCondition || skill.exLevelCondition <= 3),
  );
  const items = [...equipped, ...passives];
  return { stat: calculateStatValue(items, 'chainMastery', build).total, multiplier: getChainMult(build, items) };
}

describe('the chain mastery of a unit with a passive that improves the dual wield', () => {
  it('adds 200% with two weapons (Protruding Horns of Ibara BS), as the damage already does', async () => {
    expect(await chain(IBARA_BS, 2)).toEqual({ stat: 6, multiplier: 6 });
  });

  it('adds nothing with a shield in the other hand, in the stat and in the damage', async () => {
    expect(await chain(IBARA_BS, 2, 'lightShield')).toEqual({ stat: 4, multiplier: 4 });
  });

  it('adds nothing with one weapon', async () => {
    expect(await chain(IBARA_BS, 1)).toEqual({ stat: 4, multiplier: 4 });
  });

  it('does not change a unit without that passive', async () => {
    expect(await chain(IBARA, 2)).toEqual({ stat: 5, multiplier: 5 });
  });
});
