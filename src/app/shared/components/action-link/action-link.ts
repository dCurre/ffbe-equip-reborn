import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ServerContext } from '../../services/server-context';
import { Icon, IconName } from '../icon/icon';

/** Where to learn how to export the data from the game and import it here: a page of the wiki of the repository. */
export const GAME_DATA_URL = 'https://github.com/dCurre/ffbe-equip-reborn/wiki/Export-and-import-data';

/** A link with an icon above the collections: a click handler on it, a page of the site (`route`) or an `href` opened in a new tab. The text hides on a phone. */
@Component({
  selector: 'app-action-link',
  imports: [Icon, RouterLink],
  templateUrl: './action-link.html',
  styleUrl: './action-link.css',
})
export class ActionLink {
  readonly icon = input.required<IconName>();
  readonly label = input.required<string>();
  readonly href = input<string>();
  /** A page of the site, such as `/data-import`: the server stays chosen. */
  readonly route = input<string>();
  protected readonly serverContext = inject(ServerContext);
}
