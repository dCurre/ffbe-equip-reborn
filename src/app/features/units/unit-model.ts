import type { SpriteName } from '../../shared/components/icon/icon';
import type { Item } from '../../game/helpers/item';
import { OwnedUnit, OwnedUnits } from '../../shared/services/inventory';
import { STRINGS } from '../../strings/en';

/** A unit of `units.json` (only the fields this page uses). `min_rarity` / `max_rarity` are strings in the data. */
export interface GameUnit {
  id: string;
  name: string;
  min_rarity: string | number;
  max_rarity: string | number;
  unreleased7Star?: boolean;
  /** An NV unit that can be enhanced to NV+ with Azure Pearls (level 130, LB level 50): from the raw `awakening` of the unit. */
  nvPlus?: boolean;
  /** The Japan version of a unit with other abilities (`jp-<id>`): the id of the unit it is a version of. */
  variantOf?: string;
  braveShift?: string;
  braveShifted?: boolean;
  fragmentId?: string;
  wikiEntry?: string;
  equip: string[];
  /** Added from `releasedUnits.json`: how the unit is obtained (`event` = time limited). */
  summon_type?: string;
}

/** The TMR / STMR item of a unit, a line of `data.json`. */
export interface TrustItem extends Item {
  tmrUnit?: string;
  stmrUnit?: string;
}

export const isNV = (unit: GameUnit): boolean => unit.min_rarity === 'NV';
export const isNVA = (unit: GameUnit): boolean => unit.max_rarity === 'NV' && unit.min_rarity !== 'NV';

/** The max rarity shown: a 7* that is not released yet counts as a 6*. */
export const shownMaxRarity = (unit: GameUnit): string | number => (unit.unreleased7Star ? 6 : unit.max_rarity);

/** The crystal of a unit by its base rarity. */
export const baseCrystal = (unit: GameUnit): SpriteName | null =>
  ({ 3: 'crystal-blueCrystal', 4: 'crystal-goldCrystal', 5: 'crystal-rainbowCrystal' } as const)[
    Number(unit.min_rarity) as 3 | 4 | 5
  ] ?? null;

/** A rarity to draw: an NV / NVA crystal picture, then text (the stars). */
export interface RarityParts {
  icon: SpriteName | null;
  text: string;
}

export function rarityParts(min: string | number, max: string | number): RarityParts {
  if (min === 'NV') return { icon: 'crystal-NV', text: '' };
  if (max === 'NV') return { icon: 'crystal-NVA', text: ' ' + '★'.repeat(Number(min)) }; // the base, as the stars of the other rarities
  return { icon: null, text: rarityLabel(min, max) };
}

export function rarityLabel(min: string | number, max: string | number): string {
  if (min === 'NV') return 'NV';
  if (max === 'NV') return 'NVA';
  return '★'.repeat(Number(min)) + '☆'.repeat(Math.max(0, Number(max) - Number(min)));
}

/** The picture of a unit: its highest form (a 7* that is not owned as 7* shows the 6* picture). */
export function unitImage(unit: GameUnit, owned: OwnedUnit | undefined): string {
  let image = `img/units/unit_icon_${unit.id.substring(0, 7)}`;
  image += unit.max_rarity === 'NV' && unit.min_rarity !== 'NV' ? '1' : unit.id.substring(7, 8);
  if (unit.max_rarity === 'NV') image += '7';
  else image += String(unit.max_rarity) === '7' && owned && !owned.sevenStar ? '6' : unit.max_rarity;
  return `${image}.png`;
}

const rarityValue = (unit: GameUnit): number => {
  const max = unit.max_rarity === 'NV' ? 8 : Number(unit.max_rarity);
  return max === 7 && unit.unreleased7Star ? 6 : max;
};

export function sortByRarity(units: readonly GameUnit[]): GameUnit[] {
  return [...units].sort((a, b) => {
    const maxA = rarityValue(a);
    const maxB = rarityValue(b);
    if (maxA !== maxB) return maxB - maxA;
    if (a.min_rarity === b.min_rarity) return a.name.localeCompare(b.name);
    return (b.min_rarity === 'NV' ? 8 : Number(b.min_rarity)) - (a.min_rarity === 'NV' ? 8 : Number(a.min_rarity));
  });
}

