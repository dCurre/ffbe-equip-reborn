import { Component, computed, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ShareLinkState } from '../../shared/state/share-link-state';
import { ImportState } from '../../shared/state/import-state';
import { ActivatedRoute } from '@angular/router';
import { PageContent } from '../../layout/page-content/page-content';
import { SiteFooter } from '../../layout/site-footer/site-footer';
import { downloadBlob, elementToPng, picturesLoaded } from '../../shared/helpers/export';
import { Inventory, OwnedUnit, OwnedUnits } from '../../shared/services/inventory';
import { LinkStore } from '../../shared/services/link-store';
import { PageChrome } from '../../shared/services/page-chrome';
import { ServerContext } from '../../shared/services/server-context';
import { clearSearchBox, debouncer } from '../../shared/helpers/search-input';
import { Sprites } from '../../shared/services/sprites';
import { StaticData } from '../../shared/services/static-data';
import { Toast } from '../../shared/services/toast';
import { BusyOverlay } from '../../shared/components/busy-overlay/busy-overlay';
import { copyToClipboard } from '../../shared/helpers/clipboard';
import { ImportModal } from '../../shared/components/import-modal/import-modal';
import { DropdownMenu, MenuItem } from '../../shared/components/dropdown-menu/dropdown-menu';
import { LoadStatus } from '../../shared/components/load-status/load-status';
import { ActionLink, GAME_DATA_URL } from '../../shared/components/action-link/action-link';
import { CollectionLayout } from '../../shared/components/collection-layout/collection-layout';
import { TabBar, TabItem } from '../../shared/components/tab-bar/tab-bar';
import { ShareLinkModal } from '../../shared/components/share-link-modal/share-link-modal';
import { TextExportModal } from '../../shared/components/text-export-modal/text-export-modal';
import { Card, UnitCard } from './unit-card/unit-card';
import { UnitCollectionStats } from './unit-collection-stats/unit-collection-stats';
import { UnitAwakenModal } from './unit-awaken-modal/unit-awaken-modal';
import { UnitEditModal } from './unit-edit-modal/unit-edit-modal';
import { UnitStmrModal } from './unit-stmr-modal/unit-stmr-modal';
import { consumablesFromFile, importUnits, isConsumablesFile, isUnitFile } from './unit-import';
import {
  addOne,
  applyEdit,
  awaken,
  collectionStats,
  farmedStmrSources,
  filterByName,
  filterByTrustName,
  GameUnit,
  isNV,
  isNVA,
  isSoonNVA,
  num,
  parseMoogles,
  rarityParts,
  RarityParts,
  shownMaxRarity,
  sortAlphabetically,
  sortByRarity,
  sortByTrustName,
  StmrSource,
  TrustItem,
  unitImage,
  UnitEdit,
  useStmrSource,
} from './unit-model';

type Tab = 'rarity' | 'alphabetical' | 'tmr' | 'history';

interface Group {
  /** the id of the heading, a jump-list target */
  id: string;
  title: string;
  rarity?: RarityParts;
  cards: Card[];
}

interface HistoryEntry {
  date: string;
  sources: { type: string; units?: string[] }[];
}

interface ReleasedUnit {
  type: string;
}

/** The collection of units: which ones the user owns, with the TMR / STMR still to farm, plus statistics and exports. */
@Component({
  selector: 'app-units',
  imports: [
    NgTemplateOutlet,
    PageContent,
    SiteFooter,
    DropdownMenu,
    LoadStatus,
    ActionLink,
    CollectionLayout,
    TabBar,
    BusyOverlay,
    ImportModal,
    ShareLinkModal,
    TextExportModal,
    UnitEditModal,
    UnitCard,
    UnitCollectionStats,
    UnitStmrModal,
    UnitAwakenModal,
  ],
  templateUrl: './units.html',
  styleUrl: './units.css',
})
export class Units {
  protected readonly gameDataUrl = GAME_DATA_URL;

  private readonly route = inject(ActivatedRoute);
  private readonly staticData = inject(StaticData);
  private readonly inventory = inject(Inventory);
  private readonly serverContext = inject(ServerContext);
  private readonly linkStore = inject(LinkStore);
  private readonly toast = inject(Toast);
  private readonly chrome = inject(PageChrome);

