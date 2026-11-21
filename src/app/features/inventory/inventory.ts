import { NgTemplateOutlet } from '@angular/common';
import { ImportState } from '../../shared/state/import-state';
import { Component, computed, ElementRef, HostListener, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { itemEnhancementBySkillId, typeList, weaponList } from '../../../core/constants';
import { computeFarmableStmr } from '../../../core/builder/item-entry';
import { Item, containsText, buildSearchString } from '../../game/helpers/item';
import { VisionCard } from '../../game/helpers/vision-cards';
import { PageContent } from '../../layout/page-content/page-content';
import { SiteFooter } from '../../layout/site-footer/site-footer';
import { downloadBlob } from '../../shared/helpers/export';
import { Inventory as UserInventory } from '../../shared/services/inventory';
import { ServerContext } from '../../shared/services/server-context';
import { clearSearchBox, debouncer } from '../../shared/helpers/search-input';
import { Sprites } from '../../shared/services/sprites';
import { StaticData } from '../../shared/services/static-data';
import { Toast } from '../../shared/services/toast';
import { Button } from '../../shared/components/button/button';
import { ConfirmModal } from '../../shared/components/confirm-modal/confirm-modal';
import { InventoryCard } from './inventory-card/inventory-card';
import { InventoryEnhancementModal } from './inventory-enhancement-modal/inventory-enhancement-modal';
import { ImportModal } from '../../shared/components/import-modal/import-modal';
import { DropdownMenu, MenuItem } from '../../shared/components/dropdown-menu/dropdown-menu';
import { LoadStatus } from '../../shared/components/load-status/load-status';
import { ActionLink, GAME_DATA_URL } from '../../shared/components/action-link/action-link';
import { CollectionLayout } from '../../shared/components/collection-layout/collection-layout';
import { TabBar, TabItem } from '../../shared/components/tab-bar/tab-bar';
import { showMoreOnScroll } from '../../shared/helpers/infinite-scroll';
import {
  ADD_ALL_EQUIPMENT,
  ADD_ALL_MATERIA,
  addAll,
  addItem,
  buildEntries,
  changeCardLevel,
  Enchantments,
  enhancementCandidates,
  ImportedItem,
  exportCsv,
  exportJson,
  importInventory,
  inventoryStats,
  isItemFile,
  ItemEntry,
  removeItem,
  sellableItems,
  sortEntries,
  startEnhancement,
  toggleEnhancement,
  toggleExcludedFromExpedition,
  farmTmr,
  SELLABLE_ITEMS_ACCESS,
} from './inventory-model';

type Tab = 'equipment' | 'materia' | 'farmableStmr' | 'sellable' | 'candidates' | 'history' | 'settings';

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

/** The items the user owns: add, remove, enhance, with the statistics, the STMR that can be made and the items to sell. */
@Component({
  selector: 'app-inventory',
  imports: [
    NgTemplateOutlet,
    PageContent,
    SiteFooter,
    Button,
    DropdownMenu,
    LoadStatus,
    ActionLink,
    CollectionLayout,
    TabBar,
    InventoryCard,
    InventoryEnhancementModal,
    ConfirmModal,
    ImportModal,
  ],
  templateUrl: './inventory.html',
  styleUrl: './inventory.css',
})
export class InventoryPage {
  protected readonly gameDataUrl = GAME_DATA_URL;

  private readonly route = inject(ActivatedRoute);
  private readonly staticData = inject(StaticData);
  protected readonly user = inject(UserInventory);
  private readonly serverContext = inject(ServerContext);
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
  private readonly searches = signal<Record<string, string>>({});
  protected readonly search = computed(() => this.searches()[this.tab()] ?? '');
  protected readonly stmrMoogle = signal(0);
  protected readonly onlyTimeLimited = signal(false);
  protected readonly betterItemsNumber = signal(4);
  protected readonly includeRecipes = signal(false);
  protected readonly candidatesDepth = signal(1);
  protected readonly sidebarCollapsed = signal(window.innerWidth < 990);
  protected readonly exportItems: MenuItem[] = [
    { label: 'Export as CSV', run: () => this.exportCsv() },
    { label: 'Export as json', run: () => this.exportJson() },
  ];
  protected readonly tabs: TabItem<Tab>[] = [
    { key: 'equipment', title: 'Show all equipments', icon: 'equipments' },
    { key: 'materia', title: 'Show all materia', icon: 'materia' },
    { key: 'farmableStmr', title: 'Show obtainable STMR', image: 'img/units/unit_ills_906000105.png', kind: 'stmr' },
    { key: 'sellable', title: 'Show sellable items', image: 'img/icons/gil.png', kind: 'small' },
    { key: 'candidates', title: 'Show enhancement candidates', image: 'img/icons/dwarf.png', kind: 'small' },
    { key: 'history', title: 'Show inventory by events', icon: 'history' },
    { key: 'settings', title: 'Show inventory tools', icon: 'settings' },
  ];
  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');
  private readonly debounce = debouncer();

  protected readonly typeList = typeList;
  protected readonly sortLabel = computed(() => {
    if (this.search()) return '';
    return (
      (
        {
          equipment: 'Sorted by Type (Strength)',
          materia: 'Sorted by Name',
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
      case 'sellable':
        return sellableItems(this.allLines(), this.user.items(), this.betterItemsNumber(), this.includeRecipes());
      case 'candidates':
        return enhancementCandidates(this.entries().equipments, this.user.items(), this.candidatesDepth());
      default:
        return [];
    }
  });

  protected readonly lines = computed<ItemEntry[]>(() => {
    const tab = this.tab();
    if (tab === 'history' || tab === 'settings') return [];
    // the sellable items and the candidates ignore the search, as the old page did
    const text = tab === 'sellable' || tab === 'candidates' ? '' : this.search();
    const lines = this.shownLines(this.tabLines()).filter((line) => !text || containsText(text, line.item));
    return sortEntries(lines);
  });

  protected readonly byType = computed(() => ['equipment', 'sellable', 'candidates'].includes(this.tab()));
  protected readonly groups = computed<Group[]>(() => {
    const groups: Group[] = [];
    for (const line of this.lines()) {
      const last = groups[groups.length - 1];
      if (last?.type === line.item.type) last.lines.push(line);
      else groups.push({ type: line.item.type, lines: [line] });
    }
    return groups;
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
    const enhancements = (this.user.items().enchantments[current.item.id]?.[current.pos] ?? []) as (string | number)[];
    return { item: current.item, enhancements };
  });
  protected readonly limitOpen = signal(false);
  private limitLine: ItemEntry | null = null;
  protected readonly limitNumber = signal(0);
  protected readonly addAllOpen = signal(false);
  protected readonly removeAllOpen = signal(false);
  protected readonly importing = new ImportState();
  private imported: ReturnType<typeof importInventory>['inventory'] | null = null;
  private addedWithAddAll: ItemEntry[] = [];
  protected readonly undoAvailable = signal(false);
  protected readonly busy = signal(false);

  constructor() {
    inject(Sprites).load('equipments', 'crystals', 'tabs', 'sorts', 'elements', 'ailments', 'killers', 'espers');
    showMoreOnScroll(this.end, this.limit, () => this.lines().length, PAGE_SIZE, '600px');
    this.start();
  }

  @HostListener('window:keyup.escape')
  protected clearSearch(): void {
    this.setSearchValue('');
    clearSearchBox(this.searchBox());
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
      this.toast.show('Error while loading the item data', 'error');
    }
  }

  // --- Navigation ---

  protected showTab(tab: Tab): void {
    this.tab.set(tab);
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.debounce(() => this.setSearchValue(value));
  }

  private setSearchValue(value: string): void {
    this.searches.update((s) => ({ ...s, [this.tab()]: value }));
  }

  protected jumpTo(type: string, event: Event): void {
    event.preventDefault();
    const index = this.groups().findIndex((g) => g.type === type);
    const before = this.groups()
      .slice(0, index)
      .reduce((sum, g) => sum + g.lines.length, 0);
    this.limit.update((n) => Math.max(n, before + PAGE_SIZE));
    setTimeout(() => document.getElementById(`type-${type}`)?.scrollIntoView());
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
      this.toast.show('No more than 3 item enhancements can be selected', 'warn');
      return;
    }
    if (result === 'copyRemoved') this.enhancingOpen.set(false);
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

  protected openImport(): void {
    this.imported = null;
    this.importing.start();
  }

  protected loadImportFile(data: unknown): void {
    if (!isItemFile(data)) {
      this.toast.show("The imported file doesn't have the correct form", 'error');
      return;
    }
    const { inventory, messages } = importInventory(
      data as ImportedItem[],
      this.data(),
      this.cards(),
      this.enchantments(),
      itemEnhancementBySkillId as unknown as Record<string, string>,
      this.serverContext.server(),
    );
    this.imported = inventory;
    this.importing.messages.set(messages);
    this.importing.summary.set(`Items to import : ${Object.keys(inventory).length}`);
  }

  protected runImport(): void {
    if (!this.imported) {
      this.toast.show('Please select a file to import', 'warn');
      return;
    }
    const items = this.user.items();
    for (const id of Object.keys(items)) delete items[id];
    Object.assign(items, this.imported);
    this.importing.open.set(false);
    this.user.changed('itemInventory');
    this.user.save();
    this.tab.set('equipment');
  }
}
