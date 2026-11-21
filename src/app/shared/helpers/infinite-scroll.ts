import { afterRenderEffect, ElementRef, Signal, WritableSignal } from '@angular/core';

/**
 * Long lists are drawn a page at a time: when the `end` marker (a `#end` element after the list) comes into
 * view, `limit` grows by `pageSize` until `total()` rows are shown. Call it in the constructor.
 */
export function showMoreOnScroll(
  end: Signal<ElementRef<HTMLElement> | undefined>,
  limit: WritableSignal<number>,
  total: () => number,
  pageSize: number,
  rootMargin: string,
): void {
  afterRenderEffect((onCleanup) => {
    const marker = end()?.nativeElement;
    if (!marker) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && limit() < total()) limit.update((n) => n + pageSize);
      },
      { rootMargin },
    );
    observer.observe(marker);
    onCleanup(() => observer.disconnect());
  });
}
