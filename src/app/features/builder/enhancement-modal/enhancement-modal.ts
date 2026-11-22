import { Component, input } from '@angular/core';
import { EnhancementPicker } from '../../../game/components/enhancement-picker/enhancement-picker';
import { ItemSummary } from '../../../game/components/item-summary/item-summary';
import { Modal } from '../../../shared/components/modal/modal';
import type { GameData } from '../shared/game-data';
import type { ItemActions } from '../shared/item-actions';

/** Picks the enhancements of an item, or of the default weapon. */
@Component({
  selector: 'app-enhancement-modal',
  imports: [Modal, ItemSummary, EnhancementPicker],
  templateUrl: './enhancement-modal.html',
  styleUrl: './enhancement-modal.css',
})
export class EnhancementModal {
  readonly items = input.required<ItemActions>();
  readonly game = input.required<GameData>();
}
