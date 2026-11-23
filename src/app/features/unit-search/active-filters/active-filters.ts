import { Component, input, output } from '@angular/core';
import { Button } from '../../../shared/components/button/button';
import { Icon } from '../../../shared/components/icon/icon';
import { STRINGS } from '../../../strings/en';

/** A filter that is on: what it asks for, and the key to turn it off. */
export interface ActiveFilter {
  key: string;
  label: string;
}

/** The filters that are on as chips: one click takes a filter off, and a link takes them all off. */
@Component({
  selector: 'app-active-filters',
  imports: [Button, Icon],
  templateUrl: './active-filters.html',
  styleUrl: './active-filters.css',
})
export class ActiveFilters {
  protected readonly t = STRINGS.activeFilters;
  readonly filters = input.required<readonly ActiveFilter[]>();
  readonly removed = output<string>();
  readonly cleared = output<void>();
}
