import { Component, input } from '@angular/core';
import { UnitEffect } from '../unit-effect/unit-effect';
import { UnitSkillTags } from '../unit-skill-tags/unit-skill-tags';
import { UnitStrangeStats } from '../unit-strange-stats/unit-strange-stats';
import { Icon } from '../../../shared/components/icon/icon';

/* eslint-disable @typescript-eslint/no-explicit-any -- the skill data of the units has no fixed shape */

/** The limit burst of a unit, with the effects of its minimum and maximum level. */
@Component({
  selector: 'app-unit-limit-burst',
  imports: [UnitEffect, UnitSkillTags, UnitStrangeStats, Icon],
  templateUrl: './unit-limit-burst.html',
  styleUrls: ['../unit-skill/unit-skill.css', './unit-limit-burst.css'],
})
export class UnitLimitBurst {
  readonly lb = input.required<any>();
}
