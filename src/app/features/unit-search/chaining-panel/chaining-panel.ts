import { Component, model } from '@angular/core';
import { chainFamilySkillName } from '../../../../core/constants/game-ids';
import { Choice, ChoiceGroup } from '../../../shared/components/choice-group/choice-group';
import { Panel } from '../../../shared/components/panel/panel';
import { SkillFilter } from '../unit-search-model';

/** Filters the units by the chaining family of their skills and how many times it is cast. */
@Component({
  selector: 'app-chaining-panel',
  imports: [Panel, ChoiceGroup],
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
  protected readonly families = Object.keys(chainFamilySkillName)
    .sort()
    .map((id) => ({ id, label: `${id} - ${(chainFamilySkillName as Record<string, string>)[id]}` }));
  protected readonly multicastCounts = [
    ['1', 'Single cast (1/Any)'],
    ['2', 'W-cast (2)'],
    ['3', 'T-cast (3)'],
    ['4', 'Q-cast (4)'],
    ['5', 'V-cast (5)'],
  ];

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
