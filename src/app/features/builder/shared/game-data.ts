import type { Item } from '../../../game/helpers/item';

/* eslint-disable @typescript-eslint/no-explicit-any -- the game data of the core is open */

/** The game data the builder works on, filled once when the page starts. */
export class GameData {
  data: Item[] = [];
  enchantments: Record<string, any> = {};
  /** the owned Espers when the user saved some, else the default ones */
  espers: any[] = [];
}
