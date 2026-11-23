import { containsText, searchTokens } from '../../game/helpers/item';

/* eslint-disable @typescript-eslint/no-explicit-any -- the skill data of the units has no fixed shape */

/** The kinds of skill a filter looks into, and where the skill acts. */
export type SkillType = 'actives' | 'passives' | 'lb' | 'counter';
export type TargetArea = 'SELF' | 'ST' | 'AOE';

/** One filter: the values asked for, in which skills and for which targets, and the least value (a threshold). */
export interface Criteria {
  values: string[];
  skillTypes: string[];
  targetAreaTypes: string[];
  threshold: number | null;
}

export type CriteriaKey =
  | 'elements'
  | 'buffs'
  | 'ailments'
  | 'physicalKillers'
  | 'magicalKillers'
  | 'imperils'
  | 'physicalElementDamageBoosts'
  | 'magicalElementDamageBoosts'
  | 'weaponImperils'
  | 'breaks'
  | 'imbues'
  | 'tankAbilities'
  | 'mitigation'
  | 'racialMitigations';

export type AllCriteria = Record<CriteriaKey, Criteria>;

export interface SkillFilter {
  /** `none`, a chain family, or `chainTag` (a skill that chains by itself) */
  chainFamily: string;
  multicastCount: number;
  excludeUnlockedMulticast: boolean;
  targetAreaTypes: string[];
  skillTypes: string[];
}

export interface UnitSearchState {
  searchText: string;
  baseRarity: string[];
  maxRarity: string[];
  skillFilter: SkillFilter;
  criteria: AllCriteria;
  types: string[];
  series: string[];
  onlyOwned: boolean;
  fullyDisplayedUnits: string[];
}

const ALL_AREAS = ['SELF', 'ST', 'AOE'];

const criteria = (skillTypes: string[], threshold: number | null = null, areas = ALL_AREAS): Criteria => ({
  values: [],
  skillTypes,
  targetAreaTypes: areas,
  threshold,
});

export const defaultSkillFilter = (): SkillFilter => ({
  chainFamily: 'none',
  multicastCount: 1,
  excludeUnlockedMulticast: false,
  targetAreaTypes: ['ST', 'AOE'],
  skillTypes: ['actives', 'lb'],
});

export const defaultCriteria = (): AllCriteria => ({
  imperils: criteria(['actives', 'lb', 'counter'], null),
  breaks: criteria(['actives', 'lb', 'counter']),
  elements: criteria(['actives', 'passives', 'lb', 'counter']),
  buffs: criteria(['actives', 'lb', 'counter']),
  ailments: criteria(['actives', 'passives', 'lb', 'counter']),
  imbues: criteria(['actives', 'lb']),
  physicalKillers: criteria(['actives', 'passives', 'lb']),
  magicalKillers: criteria(['actives', 'passives', 'lb']),
  physicalElementDamageBoosts: criteria(['actives', 'lb', 'counter'], null),
  magicalElementDamageBoosts: criteria(['actives', 'lb', 'counter'], null),
  weaponImperils: criteria(['actives', 'lb', 'counter'], null),
  tankAbilities: criteria(['actives', 'passives', 'lb']),
  mitigation: criteria(['actives', 'passives', 'lb']),
  racialMitigations: criteria(['actives', 'lb']),
});

export const defaultState = (): UnitSearchState => ({
  searchText: '',
  baseRarity: [],
  maxRarity: [],
  skillFilter: defaultSkillFilter(),
  criteria: defaultCriteria(),
  types: [],
  series: [],
  onlyOwned: false,
  fullyDisplayedUnits: [],
});

/** The property of the unit data a filter looks into (none: the data of the skill itself). */
export const UNIT_PROPERTY: Record<CriteriaKey, string | null> = {
  elements: 'elementalResist',
  buffs: 'statsBuff',
  ailments: 'ailmentResist',
  physicalKillers: 'physicalKillers',
  magicalKillers: 'magicalKillers',
  imperils: 'imperil',
  physicalElementDamageBoosts: 'physicalElementDamageBoost',
  magicalElementDamageBoosts: 'magicalElementDamageBoost',
  weaponImperils: 'weaponImperil',
  breaks: 'break',
  imbues: 'imbue',
  tankAbilities: null,
  mitigation: null,
  racialMitigations: null,
};

