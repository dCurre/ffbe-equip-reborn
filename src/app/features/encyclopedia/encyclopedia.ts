import { Location } from '@angular/common';
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
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ailmentList, baseStats, elementList, killerList } from '../../../core/constants/base-lists';
import {
  shieldList,
  bodyList,
  headList,
  typeList,
  typeListLiterals,
  weaponList,
} from '../../../core/constants/item-types';
import { Item, ItemQuery, filterItems, sortItems, searchTokens, buildSearchString } from '../../game/helpers/item';
import { FullUnit, TargetUnitPanel } from './target-unit-panel/target-unit-panel';
import { ItemLine } from '../../game/components/item-line/item-line';
import { cardsAsItems, VisionCard } from '../../game/helpers/vision-cards';
import { PageContent } from '../../layout/page-content/page-content';
import { SiteFooter } from '../../layout/site-footer/site-footer';
import { SearchBox } from '../../shared/components/search-box/search-box';
import { TabPanel } from '../../shared/components/tab-panel/tab-panel';
import { tabsWithCounts } from '../../shared/components/tab-bar/tab-bar';
import { ActiveFilter, ActiveFilters } from '../unit-search/active-filters/active-filters';
import { highlightText } from '../../shared/helpers/highlight';
import { Inventory } from '../../shared/services/inventory';
import { StaticData } from '../../shared/services/static-data';
import { Choice, ChoiceGroup } from '../../shared/components/choice-group/choice-group';
import { Button } from '../../shared/components/button/button';
import { Panel } from '../../shared/components/panel/panel';
import { FilterHeading } from '../../shared/components/filter-heading/filter-heading';
import { Checkbox } from '../../shared/components/checkbox/checkbox';
import { ResultsHeading } from '../../shared/components/results-heading/results-heading';
import { ResultsSwitch } from '../../shared/components/results-switch/results-switch';
import { showMoreOnScroll } from '../../shared/helpers/infinite-scroll';
import { STRINGS } from '../../strings/en';

/** The filters as they are saved in the `#...` of the URL (base64 of this object; the old site wrote the same). */
interface SavedState {
  stat?: string;
  types?: string[];
  elements?: string[];
  ailments?: string[];
  physicalKillers?: string[];
  magicalKillers?: string[];
  accessToRemove?: string[];
  additionalStat?: string[];
  search?: string;
  unit?: string;
  baseStats?: Record<string, string>;
  onlyShowOwnedItems?: boolean;
  showNotReleasedYet?: boolean;
  elementsAnd?: boolean;
  ailmentsAnd?: boolean;
  killersAnd?: boolean;
}

type Group = 'item' | 'stats' | 'effects';
const GROUPS: { key: Group; title: string }[] = [
  { key: 'item', title: STRINGS.encyclopedia.item },
  { key: 'stats', title: STRINGS.encyclopedia.stats },
  { key: 'effects', title: STRINGS.encyclopedia.effects },
];

const PAGE_SIZE = 50;
const ucFirst = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const ACCESS_FILTERS = [
  { icon: 'shop', value: 'shop', tooltip: STRINGS.encyclopedia.itemsFromTownShops },
  { icon: 'story', value: 'chest/quest', tooltip: STRINGS.encyclopedia.itemsFromStoryChests },
  { icon: 'key', value: 'key', tooltip: STRINGS.encyclopedia.itemsObtainedWithVault },
  { icon: 'colosseum', value: 'colosseum', tooltip: STRINGS.encyclopedia.itemsObtainedInThe },
  { icon: 'tmr_1-2stars', value: 'TMR-1*/TMR-2*', tooltip: STRINGS.encyclopedia.tmrOf1Or },
  { icon: 'tmr_3-4stars', value: 'TMR-3*/TMR-4*', tooltip: STRINGS.encyclopedia.tmrOf3Or },
  { icon: 'tmr_5stars', value: 'TMR-5*', tooltip: STRINGS.encyclopedia.tmrOf5Base },
  { icon: 'stmr', value: 'STMR', tooltip: STRINGS.encyclopedia.superTmrOf7 },
  { icon: 'event', value: 'event', tooltip: STRINGS.encyclopedia.itemsFromEventRewards },
  { icon: 'recipe', value: 'recipe', tooltip: STRINGS.encyclopedia.itemsCraftedFromRecipes },
  { icon: 'trophy', value: 'trophy', tooltip: STRINGS.encyclopedia.itemsEarnedFromTrophy },
  { icon: 'chocobo', value: 'chocobo', tooltip: STRINGS.encyclopedia.itemsExchangedWithFat },
  { icon: 'trial', value: 'trial', tooltip: STRINGS.encyclopedia.itemsFromTrialRewards },
  { icon: 'unitExclusive', value: 'unitExclusive', tooltip: STRINGS.encyclopedia.itemsHavingAnAbility },
  { icon: 'premium', value: 'premium', tooltip: STRINGS.encyclopedia.itemsFromPremiumPaid },
  { icon: 'darkVision', value: 'darkVision', tooltip: STRINGS.encyclopedia.itemsFromDarkVision },
].map((access) => ({ ...access, tooltip: `Filter out ${access.tooltip}` }));