  // --- Game data ---
  private readonly allUnits = signal<Record<string, GameUnit>>({});
  private readonly released = signal<GameUnit[]>([]);
  private readonly releasedIds = signal<ReadonlySet<string>>(new Set());
  private readonly items = signal<TrustItem[]>([]);
  private readonly history = signal<HistoryEntry[]>([]);
  private readonly gameDataReady = signal(false);

  // --- The collection shown: the user's, or the one of a shared link ---
  protected readonly readOnly = signal(false);
  private readonly linked = signal<Record<string, LinkedUnit>>({});
  private readonly linkLoaded = signal(false);

  protected readonly tab = signal<Tab>('rarity');
  protected readonly search = signal('');
  protected readonly onlyOwned = signal(false);
  protected readonly onlySevenStar = signal(false);
  protected readonly onlyTimeLimited = signal(false);
  protected readonly onlyTmrMoogles = signal(false);
  protected readonly sidebarCollapsed = signal(window.innerWidth < 990);
  protected readonly exportItems: MenuItem[] = [
    { label: 'Export as image', run: () => this.exportImage(1) },
    { label: 'Export only 5*+ as image', run: () => this.exportImage(5) },
    { label: 'Export only 7* as image', run: () => this.exportImage(7) },
    { label: 'Export as CSV', run: () => this.exportCsv() },
    { label: 'Export as simple text', run: () => this.exportText() },
    { label: 'Get public unit collection link', run: () => this.shareCollection() },
  ];
  protected readonly tabs: TabItem<Tab>[] = [
    { key: 'rarity', title: 'Show units by rarity', icon: 'units_stars' },
    { key: 'alphabetical', title: 'Show units in alphabetical order', icon: 'units' },
    { key: 'tmr', title: 'Show units by Trust name', icon: 'units_tmr' },
    { key: 'history', title: 'Show units by events', icon: 'history' },
  ];
  /** An image export is running: only the owned units are shown, from this rarity. */
  protected readonly exporting = signal<{ minRarity: number } | null>(null);
  private readonly debounce = debouncer();
  protected readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');
  private readonly results = viewChild<ElementRef<HTMLElement>>('results');

  protected readonly server = this.serverContext.server;
  protected readonly status = this.inventory.status;
  protected readonly ready = computed(
    () => this.gameDataReady() && (this.readOnly() ? this.linkLoaded() : this.status() !== 'loading'),
  );
  protected readonly loginNeeded = computed(() => !this.readOnly() && this.status() === 'notLoaded');
  protected readonly showCollection = computed(() => this.ready() && !this.loginNeeded());

  private readonly owned = computed<OwnedUnits>(() => (this.readOnly() ? this.linked() : this.inventory.units()));

  /** The TMR and STMR item of each unit. */
  private readonly trust = computed(() => {
    const tmr: Record<string, TrustItem> = {};
    const stmr: Record<string, TrustItem> = {};
    for (const item of this.items()) {
      if (item.tmrUnit) tmr[item.tmrUnit] = item;
      if (item.stmrUnit && !stmr[item.stmrUnit]) stmr[item.stmrUnit] = item;
    }
    return { tmr, stmr };
  });

  /** TMRs and STMRs of each unit that were farmed (the number of that item in the inventory). */
  private readonly farmed = computed(() => {
    const tmr: Record<string, number> = {};
    const stmr: Record<string, number> = {};
    if (this.readOnly()) {
      for (const [id, unit] of Object.entries(this.linked())) {
        tmr[id] = unit.farmed ?? 0;
        stmr[id] = unit.farmedStmr ?? 0;
      }
    } else {
      this.inventory.items();
      for (const [unit, item] of Object.entries(this.trust().tmr)) tmr[unit] = this.inventory.count(item.id);
      for (const [unit, item] of Object.entries(this.trust().stmr)) stmr[unit] = this.inventory.count(item.id);
    }
    return { tmr, stmr };
  });

