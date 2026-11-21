import { Component, input, model } from '@angular/core';
import { StatsSidebar } from '../stats-sidebar/stats-sidebar';

/**
 * The page of a collection (inventory, units): the statistics on the left (`<div stats>`), the links above
 * (`<div actions>`) and the rest on the right. On a phone the statistics go above.
 */
@Component({
  selector: 'app-collection-layout',
  imports: [StatsSidebar],
  templateUrl: './collection-layout.html',
  styleUrl: './collection-layout.css',
})
export class CollectionLayout {
  readonly collapsed = model(false);
  /** Limits the width of the content on wide screens. */
  readonly narrow = input(false);
  readonly hideActions = input(false);
}
