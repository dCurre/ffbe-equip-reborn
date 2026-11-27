import {
  afterRenderEffect,
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { Icon } from '../../../shared/components/icon/icon';

/** A tab of the bar: the sprite `img-tab-<icon>` or a picture (the title alone when there is none), and a title. `kind` sizes a picture. */
export interface TabItem<T extends string> {
  key: T;
  title: string;
  icon?: string;
  image?: string;
  kind?: 'stmr' | 'small';
  /** a number written small after the title */
  count?: number;
  /** a check before the title, with what it means */
  done?: string;
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
  host: { '[class.scrollable]': 'scrollable()', '[class.flat]': 'flat()' },
  templateUrl: './tab-bar.html',
  styleUrl: './tab-bar.css',
})
export class TabBar<T extends string> {
  readonly tabs = input.required<readonly TabItem<T>[]>();
  readonly active = input.required<T>();
  readonly selected = output<T>();
  /** many tabs: one line that scrolls sideways, with a fade at the right edge (as the Esper tabs) */
  readonly scrollable = input(false, { transform: booleanAttribute });
  /** square tabs on a tinted strip, small: for the tabs inside a table */
  readonly flat = input(false, { transform: booleanAttribute });
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  /** the one tab the Tab key stops on: the active one, else the first */
  protected readonly focusable = computed(() =>
    this.tabs().some((tab) => tab.key === this.active()) ? this.active() : this.tabs()[0]?.key,
  );

  /** Enter or Space choose a tab; the arrows go to the one before or after, and choose it. */
  protected onKey(event: KeyboardEvent, index: number): void {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step && event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const tab = this.tabs()[index + step];
    if (!tab) return;
    if (step) this.host.nativeElement.querySelectorAll('li')[index + step]?.focus();
    this.selected.emit(tab.key);
  }

  constructor() {
    // a tab chosen from outside the bar can be out of sight: the bar scrolls sideways to it (the page does not move)
    afterRenderEffect(() => {
      this.active();
      this.tabs();
      if (!this.scrollable()) return;
      const bar = this.host.nativeElement.querySelector('ul');
      const tab = bar?.querySelector<HTMLElement>('li.active');
      if (!bar || !tab) return;
      const left = tab.offsetLeft - bar.offsetLeft;
      if (left < bar.scrollLeft || left + tab.offsetWidth > bar.scrollLeft + bar.clientWidth)
        bar.scrollLeft = left - (bar.clientWidth - tab.offsetWidth) / 2;
    });
  }
}