  protected readonly stats = computed(() => collectionStats(this.released(), this.owned()));
  protected readonly statRows = [
    { key: '7', crystal: 'sevenStarCrystal' },
    { key: '5', crystal: 'rainbowCrystal' },
    { key: '4', crystal: 'goldCrystal' },
    { key: '3', crystal: 'blueCrystal' },
  ] as const;
  protected readonly statGroups = [
    { key: 'all', title: 'All units' },
    { key: 'notLimited', title: 'Not-limited units' },
    { key: 'timeLimited', title: 'Time-limited units' },
  ] as const;

  protected readonly placeholder = computed(() => (this.tab() === 'tmr' ? 'Enter TMR name' : 'Enter unit name'));

  /** The units of the tab, after the search and the filters. */
  private readonly visible = computed(() => {
    const owned = this.owned();
    const exporting = this.exporting();
    const tab = this.tab();
    let units: GameUnit[] = this.released();
    const search = this.search().trim();
    if (tab === 'tmr') units = filterByTrustName(units, this.trust().tmr, search);
    else if (search) units = filterByName(units, search);
    if (this.onlyOwned() || exporting) units = units.filter((unit) => owned[unit.id]);
    if (this.onlySevenStar() && this.onlyOwned()) units = units.filter((unit) => owned[unit.id]?.sevenStar);
    if (this.onlyTimeLimited()) units = units.filter((unit) => unit.summon_type === 'event');
    if (this.onlyTmrMoogles()) units = units.filter((unit) => owned[unit.id]?.tmrMoogles?.length);
    return units;
  });

  protected readonly groups = computed<Group[]>(() => {
    const tab = this.tab();
    const released = this.releasedIds();
    const minRarity = this.exporting()?.minRarity ?? 1;
    if (tab === 'history') return this.historyGroups();
    if (tab === 'alphabetical') return [this.single(sortAlphabetically(this.visible()))];
    if (tab === 'tmr') return [this.single(sortByTrustName(this.visible(), this.trust().tmr), true)];
    // by rarity: one heading for each "min of max" rarity
    const groups: Group[] = [];
    for (const unit of sortByRarity(this.visible(), released)) {
      if (minRarity === 7) {
        if (!this.owned()[unit.id]?.sevenStar) continue;
      } else if (unit.min_rarity !== 'NV' && Number(unit.min_rarity) < minRarity) {
        continue;
      }
      const soon = isSoonNVA(unit, released);
      const max = shownMaxRarity(unit);
      const id = `rarity-${unit.min_rarity}-of-${max}${soon ? '_soon' : ''}`;
      let group = groups[groups.length - 1];
      if (group?.id !== id) {
        group = { id, title: id, rarity: rarityParts(unit.min_rarity, max, soon), cards: [] };
        groups.push(group);
      }
      group.cards.push(this.card(unit));
    }
    return groups;
  });

  /** "Jump to" links to the rarity headings (not the first one: it is right below). */
  protected readonly jumps = computed(() => (this.tab() === 'rarity' ? this.groups().slice(1) : []));

  protected readonly shown = computed(() => this.groups().reduce((sum, group) => sum + group.cards.length, 0));

  // --- Dialogs ---
  protected readonly editModal = viewChild.required(UnitEditModal);
  protected readonly stmrOpen = signal(false);
  protected readonly stmrUnit = signal<GameUnit | null>(null);
  protected readonly stmrSources = computed(() => {
    const unit = this.stmrUnit();
    return unit && this.owned()[unit.id] ? farmedStmrSources(this.owned()[unit.id]) : [];
  });
  protected readonly awakenOpen = signal(false);
  protected readonly awakenUnit = signal<GameUnit | null>(null);
  protected readonly textOpen = signal(false);
  protected readonly textExport = signal('');
  protected readonly share = new ShareLinkState();
  protected readonly importing = new ImportState();
  protected readonly importKind = signal<'units' | 'consumables'>('units');
  private importedUnits: OwnedUnits | null = null;
  private importedConsumables: Record<string, number> | null = null;
  protected readonly busy = signal(false);

  constructor() {
    inject(Sprites).load('crystals', 'tabs', 'sorts', 'equipments');
    this.start();
  }

  @HostListener('window:keyup.escape')
  protected clearSearch(): void {
    this.search.set('');
    clearSearchBox(this.searchBox());
  }

