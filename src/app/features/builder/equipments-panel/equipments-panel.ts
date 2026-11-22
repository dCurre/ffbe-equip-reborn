import { Component, computed, inject, input } from '@angular/core';
import { Inventory } from '../../../shared/services/inventory';
import { Button } from '../../../shared/components/button/button';
import { Panel } from '../../../shared/components/panel/panel';
import { StatePanel } from '../shared/state-panel';
import type { ItemActions } from '../shared/item-actions';

/** Where the items come from, and which are allowed. */
@Component({
  selector: 'app-equipments-panel',
  imports: [Panel, Button],
  templateUrl: './equipments-panel.html',
  styleUrls: ['../shared/form-common.css', './equipments-panel.css'],
})
export class EquipmentsPanel extends StatePanel {
  protected readonly inventory = inject(Inventory);
  readonly items = input.required<ItemActions>();

  protected readonly visionCardLevels = Array.from({ length: 10 }, (_, i) => String(i + 1));
  /** The options about the TMR and STMR of the owned units need some owned units. */
  protected readonly hasOwnedUnits = computed(() => Object.keys(this.inventory.units()).length > 0);
}
