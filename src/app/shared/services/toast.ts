import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  text: string;
  kind: 'success' | 'warn' | 'error';
}

/** Short messages at the bottom right (the old `$.notify`); each one disappears after a few seconds. */
@Injectable({ providedIn: 'root' })
export class Toast {
  readonly messages = signal<readonly ToastMessage[]>([]);
  private nextId = 0;

  show(text: string, kind: ToastMessage['kind'] = 'success'): void {
    const id = this.nextId++;
    this.messages.update((list) => [...list, { id, text, kind }]);
    setTimeout(() => this.messages.update((list) => list.filter((m) => m.id !== id)), 4000);
  }
}
