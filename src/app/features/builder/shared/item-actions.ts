import { computed, signal } from '@angular/core';
import { baseStats } from '../../../../core/constants/base-lists';
import { bodyList, headList, shieldList, typeList, weaponList } from '../../../../core/constants/item-types';
import type { DataStorage } from '../../../../core/builder/data-storage';
import { findBestItemVersion, getEsperItem } from '../../../../core/builder/item-conditions';
import { addToStat, applyEnhancements } from '../../../../core/builder/item-combination';
import { isStackable, isTwoHanded } from '../../../../core/builder/item-values';
import type { Item } from '../../../game/helpers/item';
import type { Inventory } from '../../../shared/services/inventory';
import type { Toast } from '../../../shared/services/toast';
import type { BuilderState } from './builder-state';
import type { GameData } from './game-data';
import { readItemOptions } from './build-inputs';
import type { ItemPicker, PickerBehavior, PickerContext } from '../item-picker/item-picker';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

/** What the user does with the items of the build: choose, pin, remove, exclude, include, enhance. */
export class ItemActions {
  // --- Choosing items ---

  readonly pickerBehavior = signal<PickerBehavior>('equip');
  readonly pickerTypes = signal<readonly string[]>([]);
  private pickerSlot = -1;

  readonly pickerContext = computed<PickerContext>(() => {
    this.s.tick();
    return {
      items: this.game.data,
      espers: this.game.espersFor(this.s.source()),
      build: this.s.build(),
      units: this.s.units(),
      enchantments: this.game.enchantments,
      owned: (item) => {
        if (this.inventory.status() !== 'loaded' || item.type === 'esper') return null;
        if (!item.id) return { total: 0, available: 0 };
        const { total, available } = this.dataStorage.getOwnedNumber(item);
        return { total, available };
      },
    };
  });

  constructor(
    private readonly s: BuilderState,
    private readonly game: GameData,
    private readonly dataStorage: DataStorage,
    private readonly toast: Toast,
    private readonly inventory: Inventory,
    private readonly picker: () => ItemPicker | undefined,
  ) {}

  /** The window that chooses the item of a slot. */
  openSlot(slot: number): void {
    const build = this.s.build();
    if (!build.unit) return;
    build.prepareEquipable(slot);
    const types = build.equipable[slot];
    if (!types.length) {
      this.toast.show('Nothing can be added at this slot', 'warn');
      return;
    }
    this.openPicker('equip', types, slot);
  }

  /** The window of the enhancements of the weapon of a slot (pinning it with them). */
  enhanceSlot(slot: number): void {
    const build = this.s.build();
    const item = build.fixedItems[slot] ?? build.build[slot];
    if (!item) return;
    this.pickerSlot = slot;
    this.openEnhancements(item);
  }

  /** Why an item of an owned-items build is worth a look: a TMR to farm, an STMR to get or a trial reward (the old marker). */
  farmHint(slot: number, item: any): string | null {
    const build = this.s.build();
    if (!item || item.placeHolder || slot >= 10 || !this.dataStorage.onlyUseOwnedItems) return null;
    let used = this.dataStorage.alreadyUsedItems?.[item.id] ?? 0;
    for (let i = 0; i < slot; i++) {
      const other = build.build[i];
      if (other && !build.fixedItems[i] && other.id && other.id === item.id) used++;
    }
    const owned = this.dataStorage.getOwnedNumber(item);
    if (owned.totalOwnedNumber > used || owned.total <= used) return null;
    const units = this.s.units();
    if (item.tmrUnit) return `TMR you may want to farm. TMR of ${units[item.tmrUnit]?.name}`;
    if (item.stmrUnit) return `STMR you can acquire. STMR of ${units[item.stmrUnit]?.name}`;
    if (item.access?.includes('trial')) return 'Trial reward';
    return null;
  }

  /** The window that chooses the items to exclude from the builds, or to always allow. */
  openList(kind: 'exclude' | 'include'): void {
    const build = this.s.build();
    if (!build.unit) {
      this.toast.show('Please select a unit', 'warn');
      return;
    }
    build.prepareEquipable();
    const types = kind === 'include' ? typeList : [...new Set(build.equipable.slice(0, 10).flat() as string[])];
    this.openPicker(kind, types, -1);
  }

  private openPicker(behavior: PickerBehavior, types: readonly string[], slot: number): void {
    this.pickerBehavior.set(behavior);
    this.pickerTypes.set(types);
    this.pickerSlot = slot;
    readItemOptions(this.s, this.dataStorage, this.inventory);
    this.dataStorage.calculateAlreadyUsedItems([this.s.build()], 0);
    this.picker()?.show();
  }

