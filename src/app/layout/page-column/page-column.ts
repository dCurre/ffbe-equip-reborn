import { Component, input } from '@angular/core';

/** A column inside `app-page-content` (the old `col-xs-12`, or `col-md-6` with `half`): it narrows on small screens. */
@Component({
  selector: 'app-page-column',
  templateUrl: './page-column.html',
  host: { '[class.half]': 'half()' },
  styleUrls: ['../page-content/page-content.css', './page-column.css'],
})
export class PageColumn {
  /** From 992px the column takes half of the width. */
  readonly half = input(false);
}
