import { ImportedEsper } from '../espers/esper-import';
import { ImportedItem } from '../inventory/inventory-model';
import { ImportedUnit } from '../units/unit-import';

/** A unit of the roster of a full save (the one of FFBE Offline). */
interface SaveUnit {
  master_id: string;
  level: number;
  nv_ex_level?: number;
}

/** What the site reads of a full save: the personal data (`identity`) and the rest are never read. */
export interface GameSave {
  roster: SaveUnit[];
  beasts?: { esper_id: string; rarity: number; level: number; board: string }[];
  vision_cards?: { vc_id: string; level: number }[];
  inventory?: { equipment?: { item_id: number; count: number }[]; items?: { item_type: number; item_id: number; count: number }[] };
}

const ITEM_TYPE_CONSUMABLE = 20;
const ITEM_TYPE_MATERIA = 22;

export const isSaveFile = (data: unknown): data is GameSave =>
  typeof data === 'object' &&
  data !== null &&
  !Array.isArray(data) &&
  Array.isArray((data as GameSave).roster) &&
  (data as GameSave).roster.every((u) => typeof u?.master_id === 'string' && typeof u.level === 'number');

/**
 * The units of the save in the format of the unit file: one entry per unit owned (a copy is a row, like the file of the
 * game). The save does not tell the TMR / STMR progress, so every one counts as complete (`importUnits` then keeps nothing
 * farmable). The TMR moogles and the other items stored as units (ids starting with 9) are not units.
 */
export const unitsFromSave = (save: GameSave): ImportedUnit[] =>
  save.roster
    .filter((u) => !u.master_id.startsWith('9'))
    .map((u) => ({ id: u.master_id, level: u.level, tmr: 1000, stmr: 1000, exRank: u.nv_ex_level ?? 0 }));

/** The consumables of the save in the format of the consumables file (the ones that are owned). */
export const consumablesFromSaveFile = (save: GameSave): { itemId: string; itemQty: string }[] =>
  (save.inventory?.items ?? [])
    .filter((i) => i.item_type === ITEM_TYPE_CONSUMABLE && i.count > 0)
    .map((i) => ({ itemId: String(i.item_id), itemQty: String(i.count) }));

/** The Espers of the save in the format of the Esper file (the board is the same hex string). */
export const espersFromSave = (save: GameSave): ImportedEsper[] =>
  (save.beasts ?? []).map((e) => ({ id: e.esper_id, rarity: e.rarity, level: e.level, board: e.board }));

/**
 * The equipment, materia and vision cards of the save in the format of the inventory file (what is equipped on a unit is
 * already counted in the inventory of the save). The ids the site does not know (new or custom items) are dropped by
 * `importInventory`, and a later save imports them once the site knows them.
 */
export const itemsFromSave = (save: GameSave): ImportedItem[] => [
  ...(save.inventory?.equipment ?? []).map((i) => ({ id: String(i.item_id), count: i.count })),
  ...(save.inventory?.items ?? [])
    .filter((i) => i.item_type === ITEM_TYPE_MATERIA)
    .map((i) => ({ id: String(i.item_id), count: i.count })),
  ...(save.vision_cards ?? []).map((c) => ({ id: c.vc_id, count: 1, level: c.level })),
];
