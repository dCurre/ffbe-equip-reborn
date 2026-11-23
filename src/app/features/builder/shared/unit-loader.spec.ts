import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DataStorage } from '../../../../core/builder/data-storage';
import type { ServerContext } from '../../../shared/services/server-context';
import type { StaticData } from '../../../shared/services/static-data';
import type { Toast } from '../../../shared/services/toast';
import { BuilderState } from './builder-state';
import { UnitLoader } from './unit-loader';

const BASE = '401013807';
const SHIFTED = '401013817';

/** 2B -Neo Vision- as the game data has it: the base form and its Brave Shift form (`public/GL/unitsWithPassives.json`). */
function setup(ids: string[] = [BASE, SHIFTED]) {
  const all = JSON.parse(readFileSync(join(process.cwd(), 'public/GL/unitsWithPassives.json'), 'utf8'));
  const s = new BuilderState({ server: () => 'GL' } as unknown as ServerContext);
  s.units.set(Object.fromEntries(ids.map((id) => [id, all[id]])));
  // the skills are not part of this test: a unit without any
  const staticData = { get: async () => ({ skills: [], actives: [], magics: [], passives: [], lb: { name: 'LB', effects: [] } }) } as unknown as StaticData;
  const toast = { show: () => undefined } as unknown as Toast;
  const dataStorage = { setUnitBuild: () => undefined } as unknown as DataStorage;
  return { s, loader: new UnitLoader(s, staticData, toast, dataStorage) };
}

describe('UnitLoader.braveShift', () => {
  it('shows the other form: the unit, the list selection and the stats at the default level and EX', async () => {
    const { s, loader } = setup();
    await loader.choose(BASE);
    expect(s.unit()?.name).toBe('2B -Neo Vision-');
    expect(s.hasBraveShift()).toBe(true);
    expect(s.build().getStat('hp')).toBe(6522);
    // starts from the highest EX awakening of the unit, as the old page did
    expect(s.build()._exAwakeningLevel).toBe(3);
    expect(s.exLevel()).toBe('3');

    loader.braveShift();

    expect(s.unit()?.name).toBe('2B -Neo Vision- BS');
    expect(s.unitId()).toBe(SHIFTED);
    expect(s.build().level).toBe(120);
    expect(s.level()).toBe('120');
    expect(s.exLevel()).toBe('3');
    expect(s.build().getStat('hp')).toBe(6905);
  });

  it('comes back to the first form with its stats', async () => {
    const { s, loader } = setup();
    await loader.choose(BASE);
    loader.braveShift();
    loader.braveShift();

    expect(s.unit()?.name).toBe('2B -Neo Vision-');
    expect(s.unitId()).toBe(BASE);
    expect(s.build().getStat('hp')).toBe(6522);
  });

  // what the EX awakening select does (UnitPanel.setExLevel)
  const setEx = (s: BuilderState, level: number) => {
    s.exLevel.set(String(level));
    s.build().setExAwakeningLevel(level);
    s.refresh();
  };

  it('changes the stats with the EX awakening, from EX+0 to the highest', async () => {
    const { s, loader } = setup();
    await loader.choose(BASE);
    const hp = [0, 1, 2, 3].map((level) => {
      setEx(s, level);
      return s.build().getStat('hp');
    });
    expect(hp).toEqual([5017, 5669, 6171, 6522]);
  });

  it('keeps the EX awakening chosen when the form is switched, in both forms', async () => {
    const { s, loader } = setup();
    await loader.choose(BASE);
    setEx(s, 1);
    loader.braveShift();
    expect(s.exLevel()).toBe('1');
    expect(s.build().getStat('hp')).toBe(5400 + 652);
    setEx(s, 2);
    loader.braveShift();
    expect(s.exLevel()).toBe('2');
    expect(s.build().getStat('hp')).toBe(5017 + 652 + 502);
  });

  it('applies the level chosen for an enhancement of the unit', async () => {
    const { s, loader } = setup(['100000102']); // Rain
    await loader.choose('100000102');
    expect(s.unit()?.enhancementLevels).toEqual([2]);
    await loader.setEnhancement(0, 0);
    expect(s.unit()?.enhancementLevels).toEqual([0]);
    await loader.setEnhancement(0, 1);
    expect(s.unit()?.enhancementLevels).toEqual([1]);
  });

  it('does not add the skills of the enhancements of the other form again at each choice', async () => {
    const { s, loader } = setup(['100000315', '100000337']); // Dark Fina and its Brave Shift form
    await loader.choose('100000315');
    const skills = s.build().getBraveshift().unit.skills.length;
    await loader.choose('100000315');
    await loader.choose('100000315');
    expect(s.build().getBraveshift().unit.skills.length).toBe(skills);
  });
});
