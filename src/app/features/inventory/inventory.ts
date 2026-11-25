import { NgTemplateOutlet } from '@angular/common';
import { Checkbox } from '../../shared/components/checkbox/checkbox';
import { Component, computed, ElementRef, HostListener, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { typeList, typeListLiterals, weaponList } from '../../../core/constants/item-types';
import { computeFarmableStmr } from '../../../core/builder/item-entry';
import { Item, containsText, buildSearchString } from '../../game/helpers/item';
import { VisionCard } from '../../game/helpers/vision-cards';
import { PageContent } from '../../layout/page-content/page-content';
import { SiteFooter } from '../../layout/site-footer/site-footer';
import { downloadBlob } from '../../shared/helpers/export';
import { Inventory as UserInventory } from '../../shared/services/inventory';
import { SearchBox } from '../../shared/components/search-box/search-box';
import { StaticData } from '../../shared/services/static-data';
import { Toast } from '../../shared/services/toast';
import { Button } from '../../shared/components/button/button';
import { Modal } from '../../shared/components/modal/modal';
import { InventoryCard } from './inventory-card/inventory-card';
import { InventoryStats } from './inventory-stats/inventory-stats';
import { InventoryEnhancementModal } from './inventory-enhancement-modal/inventory-enhancement-modal';
import { DropdownMenu, MenuItem } from '../../shared/components/dropdown-menu/dropdown-menu';
import { LoadStatus } from '../../shared/components/load-status/load-status';
import { ActionLink, GAME_DATA_URL } from '../../shared/components/action-link/action-link';
import { CollectionLayout } from '../../shared/components/collection-layout/collection-layout';
import { TabItem } from '../../shared/components/tab-bar/tab-bar';
import { TabPanel } from '../../shared/components/tab-panel/tab-panel';
import { showMoreOnScroll } from '../../shared/helpers/infinite-scroll';
import {
  ADD_ALL_EQUIPMENT,
  ADD_ALL_MATERIA,
  addAll,
  addItem,
  buildEntries,
  changeCardLevel,
  clearEnhancements,
  dropEmptyCopy,
  Enchantments,
  exportCsv,
  exportJson,
  inventoryStats,
  isLimitedTo,
  ItemEntry,
  removeItem,
  sortEntries,
  startEnhancement,
  toggleEnhancement,
  toggleExcludedFromExpedition,
  farmTmr,
} from './inventory-model';
import { restrictionList } from '../../../core/constants/unit-restrictions';
import { iconInfo } from '../../shared/components/icon/icon-map';
import { ClearFilters } from '../../shared/components/clear-filters/clear-filters';
import { Icon } from '../../shared/components/icon/icon';
import { Choice, ChoiceGroup } from '../../shared/components/choice-group/choice-group';
import { STRINGS } from '../../strings/en';

type SortChoice = { stat: string; ascending: boolean };
type Tab = 'equipment' | 'materia' | 'farmableStmr' | 'history' | 'settings';

interface Group {
  type: string;
  lines: ItemEntry[];
}

interface Release {
  date: string;
  sources: { type: string; name?: string; units?: string[]; ids?: string[] }[];
}

interface UnitInfo {
  name: string;
  summon_type?: string;
}

const PAGE_SIZE = 60;
const HISTORY_FIRST = 4;
const HISTORY_PAGE = 3;

/** The items the user owns: add, remove, enhance, with the statistics, the STMR that can be made and the items to sell. */
@Component({
  selector: 'app-inventory',
  imports: [
    Checkbox,
    InventoryStats,
    NgTemplateOutlet,
    PageContent,
    SiteFooter,
    Button,
    DropdownMenu,
    LoadStatus,
    ActionLink,
    CollectionLayout,
    TabPanel,
    InventoryCard,
    InventoryEnhancementModal,
    Modal,
    ClearFilters,
    Icon,
    ChoiceGroup,
    SearchBox,
  ],
  templateUrl: './inventory.html',
  styleUrl: './inventory.css',
})
export class InventoryPage {
  protected readonly t = STRINGS.inventory;
  protected readonly gameDataUrl = GAME_DATA_URL;

  private readonly route = inject(ActivatedRoute);
  private readonly staticData = inject(StaticData);
  protected readonly user = inject(UserInventory);
  private readonly toast = inject(Toast);

  // --- Game data ---
  private readonly data = signal<Item[]>([]);
  private readonly cards = signal<VisionCard[]>([]);
  protected readonly units = signal<Record<string, UnitInfo>>({});
  protected readonly enchantments = signal<Enchantments>({});
  private readonly releases = signal<Release[]>([]);
  private readonly dataReady = signal(false);

  protected readonly ready = computed(() => this.dataReady() && this.user.status() !== 'loading');
  protected readonly loginNeeded = computed(() => this.user.status() === 'notLoaded');
  protected readonly showInventory = computed(() => this.ready() && !this.loginNeeded());

  // --- What is shown ---
  protected readonly tab = signal<Tab>('equipment');
  /** the search is the same on every tab (the box is only hidden on the others) */
  protected readonly search = signal('');
  protected readonly searchable = computed(() => ['equipment', 'materia', 'farmableStmr'].includes(this.tab()));
  /** on the equipment and materia tabs: only what the user owns */
  protected readonly onlyOwned = signal(false);
  protected readonly stmrMoogle = signal(0);
  protected readonly onlyTimeLimited = signal(false);
  protected readonly sidebarCollapsed = signal(window.innerWidth < 990);
  protected readonly exportItems: MenuItem[] = [
    { label: STRINGS.inventory.exportAsCsv, run: () => this.exportCsv() },
    { label: STRINGS.inventory.exportAsJson, run: () => this.exportJson() },
  ];
  protected readonly tabs: TabItem<Tab>[] = [
    { key: 'equipment', title: STRINGS.inventory.showAllEquipments, icon: 'equipments' },
    { key: 'materia', title: STRINGS.inventory.showAllMateria, icon: 'materia' },
    {
      key: 'farmableStmr',
      title: STRINGS.inventory.showObtainableStmr,
      image: 'img/units/unit_ills_906000105.png',
      kind: 'stmr',
    },
    { key: 'history', title: STRINGS.inventory.showInventoryByEvents, icon: 'history' },
    { key: 'settings', title: STRINGS.inventory.showInventoryTools, icon: 'settings' },
  ];
  private readonly searchBox = viewChild(SearchBox);

  /** the types to show on the tabs that list by type; none selected shows every type */
  protected readonly selectedTypes = signal<readonly string[]>([]);
  /** the sexes and roles the items are limited to (an item matching any of them is shown) */
  protected readonly selectedRestrictions = signal<readonly string[]>([]);
  /** the types to hide (a second click on a type button) */
  protected readonly excludedTypes = signal<readonly string[]>([]);
  /** the sort chosen on each tab (none: the default of the tab, shown as selected): a stat from the highest and off, the name ascending, descending and off */
  private readonly sorts = signal<Record<string, SortChoice | null>>({});
  /** the sort of the open tab: each tab keeps its own */
  protected readonly sort = computed(() => this.sorts()[this.tab()] ?? null);
  private setSort(value: SortChoice | null): void {
    this.sorts.update((sorts) => ({ ...sorts, [this.tab()]: value }));
  }
  protected readonly sortChoices = computed<Choice[]>(() => {
    const current = this.sort();
    return [
      ...['hp', 'mp', 'atk', 'def', 'mag', 'spr'].map((value) => ({ value }) as Choice),
      { value: 'name', label: 'A-Z' },
    ].map((choice) => {
      const on = current?.stat === choice.value;
      const single = choice.value !== 'name';
      const standard = this.byType()
        ? 'grouped by type'
        : this.defaultSortStat() === 'name'
          ? 'A-Z'
          : 'ATK, from the highest';
      const next = single
        ? on
          ? `the default (${standard})`
          : 'the highest first'
        : !on
          ? 'ascending'
          : current.ascending
            ? 'descending'
            : `the default (${standard})`;
      return {
        ...choice,
        label: on && !single ? `${choice.label ?? ''} ${current.ascending ? '↑' : '↓'}`.trim() : choice.label,
        tooltip: `Sort by ${choice.value === 'name' ? 'name' : choice.value.toUpperCase()}: click for ${next}`,
      };
    });
  });

  protected readonly sortLabel = computed(() => {
    if (this.search()) return '';
    return (
      (
        {
          history: 'Sorted by release date',
        } as Record<string, string>
      )[this.tab()] ?? ''
    );
  });

  // --- The lines ---
  private readonly entries = computed(() =>
    buildEntries(this.data(), this.cards(), this.user.items(), this.enchantments()),
  );
  private readonly allLines = computed(() => [...this.entries().equipments, ...this.entries().materia]);
  protected readonly stats = computed(() => inventoryStats(this.data(), this.user.items()));
  protected readonly excluded = computed(
    () => (this.user.items()['excludeFromExpeditions'] ?? []) as unknown as string[],
  );

  /** An item not released yet is shown only when the user owns it. */
  private readonly shownLines = (lines: readonly ItemEntry[]): ItemEntry[] =>
    lines.filter(
      (line) =>
        line.item.id === '9999999999' ||
        !line.item.access.includes('not released yet') ||
        this.user.count(line.item.id),
    );

  private readonly stmrLines = computed<ItemEntry[]>(() => {
    const farmable = computeFarmableStmr(this.data(), this.user.units(), this.user.items()) as Record<
      string,
      ItemEntry
    >;
    return Object.values(farmable)
      .filter((line) => (line.stmrAccess?.stmrMoogle ?? 0) <= this.stmrMoogle())
      .filter((line) => !this.onlyTimeLimited() || this.units()[line.item['stmrUnit']]?.summon_type === 'event');
  });

  private readonly tabLines = computed<ItemEntry[]>(() => {
    switch (this.tab()) {
      case 'equipment':
        return this.entries().equipments;
      case 'materia':
        return this.entries().materia;
      case 'farmableStmr':
        return this.stmrLines();
      default:
        return [];
    }
  });

  protected readonly lines = computed<ItemEntry[]>(() => {
    const tab = this.tab();
    if (tab === 'history' || tab === 'settings') return [];
    const text = this.search();
    const restrictions = this.shownRestrictions();
    const lines = this.shownLines(this.tabLines())
      .filter((line) => !text || containsText(text, line.item))
      .filter((line) => !this.ownedFilter() || line.ownedNumber)
      .filter((line) => !restrictions.length || restrictions.some((value) => isLimitedTo(line.item, value)));
    const types = this.shownTypes();
    const hidden = this.shownExcluded();
    return sortEntries(
      lines.filter(
        (line) =>
          !this.byType() || ((!types.length || types.includes(line.item.type)) && !hidden.includes(line.item.type)),
      ),
      this.sort()?.stat ?? this.defaultSortStat(),
      // the stats go from the highest and the names from A unless turned around
      this.sort() ? this.sort()!.ascending !== (this.sort()!.stat === 'name') : false,
      !this.sort(),
    );
  });

  /** The types of the tab (before the type filter), to choose from. */
  protected readonly typeChoices = computed<Choice[]>(() => {
    const present = new Set(this.shownLines(this.tabLines()).map((line) => line.item.type));
    return typeList
      .filter((type) => present.has(type))
      .map((value) => ({ value, tooltip: typeListLiterals[value as keyof typeof typeListLiterals] ?? value }));
  });
  /** The sexes and roles some item of the tab is limited to, to choose from (they can hide an item from the Builder). */
  protected readonly restrictionChoices = computed<Choice[]>(() => {
    if (!['equipment', 'materia'].includes(this.tab())) return [];
    const values = new Set<string>();
    for (const { item } of this.tabLines()) {
      if (item['exclusiveSex']) values.add(item['exclusiveSex']);
      for (const role of item['exclusiveRoles'] ?? []) values.add(role);
    }
    // only the icon (`restriction-<value>`), with the tooltip of the table of icons, as the type buttons have theirs
    return restrictionList
      .filter((value) => values.has(value))
      .map((value) => ({ value, tooltip: iconInfo(`restriction-${value}`)?.title }));
  });
  private readonly shownRestrictions = computed(() => {
    const available = new Set(this.restrictionChoices().map((choice) => choice.value));
    return this.selectedRestrictions().filter((value) => available.has(value));
  });
  /** The type buttons in two rows: the weapons, then what protects (and the materia, the cards). */
  protected readonly weaponChoices = computed(() => this.typeChoices().filter((c) => weaponList.includes(c.value)));
  protected readonly defenseChoices = computed(() => this.typeChoices().filter((c) => !weaponList.includes(c.value)));
  /** What is selected and still on the tab (a type of another tab is ignored). */
  private readonly shownTypes = computed(() => {
    const available = new Set(this.typeChoices().map((choice) => choice.value));
    return this.selectedTypes().filter((type) => available.has(type));
  });
  private readonly shownExcluded = computed(() => {
    const available = new Set(this.typeChoices().map((choice) => choice.value));
    return this.excludedTypes().filter((type) => available.has(type));
  });
  /** how many of the filters are on: the types chosen or excluded, a sort */
  protected readonly activeFilters = computed(
    () =>
      this.shownTypes().length +
      this.shownExcluded().length +
      this.shownRestrictions().length +
      (this.sort() ? 1 : 0) +
      (this.ownedFilter() ? 1 : 0),
  );
  /** the "only owned" filter is on, on a tab it applies to */
  protected readonly ownedFilter = computed(() => this.onlyOwned() && ['equipment', 'materia'].includes(this.tab()));
  protected readonly showSort = computed(() => !['history', 'settings'].includes(this.tab()));
  /** what is selected while nothing is chosen: the materia go by name, the equipment by ATK */
  private readonly defaultSortStat = computed(() => (this.tab() === 'materia' ? 'name' : 'atk'));

  /** what is pressed: the sort chosen (the equipment list has none until one is chosen: it is grouped by type) */
  protected readonly sortSelected = computed(() => {
    const stat = this.sort()?.stat ?? (this.byType() ? undefined : this.defaultSortStat());
    return stat ? [stat] : [];
  });

  protected readonly byType = computed(() => this.tab() === 'equipment');
  protected readonly groups = computed<Group[]>(() => {
    // a sort chosen is over all the items: the type of the weapon does not split it
    if (this.sort()) return this.lines().length ? [{ type: 'all', lines: this.lines() }] : [];
    // one group for each type, even when the lines of a type are not next to each other (the groups are tracked by type)
    const groups = new Map<string, Group>();
    for (const line of this.lines()) {
      const group = groups.get(line.item.type) ?? { type: line.item.type, lines: [] };
      group.lines.push(line);
      groups.set(line.item.type, group);
    }
    return [...groups.values()];
  });

  /** The lines drawn: more of them are drawn when the end of the list comes into view. */
  private readonly limit = linkedSignal<ItemEntry[], number>({ source: this.lines, computation: () => PAGE_SIZE });
  protected readonly visibleGroups = computed(() => {
    let left = this.limit();
    const result: Group[] = [];
    for (const group of this.groups()) {
      if (left <= 0) break;
      result.push({ type: group.type, lines: group.lines.slice(0, left) });
      left -= group.lines.length;
    }
    return result;
  });
  private readonly end = viewChild<ElementRef<HTMLElement>>('end');

  // --- History ---
  protected readonly historyCount = linkedSignal<Tab, number>({ source: this.tab, computation: () => HISTORY_FIRST });
  protected readonly history = computed(() => {
    const lines = this.allLines();
    const tmr = new Map<string, ItemEntry>();
    const stmr = new Map<string, ItemEntry>();
    const byEvent = new Map<string, ItemEntry[]>();
    const byId = new Map<string, ItemEntry>();
    for (const line of lines) {
      const item = line.item;
      if (item['tmrUnit']) tmr.set(item['tmrUnit'], line);
      if (item['stmrUnit']) stmr.set(item['stmrUnit'], line);
      for (const event of item['eventNames'] ?? []) byEvent.set(event, [...(byEvent.get(event) ?? []), line]);
      byId.set(item.id, line);
    }
    return this.releases().map((release) => ({
      date: release.date,
      sources: release.sources.map((source) => {
        let items: (ItemEntry | undefined)[] = [];
        let title = source.name ?? '';
        if (source.type === 'banner') {
          const names = (source.units ?? []).map((id) => this.units()[id]?.name ?? id);
          title = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join('');
          items = (source.units ?? []).flatMap((id) => [tmr.get(id), stmr.get(id)]);
        } else if (source.type === 'event') items = byEvent.get(source.name ?? '') ?? [];
        else if (source.type === 'storyPart') items = (source.ids ?? []).map((id) => byId.get(id));
        return { title, items: items.filter((i): i is ItemEntry => !!i) };
      }),
    }));
  });

  // --- Dialogs ---
  protected readonly enhancing = signal<{ item: Item; pos: number } | null>(null);
  protected readonly enhancingOpen = signal(false);
  protected readonly enhancingLine = computed(() => {
    const current = this.enhancing();
    if (!current) return null;
    // a copy: the picker sees a new list when the bonuses change in place
    const enhancements = [...(this.user.items().enchantments[current.item.id]?.[current.pos] ?? [])] as (
      string | number
    )[];
    return { item: current.item, enhancements };
  });
  protected readonly limitOpen = signal(false);
  private limitLine: ItemEntry | null = null;
  protected readonly limitNumber = signal(0);
  protected readonly addAllOpen = signal(false);
  protected readonly removeAllOpen = signal(false);
  private addedWithAddAll: ItemEntry[] = [];
  protected readonly undoAvailable = signal(false);
  protected readonly busy = signal(false);

  constructor() {
    showMoreOnScroll(this.end, this.limit, () => this.lines().length, PAGE_SIZE, '600px');
    showMoreOnScroll(
      this.end,
      this.historyCount,
      () => (this.tab() === 'history' ? this.history().length : 0),
      HISTORY_PAGE,
      '600px',
    );
    this.start();
  }

  @HostListener('window:keyup.escape')
  protected clearSearch(): void {
    this.search.set('');
    this.searchBox()?.clear();
  }

  private async start(): Promise<void> {
    try {
      const [data, units, cards, enchantments, released, releases] = await Promise.all([
        this.staticData.get<Item[]>('data', true),
        this.staticData.get<Record<string, UnitInfo>>('units', true),
        this.staticData.get<Record<string, VisionCard>>('visionCards'),
        this.staticData.get<Enchantments>('itemEnchants'),
        this.staticData.get<Record<string, { type: string }>>('releasedUnits'),
        this.staticData.get<Release[]>('lastItemReleases'),
      ]);
      for (const [id, unit] of Object.entries(units)) if (released[id]) unit.summon_type = released[id].type;
      for (const item of data) item.searchString = buildSearchString(item, units);
      const cardList = Object.values(cards);
      for (const card of cardList) card.searchString = card.name + (card['jpname'] ? `|${card['jpname']}` : '');
      this.data.set(data);
      this.units.set(units);
      this.cards.set(cardList);
      this.enchantments.set(enchantments);
      this.releases.set(releases);
      this.dataReady.set(true);
    } catch {
      this.toast.show(STRINGS.inventory.errorWhileLoadingThe, 'error');
    }
  }

  // --- Navigation ---

  protected showTab(tab: Tab): void {
    this.tab.set(tab);
  }

  /** A stat: pressed once it sorts from the highest, again it goes back to the default. The name: ascending, descending, off. */
  protected pickSort(value: readonly string[]): void {
    const stat = value[0];
    const current = this.sort();
    // the stats have one order only (the highest first): a press turns it on, the next off
    if (stat !== 'name') {
      this.setSort(stat && current?.stat !== stat ? { stat, ascending: false } : null);
      return;
    }
    if (!stat || current?.stat !== stat) this.setSort(stat ? { stat, ascending: true } : null);
    else this.setSort(current.ascending ? { stat, ascending: false } : null);
  }

  protected clearFilters(): void {
    this.selectedTypes.set([]);
    this.excludedTypes.set([]);
    this.selectedRestrictions.set([]);
    this.onlyOwned.set(false);
    this.setSort(null);
  }

  protected numberInput(target: EventTarget | null, signalToSet: { set(value: number): void }, fallback: number): void {
    const value = parseInt((target as HTMLInputElement).value, 10);
    signalToSet.set(Number.isNaN(value) ? fallback : value);
  }

  // --- A line ---

  protected classes(line: ItemEntry): string {
    const item = line.item;
    const unit = item['tmrUnit'] ? this.user.units()[item['tmrUnit']] : undefined;
    const classes = [
      line.ownedNumber ? '' : 'notOwned',
      unit && unit.farmable > 0 ? 'farmable' : '',
      line.enhanced ? 'enhanced' : '',
      this.excluded().includes(item.id) ? 'excludedFromExpeditions' : '',
      this.user.count(item.id) && item['maxNumber'] && this.user.count(item.id) > item['maxNumber']
        ? 'maxNumberOverflow'
        : '',
      this.tab() === 'farmableStmr' && line.stmrAccess ? 'stmr' : '',
    ];
    return `item ${classes.filter(Boolean).join(' ')}`;
  }

  protected add(line: ItemEntry): void {
    if (addItem(this.user.items(), line) === 'limit') {
      this.limitLine = line;
      this.limitNumber.set(line.item['maxNumber']);
      this.limitOpen.set(true);
      return;
    }
    this.user.changed('itemInventory');
  }

  protected addAnyway(): void {
    if (this.limitLine) addItem(this.user.items(), this.limitLine, true);
    this.limitOpen.set(false);
    this.user.changed('itemInventory');
  }

  protected remove(line: ItemEntry): void {
    removeItem(this.user.items(), line);
    this.user.changed('itemInventory');
  }

  protected farmedTmr(line: ItemEntry): void {
    const unitId = line.item['tmrUnit'];
    const own = this.entries()
      .equipments.concat(this.entries().materia)
      .find((l) => l.item.id === line.item.id);
    if (!farmTmr(this.user.items(), this.data(), this.user.units(), unitId, own)) return;
    this.user.changed('itemInventory', 'units');
  }

  protected toggleExcluded(line: ItemEntry): void {
    toggleExcludedFromExpedition(this.user.items(), line.item.id);
    this.user.changed('itemInventory');
  }

  protected cardLevel(line: ItemEntry, change: 1 | -1): void {
    changeCardLevel(this.user.items(), line, change);
    this.user.changed('itemInventory');
  }

  protected openEnhancements(line: ItemEntry): void {
    const pos = startEnhancement(this.user.items(), line);
    // a not enhanced copy became an enhanced one: the dialog shows it, and the list follows
    this.user.changed('itemInventory');
    this.enhancing.set({ item: (line.item['originalItem'] as Item | undefined) ?? line.item, pos });
    this.enhancingOpen.set(true);
  }

  protected toggleEnhancementValue(value: string | number): void {
    const current = this.enhancing();
    if (!current) return;
    const result = toggleEnhancement(this.user.items(), current.item.id, current.pos, value);
    if (result === 'full') {
      this.toast.show(STRINGS.inventory.noMoreThan3, 'warn');
      return;
    }
    if (result === 'copyRemoved') this.setEnhancingOpen(false);
    this.user.changed('itemInventory');
  }

  protected setEnhancingOpen(open: boolean): void {
    this.enhancingOpen.set(open);
    if (open) return;
    const current = this.enhancing();
    this.enhancing.set(null);
    if (current && dropEmptyCopy(this.user.items(), current.item.id, current.pos)) this.user.changed('itemInventory');
  }

  protected clearEnhancementValues(): void {
    const current = this.enhancing();
    if (!current) return;
    clearEnhancements(this.user.items(), current.item.id, current.pos);
    this.user.changed('itemInventory');
  }

  protected stmrUnitName(line: ItemEntry): string {
    return this.units()[line.item['stmrUnit']]?.name ?? '';
  }

  // --- Tools ---

  protected addAllItems(): void {
    const added = [
      ...addAll(this.user.items(), this.entries().materia, ADD_ALL_MATERIA),
      ...addAll(
        this.user.items(),
        this.entries().equipments.filter((l) => !l.visionCard),
        ADD_ALL_EQUIPMENT,
      ),
    ];
    this.addedWithAddAll = added;
    this.undoAvailable.set(added.length > 0);
    this.addAllOpen.set(false);
    this.user.changed('itemInventory');
  }

  protected undoAddAll(): void {
    for (const line of this.addedWithAddAll) removeItem(this.user.items(), line);
    this.addedWithAddAll = [];
    this.undoAvailable.set(false);
    this.user.changed('itemInventory');
  }

  protected removeAllItems(): void {
    const items = this.user.items();
    for (const id of Object.keys(items)) delete items[id];
    items.enchantments = {};
    items.visionCardsLevels = {};
    this.removeAllOpen.set(false);
    this.user.changed('itemInventory');
  }

  // --- Exports and imports ---

  protected exportCsv(): void {
    const lines = [...sortEntries(this.entries().equipments), ...sortEntries(this.entries().materia)];
    const csv = exportCsv(lines, this.user.items(), this.units());
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'FFBE_Equip - Equipment.csv');
  }

  protected exportJson(): void {
    const json = exportJson(this.user.items(), this.data(), this.enchantments());
    downloadBlob(new Blob([json], { type: 'application/json;charset=utf-8' }), 'FFBE_Equip - Equipment.json');
  }
}
