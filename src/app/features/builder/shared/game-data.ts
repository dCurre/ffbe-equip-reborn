import type { Item } from '../../../game/helpers/item';

/* eslint-disable @typescript-eslint/no-explicit-any -- the game data of the core is open */

/** The game data the builder works on, filled once when the page starts. */
export class GameData {
  data: Item[] = [];
  /** `data` without the items that only the Japan version has */
  globalData: Item[] = [];
  enchantments: Record<string, any> = {};
  /** every Esper: the owned ones (saved in the Esper page) first, then the default ones the user does not have */
  espers: any[] = [];
  /** `espers` as the Global version has them (the Japan-only boards and nodes left out): the "JP excluded" source */
  globalEspers: any[] = [];
  /** the ids of the Espers the user owns; null when the user saved none (the Espers are not told apart) */
  ownedEsperIds: ReadonlySet<string> | null = null;

  /** the Espers of the source chosen in the page */
  espersFor(source: string): any[] {
    return source === 'global' ? this.globalEspers : this.espers;
  }
}
