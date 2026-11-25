import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any -- the skill data of the units has no fixed shape */

const skills: Record<string, any> = JSON.parse(readFileSync('public/ALL/unitsWithSkill.json', 'utf8'));
const search: any[] = JSON.parse(readFileSync('public/ALL/unitSearch.json', 'utf8'));

describe('the weapon imperils of the skills', () => {
  it('name every weapon type, in the skills and in the search', () => {
    expect(JSON.stringify(skills)).not.toContain('damage dealt by undefined');
    const withoutType = search.filter((unit) =>
      ['actives', 'passives', 'lb', 'counter'].some((section) =>
        Object.values(unit[section] ?? {}).some((area: any) => area?.weaponImperil && 'undefined' in area.weaponImperil),
      ),
    );
    expect(withoutType.map((unit) => unit.id)).toEqual([]);
  });

  it('list the four weapon types of Shockstorm (Machina Maw Rikku BS)', () => {
    const shockstorm = skills['249000517'].actives.find((skill: any) => skill.name === 'Shockstorm');
    const imperil = shockstorm.effects.find((effect: any) => effect.effect?.weaponImperil);
    expect(imperil.effect.weaponImperil).toEqual({ weaponType: ['bow', 'throwing', 'gun', 'fist'], value: 25 });
    expect(imperil.desc).toBe('Increase damage dealt by bow, throwing, gun and fist to all enemies by 25% for 3 turns');
    const area = search.find((unit) => unit.id === '249000517').actives.AOE.weaponImperil;
    expect(area).toEqual({ bow: 25, throwing: 25, gun: 25, fist: 25 });
  });
});
