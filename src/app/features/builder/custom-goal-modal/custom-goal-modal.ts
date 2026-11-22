import { Component, input } from '@angular/core';
import { Button } from '../../../shared/components/button/button';
import { Modal } from '../../../shared/components/modal/modal';
import type { CustomGoal } from '../shared/custom-goal';

/** Writes the formula (and condition) of a custom goal. */
@Component({
  selector: 'app-custom-goal-modal',
  imports: [Modal, Button],
  templateUrl: './custom-goal-modal.html',
  styleUrl: './custom-goal-modal.css',
})
export class CustomGoalModal {
  readonly goal = input.required<CustomGoal>();
}
