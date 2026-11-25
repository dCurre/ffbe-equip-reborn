import { Component, computed, input } from '@angular/core';
import { killerList } from '../../../../core/constants/base-lists';
import { IconTile } from '../../../shared/components/icon-tile/icon-tile';
import type { ResultStats } from '../shared/result-stats';
import { STRINGS } from '../../../strings/en';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

/** The totals, resists, killers and damage of the best build found. */
@Component({
  selector: 'app-build-result-stats',
  imports: [IconTile],
  templateUrl: './build-result-stats.html',
  styleUrl: './build-result-stats.css',
})
export class BuildResultStats {
  protected readonly t = STRINGS.buildResultStats;
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

  /** The killers of the build, one tile for each race that has some: the physical ones, then the magical ones. */
  protected readonly killerRows = computed(() =>
    (['physical', 'magical'] as const).map((kind) => ({
      kind,
      tiles: killerList.flatMap((name) => {
        const killer = this.result().killers.find((entry) => entry.name === name);
        const normal = killer?.[kind] ?? 0;
        const limit = killer?.[kind === 'physical' ? 'limitPhysical' : 'limitMagical'] ?? 0;
        return normal + limit ? [{ name, normal, limit, value: normal + limit }] : [];
      }),
    })),
  );

  protected whole(n: number): string {
    return Math.floor(n).toLocaleString();
  }
}
