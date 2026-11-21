import { Component, input } from '@angular/core';
import { Icon, IconName } from '../icon/icon';

/** Where to learn how to export the data from the game. */
export const GAME_DATA_URL = 'https://new.reddit.com/r/FFBraveExvius/comments/dd8ljd/ffbe_sync_is_back/';

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
