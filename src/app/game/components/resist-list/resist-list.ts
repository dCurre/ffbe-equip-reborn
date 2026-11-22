import { Component, computed, inject, input } from '@angular/core';
import { ailmentList, elementList } from '../../../../core/constants';
import { Sprites } from '../../../shared/services/sprites';

export interface ResistEntry {
  name: string;
  percent: number;
}

interface Group {
  percent: string;
  names: string[];
}

/** Resistances grouped by value, elements first and then ailments (the old `getResistHtml`). Draws nothing without resistances. */
@Component({
  selector: 'app-resist-list',
  templateUrl: './resist-list.html',
  styleUrl: './resist-list.css',
})
export class ResistList {
  readonly resist = input<readonly ResistEntry[] | undefined>();
  /** the equipment picture shown small over each element / ailment: a shield for resistances, a sword for inflictions */
  readonly icon = input('heavyShield');

  protected readonly elements = computed(() => this.group(elementList));
  protected readonly ailments = computed(() => this.group(ailmentList));

  constructor() {
    inject(Sprites).load('equipments', 'elements', 'ailments');
  }

  private group(allowed: readonly string[]): Group[] {
    const byPercent = new Map<string, string[]>();
    for (const { name, percent } of this.resist() ?? []) {
      if (!allowed.includes(name)) continue;
      const names = byPercent.get(String(percent)) ?? [];
      if (!names.includes(name)) names.push(name);
      byPercent.set(String(percent), names);
    }
    // the same order as the old site: the keys sorted as text, then reversed
    return [...byPercent.keys()]
      .sort()
      .reverse()
      .map((percent) => ({ percent, names: byPercent.get(percent)! }));
  }
}
