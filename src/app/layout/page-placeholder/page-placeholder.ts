import { Component } from '@angular/core';
import { SiteFooter } from '../site-footer/site-footer';

/** Stands in for every page that is not migrated yet; each route swaps it for the real page. */
@Component({
  selector: 'app-page-placeholder',
  imports: [SiteFooter],
  templateUrl: './page-placeholder.html',
  styleUrl: './page-placeholder.css',
})
export class PagePlaceholder {}
