import { Injectable, Signal } from '@angular/core';
import type { ItemsById } from './unit-skill-model';
import type { SkillUnit } from './unit-search-model';

/** The unit of a result and the items of the game: its skills read them from here instead of passing them down level by level. */
@Injectable()
export class UnitContext {
  unit!: Signal<SkillUnit>;
  itemsById!: Signal<ItemsById>;
}
