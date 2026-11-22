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
import { ailmentList, elementList, killerList, racialMitigationList } from '../../../core/constants/base-lists';
import { series } from '../../../core/constants/series';
import { typeList, typeListLiterals, weaponList } from '../../../core/constants/item-types';
import { Item, searchTokens } from '../../game/helpers/item';
import { cardsAsItems, VisionCard } from '../../game/helpers/vision-cards';
import { PageContent } from '../../layout/page-content/page-content';
import { SearchColumns } from '../../shared/components/search-columns/search-columns';
import { highlightText } from '../../shared/helpers/highlight';
import { Inventory } from '../../shared/services/inventory';
import { ServerContext } from '../../shared/services/server-context';
import { clearSearchBox, debouncer } from '../../shared/helpers/search-input';
import { StaticData } from '../../shared/services/static-data';
import { Choice, ChoiceGroup } from '../../shared/components/choice-group/choice-group';
import { Icon } from '../../shared/components/icon/icon';
import { Panel } from '../../shared/components/panel/panel';
import { FilterHeading } from '../../shared/components/filter-heading/filter-heading';
import { Checkbox } from '../../shared/components/checkbox/checkbox';
import { ResultsHeading } from '../../shared/components/results-heading/results-heading';
import { ResultsSwitch } from '../../shared/components/results-switch/results-switch';
import { showMoreOnScroll } from '../../shared/helpers/infinite-scroll';
import { ChainingPanel } from './chaining-panel/chaining-panel';
import { UnitResult } from './unit-result/unit-result';
import {
  AllCriteria,
  Criteria,
  CriteriaKey,
  defaultState,
  filterUnits,
  hasSearch,
  prepareUnitSearch,
  Result,
  SearchContext,
  SearchUnit,
  SkillFilter,
  SkillUnit,
  sortResults,
  stateFromHash,
  stateToHash,
  UnitSearchState,
} from './unit-search-model';

const PAGE_SIZE = 20;
const ucFirst = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const text = (...pairs: [string, string][]): Choice[] => pairs.map(([label, value]) => ({ value, label }));

const ACTIVES = text(['Active', 'actives'], ['LB', 'lb'], ['Counter', 'counter']);
const AREAS = text(['Self', 'SELF'], ['ST', 'ST'], ['AOE', 'AOE']);
const ELEMENT_CHOICES = (tooltip: (e: string) => string): Choice[] =>
  elementList.map((value) => ({ value, tooltip: tooltip(value) }));

/** One filter panel of the page: its values (pictures), and where the skills are looked for. */
interface PanelConfig {
  key: CriteriaKey;
  title: string;
  iconType: string;
  choices: Choice[];
  /** killers have a second line of choices (the magical ones) sharing the skill types and the threshold */
  second?: { key: CriteriaKey; iconType: string; choices: Choice[] };
  skillTypes: Choice[];
  areas: boolean;
  /** the smallest value asked (a step: its input is shown) */
  threshold?: number;
}

const BREAKS = ['atk', 'def', 'mag', 'spr'];

