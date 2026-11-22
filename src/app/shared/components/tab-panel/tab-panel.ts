import { Component, input, output } from '@angular/core';
import { TabBar, TabItem } from '../tab-bar/tab-bar';

/** The tab bar with the panel under it: the content is the panel, `[corner]` (a note, a button) is at the right of the tab bar, under it on a narrow phone. */
@Component({
  imports: [TabBar],
  selector: 'app-tab-panel',
  templateUrl: './tab-panel.html',
  styleUrl: './tab-panel.css',
})
export class TabPanel<T extends string> {
  readonly tabs = input.required<readonly TabItem<T>[]>();
  readonly active = input.required<T>();
  readonly selected = output<T>();
}
