import { baseStats, ailmentList, elementList, killerList } from '../../../../core/constants/base-lists';
import { esperNameById } from '../../../../core/constants/game-ids';
import { weaponList } from '../../../../core/constants/item-types';
import { weaponBaseDamageVariance } from '../../../../core/builder/damage/damage-data';
import { calculateStatValue, getEquipmentStatBonus } from '../../../../core/builder/stat-calculation';
import { hasDualWieldOrPartialDualWield, isTwoHanded } from '../../../../core/builder/item-values';
import { formulaToString } from '../../../../core/formula/formula-text';
import { encodeEsperLink } from '../../espers/esper-model';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core and the link data are open */

/**
 * The data of a shared build link (the format of the old page, `version` 2): what is needed to rebuild the units, the enemy
 * and the equipment choices. The old page wrote the same JSON, so links stay compatible both ways.
 */

/** The stats of the build that are kept as `calculatedValues` (the image export reads them). */
const CALCULATED_VALUES: Record<string, string> = {
  physicalEvasion: 'evade.physical',
  magicalEvasion: 'evade.magical',
  drawAttacks: 'drawAttacks',
  lbDamage: 'lbDamage',
  mpRefresh: 'mpRefresh',
  lbFillRate: 'lbFillRate',
  lbPerTurn: 'lbPerTurn',
  jumpDamage: 'jumpDamage',
  evoMag: 'evoMag',
  evokeDamageBoost: 'evokeDamageBoost.all',
};

/** The item filters of the page that go in a link. */
export const ADDITIONAL_FILTERS = [
  'includeEasilyObtainableItems',
  'includeChocoboItems',
  'includeTMROfOwnedUnits',
  'includeTmrMoogles',
  'includeFarmableStmr',
  'includeTrialRewards',
  'exludeEvent',
  'excludePremium',
  'excludeTMR5',
  'excludeSTMR',
  'excludeNotReleasedYet',
] as const;

function itemData(build: any, index: number): any {
  const item = build.build[index];
  const data: any = {
    slot: index,
    id: item.id,
    pinned: build.fixedItems[index] != null,
    icon: item.icon,
    name: item.name,
  };
  if (index === 0 || index === 1) {
    data.type = item.type;
    if (weaponList.includes(data.type)) {
      data.atk = item.atk || 0;
      const variance =
        item.damageVariance ?? (weaponBaseDamageVariance as any)[isTwoHanded(item) ? '2h' : '1h'][item.type];
      data.damageVariance = { min: variance.min, max: variance.max };
    }
  } else if (index === 10) {
    data.id = item.id.split('-')[0];
    for (const stat of baseStats) data[stat] = item[stat] || 0;
    data.level = item.level;
  }
  return data;
}

/** The killers of the equipment, summed by race: `{ race: { physical, magical } }`. */
function killerTotals(items: any[]): Record<string, { physical: number; magical: number }> {
  const totals: Record<string, { physical: number; magical: number }> = {};
  for (const race of killerList) totals[race] = { physical: 0, magical: 0 };
  for (const item of items) {
    for (const killer of item?.killers ?? []) {
      const total = totals[killer.name];
      if (!total) continue;
      total.physical += killer.physical || 0;
      total.magical += killer.magical || 0;
    }
  }
  return totals;
}

/** The Esper page with the board of an owned Esper, without the account (`o`). */
function esperPageLink(esper: any, server: string): string {
  const url = new URL('espers', document.baseURI);
  url.search = `?server=${server}&o`;
  return `${url.href}#${encodeEsperLink(esper)}`;
}

