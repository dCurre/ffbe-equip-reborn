import {
  clampLevel,
  decodeBoard,
  EsperBoard,
  EsperInfo,
  IMPORT_ESPER_NAMES,
  newEsper,
  OwnedEsper,
  parsePosition,
  toggleNode,
  updateStats,
} from './esper-model';

/** An Esper of the file exported from the game. */
export interface ImportedEsper {
  id: string;
  rarity: number;
  level: number;
  board: string;
}

export const isEsperFile = (data: unknown): data is ImportedEsper[] =>
  Array.isArray(data) &&
  data.length <= 20 &&
  data.every(
    (e) =>
      typeof e?.id === 'string' &&
      e.id.length <= 2 &&
      typeof e.rarity === 'number' &&
      typeof e.level === 'number' &&
      typeof e.board === 'string' &&
      e.board.length <= 40,
  );

/** How many Espers of the file the site knows (the game ids are converted to Esper names). */
export const knownEspers = (file: readonly ImportedEsper[]): ImportedEsper[] =>
  file.filter((e) => IMPORT_ESPER_NAMES[Number(e.id)]);

/** The owned Espers of the file, with their stats; the ones with a rarity the Esper does not have are left out. */
export function importEspers(
  file: readonly ImportedEsper[],
  infos: readonly EsperInfo[],
  boards: Record<string, EsperBoard>,
): Record<string, OwnedEsper> {
  const owned: Record<string, OwnedEsper> = {};
  for (const data of knownEspers(file)) {
    const info = infos.find((e) => e.name === IMPORT_ESPER_NAMES[Number(data.id)]);
    const rarity = Math.round(data.rarity);
    if (!info || rarity < 1 || rarity > info.maxLevel) continue;
    const board = boards[info.name];
    const esper = newEsper(info, rarity, board);
    esper.level = clampLevel(Math.round(data.level), rarity);
    for (const position of decodeBoard(data.board)) {
      if (position === '0_0' || esper.selectedSkills.includes(position)) continue;
      const { x, y } = parsePosition(position);
      toggleNode(board, esper, x, y);
    }
    updateStats(board, esper);
    owned[info.name] = esper;
  }
  return owned;
}
