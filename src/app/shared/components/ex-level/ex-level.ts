import { Component, computed, input } from '@angular/core';
import { Icon } from '../icon/icon';

const SLOTS = 3;

/** An EX level (0 to 3) as the game shows it: three slots, the ones reached filled and the others empty. */
@Component({
  imports: [Icon],
  selector: 'app-ex-level',
  templateUrl: './ex-level.html',
  styleUrl: './ex-level.css',
})
export class ExLevel {
  readonly level = input.required<number>();
  protected readonly slots = computed(() =>
    Array.from({ length: SLOTS }, (_, i) => (i < this.level() ? 'ex-star' : 'ex-star-empty')),
  );
}