  onPicked(event: { item: Item; enhancements?: unknown }): void {
    const build = this.s.build();
    const { item, enhancements } = event;
    let resolved: any = item;
    if (item.type !== 'esper') {
      const base = this.dataStorage.allItemVersions[item.id]?.[0] ?? item;
      resolved = findBestItemVersion(
        build.build,
        base,
        this.dataStorage.itemWithVariation,
        build.unit,
        this.game.enchantments,
      );
      if (Array.isArray(enhancements) && enhancements.length) {
        resolved = applyEnhancements(
          resolved,
          enhancements.map((e) => (e === 'rare' ? 'rares' : e)),
          this.game.enchantments,
        );
      }
    }
    this.fixItem(resolved, this.pickerSlot);
  }

  /** Which slot an item goes to, among the free ones (the old `getFixedItemItemSlot`); -1: none. */
  private freeSlotFor(item: any, equipable: string[][], fixed: any[]): number {
    const type = item.type;
    if (weaponList.includes(type)) {
      if (fixed[0] && fixed[1]) return -1;
      if (!fixed[0]) return 0;
      return !this.s.forceDoubleHand() && equipable[1].includes(type) ? 1 : -1;
    }
    if (shieldList.includes(type)) return fixed[1] ? -1 : 1;
    if (headList.includes(type)) return fixed[2] ? -1 : 2;
    if (bodyList.includes(type)) return fixed[3] ? -1 : 3;
    if (type === 'accessory') return fixed[4] && fixed[5] ? -1 : fixed[4] ? 5 : 4;
    if (type === 'materia') return [6, 7, 8, 9].find((i) => !fixed[i]) ?? -1;
    if (type === 'visionCard') return 10;
    if (type === 'esper') return 11;
    return -1;
  }

  /** Puts an item in a slot of the build and pins it (the old `fixItem`). */
  fixItem(item: any, slotParam = -1, pin = true): void {
    const build = this.s.build();
    build.prepareEquipable();
    let slot = slotParam;
    if (slot === -1) slot = this.freeSlotFor(item, build.equipable, build.fixedItems);
    if (slot === -1) {
      const partial = build.getPartialDualWield();
      if (
        weaponList.includes(item.type) &&
        build.fixedItems[0] &&
        !build.fixedItems[1] &&
        partial?.includes(item.type)
      ) {
        slot = 1;
      } else {
        this.toast.show(
          'No more slot available for this item. Select another item or remove a pinned item of the same type.',
          'warn',
        );
        return;
      }
    }
    if (isTwoHanded(item) && build.build[1 - slot]) {
      this.toast.show(
        'Trying to equip a two-handed weapon when another weapon is already equiped is not possible',
        'error',
      );
      return;
    }
    if (!isStackable(item) && [6, 7, 8, 9].some((i) => i !== slot && build.build[i]?.id === item.id)) {
      this.toast.show('This materia is not stackable. You cannot add another one', 'error');
      return;
    }
    if (build.build[slot] && build.build[slot].id !== item.id) this.removeItemAt(slot);
    build.fixItem(pin ? item : null, slot);
    build.setItem(item, slot);
    if (slot < 11) {
      // the other items take their best version with the new one
      for (let index = 0; index < 11; index++) {
        const other = build.build[index];
        if (index === slot || !other || other.placeHolder) continue;
        const best = findBestItemVersion(
          build.build,
          other,
          this.dataStorage.itemWithVariation,
          build.unit,
          this.game.enchantments,
        );
        if (build.fixedItems[index]) build.fixedItems[index] = best;
        build.build[index] = best;
      }
    }
    this.adaptEsperMastery();
    this.s.recalculateApplicableSkills();
    this.picker()?.open.set(false);
    this.enhancingOpen.set(false);
    this.s.refresh();
  }

  /** The Esper takes the bonus of the types of equipment of the build (the old `adaptEsperMasteryToBuild`). */
  private adaptEsperMastery(): void {
    const build = this.s.build();
    if (!build.build[11]) return;
    let esper: any = getEsperItem(build.build[11].originalEsper);
    const types = new Set<string>(build.build.filter((i: any) => i?.type).map((i: any) => i.type));
    if (esper.conditional?.some((c: any) => types.has(c.equipedCondition))) {
      esper = JSON.parse(JSON.stringify(esper));
      for (const c of esper.conditional.filter((c: any) => types.has(c.equipedCondition))) {
        for (const stat of baseStats) if (c[`${stat}%`]) addToStat(esper, `${stat}%`, c[`${stat}%`]);
      }
    }
    build.build[11] = esper;
  }