/** A filter that also accepts a value of 0 (a cover, a mitigation...). */
const ACCEPT_ZERO: CriteriaKey[] = ['mitigation', 'racialMitigations', 'tankAbilities'];

/** The filters in the order they sort the results. */
const SORT_ORDER: CriteriaKey[] = [
  'physicalKillers',
  'magicalKillers',
  'imperils',
  'physicalElementDamageBoosts',
  'magicalElementDamageBoosts',
  'weaponImperils',
  'breaks',
  'elements',
  'buffs',
  'ailments',
  'tankAbilities',
  'mitigation',
  'racialMitigations',
];

/** The order the filters are checked. */
const FILTER_ORDER: CriteriaKey[] = [
  'elements',
  'buffs',
  'ailments',
  'physicalKillers',
  'magicalKillers',
  'mitigation',
  'racialMitigations',
  'imperils',
  'physicalElementDamageBoosts',
  'magicalElementDamageBoosts',
  'weaponImperils',
  'breaks',
  'imbues',
  'tankAbilities',
];

export interface SearchUnit {
  id: string;
  game_id?: number | string;
  minRarity: string;
  maxRarity: string;
  /** An NV unit that can be enhanced to NV+ (`unitSearch.json`). */
  nvPlus?: boolean;
  NVA?: { baseRarity: string };
  equip: string[];
  passives: any;
  actives: any;
  lb: any;
  counter: any;
}

/** A unit with all its skills (`unitsWithSkill.json`). */
export interface SkillUnit {
  id: string;
  name: string;
  braveShifted?: string;
  max_rarity: string;
  actives: any[];
  passives: any[];
  magics: any[];
  lb: any;
  searchString?: string;
  [field: string]: any;
}

export interface Result {
  searchData: SearchUnit;
  unit: SkillUnit;
}

export interface SearchContext {
  searchUnits: readonly SearchUnit[];
  units: Readonly<Record<string, SkillUnit>>;
  released: Readonly<Record<string, unknown>>;
  owned?: Readonly<Record<string, { number?: number; sevenStar?: number; nv?: number }>>;
}

const includeAll = (array1: readonly any[], array2: readonly any[]): boolean => array2.every((v) => array1.includes(v));
const matches = (array1: readonly any[], array2: readonly any[]): boolean => array1.some((v) => array2.includes(v));

/** Does the object have all the keys with a positive value? Racial mitigations are asked by race. */
function containAllKeyPositive(object: any, array: readonly string[], acceptZero = false): boolean {
  if (!object) return false;
  if (object.racialMitigations && object.racialMitigations.race.some((race: string) => array.includes(race)))
    return true;
  for (let index = array.length; index--;) {
    if (!(array[index] in object) || object[array[index]] < 0 || (!acceptZero && object[array[index]] === 0))
      return false;
  }
  return true;
}

/** Do the skills of the unit have what the filter asks for? */
export function matchesCriteria(
  filter: Criteria,
  unit: SearchUnit,
  property: string | null,
  acceptZero = false,
): boolean {
  if (filter.values.length === 0) return true;
  const collected: any[] = [];
  for (let i = filter.skillTypes.length; i--;) {
    const skillType = filter.skillTypes[i];
    if (skillType === 'passives') {
      let passive = unit.passives;
      if (property) passive = passive[property];
      if (containAllKeyPositive(passive, filter.values, acceptZero)) {
        if (!filter.threshold || filter.values.every((value) => passive[value] >= filter.threshold!)) return true;
      }
      continue;
    }
    for (let j = filter.targetAreaTypes.length; j--;) {
      let data = (unit as any)[skillType][filter.targetAreaTypes[j]];
      if (property) data = data[property];
      if (Array.isArray(data)) {
        collected.push(...data);
        if (includeAll(collected, filter.values)) return true;
      } else if (containAllKeyPositive(data, filter.values, acceptZero)) {
        if (!filter.threshold) return true;
        const found: number[] = [];
        if (data.racialMitigations) {
          for (const race of data.racialMitigations.race as string[]) {
            const at = filter.values.indexOf(race);
            if (at !== -1) found.push(data.racialMitigations.mitigation[at]);
          }
        }
        const ok =
          found.length > 0
            ? found.every((v) => v >= filter.threshold!)
            : filter.values.every((v) => data[v] >= filter.threshold!);
        if (ok) return true;
      }
    }
  }
  return false;
}

