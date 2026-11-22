import { Component } from '@angular/core';
import { StatePanel } from '../shared/state-panel';
import { Icon } from '../../../shared/components/icon/icon';

/** The equipment types the unit can use: a click bans one from the build. */
@Component({
  imports: [Icon],
  selector: 'app-unit-equipable',
  templateUrl: './unit-equipable.html',
  styleUrl: './unit-equipable.css',
})
export class UnitEquipable extends StatePanel {
  protected toggleEquipable(type: string): void {
    this.s.build().toogleEquipableType(type);
    this.s.refresh();
  }
}
