import { Item } from '../../game/helpers/item';
import { VisionCard } from '../../game/helpers/vision-cards';
import { ItemInventory } from '../../shared/services/inventory';
import {
  addAll,
  addItem,
  buildEntries,
  changeCardLevel,
  compareName,
  exportCsv,
  exportJson,
  importInventory,
  inventoryStats,
  isItemFile,
  ItemEntry,
  oneOfEach,
  removeItem,
  sortEntries,
  dropEmptyCopy,
  startEnhancement,
  toggleEnhancement,
  toggleExcludedFromExpedition,
} from './inventory-model';

const item = (id: string, name: string, extra: Partial<Item> = {}): Item => ({
  id,
  name,
  type: 'sword',
  access: ['shop'],
  ...extra,
});

const empty = (): ItemInventory => ({ enchantments: {}, visionCardsLevels: {} });
const line = (i: Item, extra: Partial<ItemEntry> = {}): ItemEntry =>
  ({ key: i.id, item: i, ownedNumber: 0, owned: false, enhanced: false, enhancementPos: 0, ...extra }) as ItemEntry;

const rain = item('100', 'Rain Blade', { atk: 50 });
const fina = item('101', 'Fina Blade', { atk: 80 });
const dagger = item('102', 'Dagger', { type: 'dagger', atk: 10 });
const materia = item('200', 'Esuna', { type: 'materia' });
const data = [rain, fina, dagger, materia];

describe('inventory lines', () => {
  it('lists each item once, keeping the version with the most conditions', () => {
    const plain = item('1', 'Ring');
    const conditional = item('1', 'Ring', { equipedConditions: ['sword'] });
    expect(oneOfEach([plain, conditional])).toEqual([conditional]);
    expect(oneOfEach([conditional, plain])).toEqual([conditional]);
  });

  it('makes a line for each enhanced copy and one for the others', () => {
    const inventory = empty();
    inventory['100'] = 3;
    inventory.enchantments['100'] = [['atk_20']];
    const { equipments } = buildEntries(data, [], inventory, {});
    const lines = equipments.filter((l) => l.item.id === '100');
    expect(lines.map((l) => [l.enhanced, l.ownedNumber])).toEqual([
      [true, 1],
      [false, 2],
    ]);
    expect(lines[0].key).not.toBe(lines[1].key);
  });

  it('shows the items not owned, apart the materia', () => {
    const { equipments, materia: materiaLines } = buildEntries(data, [], empty(), {});
    expect(equipments).toHaveLength(3);
    expect(materiaLines.map((l) => l.item.id)).toEqual(['200']);
    expect(equipments.every((l) => !l.owned)).toBe(true);
  });

  it('makes a line for each card owned, with its level', () => {
    const card = {
      id: '900',
      name: 'Card',
      type: 'visionCard',
      access: ['unknown'],
      levels: [{ atk: 1 }, { atk: 2 }],
    } as unknown as VisionCard;
    const inventory = empty();
    inventory['900'] = 2;
    inventory.visionCardsLevels['900'] = [1, 2];
    const { equipments } = buildEntries([], [card], inventory, {});
    expect(equipments.map((l) => l.item['level'])).toEqual([1, 2]);
  });

  it('adds a copy of the level of the line', () => {
    const card = { id: '900', name: 'Card', type: 'visionCard', access: ['unknown'], levels: [{ atk: 1 }, { atk: 2 }] };
    const inventory = empty();
    inventory['900'] = 2;
    inventory.visionCardsLevels['900'] = [1, 2];
    const line = buildEntries([], [card as unknown as VisionCard], inventory, {}).equipments[1];
    addItem(inventory, line);
    expect(inventory['900']).toBe(3);
    expect(inventory.visionCardsLevels['900']).toEqual([1, 2, 2]);
  });

  it('puts the cards of the same level in one line with their number', () => {
    const card = { id: '900', name: 'Card', type: 'visionCard', access: ['unknown'], levels: [{ atk: 1 }, { atk: 2 }] };
    const inventory = empty();
    inventory['900'] = 4;
    inventory.visionCardsLevels['900'] = [1, 1, 2, 1];
    const { equipments } = buildEntries([], [card as unknown as VisionCard], inventory, {});
    expect(equipments.map((l) => [l.item['level'], l.ownedNumber, l.enhancementPos])).toEqual([
      [1, 3, 0],
      [2, 1, 2],
    ]);
  });

  it('sorts by type, then by the stats of the type', () => {
    const sorted = sortEntries([line(dagger), line(rain), line(fina)]);
    // the daggers come before the swords (the order of the types), the stronger sword first
    expect(sorted.map((l) => l.item.id)).toEqual(['102', '101', '100']);
  });

  it('sorts over all the types when it is not by type', () => {
    const strong = item('200', 'Strong', { atk: 100 });
    const tough = item('201', 'Tough', { atk: 10 });
    const other = item('202', 'Other', { type: 'dagger', atk: 50 });
    const flat = sortEntries([line(tough), line(other), line(strong)], 'atk', false, false);
    expect(flat.map((l) => l.item.id)).toEqual(['200', '202', '201']);
  });

  it('sorts by the chosen stat inside each type, the types keeping their order', () => {
    const strong = item('200', 'Strong', { atk: 100, hp: 10 });
    const tough = item('201', 'Tough', { atk: 10, hp: 500 });
    const other = item('202', 'Other', { type: 'dagger', atk: 1 });
    const byHp = sortEntries([line(strong), line(tough), line(other)], 'hp');
    expect(byHp.map((l) => l.item.id)).toEqual(['202', '201', '200']);
    const byAtk = sortEntries([line(tough), line(strong), line(other)], 'atk');
    expect(byAtk.map((l) => l.item.id)).toEqual(['202', '200', '201']);
  });

  it('sorts by name, and turns each type around with `reverse`', () => {
    const a = item('300', 'Apple');
    const b = item('301', 'Berry');
    const dagger = item('302', 'Zed', { type: 'dagger' });
    expect(sortEntries([line(b), line(dagger), line(a)], 'name').map((l) => l.item.id)).toEqual(['302', '300', '301']);
    expect(sortEntries([line(a), line(dagger), line(b)], 'name', true).map((l) => l.item.id)).toEqual([
      '302',
      '301',
      '300',
    ]);
    const strong = item('310', 'S', { atk: 100 });
    const weak = item('311', 'W', { atk: 1 });
    expect(sortEntries([line(strong), line(weak)], 'atk', true).map((l) => l.item.id)).toEqual(['311', '310']);
  });

  it('sorts the materia by name, or by the percent they add to a stat', () => {
    const a = item('320', 'Apple', { type: 'materia', 'atk%': 5 });
    const b = item('321', 'Berry', { type: 'materia', 'atk%': 10 });
    const ids = (stat?: string, reverse?: boolean) =>
      sortEntries([line(a), line(b)], stat, reverse).map((l) => l.item.id);
    expect(ids()).toEqual(['320', '321']);
    expect(ids('name', true)).toEqual(['321', '320']);
    expect(ids('atk')).toEqual(['321', '320']);
    expect(ids('atk', true)).toEqual(['320', '321']);
  });

  it('puts the capital letters first when comparing names', () => {
    expect(compareName('Abc', 'abc')).toBeLessThan(0);
    expect(compareName('abc', 'abd')).toBeLessThan(0);
    expect(compareName('ab', 'abc')).toBeLessThan(0);
    expect(compareName('same', 'same')).toBe(0);
  });
});

