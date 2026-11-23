import {
  defaultState,
  filterUnits,
  hasSearch,
  prepareUnitSearch,
  SearchContext,
  SearchUnit,
  skillsToDisplay,
  SkillUnit,
  sortResults,
  stateFromHash,
  stateToHash,
} from './unit-search-model';

const emptyAreas = () => ({ SELF: {}, ST: {}, AOE: {} });

const searchUnit = (id: string, extra: Partial<SearchUnit> = {}): SearchUnit => ({
  id,
  game_id: 11001,
  minRarity: '3',
  maxRarity: '5',
  equip: ['sword', 'hat'],
  passives: {},
  actives: emptyAreas(),
  lb: emptyAreas(),
  counter: emptyAreas(),
  ...extra,
});

const skillUnit = (id: string, name: string, extra: Partial<SkillUnit> = {}): SkillUnit => ({
  id,
  name,
  max_rarity: '5',
  actives: [],
  passives: [],
  magics: [],
  lb: { name: 'Burst', minEffects: [], maxEffects: [] },
  ...extra,
});

const rain = searchUnit('1', { passives: { physicalKillers: { beast: 50 } } });
const fina = searchUnit('2', {
  actives: { ...emptyAreas(), ST: { imperil: { fire: 100 } } },
  equip: ['sword'],
  game_id: 11002,
});
const sakura = searchUnit('3', { passives: { physicalKillers: { beast: 100 } }, minRarity: '5' });

const units = {
  '1': skillUnit('1', 'Rain'),
  '2': skillUnit('2', 'Fina'),
  '3': skillUnit('3', 'Sakura'),
};
const context = (owned?: SearchContext['owned']): SearchContext => ({
  searchUnits: [rain, fina, sakura],
  units,
  released: { '1': {}, '2': {}, '3': {} },
  owned,
});
const ids = (state = defaultState(), ctx = context()) => filterUnits(state, ctx).map((r) => r.unit.id);

describe('unit search', () => {
  it('shows nothing until something is asked', () => {
    expect(hasSearch(defaultState())).toBe(false);
    const state = defaultState();
    state.types = ['sword'];
    expect(hasSearch(state)).toBe(true);
  });

  it('keeps the units that have all the equipment types', () => {
    const state = defaultState();
    state.types = ['sword', 'hat'];
    expect(ids(state)).toEqual(['1', '3']);
  });

  it('filters by rarity', () => {
    const state = defaultState();
    state.baseRarity = ['5'];
    expect(ids(state)).toEqual(['3']);
  });

  it('picks the NV+ units with NV+, and all the NV units with NV', () => {
    const nv = searchUnit('4', { maxRarity: 'NV' });
    const nvPlus = searchUnit('5', { maxRarity: 'NV', nvPlus: true });
    const ctx = { ...context(), searchUnits: [rain, nv, nvPlus], units: { ...units, '4': skillUnit('4', 'Nv'), '5': skillUnit('5', 'NvPlus') }, released: { '1': {}, '4': {}, '5': {} } };
    const state = defaultState();
    state.maxRarity = ['NV+'];
    expect(ids(state, ctx)).toEqual(['5']);
    state.maxRarity = ['NV'];
    expect(ids(state, ctx).sort()).toEqual(['4', '5']);
  });

  it('filters by killer and sorts the best first', () => {
    const state = defaultState();
    state.criteria.physicalKillers.values = ['beast'];
    expect(sortResults(filterUnits(state, context()), state).map((r) => r.unit.id)).toEqual(['3', '1']);
  });

  it('looks into the skill types and target areas of the filter', () => {
    const state = defaultState();
    state.criteria.imperils.values = ['fire'];
    expect(ids(state)).toEqual(['2']);
    state.criteria.imperils.targetAreaTypes = ['SELF'];
    expect(ids(state)).toEqual([]);
  });

  it('needs the threshold', () => {
    const state = defaultState();
    state.criteria.physicalKillers.values = ['beast'];
    state.criteria.physicalKillers.threshold = 80;
    expect(ids(state)).toEqual(['3']);
  });

  it('keeps the owned units only on request', () => {
    const state = defaultState();
    state.types = ['sword'];
    state.onlyOwned = true;
    expect(ids(state, context({ '2': { number: 1 } }))).toEqual(['2']);
  });

  it('keeps the units of the chosen series', () => {
    const state = defaultState();
    state.series = ['11002'];
    expect(ids(state)).toEqual(['2']);
  });

  it('keeps the units that chain with the family', () => {
    const chaining = searchUnit('4', { actives: { ...emptyAreas(), ST: { chain: ['BS'] } } });
    const ctx = {
      ...context(),
      searchUnits: [rain, chaining],
      units: { ...units, '4': skillUnit('4', 'Chainer') },
      released: { '1': {}, '4': {} },
    };
    const state = defaultState();
    state.skillFilter.chainFamily = 'BS';
    expect(ids(state, ctx)).toEqual(['4']);
  });

  it('searches the text of the skills of the unit', () => {
    const withSkill = skillUnit('1', 'Rain', {
      actives: [{ id: 's1', name: 'Slash', effects: [{ desc: 'Increase LB Gauge by 2 to all allies' }] }],
    });
    prepareUnitSearch({ '1': withSkill });
    const ctx = { ...context(), units: { ...units, '1': withSkill } };
    const state = defaultState();
    state.searchText = 'lb gauge by * to all allies';
    expect(ids(state, ctx)).toEqual(['1']);
  });

  it('shows the skills that match, and all of them when asked', () => {
    const unit = skillUnit('1', 'Rain', {
      actives: [
        { id: 's1', name: 'Slash', effects: [{ desc: 'Hits hard', effect: { imperil: { fire: 100 }, area: 'ST' } }] },
        { id: 's2', name: 'Guard', effects: [{ desc: 'Defends' }] },
      ],
    });
    const state = defaultState();
    state.criteria.imperils.values = ['fire'];
    expect(skillsToDisplay(unit, state)).toEqual(['s1']);
    state.fullyDisplayedUnits = ['1'];
    expect(skillsToDisplay(unit, state)).toEqual(['s1', 's2', 'lb']);
  });

  it('writes the filters in the URL and reads them back', () => {
    const state = defaultState();
    state.criteria.elements.values = ['fire'];
    state.criteria.elements.threshold = 20;
    state.searchText = 'rain';
    state.types = ['sword'];
    state.baseRarity = ['5'];
    state.series = ['10001'];
    const back = stateFromHash(stateToHash(state));
    expect(back.criteria.elements).toEqual(state.criteria.elements);
    expect(back).toMatchObject({ searchText: 'rain', types: ['sword'], baseRarity: ['5'], series: ['10001'] });
    expect(stateFromHash('not base 64').criteria.elements.values).toEqual([]);
  });
});
