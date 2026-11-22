import { Component, computed, input } from '@angular/core';
import { elementList } from '../../../../core/constants/base-lists';
import { weaponList } from '../../../../core/constants/item-types';
import { WikiLink } from '../../../shared/components/wiki-link/wiki-link';
import { Item } from '../../helpers/item';
import { ItemUnits } from '../../models/item-context.model';
import { Icon } from '../../../shared/components/icon/icon';

/** Is one access allowed by the "access to remove" of the filters (a prefix or a suffix of a forbidden one)? */
export function isAccessAllowed(forbidden: readonly string[], access: string): boolean {
  return !forbidden.some((accessToSplit) =>
    accessToSplit.split('/').some((word) => access.startsWith(word) || access.endsWith(word)),
  );
}

/** The names of the data (`debuffer`, `female`, `males`) as the old site showed them. */
const readable = (text: string): string =>
  text.replace('debuffer', 'Breakers').replace('female', 'Female').replace('males', 'Male');

/** Where an item comes from (accesses, the unit it belongs to) and who can equip it. */
@Component({
  selector: 'app-item-access',
  imports: [WikiLink, Icon],
  host: { class: 'td access' },
  templateUrl: './item-access.html',
  styleUrl: './item-access.css',
})
export class ItemAccess {
  readonly item = input.required<Item>();
  readonly units = input<ItemUnits>({});
  /** the access that the filters of the page remove: the matching accesses are crossed out */
  readonly accessToRemove = input<readonly string[]>([]);

  protected readonly accesses = computed(() =>
    (this.item().access ?? []).map((access) => ({
      label: readable(access),
      blocked: this.accessToRemove().length > 0 && !isAccessAllowed(this.accessToRemove(), access),
    })),
  );
  protected readonly tmrUnit = computed(() => this.unit('tmrUnit'));
  protected readonly stmrUnit = computed(() => this.unit('stmrUnit'));
  protected readonly sex = computed(() => readable(String(this.item()['exclusiveSex'])));
  protected readonly roles = computed(() => readable(((this.item()['exclusiveRoles'] as string[]) ?? []).join(', ')));
  protected readonly conditions = computed(() =>
    ((this.item()['equipedConditions'] as string[] | undefined) ?? []).map((name) => ({
      name,
      kind: elementList.includes(name) ? 'element' : 'equipment',
    })),
  );
  protected readonly conditionSeparator = computed(() =>
    this.conditions().every((condition) => weaponList.includes(condition.name)) ? ' or ' : ' and ',
  );

  private unit(key: 'tmrUnit' | 'stmrUnit'): { id: string; unit?: ItemUnits[string] } | undefined {
    const id = this.item()[key];
    return id ? { id, unit: this.units()[id] } : undefined;
  }
}
