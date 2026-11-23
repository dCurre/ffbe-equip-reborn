import { Component, computed, input, model, output } from '@angular/core';
import { ItemLine } from '../../../game/components/item-line/item-line';
import { Button } from '../../../shared/components/button/button';
import { Icon } from '../../../shared/components/icon/icon';
import { Modal } from '../../../shared/components/modal/modal';
import type { Item } from '../../../game/helpers/item';
import type { ItemActions } from '../shared/item-actions';
import type { BuilderState } from '../shared/builder-state';

/** The items excluded from the builds, or always allowed: remove one, reset the list, or go and add more. */
@Component({
  selector: 'app-item-list-modal',
  imports: [Modal, Button, Icon, ItemLine],
  templateUrl: './item-list-modal.html',
  styleUrl: './item-list-modal.css',
})
export class ItemListModal {
  readonly kind = input.required<'exclude' | 'include'>();
  readonly state = input.required<BuilderState>();
  readonly items = input.required<ItemActions>();
  readonly open = model(false);
  readonly add = output<void>();

  protected readonly ids = computed(() => (this.kind() === 'exclude' ? this.state().excluded() : this.state().included()));
  protected readonly entries = computed(() => {
    const { items, espers } = this.items().pickerContext();
    const ids = new Set(this.ids());
    const found = new Map<string, Item>();
    for (const item of [...items, ...espers]) {
      if (ids.has(String(item.id)) && !found.has(String(item.id))) found.set(String(item.id), item);
    }
    return [...found.values()];
  });

  protected remove(id: string): void {
    if (this.kind() === 'exclude') this.items().toggleExclude(id);
    else this.items().toggleInclude(id);
  }

  protected reset(): void {
    if (this.kind() === 'exclude') this.state().excluded.set([]);
    else this.state().included.set([]);
  }
}
