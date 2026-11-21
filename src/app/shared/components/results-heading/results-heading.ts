import { Component, input } from '@angular/core';

/** The heading of the results panel: how many there are (or a hint when no filter is set) and, on the right, the content. */
@Component({
  selector: 'app-results-heading',
  templateUrl: './results-heading.html',
  styleUrl: './results-heading.css',
})
export class ResultsHeading {
  readonly count = input.required<number>();
  /** False while no filter is set: the count is replaced by a hint. */
  readonly filtered = input(true);
}
