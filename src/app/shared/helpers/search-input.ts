import { ElementRef } from '@angular/core';

/** Runs the last action asked, `ms` after the last call: the pages search while typing without redrawing at every key. */
export function debouncer(ms = 300): (action: () => void) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (action) => {
    clearTimeout(timer);
    timer = setTimeout(action, ms);
  };
}

/** Empties the search box of a page and puts the cursor back in it. */
export function clearSearchBox(box: ElementRef<HTMLInputElement> | undefined): void {
  const input = box?.nativeElement;
  if (input) {
    input.value = '';
    input.focus();
  }
}
