import { booleanAttribute, Component, input } from '@angular/core';

/** A bar that fills from 0 to 100 with the percentage written in it. */
@Component({
  selector: 'app-progress-bar',
  templateUrl: './progress-bar.html',
  styleUrl: './progress-bar.css',
})
export class ProgressBar {
  readonly value = input.required<number>();
  readonly label = input('Progress');
  /** The bar turns sky blue when the work is done. */
  readonly finished = input(false);
  /** A thin bar without the number (the value is somewhere else). */
  readonly compact = input(false, { transform: booleanAttribute });
  /** The bar is red: more than the whole (spent points over the ones available). */
  readonly over = input(false, { transform: booleanAttribute });
}