/** The best value a filter finds for one asked value (used to sort). */
function getValue(unit: SearchUnit, property: string | null, filter: Criteria, index: number): number {
  let result = 0;
  for (let i = filter.skillTypes.length; i--;) {
    const skillType = filter.skillTypes[i];
    if (skillType === 'passives') {
      let passive = unit.passives;
      if (property) passive = passive[property];
      if (passive?.[filter.values[index]]) result = Math.max(result, passive[filter.values[index]]);
      continue;
    }
    for (let j = filter.targetAreaTypes.length; j--;) {
      let skill = (unit as any)[skillType][filter.targetAreaTypes[j]];
      if (property) skill = skill[property];
      if (skill?.racialMitigations) {
        const { race, mitigation } = skill.racialMitigations;
        if (filter.values[index] && race.some((r: string) => filter.values.includes(r))) {
          result = Math.max(result, mitigation[index]);
        }
      }
      if (result === 0 && skill?.[filter.values[index]]) result = Math.max(result, skill[filter.values[index]]);
    }
  }
  return result;
}

export function sortResults(results: Result[], state: UnitSearchState): Result[] {
  return results.sort((a, b) => {
    for (const key of SORT_ORDER) {
      const filter = state.criteria[key];
      if (filter.values.length === 0) continue;
      let value1 = 0;
      let value2 = 0;
      for (let i = filter.values.length; i--;) {
        value1 += getValue(a.searchData, UNIT_PROPERTY[key], filter, i);
        value2 += getValue(b.searchData, UNIT_PROPERTY[key], filter, i);
      }
      if (value1 !== value2) return value1 > value2 ? -1 : 1;
    }
    return a.unit.name.localeCompare(b.unit.name);
  });
}

const isOwning = (owned: SearchContext['owned'], id: string): boolean => {
  const mine = owned?.[id];
  return !!mine && ((mine.number ?? 0) > 0 || (mine.sevenStar ?? 0) > 0 || (mine.nv ?? 0) > 0);
};

/** The user owns the unit, or the unit it was brave shifted from. */
export function isOwnedUnit(unit: SearchUnit, context: SearchContext): boolean {
  if (isOwning(context.owned, unit.id)) return true;
  const shifted = context.units[unit.id]?.braveShifted;
  return !!shifted && isOwning(context.owned, shifted);
}

function matchesSeries(series: readonly string[], unit: SearchUnit): boolean {
  if (series.length === 0) return true;
  const wanted = series.toString().split(',');
  return !!unit.game_id && wanted.includes(unit.game_id.toString());
}

function matchesChain(unit: SearchUnit, filter: SkillFilter): boolean {
  for (let i = filter.skillTypes.length; i--;) {
    for (let j = filter.targetAreaTypes.length; j--;) {
      const chains = (unit as any)[filter.skillTypes[i]][filter.targetAreaTypes[j]].chain;
      if (chains?.includes(filter.chainFamily)) return true;
    }
  }
  return false;
}

