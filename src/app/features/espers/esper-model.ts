import { baseStats } from '../../../core/constants/base-lists';
import { importBoardConversion } from '../../../core/constants/game-ids';
import { percentValues } from '../../../core/constants/stat-values';

// The rules of the Esper training board: SP, stats, what a node gives and the shared link. No DOM, no Angular.
// The saved shape of an owned Esper is the one of the old site (the Drive file `espers_<server>.json`): the unit builder reads it.

export type Stat = 'hp' | 'mp' | 'atk' | 'def' | 'mag' | 'spr';
export interface Resist {
  name: string;
  percent: number;
}
export interface Killer {
  name: string;
  physical?: number;
  magical?: number;
}
export interface Conditional {
  equipedCondition?: string;
  icon?: string;
  [key: string]: unknown;
}
export interface Evade {
  physical?: number;
  magical?: number;
}
export type StatBonus = Record<Stat, number>;

/** What a node and an owned Esper have in common: the effects that can be added up. */
interface Effects {
  resist?: Resist[];
  killers?: Killer[];
  esperStatsBonus?: { all: StatBonus };
  lbPerTurn?: { min: number; max?: number };
  lbFillRate?: number;
  lbDamage?: number;
  jumpDamage?: number;
  evade?: Evade;
  conditional?: Conditional[];
}

export interface BoardNode extends Omit<Effects, 'esperStatsBonus'> {
  position: [number, number];
  cost: { SP: number; [item: string]: number };
  children: BoardNode[];
  special?: string[];
  esperStatsBonus?: StatBonus;
  [stat: string]: unknown;
}

export interface EsperBoard {
  stats: Record<string, Record<string, [number, number]>>;
  resist: Record<string, Resist[]>;
  statPattern: Record<string, number>;
  nodes: BoardNode[];
  progression: Record<string, number[]>;
}

export interface EsperInfo {
  id: string;
  name: string;
  maxLevel: number;
}

export interface OwnedEsper extends Effects {
  name: string;
  id: string;
  rarity: number;
  level: number;
  selectedSkills: string[];
  [stat: string]: unknown;
}

export const MAX_LEVEL_BY_STAR: Record<number, number> = { 1: 30, 2: 40, 3: 60 };

/** Rarity 3 gains one point per level after the first (0 to 60), the same in both stat patterns. */
const LINEAR_PROGRESSION: number[] = [
  0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
  33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
];

/** Percent of the stat gain reached at each level, by stat pattern and rarity. */
const STATS_PROGRESSION: Record<number, Record<number, number[]>> = {
  1: {
    1: [
      0, 3, 7, 10, 14, 17, 21, 24, 28, 31, 35, 38, 42, 45, 49, 52, 55, 58, 62, 65, 69, 72, 76, 79, 83, 86, 90, 93, 97,
      100,
    ],
    2: [
      0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 37, 40, 43, 46, 49, 52, 55, 58, 61, 64, 67, 70,
      73, 76, 79, 82, 85, 88, 91, 94, 97, 100,
    ],
    3: LINEAR_PROGRESSION,
  },
  2: {
    1: [
      0, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 21, 24, 27, 30, 33, 37, 41, 45, 49, 54, 59, 64, 69, 75, 81, 87, 93, 100,
    ],
    2: [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 37, 40, 43, 46, 49, 52, 56,
      60, 64, 68, 72, 77, 82, 88, 94, 100,
    ],
    3: LINEAR_PROGRESSION,
  },
};

export const positionString = (x: number, y: number): string => `${x < 0 ? `m${-x}` : x}_${y < 0 ? `m${-y}` : y}`;

const parseCoordinate = (token: string): number =>
  token.startsWith('m') ? -Number.parseInt(token.slice(1)) : Number.parseInt(token);

export function parsePosition(text: string): { x: number; y: number } {
  const [x, y] = text.split('_');
  return { x: parseCoordinate(x), y: parseCoordinate(y) };
}

/** Distance from the center of the board, in hexagons. */
export const distance = (x: number, y: number): number => (Math.abs(x) + Math.abs(x - y) + Math.abs(y)) / 2;

