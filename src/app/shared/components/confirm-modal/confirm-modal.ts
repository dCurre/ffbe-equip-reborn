import { Component, input, model, output } from '@angular/core';
import { Button } from '../button/button';
import { Modal } from '../modal/modal';

/** A yes/no dialog: the question goes inside, `confirmed` fires on the action button (`danger` makes it red). */
@Component({
  selector: 'app-confirm-modal',
  imports: [Modal, Button],
  templateUrl: './confirm-modal.html',
  styleUrl: './confirm-modal.css',
})
export class ConfirmModal {
  readonly heading = input.required<string>();
  readonly open = model(false);
  readonly confirmLabel = input.required<string>();
  readonly danger = input(false);
  readonly confirmed = output<void>();
}
