import { baseStats, elementList, killerList } from '../../../../core/constants/base-lists';
import { weaponList } from '../../../../core/constants/item-types';
import { EnemyStats } from '../../../../core/builder/enemy-stats';
import type { BuilderState } from './builder-state';
import type { DataStorage } from '../../../../core/builder/data-storage';
import type { Inventory } from '../../../shared/services/inventory';
import { resolveGoal, SimpleConditions, withConditions, parseChainMultiplier } from './goal';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

/** The inputs of the page, read into the build and the enemy. */

export const int = (text: string | undefined): number => parseInt(text ?? '', 10) || 0;

/** The base values of the build, from the inputs (the old `readStatsValues`). */
export function syncBaseValues(s: BuilderState): void {
  const build = s.build();
  const base: any = {};
  for (const stat of baseStats) {
    const unitBase = build.getStat ? build.getStat(stat) : 0;
    const pots = int(s.pots()[stat]);
    base[stat] = { base: unitBase, pots, total: unitBase + pots, buff: int(s.buffs()[stat]) };
  }
  const shards = parseFloat(s.lbShards());
  base['lbFillRate'] = { total: Number.isNaN(shards) ? 0 : shards, buff: int(s.lbFillRate()) };
  const mitigation = s.mitigations();
  base['mitigation'] = {
    physical: int(mitigation.physical),
    magical: int(mitigation.magical),
    global: int(mitigation.global),
  };
  base['drawAttacks'] = int(s.drawAttacks());
  base['lbDamage'] = int(s.lbDamage());
  base['currentStack'] = int(s.stack());
  base['killerBuffs'] = killerList.flatMap((name) => {
    const physical = int(s.killerBuffs()[name]?.physical);
    const magical = int(s.killerBuffs()[name]?.magical);
    if (!physical && !magical) return [];
    return [{ name, ...(physical ? { physical } : {}), ...(magical ? { magical } : {}) }];
  });
  base['elementBuffs'] = Object.fromEntries(
    elementList.map((element) => [element, int(s.elementBuffs()[element])]).filter(([, value]) => value),
  );
  build.baseValues = base;
  build.innateElements = [...s.innateElements()];
}

/** The stats the enemy has, from the inputs of the page. */
const stats = (value: (stat: string) => number): Record<string, number> =>
  Object.fromEntries(['atk', 'def', 'mag', 'spr'].map((stat) => [stat, value(stat)]));

export function enemy(s: BuilderState): EnemyStats {
  const monster = s.monster();
  const resists: Record<string, number> = {};
  const imperils: Record<string, number> = {};
  for (const element of elementList) {
    resists[element] = int(s.monsterResists()[element]);
    imperils[element] = int(s.monsterImperils()[element]);
  }
  for (const weapon of weaponList) {
    const value = int(s.monsterImperils()[weapon]);
    if (value) imperils[weapon] = value;
  }
  const stat = (text: string): number => (text ? parseInt(text, 10) : 100);
  return new EnemyStats(
    [...s.races()],
    stat(monster.atk),
    stat(monster.mag),
    stat(monster.def),
    stat(monster.spr),
    resists,
    stats((stat) => (s.monsterBreakability()[stat] ? int(s.monsterBreaks()[stat]) : 0)),
    stats((stat) => int(s.monsterBuffs()[stat])),
    { atk: true, def: true, mag: true, spr: true, ...s.monsterBreakability() },
    imperils,
    s.monsterAttackFormula(),
  );
}

/** The goal of the page as a formula, with its conditions (the old `readGoal`). */
export function readGoal(s: BuilderState): void {
  const build = s.build();
  const unit = s.unitWithSkills();
  if (!build.unit || !unit) return;
  if (s.goalChoice() === 'custom' && s.customFormula()) {
    build.goal = 'custom';
    build.formula = s.customFormula();
    return;
  }
  const resolved = resolveGoal(s.goalChoice(), unit, s.multicastSelection());
  if (!resolved) return;
  build.goal = resolved.goal;
  const conditions: SimpleConditions = {
    forcedElements: s.forcedElements().map((e) => (e === 'noElement' ? 'none' : e)),
    ailmentImunity: [...s.ailmentImmunities()],
    elementalResist: Object.fromEntries(
      elementList.map((e) => [e, int(s.goalResists()[e])]).filter(([, value]) => (value as number) > 0),
    ),
    various: [...s.various()],
  };
  build.formula = withConditions(resolved.formula, conditions, parseChainMultiplier(s.chainMultiplier()));
}

/** Keeps the goal choice valid for the unit, and the multicast skills in step with it. */
export function updateGoal(s: BuilderState): void {
  const options = s.goalOptions();
  const isCustom = s.goalChoice() === 'custom' && s.customFormula();
  if (!isCustom && !options.some((o) => o.value === s.goalChoice())) s.goalChoice.set('physicalDamage');
  const times = s.multicastTimes();
  const first = s.multicastOptions()[0]?.id ?? '';
  s.multicastSelection.update((selection) => times.map((i) => selection[i] ?? first));
}

/** The item filters of the page, read into the storage the optimizer and the picker use. */
export function readItemOptions(s: BuilderState, storage: DataStorage, inventory: Inventory): void {
  const source = s.source();
  storage.onlyUseOwnedItems = source === 'owned';
  storage.onlyUseShopRecipeItems = source === 'shop';
  storage.excludeJapan = source === 'global';
  storage.itemInventory = inventory.status() === 'loaded' ? inventory.items() : null;
  storage.exludeEventEquipment = s.excludeEvent();
  storage.excludeTMR5 = s.excludeTmr5();
  storage.excludeNotReleasedYet = s.excludeNotReleased();
  storage.excludePremium = s.excludePremium();
  storage.excludeSTMR = s.excludeStmr();
  storage.includeTMROfOwnedUnits = s.includeTmrOfOwnedUnits();
  storage.includeTmrMoogles = s.includeTmrMoogles();
  storage.includeFarmableStmr = s.includeFarmableStmr();
  storage.includeTrialRewards = s.includeTrialRewards();
  storage.includeChocoboItems = s.includeChocoboItems();
  storage.includeEasilyObtainableItems = s.includeEasyItems();
  storage.itemsToInclude = s.included();
  storage.defaultVisionCardLevel = int(s.defaultVisionCardLevel());
}

/** A goal chosen in the list: its inputs are read again. */
export function chooseGoal(s: BuilderState, value: string): void {
  s.goalChoice.set(value);
  s.multicastSelection.set([]);
  updateGoal(s);
  s.refresh();
}
