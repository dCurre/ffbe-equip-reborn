import { Component, computed, input } from '@angular/core';
import { elementList } from '../../../../core/constants';
import { Choice, ChoiceGroup } from '../../../shared/components/choice-group/choice-group';
import { Panel } from '../../../shared/components/panel/panel';
import type { UnitLoader } from '../shared/unit-loader';
import { StatePanel } from '../shared/state-panel';
import { UnitBuffs } from '../unit-buffs/unit-buffs';
import { UnitEquipable } from '../unit-equipable/unit-equipable';
import { UnitStats } from '../unit-stats/unit-stats';

const ucFirst = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** The unit of the page: its level, enhancements, stats with pots and buffs, and the equipment it can use. */
@Component({
  selector: 'app-unit-panel',
  imports: [Panel, ChoiceGroup, UnitStats, UnitBuffs, UnitEquipable],
  templateUrl: './unit-panel.html',
  styleUrls: ['../shared/form-common.css', './unit-panel.css'],
})
export class UnitPanel extends StatePanel {
  readonly loader = input.required<UnitLoader>();

  protected readonly elementChoices: Choice[] = elementList.map((value) => ({ value, tooltip: ucFirst(value) }));

  protected readonly unitName = computed(() => this.s.unitOptions().find((o) => o.id === this.s.unitId())?.label ?? '');

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
    const unit = this.s.unit();
    if (!unit?.enhancementLevels) return;
    const levels = [...unit.enhancementLevels];
    levels[index] = parseInt((event.target as HTMLSelectElement).value, 10);
    const id = this.s.unitId();
    const data = this.s.units()[id.split('-')[0]];
    if (data) data.enhancementLevels = levels;
    await this.loader().choose(id);
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
