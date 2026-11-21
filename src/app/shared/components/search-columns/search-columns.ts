import { Component, input } from '@angular/core';
import { SiteFooter } from '../../../layout/site-footer/site-footer';

/**
 * The two columns of the search pages: the filters (`<div filters>`) and the results (`<div results>`), then the
 * footer under the results. On a phone only one is shown at a time, chosen by `showingResults`.
 */
@Component({
  selector: 'app-search-columns',
  imports: [SiteFooter],
  templateUrl: './search-columns.html',
  styleUrl: './search-columns.css',
})
export class SearchColumns {
  readonly showingResults = input(false);
}