/** Multicast: the unit has a skill that multicasts the chaining skills the same number of times. */
function matchesMulticast(unit: SkillUnit, filter: SkillFilter): boolean {
  const actives = unit.actives.concat(unit.passives);
  const chainingActives = unit.actives.filter(
    (skill) => skill.chainFamily === filter.chainFamily || (filter.chainFamily === 'chainTag' && skill.chainTag),
  );
  const chainingMagics = unit.magics.filter((skill) => skill.chainFamily === filter.chainFamily);
  for (const active of actives) {
    if (filter.excludeUnlockedMulticast && active.unlockedBy && !isAutocastedAtStart(unit, active)) continue;
    for (const entry of active.effects) {
      const multicast = entry.effect?.multicast;
      if (!multicast || multicast.time !== filter.multicastCount) continue;
      let skills: any[] = [];
      if (multicast.type.includes('whiteMagic') || multicast.type.includes('blackMagic')) {
        skills = skills.concat(chainingMagics.filter((m) => m.magic === 'black'));
      }
      if (multicast.type.includes('greenMagic'))
        skills = skills.concat(chainingMagics.filter((m) => m.magic === 'green'));
      if (multicast.type.includes('allSkills')) {
        skills = skills.concat(
          chainingActives.filter((s) => !multicast.excludedSkills?.some((x: any) => x.id === s.id)),
        );
      } else if (multicast.type.includes('skills')) {
        skills = skills.concat(chainingActives.filter((s) => multicast.skills.some((x: any) => x.id === s.id)));
      }
      if (skills.length > 0) return true;
    }
  }
  return false;
}

/** The skill is unlocked by a passive that casts a skill at the start of the battle (so it is usable on turn 1). */
function isAutocastedAtStart(unit: SkillUnit, skill: any): boolean {
  return unit.passives.some((passive) =>
    passive.effects.some(
      (e: any) => e.effect?.autoCastedSkill && skill.unlockedBy.includes(e.effect.autoCastedSkill.id),
    ),
  );
}

function matchesSkill(unit: SearchUnit, full: SkillUnit, filter: SkillFilter): boolean {
  return matchesChain(unit, filter) && (filter.multicastCount === 1 || matchesMulticast(full, filter));
}

/** The units that have what the search asks for. */
export function filterUnits(state: UnitSearchState, context: SearchContext): Result[] {
  const result: Result[] = [];
  const text = state.searchText;
  for (const unit of context.searchUnits) {
    if (!context.released[unit.id]) continue;
    if (state.onlyOwned && !isOwnedUnit(unit, context)) continue;
    if (
      state.baseRarity.length &&
      !state.baseRarity.includes(unit.minRarity) &&
      !state.baseRarity.includes(unit.NVA?.baseRarity as string)
    )
      continue;
    // "NV+" picks the NV units that can be enhanced; "NV" still picks all of them
    if (state.maxRarity.length && !state.maxRarity.some((r) => (r === 'NV+' ? unit.nvPlus : r === unit.maxRarity))) continue;
    const full = context.units[unit.id];
    if (state.skillFilter.chainFamily !== 'none' && !matchesSkill(unit, full, state.skillFilter)) continue;
    if (state.types.length && !includeAll(unit.equip, state.types)) continue;
    if (
      !FILTER_ORDER.every((key) =>
        matchesCriteria(state.criteria[key], unit, UNIT_PROPERTY[key], ACCEPT_ZERO.includes(key)),
      )
    )
      continue;
    if (!matchesSeries(state.series, unit)) continue;
    if (text.length > 0 && !containsText(text, full as any)) continue;
    result.push({ searchData: unit, unit: full });
  }
  return result;
}

/** Nothing asked: no result is shown. */
export function hasSearch(state: UnitSearchState): boolean {
  return !!(
    state.searchText.length ||
    state.series.length ||
    state.types.length ||
    state.baseRarity.length ||
    state.maxRarity.length ||
    state.skillFilter.chainFamily !== 'none' ||
    Object.values(state.criteria).some((c) => c.values.length)
  );
}

// --- Which skills of a unit are shown ---

