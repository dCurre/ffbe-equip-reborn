import { Component, input, model } from '@angular/core';
import { Modal } from '../modal/modal';

/** The "Link to…" dialog: a read-only link that selects itself on focus, and a note once it was copied. */
@Component({
  selector: 'app-share-link-modal',
  imports: [Modal],
  templateUrl: './share-link-modal.html',
})
export class ShareLinkModal {
  readonly heading = input.required<string>();
  readonly open = model(false);
  readonly intro = input('');
  readonly link = input.required<string>();
  readonly copied = input(false);

  protected select(event: Event): void {
    (event.target as HTMLInputElement).select();
  }
}
