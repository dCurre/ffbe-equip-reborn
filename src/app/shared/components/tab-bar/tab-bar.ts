import { Component, input, output } from '@angular/core';

/** A tab of the bar: the sprite `img-tab-<icon>` or a picture (the title alone when there is none), and a title. `kind` sizes a picture. */
export interface TabItem<T extends string> {
  key: T;
  title: string;
  icon?: string;
  image?: string;
  kind?: 'stmr' | 'small';
}

/** Tabs with a picture each (the collection pages): the `active` key is highlighted, `selected` fires on a click. */
@Component({
  selector: 'app-tab-bar',
  templateUrl: './tab-bar.html',
  styleUrl: './tab-bar.css',
})
export class TabBar<T extends string> {
  readonly tabs = input.required<readonly TabItem<T>[]>();
  readonly active = input.required<T>();
  readonly selected = output<T>();
}
