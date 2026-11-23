import { Component, inject, signal } from '@angular/core';
import { formulaToString } from '../../../../core/formula/formula-text';
import { isAttackFormula } from '../../../../core/formula/formula-queries';
import { parseFormula } from '../../../../core/formula/formula-parser';
import { Toast } from '../../../shared/services/toast';
import { Button } from '../../../shared/components/button/button';
import { Icon } from '../../../shared/components/icon/icon';
import { Modal } from '../../../shared/components/modal/modal';
import { defaultMonsterAttackFormula } from '../shared/goal';
import { StatePanel } from '../shared/state-panel';
import { STRINGS } from '../../../strings/en';

/** The attack of the monster, as a formula: shown in a line and changed in a dialog. */
@Component({
  selector: 'app-monster-attack',
  imports: [Button, Icon, Modal],
  templateUrl: './monster-attack.html',
  styleUrl: './monster-attack.css',
})
export class MonsterAttack extends StatePanel {
  protected readonly t = STRINGS.monsterAttack;
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
      this.toast.show(STRINGS.monsterAttack.thisFormulaCannotBe, 'error');
    } else if (!isAttackFormula(formula)) {
      this.toast.show(STRINGS.monsterAttack.theInputedFormulaIs, 'error');
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
