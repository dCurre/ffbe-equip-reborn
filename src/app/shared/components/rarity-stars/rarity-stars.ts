import { Component, computed, input } from '@angular/core';
import { Icon } from '../icon/icon';

const starOf = (count: number): string => `star-${count <= 2 ? 1 : count === 6 ? 5 : count}`; // 1★ and 2★ share the white star, 5★ and 6★ the rainbow one

/**
 * A rarity of a unit: the number and one star in the colour of the rarity, the crystal after the 7, the badge alone for NV and
 * NV+. With a `max` it is the range of a unit instead: that many stars in the colour of the base, then empty ones up to the max.
 */
@Component({
  imports: [Icon],
  selector: 'app-rarity-stars',
  templateUrl: './rarity-stars.html',
  styleUrl: './rarity-stars.css',
})
export class RarityStars {
  /** `"1"` … `"7"`, `"NV"` or `"NV+"` */
  readonly rarity = input.required<string>();
  /** the max stars: draws the range, without the number */
  readonly max = input<number | string>();
  /** the size of the stars in pixels */
  readonly size = input(16);
  protected readonly range = computed<string[]>(() => {
    const base = parseInt(this.rarity(), 10);
    const total = Math.max(base, Number(this.max()));
    return Array.from({ length: total }, (_, i) => (i < base ? starOf(base) : 'star-empty'));
  });
  protected readonly isStar = computed(() => !this.rarity().startsWith('NV'));
  protected readonly icon = computed(() => {
    const rarity = this.rarity();
    if (rarity === 'NV') return 'crystal-NV';
    if (rarity === 'NV+') return 'crystal-NVPlus';
    if (rarity === '7') return 'crystal-sevenStarCrystal';
    return starOf(parseInt(rarity, 10));
  });
}