/** The letter a name is filed under (accents ignored); every other first character goes under "#". */
export function initialOf(name: string): string {
  const letter = name.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase();
  return /^[A-Z]$/.test(letter) ? letter : '#';
}

export const sortAlphabetically = (units: readonly GameUnit[]): GameUnit[] =>
  [...units].sort((a, b) => a.name.localeCompare(b.name));

/** Units that have a TMR, by the name of the TMR. */
export const sortByTrustName = (units: readonly GameUnit[], tmrs: Readonly<Record<string, TrustItem>>): GameUnit[] =>
  [...units].sort((a, b) => tmrs[a.id].name.localeCompare(tmrs[b.id].name));

/** Every word of the search must be in the name of the unit, or be one of its equipments. */
export function filterByName(units: readonly GameUnit[], text: string): GameUnit[] {
  const words = text.toLowerCase().split(' ');
  return units.filter((unit) =>
    words.every((word) => unit.name.toLowerCase().includes(word) || unit.equip.includes(word)),
  );
}

export function filterByTrustName(
  units: readonly GameUnit[],
  tmrs: Readonly<Record<string, TrustItem>>,
  text: string,
): GameUnit[] {
  const search = text.toLowerCase();
  return units.filter((unit) => tmrs[unit.id] && (!search || tmrs[unit.id].name.toLowerCase().includes(search)));
}

// --- Collection statistics ---

/** The rows of the statistics: the NV / NVA are counted by their NV copies, the others by the copies of that base rarity. */
export type RarityKey = 'NV' | 'NVA' | '7' | '5' | '4' | '3';
export interface StatLine {
  /** units owned (different ones) */
  different: number;
  total: number;
  /** copies owned */
  number: number;
}
export type StatGroup = Record<RarityKey, StatLine>;
export interface CollectionStats {
  all: StatGroup;
  timeLimited: StatGroup;
  notLimited: StatGroup;
}

const emptyGroup = (): StatGroup => ({
  NV: { different: 0, total: 0, number: 0 },
  NVA: { different: 0, total: 0, number: 0 },
  '7': { different: 0, total: 0, number: 0 },
  '5': { different: 0, total: 0, number: 0 },
  '4': { different: 0, total: 0, number: 0 },
  '3': { different: 0, total: 0, number: 0 },
});

export function collectionStats(units: readonly GameUnit[], owned: OwnedUnits): CollectionStats {
  const all = emptyGroup();
  const timeLimited = emptyGroup();
  const add = (group: StatGroup, unit: GameUnit, mine: OwnedUnit | undefined, sevenStar: boolean): void => {
    const base = group[String(unit.min_rarity) as RarityKey];
    base.total++;
    if (sevenStar) group['7'].total++;
    if (!mine) return;
    base.number += mine.number;
    base.different++;
    if (sevenStar && mine.sevenStar) {
      group['7'].number += mine.sevenStar;
      group['7'].different++;
    }
  };
  /** An NV unit, or the NVA form of a unit: it counts when the unit has NV copies. */
  const addNv = (group: StatGroup, key: 'NV' | 'NVA', mine: OwnedUnit | undefined): void => {
    group[key].total++;
    if (!mine?.nv) return;
    group[key].different++;
    group[key].number += mine.nv;
  };
  for (const unit of units) {
    const mine = owned[unit.id];
    const groups = unit.summon_type === 'event' ? [all, timeLimited] : [all];
    if (isNV(unit)) {
      for (const group of groups) addNv(group, 'NV', mine);
      continue;
    }
    if (!['3', '4', '5'].includes(String(unit.min_rarity))) continue;
    const sevenStar = String(shownMaxRarity(unit)) === '7';
    for (const group of groups) {
      add(group, unit, mine, sevenStar);
      if (isNVA(unit)) addNv(group, 'NVA', mine);
    }
  }
  const notLimited = emptyGroup();
  for (const key of Object.keys(all) as RarityKey[]) {
    notLimited[key] = {
      different: all[key].different - timeLimited[key].different,
      total: all[key].total - timeLimited[key].total,
      number: all[key].number - timeLimited[key].number,
    };
  }
  return { all, timeLimited, notLimited };
}

