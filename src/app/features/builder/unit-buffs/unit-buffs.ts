import { Component, computed, signal } from '@angular/core';
import { elementList, killerList } from '../../../../core/constants/base-lists';
import { Button } from '../../../shared/components/button/button';
import { Icon } from '../../../shared/components/icon/icon';
import { IconTile } from '../../../shared/components/icon-tile/icon-tile';
import { InputGroup } from '../../../shared/components/input-group/input-group';
import { NumberField } from '../../../shared/components/number-field/number-field';
import { StatePanel } from '../shared/state-panel';
import { STRINGS } from '../../../strings/en';

const MAX_KILLER = 300;

/** The killer and element buffs given to the unit: the killers behind a button (a summary while it is closed), the elements always. */
@Component({
  imports: [Button, Icon, IconTile, InputGroup, NumberField],
  selector: 'app-unit-buffs',
  templateUrl: './unit-buffs.html',
  styleUrl: './unit-buffs.css',
})
export class UnitBuffs extends StatePanel {
  protected readonly t = STRINGS.unitBuffs;
  protected readonly elements = elementList;
  protected readonly killerNames = killerList;
  protected readonly kinds = ['physical', 'magical'] as const;
  protected readonly open = signal(false);

  /** The killer buffs with a value, to show while the inputs are closed. */
  protected readonly summary = computed(() =>
    this.kinds.flatMap((kind) =>
      killerList.flatMap((name) => {
        const value = parseInt(this.s.killerBuffs()[name]?.[kind] ?? '', 10);
        return value > 0 ? [{ kind, name, value }] : [];
      }),
    ),
  );

  protected ucFirst(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  protected setKillerBuff(name: string, kind: 'physical' | 'magical', value: string): void {
    // the game takes at most 300%
    const text = parseInt(value, 10) > MAX_KILLER ? String(MAX_KILLER) : value;
    this.s.killerBuffs.update((buffs) => ({
      ...buffs,
      [name]: { physical: buffs[name]?.physical ?? '', magical: buffs[name]?.magical ?? '', [kind]: text },
    }));
    this.s.refresh();
  }
  protected setElementBuff(element: string, value: string): void {
    this.s.elementBuffs.update((buffs) => ({ ...buffs, [element]: value }));
    this.s.refresh();
  }
}