/** One unit of the link, from a build of the page. */
export function unitState(build: any, server: string): any {
  const unit: any = {
    id: build.unit.id,
    name: build.unit.name,
    rarity: build.unit.sixStarForm ? 6 : build.unit.sevenStarForm ? 7 : build.unit.max_rarity,
    enhancementLevels: build.unit.enhancementLevels,
    goal: formulaToString(build.formula),
    innateElements: [...(build.innateElements ?? [])],
    items: [],
  };
  const enchantments: any[] = [];
  const push = (index: number): void => {
    unit.items.push(itemData(build, index));
    enchantments.push(build.build[index].enhancements ?? null);
  };
  const equipped = (index: number): any => {
    const item = build.build[index];
    return item && !item.placeHolder && item.type !== 'unavailable' ? item : null;
  };
  // the items that allow the use of others come first, then the dual wield ones, then the rest
  for (let i = 0; i < 11; i++) if (equipped(i)?.allowUseOf) push(i);
  for (let i = 0; i < 11; i++)
    if (equipped(i) && !equipped(i).allowUseOf && hasDualWieldOrPartialDualWield(equipped(i))) push(i);
  for (let i = 0; i < 11; i++) {
    const item = build.build[i];
    if (equipped(i) && !item.allowUseOf && !hasDualWieldOrPartialDualWield(item)) push(i);
    if (item?.placeHolder) unit.items.push({ slot: i, id: item.type, pinned: false });
  }
  if (enchantments.some((e) => e)) unit.itemEnchantments = enchantments;
  if (build.build[11]) {
    unit.esperId = build.build[11].name;
    unit.esperPinned = build.fixedItems[11] != null;
    const owned = build.build[11].originalEsper;
    if (owned?.selectedSkills) {
      // an owned Esper goes in the link whole, with the link of its board in the Esper page
      const { buildLink: _link, selectedSkills: _skills, maxLevel: _max, ...esper } = structuredClone(owned);
      unit.esper = { ...esper, resist: esper.resist ?? [], buildLink: esperPageLink(owned, server) };
    }
  }
  const values = build.baseValues;
  unit.pots = {};
  unit.maxPots = {};
  unit.buffs = {};
  for (const stat of baseStats) {
    unit.pots[stat] = values[stat].pots;
    unit.maxPots[stat] = build.unit.stats.pots[stat];
    unit.buffs[stat] = values[stat].buff;
  }
  unit.buffs.lbFillRate = values.lbFillRate.buff;
  unit.lbShardsPerTurn = values.lbFillRate.total;
  unit.buffs.mitigation = {
    physical: values.mitigation.physical,
    magical: values.mitigation.magical,
    global: values.mitigation.global,
  };
  unit.buffs.drawAttacks = values.drawAttacks || 0;
  unit.buffs.lbDamage = values.lbDamage || 0;
  if (values.killerBuffs) unit.buffs.killers = values.killerBuffs;
  if (values.elementBuffs) unit.buffs.elements = values.elementBuffs;
  if (values.currentStack) unit.stack = values.currentStack;
  if (build.level) unit.level = build.level;
  if (build._exAwakeningLevel && build._exAwakeningLevel >= 0) unit.exAwakening = build._exAwakeningLevel;

  const calculated: any = { elementResists: {}, ailmentResists: {}, killers: killerTotals(build.build) };
  for (const stat of baseStats) {
    const value = calculateStatValue(build.build, stat, build);
    calculated[stat] = {
      value: Math.floor(value.total),
      bonus: Math.floor(value.bonusPercent),
      flatStatBonus: Math.floor((getEquipmentStatBonus(build.build, stat, false) - 1) * 100),
    };
  }
  for (const [name, stat] of Object.entries(CALCULATED_VALUES)) {
    calculated[name] = { value: calculateStatValue(build.build, stat, build).total };
  }
  for (const element of elementList)
    calculated.elementResists[element] = calculateStatValue(build.build, `resist|${element}.percent`, build).total;
  for (const ailment of ailmentList)
    calculated.ailmentResists[ailment] = calculateStatValue(build.build, `resist|${ailment}.percent`, build).total;
  unit.calculatedValues = calculated;
  return unit;
}

/** The whole link data. `enemy` and `filters` come from the page. */
export function stateData(units: any[], enemy: any, mainSelector: string, filters: readonly string[]): any {
  return {
    version: 2,
    units,
    monster: enemy,
    itemSelector: { mainSelector, additionalFilters: [...filters] },
  };
}

/** What a link of the format `[[unit, level, pots], [esper, rarity], [items], [IW upgrades]]` means. */
export function shortLinkToData(
  short: any[][],
  units: Record<string, any>,
): { data?: any; error?: string; warning?: string } {
  const unitIdString = short[0][0].toString();
  const baseId = unitIdString.substring(0, unitIdString.length - 1);
  const rarity = unitIdString.substring(unitIdString.length - 1);
  let found: any = null;
  for (let i = 1; i <= 5; i++) if (units[baseId + i]) found = units[baseId + i];
  if (!found) return { error: 'Unknown unit id' };
  const unit: any = { id: found.id };
  let warning: string | undefined;
  if (rarity !== '6' && String(found.max_rarity) !== rarity) {
    warning = 'FFBE Equip Reborn only support max rarity units. Max unit rarity will be displayed';
    unit.rarity = found.max_rarity;
  } else {
    unit.rarity = rarity;
  }
  if (unit.rarity == 7) unit.level = short[0][1];
  unit.goal = 'Maximize P_DAMAGE';
  unit.pots = Object.fromEntries(baseStats.map((stat, i) => [stat, short[0][2][i]]));
  unit.esperId = (esperNameById as Record<string, string>)[short[1][0] as any];
  unit.esperPinned = false;
  unit.items = short[2]
    .map((id: any, slot: number) => (id ? { id: id.toString(), slot, pinned: false } : null))
    .filter((item: any) => item);
  // short[3] (the IW upgrades) is not read: the old page tested `.size` on arrays, so it never applied them either
  return {
    data: {
      version: 2,
      units: [unit],
      itemSelector: { mainSelector: 'all', additionalFilters: ['excludeNotReleasedYet'] },
    },
    warning,
  };
}

/** What a link of the oldest format (one unit, flat fields) means. */
export function oldLinkToData(old: any, goalFormula: (goal: string) => string): any {
  const unit: any = {
    id: old.unit,
    rarity: old.rarity,
    goal: old.goal === 'custom' ? old.customFormula : goalFormula(old.goal),
    innateElements: old.innateElements,
    items: old.fixedItems,
    esperId: old.esper,
    pots: old.pots,
    buffs: old.buff,
    lbShardsPerTurn: old.lbShardsPerTurn,
    mitigation: old.mitigation,
  };
  const additionalFilters = ADDITIONAL_FILTERS.filter(
    (name) => name !== 'includeEasilyObtainableItems' && name !== 'includeChocoboItems' && old[name],
  );
  return {
    units: [unit],
    monster: {
      races: old.enemyRaces,
      elementalResist: old.enemyResists,
      def: old.monsterDef,
      spr: old.monsterSpr,
      breaks: { atk: 0, def: 0, mag: 0, spr: 0 },
      buffs: { atk: 0, def: 0, mag: 0, spr: 0 },
      breakability: { atk: true, def: true, mag: true, spr: true },
    },
    itemSelector: { mainSelector: old.equipmentToUse, additionalFilters },
  };
}
