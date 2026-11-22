import { computed, inject, Injectable, signal } from '@angular/core';
import { showLoadError, showSaveError } from '../helpers/drive-errors';
import { StaticData } from './static-data';
import { Toast } from './toast';
import { UserData, UserTable } from './user-data';

/** What the user owns of one unit (`number` = 6* or under, `farmable` = TMR still to farm; the others only for 7* / NV units). */
export interface OwnedUnit {
  number: number;
  farmable: number;
  sevenStar?: number;
  farmableStmr?: number;
  nv?: number;
  exRank?: number;
  tmrMoogles?: number[];
}

export type OwnedUnits = Record<string, OwnedUnit>;
export type OwnedConsumables = Record<string, number>;

/** The item counts by item id, plus the two sub-objects stored next to them. */
export interface ItemInventory {
  enchantments: Record<string, string[][]>;
  visionCardsLevels: Record<string, unknown>;
  [itemId: string]: number | Record<string, string[][]> | Record<string, unknown>;
}

interface TmrItem {
  id: string;
  tmrUnit?: string;
}

/** The unit file version the old site wrote: 4 = the key is the unit of the base rarity. */
const UNITS_VERSION = 4;
const SAVE_DELAY_MS = 3000;

/** A unit-collection file of an older version: `{unitId: number}` (< 3) or keyed by the max-rarity unit id (3). */
type RawUnits = Record<string, OwnedUnit | number> & { version?: number };

/**
 * The user's items, units and consumables, loaded once from Google Drive and saved after a change (3 s later, like the old
 * site). The pages edit the objects in place and then call `changed()`.
 */
@Injectable({ providedIn: 'root' })
export class Inventory {
  private readonly userData = inject(UserData);
  private readonly staticData = inject(StaticData);
  private readonly toast = inject(Toast);

  readonly items = signal<ItemInventory>(this.emptyItems());
  readonly units = signal<OwnedUnits>({});
  readonly consumables = signal<OwnedConsumables>({});
  /** `loading` until the files are read; `notLoaded` without a login or after an error. */
  readonly status = signal<'loading' | 'loaded' | 'notLoaded'>('loading');

  readonly unitCount = computed(() =>
    // an NV unit keeps its copies in `nv` only
    Object.values(this.units()).reduce(
      (sum, unit) => sum + Math.max((unit.number || 0) + (unit.sevenStar || 0), unit.nv || 0),
      0,
    ),
  );
  /** Items by slot occupied, not by amount: every enchanted copy counts as one more. */
  readonly itemCount = computed(() => {
    const items = this.items();
    const enchantments = items.enchantments;
    let count = Object.keys(items).length - 2; // `enchantments` and `visionCardsLevels` are not items
    for (const id of Object.keys(enchantments)) if (items[id]) count += enchantments[id].length;
    return count;
  });

