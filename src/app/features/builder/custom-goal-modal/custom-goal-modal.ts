import { Component, input } from '@angular/core';
import { Button } from '../../../shared/components/button/button';
import { Modal } from '../../../shared/components/modal/modal';
import { Icon } from '../../../shared/components/icon/icon';
import type { CustomGoal } from '../shared/custom-goal';
import { CUSTOM_GOAL_PRESETS } from '../shared/custom-goal-presets';
import { STRINGS } from '../../../strings/en';

/** Writes the formula (and condition) of a custom goal. */
@Component({
  selector: 'app-custom-goal-modal',
  imports: [Modal, Button, Icon],
  templateUrl: './custom-goal-modal.html',
  styleUrl: './custom-goal-modal.css',
})
export class CustomGoalModal {
  protected readonly t = STRINGS.customGoalModal;
  readonly goal = input.required<CustomGoal>();
  protected readonly presets = CUSTOM_GOAL_PRESETS;

  /** A formula of the list goes at the end of the one written, as the old page did; the list goes back to its title. */
  protected addPreset(select: HTMLSelectElement): void {
    if (select.value) this.goal().text.update((text) => ({ ...text, formula: text.formula + select.value }));
    select.value = '';
  }
}
