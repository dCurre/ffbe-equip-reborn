import { OwnedUnits } from '../../shared/services/inventory';
import { GameUnit, TrustItem } from './unit-model';

/** A unit of the file exported from the game (see the "FFBE sync" instructions). */
export interface ImportedUnit {
  id: string;
  level: number;
  tmr: number;
  stmr?: number;
  tmrId?: string;
  exRank?: number;
}

const STATS = ['hp', 'mp', 'atk', 'def', 'mag', 'spr'];

const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && value >= min && value <= max;

const isStatBlock = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  STATS.every((stat) => inRange((value as Record<string, unknown>)[stat], 0, 2000));

const isImportedUnit = (unit: Record<string, unknown>): boolean =>
  typeof unit?.['id'] === 'string' &&
  unit['id'].length >= 9 &&
  unit['id'].length <= 10 &&
  inRange(unit['level'], 0, 130) &&
  inRange(unit['tmr'], 0, 1000) &&
  (unit['stmr'] === undefined || inRange(unit['stmr'], 0, 1000)) &&
  (unit['tmrId'] === undefined ||
    (typeof unit['tmrId'] === 'string' && unit['tmrId'].length >= 1 && unit['tmrId'].length <= 10)) &&
  (unit['pots'] === undefined || isStatBlock(unit['pots'])) &&
  (unit['doors'] === undefined || isStatBlock(unit['doors'])) &&
  (unit['enhancements'] === undefined ||
    (Array.isArray(unit['enhancements']) &&
      unit['enhancements'].length <= 30 &&
      unit['enhancements'].every((e) => typeof e === 'string' && e.length >= 5 && e.length <= 10)));

export const isUnitFile = (data: unknown): data is ImportedUnit[] =>
  Array.isArray(data) && data.length <= 9999 && data.every(isImportedUnit);

export const isConsumablesFile = (data: unknown): data is { itemId: string; itemQty: string }[] =>
  Array.isArray(data) &&
  data.length <= 9999 &&
  data.every(
    (c) =>
      typeof c?.itemId === 'string' &&
      c.itemId.length >= 9 &&
      c.itemId.length <= 10 &&
      typeof c.itemQty === 'string' &&
      c.itemQty.length >= 1 &&
      c.itemQty.length <= 10,
  );

export const consumablesFromFile = (file: { itemId: string; itemQty: string }[]): Record<string, number> =>
  Object.fromEntries(file.map((c) => [c.itemId, parseInt(c.itemQty, 10)]));

const TMR_MOOGLE = '904000103';
const PRISM = '904000115';

/** What the importer knows about the game data, to turn the game ids into the ids of this site. */
export interface ImportContext {
  server: 'GL' | 'JP';
  releasedUnits: readonly GameUnit[];
  /** every unit by id (to read the rarity of the one imported) */
  units: Readonly<Record<string, GameUnit>>;
  items: readonly Pick<TrustItem, 'id' | 'tmrUnit'>[];
}

export interface ImportResult {
  owned: OwnedUnits;
  /** problems to tell the user: a unit the game exports but the data does not know yet */
  messages: string[];
}

/** The unit collection of the file replaces the one of the user: the ids of the game are each rarity of a unit. */
export function importUnits(
  file: ImportedUnit[],
  { server, releasedUnits, units, items }: ImportContext,
): ImportResult {
  const baseBySpecificId: Record<string, string> = {};
  for (const unit of releasedUnits) {
    const idBase = unit.id.substring(0, unit.id.length - 1);
    const min = unit.min_rarity === 'NV' ? 7 : Number(unit.min_rarity);
    const max = unit.max_rarity === 'NV' ? 7 : Number(unit.max_rarity);
    for (let rarity = min; rarity <= max; rarity++) baseBySpecificId[idBase + rarity] = unit.id;
  }
  const baseByTmrId: Record<string, string> = {};
  for (const item of items) if (item.tmrUnit) baseByTmrId[item.id] = item.tmrUnit;

  const owned: OwnedUnits = {};
  const messages: string[] = [];
  const entry = (id: string) => (owned[id] ??= { number: 0, farmable: 0, sevenStar: 0, farmableStmr: 0 });

  for (const unit of file) {
    if (unit.id === PRISM && unit.tmr < 1000) {
      const base = unit.tmrId && baseByTmrId[unit.tmrId];
      if (base) entry(base).farmable++;
    } else if (unit.id === TMR_MOOGLE) {
      const base = unit.tmrId && baseByTmrId[unit.tmrId];
      if (base) (entry(base).tmrMoogles ??= []).push(unit.tmr / 10);
    } else if (!unit.id.startsWith('9')) {
      let base = baseBySpecificId[unit.id];
      let nva = false;
      if (!base) {
        if (unit.id.endsWith('17')) {
          base = baseBySpecificId[unit.id.substring(0, unit.id.length - 2) + '07'];
          nva = true;
        }
        if (server === 'GL' && unit.id === '100000327') {
          base = '100000315'; // the GL Dark Fina NVA does not follow the id standard
          nva = true;
        }
      }
      if (!base) {
        messages.push(
          `unknown unit id : ${unit.id}. FFBE Equip Reborn data probably was not updated yet. Ignoring this unit.`,
        );
        continue;
      }
      const mine = entry(base);
      mine.exRank ??= 0;
      if (unit.tmr < 1000) mine.farmable++;
      if (nva || units[base]?.min_rarity === 'NV') {
        mine.nv = (mine.nv ?? 0) + 1;
        if ((unit.stmr ?? 1000) < 1000) mine.farmableStmr!++;
        const ex = Math.min(3, Math.max(0, unit.exRank ?? 0)); // the EX level of each awakened copy
        mine.exCopies ??= [0, 0, 0, 0];
        mine.exCopies[ex]++;
        mine.exRank = Math.max(mine.exRank, ex);
      } else if (unit.id.endsWith('7')) {
        mine.sevenStar!++;
        if ((unit.stmr ?? 1000) < 1000) mine.farmableStmr!++;
      } else {
        mine.number++;
        // the id ends with the rarity of the copy: the breakdown of the base copies
        const rarity = unit.id.slice(-1);
        mine.base ??= {};
        mine.base[rarity] = (mine.base[rarity] ?? 0) + 1;
      }
    }
  }
  return { owned, messages };
}
