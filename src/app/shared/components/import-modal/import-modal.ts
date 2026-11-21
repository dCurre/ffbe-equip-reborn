import { Component, inject, input, model, output } from '@angular/core';
import { Toast } from '../../services/toast';
import { Button } from '../button/button';
import { Modal } from '../modal/modal';

/**
 * The "import from the game" dialog: it reads the chosen JSON file and emits it (`fileLoaded`),
 * the page validates and converts it, then shows the result through `summary` / `messages`.
 */
@Component({
  selector: 'app-import-modal',
  imports: [Modal, Button],
  templateUrl: './import-modal.html',
  styleUrl: './import-modal.css',
})
export class ImportModal {
  readonly heading = input.required<string>();
  readonly open = model(false);
  /** a red warning on top of the dialog */
  readonly warning = input('');
  readonly summary = input('');
  readonly messages = input<string[]>([]);
  readonly fileLoaded = output<unknown>();
  readonly confirmed = output<void>();
  private readonly toast = inject(Toast);

  protected async chooseFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      this.fileLoaded.emit(JSON.parse(await file.text()));
    } catch {
      this.toast.show('The imported file is not in json format', 'error');
    }
  }
}