describe('inventory changes', () => {
  it('adds and removes copies', () => {
    const inventory = empty();
    expect(addItem(inventory, line(rain))).toBe('added');
    addItem(inventory, line(rain));
    expect(inventory['100']).toBe(2);
    removeItem(inventory, line(rain));
    expect(inventory['100']).toBe(1);
    removeItem(inventory, line(rain));
    expect(inventory['100']).toBeUndefined();
  });

  it('refuses to go over the limit of an item unless forced', () => {
    const inventory = empty();
    const limited = item('300', 'Limited', { maxNumber: 1 });
    addItem(inventory, line(limited));
    expect(addItem(inventory, line(limited))).toBe('limit');
    expect(addItem(inventory, line(limited), true)).toBe('added');
    expect(inventory['300']).toBe(2);
  });

  it('keeps the level of each card', () => {
    const card = {
      id: '900',
      name: 'Card',
      type: 'visionCard',
      access: [],
      levels: [{}, {}, {}],
    } as unknown as VisionCard;
    const inventory = empty();
    const cardLine = line({ ...item('900', 'Card'), level: 1 }, { visionCard: card });
    addItem(inventory, cardLine);
    addItem(inventory, cardLine);
    expect(inventory.visionCardsLevels['900']).toEqual([1, 1]);
    changeCardLevel(inventory, line({ ...item('900', 'Card'), level: 1 }, { visionCard: card, enhancementPos: 1 }), 1);
    expect(inventory.visionCardsLevels['900']).toEqual([1, 2]);
    removeItem(inventory, line(item('900', 'Card'), { visionCard: card, enhancementPos: 0 }));
    expect(inventory.visionCardsLevels['900']).toEqual([2]);
  });

  it('enhances a copy, up to three enhancements', () => {
    const inventory = empty();
    inventory['100'] = 2;
    const pos = startEnhancement(inventory, line(rain));
    expect(inventory.enchantments['100']).toEqual([[]]);
    expect(toggleEnhancement(inventory, '100', pos, 'atk_20')).toBe('added');
    toggleEnhancement(inventory, '100', pos, 'hp_20');
    toggleEnhancement(inventory, '100', pos, 5);
    expect(toggleEnhancement(inventory, '100', pos, 'def_1')).toBe('full');
    expect(toggleEnhancement(inventory, '100', pos, 'atk_20')).toBe('removed');
    expect(inventory.enchantments['100'][0]).toEqual(['hp_20', 5]);
  });

  it('gives the copy back to the plain ones when its last enhancement is removed', () => {
    const inventory = empty();
    inventory['100'] = 2;
    inventory.enchantments['100'] = [['atk_20']];
    expect(toggleEnhancement(inventory, '100', 0, 'atk_20')).toBe('copyRemoved');
    expect(inventory.enchantments['100']).toBeUndefined();
    expect(inventory['100']).toBe(2);
  });

  it('drops a copy left without enhancements, and only that one', () => {
    const inventory = empty();
    inventory['100'] = 2;
    inventory.enchantments['100'] = [['atk_20'], []];
    expect(dropEmptyCopy(inventory, '100', 0)).toBe(false);
    expect(dropEmptyCopy(inventory, '100', 1)).toBe(true);
    expect(inventory.enchantments['100']).toEqual([['atk_20']]);
    inventory.enchantments['100'] = [[]];
    expect(dropEmptyCopy(inventory, '100', 0)).toBe(true);
    expect(inventory.enchantments['100']).toBeUndefined();
  });

  it('removes an enhanced copy, and the item with its last copy', () => {
    const inventory = empty();
    inventory['100'] = 2;
    inventory.enchantments['100'] = [['atk_20']];
    removeItem(inventory, line(rain, { enhanced: true, enhancementPos: 0 }));
    expect(inventory['100']).toBe(1);
    expect(inventory.enchantments['100']).toBeUndefined();
  });

  it('marks an item to leave out of the expeditions, and back', () => {
    const inventory = empty();
    toggleExcludedFromExpedition(inventory, '100');
    expect(inventory['excludeFromExpeditions']).toEqual(['100']);
    toggleExcludedFromExpedition(inventory, '100');
    expect(inventory['excludeFromExpeditions']).toEqual([]);
  });

  it('adds up to an amount of each item, and says which ones were added', () => {
    const inventory = empty();
    const limited = item('300', 'Limited', { maxNumber: 1 });
    const added = addAll(inventory, [line(rain), line(limited)], 2);
    expect(inventory['100']).toBe(2);
    expect(inventory['300']).toBe(1);
    expect(added).toHaveLength(3);
  });

  it('counts the items by type', () => {
    const inventory = empty();
    inventory['100'] = 2;
    inventory['102'] = 1;
    expect(inventoryStats(data, inventory)).toEqual({
      sword: { different: 1, total: 2, number: 2 },
      dagger: { different: 1, total: 1, number: 1 },
      materia: { different: 0, total: 1, number: 0 },
    });
  });
});

