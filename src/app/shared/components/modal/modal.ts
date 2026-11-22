import { Component, effect, ElementRef, input, model, viewChild } from '@angular/core';
import { Icon } from '../../../shared/components/icon/icon';
import { Button } from '../button/button';

/** A dialog box (the old Bootstrap modal) on the native `<dialog>`: `[(open)]`, a title, the body and an optional footer (`modalFooter`). */
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
