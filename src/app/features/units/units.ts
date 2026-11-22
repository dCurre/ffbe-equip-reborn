import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ShareLinkState } from '../../shared/state/share-link-state';
import { ImportState } from '../../shared/state/import-state';
import { ActivatedRoute } from '@angular/router';
import { PageContent } from '../../layout/page-content/page-content';
import { SiteFooter } from '../../layout/site-footer/site-footer';
import { downloadBlob } from '../../shared/helpers/export';
import { Inventory, OwnedUnit, OwnedUnits } from '../../shared/services/inventory';
import { LinkStore } from '../../shared/services/link-store';
import { PageChrome } from '../../shared/services/page-chrome';
import { ServerContext } from '../../shared/services/server-context';
import { highlightText } from '../../shared/helpers/highlight';
import { searchTokens } from '../../game/helpers/item';
import { showMoreOnScroll } from '../../shared/helpers/infinite-scroll';
import { SearchBox } from '../../shared/components/search-box/search-box';
import { StaticData } from '../../shared/services/static-data';
import { Toast } from '../../shared/services/toast';
import { Icon } from '../../shared/components/icon/icon';
import { Button } from '../../shared/components/button/button';
import { Choice, ChoiceGroup } from '../../shared/components/choice-group/choice-group';
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
  initialOf,
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
  baseCrystal,
  rarityLabel,
  rarityParts,
  canRemove,
  maxTrust,
  removeOne,
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

/** The cards drawn at first, and each time the end of the list comes into view: the whole collection is a lot of cards. */
const PAGE_SIZE = 60;

type Tab = 'rarity' | 'alphabetical' | 'tmr' | 'history';

