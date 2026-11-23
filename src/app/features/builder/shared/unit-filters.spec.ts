import { describe, expect, it } from 'vitest';
import type { OwnedUnit } from '../../../shared/services/inventory';
import type { ServerContext } from '../../../shared/services/server-context';
import { BuilderState, BuilderUnit } from './builder-state';

const unit = (id: string, name: string, rarity: BuilderUnit['max_rarity'] = 'NV') => ({ id, name, max_rarity: rarity }) as BuilderUnit;

function setup(owned: Record<string, OwnedUnit> | null) {
  const s = new BuilderState({ server: () => 'GL' } as unknown as ServerContext, undefined, () => owned);
  s.units.set({ a: unit('a', 'Alpha'), b: unit('b', 'Beta'), c: unit('c', 'Gamma', 5) });
  s.onlyNvUnits.set(false);
  return s;
}

describe('the filters of the unit list', () => {
  it('keeps only the units of the inventory, not the ones only to farm', () => {
    const s = setup({ a: { number: 1, farmable: 0 }, b: { number: 0, farmable: 1 } });
    expect(s.unitOptions().map((o) => o.id)).toEqual(['a', 'b', 'c']);
    s.onlyOwnedUnits.set(true);
    expect(s.unitOptions().map((o) => o.id)).toEqual(['a']);
  });

  it('combines with the NV filter, and is offered only with an inventory', () => {
    const s = setup({ c: { number: 1, farmable: 0 }, a: { number: 1, farmable: 0 } });
    s.onlyOwnedUnits.set(true);
    s.onlyNvUnits.set(true);
    expect(s.unitOptions().map((o) => o.id)).toEqual(['a']);
    expect(s.hasOwnedUnits()).toBe(true);
    expect(setup(null).hasOwnedUnits()).toBe(false);
  });

  it('keeps the Brave Shift form of an owned unit, which the inventory does not list', () => {
    const s = setup({ a: { number: 1, farmable: 0 } });
    s.units.set({
      a: { ...unit('a', 'Alpha'), braveShift: 'a-bs' } as BuilderUnit,
      'a-bs': { ...unit('a-bs', 'Alpha BS'), braveShifted: 'a' } as BuilderUnit,
      b: unit('b', 'Beta'),
    });
    s.onlyOwnedUnits.set(true);
    expect(s.unitOptions().map((o) => o.id)).toEqual(['a', 'a-bs']);
  });
});
