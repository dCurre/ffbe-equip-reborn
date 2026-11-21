import { Component, input } from '@angular/core';

/**
 * A box with a heading and a body (the old Bootstrap `panel panel-default`). The heading is the `heading` text, or
 * any element with the `panelHeading` attribute (for a `<h2>`, ...).
 */
@Component({
  selector: 'app-panel',
  templateUrl: './panel.html',
  styleUrl: './panel.css',
  host: { class: 'panel-box' },
})
export class Panel {
  readonly heading = input('');
}
