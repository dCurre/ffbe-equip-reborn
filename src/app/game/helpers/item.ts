import { accessList, ailmentList, baseStats, elementList, typeListWithEsper } from '../../../core/constants';
import { itemStats } from './item-stats';

export type { Item } from '../models/item.model';
import type { Item } from '../models/item.model';

type Units = Readonly<Record<string, { name: string; sex?: string; roles?: string[] }>>;

const isTwoHanded = (item: Item): boolean => !!item.special?.includes('twoHanded');

/** The text the search box looks into: name, stats, effects, units, access. */
export function buildSearchString(item: Item, units: Units): string {
  const unitName = (id: string): string => units[id]?.name ?? id;
  const parts: string[] = [item.name + (item['jpname'] ?? '')];
  const add = (...texts: string[]): void => void parts.push(...texts);
  add(
    itemStats(item)
      .map((entry) => entry.text)
      .join(''),
  );
  if (item['evade']?.physical) add(`Evade physical ${item['evade'].physical}%`);
  if (item['evade']?.magical) add(`Evade magical ${item['evade'].magical}%`);
  for (const resist of [...(item['resist'] ?? [])].reverse()) add(resist.name);
  for (const element of [...(item['element'] ?? [])].reverse()) add(element);
  for (const ailment of [...(item['ailments'] ?? [])].reverse()) add(ailment.name);
  if (item['exclusiveUnits']) {
    add(
      `Only ${item['exclusiveUnits']
        .filter((id: string) => units[id])
        .map(unitName)
        .join(', ')}`,
    );
  }
  if (item['exclusiveSex']) add(`Only ${item['exclusiveSex']}`);
  if (item['exclusiveRoles']) add(`Only ${item['exclusiveRoles'].join(', ')}`);
  if (item['condition']) add(`Only ${item['condition']}`);
  for (const condition of item['equipedConditions'] ?? []) add(`If equiped with ${condition}`);
  if (item['allowUseOf']) {
    // as the old site: with several types, every part repeats the whole list
    if (Array.isArray(item['allowUseOf'])) {
      parts[parts.length - 1] += item['allowUseOf'].map(() => `|Allow use of ${item['allowUseOf']}`).join('');
    } else add(`Allow use of ${item['allowUseOf']}`);
  }
  if (item['mpRefresh']) add(`Recover MP (${item['mpRefresh']}%) per turn`);
  if (item['drawAttacks']) add(`+${item['drawAttacks']}% draw attacks`);
  for (const text of item['special'] ?? []) add(text);
  const wielding = (key: string, suffix: string): void => {
    for (const stat of baseStats) {
      if (item[key]?.[stat]) add(`Increase equipment ${stat.toUpperCase()}(${item[key][stat]}%) ${suffix}`);
    }
  };
  wielding('singleWielding', 'when single wielding');
  if (item['singleWielding']?.accuracy) {
    add(`Increase Accuracy (${item['singleWielding'].accuracy}%) when single wielding`);
  }
  wielding('singleWieldingOneHanded', 'when single wielding a one-handed weapon');
  if (item['singleWieldingOneHanded']?.accuracy) {
    add(`Increase Accuracy (${item['singleWieldingOneHanded'].accuracy}%) when single wielding a one-handed weapon`);
  }
  wielding('dualWielding', 'when dual wielding');
  wielding('oneWeaponMastery', 'when single wielding any weapon with or without shield');
  if (item['chainMastery']) add(`Increase chain modifier cap (${item['chainMastery']}%)`);
  for (const killer of item['killers'] ?? []) add(`killer ${killer.name}`);
  if (item['accuracy']) add(`Increase Accuracy: ${item['accuracy']}%`);
  if (item['jumpDamage']) add(`Increase damage dealt by jump attacks by ${item['jumpDamage']}%`);
  if (item['lbDamage']) add(`Increase LB damage (+${item['lbDamage']}%)`);
  if (item['lbFillRate']) add(`Increase LB gauge fill rate (${item['lbFillRate']}%)`);
  if (item['lbPerTurn']) {
    const { min, max } = item['lbPerTurn'];
    add(`Increase LB gauge each turn (${min === max ? min : `${min}-${max}`})`);
  }
  if (item['evoMag']) add(`Increase Esper summon damage by ${item['evoMag']}%`);
  for (const esper of Object.keys(item['esperStatsBonus'] ?? {})) {
    const hp = item['esperStatsBonus'][esper].hp;
    add(esper === 'all' ? `Increase esper's bonus stats (${hp}%)` : `Increase ${esper}'s bonus stats (${hp}%)`);
  }
  if (item['guts']) {
    const { chance, ifHpOver, time } = item['guts'];
    add(`${chance}% chance to set HP to 1 upon fatal damage, if HP was above ${ifHpOver}% (max ${time} times)`);
  }
  for (const key of Object.keys(item['evokeDamageBoost'] ?? {})) {
    const value = item['evokeDamageBoost'][key];
    add(key === 'all' ? `+${value}% damage for esper summons and evoke skills` : `+${value}% ${key} summon damage`);
  }
  const effects = (skill: { effects: { desc: string }[] }): string => skill.effects.map((e) => e.desc).join(', ');
  for (const skill of item['skills'] ?? []) add(`skill ${skill.name}: ${effects(skill)}`);
  for (const skill of item['autoCastedSkills'] ?? []) {
    add(`Cast at start of battle or when revived:${skill.name}: ${effects(skill)}`);
  }
  for (const { skill } of item['startOfTurnSkills'] ?? [])
    add(`Cast at start of turn: ${skill.name}: ${effects(skill)}`);
  if (item['tmrUnit']) add(unitName(item['tmrUnit']));
  if (item['stmrUnit']) add(unitName(item['stmrUnit']));
  for (const access of item.access ?? []) add(access);
  if (item['partialDualWield']) add(`partial dual wield ${item['partialDualWield'].join(' ')}`);
  return parts.join('|');
}