interface Group {
  /** the id of the group */
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
    ChoiceGroup,
    SearchBox,
    Button,
    ImportModal,
    ShareLinkModal,
    TextExportModal,
    UnitEditModal,
    UnitCard,
    UnitCollectionStats,
    UnitStmrModal,
    UnitAwakenModal,
    Icon,
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
  protected readonly allUnits = signal<Record<string, GameUnit>>({});
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
  /** the EX levels to show ('0' to '3'); none selected shows every unit */
  protected readonly selectedEx = signal<readonly string[]>([]);
  /** the first letters to show on the tabs that sort by name; none selected shows every letter */
  protected readonly selectedLetters = signal<readonly string[]>([]);
  protected readonly exChoices: Choice[] = ['0', '1', '2', '3'].map((value) => ({ value, icon: 'level', label: value, tooltip: `EX level ${value}` }));
  protected readonly sidebarCollapsed = signal(window.innerWidth < 990);
  protected readonly exportItems: MenuItem[] = [
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
  private readonly searchBox = viewChild(SearchBox);
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
    { key: 'NVA', crystal: 'crystal-NVA', title: 'NVA units' },
    { key: 'NV', crystal: 'crystal-NV', title: 'NV units' },
    { key: '7', crystal: 'crystal-sevenStarCrystal', title: 'Units awakened to 7★' },
    { key: '5', crystal: 'crystal-rainbowCrystal', title: 'Units with base 5★' },
    { key: '4', crystal: 'crystal-goldCrystal', title: 'Units with base 4★' },
    { key: '3', crystal: 'crystal-blueCrystal', title: 'Units with base 3★' },
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
    const tab = this.tab();
    let units: GameUnit[] = this.released();
    const search = this.search().trim();
    if (tab === 'tmr') units = filterByTrustName(units, this.trust().tmr, search);
    else if (search) units = filterByName(units, search);
    if ((tab === 'alphabetical' || tab === 'tmr') && this.selectedLetters().length) {
      units = units.filter((unit) => this.selectedLetters().includes(initialOf(this.sortName(unit, tab === 'tmr'))));
    }
    return units.filter((unit) => this.passesFilters(unit));
  });

  /** The four checkboxes; "owned" is what the card's `owned` class says: a unit with only TMR to farm is not owned. */
  private passesFilters(unit: GameUnit): boolean {
    const mine = this.owned()[unit.id];
    if (this.onlyOwned() && !(mine && (mine.number || mine.sevenStar || mine.nv))) return false;
    if (this.onlyOwned() && this.onlySevenStar() && !(unit.min_rarity !== 'NV' && mine?.sevenStar)) return false;
    if (this.onlyTimeLimited() && unit.summon_type !== 'event') return false;
    if (this.selectedGroups().length && !this.selectedGroups().includes(this.groupId(unit))) return false;
    // an EX level only exists on an NV copy you own
    if (this.selectedEx().length && !(mine?.nv && this.selectedEx().includes(String(mine.exRank ?? 0)))) return false;
    return !this.onlyTmrMoogles() || !!mine?.tmrMoogles?.length;
  }

  /** The id of the rarity group of a unit: "min of max" (a "soon" NVA is apart). It is the id of its heading too. */
  private groupId(unit: GameUnit): string {
    const soon = isSoonNVA(unit, this.releasedIds());
    return `rarity-${unit.min_rarity}-of-${shownMaxRarity(unit)}${soon ? '_soon' : ''}`;
  }

  /** The rarity groups to choose from (a filter): every group of the released units, whatever the other filters say. */
  protected readonly selectedGroups = signal<readonly string[]>([]);
  protected readonly groupChoices = computed<Choice[]>(() => {
    const released = this.releasedIds();
    const choices = new Map<string, Choice>();
    for (const unit of sortByRarity(this.released(), released)) {
      const value = this.groupId(unit);
      if (choices.has(value)) continue;
      const max = shownMaxRarity(unit);
      const soon = isSoonNVA(unit, released);
      const { icon, text } = rarityParts(unit.min_rarity, max, soon);
      choices.set(
        value,
        icon
          ? { value, icon: icon.replace('crystal-', ''), label: text.trim() || undefined, tooltip: soon ? 'NVA units (soon)' : unit.min_rarity === 'NV' ? 'NV units' : 'NVA units' }
          : { value, label: rarityLabel(unit.min_rarity, max, soon), tooltip: `Base ${unit.min_rarity}★, up to ${max}★` },
      );
    }
    return [...choices.values()];
  });

  protected readonly groups = computed<Group[]>(() => {
    const tab = this.tab();
    const released = this.releasedIds();
    if (tab === 'history') return this.historyGroups();
    if (tab === 'alphabetical') return this.byLetter(sortAlphabetically(this.visible()), false);
    if (tab === 'tmr') return this.byLetter(sortByTrustName(this.visible(), this.trust().tmr), true);
    // by rarity: one heading for each "min of max" rarity
    const groups: Group[] = [];
    for (const unit of sortByRarity(this.visible(), released)) {
      const soon = isSoonNVA(unit, released);
      const max = shownMaxRarity(unit);
      const id = this.groupId(unit);
      let group = groups[groups.length - 1];
      if (group?.id !== id) {
        group = { id, title: id, rarity: rarityParts(unit.min_rarity, max, soon), cards: [] };
        groups.push(group);
      }
      group.cards.push(this.card(unit));
    }
    return groups;
  });


  protected readonly shown = computed(() => this.groups().reduce((sum, group) => sum + group.cards.length, 0));

  /** The cards drawn so far: it starts again from the first page when the search or a filter changes (not when a unit is edited). */
  private readonly limit = linkedSignal<unknown, number>({
    source: () => [
      this.tab(),
      this.search(),
      this.onlyOwned(),
      this.onlySevenStar(),
      this.onlyTimeLimited(),
      this.onlyTmrMoogles(),
      this.selectedGroups(),
      this.selectedEx(),
      this.selectedLetters(),
    ],
    computation: () => PAGE_SIZE,
  });
  private readonly end = viewChild<ElementRef<HTMLElement>>('end');

  /** The groups cut after `limit` cards. */
  protected readonly visibleGroups = computed<Group[]>(() => {
    const groups = this.groups();
    let left = this.limit();
    const visible: Group[] = [];
    for (const group of groups) {
      if (left <= 0) break;
      visible.push(left >= group.cards.length ? group : { ...group, cards: group.cards.slice(0, left) });
      left -= group.cards.length;
    }
    return visible;
  });

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

  constructor() {
    showMoreOnScroll(this.end, this.limit, () => this.shown(), PAGE_SIZE, '600px');
    afterRenderEffect(() => {
      this.visibleGroups();
      const results = this.results()?.nativeElement;
      if (results) highlightText(results, this.tab() === 'history' ? [] : searchTokens(this.search().trim()));
    });
    this.start();
  }

  @HostListener('window:keyup.escape')
  protected clearSearch(): void {
    this.search.set('');
    this.searchBox()?.clear();
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

  /**
   * The card of every unit, built once and again only when the collection changes: a filter or a search then only adds or
   * removes cards, the others are the same objects and are not drawn again.
   */
  private readonly cards = computed(() => {
    const cards = new Map<string, Card>();
    for (const unit of this.released()) cards.set(unit.id, this.buildCard(unit));
    return cards;
  });

  /** The same cards for the Trust tab: named after their TMR. */
  private readonly trustCards = computed(() => {
    const cards = new Map<string, Card>();
    for (const [id, card] of this.cards()) {
      const tmr = this.trust().tmr[id];
      if (tmr) cards.set(id, { ...card, name: tmr.name });
    }
    return cards;
  });

  private card(unit: GameUnit, trustName = false): Card {
    return (trustName ? this.trustCards() : this.cards()).get(unit.id)!;
  }

  private sortName(unit: GameUnit, byTrustName: boolean): string {
    return byTrustName ? this.trust().tmr[unit.id].name : unit.name;
  }

  /** The units (already sorted by name) with one heading for each first letter. */
  private byLetter(units: GameUnit[], byTrustName: boolean): Group[] {
    const groups: Group[] = [];
    for (const unit of units) {
      const letter = initialOf(this.sortName(unit, byTrustName));
      if (groups[groups.length - 1]?.title !== letter) groups.push({ id: `letter-${letter}`, title: letter, cards: [] });
      groups[groups.length - 1].cards.push(this.card(unit, byTrustName));
    }
    return groups;
  }

  /** One letter at a time: choosing another replaces the one before, choosing the same one shows every letter again. */
  protected pickLetter(letters: readonly string[]): void {
    const added = letters.find((letter) => !this.selectedLetters().includes(letter));
    this.selectedLetters.set(added ? [added] : []);
  }

  /** The letters to choose from on the tabs that sort by name: the ones some unit (or TMR) starts with. */
  protected readonly letterChoices = computed<Choice[]>(() => {
    const byTrustName = this.tab() === 'tmr';
    const letters = new Set(
      this.released()
        .filter((unit) => !byTrustName || this.trust().tmr[unit.id])
        .map((unit) => initialOf(this.sortName(unit, byTrustName))),
    );
    return [...letters].sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value, tooltip: `Names starting with ${value}` }));
  });

  private historyGroups(): Group[] {
    const groups: Group[] = [];
    for (const { date, sources } of this.history()) {
      const cards: Card[] = [];
      for (const source of sources) {
        if (source.type !== 'banner') continue;
        for (const id of source.units ?? []) {
          const card = this.cards().get(id);
          if (card && this.passesFilters(card.unit)) cards.push(card);
        }
      }
      if (cards.length) groups.push({ id: date, title: date, cards });
    }
    return groups;
  }

  private buildCard(unit: GameUnit): Card {
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
      item || this.readOnly() ? { name: item?.name ?? '', item, farmed: farmedCount, total: farmedCount + farmable } : null;
    return {
      unit,
      classes,
      image: unitImage(unit, owned),
      rarity: rarityParts(unit.min_rarity, shownMaxRarity(unit)),
      timeLimited: unit.summon_type === 'event',
      name: unit.name,
      nv: owned?.nv ?? 0,
      exRank: owned?.exRank ?? 0,
      hasEx: unit.max_rarity === 'NV',
      canRaiseEx: unit.max_rarity === 'NV' && (owned?.nv ?? 0) > 0 && (owned?.exRank ?? 0) < 3,
      sevenStar: owned?.sevenStar ?? 0,
      base: owned?.number ?? 0,
      crystal: baseCrystal(unit),
      moogles: owned?.tmrMoogles ?? [],
      fragments: unit.fragmentId ? (this.inventory.consumables()[unit.fragmentId] ?? 0) : 0,
      tmr: trust(tmr, farmed.tmr[unit.id] ?? 0, owned?.farmable ?? 0),
      stmr: trust(stmr, farmed.stmr[unit.id] ?? 0, owned?.farmableStmr ?? 0),
      sevenStars,
      canAwaken: !unit.unreleased7Star && unit.max_rarity === '7' && (owned?.number ?? 0) >= 1,
      canRemove: canRemove(unit, owned),
      farmable: (owned?.farmable ?? 0) > 0,
      farmableStmr: (owned?.farmableStmr ?? 0) > 0,
      canStmr: unit.max_rarity === '7' || unit.max_rarity === 'NV',
    };
  }


  protected showTab(tab: Tab): void {
    this.selectedLetters.set([]); // the letters belong to the tab (unit names or TMR names)
    this.tab.set(tab);
  }

  /** How many filters are on (the search is not one); a group of rarity counts for one each. */
  protected readonly activeFilters = computed(
    () =>
      [this.onlyOwned(), this.onlySevenStar(), this.onlyTimeLimited(), this.onlyTmrMoogles()].filter(Boolean).length +
      this.selectedGroups().length +
      this.selectedEx().length +
      this.selectedLetters().length,
  );

  protected clearFilters(): void {
    this.onlyOwned.set(false);
    this.onlySevenStar.set(false);
    this.onlyTimeLimited.set(false);
    this.onlyTmrMoogles.set(false);
    this.selectedGroups.set([]);
    this.selectedEx.set([]);
    this.selectedLetters.set([]);
  }

  protected toggleOnlyOwned(checked: boolean): void {
    this.onlyOwned.set(checked);
    if (!checked) this.onlySevenStar.set(false);
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

  protected remove(unit: GameUnit): void {
    if (this.readOnly()) return;
    removeOne(this.inventory.units(), unit, this.farmed().tmr, this.farmed().stmr);
    // the TMR / STMR cannot be more than the copies left: all gone when the unit is
    const mine = this.inventory.units()[unit.id];
    const max = mine ? maxTrust(unit, { number: mine.number, sevenStar: mine.sevenStar ?? 0, nv: mine.nv ?? 0 }) : { tmr: 0, stmr: 0 };
    for (const [item, limit] of [[this.trust().tmr[unit.id], max.tmr], [this.trust().stmr[unit.id], max.stmr]] as const) {
      if (!item) continue;
      const kept = Math.min(this.inventory.count(item.id), limit);
      if (kept) this.inventory.items()[item.id] = kept;
      else delete this.inventory.items()[item.id];
    }
    this.changed();
  }

  protected raiseEx(unit: GameUnit): void {
    const mine = this.inventory.units()[unit.id];
    if (this.readOnly() || !mine || (mine.exRank ?? 0) >= 3) return;
    mine.exRank = (mine.exRank ?? 0) + 1;
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
        if (mine.exRank) pub.exRank = mine.exRank;
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
