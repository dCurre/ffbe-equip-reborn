import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DataStorage } from '../../../../core/builder/data-storage';
import { UnitBuild } from '../../../../core/builder/unit-build';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

const data: any[] = JSON.parse(readFileSync('public/ALL/data.json', 'utf8'));

function storage(excludeJapan: boolean): any {
  const build = new UnitBuild();
  const result: any = new DataStorage({
    currentBuild: () => build,
    ownedUnits: () => null,
    itemEnchantments: () => null,
    allBuilds: () => ({ builds: [build], index: 0 }),
  } as any);
  result.setData(data);
  result.alreadyUsedItems = { enhancements: {} };
  result.unstackablePinnedItems = [];
  result.excludeNotReleasedYet = false;
  result.excludeJapan = excludeJapan;
  return result;
}

describe('the equipment of the Japan version', () => {
  const japanOnly = data.find((item) => item.server === 'JP' && item.type === 'sword');
  const global = data.find((item) => item.server !== 'JP' && item.type === 'sword' && !item.access.includes('not released yet'));

  it('has its items marked: they are not in the Global data', () => {
    const marked = new Set(data.filter((item) => item.server === 'JP').map((item) => item.id));
    expect(marked.size).toBe(595);
    expect(japanOnly).toBeDefined();
  });

  it('are left out with the Global source, and only them', () => {
    const excluded = storage(true).getAvailableNumbers(japanOnly);
    expect(excluded.available).toBe(0);
    expect(storage(true).getAvailableNumbers(global).available).toBeGreaterThan(0);
  });

  it('count with the other sources', () => {
    expect(storage(false).getAvailableNumbers(japanOnly).available).toBeGreaterThan(0);
  });
});
