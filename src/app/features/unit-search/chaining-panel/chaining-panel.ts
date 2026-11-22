import { Component, computed, model } from '@angular/core';
import { chainFamilySkillName } from '../../../../core/constants/game-ids';
import { Choice, ChoiceGroup } from '../../../shared/components/choice-group/choice-group';
import { FilterHeading } from '../../../shared/components/filter-heading/filter-heading';
import { Panel } from '../../../shared/components/panel/panel';
import { SkillFilter } from '../unit-search-model';

/** Filters the units by the chaining family of their skills and how many times it is cast. */
@Component({
  selector: 'app-chaining-panel',
  imports: [Panel, ChoiceGroup, FilterHeading],
  templateUrl: './chaining-panel.html',
  styleUrls: ['../../../shared/styles/search-page.css', './chaining-panel.css'],
})
export class ChainingPanel {
  readonly skillFilter = model.required<SkillFilter>();

  protected readonly skillTypes: Choice[] = [
    { label: 'Active', value: 'actives' },
    { label: 'LB', value: 'lb' },
  ];
  protected readonly areas: Choice[] = [
    { label: 'ST', value: 'ST' },
    { label: 'AOE', value: 'AOE' },
  ];
  protected readonly families: Choice[] = [
    ...Object.entries(chainFamilySkillName)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([value, name]) => ({ value, label: value, tooltip: `${value} - ${name}` })),
    { value: 'chainTag', label: 'Chain by itself' },
  ];
  protected readonly multicastCounts = [
    { value: '1', label: 'Single cast (1/Any)' },
    { value: '2', label: 'W-cast (2)' },
    { value: '3', label: 'T-cast (3)' },
    { value: '4', label: 'Q-cast (4)' },
    { value: '5', label: 'V-cast (5)' },
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
