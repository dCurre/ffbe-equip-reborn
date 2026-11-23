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
import { highlightText } from '../../shared/helpers/highlight';
import { Inventory } from '../../shared/services/inventory';
import { ServerContext } from '../../shared/services/server-context';
import { debouncer } from '../../shared/helpers/search-input';
import { SearchBox } from '../../shared/components/search-box/search-box';
import { StaticData } from '../../shared/services/static-data';
import { Choice, ChoiceGroup } from '../../shared/components/choice-group/choice-group';
import { Panel } from '../../shared/components/panel/panel';
import { FilterHeading } from '../../shared/components/filter-heading/filter-heading';
import { Checkbox } from '../../shared/components/checkbox/checkbox';
import { ResultsHeading } from '../../shared/components/results-heading/results-heading';
import { SiteFooter } from '../../layout/site-footer/site-footer';
import { ResultsSwitch } from '../../shared/components/results-switch/results-switch';
import { showMoreOnScroll } from '../../shared/helpers/infinite-scroll';
import { TabPanel } from '../../shared/components/tab-panel/tab-panel';
import { tabsWithCounts } from '../../shared/components/tab-bar/tab-bar';
import { ActiveFilter, ActiveFilters } from './active-filters/active-filters';
import { ChainingPanel } from './chaining-panel/chaining-panel';
import { UnitResult } from './unit-result/unit-result';
import {
  AllCriteria,
  Criteria,
  CriteriaKey,
  defaultCriteria,
  defaultSkillFilter,
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
import { STRINGS } from '../../strings/en';

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
  /** the tab the panel is on */
  group: Group;
  title: string;
  iconType: string;
  choices: Choice[];
  /** killers have a second line of choices (the magical ones) sharing the skill types and the threshold */
  second?: { key: CriteriaKey; iconType: string; choices: Choice[]; chip?: (value: string) => string };
  skillTypes: Choice[];
  areas: boolean;
  /** how a chosen value reads in the chips of the filters on, under the title of the panel (default: its tooltip) */
  chip?: (value: string) => string;
  /** the smallest value asked (a step: its input is shown) */
  threshold?: number;
}

type Group = 'unit' | 'attack' | 'defense' | 'support';

const GROUPS: { key: Group; title: string }[] = [
  { key: 'unit', title: STRINGS.unitSearch.unit },
  { key: 'attack', title: STRINGS.unitSearch.attack },
  { key: 'defense', title: STRINGS.unitSearch.defense },
  { key: 'support', title: STRINGS.unitSearch.support },
];

/** NV is above the stars */
const rarityRank = (rarity: string): number => (rarity === 'NV' ? 8 : parseInt(rarity, 10));
const rarityChoice = (value: string): Choice => ({ value, label: value === 'NV' ? 'NV' : `${value}★` });
const BASE_RARITIES = ['1', '2', '3', '4', '5', 'NV'];
const MAX_RARITIES = ['2', '3', '4', '5', '6', '7', 'NV'];

const BREAKS = ['atk', 'def', 'mag', 'spr'];

