import { Component, computed, inject, input } from '@angular/core';
import { ailmentList, elementList } from '../../../../core/constants/base-lists';
import { Sprites } from '../../../shared/services/sprites';

export interface ResistEntry {
  name: string;
  percent: number;
}

interface Group {
  percent: string;
  bonus: number;
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
  /** the part of each resistance that comes from outside the base value: the total is shown in green */
  readonly bonus = input<readonly ResistEntry[] | undefined>();
  /** the equipment picture shown small over each element / ailment: a shield for resistances, a sword for inflictions */
  readonly icon = input('heavyShield');

  protected readonly elements = computed(() => this.group(elementList));
  protected readonly ailments = computed(() => this.group(ailmentList));

  constructor() {
    inject(Sprites).load('equipments', 'elements', 'ailments');
  }

  private group(allowed: readonly string[]): Group[] {
    const byValue = new Map<string, Group>();
    for (const { name, percent } of this.resist() ?? []) {
      if (!allowed.includes(name)) continue;
      const bonus = this.bonus()?.find((entry) => entry.name === name)?.percent ?? 0;
      const key = `${percent}|${bonus}`;
      const group = byValue.get(key) ?? { percent: String(percent), bonus, names: [] };
      if (!group.names.includes(name)) group.names.push(name);
      byValue.set(key, group);
    }
    // the same order as the old site: the values sorted as text, then reversed
    return [...byValue.keys()]
      .sort()
      .reverse()
      .map((key) => byValue.get(key)!);
  }
}
