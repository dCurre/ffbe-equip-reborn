import { OwnedUnit, OwnedUnits } from '../../shared/services/inventory';

/** A unit of `units.json` (only the fields this page uses). `min_rarity` / `max_rarity` are strings in the data. */
export interface GameUnit {
  id: string;
  name: string;
  min_rarity: string | number;
  max_rarity: string | number;
  unreleased7Star?: boolean;
  braveShift?: string;
  braveShifted?: boolean;
  fragmentId?: string;
  wikiEntry?: string;
  equip: string[];
  /** Added from `releasedUnits.json`: how the unit is obtained (`event` = time limited). */
  summon_type?: string;
}

/** The TMR / STMR item of a unit, a line of `data.json`. */
export interface TrustItem {
  id: string;
  name: string;
  tmrUnit?: string;
  stmrUnit?: string;
}

/** Ids of the units of the released list: a unit whose Brave Shift is not released yet is "soon" an NVA. */
export type ReleasedIds = ReadonlySet<string>;

export const isNV = (unit: GameUnit): boolean => unit.min_rarity === 'NV';
export const isNVA = (unit: GameUnit): boolean => unit.max_rarity === 'NV' && unit.min_rarity !== 'NV';

export const isSoonNVA = (unit: GameUnit, released: ReleasedIds): boolean =>
  isNVA(unit) && (!unit.braveShift || !released.has(unit.braveShift));

/** The max rarity shown: a 7* that is not released yet counts as a 6*. */
export const shownMaxRarity = (unit: GameUnit): string | number => (unit.unreleased7Star ? 6 : unit.max_rarity);

/** A rarity to draw: an NV / NVA crystal picture, then text (the stars, or "(soon)"). */
export interface RarityParts {
  icon: 'NV' | 'NVA' | null;
  text: string;
}

export function rarityParts(min: string | number, max: string | number, soon = false): RarityParts {
  if (min === 'NV') return { icon: 'NV', text: '' };
  if (max === 'NV') return { icon: 'NVA', text: soon ? ' (soon)' : '' };
  return { icon: null, text: rarityLabel(min, max, soon) };
}

export function rarityLabel(min: string | number, max: string | number, soon = false): string {
  if (min === 'NV') return 'NV';
  if (max === 'NV') return soon ? 'NVA (soon)' : 'NVA';
  return '★'.repeat(Number(min)) + '☆'.repeat(Math.max(0, Number(max) - Number(min))) + (soon ? ' (soon)' : '');
}

/** The picture of a unit: its highest form (a 7* that is not owned as 7* shows the 6* picture). */
export function unitImage(unit: GameUnit, owned: OwnedUnit | undefined): string {
  let image = `img/units/unit_icon_${unit.id.substring(0, 7)}`;
  image += unit.max_rarity === 'NV' && unit.min_rarity !== 'NV' ? '1' : unit.id.substring(7, 8);
  if (unit.max_rarity === 'NV') image += '7';
  else image += String(unit.max_rarity) === '7' && owned && !owned.sevenStar ? '6' : unit.max_rarity;
  return `${image}.png`;
}

const rarityValue = (unit: GameUnit, released: ReleasedIds): number => {
  let max = unit.max_rarity === 'NV' ? 8 : Number(unit.max_rarity);
  if (max === 8 && isSoonNVA(unit, released)) max = 7.5;
  if (max === 7 && unit.unreleased7Star) max = 6;
  return max;
};

export function sortByRarity(units: readonly GameUnit[], released: ReleasedIds): GameUnit[] {
  return [...units].sort((a, b) => {
    const maxA = rarityValue(a, released);
    const maxB = rarityValue(b, released);
    if (maxA !== maxB) return maxB - maxA;
    if (a.min_rarity === b.min_rarity) return a.name.localeCompare(b.name);
    return (b.min_rarity === 'NV' ? 8 : Number(b.min_rarity)) - (a.min_rarity === 'NV' ? 8 : Number(a.min_rarity));
  });
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

export type RarityKey = '7' | '5' | '4' | '3';
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
  for (const unit of units) {
    // the old page counted the NV units too, but had no row to show them
    if (!['3', '4', '5'].includes(String(unit.min_rarity))) continue;
    const sevenStar = String(shownMaxRarity(unit)) === '7';
    add(all, unit, owned[unit.id], sevenStar);
    if (unit.summon_type === 'event') add(timeLimited, unit, owned[unit.id], sevenStar);
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
  mine.number += 1;
  const count = mine.number + (mine.sevenStar ?? 0) * 2;
  if (!farmedTmr[unit.id] || farmedTmr[unit.id] < count) mine.farmable += 1;
  if (nv && (!farmedStmr[unit.id] || farmedStmr[unit.id] < count)) {
    mine.nv = (mine.nv ?? 0) + 1;
    mine.farmableStmr = (mine.farmableStmr ?? 0) + 1;
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
  if ((mine.sevenStar ?? 0) >= 2) sources.push({ source: 'sevenStar', text: 'Fused a 7*' });
  if (mine.number >= 2) sources.push({ source: 'twoLower', text: 'Fused two 5/6*' });
  if (mine.number >= 1) {
    sources.push({ source: 'oneLowerAndMoogle', text: 'Fused one 5/6* and a Super Trust Moogle' });
  }
  sources.push({ source: 'moogles', text: 'Fused Super Trust Moogles' });
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

/** What the edit dialog holds; empty or invalid numbers count as 0. */
export interface UnitEdit {
  number: number;
  farmable: number;
  sevenStar: number;
  farmableStmr: number;
  nv: number;
  exRank: string;
  fragments: number;
  tmrMoogles: string;
}

export const num = (value: string | number): number => {
  const parsed = typeof value === 'number' ? value : parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
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

/** Applies the edit dialog to the unit; the unit is removed from `owned` when nothing is left. */
export function applyEdit(owned: OwnedUnits, unit: GameUnit, edit: UnitEdit, moogles: number[]): void {
  const mine = (owned[unit.id] ??= { number: 0, farmable: 0, sevenStar: 0, farmableStmr: 0 });
  const max = String(unit.max_rarity);
  mine.number = edit.number;
  mine.farmable = edit.farmable;
  if (max === 'NV') {
    mine.nv = edit.nv;
    const exRank = edit.exRank.trim();
    mine.exRank = exRank ? Math.max(0, Math.min(3, num(exRank))) : undefined;
  }
  if (max === '7' || (max === 'NV' && unit.min_rarity !== 'NV')) mine.sevenStar = edit.sevenStar;
  if (max === '7' || max === 'NV') mine.farmableStmr = edit.farmableStmr;
  if (moogles.length > 0) mine.tmrMoogles = moogles;
  else delete mine.tmrMoogles;
  if (!mine.number && !mine.farmable && !mine.tmrMoogles && !mine.sevenStar && !mine.farmableStmr && !mine.nv) {
    delete owned[unit.id];
  }
}