describe('inventory import and export', () => {
  it('refuses a file that does not have the form of the export', () => {
    expect(isItemFile([{ id: '123456789', count: 1 }])).toBe(true);
    expect(isItemFile([{ id: '1', count: 1 }])).toBe(false);
    expect(isItemFile([{ id: '123456789', count: 'x' }])).toBe(false);
    expect(isItemFile([{ id: '123456789', count: 1, enhancements: ['a', 'b', 'c', 'd'] }])).toBe(false);
  });

  it('imports items, enhanced copies and cards, and says what it does not know', () => {
    const items = [item('100000100', 'A'), item('100000101', 'B')];
    const card = { id: '900000000', name: 'Card', levels: [{}, {}] } as unknown as VisionCard;
    const { inventory, messages } = importInventory(
      [
        { id: '100000100', count: 2 },
        { id: '100000100', count: 1, enhancements: ['skill1'] },
        { id: '900000000', count: 1, level: 3 },
        { id: '999999999', count: 1 },
        { id: '409026200', count: 1 },
      ],
      items,
      [card],
      {},
      { skill1: 'atk_20' },
      'GL',
    );
    expect(inventory['100000100']).toBe(3);
    expect(inventory.enchantments['100000100']).toEqual([['atk_20']]);
    expect(inventory['900000000']).toBe(1);
    expect(inventory.visionCardsLevels['900000000']).toEqual([3]);
    expect(messages).toEqual(['unknown item id : 999999999']);
  });

  it('exports a csv with the enhanced copies on their own line', () => {
    const inventory = empty();
    inventory['100'] = 2;
    inventory.enchantments['100'] = [['atk_20']];
    const csv = exportCsv([line(rain)], inventory, {});
    expect(csv.split('\n')).toHaveLength(4); // header, the enhanced copy, the plain one, the end
    expect(csv).toContain('"100";"Rain Blade";"sword";1;"";"shop";"');
    expect(csv).toContain('"100";"Rain Blade";"sword";1;"";"shop"\n');
  });

  it('exports a json with one entry for each card and enhanced copy', () => {
    const inventory = empty();
    inventory['100'] = 2;
    inventory.enchantments['100'] = [['atk_20']];
    inventory['900'] = 1;
    inventory.visionCardsLevels['900'] = [4];
    const result = JSON.parse(exportJson(inventory, data, {}));
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ id: '900', count: 1, level: 4 });
    expect(result).toContainEqual({ id: '100', count: 1 });
  });
});
