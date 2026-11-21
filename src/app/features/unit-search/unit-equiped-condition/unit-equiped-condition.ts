import { Component, computed, inject, input } from '@angular/core';
import { UnitContext } from '../unit-context';
import { conditionParts } from '../unit-skill-model';

/** ` if equiped with ...`: a skill that needs a type of equipment, an element or an item. */
@Component({
  selector: 'app-unit-equiped-condition',
  templateUrl: './unit-equiped-condition.html',
  styleUrl: './unit-equiped-condition.css',
})
export class UnitEquipedCondition {
  private readonly context = inject(UnitContext);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the skill data of the units has no fixed shape
  readonly conditions = input.required<any[]>();
  protected readonly parts = computed(() => conditionParts(this.conditions(), this.context.itemsById()));
}
