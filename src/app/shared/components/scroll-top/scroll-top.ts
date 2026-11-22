import { Component, HostListener, signal } from '@angular/core';

/** A round button at the bottom right, shown once the page is scrolled down, that goes back to the top. */
@Component({
  selector: 'app-scroll-top',
  templateUrl: './scroll-top.html',
  styleUrl: './scroll-top.css',
})
export class ScrollTop {
  protected readonly visible = signal(false);
  /** over the round button of the pages that switch between filters and results on a phone */
  protected readonly raised = signal(false);

  @HostListener('window:scroll')
  protected onScroll(): void {
    this.visible.set(window.scrollY > 100);
    this.raised.set(!!document.querySelector('app-results-switch'));
  }

  protected scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
