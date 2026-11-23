import { Component, computed, inject, input, viewChild } from '@angular/core';
import { baseStats, elementList } from '../../../../core/constants/base-lists';
import { MAX_POTS } from '../shared/unit-loader';
import { Choice, ChoiceGroup } from '../../../shared/components/choice-group/choice-group';
import { Button } from '../../../shared/components/button/button';
import { Combobox } from '../../../shared/components/combobox/combobox';
import { Panel } from '../../../shared/components/panel/panel';
import { wikiUrl } from '../../../shared/helpers/wiki';
import { ServerContext } from '../../../shared/services/server-context';
import type { UnitLoader } from '../shared/unit-loader';
import { StatePanel } from '../shared/state-panel';
import { UnitBuffs } from '../unit-buffs/unit-buffs';
import { UnitEquipable } from '../unit-equipable/unit-equipable';
import { UnitStats } from '../unit-stats/unit-stats';
import { Icon } from '../../../shared/components/icon/icon';

const ucFirst = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** The unit of the page: its level, enhancements, stats with pots and buffs, and the equipment it can use. */
@Component({
  selector: 'app-unit-panel',
  imports: [
    Button,
    Combobox,
    Panel,
    ChoiceGroup,
    UnitStats,
    UnitBuffs,
    UnitEquipable,
    Icon,
  ],
  templateUrl: './unit-panel.html',
  styleUrls: ['../shared/form-common.css', './unit-panel.css'],
})
export class UnitPanel extends StatePanel {
  readonly loader = input.required<UnitLoader>();
  /** `choose`: the line to choose the unit (inside the card of the goal); `details`: its panel with the stats */
  readonly part = input<'choose' | 'details'>('details');
  private readonly unitList = viewChild(Combobox);

  /** Opens the list to choose the unit. */
  focusUnit(): void {
    this.unitList()?.focus();
  }

  /** The levels above 100 (the core scales the stats between 100 and 130). */
  protected readonly levels = Array.from({ length: 30 }, (_, i) => String(130 - i));

  private readonly server = inject(ServerContext);

  protected wikiUrl(): string {
    const unit = this.s.unit();
    return unit ? wikiUrl(unit['wikiEntry'] ?? unit.name, this.server.server()) : '';
  }

  /** From EX+0 to the highest level of the unit. */
  protected readonly exLevels = computed(() =>
    Array.from({ length: (this.s.unit()?.exAwakening?.length ?? 3) + 1 }, (_, i) => String(i)),
  );

  protected stars(rarity: string | number): string {
    return '☆'.repeat(Number(rarity));
  }

  protected readonly elementChoices: Choice[] = elementList.map((value) => ({ value, tooltip: ucFirst(value) }));

  protected readonly unitName = computed(() => this.s.unitOptions().find((o) => o.id === this.s.unitId())?.label ?? '');

  protected readonly unitNames = computed(() => this.s.unitOptions().map((o) => o.label));

  protected chooseUnitByName(name: string): void {
    const option = this.s.unitOptions().find((o) => o.label === name);
    if (option) this.loader().choose(option.id);
  }

  protected enhancementOptions(index: number): { value: number; label: string }[] {
    const enhancement = this.s.unit()?.enhancements?.[index];
    if (!enhancement) return [];
    const levels = enhancement.levels;
    return levels.map((_, j) => {
      let label: string;
      if (levels.length === 2 && levels[0].length === 0) label = `${enhancement.name} ${j === 0 ? 'not ' : ''}unlocked`;
      else if (levels.length === 4 && levels[0].length === 0)
        label =
          j === 0 ? `${enhancement.name} not unlocked` : j === 1 ? enhancement.name : `${enhancement.name} +${j - 1}`;
      else label = `${enhancement.name} +${j}`;
      return { value: j, label };
    });
  }

  protected async changeEnhancement(index: number, event: Event): Promise<void> {
    if (!this.s.unit()?.enhancementLevels) return;
    await this.loader().setEnhancement(index, parseInt((event.target as HTMLSelectElement).value, 10));
  }

  /** The pots button: none, all, or the pots of the game. */
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

  protected setLevel(value: string): void {
    this.s.level.set(value);
    this.s.build().level = parseInt(value, 10);
    this.afterUnitChange();
  }

  protected setExLevel(value: string): void {
    this.s.exLevel.set(value);
    this.s.build().setExAwakeningLevel(parseInt(value, 10));
    this.afterUnitChange();
  }

  private afterUnitChange(): void {
    this.s.recalculateApplicableSkills();
    this.s.refresh();
  }
}
