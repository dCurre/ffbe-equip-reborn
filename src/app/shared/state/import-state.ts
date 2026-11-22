import { signal } from '@angular/core';

/** The state of an import modal: what the chosen file would import, and the messages about it. */
export class ImportState {
  readonly open = signal(false);
  readonly summary = signal('');
  readonly messages = signal<string[]>([]);

  /** Opens the modal with nothing chosen yet. */
  start(): void {
    this.summary.set('');
    this.messages.set([]);
    this.open.set(true);
  }
}
