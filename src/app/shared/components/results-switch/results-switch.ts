import { Component, input, model } from '@angular/core';

/** On a phone only the filters or the results are shown: a round button to switch (`[(showingResults)]`) and the icons of the active filters. */
@Component({
  selector: 'app-results-switch',
  templateUrl: './results-switch.html',
  styleUrl: './results-switch.css',
})
export class ResultsSwitch {
  readonly showingResults = model(false);
  /** the classes of the icons of the active filters */
  readonly icons = input<string[]>([]);
  /** shows the killer icon after the others */
  readonly killers = input(false);

  protected toggle(): void {
    window.scrollTo(0, 0);
    this.showingResults.update((v) => !v);
  }
}
