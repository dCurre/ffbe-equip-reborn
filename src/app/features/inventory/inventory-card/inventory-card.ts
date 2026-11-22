import { NgTemplateOutlet } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { weaponList } from '../../../../core/constants';
import { ItemSummary } from '../../../game/components/item-summary/item-summary';
import { ItemEntry, SELLABLE_ITEMS_ACCESS } from '../inventory-model';

/* eslint-disable @typescript-eslint/no-explicit-any -- the enchantments of the game are open */

/** One item of the inventory: how many are owned, the buttons to change them, and what the tab adds (STMR recipe, sell reason). */
@Component({
  selector: 'app-inventory-card',
  imports: [NgTemplateOutlet, ItemSummary],
  templateUrl: './inventory-card.html',
  styleUrls: ['../inventory-item.css', './inventory-card.css'],
})
export class InventoryCard {
  readonly line = input.required<ItemEntry>();
  readonly tab = input.required<string>();
  /** the state classes of the card, computed by the page (they depend on the whole inventory) */
  readonly classes = input.required<string>();
  readonly enchantments = input.required<any>();
  readonly stmrUnitName = input('');
  readonly add = output<void>();
  readonly remove = output<void>();
  readonly farmedTmr = output<void>();
  readonly enhance = output<void>();
  readonly excluded = output<void>();
  readonly levelChange = output<1 | -1>();

  protected canEnhance(): boolean {
    return weaponList.includes(this.line().item.type);
  }

  /** What a click on the card does: add one (not in the tabs that only show a list). */
  protected clickable(): boolean {
    return !['sellable', 'candidates', 'farmableStmr'].includes(this.tab());
  }

  protected onCardClick(event: MouseEvent): void {
    if (!this.clickable() || (event.target as HTMLElement).closest('a')) return;
    this.add.emit();
  }

  protected betterItemsText(): string {
    return Object.values(this.line().betterItems ?? {})
      .map((b) => `${b.name} x${b.available}`)
      .join(', ');
  }

  protected betterItemsTotal(): number {
    return Object.values(this.line().betterItems ?? {}).reduce((sum, b) => sum + b.available, 0);
  }

  protected sellReason(): 'shop' | 'recipe' | null {
    if (!this.line().item.access.some((a) => SELLABLE_ITEMS_ACCESS.includes(a))) return null;
    return this.line().item.access.includes('shop') ? 'shop' : 'recipe';
  }

  protected stmrImage(): string {
    const unitId: string = this.line().item['stmrUnit'];
    return `img/units/unit_icon_${unitId.substring(0, unitId.length - 1)}7.png`;
  }

  protected range(count: number | undefined): number[] {
    return Array.from({ length: count ?? 0 }, (_, i) => i);
  }
}
