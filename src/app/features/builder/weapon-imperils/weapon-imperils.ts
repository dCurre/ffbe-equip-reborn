import { Component, computed, signal } from '@angular/core';
import { weaponList } from '../../../../core/constants/item-types';
import { Button } from '../../../shared/components/button/button';
import { Icon } from '../../../shared/components/icon/icon';
import { InputGroup } from '../../../shared/components/input-group/input-group';
import { NumberField } from '../../../shared/components/number-field/number-field';
import { enemy } from '../shared/build-inputs';
import { StatePanel } from '../shared/state-panel';
import { STRINGS } from '../../../strings/en';

/** The imperils of the enemy for each weapon: a summary of the ones in use, and the inputs behind a button. */
@Component({
  selector: 'app-weapon-imperils',
  imports: [Button, Icon, InputGroup, NumberField],
  templateUrl: './weapon-imperils.html',
  styleUrl: './weapon-imperils.css',
})
export class WeaponImperils extends StatePanel {
  protected readonly t = STRINGS.weaponImperils;
  protected readonly weapons = weaponList;
  protected readonly open = signal(false);

  /** `greatSword` -> `great sword`, as the old titles */
  protected spaced(weapon: string): string {
    return weapon.replace(/([A-Z])/g, ' $1').toLowerCase();
  }

  protected readonly active = computed(() => {
    const imperils = enemy(this.s).imperils;
    return this.weapons.filter((weapon) => imperils[weapon]).map((weapon) => ({ weapon, value: imperils[weapon] }));
  });

  protected set(weapon: string, value: string): void {
    this.s.monsterImperils.update((imperils) => ({ ...imperils, [weapon]: value }));
    this.s.refresh();
  }
}