const matchesOneToken = (text: string, skillText: string): boolean =>
  searchTokens(text).some((token) =>
    new RegExp(token.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&').replace('\\*', '\\d+(-\\d+)?'), 'i').test(skillText),
  );

const isTargetShown = (filter: Criteria, effect: any, type: string): boolean =>
  type === 'passives' || filter.targetAreaTypes.includes(effect.effect.area);

/** Does an effect give killers of the asked races, at the asked threshold for the physical or magical kind? */
const matchesKillers = (e: any, f: Criteria, kind: 'physical' | 'magical'): boolean =>
  !!e.effect.killers &&
  matches(
    f.values,
    e.effect.killers.map((k: any) => k.name),
  ) &&
  (!f.threshold ||
    e.effect.killers.every((k: any) => !f.values.includes(k.name) || (k[kind] && k[kind] >= f.threshold!)));

/** Does an effect match the filter of the given key? */
const EFFECT_MATCHERS: Record<CriteriaKey, (effect: any, filter: Criteria) => boolean> = {
  elements: (e, f) =>
    !!e.effect.resist &&
    matches(
      f.values,
      e.effect.resist.map((r: any) => r.name),
    ) &&
    (!f.threshold || e.effect.resist.every((d: any) => !f.values.includes(d.name) || d.percent >= f.threshold!)),
  buffs: (e, f) =>
    !!e.effect.statsBuff &&
    matches(f.values, Object.keys(e.effect.statsBuff)) &&
    (!f.threshold || f.values.every((stat) => e.effect.statsBuff[stat] >= f.threshold!)),
  ailments: (e, f) =>
    !!e.effect.resist &&
    matches(
      f.values,
      e.effect.resist.map((r: any) => r.name),
    ),
  physicalKillers: (e, f) => matchesKillers(e, f, 'physical'),
  magicalKillers: (e, f) => matchesKillers(e, f, 'magical'),
  imperils: (e, f) =>
    !!e.effect.imperil &&
    matches(f.values, Object.keys(e.effect.imperil)) &&
    (!f.threshold || f.values.every((el) => e.effect.imperil[el] >= f.threshold!)),
  physicalElementDamageBoosts: (e, f) =>
    !!e.effect.physicalElementDamageBoost &&
    matches(f.values, Object.keys(e.effect.physicalElementDamageBoost)) &&
    (!f.threshold || f.values.every((el) => e.effect.physicalElementDamageBoost[el] >= f.threshold!)),
  magicalElementDamageBoosts: (e, f) =>
    !!e.effect.magicalElementDamageBoost &&
    matches(f.values, Object.keys(e.effect.magicalElementDamageBoost)) &&
    (!f.threshold || f.values.every((el) => e.effect.magicalElementDamageBoost[el] >= f.threshold!)),
  weaponImperils: (e, f) =>
    !!e.effect.weaponImperil &&
    f.values.includes(e.effect.weaponImperil.weaponType) &&
    (!f.threshold || f.values.every((w) => e.effect.weaponImperil[w] >= f.threshold!)),
  breaks: (e, f) =>
    !!e.effect.break &&
    matches(f.values, Object.keys(e.effect.break)) &&
    (!f.threshold || f.values.every((stat) => e.effect.break[stat] >= f.threshold!)),
  imbues: (e, f) => !!e.effect.imbue && matches(f.values, e.effect.imbue),
  mitigation: (e, f) =>
    matches(f.values, Object.keys(e.effect)) && (!f.threshold || f.values.every((m) => e.effect[m] >= f.threshold!)),
  racialMitigations: (e, f) =>
    !!e.effect.racialMitigations &&
    matches(f.values, e.effect.racialMitigations.race) &&
    (!f.threshold || e.effect.racialMitigations.mitigation.every((v: number) => v >= f.threshold!)),
  tankAbilities: (e, f) =>
    matches(f.values, Object.keys(e.effect)) ||
    (f.values.includes('physicalAoeCover') && e.effect.aoeCover?.type === 'physical') ||
    (f.values.includes('magicalAoeCover') && e.effect.aoeCover?.type === 'magical'),
};

/** The skill itself matches the search: its name, a description, or one of its effects. */
function mustDisplaySkill(state: UnitSearchState, effects: any[], type: string, skillName?: string): boolean {
  if (skillName && matchesOneToken(state.searchText, skillName)) return true;
  for (let j = effects.length; j--;) {
    const entry = effects[j];
    if (entry.desc && matchesOneToken(state.searchText, entry.desc)) return true;
    const effect = entry.effect;
    if (!effect) continue;
    if (state.types.length > 0 && effect.equipedConditions && matches(effect.equipedConditions, state.types))
      return true;
    for (const key of Object.keys(EFFECT_MATCHERS) as CriteriaKey[]) {
      const filter = state.criteria[key];
      if (filter.values.length === 0 || !filter.skillTypes.includes(type) || !isTargetShown(filter, entry, type))
        continue;
      if (EFFECT_MATCHERS[key](entry, filter)) return true;
    }
    for (const random of effect.randomlyUse ?? []) {
      if (mustDisplaySkill(state, random.skill.effects, type)) return true;
    }
    if (effect.cooldownSkill && mustDisplaySkill(state, effect.cooldownSkill.effects, type)) return true;
    if (effect.counterSkill && mustDisplaySkill(state, effect.counterSkill.effects, 'counter')) return true;
    if (effect.autoCastedSkill && mustDisplaySkill(state, effect.autoCastedSkill.effects, type)) return true;
  }
  return false;
}

/** The skill is shown because it chains (or because a multicast skill can cast it). */
function mustDisplayForChain(
  state: UnitSearchState,
  skill: any,
  effects: any[],
  type: string,
  multicast: string[] = [],
): boolean {
  const filter = state.skillFilter;
  const chains =
    filter.chainFamily !== 'none' &&
    (skill.chainFamily === filter.chainFamily || (skill.chainTag && filter.chainFamily === 'chainTag')) &&
    (filter.multicastCount === 1 || multicast.length > 0);
  for (let j = effects.length; j--;) {
    const entry = effects[j];
    if (
      entry.effect?.damage &&
      chains &&
      filter.skillTypes.includes(type) &&
      filter.targetAreaTypes.includes(entry.effect.area)
    ) {
      return true;
    }
    if (
      entry.effect?.cooldownSkill &&
      mustDisplayForChain(state, entry.effect.cooldownSkill, entry.effect.cooldownSkill.effects, type, multicast)
    ) {
      return true;
    }
    for (const random of entry.effect?.randomlyUse ?? []) {
      if (mustDisplayForChain(state, random.skill, random.skill.effects, type, multicast)) return true;
    }
  }
  return false;
}

/** The ids of the skills of a unit to show (`lb` for the limit burst): the ones that match the search. */
export function skillsToDisplay(unit: SkillUnit, state: UnitSearchState): string[] {
  if (state.fullyDisplayedUnits.includes(unit.id)) {
    return [...unit.passives, ...unit.actives, ...unit.magics].map((s) => s.id).concat('lb');
  }
  const filter = state.skillFilter;
  const result: string[] = [];
  const multicastSkills: Record<string, string[]> = {};
  const multicastMagic: Record<string, string[]> = {};
  if (filter.multicastCount > 1) {
    for (const skill of unit.actives.concat(unit.passives)) {
      if (filter.excludeUnlockedMulticast && skill.unlockedBy && !isAutocastedAtStart(unit, skill)) continue;
      for (const entry of skill.effects) {
        const multicast = entry.effect?.multicast;
        if (!multicast || multicast.time !== filter.multicastCount) continue;
        multicastSkills[skill.id] = unit.actives
          .filter((s) => {
            if (multicast.excludedSkills?.some((x: any) => x.id === s.id)) return false;
            return multicast.type.includes('allSkills') || !!multicast.skills?.some((x: any) => s.id === x.id);
          })
          .map((s) => s.id);
        multicastMagic[skill.id] = ['white', 'green', 'black'].filter((color) =>
          multicast.type.includes(`${color}Magic`),
        );
      }
    }
  }
  const chained: string[] = [];
  if (
    mustDisplayForChain(state, unit.lb, unit.lb.maxEffects, 'lb') ||
    mustDisplaySkill(state, unit.lb.maxEffects, 'lb', unit.lb.name)
  ) {
    result.push('lb');
  }
  for (const passive of unit.passives)
    if (mustDisplaySkill(state, passive.effects, 'passives', passive.name)) result.push(passive.id);
  for (const active of unit.actives) {
    const multicast = Object.keys(multicastSkills).filter((id) => multicastSkills[id].includes(active.id));
    if (mustDisplayForChain(state, active, active.effects, 'actives', multicast)) {
      chained.push(active.id);
      result.push(active.id);
    } else if (mustDisplaySkill(state, active.effects, 'actives', active.name)) result.push(active.id);
  }
  for (const magic of unit.magics) {
    const multicast = Object.keys(multicastMagic).filter((id) => multicastMagic[id].includes(magic.magic));
    if (mustDisplayForChain(state, magic, magic.effects, 'actives', multicast)) {
      if (!chained.includes(magic.magic)) chained.push(magic.magic);
      result.push(magic.id);
    } else if (mustDisplaySkill(state, magic.effects, 'actives', magic.name)) result.push(magic.id);
  }
  if (filter.multicastCount > 1) {
    for (const id of chained) {
      for (const skillId of Object.keys(multicastSkills)) {
        if (multicastSkills[skillId].includes(id) && !result.includes(skillId)) result.push(skillId);
      }
      for (const skillId of Object.keys(multicastMagic)) {
        if (multicastMagic[skillId].includes(id) && !result.includes(skillId)) result.push(skillId);
      }
    }
  }
  return result;
}

// --- The text the search box looks into ---

function skillSearchText(skill: any): string {
  let text = skill.name.toLowerCase();
  for (const entry of skill.effects) {
    if (entry.desc != null) text += `|${entry.desc.toLowerCase()}`;
    const effect = entry.effect;
    if (effect?.cooldownSkill) {
      text += `|Available turn ${effect.startTurn} (${effect.cooldownTurns} turns cooldown)|${skillSearchText(effect.cooldownSkill)}`;
    }
    if (effect?.counterSkill) {
      text += `|${effect.percent}% chance to counter ${effect.counterType} attacks with :|${skillSearchText(effect.counterSkill)}`;
    }
    if (effect?.autoCastedSkill) {
      text += `|Cast at the start of battle or when revived :|${skillSearchText(effect.autoCastedSkill)}`;
    }
  }
  return text;
}

/** Sets the `searchString` of the units: their name and everything their skills say. */
export function prepareUnitSearch(units: Record<string, SkillUnit>): void {
  for (const unit of Object.values(units)) {
    let text = unit.name.toLowerCase();
    for (const skill of [...unit.magics, ...unit.actives, ...unit.passives]) text += `|${skillSearchText(skill)}`;
    text += `|${unit.lb.name.toLowerCase()}`;
    for (const effect of unit.lb.maxEffects) if (effect.desc != null) text += `|${effect.desc.toLowerCase()}`;
    unit.searchString = text;
  }
}

// --- The filters in the URL ---

/** The filters as they are saved in the `#...` of the URL (the same as the old site). */
export function stateToHash(state: UnitSearchState): string {
  const saved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state.criteria)) if (value.values.length > 0) saved[key] = value;
  if (state.series.length) saved['series'] = { values: state.series };
  if (state.searchText.length) saved['searchText'] = state.searchText;
  if (state.types.length) saved['equipmentTypes'] = state.types;
  if (state.baseRarity.length) saved['baseRarity'] = state.baseRarity;
  if (state.maxRarity.length) saved['maxRarity'] = state.maxRarity;
  if (state.skillFilter.chainFamily !== 'none') saved['skillFilter'] = state.skillFilter;
  saved['fullyDisplayedUnits'] = state.fullyDisplayedUnits;
  return window.btoa(JSON.stringify(saved));
}

export function stateFromHash(hash: string): UnitSearchState {
  const state = defaultState();
  let saved: any;
  try {
    saved = JSON.parse(window.atob(hash));
  } catch {
    return state;
  }
  if (saved.searchText) state.searchText = saved.searchText;
  if (saved.skillFilter) state.skillFilter = { ...state.skillFilter, ...saved.skillFilter };
  if (saved.baseRarity) state.baseRarity = saved.baseRarity.map(String);
  if (saved.maxRarity) state.maxRarity = saved.maxRarity.map(String);
  if (saved.equipmentTypes) state.types = saved.equipmentTypes;
  if (saved.fullyDisplayedUnits) state.fullyDisplayedUnits = saved.fullyDisplayedUnits;
  if (saved.series?.values) state.series = saved.series.values;
  for (const key of Object.keys(state.criteria) as CriteriaKey[]) {
    if (saved[key]) state.criteria[key] = { ...state.criteria[key], ...saved[key] };
  }
  return state;
}
