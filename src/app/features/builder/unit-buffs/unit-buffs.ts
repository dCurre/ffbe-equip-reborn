import { Component } from '@angular/core';
import { elementList, killerList } from '../../../../core/constants/base-lists';
import { StatePanel } from '../shared/state-panel';

/** The killer and element buffs given to the unit. */
@Component({
  selector: 'app-unit-buffs',
  templateUrl: './unit-buffs.html',
  styleUrl: './unit-buffs.css',
})
export class UnitBuffs extends StatePanel {
  protected readonly elements = elementList;
  protected readonly killerNames = killerList;

  protected setKillerBuff(name: string, kind: 'physical' | 'magical', value: string): void {
    this.s.killerBuffs.update((buffs) => ({
      ...buffs,
      [name]: { physical: buffs[name]?.physical ?? '', magical: buffs[name]?.magical ?? '', [kind]: value },
    }));
    this.s.refresh();
  }
  protected setElementBuff(element: string, value: string): void {
    this.s.elementBuffs.update((buffs) => ({ ...buffs, [element]: value }));
    this.s.refresh();
  }
}
