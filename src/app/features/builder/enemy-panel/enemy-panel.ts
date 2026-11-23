import { Component, computed } from '@angular/core';
import { elementList } from '../../../../core/constants/base-lists';
import { Choice, ChoiceGroup } from '../../../shared/components/choice-group/choice-group';
import { Icon } from '../../../shared/components/icon/icon';
import { InputGroup } from '../../../shared/components/input-group/input-group';
import { NumberField } from '../../../shared/components/number-field/number-field';
import { Panel } from '../../../shared/components/panel/panel';
import { enemy } from '../shared/build-inputs';
import { fieldTone } from '../shared/field-tone';
import { MonsterAttack } from '../monster-attack/monster-attack';
import { MonsterList } from '../monster-list/monster-list';
import { StatePanel } from '../shared/state-panel';
import { WeaponImperils } from '../weapon-imperils/weapon-imperils';
import { Button } from '../../../shared/components/button/button';
import { STRINGS } from '../../../strings/en';

const RACES = [
  'aquatic',
  'beast',
  'bird',
  'bug',
  'demon',
  'dragon',
  'human',
  'machine',
  'plant',
  'undead',
  'stone',
  'spirit',
];
const ucFirst = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** The stats, races, resistances and imperils of the enemy. */
@Component({
  selector: 'app-enemy-panel',
  imports: [Panel, ChoiceGroup, Icon, InputGroup, NumberField, MonsterList, WeaponImperils, MonsterAttack, Button],
  templateUrl: './enemy-panel.html',
  styleUrls: ['../shared/form-common.css', './enemy-panel.css'],
})
export class EnemyPanel extends StatePanel {
  protected readonly t = STRINGS.enemyPanel;
  protected readonly stats = ['atk', 'def', 'mag', 'spr'];
  protected readonly elements = elementList;
  protected readonly raceChoices: Choice[] = RACES.map((value) => ({ value, label: ucFirst(value) }));
  protected readonly tone = fieldTone;
  protected readonly ucFirst = ucFirst;

  /** A break or imperil below 0 buffs the enemy: usually a mistake. */
  protected readonly negativeValues = computed(() => {
    const foe = enemy(this.s);
    return (
      Object.values<number>(foe.breaks).some((value) => value < 0) ||
      Object.values<number>(foe.imperils).some((value) => value < 0)
    );
  });

  protected setMonsterStat(stat: string, value: string): void {
    this.s.monster.update((m) => ({ ...m, [stat]: value }));
    this.s.refresh();
  }

  protected setStatField(field: 'monsterBreaks' | 'monsterBuffs', stat: string, value: string): void {
    this.s[field].update((values) => ({ ...values, [stat]: value }));
    this.s.refresh();
  }

  protected toggleBreakability(stat: string): void {
    const allowed = !this.s.monsterBreakability()[stat];
    this.s.monsterBreakability.update((values) => ({ ...values, [stat]: allowed }));
    if (!allowed) this.s.monsterBreaks.update((values) => ({ ...values, [stat]: '' }));
    this.s.refresh();
  }

  protected setMonsterResist(element: string, value: string): void {
    this.s.monsterResists.update((r) => ({ ...r, [element]: value }));
    this.s.refresh();
  }

  protected setMonsterImperil(element: string, value: string): void {
    this.s.monsterImperils.update((r) => ({ ...r, [element]: value }));
    this.s.refresh();
  }
}
