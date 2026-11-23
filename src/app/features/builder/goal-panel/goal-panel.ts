import { Component, computed, effect, input, signal } from '@angular/core';
import { ailmentList, disablingAilmentList, elementList } from '../../../../core/constants/base-lists';
import { Choice, ChoiceGroup } from '../../../shared/components/choice-group/choice-group';
import { Button } from '../../../shared/components/button/button';
import { RichOption, RichSelect } from '../../../shared/components/rich-select/rich-select';
import { formulaToString } from '../../../../core/formula/formula-text';
import { chooseGoal, int } from '../shared/build-inputs';
import type { CustomGoal } from '../shared/custom-goal';
import { StatePanel } from '../shared/state-panel';
import { NumberField } from '../../../shared/components/number-field/number-field';
import { Icon } from '../../../shared/components/icon/icon';
import { STRINGS } from '../../../strings/en';

const UNSUPPORTED = ' - Not supported yet';
const TAGS: Record<string, string | undefined> = {
  damage: 'damage',
  stat: 'stat',
  lb: 'Limit burst',
  skill: 'skill',
  magic: 'magic',
  multicast: 'multicast',
};
const ucFirst = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** What the build is for: damage, a stat, a skill... and the conditions of the goal. */
@Component({
  selector: 'app-goal-panel',
  imports: [ChoiceGroup, Button, Icon, NumberField, RichSelect],
  templateUrl: './goal-panel.html',
  styleUrls: ['../shared/form-common.css', './goal-panel.css'],
})
export class GoalPanel extends StatePanel {
  protected readonly t = STRINGS.goalPanel;
  readonly customGoal = input.required<CustomGoal>();

  protected readonly elements = elementList;
  /** The goals for the select: the picture, and a tag for what each one is (damage, stat, limit burst, skill...). */
  protected readonly goalChoices = computed<RichOption[]>(() =>
    this.s.goalOptions().map((option) => {
      const unsupported = option.label.includes(UNSUPPORTED);
      const label = option.label.replace(UNSUPPORTED, '').replace(' (Limit Burst)', '');
      return {
        value: option.value,
        label,
        disabled: option.disabled,
        icon: option.icon,
        tag: unsupported ? 'Not yet' : TAGS[option.kind],
        tagKind: unsupported ? 'unsupported' : option.kind,
        mark: option.upgraded ? '☆' : undefined,
        markTitle: option.upgraded,
      };
    }),
  );

  protected readonly customText = computed(() => {
    const formula = this.s.customFormula();
    return formula ? formulaToString(formula) : '';
  });
  protected readonly forcedElementChoices: Choice[] = [...elementList, 'noElement'].map((value) => ({
    value,
    tooltip: value === 'noElement' ? 'Prevent use of elemental weapons' : `Force use of ${ucFirst(value)}`,
  }));
  protected readonly ailmentChoices: Choice[] = ailmentList
    .slice(0, 9)
    .map((value) => ({ value, tooltip: ucFirst(value) }));
  protected readonly variousChoices: Choice[] = [
    { value: 'evade.physical', label: STRINGS.goalPanel.n100PhysicalEvasion },
    { value: 'accuracy', label: STRINGS.goalPanel.n100Accuracy },
    { value: 'drawAttacks', label: STRINGS.goalPanel.n100DrawAttacks },
  ];

  /** Cycles the ailment immunities: all of them, only the disabling ones, none (death stays as it is). */
  protected switchAilments(): void {
    const selected = this.s.ailmentImmunities();
    const others = selected.filter((ailment) => ailment !== 'death');
    let next: readonly string[];
    if (others.length === 8) next = disablingAilmentList;
    else if (others.length === 4 && disablingAilmentList.every((ailment) => others.includes(ailment))) next = [];
    else next = ailmentList.slice(0, 8);
    this.s.ailmentImmunities.set(selected.includes('death') ? [...next, 'death'] : next);
    this.s.refresh();
  }

  /** The additional conditions are folded away until the goal has some (a link, a saved team). */
  protected readonly optionsOpen = signal(false);
  private readonly hasConditions = computed(
    () =>
      !!this.s.chainMultiplier() ||
      this.s.forcedElements().length > 0 ||
      this.s.ailmentImmunities().length > 0 ||
      this.s.various().length > 0 ||
      Object.values(this.s.goalResists()).some((value) => int(value) > 0),
  );

  constructor() {
    super();
    effect(() => {
      if (this.hasConditions()) this.optionsOpen.set(true);
    });
  }

  protected setChainMax(): void {
    this.s.chainMultiplier.set('MAX');
    this.s.refresh();
  }

  protected chooseGoal(value: string): void {
    chooseGoal(this.s, value);
  }

  protected chooseMulticast(index: number, value: string): void {
    this.s.multicastSelection.update((selection) => selection.map((s, i) => (i === index ? value : s)));
    this.s.refresh();
  }

  protected setGoalResist(element: string, value: string): void {
    this.s.goalResists.update((r) => ({ ...r, [element]: value }));
    this.s.refresh();
  }
}
