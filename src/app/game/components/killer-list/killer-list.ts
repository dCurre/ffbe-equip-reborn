import { Component, computed, input } from '@angular/core';
import { killerList } from '../../../../core/constants/base-lists';
import { ValueGroup } from '../value-group/value-group';
import { Icon } from '../../../shared/components/icon/icon';
import { STRINGS } from '../../../strings/en';

export interface KillerEntry {
  name: string;
  physical?: number;
  magical?: number;
}

interface Group {
  races: string[];
  percent: number;
}

/** Killers grouped by value: one line for the physical ones and one for the magical ones (the old `getKillerHtml`). */
@Component({
  selector: 'app-killer-list',
  imports: [ValueGroup, Icon],
  templateUrl: './killer-list.html',
  styleUrl: './killer-list.css',
})
export class KillerList {
  protected readonly t = STRINGS.killerList;
  readonly killers = input<readonly KillerEntry[] | undefined>();
  /** the races to highlight (a search): the groups with one of them are marked `selected` */
  readonly selected = input<{ physical: readonly string[]; magical: readonly string[] } | undefined>();

  protected readonly kinds = ['physical', 'magical'] as const;
  protected readonly groups = computed(() => ({
    physical: this.group('physical'),
    magical: this.group('magical'),
  }));

  protected isSelected(kind: 'physical' | 'magical', races: string[]): boolean {
    return !!this.selected()?.[kind].some((race) => races.includes(race));
  }

  /** The races that share a value go together; the biggest values come first. */
  private group(kind: 'physical' | 'magical'): Group[] {
    const racesByValue = new Map<number, string[]>();
    for (const race of killerList) {
      const value = this.killers()?.find((killer) => killer.name === race)?.[kind];
      if (value) racesByValue.set(value, [...(racesByValue.get(value) ?? []), race]);
    }
    return [...racesByValue.keys()]
      .sort((a, b) => b - a)
      .map((percent) => ({ percent, races: racesByValue.get(percent)! }));
  }
}