  /** Removes the item of a slot, and the items that were allowed only by it (the old `removeItemAt`). */
  removeItem(slot: number): void {
    this.removeItemAt(slot);
    this.s.refresh();
  }

  private removeItemAt(slot: number): void {
    const build = this.s.build();
    build.fixedItems[slot] = null;
    build.build[slot] = null;
    build.prepareEquipable();
    for (let index = 0; index < 11; index++) {
      const item = build.build[index];
      if (!item || item.placeHolder) continue;
      if (!build.equipable[index].includes(item.type)) {
        this.removeItemAt(index);
      } else {
        build.build[index] = findBestItemVersion(
          build.build,
          item,
          this.dataStorage.itemWithVariation,
          build.unit,
          this.game.enchantments,
        );
        if (build.fixedItems[index]) build.fixedItems[index] = build.build[index];
      }
    }
    this.adaptEsperMastery();
    this.s.recalculateApplicableSkills();
  }

  /** Empties the build: all the items, or only the ones that are not pinned. */
  clearItems(keepPinned: boolean): void {
    const build = this.s.build();
    for (let slot = 0; slot < build.build.length; slot++) {
      if (!keepPinned || build.fixedItems[slot] == null) this.removeItemAt(slot);
    }
    this.s.refresh();
  }

  toggleExclude(id: string): void {
    const build = this.s.build();
    if (this.s.excluded().includes(id)) {
      this.s.excluded.update((list) => list.filter((i) => i !== id));
      return;
    }
    for (let index = 0; index < 11; index++) {
      if (build.build[index]?.id === id && build.fixedItems[index] == null) this.removeItemAt(index);
    }
    this.s.excluded.update((list) => [...list, id]);
    this.s.refresh();
  }

  toggleInclude(id: string): void {
    this.s.included.update((list) => (list.includes(id) ? list.filter((i) => i !== id) : [...list, id]));
  }

  pinItem(slot: number): void {
    const build = this.s.build();
    const item = build.build[slot];
    if (!item) return;
    build.fixItem(findBestItemVersion(build.build, item, this.dataStorage.itemWithVariation, build.unit), slot);
    this.s.refresh();
  }

  unpinItem(slot: number): void {
    this.s.build().fixItem(null, slot);
    this.s.refresh();
  }

  // --- The enhancements of an item to pin ---

  readonly enhancingItem = signal<Item | null>(null);
  readonly enhancingOpen = signal(false);
  readonly enhancementValues = signal<(string | number)[]>([]);

  openEnhancements(item: Item): void {
    this.enhancingDefault.set(false);
    this.enhancingItem.set(item);
    this.enhancementValues.set([...((item['enhancements'] as (string | number)[] | undefined) ?? [])]);
    this.enhancingOpen.set(true);
  }

  /** The enhancements the TMR and STMR weapons get in the builds (the old "Weapon enhancement: Set default"). */
  readonly defaultEnhancements = signal<(string | number)[]>([]);
  readonly enhancingDefault = signal(false);

  openDefaultEnhancements(): void {
    this.enhancingItem.set(null);
    this.enhancingDefault.set(true);
    this.enhancementValues.set([...this.defaultEnhancements()]);
    this.enhancingOpen.set(true);
  }

  toggleEnhancement(value: string | number): void {
    const values = this.enhancementValues();
    if (values.includes(value)) {
      this.enhancementValues.set(values.filter((v) => v !== value));
    } else if (values.length >= 3) {
      this.toast.show('No more than 3 item enhancements can be selected', 'warn');
    } else {
      this.enhancementValues.set([...values, value]);
    }
  }

  pinEnhanced(): void {
    if (this.enhancingDefault()) {
      this.defaultEnhancements.set(this.enhancementValues());
      this.dataStorage.setDefaultWeaponEnhancement(this.enhancementValues());
      this.enhancingOpen.set(false);
      return;
    }
    const item = this.enhancingItem();
    if (!item) return;
    const build = this.s.build();
    const base = this.dataStorage.allItemVersions[item.id]?.[0] ?? item;
    const best = findBestItemVersion(
      build.build,
      base,
      this.dataStorage.itemWithVariation,
      build.unit,
      this.game.enchantments,
    );
    this.fixItem(applyEnhancements(best, this.enhancementValues(), this.game.enchantments), this.pickerSlot);
  }
}
