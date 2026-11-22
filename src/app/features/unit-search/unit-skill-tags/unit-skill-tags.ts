import { Component, computed, input } from '@angular/core';
import { chainFamilies, damageIcons, innateElements } from '../unit-skill-model';
import { Icon } from '../../../shared/components/icon/icon';

/* eslint-disable @typescript-eslint/no-explicit-any -- the skill data of the units has no fixed shape */

/** What follows the name of a skill: the kinds of damage, the innate elements and the chain family. */
@Component({
  imports: [Icon],
  selector: 'app-unit-skill-tags',
  templateUrl: './unit-skill-tags.html',
  styleUrl: './unit-skill-tags.css',
})
export class UnitSkillTags {
  readonly skill = input.required<any>();
  /** the effects the damage is read from (those of the skill unless given) */
  readonly effects = input<any[]>();

  private readonly list = computed(() => this.effects() ?? this.skill().effects);
  protected readonly icons = computed(() => damageIcons(this.list()));
  protected readonly elements = computed(() => innateElements(this.list()));
  protected readonly families = computed(() => chainFamilies(this.skill()));
}
