import { Component, input, model, output } from '@angular/core';
import { EnhancementPicker } from '../../../game/components/enhancement-picker/enhancement-picker';
import { ItemSummary } from '../../../game/components/item-summary/item-summary';
import { Modal } from '../../../shared/components/modal/modal';
import type { Item } from '../../../game/helpers/item';

/* eslint-disable @typescript-eslint/no-explicit-any -- the enchantments of the game are open */

/** The enhancements of one owned item: the dialog lists the possible ones and the page applies the choice. */
@Component({
  selector: 'app-inventory-enhancement-modal',
  imports: [Modal, ItemSummary, EnhancementPicker],
  templateUrl: './inventory-enhancement-modal.html',
  styleUrls: ['../inventory-item.css', './inventory-enhancement-modal.css'],
})
export class InventoryEnhancementModal {
  readonly line = input.required<{ item: Item; enhancements: (string | number)[] } | null>();
  readonly enchantments = input.required<any>();
  readonly open = model(false);
  readonly toggled = output<string | number>();
}
