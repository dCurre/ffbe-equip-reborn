import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { BannerName, SiteHeader } from './layout/site-header/site-header';
import { PageChrome } from './shared/services/page-chrome';
import { ScrollTop } from './shared/components/scroll-top/scroll-top';
import { Toasts } from './shared/components/toasts/toasts';
import { Inventory } from './shared/services/inventory';
import { Theme, ThemeName } from './shared/services/theme';

@Component({
  imports: [RouterOutlet, ScrollTop, SiteHeader, Toasts],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);
  private readonly theme = inject(Theme); // also applies the saved theme as soon as the app starts
  protected readonly chrome = inject(PageChrome);

  constructor() {
    // as on the old site every page reads the user's data, unless it is a link opened without the account (`?o`)
    const inventory = inject(Inventory);
    if (inventory.withoutAccount) inventory.status.set('notLoaded');
    else inventory.load();
  }

  /** The header text and picture come from the `data` of the active route; the pages without a header have none. */
  protected readonly page = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null), // the route may already be active when the app is created
      map(() => {
        let route = this.router.routerState.snapshot.root;
        while (route.firstChild) route = route.firstChild;
        const { header, banner, theme } = route.data as { header?: string; banner?: BannerName; theme?: ThemeName };
        this.theme.forced.set(theme ?? null);
        return header && banner ? { header, banner } : null;
      }),
    ),
    { initialValue: null },
  );
}
