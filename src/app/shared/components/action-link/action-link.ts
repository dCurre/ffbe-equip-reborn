import { Component, input } from '@angular/core';
import { Icon, IconName } from '../icon/icon';

/** Where to learn how to export the data from the game: the wiki of the repository (the page is still to be written). */
export const GAME_DATA_URL = 'https://github.com/dCurre/ffbe-equip-reborn/wiki';

/** A link with an icon above the collections: a click handler on it, or an `href` opened in a new tab. The text hides on a phone. */
@Component({
  selector: 'app-action-link',
  imports: [Icon],
  templateUrl: './action-link.html',
  styleUrl: './action-link.css',
})
export class ActionLink {
  readonly icon = input.required<IconName>();
  readonly label = input.required<string>();
  readonly href = input<string>();
}
