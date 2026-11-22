import { booleanAttribute, Component, computed, input } from '@angular/core';
import { Item } from '../../helpers/item';
import { ItemEnchantments, ItemUnits } from '../../models/item-context.model';
import { ItemAccess } from '../item-access/item-access';
import { ItemName } from '../item-name/item-name';
import { ItemPicture } from '../item-picture/item-picture';
import { ItemSpecial } from '../item-special/item-special';

/**
 * One line of an item table: type picture, name and stats, the value the list is sorted by (when `stat` is set),
 * the special effects and the access. It must sit inside an element with the `items` class.
 */
@Component({
  selector: 'app-item-line',
  imports: [ItemAccess, ItemName, ItemPicture, ItemSpecial],
  templateUrl: './item-line.html',
  styleUrl: './item-line.css',
})
export class ItemLine {
  readonly item = input.required<Item>();
  /** the stat the table is sorted by: its value is shown in a column (none: no column) */
  readonly stat = input<string>();
  readonly units = input<ItemUnits>({});
  /** do not name the unit a TMR / STMR belongs to */
  readonly hideUnit = input(false, { transform: booleanAttribute });
  readonly enchantments = input<ItemEnchantments>();
  readonly accessToRemove = input<readonly string[]>([]);
  /** how many the user owns (a column is added; none: no column, for a user who is not logged in) */
  readonly owned = input<number | null>(null);

  /** the value of the sorted stat; inflictions, evasion and resistances are percentages */
  protected readonly value = computed(() => {
    const percent = ['inflict', 'evade', 'resist'].includes(this.stat() ?? '') ? '%' : '';
    return `${Math.round(this.item().calculatedValue ?? 0)}${percent}`;
  });

}
