import { Component, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { Toast } from '../../services/toast';
import { STRINGS } from '../../../strings/en';

/** A zone to choose a JSON file or drop it on: the file is read and emitted already parsed (`fileLoaded`). */
@Component({
  selector: 'app-file-drop',
  templateUrl: './file-drop.html',
  styleUrl: './file-drop.css',
})
export class FileDrop {
  protected readonly t = STRINGS.fileDrop;
  readonly fileLoaded = output<unknown>();
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
      this.toast.show(STRINGS.fileDrop.theImportedFileIs, 'error');
    }
  }
}