const PANELS: PanelConfig[] = [
  {
    key: 'buffs',
    title: 'Stat buffs',
    iconType: 'stat',
    choices: ['atk', 'def', 'mag', 'spr'].map((value) => ({ value, tooltip: `${ucFirst(value)} buff` })),
    skillTypes: ACTIVES,
    areas: true,
    threshold: 5,
  },
  {
    key: 'breaks',
    title: 'Breaks',
    iconType: 'ailment',
    // the value is the stat; the picture is the break of that stat
    choices: BREAKS.map((value) => ({ value, icon: `break_${value}`, tooltip: `${value.toUpperCase()} break` })),
    skillTypes: ACTIVES,
    areas: true,
    threshold: 1,
  },
  {
    key: 'tankAbilities',
    title: 'Tank abilities',
    iconType: 'tankAbilities',
    choices: [
      { value: 'drawAttacks', tooltip: 'Draw Attacks' },
      { value: 'stCover', tooltip: 'ST Cover' },
      { value: 'physicalAoeCover', tooltip: 'Physical AOE Cover' },
      { value: 'magicalAoeCover', tooltip: 'Magical AOE Cover' },
    ],
    skillTypes: text(['Passive', 'passives'], ['Active', 'actives'], ['LB', 'lb']),
    areas: false,
  },
  {
    key: 'mitigation',
    title: 'Mitigation',
    iconType: 'mitigation',
    choices: [
      { value: 'globalMitigation', tooltip: 'Mitigation' },
      { value: 'magicalMitigation', tooltip: 'Magic Mitigation' },
      { value: 'physicalMitigation', tooltip: 'Physical Mitigation' },
      { value: 'mirage', tooltip: 'Mirage' },
    ],
    skillTypes: text(['Passive', 'passives'], ['Active', 'actives'], ['LB', 'lb']),
    areas: true,
    threshold: 5,
  },
  {
    key: 'elements',
    title: 'Elemental resistance',
    iconType: 'element',
    choices: ELEMENT_CHOICES((e) => `${ucFirst(e)} resistance`),
    skillTypes: text(['Passive', 'passives'], ['Active', 'actives'], ['LB', 'lb'], ['Counter', 'counter']),
    areas: true,
    threshold: 5,
  },
  {
    key: 'physicalElementDamageBoosts',
    title: 'Physical damage boosts',
    iconType: 'element',
    choices: ELEMENT_CHOICES((e) => `Physical ${e} damage boost`),
    skillTypes: ACTIVES,
    areas: true,
    threshold: 5,
  },
  {
    key: 'magicalElementDamageBoosts',
    title: 'Magic damage boosts',
    iconType: 'element',
    choices: ELEMENT_CHOICES((e) => `Magical ${e} damage boost`),
    skillTypes: ACTIVES,
    areas: true,
    threshold: 5,
  },
  {
    key: 'imbues',
    title: 'Imbues',
    iconType: 'element',
    choices: ELEMENT_CHOICES((e) => `Imbue ${e}`),
    skillTypes: text(['Active', 'actives'], ['LB', 'lb']),
    areas: true,
  },
  {
    key: 'imperils',
    title: 'Imperils',
    iconType: 'element',
    choices: ELEMENT_CHOICES((e) => `${ucFirst(e)} imperil`),
    skillTypes: ACTIVES,
    areas: true,
    threshold: 5,
  },
  {
    key: 'physicalKillers',
    title: 'Killers',
    iconType: 'killer-physical',
    choices: killerList.map((value) => ({ value, tooltip: `Physical ${value} killer` })),
    second: {
      key: 'magicalKillers',
      iconType: 'killer-magical',
      choices: killerList.map((value) => ({ value, tooltip: `Magical ${value} killer` })),
    },
    skillTypes: text(['Passive', 'passives'], ['Active', 'actives'], ['LB', 'lb']),
    areas: true,
    threshold: 5,
  },
  {
    key: 'racialMitigations',
    title: 'Racial Mitigations',
    iconType: 'racialMitigations',
    choices: racialMitigationList.map((value) => ({ value, tooltip: `Racial ${value} mitigations` })),
    skillTypes: text(['Active', 'actives'], ['LB', 'lb']),
    areas: true,
    threshold: 5,
  },
  {
    key: 'ailments',
    title: 'Ailment resistance',
    iconType: 'ailment',
    choices: [...ailmentList, ...BREAKS.map((b) => `break_${b}`)].map((value) => ({
      value,
      tooltip: `${value.startsWith('break') ? `Break ${value.replace('break_', '').toUpperCase()}` : ucFirst(value)} resistance`,
    })),
    skillTypes: text(['Passive', 'passives'], ['Active', 'actives'], ['LB', 'lb'], ['Counter', 'counter']),
    areas: true,
  },
  {
    key: 'weaponImperils',
    title: 'Weapon imperils',
    iconType: 'equipment',
    choices: weaponList.map((value) => ({ value, tooltip: `${ucFirst(value)} imperil` })),
    skillTypes: ACTIVES,
    areas: true,
    threshold: 5,
  },
];

/** Looks for the units by what their skills do: killers, imperils, chains, resistances... */
@Component({
  selector: 'app-unit-search',
  imports: [
    ChainingPanel,
    UnitResult,
    PageContent,
    SearchColumns,
    Checkbox,
    FilterHeading,
    ResultsHeading,
    Panel,
    ChoiceGroup,
    ResultsSwitch,
    FormsModule,
    Icon,
  ],
  templateUrl: './unit-search.html',
  styleUrls: ['../../shared/styles/search-page.css', './unit-search.css'],
})
export class UnitSearch {
  private readonly staticData = inject(StaticData);
  private readonly inventory = inject(Inventory);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly serverContext = inject(ServerContext);

  // --- Game data ---
  private readonly searchUnits = signal<SearchUnit[]>([]);
  private readonly units = signal<Record<string, SkillUnit>>({});
  private readonly released = signal<Record<string, unknown>>({});
  protected readonly itemsById = signal<Record<string, Item>>({});
  protected readonly ready = signal(false);

  // --- The search ---
  protected readonly state = signal<UnitSearchState>(defaultState());
  protected readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');
  private readonly resultsElement = viewChild<ElementRef<HTMLElement>>('resultsBox');
  private readonly end = viewChild<ElementRef<HTMLElement>>('end');
  protected readonly showingResults = signal(false);
  private readonly debounce = debouncer();

  protected readonly panels = PANELS;
  protected readonly baseRarityChoices = text(
    ['1★', '1'],
    ['2★', '2'],
    ['3★', '3'],
    ['4★', '4'],
    ['5★', '5'],
    ['NV', 'NV'],
  );
  protected readonly maxRarityChoices = text(
    ['2★', '2'],
    ['3★', '3'],
    ['4★', '4'],
    ['5★', '5'],
    ['6★', '6'],
    ['7★', '7'],
    ['NV', 'NV'],
  );
  protected readonly typeChoices: Choice[] = typeList
    .slice(0, typeList.length - 2)
    .map((value) => ({ value, tooltip: (typeListLiterals as Record<string, string>)[value] }));
  protected readonly seriesChoices: Choice[] = Object.entries(series).map(([label, ids]) => ({
    value: String(ids),
    label,
  }));
  protected readonly loggedIn = computed(() => this.inventory.status() === 'loaded');

