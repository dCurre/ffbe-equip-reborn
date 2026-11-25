import { OwnedUnit, OwnedUnits } from '../../shared/services/inventory';
import { importUnits, isUnitFile } from './unit-import';
import {
  addOne,
  applyEdit,
  copiesByRarity,
  exCounts,
  raiseEx,
  initialOf,
  maxTrust,
  awaken,
  collectionStats,
  filterByName,
  GameUnit,
  parseMoogles,
  rarityParts,
  canRemove,
removeOne,
  sortByRarity,
  unitImage,
  useStmrSource,
} from './unit-model';

const unit = (id: string, min: string, max: string, extra: Partial<GameUnit> = {}): GameUnit => ({
  id,
  name: `Unit ${id}`,
  min_rarity: min,
  max_rarity: max,
  equip: ['sword'],
  ...extra,
});

describe('unit model', () => {
  it('keeps the EX level of each NV copy: raising goes from the lowest, removing takes the lowest', () => {
    const nv = unit('9', 'NV', 'NV');
    const owned: OwnedUnits = { '9': { number: 0, farmable: 0, nv: 3, exCopies: [1, 1, 1, 0], exRank: 2 } };
    expect(copiesByRarity(nv, owned['9']).map((copy) => copy.count)).toEqual([1, 1, 1, 0]);
    raiseEx(owned['9']); // the EX0 copy goes to EX1
    expect(owned['9'].exCopies).toEqual([0, 2, 1, 0]);
    removeOne(owned, nv, {}, {});
    expect(owned['9'].exCopies).toEqual([0, 1, 1, 0]);
    addOne(owned, nv, {}, {}, 3); // a tap on the EX3 pill: one more copy at EX3, the others stay where they are
    expect(owned['9'].exCopies).toEqual([0, 1, 1, 1]);
    expect(owned['9'].nv).toBe(3);
    removeOne(owned, nv, {}, {}, 0); // a long press on the EX0 pill: there is no copy there, nothing happens
    expect(owned['9'].exCopies).toEqual([0, 1, 1, 1]);
    removeOne(owned, nv, {}, {}, 2); // a long press on the EX2 pill
    expect(owned['9'].exCopies).toEqual([0, 1, 0, 1]);
    expect(owned['9'].exRank).toBe(3);
    // older data knew only the highest EX level: one copy is there, the others are at EX0
    expect(exCounts({ number: 0, farmable: 0, nv: 3, exRank: 2 })).toEqual([2, 0, 1, 0]);
  });

  it('counts the copies at each rarity of a unit', () => {
    const five = unit('5', '5', '7');
    // an import or an edit keeps the breakdown; with none, the base copies count on the lowest rarity
    expect(copiesByRarity(five, { number: 3, farmable: 0, sevenStar: 1, base: { 5: 1, 6: 2 } })).toEqual([
      { rarity: '5', count: 1 },
      { rarity: '6', count: 2 },
      { rarity: '7', count: 1 },
    ]);
    expect(copiesByRarity(five, { number: 2, farmable: 0 })[0]).toEqual({ rarity: '5', count: 2 });
    // a breakdown that does not add up to `number` (a fusion left it out of date) is ignored
    expect(copiesByRarity(five, { number: 2, farmable: 0, base: { 5: 1, 6: 2 } })[0]).toEqual({ rarity: '5', count: 2 });
  });

  it('counts how many of the NV copies are NV+ and keeps that within the copies left', () => {
    const plus = unit('8', 'NV', 'NV', { nvPlus: true });
    const owned: Record<string, OwnedUnit> = { '8': { number: 0, farmable: 4, farmableStmr: 4, nv: 4, nvPlus: 1 } };
    expect(copiesByRarity(plus, owned['8']).map((copy) => [copy.ex, copy.rarity, copy.count])).toEqual([
      [0, 'NV', 4], // all the NV copies are at EX0 (no EX data); NV+ is how many of them are NV+
      [1, 'NV', 0],
      [2, 'NV', 0],
      [3, 'NV', 0],
      [undefined, 'NV+', 1],
    ]);
    removeOne(owned, plus, {}, {});
    removeOne(owned, plus, {}, {});
    removeOne(owned, plus, {}, {});
    expect(copiesByRarity(plus, owned['8']).at(-1)).toEqual({ rarity: 'NV+', count: 1 });
    expect(owned['8'].nv).toBe(1);
  });

  it('writes the rarity of a unit', () => {
    expect(rarityParts('3', '5')).toEqual({ icon: null, filled: 3, total: 5 });
    expect(rarityParts('NV', 'NV')).toEqual({ icon: 'crystal-NV', filled: 0, total: 0 });
    expect(rarityParts('4', 'NV')).toEqual({ icon: 'crystal-NVA', filled: 4, total: 4 });
  });

  it('shows the 6* picture of a 7* unit that is not awakened', () => {
    const seven = unit('100000107', '5', '7');
    expect(unitImage(seven, { number: 1, farmable: 0 })).toBe('img/units/unit_icon_10000010' + '6.png');
    expect(unitImage(seven, { number: 1, farmable: 0, sevenStar: 1 })).toBe('img/units/unit_icon_10000010' + '7.png');
  });

  it('sorts by max rarity, then base rarity, then name', () => {
    const list = [
      unit('a', '3', '6'),
      unit('b', '5', '7'),
      unit('c', '5', '6'),
      unit('d', '5', 'NV', { braveShift: 'shifted' }),
      unit('e', '4', 'NV'),
      unit('f', '3', '7', { unreleased7Star: true }),
    ];
    expect(sortByRarity(list).map((u) => u.id)).toEqual(['d', 'e', 'b', 'c', 'a', 'f']);
  });

  it('searches the words in the name or in the equipment', () => {
    const list = [unit('1', '3', '5', { name: 'Rain' }), unit('2', '3', '5', { name: 'Fina', equip: ['bow'] })];
    expect(filterByName(list, 'rain').map((u) => u.id)).toEqual(['1']);
    expect(filterByName(list, 'fina bow').map((u) => u.id)).toEqual(['2']);
    expect(filterByName(list, 'rain bow')).toEqual([]);
  });

  it('counts the collection by rarity, with the time limited units apart', () => {
    const list = [unit('1', '5', '7'), unit('2', '5', '6', { summon_type: 'event' }), unit('3', '3', '5')];
    const owned: OwnedUnits = { '1': { number: 2, farmable: 0, sevenStar: 1 }, '2': { number: 1, farmable: 0 } };
    const stats = collectionStats(list, owned);
    expect(stats.all['5']).toEqual({ different: 2, total: 2, number: 3 });
    expect(stats.all['7']).toEqual({ different: 1, total: 1, number: 1 });
    expect(stats.timeLimited['5']).toEqual({ different: 1, total: 1, number: 1 });
    expect(stats.notLimited['5']).toEqual({ different: 1, total: 1, number: 2 });
    expect(stats.all['3']).toEqual({ different: 0, total: 1, number: 0 });
  });

  it('counts the NV and the NVA units by their NV copies', () => {
    const list = [
      unit('1', 'NV', 'NV'),
      unit('2', '5', 'NV', { summon_type: 'event' }),
      unit('3', '5', 'NV'),
      unit('4', '4', '6'),
    ];
    const owned: OwnedUnits = {
      '1': { number: 0, farmable: 0, nv: 2 },
      '2': { number: 1, farmable: 0, nv: 1 },
      '3': { number: 1, farmable: 0 }, // owned, but not awakened
    };
    const stats = collectionStats(list, owned);
    expect(stats.all.NV).toEqual({ different: 1, total: 1, number: 2 });
    expect(stats.all.NVA).toEqual({ different: 1, total: 2, number: 1 });
    expect(stats.timeLimited.NVA).toEqual({ different: 1, total: 1, number: 1 });
    expect(stats.notLimited.NVA).toEqual({ different: 0, total: 1, number: 0 });
    expect(stats.all['5']).toEqual({ different: 2, total: 2, number: 2 }); // the NVA keep counting in their base rarity
  });

  it('adds a copy: the TMR is farmable until the farmed ones cover the copies', () => {
    const owned: OwnedUnits = {};
    const seven = unit('7', '5', '7');
    addOne(owned, seven, {}, {});
    expect(owned['7']).toEqual({ number: 1, farmable: 1, farmableStmr: 0, base: { 5: 1 } });
    addOne(owned, seven, { '7': 2 }, {});
    expect(owned['7'].farmable).toBe(1); // two farmed TMR cover two copies
    addOne(owned, seven, { '7': 2 }, {});
    expect(owned['7'].farmable).toBe(2);
  });

  it('adds an NV unit with its NV count', () => {
    const owned: OwnedUnits = {};
    addOne(owned, unit('9', 'NV', 'NV'), {}, {});
    expect(owned['9']).toEqual({ number: 0, farmable: 1, farmableStmr: 1, nv: 1, exCopies: [1, 0, 0, 0], exRank: 0 });
  });

  it('counts an NV copy even when its STMR is already farmed', () => {
    const owned: OwnedUnits = {};
    addOne(owned, unit('9', 'NV', 'NV'), {}, { '9': 1 });
    addOne(owned, unit('9', 'NV', 'NV'), {}, { '9': 1 });
    expect(owned['9']).toMatchObject({ number: 0, nv: 2, farmableStmr: 1 });
  });

  it('removes a copy and clamps what can still be farmed', () => {
    const owned: OwnedUnits = {};
    const seven = unit('7', '5', '7');
    addOne(owned, seven, {}, {});
    addOne(owned, seven, {}, {});
    removeOne(owned, seven, {}, {});
    expect(owned['7']).toEqual({ number: 1, farmable: 1, farmableStmr: 0, base: { 5: 1 } });
    removeOne(owned, seven, { '7': 0 }, {});
    expect(owned['7']).toBeUndefined(); // nothing left
    removeOne(owned, seven, {}, {}); // no copy: nothing happens
    expect(owned['7']).toBeUndefined();
  });

  it('removes the NV copies of an imported NV unit (number 0) down to nothing', () => {
    const nv = unit('9', 'NV', 'NV');
    const owned: OwnedUnits = { '9': { number: 0, farmable: 1, farmableStmr: 1, nv: 1 } };
    expect(canRemove(nv, owned['9'])).toBe(true);
    removeOne(owned, nv, {}, {});
    expect(owned['9']).toBeUndefined();
  });

  it('removes an NV copy with its NV count', () => {
    const owned: OwnedUnits = {};
    const nv = unit('9', 'NV', 'NV');
    addOne(owned, nv, {}, {});
    addOne(owned, nv, {}, {});
    removeOne(owned, nv, {}, {});
    expect(owned['9']).toEqual({ number: 0, farmable: 1, farmableStmr: 1, nv: 1, exCopies: [1, 0, 0, 0], exRank: 0 });
  });

  it('awakens with two copies or with one and a prism', () => {
    const mine: OwnedUnit = { number: 3, farmable: 0 };
    const five = unit('100000105', '5', '7');
    awaken(mine, five, 2);
    expect(mine).toEqual({ number: 1, farmable: 0, sevenStar: 1, farmableStmr: 1, base: { 5: 1 } });
    awaken(mine, five, 1);
    expect(mine.number).toBe(0);
    expect(mine.sevenStar).toBe(2);
  });

  it('takes what the STMR source used up', () => {
    const mine: OwnedUnit = { number: 3, farmable: 0, sevenStar: 2, farmableStmr: 5 };
    useStmrSource(mine, 'sevenStar');
    expect(mine).toMatchObject({ sevenStar: 1, farmableStmr: 3 });
    useStmrSource(mine, 'twoLower');
    expect(mine).toMatchObject({ number: 1, farmableStmr: 2 });
    useStmrSource(mine, 'moogles');
    expect(mine.farmableStmr).toBe(1);
  });

  it('reads the TMR moogles', () => {
    expect(parseMoogles('')).toEqual([]);
    expect(parseMoogles('50, 100')).toEqual([50, 100]);
    expect(parseMoogles('50, x')).toBeNull();
    expect(parseMoogles('50,')).toBeNull();
  });

  it('edits a unit and drops it when nothing is left', () => {
    const owned: OwnedUnits = {};
    const seven = unit('7', '5', '7');
    const edit = {
      number: 1,
      base: { 5: 1 },
      sevenStar: 2,
      nv: 0,
      nvPlus: 0,
      ex: [0, 0, 0, 0],
      fragments: 0,
      tmrMoogles: '',
    };
    applyEdit(owned, seven, edit, [50], { tmr: 2, stmr: 1 });
    // to farm: the copies (1 + 2 per 7*) and the awakened ones, minus what is farmed
    expect(owned['7']).toEqual({ number: 1, farmable: 3, sevenStar: 2, farmableStmr: 1, tmrMoogles: [50], base: { 5: 1 } });
    expect(maxTrust(seven, edit)).toEqual({ tmr: 5, stmr: 2 });
    applyEdit(owned, seven, { ...edit, number: 0, sevenStar: 0 }, []);
    expect(owned['7']).toBeUndefined();
  });

  it('files a name under its first letter, accents ignored, anything else under #', () => {
    expect([initialOf('Béatrice'), initialOf('2B -Neo Vision-'), initialOf('')]).toEqual(['B', '#', '#']);
  });

  it('clamps the EX level of an NV unit to 0..3', () => {
    const owned: OwnedUnits = {};
    const nv = unit('9', 'NV', 'NV');
    const edit = {
      number: 0,
      base: {},
      sevenStar: 0,
      nv: 1,
      nvPlus: 0,
      ex: [0, 0, 0, 1],
      fragments: 0,
      tmrMoogles: '',
    };
    applyEdit(owned, nv, edit, []);
    expect(owned['9'].exRank).toBe(3);
    expect(owned['9'].exCopies).toEqual([0, 0, 0, 1]);
  });
});

