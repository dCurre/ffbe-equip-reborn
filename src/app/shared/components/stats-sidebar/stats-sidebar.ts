import { Component, model } from '@angular/core';
import { Icon } from '../../../shared/components/icon/icon';
import { Button } from '../button/button';
import { STRINGS } from '../../../strings/en';

/** The column on the left of the collections: a button to collapse it (`[(collapsed)]`) and the statistics inside. */
@Component({
  imports: [Button, Icon],
  selector: 'app-stats-sidebar',
  host: { '[class.collapsed]': 'collapsed()' },
  templateUrl: './stats-sidebar.html',
  styleUrl: './stats-sidebar.css',
})
export class StatsSidebar {
  protected readonly t = STRINGS.statsSidebar;
  readonly collapsed = model(false);
}