/** The nodes from the first one down to (x, y), or null when there is no node there. */
export function findPathTo(x: number, y: number, nodes: BoardNode[], path: BoardNode[] = []): BoardNode[] | null {
  for (const node of nodes) {
    const here = [...path, node];
    if (node.position[0] === x && node.position[1] === y) return here;
    const found = findPathTo(x, y, node.children, here);
    if (found) return found;
  }
  return null;
}

export function calculateSp(board: EsperBoard, esper: OwnedEsper): { used: number; available: number } {
  let available = 0;
  for (let rarity = 1; rarity < esper.rarity; rarity++) {
    for (const sp of board.progression[rarity]) available += sp;
  }
  for (let level = 0; level < esper.level; level++) available += board.progression[esper.rarity][level];
  const used = (nodes: BoardNode[]): number =>
    nodes.reduce(
      (sum, node) =>
        esper.selectedSkills.includes(positionString(...node.position))
          ? sum + node.cost.SP + used(node.children)
          : sum,
      0,
    );
  return { used: used(board.nodes), available };
}

/** Recomputes the six stats of the Esper from its rarity, level and selected nodes (the same rounding as the old site). */
export function updateStats(board: EsperBoard, esper: OwnedEsper): void {
  const progression = STATS_PROGRESSION[board.statPattern[esper.rarity]][esper.rarity];
  for (const stat of baseStats) {
    const [min, max] = board.stats[esper.rarity][stat.toUpperCase()];
    esper[stat] = Math.round(min + ((max - min) * progression[esper.level - 1]) / 100);
  }
  const addSelected = (nodes: BoardNode[]): void => {
    for (const node of nodes) {
      if (!esper.selectedSkills.includes(positionString(...node.position))) continue;
      for (const stat of baseStats) if (node[stat]) esper[stat] = (esper[stat] as number) + (node[stat] as number);
      addSelected(node.children);
    }
  };
  addSelected(board.nodes);
}

/** The bonus of the Esper to the unit that equips it (percent of the stat, plus the ST Reflection Boost). */
/** The stat of an Esper, rounded. */
export function statValue(esper: OwnedEsper, stat: Stat): number {
  return Math.round(esper[stat] as number);
}

export function statBonus(esper: OwnedEsper, stat: Stat): number {
  const boost = esper.esperStatsBonus?.all[stat];
  return Math.floor(((esper[stat] as number) * (1 + (boost ? boost / 100 : 0))) / 100);
}

/** A node that is not part of the board of this rarity (the outer ring exists only at 3 stars). */
export const isOutsideBoard = (node: BoardNode, rarity: number): boolean => distance(...node.position) > rarity + 2;

function addKillers(esper: OwnedEsper, killers: Killer[]): void {
  esper.killers ??= [];
  for (const { name, physical, magical } of killers) {
    let data = esper.killers.find((k) => k.name === name);
    if (!data) esper.killers.push((data = { name }));
    if (physical) data.physical = (data.physical ?? 0) + physical;
    if (magical) data.magical = (data.magical ?? 0) + magical;
  }
}

function removeKillers(esper: OwnedEsper, killers: Killer[]): void {
  for (const killer of killers) {
    const index = esper.killers?.findIndex((k) => k.name === killer.name) ?? -1;
    if (index < 0) continue;
    const data = esper.killers![index];
    for (const kind of ['physical', 'magical'] as const) {
      if (!killer[kind]) continue;
      data[kind] = (data[kind] ?? 0) - killer[kind];
      if (data[kind] === 0) delete data[kind];
    }
    if (!data.physical && !data.magical) esper.killers!.splice(index, 1);
  }
  if (esper.killers?.length === 0) delete esper.killers;
}

function addResist(esper: OwnedEsper, resist: Resist[]): void {
  esper.resist ??= [];
  for (const entry of resist) {
    const existing = esper.resist.find((r) => r.name === entry.name);
    if (existing) existing.percent += entry.percent;
    else esper.resist.push({ ...entry });
  }
}

