import { Component, input, model, output } from '@angular/core';
import { Button } from '../../../shared/components/button/button';
import { Modal } from '../../../shared/components/modal/modal';
import type { GameUnit } from '../unit-model';

/** Asks how a unit is awakened: with 2 copies, or with 1 and a prism. */
@Component({
  selector: 'app-unit-awaken-modal',
  imports: [Modal, Button],
  templateUrl: './unit-awaken-modal.html',
  styleUrl: './unit-awaken-modal.css',
})
export class UnitAwakenModal {
  readonly unit = input.required<GameUnit | null>();
  readonly open = model(false);
  readonly chosen = output<1 | 2>();
}