// --- Edits of the owned units (each one changes `owned` in place and returns nothing) ---

/** One more copy of a unit: the TMR (and the NV STMR) of the extra copy can still be farmed unless already farmed. */
export function addOne(
  owned: OwnedUnits,
  unit: GameUnit,
  farmedTmr: Readonly<Record<string, number>>,
  farmedStmr: Readonly<Record<string, number>>,
): void {
  const showStmr = String(unit.max_rarity) === '7' || unit.max_rarity === 'NV';
  const nv = unit.min_rarity === 'NV';
  owned[unit.id] ??= showStmr
    ? { number: 0, farmable: 0, farmableStmr: 0, ...(nv ? { nv: 0 } : {}) }
    : { number: 0, farmable: 0 };
  const mine = owned[unit.id];
  // the copies of an NV unit live in `nv` only (like in an import); `number` stays 0
  if (nv) mine.nv = (mine.nv ?? 0) + 1;
  else mine.number += 1;
  const count = (nv ? mine.nv! : mine.number) + (mine.sevenStar ?? 0) * 2;
  if (!farmedTmr[unit.id] || farmedTmr[unit.id] < count) mine.farmable += 1;
  if (nv && (!farmedStmr[unit.id] || farmedStmr[unit.id] < count)) mine.farmableStmr = (mine.farmableStmr ?? 0) + 1;
}

/** A copy can be removed when there is a base copy, or an NV copy of an NV unit (an import stores those in `nv` only). */
export const canRemove = (unit: GameUnit, mine: OwnedUnit | undefined): boolean =>
  !!mine && (unit.min_rarity === 'NV' ? (mine.nv ?? 0) : mine.number) >= 1;

/**
 * One copy less (the reverse of `addOne`): the TMR / STMR still to farm cannot be more than the copies left minus the ones
 * already farmed. The unit leaves the collection when nothing is left.
 */
export function removeOne(
  owned: OwnedUnits,
  unit: GameUnit,
  farmedTmr: Readonly<Record<string, number>>,
  farmedStmr: Readonly<Record<string, number>>,
): void {
  const mine = owned[unit.id];
  if (!mine || !canRemove(unit, mine)) return;
  const nv = unit.min_rarity === 'NV';
  if (nv) {
    mine.nv! -= 1;
    mine.number = 0; // an NV unit never keeps base copies
  } else mine.number -= 1;
  const count = (nv ? mine.nv! : mine.number) + (mine.sevenStar ?? 0) * 2;
  mine.farmable = Math.min(mine.farmable, Math.max(0, count - (farmedTmr[unit.id] ?? 0)));
  if (nv) mine.farmableStmr = Math.min(mine.farmableStmr ?? 0, Math.max(0, count - (farmedStmr[unit.id] ?? 0)));
  if (!mine.number && !mine.farmable && !mine.tmrMoogles && !mine.sevenStar && !mine.farmableStmr && !mine.nv) {
    delete owned[unit.id];
  }
}

/** How a 7* unit can be awakened: with two copies, or with one copy and a prism. */
export function awaken(mine: OwnedUnit, copiesUsed: 1 | 2): void {
  mine.number -= copiesUsed;
  mine.sevenStar = (mine.sevenStar ?? 0) + 1;
  mine.farmableStmr = (mine.farmableStmr ?? 0) + 1;
}

/** The ways an STMR can have been farmed; each one says what it used up. */
export type StmrSource = 'sevenStar' | 'twoLower' | 'oneLowerAndMoogle' | 'moogles';

export function farmedStmrSources(mine: OwnedUnit): { source: StmrSource; text: string }[] {
  const sources: { source: StmrSource; text: string }[] = [];
  if ((mine.sevenStar ?? 0) >= 2) sources.push({ source: 'sevenStar', text: STRINGS.unitModel.fusedA7 });
  if (mine.number >= 2) sources.push({ source: 'twoLower', text: STRINGS.unitModel.fusedTwo56 });
  if (mine.number >= 1) {
    sources.push({ source: 'oneLowerAndMoogle', text: STRINGS.unitModel.fusedOne56 });
  }
  sources.push({ source: 'moogles', text: STRINGS.unitModel.fusedSuperTrustMoogles });
  return sources;
}

