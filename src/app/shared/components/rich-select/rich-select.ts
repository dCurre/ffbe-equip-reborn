import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, ElementRef, inject, input, model, output, signal } from '@angular/core';
import { Icon } from '../icon/icon';
import { STRINGS } from '../../../strings/en';

/** An option of the select: a picture and a tag are optional. `tagKind` colors the tag (`damage`, `stat`, `lb`, `skill`, `magic`, `multicast`, `unsupported`). */
export interface RichOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: string;
  tag?: string;
  tagKind?: string;
  /** a small sign after the label (a star), with what it means as `markTitle` */
  mark?: string;
  markTitle?: string;
}

/** A dropdown whose options have a picture and a tag; it has a search field in the list. `[(value)]` is the option chosen. */
@Component({
  selector: 'app-rich-select',
  imports: [Icon, NgTemplateOutlet],
  host: { '(document:click)': 'close($event)' },
  templateUrl: './rich-select.html',
  styleUrl: './rich-select.css',
})
export class RichSelect {
  protected readonly t = STRINGS.richSelect;
  readonly options = input.required<readonly RichOption[]>();
  readonly value = model('');
  readonly placeholder = input('Select...');
  readonly picked = output<string>();
  protected readonly open = signal(false);
  protected readonly query = signal('');
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  protected readonly current = computed(() => this.options().find((option) => option.value === this.value()));
  protected readonly shown = computed(() => {
    const text = this.query().trim().toLowerCase();
    return text ? this.options().filter((option) => option.label.toLowerCase().includes(text)) : this.options();
  });

  protected toggle(): void {
    this.query.set('');
    this.open.set(!this.open());
    if (this.open()) setTimeout(() => this.scrollToSelected());
  }

  /** The list opens with the chosen option in the middle (not from the first one). */
  private scrollToSelected(): void {
    const list = this.host.querySelector<HTMLElement>('ul');
    const selected = this.host.querySelector<HTMLElement>('li a.selected');
    if (!list || !selected) return;
    const offset = selected.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
    list.scrollTop = offset - (list.clientHeight - selected.clientHeight) / 2;
  }

  protected close(event: Event): void {
    if (!this.host.contains(event.target as Node)) this.open.set(false);
  }

  protected pick(option: RichOption): void {
    if (option.disabled) return;
    this.open.set(false);
    this.value.set(option.value);
    this.picked.emit(option.value);
  }
}