  private loadPromise: Promise<void> | null = null;
  private dirty = new Set<UserTable>();
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    window.addEventListener('beforeunload', (event) => {
      if (this.dirty.size > 0) event.preventDefault();
    });
  }

  /** Loads the user's files the first time it is called (a page without a login, or opened from a link, does not call it). */
  load(): Promise<void> {
    this.loadPromise ??= this.read();
    return this.loadPromise;
  }

  /** The number of one item, 0 if the user has none. */
  count(itemId: string): number {
    const value = this.items()[itemId];
    return typeof value === 'number' ? value : 0;
  }

  /** The pages edited the objects in place: tell the signals and save the tables 3 s later. */
  changed(...tables: ('itemInventory' | 'units' | 'consumables')[]): void {
    this.items.update((items) => ({ ...items }));
    this.units.update((units) => ({ ...units }));
    this.consumables.update((consumables) => ({ ...consumables }));
    tables.forEach((table) => this.dirty.add(table));
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), SAVE_DELAY_MS);
  }

  /** Replaces a whole table (an import) and saves it at once. */
  replace(table: 'units', data: OwnedUnits): Promise<void>;
  replace(table: 'consumables', data: OwnedConsumables): Promise<void>;
  replace(table: 'units' | 'consumables', data: OwnedUnits | OwnedConsumables): Promise<void> {
    if (table === 'units') this.units.set(data as OwnedUnits);
    else this.consumables.set(data as OwnedConsumables);
    this.dirty.add(table);
    return this.save();
  }

  async save(): Promise<void> {
    clearTimeout(this.saveTimer);
    const tables = [...this.dirty];
    this.dirty.clear();
    try {
      for (const table of tables) {
        if (table === 'itemInventory') {
          this.sanitizeItems();
          await this.userData.write(table, this.items());
        } else if (table === 'units') {
          await this.userData.write(table, { ...this.units(), version: UNITS_VERSION });
        } else {
          await this.userData.write(table, this.consumables());
        }
      }
      if (tables.length) this.toast.show('Data saved');
    } catch (error) {
      if (showSaveError(this.toast, error)) tables.forEach((table) => this.dirty.add(table));
    }
  }

  private emptyItems(): ItemInventory {
    return { enchantments: {}, visionCardsLevels: {} };
  }

  private async read(): Promise<void> {
    if (!this.userData.loggedIn()) {
      this.status.set('notLoaded');
      return;
    }
    try {
      const [items, units, consumables] = await Promise.all([
        this.userData.read<ItemInventory>('itemInventory'),
        this.userData.read<RawUnits>('units'),
        this.userData.read<OwnedConsumables>('consumables'),
      ]);
      items.enchantments ??= {};
      items.visionCardsLevels ??= {};
      // an old save kept "rare" where the enchantments are now "rares"
      for (const copies of Object.values(items.enchantments)) {
        for (const enchantments of copies)
          enchantments.forEach((value, i) => (enchantments[i] = value === 'rare' ? 'rares' : value));
      }
      this.items.set(items);
      this.sanitizeItems();
      const { owned, migrated } = await this.upgradeUnits(units, items);
      this.units.set(owned);
      this.consumables.set(consumables);
      this.status.set('loaded');
      if (migrated) {
        this.dirty.add('units');
        await this.save();
        this.toast.show('Owned units data successfully migrated', 'success');
      }
    } catch (error) {
      this.status.set('notLoaded');
      showLoadError(this.toast, error);
    }
  }

  /** Version 2 and below stored `{unitId: number}`, version 3 the max-rarity unit id as key: both become the current form. */
  private async upgradeUnits(raw: RawUnits, items: ItemInventory): Promise<{ owned: OwnedUnits; migrated: boolean }> {
    const version = raw.version;
    const { version: _version, ...entries } = raw;
    let migrated = false;
    if (version !== undefined && version < 3) {
      const data = await this.staticData.get<TmrItem[]>('data', true);
      const tmrOwned: Record<string, number> = {};
      for (const item of data) {
        const count = items[item.id];
        if (item.tmrUnit && typeof count === 'number' && count) tmrOwned[item.tmrUnit] = count;
      }
      for (const [id, number] of Object.entries(entries)) {
        const owned = typeof number === 'number' ? number : 0;
        entries[id] = { number: owned, farmable: Math.max(0, owned - (tmrOwned[id] ?? 0)) };
      }
      migrated = true;
    } else if (version === 3) {
      const allUnits = await this.staticData.get<Record<string, { max_rarity: number | 'NV' }>>('units');
      for (const [id, unit] of Object.entries(allUnits)) {
        const maxId = id.substring(0, id.length - 1) + unit.max_rarity;
        if (entries[maxId]) {
          entries[id] = entries[maxId];
          delete entries[maxId];
        }
      }
      migrated = true;
    }
    for (const [id, value] of Object.entries(entries)) {
      if (typeof value === 'number') entries[id] = { number: value, farmable: 0 };
    }
    // an NV unit keeps its copies in `nv` only: older saves also counted them in `number` (and a unit taken to 0 with "-"
    // kept its `number`, so it was never darkened)
    const legacy = Object.entries(entries as OwnedUnits).filter(([, unit]) => unit.number > 0);
    if (legacy.length) {
      const allUnits = await this.staticData.get<Record<string, { min_rarity: string | number }>>('units');
      for (const [id, unit] of legacy) {
        if (allUnits[id]?.min_rarity !== 'NV') continue;
        if (unit.nv) unit.nv = Math.max(unit.nv, unit.number);
        unit.number = 0;
        migrated = true;
      }
    }
    return { owned: entries as OwnedUnits, migrated };
  }

  /** Drops the enchantments of items that are no longer owned. */
  private sanitizeItems(): void {
    const items = this.items();
    for (const id of Object.keys(items.enchantments)) if (!items[id]) delete items.enchantments[id];
  }

  /** `?o` opens a page without the user data (a link seen by someone else). */
  get withoutAccount(): boolean {
    return new URLSearchParams(window.location.search).has('o');
  }
}
