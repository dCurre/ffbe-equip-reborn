import { Component, input, output } from '@angular/core';
import { esperSprite, EsperInfo, OwnedEsper } from '../esper-model';

/** One tab per Esper, with the picture of the Esper (dimmed when it is not owned), and the tab of the stats of all of them. */
@Component({
  selector: 'app-esper-tabs',
  templateUrl: './esper-tabs.html',
  styleUrl: './esper-tabs.css',
})
export class EsperTabs {
  readonly espers = input.required<EsperInfo[]>();
  readonly owned = input.required<Record<string, OwnedEsper>>();
  readonly tab = input.required<string>();
  readonly selected = output<string>();

  protected readonly sprite = esperSprite;
}
