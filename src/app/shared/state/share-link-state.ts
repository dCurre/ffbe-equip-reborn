import { signal } from '@angular/core';
import { copyToClipboard } from '../helpers/clipboard';

/** The state of a "link to share" modal: it opens with the link, already copied to the clipboard. */
export class ShareLinkState {
  readonly open = signal(false);
  readonly link = signal('');
  readonly copied = signal(false);

  show(link: string): void {
    this.link.set(link);
    this.copied.set(false);
    this.open.set(true);
    void copyToClipboard(link).then((ok) => this.copied.set(ok));
  }
}
