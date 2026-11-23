import { Component, computed, inject, input, signal } from '@angular/core';
import { Inventory } from '../../../shared/services/inventory';
import { Icon } from '../../../shared/components/icon/icon';
import { Modal } from '../../../shared/components/modal/modal';
import { Checkbox } from '../../../shared/components/checkbox/checkbox';
import { Button } from '../../../shared/components/button/button';
import { Panel } from '../../../shared/components/panel/panel';
import { ItemListModal } from '../item-list-modal/item-list-modal';
import { StatePanel } from '../shared/state-panel';
import type { ItemActions } from '../shared/item-actions';
import { STRINGS } from '../../../strings/en';

/** Where the items come from, and which are allowed. */
@Component({
  selector: 'app-equipments-panel',
  imports: [Panel, Button, Checkbox, Icon, Modal, ItemListModal],
  templateUrl: './equipments-panel.html',
  styleUrls: ['../shared/form-common.css', './equipments-panel.css'],
})
export class EquipmentsPanel extends StatePanel {
  protected readonly t = STRINGS.equipmentsPanel;
  protected readonly inventory = inject(Inventory);
  readonly items = input.required<ItemActions>();

  protected readonly hintOpen = signal(false);

  protected readonly listKind = signal<'exclude' | 'include'>('exclude');
  protected readonly listOpen = signal(false);
  protected readonly visionCardLevels = Array.from({ length: 10 }, (_, i) => String(i + 1));
  /** The options about the TMR and STMR of the owned units need some owned units. */
  protected readonly hasOwnedUnits = computed(() => Object.keys(this.inventory.units()).length > 0);
}
