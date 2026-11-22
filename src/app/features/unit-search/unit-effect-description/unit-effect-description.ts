import { Component, computed, input } from '@angular/core';
import { UnitEquipedCondition } from '../unit-equiped-condition/unit-equiped-condition';
import { resistGroups, turnsAndTargets } from '../unit-skill-model';
import { Icon } from '../../../shared/components/icon/icon';

/* eslint-disable @typescript-eslint/no-explicit-any -- the skill data of the units has no fixed shape */

/** The text of an effect; the resistances it gives are written with pictures. */
@Component({
  selector: 'app-unit-effect-description',
  imports: [UnitEquipedCondition, Icon],
  templateUrl: './unit-effect-description.html',
  styleUrl: './unit-effect-description.css',
})
export class UnitEffectDescription {
  readonly entry = input.required<any>();

  protected readonly effect = computed(() => this.entry().effect);
  protected readonly groups = computed(() => (this.effect()?.resist ? resistGroups(this.effect()) : []));
  protected readonly turns = computed(() => (this.effect() ? turnsAndTargets(this.effect()) : ''));
  /** the text of the game; one of them has a `<br>` where a line ends */
  protected readonly text = computed(() => String(this.entry().desc ?? '').replaceAll('<br>', '\n'));
}
