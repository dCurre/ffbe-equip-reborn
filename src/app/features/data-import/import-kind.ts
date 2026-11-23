import { isEsperFile } from '../espers/esper-import';
import { isItemFile } from '../inventory/inventory-model';
import { isConsumablesFile, isUnitFile } from '../units/unit-import';

import { isSaveFile } from './save-import';

/** `'save'` is the full save of the game: the units and the consumables are read from it. */
export type ImportKind = 'units' | 'consumables' | 'inventory' | 'espers' | 'save';

/**
 * What a file exported from the game contains, from its content: the four kinds are lists of different objects (a unit has
 * a level and a TMR, an item a count, a consumable a quantity, an Esper a board), so a file is never taken for two kinds.
 * `'empty'` is a list without anything in it (it would pass every check), `null` is anything the site does not know.
 */
export function detectImportKind(data: unknown): ImportKind | 'empty' | null {
  if (isSaveFile(data)) return data.roster.length ? 'save' : 'empty';
  if (!Array.isArray(data)) return null;
  if (data.length === 0) return 'empty';
  if (isUnitFile(data)) return 'units';
  if (isConsumablesFile(data)) return 'consumables';
  if (isEsperFile(data)) return 'espers';
  if (isItemFile(data)) return 'inventory';
  return null;
}
