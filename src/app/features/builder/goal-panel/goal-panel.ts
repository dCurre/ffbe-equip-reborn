import { Component, input } from '@angular/core';
import { ailmentList, elementList } from '../../../../core/constants';
import { Choice, ChoiceGroup } from '../../../shared/components/choice-group/choice-group';
import { Button } from '../../../shared/components/button/button';
import { Panel } from '../../../shared/components/panel/panel';
import { chooseGoal } from '../shared/build-inputs';
import type { CustomGoal } from '../shared/custom-goal';
import { StatePanel } from '../shared/state-panel';

const ucFirst = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** What the build is for: damage, a stat, a skill... and the conditions of the goal. */
@Component({
  selector: 'app-goal-panel',
  imports: [Panel, ChoiceGroup, Button],
  templateUrl: './goal-panel.html',
  styleUrls: ['../shared/form-common.css', './goal-panel.css'],
})
export class GoalPanel extends StatePanel {
  readonly customGoal = input.required<CustomGoal>();

  protected readonly elements = elementList;
  protected readonly forcedElementChoices: Choice[] = [...elementList, 'noElement'].map((value) => ({
    value,
    tooltip: value === 'noElement' ? 'Prevent use of elemental weapons' : `Force use of ${ucFirst(value)}`,
  }));
  protected readonly ailmentChoices: Choice[] = ailmentList
    .slice(0, 9)
    .map((value) => ({ value, tooltip: ucFirst(value) }));
  protected readonly variousChoices: Choice[] = [
    { value: 'evade.physical', label: '100% physical evasion' },
    { value: 'accuracy', label: '100% accuracy' },
    { value: 'drawAttacks', label: '100% draw attacks' },
  ];
  protected readonly variations = [
    ['min', 'Minimum'],
    ['avg', 'Average'],
    ['max', 'Maximum'],
  ];

  protected chooseGoal(value: string): void {
    chooseGoal(this.s, value);
  }

  protected chooseMulticast(index: number, value: string): void {
    this.s.multicastSelection.update((selection) => selection.map((s, i) => (i === index ? value : s)));
    this.s.refresh();
  }

  protected setGoalResist(element: string, event: Event): void {
    this.s.goalResists.update((r) => ({ ...r, [element]: (event.target as HTMLInputElement).value }));
    this.s.refresh();
  }
}