function removeResist(esper: OwnedEsper, resist: Resist[]): void {
  for (const entry of resist) {
    const index = esper.resist?.findIndex((r) => r.name === entry.name) ?? -1;
    if (index < 0) continue;
    esper.resist![index].percent -= entry.percent;
    if (esper.resist![index].percent === 0) esper.resist!.splice(index, 1);
  }
  if (esper.resist?.length === 0) delete esper.resist;
}

function addNodeEffects(esper: OwnedEsper, node: BoardNode): void {
  if (node.killers) addKillers(esper, node.killers);
  if (node.resist) addResist(esper, node.resist);
  if (node.esperStatsBonus) {
    esper.esperStatsBonus ??= { all: { hp: 0, mp: 0, atk: 0, def: 0, mag: 0, spr: 0 } };
    for (const stat of baseStats as Stat[]) esper.esperStatsBonus.all[stat] += node.esperStatsBonus[stat];
  }
  if (node.lbPerTurn) esper.lbPerTurn = node.lbPerTurn;
  if (node.lbFillRate) esper.lbFillRate = node.lbFillRate;
  if (node.lbDamage) esper.lbDamage = node.lbDamage;
  if (node.evade?.physical || node.evade?.magical) {
    esper.evade ??= {};
    if (node.evade.physical) esper.evade.physical = node.evade.physical;
    if (node.evade.magical) esper.evade.magical = node.evade.magical;
  }
  if (node.conditional) (esper.conditional ??= []).push(...node.conditional);
  for (const stat of baseStats) {
    const key = percentValues[stat as Stat];
    if (node[key]) esper[key] = ((esper[key] as number | undefined) ?? 0) + (node[key] as number);
  }
}

function removeNodeEffects(esper: OwnedEsper, node: BoardNode): void {
  if (node.killers) removeKillers(esper, node.killers);
  if (node.resist) removeResist(esper, node.resist);
  if (node.esperStatsBonus && esper.esperStatsBonus) {
    for (const stat of baseStats as Stat[]) esper.esperStatsBonus.all[stat] -= node.esperStatsBonus[stat];
    if ((baseStats as Stat[]).every((stat) => esper.esperStatsBonus!.all[stat] === 0)) delete esper.esperStatsBonus;
  }
  if (node.lbPerTurn) delete esper.lbPerTurn;
  if (node.lbFillRate) delete esper.lbFillRate;
  if (node.lbDamage) delete esper.lbDamage;
  if (node.jumpDamage) delete esper.jumpDamage;
  if (node.evade?.physical && esper.evade?.physical) delete esper.evade.physical;
  if (node.evade?.magical && esper.evade?.magical) delete esper.evade.magical;
  if (node.evade && !node.evade.physical && !node.evade.magical) delete esper.evade;
  if (node.conditional && esper.conditional) {
    for (const entry of node.conditional) {
      const index = esper.conditional.findIndex((c) => c.equipedCondition === entry.equipedCondition);
      if (index >= 0) esper.conditional.splice(index, 1);
    }
    if (esper.conditional.length === 0) delete esper.conditional;
  }
  for (const stat of baseStats) {
    const key = percentValues[stat as Stat];
    if (!node[key]) continue;
    esper[key] = (esper[key] as number) - (node[key] as number);
    if (esper[key] === 0) delete esper[key];
  }
}

function unselect(esper: OwnedEsper, node: BoardNode): void {
  const position = positionString(...node.position);
  const index = esper.selectedSkills.indexOf(position);
  if (index < 0) return;
  esper.selectedSkills.splice(index, 1);
  removeNodeEffects(esper, node);
  node.children.forEach((child) => unselect(esper, child));
}

/**
 * A click on the board: the center resets everything, a selected node frees itself and its descendants, any other node
 * selects the whole path to it. Returns false when there is no node there (nothing changed).
 */
export function toggleNode(board: EsperBoard, esper: OwnedEsper, x: number, y: number): boolean {
  const isCenter = x === 0 && y === 0;
  const path = findPathTo(x, y, board.nodes);
  if (!path && !isCenter) return false;
  if (isCenter) {
    board.nodes.forEach((node) => unselect(esper, node));
  } else if (esper.selectedSkills.includes(positionString(x, y))) {
    unselect(esper, path![path!.length - 1]);
  } else {
    for (const node of path!) {
      const position = positionString(...node.position);
      if (esper.selectedSkills.includes(position)) continue;
      esper.selectedSkills.push(position);
      addNodeEffects(esper, node);
    }
  }
  updateStats(board, esper);
  return true;
}

