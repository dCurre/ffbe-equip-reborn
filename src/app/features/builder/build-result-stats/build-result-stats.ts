import { Component, input } from '@angular/core';
import { KillerList } from '../../../game/components/killer-list/killer-list';
import { ResistList } from '../../../game/components/resist-list/resist-list';
import type { ResultStats } from '../shared/result-stats';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

/** The totals, resists, killers and damage of the best build found. */
@Component({
  selector: 'app-build-result-stats',
  imports: [KillerList, ResistList],
  templateUrl: './build-result-stats.html',
  styleUrl: './build-result-stats.css',
})
export class BuildResultStats {
  readonly result = input.required<ResultStats>();
  readonly goal = input.required<string>();

  protected displayValue(value: any): string {
    if (!value) return '';
    const goal = this.goal();
    const text = (n: number): string => (n < 100 ? String(Math.floor(n * 10) / 10) : Math.floor(n).toLocaleString());
    return value.min === value.max
      ? text(value[goal])
      : `${Math.floor(value.min).toLocaleString()} - ${Math.floor(value.avg).toLocaleString()} - ${Math.floor(value.max).toLocaleString()}`;
  }

  protected resistEntries(): { name: string; percent: number }[] {
    return [...this.result().elementResists, ...this.result().ailmentResists];
  }
}