describe('unit import', () => {
  const released = [unit('100000107', '5', '7'), unit('100000207', 'NV', 'NV'), unit('100000307', '4', 'NV')];
  const units = Object.fromEntries(released.map((u) => [u.id, u]));
  const context = {
    server: 'GL' as const,
    releasedUnits: released,
    units,
    items: [{ id: '5', name: 'TMR', tmrUnit: '100000107' }],
  };

  it('refuses a file that does not have the form of the export', () => {
    expect(isUnitFile([{ id: '100000107', level: 80, tmr: 0 }])).toBe(true);
    expect(isUnitFile([{ id: '1', level: 80, tmr: 0 }])).toBe(false);
    expect(isUnitFile({})).toBe(false);
    expect(isUnitFile([{ id: '100000107', level: 999, tmr: 0 }])).toBe(false);
  });

  it('counts the copies of each rarity and the TMR still to farm', () => {
    const { owned, messages } = importUnits(
      [
        { id: '100000105', level: 1, tmr: 0 },
        { id: '100000106', level: 1, tmr: 1000 },
        { id: '100000107', level: 1, tmr: 0, stmr: 0 },
        { id: '904000115', level: 1, tmr: 0, tmrId: '5' },
        { id: '904000103', level: 1, tmr: 500, tmrId: '5' },
        { id: '100000999', level: 1, tmr: 0 },
      ],
      context,
    );
    expect(owned['100000107']).toMatchObject({
      number: 2,
      base: { 5: 1, 6: 1 }, // the rarity of each base copy
      sevenStar: 1,
      farmable: 3,
      farmableStmr: 1,
      tmrMoogles: [50],
    });
    expect(messages).toHaveLength(1);
  });

  it('turns an NVA of the game into the base unit', () => {
    const { owned } = importUnits([{ id: '100000317', level: 1, tmr: 1000, stmr: 0, exRank: 2 }], context);
    expect(owned['100000307']).toMatchObject({ nv: 1, farmableStmr: 1, exRank: 2 });
  });
});