  private async start(): Promise<void> {
    const fragment = this.route.snapshot.fragment ?? '';
    const linkId = this.linkStore.isLinkId(fragment) ? fragment : null;
    this.readOnly.set(!!linkId);
    this.chrome.headerHidden.set(!!linkId);
    try {
      const [units, released, items] = await Promise.all([
        this.staticData.get<Record<string, GameUnit>>('units', true),
        this.staticData.get<Record<string, ReleasedUnit>>('releasedUnits'),
        this.staticData.get<TrustItem[]>('data', true),
      ]);
      const list = Object.values(units).filter((unit) => !unit.braveShifted);
      this.allUnits.set(units);
      this.releasedIds.set(new Set(Object.keys(released)));
      this.released.set(
        list.filter((unit) => released[unit.id]).map((unit) => ({ ...unit, summon_type: released[unit.id].type })),
      );
      this.items.set(items);
      this.gameDataReady.set(true);
      this.staticData.get<HistoryEntry[]>('lastItemReleases').then((history) => this.history.set(history));
    } catch {
      this.toast.show('Error while loading the unit data', 'error');
      return;
    }
    if (linkId) {
      try {
        this.linked.set(await this.linkStore.load<Record<string, LinkedUnit>>(linkId));
      } catch {
        this.toast.show('Error : no data found', 'error');
      }
      this.linkLoaded.set(true);
    }
  }

  // --- Display ---

  private single(units: GameUnit[], byTrustName = false): Group {
    const cards = units.map((unit) => this.card(unit, byTrustName));
    return { id: 'all', title: '', cards };
  }

  private historyGroups(): Group[] {
    const groups: Group[] = [];
    for (const { date, sources } of this.history()) {
      const cards: Card[] = [];
      for (const source of sources) {
        if (source.type !== 'banner') continue;
        for (const id of source.units ?? []) {
          const unit = this.released().find((u) => u.id === id);
          if (unit && (!this.onlyOwned() || this.owned()[id])) cards.push(this.card(unit));
        }
      }
      if (cards.length) groups.push({ id: date, title: date, cards });
    }
    return groups;
  }

  private card(unit: GameUnit, trustName = false): Card {
    const owned = this.owned()[unit.id];
    const sevenStars = unit.min_rarity !== 'NV' && !!owned?.sevenStar;
    const classes = [
      owned && (owned.number || owned.sevenStar || owned.nv) ? 'owned' : 'notOwned',
      owned?.tmrMoogles ? 'tmrMoogles' : '',
      (owned?.farmable ?? 0) > 0 ? 'farmable' : '',
      (owned?.farmableStmr ?? 0) > 0 ? 'farmableStmr' : '',
      !unit.unreleased7Star && unit.max_rarity === '7' && (owned?.number ?? 0) >= 1 ? 'awakenable' : '',
      unit.summon_type === 'event' ? 'timeLimited' : '',
      sevenStars ? 'sevenStars' : 'notSevenStars',
      isNV(unit) ? 'NV' : 'notNV',
      isNVA(unit) ? 'NVA' : 'notNVA',
      unit.max_rarity === '7' || unit.max_rarity === 'NV' ? 'showStmr' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const tmr = this.trust().tmr[unit.id];
    const stmr = this.trust().stmr[unit.id];
    const farmed = this.farmed();
    const trust = (item: TrustItem | undefined, farmedCount: number, farmable: number) =>
      item || this.readOnly() ? { name: item?.name ?? '', farmed: farmedCount, total: farmedCount + farmable } : null;
    return {
      unit,
      classes,
      image: unitImage(unit, owned),
      rarity: rarityParts(unit.min_rarity, shownMaxRarity(unit)),
      timeLimited: unit.summon_type === 'event',
      name: trustName ? tmr.name : unit.name,
      nv: owned?.nv ?? 0,
      sevenStar: owned?.sevenStar ?? 0,
      base: owned?.number ?? 0,
      crystal:
        { 3: 'blueCrystal', 4: 'goldCrystal', 5: 'rainbowCrystal' }[Number(unit.min_rarity) as 3 | 4 | 5] ?? null,
      moogles: owned?.tmrMoogles ?? [],
      fragments: unit.fragmentId ? (this.inventory.consumables()[unit.fragmentId] ?? 0) : 0,
      tmr: trust(tmr, farmed.tmr[unit.id] ?? 0, owned?.farmable ?? 0),
      stmr: trust(stmr, farmed.stmr[unit.id] ?? 0, owned?.farmableStmr ?? 0),
      sevenStars,
      canAwaken: !unit.unreleased7Star && unit.max_rarity === '7' && (owned?.number ?? 0) >= 1,
    };
  }

  protected setSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.debounce(() => this.search.set(value));
  }

