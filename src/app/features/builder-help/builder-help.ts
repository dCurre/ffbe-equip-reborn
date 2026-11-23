import { Component } from '@angular/core';
import { SiteFooter } from '../../layout/site-footer/site-footer';
import { PageColumn } from '../../layout/page-column/page-column';
import { PageContent } from '../../layout/page-content/page-content';
import { STRINGS } from '../../strings/en';

/** How to write a custom goal and simulate unit skills in the builder: collapsible sections (native `<details>`). */
@Component({
  selector: 'app-builder-help',
  imports: [PageContent, PageColumn, SiteFooter],
  templateUrl: './builder-help.html',
  styleUrl: './builder-help.css',
})
export class BuilderHelp {
  protected readonly t = STRINGS.builderHelp;
}
