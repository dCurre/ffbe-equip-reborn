import { Component, computed, ElementRef, input, model, output, signal, viewChild } from '@angular/core';
import { Icon } from '../icon/icon';

/** A dropdown with a field: click to see every option, type to keep the ones that contain the text, click or Enter to choose. */
@Component({
  selector: 'app-combobox',
  imports: [Icon],
  host: { '(document:click)': 'open.set(false)', '(click)': '$event.stopPropagation()' },
  templateUrl: './combobox.html',
  styleUrl: './combobox.css',
})
export class Combobox {
  readonly options = input.required<readonly string[]>();
  /** the option chosen; '' is the empty choice, shown as `emptyLabel` */
  readonly value = model('');
  readonly emptyLabel = input('Custom');
  readonly picked = output<string>();
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly shown = computed(() => {
    const text = this.query().trim().toLowerCase();
    return text ? this.options().filter((o) => o.toLowerCase().includes(text)) : this.options();
  });

  /** Puts the cursor in the field: the options open, as when it is clicked. */
  focus(): void {
    this.field()?.nativeElement.focus();
  }

  protected show(field: HTMLInputElement): void {
    this.query.set('');
    this.open.set(true);
    field.select();
  }

  protected type(text: string): void {
    this.query.set(text);
    this.open.set(true);
  }

  protected pick(option: string): void {
    this.open.set(false);
    this.value.set(option);
    this.picked.emit(option);
  }
}
