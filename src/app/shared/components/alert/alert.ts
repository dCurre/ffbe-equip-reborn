import { Component, input } from '@angular/core';

/** A message box (the old Bootstrap `alert`): `info` or `danger`. Inline, so it is as wide as its text. */
@Component({
  selector: 'app-alert',
  host: { role: 'alert', '[class]': 'kind()' },
  templateUrl: './alert.html',
  styleUrl: './alert.css',
})
export class Alert {
  readonly kind = input<'info' | 'danger'>('info');
}
