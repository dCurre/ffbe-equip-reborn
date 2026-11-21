import { signal } from '@angular/core';
import { elementList } from '../../../../core/constants';
import {
  formulaToString,
  getChainMultiplier,
  getSimpleConditions,
  isSimpleFormula,
  parseFormula,
} from '../../../../core/formula';
import type { Toast } from '../../../shared/services/toast';
import { chooseGoal, updateGoal } from './build-inputs';
import type { BuilderState } from './builder-state';
import { choiceFromFormula } from './goal';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

/** A goal written as a formula. */
export class CustomGoal {
  readonly open = signal(false);
  readonly text = signal({ formula: '', condition: '' });

  constructor(
    private readonly s: BuilderState,
    private readonly toast: Toast,
  ) {}

  show(): void {
    const current = this.s.customFormula();
    this.text.set({ formula: current ? formulaToString(current) : '', condition: '' });
    this.open.set(true);
  }

  apply(): void {
    const { formula, condition } = this.text();
    try {
      const parsed = parseFormula(condition ? `${formula};${condition}` : formula, this.s.unitWithSkills());
      if (!parsed) throw new Error('empty');
      this.applyFormula(parsed);
      this.open.set(false);
      this.s.refresh();
    } catch {
      this.toast.show('This formula cannot be read', 'error');
    }
  }

  remove(): void {
    this.s.customFormula.set(null);
    this.s.goalChoice.set('physicalDamage');
    this.open.set(false);
    chooseGoal(this.s, 'physicalDamage');
  }

  /** A formula becomes the goal of the page: the simple ones fill the goal inputs, the others stay as they are. */
  applyFormula(formula: any): void {
    if (!isSimpleFormula(formula)) {
      this.s.customFormula.set(formula);
      this.s.goalChoice.set('custom');
      this.s.multicastSelection.set([]);
      return;
    }
    this.s.customFormula.set(null);
    const goal = choiceFromFormula('custom', formula, this.s.unitWithSkills(), { atk: 0, mag: 0 });
    this.s.goalChoice.set(goal.choice);
    this.s.multicastSelection.set((goal.multicastSkills ?? []).map((skill) => `SKILL_${skill.id}`));
    const conditions = getSimpleConditions(formula);
    this.s.forcedElements.set(conditions.forcedElements.map((e: string) => (e === 'none' ? 'noElement' : e)));
    this.s.ailmentImmunities.set(conditions.ailmentImunity);
    this.s.goalResists.set(
      Object.fromEntries(
        elementList.map((e) => [e, conditions.elementalResist[e] ? String(conditions.elementalResist[e]) : '']),
      ),
    );
    this.s.various.set(conditions.various);
    const chain = getChainMultiplier(formula);
    this.s.chainMultiplier.set(chain && chain !== 1 ? String(chain) : '');
    updateGoal(this.s);
  }
}
