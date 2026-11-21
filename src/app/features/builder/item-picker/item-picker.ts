import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { areConditionOK, isApplicable } from '../../../../core/builder/item-conditions';
import { baseStats, typeList } from '../../../../core/constants';
import { filterItems, Item, searchTokens, sortItems } from '../../../game/helpers/item';
import { ItemLine } from '../../../game/components/item-line/item-line';
import { highlightText } from '../../../shared/helpers/highlight';
import { Button } from '../../../shared/components/button/button';
import { debouncer } from '../../../shared/helpers/search-input';
import { Checkbox } from '../../../shared/components/checkbox/checkbox';
import { Modal } from '../../../shared/components/modal/modal';
import { showMoreOnScroll } from '../../../shared/helpers/infinite-scroll';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

export type PickerBehavior = 'equip' | 'exclude' | 'include';

const PAGE_SIZE = 40;

/** What the picker needs to know about the item pool and the build being edited. */
export interface PickerContext {
  /** every item the unit could use, and the Espers */
  items: readonly Item[];
  espers: readonly Item[];
  /** the build being edited */
  build: any;
  units: Readonly<Record<string, { name: string }>>;
  enchantments: Readonly<Record<string, { effects: string }>>;
  /** how many of an item the user owns: `total`, and `available` for this build (null: not logged in) */
  owned(item: Item): { total: number; available: number } | null;
}

/**
 * The window to choose an item for a slot (or to choose the items to exclude from, or include in, the builds): the
 * equipment of the types the slot takes, searchable and sortable by a stat.
 */
@Component({
  selector: 'app-item-picker',
  imports: [Modal, Button, Checkbox, ItemLine, FormsModule],
  templateUrl: './item-picker.html',
  styleUrl: './item-picker.css',
})
export class ItemPicker {
  readonly open = signal(false);
  readonly context = input.required<PickerContext>();
  /** the types of equipment the slot takes (all of them to choose items to include) */
  readonly types = input<readonly string[]>([]);
  readonly behavior = input<PickerBehavior>('equip');
  readonly itemsToExclude = input<readonly string[]>([]);
  readonly itemsToInclude = input<readonly string[]>([]);
  readonly ownedDefault = input(false);
  readonly excludeNotReleasedDefault = input(true);

  readonly picked = output<{ item: Item; enhancements?: unknown }>();
  readonly toggledExclude = output<string>();
  readonly toggledInclude = output<string>();
  readonly enhanceItem = output<Item>();

  protected readonly text = signal('');
  protected readonly stat = signal('');
  protected readonly selectedTypes = linkedSignal<readonly string[], readonly string[]>({
    source: this.types,
    computation: (types) => types,
  });
  protected readonly onlyOwned = linkedSignal(() => this.ownedDefault());
  protected readonly excludeNotReleased = linkedSignal(() => this.excludeNotReleasedDefault());
  protected readonly typeChoices = computed(() => (this.behavior() === 'include' ? typeList : this.types()));
  /** The owned filter exists for a user whose inventory is loaded. */
  protected readonly canFilterOwned = computed(() => this.context().owned({ id: '', type: '' } as Item) !== null);
  protected readonly statChoices = ['hp', 'mp', 'atk', 'def', 'mag', 'spr', 'evade', 'inflict', 'resist'];
  private readonly table = viewChild<ElementRef<HTMLElement>>('table');
  private readonly end = viewChild<ElementRef<HTMLElement>>('end');
  private readonly debounce = debouncer();

