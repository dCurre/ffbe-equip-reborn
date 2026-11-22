import {
  BoardNode,
  calculateSp,
  changeRarity,
  decodeEsperLink,
  encodeEsperLink,
  EsperBoard,
  newEsper,
  statBonus,
  toggleNode,
} from './esper-model';

const node = (x: number, y: number, extra: Partial<BoardNode> = {}, children: BoardNode[] = []): BoardNode => ({
  position: [x, y],
  cost: { SP: 10 },
  children,
  ...extra,
});

/** center -> (1,1) atk 50 -> (2,2) killer -> (3,3) hp 10 */
const board: EsperBoard = {
  stats: { '1': Object.fromEntries(['HP', 'MP', 'ATK', 'DEF', 'MAG', 'SPR'].map((s) => [s, [100, 200]])) },
  resist: { '1': [{ name: 'fire', percent: 50 }] },
  statPattern: { '1': 1 },
  progression: { '1': Array(30).fill(10) },
  nodes: [
    node(1, 1, { atk: 50 }, [node(2, 2, { killers: [{ name: 'bird', physical: 10 }] }, [node(3, 3, { hp: 10 })])]),
  ],
};
const info = { id: 'Test', name: 'Test', maxLevel: 1 };

describe('esper model', () => {
  it('starts at the maximum level with the stats of the last progression step', () => {
    const esper = newEsper(info, 1, board);
    expect(esper.level).toBe(30);
    expect(esper['atk']).toBe(200);
  });

  it('selecting a node selects the whole path to it and adds the effects', () => {
    const esper = newEsper(info, 1, board);
    toggleNode(board, esper, 2, 2);
    expect(esper.selectedSkills).toEqual(['1_1', '2_2']);
    expect(esper['atk']).toBe(250);
    expect(esper.killers).toEqual([{ name: 'bird', physical: 10 }]);
    expect(calculateSp(board, esper).used).toBe(20);
  });

  it('unselecting a node frees its descendants and removes their effects', () => {
    const esper = newEsper(info, 1, board);
    toggleNode(board, esper, 3, 3);
    toggleNode(board, esper, 2, 2);
    expect(esper.selectedSkills).toEqual(['1_1']);
    expect(esper.killers).toBeUndefined();
    expect(esper['hp']).toBe(200);
  });

  it('the center resets the board and a position without node changes nothing', () => {
    const esper = newEsper(info, 1, board);
    toggleNode(board, esper, 3, 3);
    expect(toggleNode(board, esper, 4, 4)).toBe(false);
    toggleNode(board, esper, 0, 0);
    expect(esper.selectedSkills).toEqual([]);
    expect(esper['atk']).toBe(200);
  });

  it('a rarity change keeps the picked nodes the new rarity has and drops the others with their effects', () => {
    const esper = newEsper(info, 1, board);
    toggleNode(board, esper, 3, 3);
    const changed = changeRarity(board, esper, 1);
    // (3,3) is farther than the 1 star board reaches: its path up to (2,2) stays
    expect(changed.selectedSkills).toEqual(['1_1', '2_2']);
    expect(changed['atk']).toBe(esper['atk']);
    expect(changed.killers).toEqual([{ name: 'bird', physical: 10 }]);
    expect(changed['hp'] as number).toBeLessThan(esper['hp'] as number);
  });

  it('an Esper whose 3 star range is the one of level 60 reaches it at that level', () => {
    const range: EsperBoard = {
      ...board,
      stats: { '3': { ...board.stats['1'], HP: [1000, 2000] } },
      statPattern: { '3': 1 },
      progression: { '3': [0] },
    };
    expect(newEsper({ id: 'Test', name: 'Test' }, 3, range)['hp']).toBe(1600);
    expect(newEsper({ id: 'Asura', name: 'Asura' }, 3, range)['hp']).toBe(2000);
  });

  it('computes the bonus given to the unit', () => {
    const esper = newEsper(info, 1, board);
    expect(statBonus(esper, 'atk')).toBe(2);
  });

  it('a shared link keeps the rarity, level and selected nodes', () => {
    const esper = newEsper(info, 1, board);
    esper.level = 12;
    toggleNode(board, esper, 2, 2);
    const copy = decodeEsperLink(encodeEsperLink(esper), [info])!;
    expect(copy.rarity).toBe(1);
    expect(copy.level).toBe(12);
    expect(copy.selectedSkills).toContain('2_2');
  });
});