  // --- The results ---
  private readonly context = computed<SearchContext>(() => ({
    searchUnits: this.searchUnits(),
    units: this.units(),
    released: this.released(),
    owned: this.loggedIn() ? this.inventory.units() : undefined,
  }));
  protected readonly results = computed<Result[]>(() =>
    this.ready() && hasSearch(this.state()) ? sortResults(filterUnits(this.state(), this.context()), this.state()) : [],
  );
  private readonly limit = linkedSignal<Result[], number>({ source: this.results, computation: () => PAGE_SIZE });
  /** the results shown so far: more come as the page is scrolled */
  protected readonly visible = computed(() => this.results().slice(0, this.limit()));
  protected readonly searched = computed(() => hasSearch(this.state()));
  protected readonly summaryIcons = computed(() => {
    const { criteria } = this.state();
    return [
      ...criteria.elements.values.map((v) => `element-${v}`),
      ...criteria.ailments.values.map((v) => `ailment-${v}`),
    ];
  });

  constructor() {
    for (const sheet of ['tankAbilities', 'mitigationAbilities', 'racialMitigationAbilities']) this.addSheet(sheet);
    // the filters in the URL, so a search can be shared
    afterRenderEffect(() => {
      const state = this.state();
      if (!this.ready()) return;
      this.location.replaceState(this.location.path(false), '', `#${stateToHash(state)}`);
    });
    showMoreOnScroll(this.end, this.limit, () => this.results().length, PAGE_SIZE, '600px');
    afterRenderEffect(() => {
      this.visible();
      const results = this.resultsElement()?.nativeElement;
      if (results) highlightText(results, searchTokens(this.state().searchText));
    });
    this.start();
  }

  private addSheet(name: string): void {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `css-img/${name}.css`;
    document.head.appendChild(link);
  }

  @HostListener('window:keyup.escape')
  protected clearSearch(): void {
    this.patch({ searchText: '' });
    clearSearchBox(this.searchBox());
  }

  private async start(): Promise<void> {
    const [data, cards, units, searchUnits, released] = await Promise.all([
      this.staticData.get<Item[]>('data', true),
      this.staticData.get<Record<string, VisionCard>>('visionCards'),
      this.staticData.get<Record<string, SkillUnit>>('unitsWithSkill'),
      this.staticData.get<SearchUnit[]>('unitSearch'),
      this.staticData.get<Record<string, unknown>>('releasedUnits'),
    ]);
    prepareUnitSearch(units);
    const byId: Record<string, Item> = {};
    for (const item of [...data, ...cardsAsItems(cards)]) byId[item.id] = item;
    this.itemsById.set(byId);
    this.units.set(units);
    this.searchUnits.set(searchUnits);
    this.released.set(released);
    const fragment = this.route.snapshot.fragment;
    if (fragment) this.state.set(stateFromHash(fragment));
    this.ready.set(true);
  }

  // --- Changing the filters ---

  protected patch(change: Partial<UnitSearchState>): void {
    this.state.update((state) => ({ ...state, ...change }));
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value.toLocaleLowerCase();
    this.debounce(() => this.patch({ searchText: value }));
  }

  protected criteria(key: CriteriaKey): Criteria {
    return this.state().criteria[key];
  }

  protected setCriteria(key: CriteriaKey, change: Partial<Criteria>): void {
    this.state.update((state) => ({
      ...state,
      criteria: { ...state.criteria, [key]: { ...state.criteria[key], ...change } } as AllCriteria,
    }));
  }

  /** The killers share the skill types, the target areas and the threshold of their panel. */
  protected setPanel(panel: PanelConfig, change: Partial<Criteria>): void {
    this.setCriteria(panel.key, change);
    if (panel.second) this.setCriteria(panel.second.key, change);
  }

  protected setThreshold(panel: PanelConfig, event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.debounce(() => this.setPanel(panel, { threshold: Number.isNaN(value) ? 0 : value }));
  }

  protected hasValues(panel: PanelConfig): boolean {
    return (
      this.criteria(panel.key).values.length + (panel.second ? this.criteria(panel.second.key).values.length : 0) > 0
    );
  }

  protected clearPanel(panel: PanelConfig): void {
    this.setCriteria(panel.key, { values: [] });
    if (panel.second) this.setCriteria(panel.second.key, { values: [] });
  }

  /** The target areas matter only for the skills that have a target. */
  protected showAreas(panel: PanelConfig): boolean {
    if (!panel.areas) return false;
    const types = this.criteria(panel.key).skillTypes;
    return types.some((t) => ['actives', 'lb', 'counter'].includes(t));
  }

  protected setSkillFilter(skillFilter: SkillFilter): void {
    this.state.update((state) => ({ ...state, skillFilter }));
  }

  protected toggleAllSkills(unitId: string): void {
    const shown = this.state().fullyDisplayedUnits;
    this.patch({
      fullyDisplayedUnits: shown.includes(unitId) ? shown.filter((id) => id !== unitId) : [...shown, unitId],
    });
  }
}