/** The effects of the selected nodes, added to an Esper that only has its `selectedSkills` (a shared link). */
export function applySelectedNodes(board: EsperBoard, esper: OwnedEsper): void {
  for (const position of esper.selectedSkills) {
    const { x, y } = parsePosition(position);
    const path = findPathTo(x, y, board.nodes);
    if (path) addNodeEffects(esper, path[path.length - 1]);
  }
}

/** A new Esper at the given rarity: level at the maximum, no node selected. */
export function newEsper(info: EsperInfo, rarity: number, board: EsperBoard): OwnedEsper {
  const esper: OwnedEsper = {
    name: info.name,
    id: info.id,
    rarity,
    level: MAX_LEVEL_BY_STAR[rarity],
    selectedSkills: [],
    resist: structuredClone(board.resist[rarity]),
  };
  updateStats(board, esper);
  return esper;
}

// --- Shared link: `Name|rarity|level|<hex of the selected nodes>` ---

/** The old `escapeName`: the name as used in the link and in the picture class. */
export const escapeName = (name: string): string => name.replace(/[+%&': ().]/g, '_');

/** The picture class of an Esper (the sprite named after the Black Dragon is `Kokuryu`). */
export function esperSprite(name: string): string {
  const escaped = escapeName(name);
  return `img img-esper-${escaped === 'Black_Dragon' ? 'Kokuryu' : escaped}`;
}

const bin2hex = (bin: string): string =>
  (bin + '0'.repeat((4 - (bin.length % 4)) % 4))
    .match(/.{4}/g)!
    .map((bits) => parseInt(bits, 2).toString(16))
    .join('');

const hex2bin = (hex: string): string =>
  [...hex].map((char) => parseInt(char, 16).toString(2).padStart(4, '0')).join('');

export function encodeEsperLink(esper: OwnedEsper): string {
  const board = importBoardConversion
    .map(([x, y]) => positionString(x, y))
    .map((position) => (position === '0_0' || esper.selectedSkills.includes(position) ? '1' : '0'))
    .join('');
  return `${escapeName(esper.name)}|${esper.rarity}|${esper.level}|${bin2hex(board)}`;
}

/** The positions marked in the hex board of a link or of an imported file (the center is not a node). */
export function decodeBoard(hex: string): string[] {
  const positions: string[] = [];
  [...hex2bin(hex)].forEach((bit, index) => {
    const coordinate = importBoardConversion[index];
    if (bit === '1' && coordinate) positions.push(positionString(coordinate[0], coordinate[1]));
  });
  return positions;
}

/** Reads `Name|rarity|level|hex`; null when the Esper is unknown. The `selectedSkills` include the center, as the old site did. */
export function decodeEsperLink(text: string, espers: EsperInfo[]): OwnedEsper | null {
  const [name, rarity, level, board] = decodeURI(text).split('|');
  const esperName = name.replace('_', ' ');
  const info = espers.find((esper) => esper.id.toUpperCase() === esperName.toUpperCase());
  if (!info) return null;
  return {
    ...structuredClone(info),
    name: esperName,
    rarity: parseInt(rarity),
    level: parseInt(level),
    selectedSkills: decodeBoard(board ?? ''),
  };
}

/** The Esper ids of the game files that can be imported (the old import feature). */
export const IMPORT_ESPER_NAMES: Record<number, string> = {
  1: 'Siren',
  2: 'Ifrit',
  3: 'Shiva',
  4: 'Carbuncle',
  5: 'Diabolos',
  6: 'Golem',
  7: 'Ramuh',
  8: 'Titan',
  9: 'Tetra Sylphid',
  10: 'Odin',
  11: 'Lakshmi',
  12: 'Leviathan',
  13: 'Alexander',
  14: 'Phoenix',
  15: 'Bahamut',
  16: 'Fenrir',
  17: 'Anima',
  18: 'Asura',
  19: 'Kokuryu',
  20: 'Garuda',
};
