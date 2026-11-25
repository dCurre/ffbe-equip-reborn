import { Component, input, output } from '@angular/core';
import { EsperInfo, OwnedEsper } from '../esper-model';
import { Icon } from '../../../shared/components/icon/icon';
import { STRINGS } from '../../../strings/en';
import { esperIcon } from '../../../game/helpers/esper-icon';

/** One tab per Esper, with the picture of the Esper (dimmed when it is not owned), and the tab of the stats of all of them. */
@Component({
  imports: [Icon],
  selector: 'app-esper-tabs',
  templateUrl: './esper-tabs.html',
  styleUrl: './esper-tabs.css',
})
export class EsperTabs {
  protected readonly t = STRINGS.esperTabs;
  readonly espers = input.required<EsperInfo[]>();
  readonly owned = input.required<Record<string, OwnedEsper>>();
  readonly tab = input.required<string>();
  readonly selected = output<string>();

  protected readonly icon = esperIcon;
}
