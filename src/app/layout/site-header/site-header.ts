import { Component, computed, inject, input, signal } from '@angular/core';
import { Button } from '../../shared/components/button/button';
import { Alert } from '../../shared/components/alert/alert';
import { Modal } from '../../shared/components/modal/modal';
import { Icon } from '../../shared/components/icon/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { GoogleDrive } from '../../shared/services/google-drive';
import { Inventory } from '../../shared/services/inventory';
import { Language, LANGUAGES, ServerContext } from '../../shared/services/server-context';
import { Theme } from '../../shared/services/theme';
import { STRINGS } from '../../strings/en';

export type BannerName =
  'Sakura' | 'Lasswell' | 'Jake' | 'Rain' | 'Nichol' | 'Lid' | 'Fina' | 'MogChocobo' | 'Charlotte';

/** Left padding of the title (px) so it clears the character picture: wide screens, up to 991px, up to 768px. */
const BANNER_PADDING: Record<BannerName, [number, number, number]> = {
  Sakura: [350, 290, 260],
  Lasswell: [300, 240, 210],
  Jake: [360, 300, 270],
  Rain: [340, 280, 250],
  Nichol: [330, 270, 240],
  Lid: [325, 265, 235],
  Fina: [330, 270, 240],
  MogChocobo: [310, 270, 240],
  Charlotte: [330, 270, 240],
};

/** Vertical position of each flag in the `img/icons/languages.png` sprite (16px tall flags). */
const FLAG_POSITION: Record<Language, number> = { en: -596, zh: -1156, ko: -820, fr: -660, de: -564, es: -612 };

const MENU = [
  { path: '/', label: STRINGS.siteHeader.home },
  { path: '/builder', label: STRINGS.siteHeader.unitBuilder },
  { path: '/encyclopedia', label: STRINGS.siteHeader.encyclopedia },
  { path: '/unitSearch', label: STRINGS.siteHeader.unitSearch },
  { path: '/inventory', label: STRINGS.siteHeader.myInventory },
  { path: '/units', label: STRINGS.siteHeader.myUnits },
  { path: '/espers', label: STRINGS.siteHeader.myEspers },
  { path: '/data-import', label: STRINGS.siteHeader.dataImport },
  { path: '/contribute', label: STRINGS.siteHeader.contribute },
];

/** Page title, menu, login status, theme, language buttons: the old `layout.js` header. */
@Component({
  selector: 'app-site-header',
  imports: [Alert, RouterLink, RouterLinkActive, Button, Icon, Modal],
  templateUrl: './site-header.html',
  styleUrl: './site-header.css',
})
export class SiteHeader {
  protected readonly t = STRINGS.siteHeader;
  readonly title = input.required<string>();
  readonly banner = input.required<BannerName>();

  protected readonly menu = MENU;
  protected readonly languages = LANGUAGES;
  protected readonly serverContext = inject(ServerContext);
  protected readonly theme = inject(Theme);
  private readonly drive = inject(GoogleDrive);
  protected readonly inventory = inject(Inventory);

  protected readonly loggedIn = this.drive.loggedIn;
  protected readonly menuOpen = signal(false);
  protected readonly loginError = signal('');
  protected readonly loginOpen = signal(false);

  protected readonly bannerPersonImage = computed(() => `url(img/banner/${this.banner()}.png)`);
  protected readonly bannerBlankImage = computed(
    () => `url(img/banner/banner_blank${this.theme.current() === 'dark' ? '_dark' : ''}.png)`,
  );
  protected readonly bannerPadding = computed(() => {
    const [wide, medium, small] = BANNER_PADDING[this.banner()];
    return {
      '--title-padding': `${wide}px`,
      '--title-padding-medium': `${medium}px`,
      '--title-padding-small': `${small}px`,
    };
  });

  protected flagPosition(language: Language): string {
    return `0 ${FLAG_POSITION[language]}px`;
  }

  protected chooseTheme(event: Event): void {
    this.theme.current.set((event.target as HTMLSelectElement).value === 'light' ? 'light' : 'dark');
  }

  protected openLoginDialog(): void {
    this.loginError.set('');
    this.loginOpen.set(true);
  }

  /** Runs inside the click, so the browser allows the Google login popup; the page reloads to load the user data. */
  protected login(): void {
    this.drive.login().then(
      () => window.location.reload(),
      (error: Error) => this.loginError.set(error.message),
    );
  }

  protected logout(): void {
    this.drive.logout();
    window.location.reload();
  }
}
