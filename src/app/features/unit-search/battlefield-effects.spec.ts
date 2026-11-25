import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any -- the skill data of the units has no fixed shape */

const units: Record<string, any> = JSON.parse(readFileSync('public/ALL/unitsWithSkill.json', 'utf8'));
const descriptions = (id: string, skill: string): string[] =>
  [...units[id].passives, ...units[id].actives]
    .filter((entry: any) => entry.name.includes(skill))
    .flatMap((entry: any) => entry.effects.map((effect: any) => effect.desc as string));

describe('the battlefield effects of the Unleashed Evocation skills', () => {
  it('say the resistance they change, not 0%', () => {
    const wrong = Object.values(units).flatMap((unit: any) =>
      [...unit.actives, ...unit.magics, ...unit.passives]
        .flatMap((skill: any) => skill.effects.map((effect: any) => effect.desc as string))
        .filter((desc) => /battlefield effect.* resistance to \w+ by 0%/.test(desc)),
    );
    expect(wrong).toEqual([]);
  });

  it('give 30%, 40% and 50% to the +1, +2 and +3 of Sage of Thunder Sakura', () => {
    const SAKURA = '100035807';
    expect(descriptions(SAKURA, 'Unleashed Evocation (Sage of Thunder Sakura)').filter((desc) => desc.includes('Lightning'))).toEqual([
      'Apply battlefield effect to all units for 10 turns when summoning Ramuh: Reduce resistance to Lightning by 25%',
      'Apply battlefield effect to all units for 10 turns when summoning Ramuh: Reduce resistance to Lightning by 30%',
      'Apply battlefield effect to all units for 10 turns when summoning Ramuh: Reduce resistance to Lightning by 40%',
      'Apply battlefield effect to all units for 10 turns when summoning Ramuh: Reduce resistance to Lightning by 50%',
    ]);
  });
});