const PANELS: PanelConfig[] = [
  {
    key: 'buffs',
    group: 'support',
    title: STRINGS.unitSearch.statBuffs,
    chip: (v) => v.toUpperCase(),
    iconType: 'stat',
    choices: ['atk', 'def', 'mag', 'spr'].map((value) => ({ value, tooltip: `${ucFirst(value)} buff` })),
    skillTypes: ACTIVES,
    areas: true,
    threshold: 5,
  },
  {
    key: 'breaks',
    group: 'attack',
    title: STRINGS.unitSearch.breaks,
    chip: (v) => v.toUpperCase(),
    iconType: 'ailment',
    // the value is the stat; the picture is the break of that stat
    choices: BREAKS.map((value) => ({ value, icon: `break_${value}`, tooltip: `${value.toUpperCase()} break` })),
    skillTypes: ACTIVES,
    areas: true,
    threshold: 1,
  },
  {
    key: 'tankAbilities',
    group: 'defense',
    title: STRINGS.unitSearch.tankAbilities,
    iconType: 'tankAbilities',
    choices: [
      { value: 'drawAttacks', tooltip: STRINGS.unitSearch.drawAttacks },
      { value: 'stCover', tooltip: STRINGS.unitSearch.stCover },
      { value: 'physicalAoeCover', tooltip: STRINGS.unitSearch.physicalAoeCover },
      { value: 'magicalAoeCover', tooltip: STRINGS.unitSearch.magicalAoeCover },
    ],
    skillTypes: text(['Passive', 'passives'], ['Active', 'actives'], ['LB', 'lb']),
    areas: false,
  },
  {
    key: 'mitigation',
    group: 'defense',
    title: STRINGS.unitSearch.mitigation,
    iconType: 'mitigation',
    choices: [
      { value: 'globalMitigation', tooltip: STRINGS.unitSearch.mitigation },
      { value: 'magicalMitigation', tooltip: STRINGS.unitSearch.magicMitigation },
      { value: 'physicalMitigation', tooltip: STRINGS.unitSearch.physicalMitigation },
      { value: 'mirage', tooltip: STRINGS.unitSearch.mirage },
    ],
    skillTypes: text(['Passive', 'passives'], ['Active', 'actives'], ['LB', 'lb']),
    areas: true,
    threshold: 5,
  },
  {
    key: 'elements',
    group: 'defense',
    title: STRINGS.unitSearch.elementalResistance,
    chip: ucFirst,
    iconType: 'element',
    choices: ELEMENT_CHOICES((e) => `${ucFirst(e)} resistance`),
    skillTypes: text(['Passive', 'passives'], ['Active', 'actives'], ['LB', 'lb'], ['Counter', 'counter']),
    areas: true,
    threshold: 5,
  },
  {
    key: 'physicalElementDamageBoosts',
    group: 'attack',
    title: STRINGS.unitSearch.physicalDamageBoosts,
    chip: ucFirst,
    iconType: 'element',
    choices: ELEMENT_CHOICES((e) => `Physical ${e} damage boost`),
    skillTypes: ACTIVES,
    areas: true,
    threshold: 5,
  },
  {
    key: 'magicalElementDamageBoosts',
    group: 'attack',
    title: STRINGS.unitSearch.magicDamageBoosts,
    chip: ucFirst,
    iconType: 'element',
    choices: ELEMENT_CHOICES((e) => `Magical ${e} damage boost`),
    skillTypes: ACTIVES,
    areas: true,
    threshold: 5,
  },
  {
    key: 'imbues',
    group: 'attack',
    title: STRINGS.unitSearch.imbues,
    chip: ucFirst,
    iconType: 'element',
    choices: ELEMENT_CHOICES((e) => `Imbue ${e}`),
    skillTypes: text(['Active', 'actives'], ['LB', 'lb']),
    areas: true,
  },
  {
    key: 'imperils',
    group: 'attack',
    title: STRINGS.unitSearch.imperils,
    chip: ucFirst,
    iconType: 'element',
    choices: ELEMENT_CHOICES((e) => `${ucFirst(e)} imperil`),
    skillTypes: ACTIVES,
    areas: true,
    threshold: 5,
  },
  {
    key: 'physicalKillers',
    group: 'attack',
    title: STRINGS.unitSearch.killers,
    chip: (v) => `Physical ${ucFirst(v)}`,
    iconType: 'killer-physical',
    choices: killerList.map((value) => ({ value, tooltip: `Physical ${value} killer` })),
    second: {
      key: 'magicalKillers',
      iconType: 'killer-magical',
      chip: (v) => `Magical ${ucFirst(v)}`,
      choices: killerList.map((value) => ({ value, tooltip: `Magical ${value} killer` })),
    },
    skillTypes: text(['Passive', 'passives'], ['Active', 'actives'], ['LB', 'lb']),
    areas: true,
    threshold: 5,
  },
  {
    key: 'racialMitigations',
    group: 'defense',
    title: STRINGS.unitSearch.racialMitigations,
    chip: ucFirst,
    iconType: 'racialMitigations',
    choices: racialMitigationList.map((value) => ({ value, tooltip: `Racial ${value} mitigations` })),
    skillTypes: text(['Active', 'actives'], ['LB', 'lb']),
    areas: true,
    threshold: 5,
  },
  {
    key: 'ailments',
    group: 'defense',
    title: STRINGS.unitSearch.ailmentResistance,
    chip: (v) => (v.startsWith('break_') ? `Break ${v.slice(6).toUpperCase()}` : ucFirst(v)),
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
    group: 'attack',
    title: STRINGS.unitSearch.weaponImperils,
    chip: (v) => (typeListLiterals as Record<string, string>)[v] ?? ucFirst(v),
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
    ActiveFilters,
    SearchBox,
    ChainingPanel,
    TabPanel,
    UnitResult,
    PageContent,
    SiteFooter,
    ResultsSwitch,
    Checkbox,
    FilterHeading,
    ResultsHeading,
    Panel,
    ChoiceGroup,
    FormsModule,
  ],
  templateUrl: './unit-search.html',
  styleUrls: ['../../shared/styles/search-page.css', './unit-search.css'],
})
export class UnitSearch {
  protected readonly t = STRINGS.unitSearch;
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
  private readonly searchBox = viewChild(SearchBox);
  private readonly resultsElement = viewChild<ElementRef<HTMLElement>>('resultsBox');
  private readonly end = viewChild<ElementRef<HTMLElement>>('end');
  protected readonly showingResults = signal(false);
  private readonly debounce = debouncer();