export function useStmrSource(mine: OwnedUnit, source: StmrSource): void {
  const farmableStmr = mine.farmableStmr ?? 0;
  if (source === 'sevenStar') {
    mine.farmableStmr = farmableStmr - 2;
    mine.sevenStar = (mine.sevenStar ?? 0) - 1;
  } else if (source === 'twoLower') {
    mine.farmableStmr = farmableStmr - 1;
    mine.number -= 2;
  } else if (source === 'oneLowerAndMoogle') {
    mine.farmableStmr = farmableStmr - 1;
    mine.number -= 1;
  } else {
    mine.farmableStmr = farmableStmr - 1;
  }
}

/** What the edit dialog holds; empty, invalid or negative numbers count as 0. */
export interface UnitEdit {
  number: number;
  sevenStar: number;
  nv: number;
  exRank: string;
  fragments: number;
  tmrMoogles: string;
}

export const num = (value: string | number): number => {
  const parsed = typeof value === 'number' ? value : parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
};

/** The values of "TMR Moogles owned" (`50, 100`): null if one of them is not a number. */
export function parseMoogles(text: string): number[] | null {
  const result: number[] = [];
  for (const part of text.split(',')) {
    const value = part.trim();
    if (!text.trim()) return [];
    if (!value || Number.isNaN(Number(value))) return null;
    result.push(Number(value));
  }
  return result;
}

/** The most TMR / STMR a unit can have: one per copy (two per 7* copy) for the TMR, one per awakened copy for the STMR. */
export function maxTrust(unit: GameUnit, mine: Pick<UnitEdit, 'number' | 'sevenStar' | 'nv'>): { tmr: number; stmr: number } {
  const copies = unit.min_rarity === 'NV' ? mine.nv : mine.number;
  return { tmr: Math.max(0, copies + mine.sevenStar * 2), stmr: Math.max(0, mine.sevenStar + mine.nv) };
}

/**
 * Applies the edit dialog to the unit; the unit is removed from `owned` when nothing is left. The TMR / STMR still to farm are
 * not edited: they are the copies owned minus the ones already farmed (`farmed`, from the inventory).
 */
export function applyEdit(
  owned: OwnedUnits,
  unit: GameUnit,
  edit: UnitEdit,
  moogles: number[],
  farmed: { tmr: number; stmr: number } = { tmr: 0, stmr: 0 },
): void {
  const mine = (owned[unit.id] ??= { number: 0, farmable: 0, sevenStar: 0, farmableStmr: 0 });
  const max = String(unit.max_rarity);
  mine.number = unit.min_rarity === 'NV' ? 0 : edit.number; // an NV unit has its copies in `nv` only
  if (max === 'NV') {
    mine.nv = edit.nv;
    const exRank = edit.exRank.trim();
    mine.exRank = exRank ? Math.max(0, Math.min(3, num(exRank))) : undefined;
  }
  if (max === '7' || (max === 'NV' && unit.min_rarity !== 'NV')) mine.sevenStar = edit.sevenStar;
  const nvUnit = unit.min_rarity === 'NV';
  mine.farmable = Math.max(0, (nvUnit ? (mine.nv ?? 0) : mine.number) + (mine.sevenStar ?? 0) * 2 - farmed.tmr);
  // shortcut: the STMR of a 7* is counted per awakened copy, not per fusion that used copies up; fine until fusions are tracked
  if (max === '7' || max === 'NV') mine.farmableStmr = Math.max(0, (mine.sevenStar ?? 0) + (mine.nv ?? 0) - farmed.stmr);
  if (moogles.length > 0) mine.tmrMoogles = moogles;
  else delete mine.tmrMoogles;
  if (!mine.number && !mine.farmable && !mine.tmrMoogles && !mine.sevenStar && !mine.farmableStmr && !mine.nv) {
    delete owned[unit.id];
  }
}