// --- Searching and filtering ---

const escapeRegExp = (text: string): string => text.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');

/** The words of a search; text between quotes is kept as one word. */
export function searchTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const quoted of text.match(/"[^"]*"/g) ?? []) {
    tokens.push(quoted.slice(1, -1));
    text = text.replace(quoted, '');
  }
  if (text) tokens.push(...text.split(' '));
  return tokens.filter((token) => token.trim() !== '');
}

/** Does the item contain all the words? A `*` in a word stands for a number (or a range of numbers). */
export function containsText(text: string, item: Item): boolean {
  return searchTokens(text).every((token) =>
    new RegExp(escapeRegExp(token).replace('\\*', '\\d+(-\\d+)?'), 'i').test(item.searchString ?? ''),
  );
}

/** Has the item the stat (a flat value, a % value, a static value, or one of the stats made of effects)? */
export function hasStat(stat: string, item: Item): boolean {
  return !!(
    item[stat] ||
    item[stat + '%'] ||
    item['staticStats']?.[stat] ||
    (stat === 'inflict' && (item['element'] || item['ailments'] || item['killers'])) ||
    (stat === 'resist' && item['resist']) ||
    isTwoHanded(item)
  );
}

export function hasStats(additional: readonly string[], item: Item): boolean {
  return additional.every((stat) => item[stat] || item[stat + '%'] || (stat === 'twoHanded' && isTwoHanded(item)));
}

