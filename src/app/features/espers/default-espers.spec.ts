import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BoardNode, decodeEsperLink, EsperBoard, isOutsideBoard, positionString } from './esper-model';

const read = (file: string) => JSON.parse(readFileSync(`public/ALL/${file}.json`, 'utf8'));

/** The positions of every node of the board that its rarity reaches. */
function positions(nodes: BoardNode[], rarity: number, found: string[] = []): string[] {
  for (const node of nodes) {
    if (!isOutsideBoard(node, rarity)) found.push(positionString(...node.position));
    positions(node.children, rarity, found);
  }
  return found;
}

describe('default Espers of the builder', () => {
  const boards: Record<string, EsperBoard> = read('esperBoards');
  const espers: { id: string; name: string; maxLevel: number; buildLink: string }[] = read('defaultBuilderEspers');
  it.each(espers)('$name: the link selects every node of the board', (esper) => {
    const link = decodeEsperLink(esper.buildLink.split('#')[1], [esper])!;
    const selected = link.selectedSkills.filter((position) => position !== '0_0');
    expect(selected.sort()).toEqual(positions(boards[esper.name].nodes, link.rarity).sort());
  });
});
