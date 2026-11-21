import { Component, computed, forwardRef, inject, input } from '@angular/core';
import { UnitContext } from '../unit-context';
import { UnitEffectDescription } from '../unit-effect-description/unit-effect-description';
import { UnitSkill } from '../unit-skill/unit-skill';

/* eslint-disable @typescript-eslint/no-explicit-any -- the skill data of the units has no fixed shape */

/** One effect of a skill: its text, or the skills it uses, counters, casts or gives (shown as skills of their own). */
@Component({
  selector: 'app-unit-effect',
  imports: [UnitEffectDescription, forwardRef(() => UnitSkill)],
  templateUrl: './unit-effect.html',
  styleUrls: ['../unit-skill/unit-skill.css', './unit-effect.css'],
})
export class UnitEffect {
  private readonly context = inject(UnitContext);
  readonly entry = input.required<any>();
  /** the skills already shown above this one: a skill that uses itself is not unrolled again */
  readonly already = input<string[]>([]);
  readonly skillId = input.required<string>();

  protected readonly effect = computed(() => this.entry().effect);
  protected readonly alreadyWithSkill = computed(() => this.already().concat(this.skillId()));
  /** the skills given by this effect that the unit has, each with the skills already shown */
  protected readonly gained = computed(() => {
    const unit = this.context.unit();
    const gain = this.effect()?.gainSkills;
    if (!unit || !gain) return [];
    const gained: { skill: any; already: string[] }[] = [];
    for (const { id } of gain.skills) {
      for (const skill of unit.actives.concat(unit.magics).filter((s) => s.id === id)) {
        gained.push({ skill, already: this.alreadyWithSkill().concat(skill.id) });
      }
    }
    return gained;
  });
}
