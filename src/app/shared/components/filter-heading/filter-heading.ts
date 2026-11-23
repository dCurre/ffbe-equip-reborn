import { Component, input, output } from '@angular/core';
import { STRINGS } from '../../../strings/en';

/** The heading of a filter panel: the title, an "unselect all" link while `clearable`, and on the right the content. */
@Component({
  selector: 'app-filter-heading',
  templateUrl: './filter-heading.html',
  styleUrl: './filter-heading.css',
})
export class FilterHeading {
  protected readonly t = STRINGS.filterHeading;
  readonly title = input.required<string>();
  readonly clearable = input(false);
  readonly cleared = output<void>();
}
