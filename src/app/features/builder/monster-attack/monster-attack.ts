import { Component, inject, signal } from '@angular/core';
import { formulaToString, isAttackFormula, parseFormula } from '../../../../core/formula';
import { Toast } from '../../../shared/services/toast';
import { Button } from '../../../shared/components/button/button';
import { Icon } from '../../../shared/components/icon/icon';
import { Modal } from '../../../shared/components/modal/modal';
import { defaultMonsterAttackFormula } from '../shared/goal';
import { StatePanel } from '../shared/state-panel';

/** The attack of the monster, as a formula: shown in a line and changed in a dialog. */
@Component({
  selector: 'app-monster-attack',
  imports: [Button, Icon, Modal],
  templateUrl: './monster-attack.html',
  styleUrl: './monster-attack.css',
})
export class MonsterAttack extends StatePanel {
  private readonly toast = inject(Toast);

  protected readonly open = signal(false);
  protected readonly text = signal('');
  protected readonly formulaToString = formulaToString;

  protected show(): void {
    this.text.set(formulaToString(this.s.monsterAttackFormula(), false));
    this.open.set(true);
  }

  protected apply(): void {
    let formula;
    try {
      formula = parseFormula(this.text(), null);
    } catch {
      formula = null;
    }
    if (!formula) {
      this.toast.show('This formula cannot be read', 'error');
    } else if (!isAttackFormula(formula)) {
      this.toast.show('The inputed formula is not a valid simple damage formula', 'error');
    } else {
      this.set(formula);
      this.open.set(false);
    }
  }

  protected reset(): void {
    this.set(defaultMonsterAttackFormula);
  }

  private set(formula: unknown): void {
    this.s.monsterAttackFormula.set(formula);
    this.s.build().monsterAttackFormula = formula;
    this.s.refresh();
  }
}
