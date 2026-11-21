import { Component, model } from '@angular/core';

/** The column on the left of the collections: a button to collapse it (`[(collapsed)]`) and the statistics inside. */
@Component({
  selector: 'app-stats-sidebar',
  host: { '[class.collapsed]': 'collapsed()' },
  templateUrl: './stats-sidebar.html',
  styleUrl: './stats-sidebar.css',
})
export class StatsSidebar {
  readonly collapsed = model(false);
}
