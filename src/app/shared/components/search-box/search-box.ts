import { Component, ElementRef, input, OnInit, output, signal, viewChild } from '@angular/core';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';
import { STRINGS } from '../../../strings/en';

/**
 * The search field of a page: a magnifier, a clear button when there is text.
 * `(search)` gives the text 300 ms after the last key, so a page does not redraw at every key; `clear()` empties it at once.
 */
@Component({
  selector: 'app-search-box',
  imports: [Button, Icon],
  templateUrl: './search-box.html',
  styleUrl: './search-box.css',
})
export class SearchBox implements OnInit {
  protected readonly t = STRINGS.searchBox;
  readonly placeholder = input('Search');
  /** the text the box starts with (a search restored from a link); later changes of it are ignored */
  readonly initial = input('');
  readonly search = output<string>();
  protected readonly text = signal('');
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  private timer: ReturnType<typeof setTimeout> | undefined;

  ngOnInit(): void {
    this.text.set(this.initial());
  }

  protected type(value: string): void {
    this.text.set(value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.search.emit(value), 300);
  }

  /** Empties the field, puts the cursor back in it and tells the page at once. */
  clear(): void {
    clearTimeout(this.timer);
    this.text.set('');
    const input = this.field().nativeElement;
    input.value = '';
    input.focus();
    this.search.emit('');
  }
}
