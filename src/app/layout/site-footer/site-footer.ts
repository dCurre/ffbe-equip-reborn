import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Credits } from '../../shared/components/credits/credits';
import { ServerContext } from '../../shared/services/server-context';
import { STRINGS } from '../../strings/en';

/** The page where the site is supported (Ko-fi). */
export const KO_FI_URL = 'https://ko-fi.com/dcapps';

@Component({
  selector: 'app-site-footer',
  imports: [RouterLink, Credits],
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.css',
})
export class SiteFooter {
  protected readonly t = STRINGS.footer;
  protected readonly koFiUrl = KO_FI_URL;
  protected readonly serverContext = inject(ServerContext);
}
