import { Component, computed, model } from '@angular/core';
import { chainFamilySkillName } from '../../../../core/constants/game-ids';
import { Choice, ChoiceGroup } from '../../../shared/components/choice-group/choice-group';
import { FilterHeading } from '../../../shared/components/filter-heading/filter-heading';
import { Panel } from '../../../shared/components/panel/panel';
import { SkillFilter } from '../unit-search-model';
import { STRINGS } from '../../../strings/en';

/** Filters the units by the chaining family of their skills and how many times it is cast. */
@Component({
  selector: 'app-chaining-panel',
  imports: [Panel, ChoiceGroup, FilterHeading],
  templateUrl: './chaining-panel.html',
  styleUrls: ['../../../shared/styles/search-page.css', './chaining-panel.css'],
})
export class ChainingPanel {
  protected readonly t = STRINGS.chainingPanel;
  readonly skillFilter = model.required<SkillFilter>();

  protected readonly skillTypes: Choice[] = [
    { label: STRINGS.chainingPanel.active, value: 'actives' },
    { label: STRINGS.chainingPanel.lb, value: 'lb' },
  ];
  protected readonly areas: Choice[] = [
    { label: STRINGS.chainingPanel.st, value: 'ST' },
    { label: STRINGS.chainingPanel.aoe, value: 'AOE' },
  ];
  protected readonly families: Choice[] = [
    ...Object.entries(chainFamilySkillName)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([value, name]) => ({ value, label: value, tooltip: `${value} - ${name}` })),
    { value: 'chainTag', label: STRINGS.chainingPanel.chainByItself },
  ];
  protected readonly multicastCounts = [
    { value: '1', label: STRINGS.chainingPanel.singleCast1Any },
    { value: '2', label: STRINGS.chainingPanel.wCast2 },
    { value: '3', label: STRINGS.chainingPanel.tCast3 },
    { value: '4', label: STRINGS.chainingPanel.qCast4 },
    { value: '5', label: STRINGS.chainingPanel.vCast5 },
  ];

  protected readonly family = computed(() => [this.skillFilter().chainFamily]);

  protected change(change: Partial<SkillFilter>): void {
    this.skillFilter.update((filter) => ({ ...filter, ...change }));
  }

  protected chooseFamily(chainFamily: string): void {
    this.change({ chainFamily, multicastCount: chainFamily === 'none' ? 1 : this.skillFilter().multicastCount });
  }

  protected chooseMulticast(count: string): void {
    const multicastCount = parseInt(count, 10);
    this.change({
      multicastCount,
      excludeUnlockedMulticast: multicastCount > 1 && this.skillFilter().excludeUnlockedMulticast,
    });
  }
}
