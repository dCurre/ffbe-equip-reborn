import { Component, ElementRef, inject, input, model, output, signal, viewChild } from '@angular/core';
import { Toast } from '../../services/toast';
import { GAME_DATA_URL } from '../action-link/action-link';
import { Alert } from '../alert/alert';
import { Modal } from '../modal/modal';

/**
 * The "import from the game" dialog: it reads the chosen JSON file and emits it (`fileLoaded`),
 * the page validates and converts it, then shows the result through `summary` / `messages`.
 */
@Component({
  selector: 'app-import-modal',
  imports: [Alert, Modal],
  templateUrl: './import-modal.html',
  styleUrl: './import-modal.css',
})
export class ImportModal {
  protected readonly gameDataUrl = GAME_DATA_URL;
  readonly heading = input.required<string>();
  readonly open = model(false);
  /** a red warning on top of the dialog */
  readonly warning = input('');
  readonly summary = input('');
  readonly messages = input<string[]>([]);
  readonly fileLoaded = output<unknown>();
  readonly confirmed = output<void>();
  private readonly toast = inject(Toast);

  protected readonly dragging = signal(false);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('file');

  protected chooseFile(event: Event): Promise<void> {
    return this.readFile((event.target as HTMLInputElement).files?.[0]);
  }

  protected dragOver(event: DragEvent): void {
    event.preventDefault(); // without it the browser does not accept the drop
    this.dragging.set(true);
  }

  /** A file dropped on the zone is read like a chosen one, and shown in the field. */
  protected dropped(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragging.set(false);
    const files = event.dataTransfer?.files;
    try {
      if (files?.length) this.fileInput().nativeElement.files = files;
    } catch {
      // only the name shown in the field is lost
    }
    return this.readFile(files?.[0]);
  }

  private async readFile(file: File | undefined): Promise<void> {
    if (!file) return;
    try {
      this.fileLoaded.emit(JSON.parse(await file.text()));
    } catch {
      this.toast.show('The imported file is not in json format', 'error');
    }
  }
}