  /** The items that can be chosen now, sorted. */
  protected readonly results = computed<Item[]>(() => {
    if (!this.open()) return [];
    const { items, espers, build, owned } = this.context();
    const types = this.selectedTypes().length ? [...this.selectedTypes()] : [...build.getCurrentUnitEquip(), 'esper'];
    const stat = this.stat().split('-')[0];
    const unit = build.unit;
    const candidates: Item[] = [...espers];
    for (const item of items) {
      if (!isApplicable(item, unit)) continue;
      if (item.type === 'visionCard' && item['level'] < item['levels']?.length) continue;
      const last = candidates[candidates.length - 1];
      if (last && last.id === item.id) {
        if (last['equipedConditions']) {
          if (
            item['equipedConditions'] &&
            last['equipedConditions'].length <= item['equipedConditions'].length &&
            areConditionOK(item, build.build)
          ) {
            candidates[candidates.length - 1] = item;
          }
        } else if (areConditionOK(item, build.build)) {
          candidates[candidates.length - 1] = item;
        }
      } else {
        candidates.push(item);
      }
    }
    const baseStat = baseStats.includes(stat) ? (build.baseValues[stat]?.total ?? 0) : 0;
    const owning = this.onlyOwned()
      ? Object.fromEntries(candidates.filter((c) => owned(c)?.total).map((c) => [c.id, true]))
      : undefined;
    const found = filterItems(
      candidates,
      {
        stat,
        showItemsWithoutStat: true,
        text: this.text(),
        types,
        showNotReleasedYet: !this.excludeNotReleased(),
        onlyOwned: owning,
      },
      { baseStat, percentageStat: false, staticStats: this.stat().includes('-flat') },
    );
    return sortItems(found, unit.id);
  });

  private readonly limit = linkedSignal<Item[], number>({ source: this.results, computation: () => PAGE_SIZE });
  protected readonly visible = computed(() => this.results().slice(0, this.limit()));

  constructor() {
    showMoreOnScroll(this.end, this.limit, () => this.results().length, PAGE_SIZE, '300px');
    afterRenderEffect(() => {
      this.visible();
      const table = this.table()?.nativeElement;
      if (table) highlightText(table, searchTokens(this.text()));
    });
  }

  show(): void {
    this.text.set('');
    this.open.set(true);
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.debounce(() => this.text.set(value));
  }

  protected chooseTypes(types: readonly string[]): void {
    this.selectedTypes.set(types);
  }

  protected ownedText(item: Item): { text: string; notEnough: boolean } | null {
    const numbers = this.context().owned(item);
    if (!numbers) return null;
    if (numbers.total <= 0) return { text: '', notEnough: false };
    const different = numbers.available !== numbers.total;
    return {
      text: different ? `${numbers.available}/${numbers.total}` : String(numbers.available),
      notEnough: different && numbers.available === 0,
    };
  }

  protected cardLevels(item: Item): { level: number; id: string; state: '' | 'available' | 'notEnough' }[] {
    return Array.from({ length: item['level'] ?? 0 }, (_, i) => {
      const id = `${item.id.split('-')[0]}-${i + 1}`;
      const numbers = this.context().owned({ id, type: 'visionCard' } as Item);
      const state = numbers && numbers.total > 0 ? (numbers.available === 0 ? 'notEnough' : 'available') : '';
      return { level: i + 1, id, state } as { level: number; id: string; state: '' | 'available' | 'notEnough' };
    });
  }

  protected click(item: Item, event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('a, button')) return;
    const behavior = this.behavior();
    if (behavior === 'exclude') this.toggledExclude.emit(item.id);
    else if (behavior === 'include') this.toggledInclude.emit(item.id);
    else this.picked.emit({ item, enhancements: item['enhancements'] });
  }

  protected pickCard(item: Item, level: { id: string }, event: Event): void {
    event.stopPropagation();
    const card = this.context().items.find((i) => i.id === level.id) ?? item;
    this.picked.emit({ item: card });
  }

  protected isEnhanced(item: Item): boolean {
    return !!item['enhancements'];
  }

  protected isExcluded(item: Item): boolean {
    return this.itemsToExclude().includes(item.id);
  }

  protected isIncluded(item: Item): boolean {
    return this.itemsToInclude().includes(item.id);
  }
}
