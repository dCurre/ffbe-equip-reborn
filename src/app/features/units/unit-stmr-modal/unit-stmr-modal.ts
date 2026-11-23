import { Component, input, model, output } from '@angular/core';
import { Button } from '../../../shared/components/button/button';
import { Modal } from '../../../shared/components/modal/modal';
import type { StmrSource } from '../unit-model';
import type { GameUnit } from '../unit-model';
import { STRINGS } from '../../../strings/en';

/** Asks how a STMR was farmed. */
@Component({
  selector: 'app-unit-stmr-modal',
  imports: [Modal, Button],
  templateUrl: './unit-stmr-modal.html',
})
export class UnitStmrModal {
  protected readonly t = STRINGS.unitStmrModal;
  readonly unit = input.required<GameUnit | null>();
  readonly open = model(false);
  readonly sources = input.required<{ source: StmrSource; text: string }[]>();
  readonly chosen = output<StmrSource>();
}
