import { NgTemplateOutlet } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { weaponList } from '../../../../core/constants/item-types';
import { ItemSummary } from '../../../game/components/item-summary/item-summary';
import { ItemEntry } from '../inventory-model';
import { Button } from '../../../shared/components/button/button';
import { Icon } from '../../../shared/components/icon/icon';

/* eslint-disable @typescript-eslint/no-explicit-any -- the enchantments of the game are open */

/** One item of the inventory: how many are owned, the buttons to change them, and what the tab adds (the STMR recipe). */
@Component({
  selector: 'app-inventory-card',
  imports: [NgTemplateOutlet, Button, ItemSummary, Icon],
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
    return this.tab() !== 'farmableStmr';
  }

  protected onCardClick(event: MouseEvent): void {
    if (!this.clickable() || (event.target as HTMLElement).closest('a')) return;
    this.add.emit();
  }

  protected stmrImage(): string {
    const unitId: string = this.line().item['stmrUnit'];
    return `img/units/unit_icon_${unitId.substring(0, unitId.length - 1)}7.png`;
  }

  protected range(count: number | undefined): number[] {
    return Array.from({ length: count ?? 0 }, (_, i) => i);
  }
}
