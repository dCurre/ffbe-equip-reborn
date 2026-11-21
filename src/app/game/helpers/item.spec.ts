import { isAccessAllowed } from '../components/item-access/item-access';
import { itemEffects } from './item-effects';
import { itemStats } from './item-stats';
import { buildSearchString, calculateValue, containsText, filterItems, Item, searchTokens, sortItems } from './item';
import { cardsAsItems, VisionCard } from './vision-cards';

const units = {
  u1: { name: 'Rain', roles: ['attacker'], sex: 'male' },
  u2: { name: 'Fina', roles: ['healer'], sex: 'female' },
};

const item = (id: string, name: string, extra: Partial<Item> = {}): Item => ({
  id,
  name,
  type: 'sword',
  access: ['shop'],
  ...extra,
});

const sword = item('1', 'Sword of Test', { atk: 100, 'atk%': 10, element: ['fire'], tmrUnit: 'u1' });
const staff = item('2', 'Healing Staff', { mag: 80, type: 'staff', exclusiveUnits: ['u2'], access: ['event'] });
const hidden = item('3', 'Future Blade', { atk: 300, access: ['not released yet'] });
for (const i of [sword, staff, hidden]) i.searchString = buildSearchString(i, units);

describe('item search', () => {
  it('splits a search in words, keeping the quoted text together', () => {
    expect(searchTokens('fire "single wielding" atk')).toEqual(['single wielding', 'fire', 'atk']);
    expect(searchTokens('  ')).toEqual([]);
  });

  it('looks into the name, the stats, the unit of the TMR and the access', () => {
    expect(buildSearchString(sword, units)).toContain('Rain');
    expect(containsText('sword rain', sword)).toBe(true);
    expect(containsText('atk+100', sword)).toBe(true);
    expect(containsText('rain healing', sword)).toBe(false);
  });

  it('lets a * stand for a number', () => {
    expect(containsText('atk+*', sword)).toBe(true);
    expect(containsText('atk+*%', sword)).toBe(true);
  });
});

describe('item filters', () => {
  const all = [sword, staff, hidden];

  it('leaves out the items not released yet unless asked', () => {
    expect(filterItems(all, {}).map((i) => i.id)).toEqual(['1', '2']);
    expect(filterItems(all, { showNotReleasedYet: true }).map((i) => i.id)).toEqual(['1', '2', '3']);
  });

  it('keeps the items that have the stat, and sorts by its value', () => {
    const found = filterItems(all, { stat: 'atk', showNotReleasedYet: true });
    expect(sortItems(found).map((i) => i.id)).toEqual(['3', '1']);
  });

  it('filters by type, element and access', () => {
    expect(filterItems(all, { types: ['staff'] }).map((i) => i.id)).toEqual(['2']);
    expect(filterItems(all, { elements: ['fire'] }).map((i) => i.id)).toEqual(['1']);
    expect(filterItems(all, { elements: ['noElement'] }).map((i) => i.id)).toEqual(['2']);
    expect(filterItems(all, { accessToRemove: ['shop'] }).map((i) => i.id)).toEqual(['2']);
  });

  it('needs all the values with AND', () => {
    const both = item('4', 'Flame and Ice', { element: ['fire', 'ice'] });
    expect(filterItems([sword, both], { elements: ['fire', 'ice'] }).map((i) => i.id)).toEqual(['1', '4']);
    expect(filterItems([sword, both], { elements: ['fire', 'ice'], elementsAnd: true }).map((i) => i.id)).toEqual([
      '4',
    ]);
  });

  it('keeps the items a unit can use', () => {
    const rain = { id: 'u1', roles: ['attacker'], sex: 'male' };
    expect(filterItems(all, { unit: rain }).map((i) => i.id)).toEqual(['1']);
  });

  it('keeps only the owned items', () => {
    expect(filterItems(all, { onlyOwned: { '2': 1 } }).map((i) => i.id)).toEqual(['2']);
  });

  it('computes the value of a stat, with the % on the base stat', () => {
    expect(calculateValue(sword, 'atk')).toBe(100);
    expect(calculateValue(sword, 'atk', { baseStat: 200, percentageStat: true })).toBe(120);
  });

  it('puts the TMR of the unit first', () => {
    const list = [staff, sword];
    list.forEach((i) => (i.calculatedValue = 0));
    expect(sortItems(list, 'u1').map((i) => i.id)).toEqual(['1', '2']);
  });
});

describe('item stats, effects and access', () => {
  it('writes the stats of an item, one entry per stat', () => {
    expect(itemStats(sword).find((entry) => entry.stat === 'atk')?.text).toBe('atk+100, atk+10%');
  });

  it('crosses out the access that the filters remove', () => {
    expect(isAccessAllowed(['shop'], 'shop')).toBe(false);
    expect(isAccessAllowed(['shop'], 'event')).toBe(true);
  });

  it('describes the special effects', () => {
    const effects = itemEffects(item('5', 'Ring', { mpRefresh: 5, special: ['twoHanded', 'Weird effect'] }));
    const texts = effects.flatMap((effect) => (effect.kind === 'line' ? effect.parts : []));
    expect(texts).toContainEqual({ type: 'text', text: 'Recover MP (5%) per turn' });
    expect(texts).toContainEqual({ type: 'gameText', text: 'Weird effect' });
    expect(JSON.stringify(effects)).not.toContain('twoHanded');
  });
});

describe('vision cards as items', () => {
  const card = {
    id: '100',
    name: 'Card',
    type: 'visionCard',
    access: ['unknown'],
    levels: [{ atk: 10 }, { atk: 20, conditional: [{ exclusiveSex: 'female', atk: 5 }] }],
  } as unknown as VisionCard;

  it('makes one item for each level, and one more for a conditional bonus', () => {
    const items = cardsAsItems({ '100': card });
    expect(items.map((i) => i.id)).toEqual(['100-1', '100-2', '100-2']);
    expect(items.filter((i) => i.exclusiveSex === 'female')).toHaveLength(1);
  });
});
