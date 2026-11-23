import { Component, computed, input } from '@angular/core';
import { itemEnhancementLabels } from '../../../../core/constants/item-enhancement-labels';
import { typeCategories } from '../../../../core/constants/item-types';
import { WikiLink } from '../../../shared/components/wiki-link/wiki-link';
import { Item } from '../../helpers/item';
import { ItemEnchantments } from '../../models/item-context.model';
import { itemStats } from '../../helpers/item-stats';
import { Icon } from '../../../shared/components/icon/icon';
import { STRINGS } from '../../../strings/en';

/** The name of an item with its wiki link, rarity, level, stats and enhancements. */
@Component({
  selector: 'app-item-name',
  imports: [WikiLink, Icon],
  host: { class: 'td name' },
  templateUrl: './item-name.html',
  styleUrl: './item-name.css',
})
export class ItemName {
  protected readonly t = STRINGS.itemName;
  readonly item = input.required<Item>();
  /** the enchantments (`itemEnchants.json`), to name the rare enhancements of an item */
  readonly enchantments = input<ItemEnchantments>();

  protected readonly stats = computed(() => itemStats(this.item()));
  /** the wiki page of a placeholder item is the one of its category */
  protected readonly categoryPage = computed(() => (typeCategories as Record<string, string>)[this.item().type]);
  protected readonly showTypeIcon = computed(() => !['esper', 'monster', 'fake'].includes(this.item().type));
  protected readonly enhancements = computed(() =>
    ((this.item()['enhancements'] as (string | number)[] | undefined) ?? [])
      .map((enhancement) =>
        typeof enhancement === 'number'
          ? (this.enchantments()?.[enhancement]?.effects ?? '')
          : (itemEnhancementLabels as unknown as Record<string, string>)[enhancement],
      )
      .join(', '),
  );
}