/** The filters a page applies; an empty list means "no filter". */
export interface ItemQuery {
  stat?: string;
  /** keep the items without the stat too */
  showItemsWithoutStat?: boolean;
  text?: string;
  types?: readonly string[];
  elements?: readonly string[];
  ailments?: readonly string[];
  physicalKillers?: readonly string[];
  magicalKillers?: readonly string[];
  /** the accesses the user does not want (a prefix or a suffix of an access) */
  accessToRemove?: readonly string[];
  additionalStats?: readonly string[];
  /** a selected value must all match (AND) instead of one of them (OR) */
  elementsAnd?: boolean;
  ailmentsAnd?: boolean;
  killersAnd?: boolean;
  /** the unit looking for items: the items exclusive to other units, roles or sex are left out */
  unit?: { id: string; roles?: readonly string[]; sex?: string };
  showNotReleasedYet?: boolean;
  /** only the items of this inventory (`itemInventory`) */
  onlyOwned?: Readonly<Record<string, unknown>>;
}

/** No selected value: no filter. Otherwise one of them (or all of them with `and`) must match. */
const matchValues = <T>(
  values: readonly T[] | undefined,
  and: boolean | undefined,
  test: (value: T) => boolean,
): boolean => !values?.length || (and ? values.every(test) : values.some(test));

export function itemMatches(item: Item, query: ItemQuery): boolean {
  if (!query.showNotReleasedYet && item.access.includes('not released yet')) return false;
  if (!query.showItemsWithoutStat && query.stat && !hasStat(query.stat, item)) return false;
  if (query.text && !containsText(query.text, item)) return false;
  if (query.additionalStats?.length && !query.additionalStats.every((s) => hasStat(s, item))) return false;
  if (query.accessToRemove?.length) {
    const forbidden = query.accessToRemove.flatMap((a) => a.split('/'));
    const allowed = accessList.filter((a) => !forbidden.some((f) => a.startsWith(f) || a.endsWith(f)));
    if (!allowed.some((a) => item.access?.includes(a))) return false;
  }
  if (
    !matchValues(query.magicalKillers, query.killersAnd, (k) =>
      item['killers']?.some((x: { name: string; magical?: number }) => x.name === k && x.magical),
    )
  ) {
    return false;
  }
  if (
    !matchValues(query.physicalKillers, query.killersAnd, (k) =>
      item['killers']?.some((x: { name: string; physical?: number }) => x.name === k && x.physical),
    )
  ) {
    return false;
  }
  if (
    !matchValues(
      query.ailments,
      query.ailmentsAnd,
      (a) =>
        item['ailments']?.some((x: { name: string }) => x.name === a) ||
        item['resist']?.some((r: { name: string }) => r.name === a),
    )
  ) {
    return false;
  }
  if (
    !matchValues(
      query.elements,
      query.elementsAnd,
      (e) =>
        item['element']?.includes(e) ||
        (e === 'noElement' && !item['element']) ||
        item['resist']?.some((r: { name: string }) => r.name === e),
    )
  ) {
    return false;
  }
  if (!matchValues(query.types, false, (t) => t === item.type)) return false;
  if (query.unit && !unitCanUse(item, query.unit)) return false;
  if (query.onlyOwned && !query.onlyOwned[item.id]) return false;
  return true;
}

/** The exclusive unit, roles and sex of an item must fit the unit (an item without them fits every unit). */
function unitCanUse(item: Item, unit: NonNullable<ItemQuery['unit']>): boolean {
  if (item['exclusiveUnits'] && !item['exclusiveUnits'].includes(unit.id)) return false;
  if (item['exclusiveRoles'] && !item['exclusiveRoles'].some((role: string) => unit.roles?.includes(role)))
    return false;
  return !item['exclusiveSex'] || item['exclusiveSex'] === unit.sex;
}

