import { Component, input, output } from '@angular/core';
import { Icon } from '../../../shared/components/icon/icon';

/** A tab of the bar: the sprite `img-tab-<icon>` or a picture (the title alone when there is none), and a title. `kind` sizes a picture. */
export interface TabItem<T extends string> {
  key: T;
  title: string;
  icon?: string;
  image?: string;
  kind?: 'stmr' | 'small';
}

/** The tabs of the filter groups, each title followed by the number of filters that are on in that group. */
export function tabsWithCounts<T extends string>(
  groups: readonly { key: T; title: string }[],
  filters: readonly { group: T }[],
): TabItem<T>[] {
  return groups.map(({ key, title }) => {
    const count = filters.filter((f) => f.group === key).length;
    return { key, title: count ? `${title} (${count})` : title };
  });
}

/** Tabs with a picture each (the collection pages): the `active` key is highlighted, `selected` fires on a click. */
@Component({
  imports: [Icon],
  selector: 'app-tab-bar',
  templateUrl: './tab-bar.html',
  styleUrl: './tab-bar.css',
})
export class TabBar<T extends string> {
  readonly tabs = input.required<readonly TabItem<T>[]>();
  readonly active = input.required<T>();
  readonly selected = output<T>();
}
