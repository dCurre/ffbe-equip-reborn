import { Component, computed, input } from '@angular/core';
import { Item, escapeName } from '../../helpers/item';

/** The picture of an item (its icon, or the sprite of its type) with the "not stackable" / "two handed" marks. */
@Component({
  selector: 'app-item-picture',
  host: { class: 'td type' },
  templateUrl: './item-picture.html',
  styleUrl: './item-picture.css',
})
export class ItemPicture {
  readonly item = input.required<Item>();

  protected readonly notStackable = computed(() => !!this.item().special?.includes('notStackable'));
  protected readonly twoHanded = computed(() => !!this.item().special?.includes('twoHanded'));
  protected readonly esperName = computed(() => escapeName(this.item().name));
}
