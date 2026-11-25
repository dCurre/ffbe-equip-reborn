import { Component, computed, input } from '@angular/core';
import { Item } from '../../helpers/item';
import { esperIcon } from '../../helpers/esper-icon';
import { Icon } from '../../../shared/components/icon/icon';
import { STRINGS } from '../../../strings/en';

/** The picture of an item (its icon, or the sprite of its type) with the "not stackable" / "two handed" marks. */
@Component({
  imports: [Icon],
  selector: 'app-item-picture',
  host: { class: 'td type' },
  templateUrl: './item-picture.html',
  styleUrl: './item-picture.css',
})
export class ItemPicture {
  protected readonly t = STRINGS.itemPicture;
  readonly item = input.required<Item>();

  protected readonly notStackable = computed(() => !!this.item().special?.includes('notStackable'));
  protected readonly twoHanded = computed(() => !!this.item().special?.includes('twoHanded'));
  /** an Esper of the Builder without a rarity is at its maximum */
  protected readonly icon = computed(() => esperIcon(this.item().name, this.item().rarity ?? 3));
}
