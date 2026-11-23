import { Component } from '@angular/core';
import { baseStats } from '../../../../core/constants/base-lists';
import { MAX_POTS } from '../shared/unit-loader';
import { StatePanel } from '../shared/state-panel';
import { Button } from '../../../shared/components/button/button';
import { Icon } from '../../../shared/components/icon/icon';
import { InputGroup } from '../../../shared/components/input-group/input-group';
import { NumberField } from '../../../shared/components/number-field/number-field';
import { STRINGS } from '../../../strings/en';

/** The base stats of the unit, with the pots, the buffs and the limit break rates. */
@Component({
  imports: [Button, Icon, InputGroup, NumberField],
  selector: 'app-unit-stats',
  templateUrl: './unit-stats.html',
  styleUrl: './unit-stats.css',
})
export class UnitStats extends StatePanel {
  protected readonly t = STRINGS.unitStats;
  /** The order of the old page: two by line. */
  protected readonly mainStats = ['hp', 'mp', 'atk', 'mag', 'def', 'spr'].filter((stat) => baseStats.includes(stat));

  /** The values of the unit that are not a stat: the LB rates, the mitigations, draw attacks and LB damage. */
  protected readonly rows = [
    { key: 'lbFill', label: STRINGS.unitStats.lbGaugeFillRate, suffix: '%' },
    { key: 'lbShards', label: STRINGS.unitStats.expectedLbShardsPer, suffix: '' },
    { key: 'physical', label: STRINGS.unitStats.physicalMitigation, suffix: '%' },
    { key: 'magical', label: STRINGS.unitStats.magicalMitigation, suffix: '%' },
    { key: 'global', label: STRINGS.unitStats.globalMitigation, suffix: '%' },
    { key: 'drawAttacks', label: STRINGS.unitStats.drawAttacks, suffix: '%' },
    { key: 'lbDamage', label: STRINGS.unitStats.lbDamage, suffix: '%' },
  ];

  protected rowValue(key: string): string {
    if (key === 'lbFill') return this.s.lbFillRate();
    if (key === 'lbShards') return this.s.lbShards();
    if (key === 'drawAttacks') return this.s.drawAttacks();
    if (key === 'lbDamage') return this.s.lbDamage();
    return (this.s.mitigations() as Record<string, string>)[key];
  }

  protected setRow(key: string, value: string): void {
    if (key === 'lbFill') this.s.lbFillRate.set(value);
    else if (key === 'lbShards') this.s.lbShards.set(value);
    else if (key === 'drawAttacks') this.s.drawAttacks.set(value);
    else if (key === 'lbDamage') this.s.lbDamage.set(value);
    else this.s.mitigations.update((mitigations) => ({ ...mitigations, [key]: value }));
    this.s.refresh();
  }

  protected setPot(stat: string, value: string): void {
    const max = Math.floor((this.s.unit()?.stats.pots[stat] ?? 0) * MAX_POTS);
    const number = parseInt(value, 10) || 0;
    this.s.pots.update((pots) => ({ ...pots, [stat]: String(Math.min(number, max)) }));
    this.s.refresh();
  }
  protected potClass(stat: string): string {
    const base = this.s.unit()?.stats.pots[stat] ?? 0;
    const value = parseInt(this.s.pots()[stat], 10) || 0;
    if (value === Math.floor(base * MAX_POTS)) return 'maxDoor';
    if (value > base) return 'door';
    if (value === base) return 'maxPot';
    return value > 0 ? 'poted' : '';
  }
  /** The pot button of a stat: none, the pot of the game, then the pot and the door. */
  protected cyclePot(stat: string): void {
    const base = this.s.unit()?.stats.pots[stat] ?? 0;
    const value = parseInt(this.s.pots()[stat], 10) || 0;
    const max = Math.floor(base * MAX_POTS);
    this.setPot(stat, String(value < base ? max : value < max ? 0 : base));
  }
  protected setBuff(stat: string, value: string): void {
    const max = stat === 'hp' ? 30000 : 99999;
    const number = Math.min(parseInt(value, 10) || 0, max);
    this.s.buffs.update((buffs) => ({ ...buffs, [stat]: number ? String(number) : '' }));
    this.s.refresh();
  }
}