const connector = (what: string): Choice[] => [
  { value: 'or', label: STRINGS.encyclopedia.or, tooltip: `Show items having at least one of the selected ${what}` },
  { value: 'and', label: STRINGS.encyclopedia.and, tooltip: `Show items having all of the selected ${what}` },
];

/** Search and filter every item of the game by type, element, stat, access, killer, ... */
@Component({
  selector: 'app-encyclopedia',
  imports: [
    PageContent,
    SiteFooter,
    SearchBox,
    TabPanel,
    ActiveFilters,
    Checkbox,
    FilterHeading,
    ResultsHeading,
    Panel,
    Button,
    ChoiceGroup,
    ItemLine,
    ResultsSwitch,
    TargetUnitPanel,
    FormsModule,
  ],
  templateUrl: './encyclopedia.html',
  styleUrls: ['../../shared/styles/search-page.css', './encyclopedia.css'],
})
export class Encyclopedia {
  protected readonly t = STRINGS.encyclopedia;
  private readonly staticData = inject(StaticData);
  private readonly inventory = inject(Inventory);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);

  // --- Game data ---
  protected readonly items = signal<Item[]>([]);
  protected readonly units = signal<Record<string, FullUnit>>({});
  protected readonly unitList = computed(() =>
    Object.values(this.units()).sort((a, b) => a.name.localeCompare(b.name)),
  );
  protected readonly enchantments = signal<Record<string, { effects: string }>>({});
  protected readonly ready = signal(false);

  // --- Filters ---
  protected readonly search = signal('');
  private readonly searchBox = viewChild(SearchBox);
  protected readonly tab = signal<Group>('item');
  protected readonly stat = signal<readonly string[]>([]);
  protected readonly percentageStat = signal(false);
  protected readonly staticStats = signal(false);
  protected readonly baseStatText = signal<Record<string, string>>({});
  protected readonly types = signal<readonly string[]>([]);
  protected readonly elements = signal<readonly string[]>([]);
  protected readonly ailments = signal<readonly string[]>([]);
  protected readonly physicalKillers = signal<readonly string[]>([]);
  protected readonly magicalKillers = signal<readonly string[]>([]);
  protected readonly accessToRemove = signal<readonly string[]>([]);
  protected readonly additionalStat = signal<readonly string[]>([]);
  protected readonly elementsLogic = signal<readonly string[]>(['or']);
  protected readonly ailmentsLogic = signal<readonly string[]>(['or']);
  protected readonly killersLogic = signal<readonly string[]>(['or']);
  protected readonly onlyOwned = signal(false);
  protected readonly showNotReleased = signal(false);
  protected readonly unitName = signal('');
  /** on a phone only the filters or the results are shown */
  protected readonly showingResults = signal(false);

  // --- What the filters offer ---
  protected readonly statChoices: Choice[] = ['hp', 'mp', 'atk', 'def', 'mag', 'spr', 'evade', 'inflict', 'resist'].map(
    (value) => ({ value, tooltip: `Show items having ${value.toUpperCase()} stats` }),
  );
  protected readonly typeChoices: Choice[] = typeList.map((value) => ({
    value,
    tooltip: (typeListLiterals as Record<string, string>)[value],
  }));
  protected readonly elementChoices: Choice[] = [...elementList, 'noElement'].map((value) => ({
    value,
    tooltip: ucFirst(value),
  }));
  protected readonly ailmentChoices: Choice[] = ailmentList.map((value) => ({ value, tooltip: ucFirst(value) }));
  protected readonly physicalKillerChoices: Choice[] = killerList.map((value) => ({
    value,
    tooltip: `Physical ${value} killer`,
  }));
  protected readonly magicalKillerChoices: Choice[] = killerList.map((value) => ({
    value,
    tooltip: `Magical ${value} killer`,
  }));
  protected readonly accessChoices: Choice[] = ACCESS_FILTERS;
  protected readonly additionalStatChoices: Choice[] = [...baseStats, 'twoHanded'].map((value) => ({
    value,
    tooltip: value.toUpperCase(),
  }));
  protected readonly elementsConnector = connector('elements');
  protected readonly ailmentsConnector = connector('ailments');
  protected readonly killersConnector = connector('killers');
  protected readonly weapons = weaponList;
  protected readonly armors = [...shieldList, ...headList, ...bodyList];

  protected readonly unit = computed(() => this.unitList().find((u) => u.name === this.unitName()));

  protected readonly selectedStat = computed(() => this.stat()[0] ?? '');
  /** the unit's base stat for the selected stat: what the % of the items is computed on */
  private readonly baseStat = computed(() => {
    const stat = this.selectedStat();
    if (!baseStats.includes(stat)) return 0;
    const value = parseInt(this.baseStatText()[stat] ?? '', 10);
    return Number.isNaN(value) ? (stat === 'hp' ? 3500 : 180) : value;
  });

  protected readonly hasFilter = computed(
    () =>
      this.onlyOwned() ||
      !!(this.selectedStat() || this.search().trim()) ||
      [
        this.types(),
        this.elements(),
        this.ailments(),
        this.physicalKillers(),
        this.magicalKillers(),
        this.accessToRemove(),
        this.additionalStat(),
      ].some((filter) => filter.length > 0),
  );

  protected readonly results = computed<Item[]>(() => {
    if (!this.hasFilter() || !this.ready()) return [];
    const unit = this.unit();
    const query: ItemQuery = {
      stat: this.selectedStat(),
      text: this.search(),
      types: this.types(),
      elements: this.elements(),
      ailments: this.ailments(),
      physicalKillers: this.physicalKillers(),
      magicalKillers: this.magicalKillers(),
      accessToRemove: this.accessToRemove(),
      additionalStats: this.additionalStat(),
      elementsAnd: this.elementsLogic()[0] === 'and',
      ailmentsAnd: this.ailmentsLogic()[0] === 'and',
      killersAnd: this.killersLogic()[0] === 'and',
      unit: unit && { id: unit.id, roles: unit.roles, sex: unit.sex },
      showNotReleasedYet: this.showNotReleased(),
      onlyOwned: this.onlyOwned() && this.loggedIn() ? this.inventory.items() : undefined,
    };
    return sortItems(
      filterItems(this.items(), query, {
        baseStat: this.baseStat(),
        percentageStat: this.percentageStat(),
        staticStats: this.staticStats(),
      }),
    );
  });

  /** The rows drawn: more of them are added when the end of the list comes into view. */
  private readonly limit = linkedSignal<Item[], number>({ source: this.results, computation: () => PAGE_SIZE });
  protected readonly visible = computed(() => this.results().slice(0, this.limit()));
  private readonly end = viewChild<ElementRef<HTMLElement>>('end');
  private readonly table = viewChild<ElementRef<HTMLElement>>('table');

  protected readonly loggedIn = computed(() => this.inventory.status() === 'loaded');
  protected readonly dimmedStats = computed(() => {
    const additional = this.additionalStat();
    if (additional.length === 0) return '';
    return baseStats
      .filter((stat) => !additional.includes(stat) && stat !== this.selectedStat())
      .map((stat) => `dim-${stat}`)
      .join(' ');
  });
  protected readonly hasKillers = computed(() => this.physicalKillers().length + this.magicalKillers().length > 0);
  /** The filters that are on, as chips under the search box; the tabs count them. */
  protected readonly filters = computed<(ActiveFilter & { group: Group })[]>(() => {
    const names = (choices: Choice[], values: readonly string[]): string =>
      values.map((v) => choices.find((c) => c.value === v)?.tooltip ?? v).join(', ');
    const upper = (values: readonly string[]): string => values.map((v) => v.toUpperCase()).join(', ');
    const logic = (and: readonly string[]): string => (and[0] === 'and' ? ' (all)' : '');
    const killers = [
      ...this.physicalKillers().map((v) => `Physical ${v}`),
      ...this.magicalKillers().map((v) => `Magical ${v}`),
    ];
    const list: (ActiveFilter & { group: Group })[] = [];
    const add = (key: string, group: Group, label: string, present: boolean): void => {
      if (present) list.push({ key, group, label });
    };
    add('types', 'item', `Types: ${names(this.typeChoices, this.types())}`, this.types().length > 0);
    add('accessToRemove', 'item', `Without: ${this.accessToRemove().join(', ')}`, this.accessToRemove().length > 0);
    add('unit', 'stats', `Unit: ${this.unitName()}`, !!this.unit());
    add('stat', 'stats', `Sorted by ${upper(this.stat())}`, this.stat().length > 0);
    add('additionalStat', 'stats', `Also: ${upper(this.additionalStat())}`, this.additionalStat().length > 0);
    add(
      'elements',
      'effects',
      `Elements${logic(this.elementsLogic())}: ${names(this.elementChoices, this.elements())}`,
      this.elements().length > 0,
    );
    add(
      'ailments',
      'effects',
      `Ailments${logic(this.ailmentsLogic())}: ${names(this.ailmentChoices, this.ailments())}`,
      this.ailments().length > 0,
    );
    add('killers', 'effects', `Killers${logic(this.killersLogic())}: ${killers.join(', ')}`, killers.length > 0);
    return list;
  });
  protected readonly tabs = computed(() => tabsWithCounts(GROUPS, this.filters()));
  protected readonly ownedCount = (item: Item): number | null =>
    this.loggedIn() ? this.inventory.count(item.id) : null;

  /** The filters, as they are written in the URL. */
  private readonly saved = computed<SavedState>(() => {
    const state: SavedState = {};
    const add = <K extends keyof SavedState>(key: K, value: SavedState[K], present: boolean): void => {
      if (present) state[key] = value;
    };
    add('stat', this.selectedStat(), !!this.selectedStat());
    add('types', [...this.types()], this.types().length > 0);
    add('elements', [...this.elements()], this.elements().length > 0);
    add('ailments', [...this.ailments()], this.ailments().length > 0);
    add('physicalKillers', [...this.physicalKillers()], this.physicalKillers().length > 0);
    add('magicalKillers', [...this.magicalKillers()], this.magicalKillers().length > 0);
    add('accessToRemove', [...this.accessToRemove()], this.accessToRemove().length > 0);
    add('additionalStat', [...this.additionalStat()], this.additionalStat().length > 0);
    add('search', this.search(), !!this.search());
    add('unit', this.unitName(), !!this.unit());
    const stats = Object.fromEntries(Object.entries(this.baseStatText()).filter(([, value]) => value));
    add('baseStats', stats, Object.keys(stats).length > 0);
    add('onlyShowOwnedItems', true, this.onlyOwned());
    add('showNotReleasedYet', true, this.showNotReleased());
    add('elementsAnd', true, this.elementsLogic()[0] === 'and');
    add('ailmentsAnd', true, this.ailmentsLogic()[0] === 'and');
    add('killersAnd', true, this.killersLogic()[0] === 'and');
    return state;
  });

  constructor() {
    // keep the filters in the URL, so a search can be shared
    afterRenderEffect(() => {
      const state = this.saved();
      if (!this.ready()) return;
      const hash = Object.keys(state).length
        ? window.btoa(decodeURIComponent(encodeURIComponent(JSON.stringify(state))))
        : '';
      this.location.replaceState(this.location.path(false), '', hash ? `#${hash}` : '');
    });
    // the end of the list in view: draw more rows
    showMoreOnScroll(this.end, this.limit, () => this.results().length, PAGE_SIZE, '400px');
    // the words searched are highlighted in the rows
    afterRenderEffect(() => {
      this.visible();
      const table = this.table()?.nativeElement;
      if (table) highlightText(table, searchTokens(this.search()));
    });
    this.start();
  }

  private async start(): Promise<void> {
    const [data, cards, units, enchantments] = await Promise.all([
      this.staticData.get<Item[]>('data', true),
      this.staticData.get<Record<string, VisionCard>>('visionCards'),
      this.staticData.get<Record<string, FullUnit>>('units', true),
      this.staticData.get<Record<string, { effects: string }>>('itemEnchants'),
    ]);
    const items = [...data, ...cardsAsItems(cards)];
    for (const item of items) item.searchString = buildSearchString(item, units);
    this.items.set(items);
    this.units.set(units);
    this.enchantments.set(enchantments);
    this.loadFromUrl(units);
    this.ready.set(true);
  }

  /** Reads the filters of the `#...` of the URL (base64 or plain JSON, as the old links). */
  private loadFromUrl(units: Record<string, FullUnit>): void {
    const fragment = this.route.snapshot.fragment;
    if (!fragment) return;
    let state: SavedState;
    try {
      state = fragment.startsWith('{')
        ? JSON.parse(decodeURIComponent(fragment))
        : JSON.parse(decodeURIComponent(escape(window.atob(fragment))));
    } catch {
      return;
    }
    if (state.unit) {
      const unit = units[state.unit] ?? Object.values(units).find((u) => u.name === state.unit);
      if (unit) this.unitName.set(unit.name);
    }
    this.baseStatText.set(state.baseStats ?? {});
    if (state.stat) this.stat.set([state.stat]);
    this.search.set(state.search ?? '');
    this.types.set(state.types ?? []);
    this.elements.set(state.elements ?? []);
    this.ailments.set(state.ailments ?? []);
    this.physicalKillers.set(state.physicalKillers ?? []);
    this.magicalKillers.set(state.magicalKillers ?? []);
    this.accessToRemove.set(state.accessToRemove ?? []);
    this.additionalStat.set(state.additionalStat ?? []);
    this.onlyOwned.set(!!state.onlyShowOwnedItems);
    this.showNotReleased.set(!!state.showNotReleasedYet);
    this.elementsLogic.set([state.elementsAnd ? 'and' : 'or']);
    this.ailmentsLogic.set([state.ailmentsAnd ? 'and' : 'or']);
    this.killersLogic.set([state.killersAnd ? 'and' : 'or']);
  }

  // --- Actions ---

  @HostListener('window:keyup.escape')
  protected clearSearch(): void {
    this.search.set('');
    this.searchBox()?.clear();
  }

  protected removeFilter(key: string): void {
    const signals: Record<string, { set(value: never[]): void }> = {
      types: this.types,
      elements: this.elements,
      ailments: this.ailments,
      accessToRemove: this.accessToRemove,
      additionalStat: this.additionalStat,
      stat: this.stat,
    };
    if (key === 'killers') {
      this.physicalKillers.set([]);
      this.magicalKillers.set([]);
    } else if (key === 'unit') {
      this.unitName.set('');
      this.baseStatText.set({});
    } else signals[key].set([]);
  }

  protected clearFilters(): void {
    for (const key of ['types', 'elements', 'ailments', 'accessToRemove', 'additionalStat', 'stat', 'killers', 'unit'])
      this.removeFilter(key);
  }

  protected selectTypes(types: readonly string[], onlyUnit = false): void {
    const equip = this.unit()?.equip ?? [];
    const added = onlyUnit ? types.filter((t) => equip.includes(t)) : types;
    this.types.set([...new Set([...this.types(), ...added])]);
  }
}