  protected showTab(tab: Tab): void {
    this.tab.set(tab);
  }

  protected toggleOnlyOwned(checked: boolean): void {
    this.onlyOwned.set(checked);
    if (!checked) this.onlySevenStar.set(false);
  }

  protected jumpTo(id: string, event: Event): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView();
  }

  protected highlight(text: string): { text: string; match: boolean }[] {
    const search = this.search().trim();
    if (!search) return [{ text, match: false }];
    const parts: { text: string; match: boolean }[] = [];
    const lower = text.toLowerCase();
    const needle = search.toLowerCase();
    let from = 0;
    for (let at = lower.indexOf(needle); at >= 0; at = lower.indexOf(needle, from)) {
      if (at > from) parts.push({ text: text.slice(from, at), match: false });
      parts.push({ text: text.slice(at, at + needle.length), match: true });
      from = at + needle.length;
    }
    if (from < text.length) parts.push({ text: text.slice(from), match: false });
    return parts;
  }

  // --- Changes of the collection ---

  protected changed(): void {
    this.inventory.changed('itemInventory', 'units', 'consumables');
  }

  protected add(unit: GameUnit): void {
    if (this.readOnly()) return;
    addOne(this.inventory.units(), unit, this.farmed().tmr, this.farmed().stmr);
    this.changed();
  }

  protected farmedTmr(unit: GameUnit): void {
    const item = this.trust().tmr[unit.id];
    const items = this.inventory.items();
    items[item.id] = this.inventory.count(item.id) + 1;
    this.inventory.units()[unit.id].farmable -= 1;
    this.changed();
  }

  protected askFarmedStmr(unit: GameUnit): void {
    this.stmrUnit.set(unit);
    this.stmrOpen.set(true);
  }

  protected farmedStmr(source: StmrSource): void {
    const unit = this.stmrUnit()!;
    const item = this.trust().stmr[unit.id];
    useStmrSource(this.inventory.units()[unit.id], source);
    this.inventory.items()[item.id] = this.inventory.count(item.id) + 1;
    this.stmrOpen.set(false);
    this.changed();
  }

  protected askAwaken(unit: GameUnit): void {
    const mine = this.inventory.units()[unit.id];
    if (this.readOnly() || !mine || mine.number < 1 || unit.max_rarity !== '7') return;
    if (mine.number === 1) {
      awaken(mine, 1);
      this.changed();
    } else {
      this.awakenUnit.set(unit);
      this.awakenOpen.set(true);
    }
  }

  protected awakenWith(copies: 1 | 2): void {
    awaken(this.inventory.units()[this.awakenUnit()!.id], copies);
    this.awakenOpen.set(false);
    this.changed();
  }

  // --- Which fields the edit dialog shows ---
  // --- Exports ---

  protected async exportImage(minRarity: number): Promise<void> {
    this.busy.set(true);
    this.exporting.set({ minRarity });
    try {
      await new Promise((done) => setTimeout(done, 100)); // the owned units are drawn
      const results = this.results()!.nativeElement;
      await picturesLoaded(results);
      downloadBlob(await elementToPng(results), 'FFBE_Equip - Unit collection.png');
    } catch {
      this.toast.show('Error while creating the image', 'error');
    } finally {
      this.exporting.set(null);
      this.busy.set(false);
    }
  }

  protected exportCsv(): void {
    const owned = this.owned();
    const { tmr, stmr } = this.farmed();
    let csv =
      'Unit Id; Unit Name;Min Rarity;Max Rarity;Number Owned (not 7*); 7* Number owned;Number of TMR owned;Number of STMR owned;Number of TMR still farmable;Number of STMR still obtainable\n';
    for (const unit of sortByRarity(Object.values(this.allUnits()), this.releasedIds())) {
      const mine = owned[unit.id];
      if (!mine) continue;
      csv +=
        `"${unit.id}";"${unit.name}";${unit.min_rarity};${shownMaxRarity(unit)};${mine.number};${mine.sevenStar ?? 0};` +
        `${tmr[unit.id] ?? 0};${stmr[unit.id] ?? 0};${mine.farmable};${mine.farmableStmr ?? 0}\n`;
    }
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'FFBE_Equip - Unit collection.csv');
  }

  protected exportText(): void {
    const owned = this.owned();
    const byBase = [...this.released()].sort((a, b) =>
      a.min_rarity === b.min_rarity ? a.name.localeCompare(b.name) : Number(b.min_rarity) - Number(a.min_rarity),
    );
    const sections = new Map<string | number, string[]>();
    for (const unit of byBase) {
      const mine = owned[unit.id];
      if (!mine) continue;
      const names = sections.get(unit.min_rarity) ?? [];
      names.push(unit.name + (mine.number > 1 ? ` x${mine.number}` : ''));
      sections.set(unit.min_rarity, names);
    }
    this.textExport.set([...sections].map(([rarity, names]) => `Base ${rarity}★  \n${names.join(', ')}`).join('\n\n'));
    this.textOpen.set(true);
  }

  protected copyText(): void {
    void copyToClipboard(this.textExport()).then((ok) => ok && this.toast.show('Copied to the clipboard'));
  }

  /** The link is a snapshot of the collection at the moment of the click (it is not updated afterwards). */
  protected async shareCollection(): Promise<void> {
    const owned = this.owned();
    const { tmr, stmr } = this.farmed();
    const snapshot: Record<string, LinkedUnit> = {};
    for (const unit of this.released()) {
      const mine = owned[unit.id];
      if (!mine) continue;
      const pub: LinkedUnit = { number: mine.number, farmable: 0, farmed: tmr[unit.id] ?? 0 };
      if (mine.sevenStar) {
        pub.sevenStar = mine.sevenStar;
        pub.farmedStmr = stmr[unit.id] ?? 0;
      }
      if (mine.nv) {
        pub.nv = mine.nv;
        pub.farmedStmr = stmr[unit.id] ?? 0;
      }
      snapshot[unit.id] = pub;
    }
    try {
      const id = await this.linkStore.save(snapshot);
      const url = new URL('units', document.baseURI);
      url.search = `?server=${this.server()}&o`;
      this.share.show(`${url.href}#${id}`);
    } catch {
      this.toast.show('Error while creating the public link', 'error');
    }
  }

  // --- Imports ---

  protected openImport(kind: 'units' | 'consumables'): void {
    this.importKind.set(kind);
    this.importedUnits = null;
    this.importedConsumables = null;
    this.importing.start();
  }

  protected loadImportFile(data: unknown): void {
    if (this.importKind() === 'units') {
      if (!isUnitFile(data)) return this.toast.show("The imported file doesn't have the correct form", 'error');
      const { owned, messages } = importUnits(data, {
        server: this.server(),
        releasedUnits: this.released(),
        units: this.allUnits(),
        items: this.items(),
      });
      this.importedUnits = owned;
      this.importing.messages.set(messages);
      this.importing.summary.set(`Units to import : ${Object.keys(owned).length}`);
    } else {
      if (!isConsumablesFile(data)) return this.toast.show("The imported file doesn't have the correct form", 'error');
      this.importedConsumables = consumablesFromFile(data);
      this.importing.summary.set(`Consumables to import : ${Object.keys(this.importedConsumables).length}`);
    }
  }

  protected async runImport(): Promise<void> {
    if (this.importKind() === 'units' && this.importedUnits) {
      this.importing.open.set(false);
      await this.inventory.replace('units', this.importedUnits);
    } else if (this.importKind() === 'consumables' && this.importedConsumables) {
      this.importing.open.set(false);
      await this.inventory.replace('consumables', this.importedConsumables);
    } else {
      this.toast.show('Please select a file to import', 'warn');
    }
  }
}

/** A unit of a shared collection: what the owner owned, and how many TMR / STMR were farmed. */
interface LinkedUnit extends OwnedUnit {
  farmed?: number;
  farmedStmr?: number;
}
