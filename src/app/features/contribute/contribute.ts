import { Component } from '@angular/core';
import { PageColumn } from '../../layout/page-column/page-column';
import { PageContent } from '../../layout/page-content/page-content';
import { KO_FI_URL, SiteFooter } from '../../layout/site-footer/site-footer';
import { Button } from '../../shared/components/button/button';
import { Icon } from '../../shared/components/icon/icon';
import { Panel } from '../../shared/components/panel/panel';
import { STRINGS } from '../../strings/en';

/** Contributions are sent as GitHub issues (the site has no server); the forms are in `.github/ISSUE_TEMPLATE`. */
const NEW_ISSUE_URL = 'https://github.com/dCurre/ffbe-equip-reborn/issues/new';

@Component({
  selector: 'app-contribute',
  imports: [PageContent, PageColumn, SiteFooter, Panel, Button, Icon],
  templateUrl: './contribute.html',
  styleUrl: './contribute.css',
})
export class Contribute {
  protected readonly t = STRINGS.contribute;
  protected readonly koFiUrl = KO_FI_URL;
  /** Opens the GitHub "new issue" page in a new tab with the given issue form (`.github/ISSUE_TEMPLATE/<template>`). */
  protected openIssue(template: string): void {
    window.open(`${NEW_ISSUE_URL}?${new URLSearchParams({ template })}`, '_blank', 'noopener');
  }
}
