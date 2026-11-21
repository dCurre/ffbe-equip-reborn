import { Component, inject, input } from '@angular/core';
import { Sprites } from '../../../shared/services/sprites';
import { Item } from '../../helpers/item';
import { ItemEnchantments } from '../../models/item-context.model';
import { ItemName } from '../item-name/item-name';
import { ItemPicture } from '../item-picture/item-picture';

/** The picture, the name and the stats of an item, without the other columns (for a card or a title). */
@Component({
  selector: 'app-item-summary',
  imports: [ItemName, ItemPicture],
  templateUrl: './item-summary.html',
  styleUrl: './item-summary.css',
})
export class ItemSummary {
  readonly item = input.required<Item>();
  readonly enchantments = input<ItemEnchantments>();

  constructor() {
    inject(Sprites).load('equipments', 'elements', 'ailments', 'killers', 'espers');
  }
}
