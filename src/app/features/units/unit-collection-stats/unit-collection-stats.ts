import { Component, input } from '@angular/core';
import { Icon, SpriteName } from '../../../shared/components/icon/icon';
import type { CollectionStats } from '../unit-model';

/** How many units of each rarity exist and are owned, for all, not-limited and time-limited units. */
@Component({
  selector: 'app-unit-collection-stats',
  imports: [Icon],
  templateUrl: './unit-collection-stats.html',
  styleUrl: './unit-collection-stats.css',
})
export class UnitCollectionStats {
  readonly counts = input.required<CollectionStats>();
  /** `short` is the title on a phone, where the groups are the columns of a table */
  readonly groups = input.required<readonly { key: keyof CollectionStats; title: string; short?: string }[]>();
  /** the title of the column of the rarities on a phone */
  readonly rarityLabel = input('');
  readonly rows = input.required<readonly { key: string; crystal: SpriteName; title: string }[]>();
}
