import { Component } from '@angular/core';
import { baseStats } from '../../../../core/constants/base-lists';
import { MAX_POTS } from '../shared/unit-loader';
import { StatePanel } from '../shared/state-panel';

/** The base stats of the unit, with the pots, the buffs and the limit break rates. */
@Component({
  selector: 'app-unit-stats',
  templateUrl: './unit-stats.html',
  styleUrl: './unit-stats.css',
})
export class UnitStats extends StatePanel {
  protected readonly stats = baseStats;

  /** The buffs of the unit that are not a stat: the percents of mitigation, draw attacks and LB damage. */
  protected readonly extras = [
    { key: 'physical', label: 'Phys. mitigation' },
    { key: 'magical', label: 'Mag. mitigation' },
    { key: 'global', label: 'Global mitigation' },
    { key: 'drawAttacks', label: 'Draw attacks' },
    { key: 'lbDamage', label: 'LB damage' },
  ];

  protected extraValue(key: string): string {
    if (key === 'drawAttacks') return this.s.drawAttacks();
    if (key === 'lbDamage') return this.s.lbDamage();
    return (this.s.mitigations() as Record<string, string>)[key];
  }

  protected setExtra(key: string, value: string): void {
    if (key === 'drawAttacks') this.s.drawAttacks.set(value);
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
  protected switchPots(): void {
    const unit = this.s.unit();
    if (!unit) return;
    const values = baseStats.map((stat) => parseInt(this.s.pots()[stat], 10) || 0);
    const max = baseStats.map((stat) => Math.floor(unit.stats.pots[stat] * MAX_POTS));
    let next: number[];
    if (values.every((v) => v === 0)) next = max;
    else if (values.some((v, i) => v < max[i])) next = baseStats.map(() => 0);
    else next = baseStats.map((stat) => unit.stats.pots[stat]);
    this.s.pots.set(Object.fromEntries(baseStats.map((stat, i) => [stat, String(next[i])])));
    this.s.refresh();
  }
  protected setBuff(stat: string, value: string): void {
    const max = stat === 'hp' ? 30000 : 99999;
    const number = Math.min(parseInt(value, 10) || 0, max);
    this.s.buffs.update((buffs) => ({ ...buffs, [stat]: number ? String(number) : '' }));
    this.s.refresh();
  }
}