  protected readonly panels = PANELS;
  /** the base and the max rarity of a unit go up together: a max under every base chosen (and a base over every max chosen) has no unit */
  protected readonly baseRarityChoices = computed<Choice[]>(() => {
    const top = Math.max(...this.state().maxRarity.map(rarityRank), 0);
    return BASE_RARITIES.map((value) => ({ ...rarityChoice(value), disabled: top > 0 && rarityRank(value) > top }));
  });
  protected readonly maxRarityChoices = computed<Choice[]>(() => {
    const bottom = Math.min(...this.state().baseRarity.map(rarityRank), Infinity);
    return MAX_RARITIES.map((value) => ({ ...rarityChoice(value), disabled: rarityRank(value) < bottom }));
  });
  protected readonly typeChoices: Choice[] = typeList
    .slice(0, typeList.length - 2)
    .map((value) => ({ value, tooltip: (typeListLiterals as Record<string, string>)[value] }));
  protected readonly seriesChoices: Choice[] = Object.entries(series).map(([label, ids]) => ({
    value: String(ids),
    label,
  }));
  protected readonly loggedIn = computed(() => this.inventory.status() === 'loaded');

  // --- The tabs and the filters that are on ---
  protected readonly tab = signal<Group>('unit');
  protected readonly filters = computed<(ActiveFilter & { group: Group })[]>(() => {
    const { baseRarity, maxRarity, types, series, skillFilter, criteria } = this.state();
    const nameOf = (choices: Choice[], v: string): string => {
      const choice = choices.find((c) => c.value === v);
      return choice?.label ?? choice?.tooltip ?? v;
    };
    const named = (choices: Choice[], values: string[]): string => values.map((v) => nameOf(choices, v)).join(', ');
    const list: (ActiveFilter & { group: Group })[] = [];
    if (baseRarity.length)
      list.push({ key: 'baseRarity', group: 'unit', label: `Base ${named(this.baseRarityChoices(), baseRarity)}` });
    if (maxRarity.length)
      list.push({ key: 'maxRarity', group: 'unit', label: `Max ${named(this.maxRarityChoices(), maxRarity)}` });
    if (types.length) list.push({ key: 'types', group: 'unit', label: named(this.typeChoices, types) });
    if (series.length) list.push({ key: 'series', group: 'unit', label: named(this.seriesChoices, series) });
    if (skillFilter.chainFamily !== 'none') {
      const cast = skillFilter.multicastCount > 1 ? ` x${skillFilter.multicastCount}` : '';
      list.push({ key: 'chain', group: 'support', label: `Chain: ${skillFilter.chainFamily}${cast}` });
    }
    for (const panel of PANELS) {
      const values = [
        ...criteria[panel.key].values.map((v) => panel.chip?.(v) ?? nameOf(panel.choices, v)),
        ...(panel.second
          ? criteria[panel.second.key].values.map((v) => panel.second!.chip?.(v) ?? nameOf(panel.second!.choices, v))
          : []),
      ];
      if (!values.length) continue;
      const least = criteria[panel.key].threshold;
      list.push({
        key: panel.key,
        group: panel.group,
        label: `${panel.title}: ${values.join(', ')}${least ? ` ≥${least}` : ''}`,
      });
    }
    return list;
  });
  protected readonly tabs = computed(() => tabsWithCounts(GROUPS, this.filters()));
  protected panelsOf(group: Group): PanelConfig[] {
    return PANELS.filter((panel) => panel.group === group);
  }

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

  constructor() {
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

  @HostListener('window:keyup.escape')
  protected clearSearch(): void {
    this.patch({ searchText: '' });
    this.searchBox()?.clear();
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

  /** A rarity chosen takes off the ones of the other kind that no unit could have with it (see `baseRarityChoices`). */
  protected setRarity(kind: 'baseRarity' | 'maxRarity', values: readonly string[]): void {
    const chosen = [...values];
    const { baseRarity, maxRarity } = this.state();
    // nothing chosen takes nothing off the other kind
    if (kind === 'baseRarity') {
      const bottom = chosen.length ? Math.min(...chosen.map(rarityRank)) : 0;
      this.patch({ baseRarity: chosen, maxRarity: maxRarity.filter((m) => rarityRank(m) >= bottom) });
    } else {
      const top = chosen.length ? Math.max(...chosen.map(rarityRank)) : Infinity;
      this.patch({ maxRarity: chosen, baseRarity: baseRarity.filter((b) => rarityRank(b) <= top) });
    }
  }

  protected patch(change: Partial<UnitSearchState>): void {
    this.state.update((state) => ({ ...state, ...change }));
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

  protected removeFilter(key: string): void {
    const panel = PANELS.find((p) => p.key === key);
    if (panel) this.clearPanel(panel);
    else if (key === 'chain') this.setSkillFilter(defaultSkillFilter());
    else if (key === 'baseRarity' || key === 'maxRarity' || key === 'types' || key === 'series')
      this.patch({ [key]: [] });
  }

  protected clearFilters(): void {
    this.patch({
      baseRarity: [],
      maxRarity: [],
      types: [],
      series: [],
      skillFilter: defaultSkillFilter(),
      criteria: defaultCriteria(),
    });
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
