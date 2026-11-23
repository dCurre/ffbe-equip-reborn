import { Component, input, output } from '@angular/core';
import { STRINGS } from '../../../strings/en';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';

/** The button that turns every filter off, with the number of filters that are on. */
@Component({
  selector: 'app-clear-filters',
  imports: [Button, Icon],
  templateUrl: './clear-filters.html',
  styleUrl: './clear-filters.css',
})
export class ClearFilters {
  protected readonly t = STRINGS.clearFilters;
  readonly count = input.required<number>();
  readonly title = input.required<string>();
  readonly cleared = output<void>();
}
