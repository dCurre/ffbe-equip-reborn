import { Component, input, model, output } from '@angular/core';
import { Modal } from '../modal/modal';

/** A dialog with a read-only text (it selects itself on focus), a Copy button (`copy`) and Close. */
@Component({
  selector: 'app-text-export-modal',
  imports: [Modal],
  templateUrl: './text-export-modal.html',
  styleUrl: './text-export-modal.css',
})
export class TextExportModal {
  readonly heading = input.required<string>();
  readonly open = model(false);
  readonly text = input.required<string>();
  readonly rows = input(12);
  readonly copy = output<void>();

  protected select(event: Event): void {
    (event.target as HTMLTextAreaElement).select();
  }
}
