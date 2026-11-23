import { describe, expect, it } from 'vitest';
import { detectImportKind } from './import-kind';
import { consumablesFromSaveFile, espersFromSave, itemsFromSave, unitsFromSave } from './save-import';

describe('detectImportKind', () => {
  it('knows each kind of file of the game', () => {
    expect(detectImportKind([{ id: '100000102', level: 80, tmr: 1 }])).toBe('units');
    expect(detectImportKind([{ itemId: '904000103', itemQty: '12' }])).toBe('consumables');
    expect(detectImportKind([{ id: '200000030', count: 2 }])).toBe('inventory');
    expect(detectImportKind([{ id: '1', rarity: 5, level: 60, board: 'abc' }])).toBe('espers');
  });

  it('knows the full save and reads its units and consumables', () => {
    const save = {
      identity: { handle_name: 'x' },
      roster: [
        { master_id: '100000102', level: 80, nv_ex_level: 2 },
        { master_id: '904000105', level: 1 },
      ],
      beasts: [{ esper_id: '1', rarity: 3, level: 60, board: '62c14', cp: 715 }],
      vision_cards: [{ vc_id: '100000501', level: 3 }],
      inventory: {
        equipment: [{ item_id: 302000100, count: 2 }],
        items: [
          { item_type: 22, item_id: 504243486, count: 1 },
          { item_type: 20, item_id: 290050100, count: 142 },
          { item_type: 20, item_id: 290020400, count: 0 },
          { item_type: 23, item_id: 100, count: 9 },
        ],
      },
    };
    expect(detectImportKind(save)).toBe('save');
    expect(detectImportKind({ ...save, roster: [] })).toBe('empty');
    expect(unitsFromSave(save)).toEqual([{ id: '100000102', level: 80, tmr: 1000, stmr: 1000, exRank: 2 }]);
    expect(espersFromSave(save)).toEqual([{ id: '1', rarity: 3, level: 60, board: '62c14' }]);
    expect(itemsFromSave(save)).toEqual([
      { id: '302000100', count: 2 },
      { id: '504243486', count: 1 },
      { id: '100000501', count: 1, level: 3 },
    ]);
    expect(consumablesFromSaveFile(save)).toEqual([{ itemId: '290050100', itemQty: '142' }]);
  });

  it('tells an empty list and what is not a list of the game', () => {
    expect(detectImportKind([])).toBe('empty');
    expect(detectImportKind({ id: '100000102', level: 80, tmr: 1 })).toBeNull();
    expect(detectImportKind('text')).toBeNull();
    expect(detectImportKind([{ name: 'something else' }])).toBeNull();
    // one entry of another kind: the file is not that kind
    expect(detectImportKind([{ id: '200000030', count: 2 }, { itemId: '904000103', itemQty: '12' }])).toBeNull();
  });
});
