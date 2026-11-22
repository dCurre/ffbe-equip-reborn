import { Component, effect, ElementRef, input, model, output, viewChild } from '@angular/core';
import { Icon } from '../../../shared/components/icon/icon';
import { Button } from '../button/button';

/**
 * The only dialog box of the site (the old Bootstrap modal) on the native `<dialog>`: `[(open)]`, a title and the body.
 * The footer is always the same: the buttons given in `modalFooter` (extra actions), then Close (or Cancel when there is an
 * action), then the main action when `confirmLabel` is given (`confirmed` fires; the page decides whether to close).
 */
@Component({
  imports: [Button, Icon],
  selector: 'app-modal',
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class Modal {
  readonly heading = input.required<string>();
  readonly open = model(false);
  /** a large dialog (lists, tables) */
  readonly wide = input(false);
  /** the text of the main action button; without it the dialog only has Close */
  readonly confirmLabel = input('');
  /** the text of the button that closes the dialog (Cancel with an action, Close without) */
  readonly closeLabel = input('');
  /** the main action is destructive (red) */
  readonly danger = input(false);
  readonly confirmed = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.open() && !dialog.open) dialog.showModal();
      else if (!this.open() && dialog.open) dialog.close();
    });
  }

  protected closeOnBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.open.set(false);
  }
}
