import { Component, computed, forwardRef, inject, input } from '@angular/core';
import { UnitContext } from '../unit-context';
import { UnitEffect } from '../unit-effect/unit-effect';
import { UnitEquipedCondition } from '../unit-equiped-condition/unit-equiped-condition';
import { UnitSkillTags } from '../unit-skill-tags/unit-skill-tags';
import { UnitStrangeStats } from '../unit-strange-stats/unit-strange-stats';
import { ifUsedAfter, unlockLines } from '../unit-skill-model';

/* eslint-disable @typescript-eslint/no-explicit-any -- the skill data of the units has no fixed shape */

/** A skill of a unit: its name and costs, what unlocks it, and its effects (which can show other skills). */
@Component({
  selector: 'app-unit-skill',
  imports: [UnitEquipedCondition, UnitSkillTags, UnitStrangeStats, forwardRef(() => UnitEffect)],
  templateUrl: './unit-skill.html',
  styleUrl: './unit-skill.css',
})
export class UnitSkill {
  private readonly context = inject(UnitContext);
  readonly skill = input.required<any>();
  /** the skills of the unit list what unlocks them; the ones shown inside another skill do not */
  readonly topLevel = input(true);
  /** the skills already shown above this one: a skill that uses itself is only named */
  readonly already = input<string[]>([]);

  protected readonly repeated = computed(() => this.already().includes(this.skill().id));
  /** a skill that is available after some turns shows the skill it casts then */
  protected readonly cooldown = computed(() => {
    const first = this.skill().effects[0]?.effect;
    return first?.cooldownSkill ? first : null;
  });
  protected readonly shown = computed(() => this.cooldown()?.cooldownSkill ?? this.skill());
  protected readonly unlocks = computed(() => {
    const unit = this.context.unit();
    const unlockedBy = this.shown().unlockedBy;
    return unit && this.topLevel() && unlockedBy ? unlockLines(this.shown().id, unlockedBy, unit) : [];
  });
  protected readonly lastTurn = computed(() => {
    const unit = this.context.unit();
    const skills = this.shown().ifUsedLastTurn;
    return unit && this.topLevel() && skills ? ifUsedAfter(skills, unit) : '';
  });
}
