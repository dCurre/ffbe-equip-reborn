import { Component, input } from '@angular/core';
import { Alert } from '../alert/alert';
import { Icon } from '../icon/icon';
import { STRINGS } from '../../../strings/en';

/** The messages of a page that needs the user's data: it is loading, or the login is needed. Empty when all is fine. */
@Component({
  selector: 'app-load-status',
  imports: [Alert, Icon],
  templateUrl: './load-status.html',
  styleUrl: './load-status.css',
})
export class LoadStatus {
  protected readonly t = STRINGS.loadStatus;
  readonly ready = input.required<boolean>();
  readonly loginNeeded = input(false);
  /** what is loaded, with its article: `your units`, `the data` */
  readonly subject = input.required<string>();
  /** a warning after the login message */
  readonly note = input('');
}