/** The value a page sorts by: the stat of the item, with the % part computed on the unit's base stat. */
export function calculateValue(
  item: Item,
  stat: string,
  options: {
    baseStat?: number;
    percentageStat?: boolean;
    staticStats?: boolean;
    ailments?: readonly string[];
    elements?: readonly string[];
    killers?: readonly string[];
  } = {},
): number {
  const {
    baseStat = 0,
    percentageStat = false,
    staticStats = false,
    ailments = [],
    elements = [],
    killers = [],
  } = options;
  let value = 0;
  if (item[stat] && stat !== 'evade') value = item[stat];
  if (percentageStat && item[stat + '%']) value += baseStat * (item[stat + '%'] / 100);
  if (staticStats && item['staticStats']?.[stat]) value += item['staticStats'][stat];
  if (item[stat] && stat === 'evade') {
    if (item['evade'].physical) value = item['evade'].physical;
    if (item['evade'].magical && item['evade'].magical > value) value = item['evade'].magical;
  }
  if (stat === 'inflict' && (item['ailments'] || item['killers'])) {
    let max = 0;
    for (const ailment of item['ailments'] ?? []) {
      if ((ailments.length === 0 || ailments.includes(ailment.name)) && ailment.percent > max) max = ailment.percent;
    }
    for (const killer of item['killers'] ?? []) {
      if (killers.length === 0 || killers.includes(killer.name))
        max = Math.max(max, killer.physical ?? 0, killer.magical ?? 0);
    }
    value = max;
  }
  if (stat === 'resist' && item['resist']) {
    let max = -999;
    const ignoreAilments = elements.length > 0 && ailments.length === 0;
    const ignoreElements = ailments.length > 0 && elements.length === 0;
    for (const res of item['resist']) {
      const ailmentOk =
        !ignoreAilments && ailmentList.includes(res.name) && (ailments.length === 0 || ailments.includes(res.name));
      const elementOk =
        !ignoreElements && elementList.includes(res.name) && (elements.length === 0 || elements.includes(res.name));
      if ((ailmentOk || elementOk) && res.percent > max) max = res.percent;
    }
    value = max === -999 ? 0 : Math.round(max);
  }
  return Math.round(value);
}

/** Filters the items and computes the value to sort by. */
export function filterItems(
  items: readonly Item[],
  query: ItemQuery,
  options: Parameters<typeof calculateValue>[2] = {},
): Item[] {
  const result = items.filter((item) => itemMatches(item, query));
  const stat = query.stat ?? '';
  for (const item of result) {
    item.calculatedValue = calculateValue(item, stat, {
      ...options,
      ailments: query.ailments,
      elements: query.elements,
    });
  }
  return result;
}

/** Sorts by the computed value, then by item type, then by name; the TMR / STMR of the unit come first. */
export function sortItems(items: Item[], unitId?: string): Item[] {
  return items.sort((a, b) => {
    if (unitId) {
      for (const field of ['tmrUnit', 'stmrUnit']) {
        const aMatches = a[field] === unitId;
        const bMatches = b[field] === unitId;
        if (aMatches !== bMatches) return aMatches ? -1 : 1;
      }
    }
    if (b.calculatedValue === a.calculatedValue) {
      const typeA = typeListWithEsper.indexOf(a.type);
      const typeB = typeListWithEsper.indexOf(b.type);
      if (typeA !== typeB) return typeA - typeB;
      if (a.name) return b.name ? a.name.localeCompare(b.name) : -1;
      return b.name ? 1 : 0;
    }
    return Math.round((b.calculatedValue ?? 0) - (a.calculatedValue ?? 0));
  });
}

/** A unit that cannot use an item because of the item's exclusive sex, unit or role. */
export function exclusiveForbidAccess(item: Item, unitId: string, units: Units): boolean {
  const unit = units[unitId];
  if (item['exclusiveSex'] && unit.sex !== item['exclusiveSex']) return true;
  if (item['exclusiveUnits'] && !item['exclusiveUnits'].includes(unitId)) return true;
  return !!item['exclusiveRoles'] && !item['exclusiveRoles'].some((role: string) => unit.roles?.includes(role));
}

/** The name as used in the picture class of an Esper (`img-esper-<name>`). */
export const escapeName = (name: unknown): string => String(name).replace(/[+%&': ().]/g, '_');
