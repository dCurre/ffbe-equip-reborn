import { Component } from '@angular/core';
import { StatePanel } from '../shared/state-panel';
import { Icon } from '../../../shared/components/icon/icon';
import { iconInfo } from '../../../shared/components/icon/icon-map';

/** The equipment types the unit can use: a click bans one from the build. */
@Component({
  imports: [Icon],
  selector: 'app-unit-equipable',
  templateUrl: './unit-equipable.html',
  styleUrl: './unit-equipable.css',
})
export class UnitEquipable extends StatePanel {
  /** `<type>` alone when usable, else `<type>: <what is different>`. */
  protected tooltip(entry: { type: string; usable: boolean; banned: boolean; boosted: boolean }): string {
    const name = iconInfo('equipment-' + entry.type)?.title ?? entry.type;
    if (!entry.usable) return `${name}: disabled`;
    if (entry.banned) return `${name}: excluded from build`;
    return entry.boosted ? `${name}: boosts a skill of the unit` : name;
  }

  protected toggleEquipable(type: string): void {
    this.s.build().toogleEquipableType(type);
    this.s.refresh();
  }
}
