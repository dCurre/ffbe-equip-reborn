import { Injectable, signal } from '@angular/core';

/** A page opened from a shared link (`#...`) shows only the content: it hides the page header. */
@Injectable({ providedIn: 'root' })
export class PageChrome {
  readonly headerHidden = signal(false);
}
