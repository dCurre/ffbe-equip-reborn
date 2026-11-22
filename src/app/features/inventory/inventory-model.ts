import { ailmentList, baseStats, elementList, killerList } from '../../../core/constants/base-lists';
import { itemEnhancementLabels } from '../../../core/constants/item-enhancement-labels';
import { skillIdByItemEnhancement } from '../../../core/constants/item-enhancement-skills';
import { typeList, weaponList } from '../../../core/constants/item-types';
import { applyEnhancements } from '../../../core/builder/item-combination';
import { getItemEntry } from '../../../core/builder/item-entry';
import { ItemPool } from '../../../core/builder/item-pool';
import { Item } from '../../game/helpers/item';
import { cardInstance, VisionCard } from '../../game/helpers/vision-cards';
import { ItemInventory } from '../../shared/services/inventory';

/** A line of the inventory: an item (or an enhanced copy of it, or one vision card) and how many of them the user owns. */
export interface ItemEntry {
  /** a key that stays the same while the item stays in the list (the ids of the core entries change each time) */
  key: string;
  item: Item;
  ownedNumber: number;
  owned: boolean;
  enhanced: boolean;
  /** which enhanced copy of the item (or which card) it is */
  enhancementPos: number;
  visionCard?: VisionCard;
  /** the recipe of an STMR that can still be made */
  stmrAccess?: { base: string; sevenStar: number; sixStar: number; stmrMoogle: number };
  /** the items that make this one sellable, with how many of each the user owns */
  betterItems?: Record<string, { name: string; available: number }>;
  [field: string]: unknown;
}

export type Enchantments = Readonly<Record<string, { id: number; effects: string; enchant: Record<string, unknown> }>>;

const entry = (item: Item, number: number, key: string, enhanced = false, pos = 0): ItemEntry => {
  const result = getItemEntry(item, number, enhanced, pos) as unknown as ItemEntry;
  result.key = key;
  return result;
};

/** The items listed once each: among the versions of an item the one with the most conditions (or exclusive units) wins. */
export function oneOfEach(data: readonly Item[]): Item[] {
  const byId = new Map<string, Item>();
  for (const item of data) {
    const kept = byId.get(item.id);
    if (!kept) {
      byId.set(item.id, item);
      continue;
    }
    if (item['equipedConditions']) {
      if (!kept['equipedConditions'] || item['equipedConditions'].length > kept['equipedConditions'].length) {
        byId.set(item.id, item);
      }
    }
    if (item['exclusiveUnits']) byId.set(item.id, item);
  }
  return [...byId.values()];
}

/** The lines of one item: each enhanced copy on its own, then what is left (or the item not owned). */
function itemEntries(item: Item, inventory: ItemInventory, enchantments: Enchantments): ItemEntry[] {
  const owned = typeof inventory[item.id] === 'number' ? (inventory[item.id] as number) : 0;
  const enhanced = inventory.enchantments[item.id];
  if (!enhanced) return [entry(item, owned, `${item.id}#n`)];
  const entries = enhanced.map((enhancements, pos) =>
    entry(applyEnhancements(item, enhancements, enchantments) as Item, 1, `${item.id}#e${pos}`, true, pos),
  );
  if (owned > enhanced.length) entries.push(entry(item, owned - enhanced.length, `${item.id}#n`));
  return entries;
}

/** The lines of the vision cards: one for each card owned (with its level) or one not owned. */
function cardEntries(cards: readonly VisionCard[], inventory: ItemInventory): ItemEntry[] {
  const result: ItemEntry[] = [];
  for (const card of cards) {
    const owned = typeof inventory[card.id] === 'number' ? (inventory[card.id] as number) : 0;
    if (!owned) {
      const line = entry(cardInstance(card, 1), 0, `${card.id}#c0`);
      line.visionCard = card;
      result.push(line);
    } else if (card.levels.length === 1) {
      const line = entry(cardInstance(card, 1), owned, `${card.id}#c0`);
      line.visionCard = card;
      result.push(line);
    } else {
      const levels = inventory.visionCardsLevels as Record<string, (number | null)[]>;
      if (!levels[card.id] || levels[card.id][0] === null) levels[card.id] = Array.from({ length: owned }, () => 1);
      levels[card.id].forEach((level, index) => {
        const line = entry(cardInstance(card, level ?? 1), owned, `${card.id}#c${index}`, false, index);
        line.visionCard = card;
        result.push(line);
      });
    }
  }
  return result;
}

export interface Entries {
  equipments: ItemEntry[];
  materia: ItemEntry[];
}

export function buildEntries(
  data: readonly Item[],
  cards: readonly VisionCard[],
  inventory: ItemInventory,
  enchantments: Enchantments,
): Entries {
  const each = (items: Item[]) => items.flatMap((item) => itemEntries(item, inventory, enchantments));
  return {
    equipments: [...each(oneOfEach(data.filter((d) => d.type !== 'materia'))), ...cardEntries(cards, inventory)],
    materia: each(oneOfEach(data.filter((d) => d.type === 'materia'))),
  };
}

// --- Order of the lines ---

const SORT_ORDER_DEFAULT = ['atk', 'mag', 'def', 'spr', 'sortId'];
const SORT_ORDER_DEFENSE = ['def', 'spr', 'atk', 'mag', 'hp', 'mp', 'sortId'];
const SORT_ORDER_BY_TYPE: Record<string, string[]> = {
  lightShield: SORT_ORDER_DEFENSE,
  heavyShield: SORT_ORDER_DEFENSE,
  hat: SORT_ORDER_DEFENSE,
  helm: SORT_ORDER_DEFENSE,
  lightArmor: SORT_ORDER_DEFENSE,
  heavyArmor: SORT_ORDER_DEFENSE,
  robe: SORT_ORDER_DEFENSE,
  clothes: SORT_ORDER_DEFENSE,
  accessory: SORT_ORDER_DEFENSE,
  materia: [],
};

const statOf = (item: Item, stat: string): number =>
  stat === 'type'
    ? typeList.length - typeList.indexOf(item.type)
    : stat === 'id'
      ? parseInt(item.id)
      : (item[stat] ?? 0);

/** Capital letters first, then letter by letter (not like `localeCompare`, which ignores the case first). */
export function compareName(name1: string, name2: string): number {
  const length = Math.min(name1.length, name2.length);
  for (let i = 0; i < length; i++) {
    const letter1 = name1[i];
    const letter2 = name2[i];
    const upper1 = letter1 === letter1.toUpperCase();
    const upper2 = letter2 === letter2.toUpperCase();
    if (upper1 !== upper2) return upper1 ? -1 : 1;
    const result = letter1.localeCompare(letter2);
    if (result !== 0) return result;
  }
  return Math.sign(name1.length - name2.length);
}

/** By type, then by the stats the type is chosen for, then by name. */
export function sortEntries(entries: readonly ItemEntry[]): ItemEntry[] {
  return [...entries].sort((a, b) => {
    const type1 = statOf(a.item, 'type');
    const type2 = statOf(b.item, 'type');
    if (type1 !== type2) return type2 - type1;
    for (const stat of SORT_ORDER_BY_TYPE[a.item.type] ?? SORT_ORDER_DEFAULT) {
      const value1 = statOf(a.item, stat);
      const value2 = statOf(b.item, stat);
      if (value1 !== value2) return value2 - value1;
    }
    return compareName(a.item['jpname'] || a.item.name, b.item['jpname'] || b.item.name);
  });
}

// --- Statistics of the sidebar ---

export interface TypeStat {
  different: number;
  total: number;
  number: number;
}

/** How many different items of each type exist, and how many the user owns (as "different (copies)"). */
export function inventoryStats(data: readonly Item[], inventory: ItemInventory): Record<string, TypeStat> {
  const stats: Record<string, TypeStat> = {};
  for (const item of oneOfEach(data)) {
    const stat = (stats[item.type] ??= { different: 0, total: 0, number: 0 });
    stat.total++;
    const owned = inventory[item.id];
    if (owned && typeof owned === 'number') {
      stat.different++;
      stat.number += owned;
    }
  }
  return stats;
}

// --- Changes of the inventory ---

/** Why an item cannot be added: the user already owns the most there can be. */
export function addItem(inventory: ItemInventory, line: ItemEntry, force = false): 'added' | 'limit' {
  const id = line.item.id;
  const owned = typeof inventory[id] === 'number' ? (inventory[id] as number) : 0;
  const maxNumber = line.item['maxNumber'];
  if (owned && !force && maxNumber && owned >= maxNumber) return 'limit';
  inventory[id] = owned + 1;
  if (line.visionCard && line.visionCard.levels.length > 1) {
    const levels = inventory.visionCardsLevels as Record<string, number[]>;
    (levels[id] ??= []).push(1);
  }
  return 'added';
}

export function removeItem(inventory: ItemInventory, line: ItemEntry): void {
  const id = line.item.id;
  const owned = typeof inventory[id] === 'number' ? (inventory[id] as number) : 0;
  if (!owned) return;
  if (owned === 1) {
    delete inventory[id];
    delete inventory.enchantments[id];
    delete inventory.visionCardsLevels[id];
    return;
  }
  inventory[id] = owned - 1;
  if (line.enhanced) inventory.enchantments[id].splice(line.enhancementPos, 1);
  if (line.visionCard && line.visionCard.levels.length > 1) {
    (inventory.visionCardsLevels as Record<string, number[]>)[id].splice(line.enhancementPos, 1);
  }
  if (inventory.enchantments[id]?.length === 0) delete inventory.enchantments[id];
}

export function changeCardLevel(inventory: ItemInventory, line: ItemEntry, change: 1 | -1): void {
  const card = line.visionCard;
  const level = line.item['level'] as number;
  if (!card || level + change < 1 || level + change > card.levels.length) return;
  (inventory.visionCardsLevels as Record<string, number[]>)[line.item.id][line.enhancementPos] = level + change;
}

export function toggleExcludedFromExpedition(inventory: ItemInventory, id: string): void {
  const excluded = (inventory['excludeFromExpeditions'] ?? []) as unknown as string[];
  const at = excluded.indexOf(id);
  if (at >= 0) excluded.splice(at, 1);
  else excluded.push(id);
  (inventory as Record<string, unknown>)['excludeFromExpeditions'] = excluded;
}

export const MAX_ENHANCEMENTS = 3;

/** Starts the enhancement of a copy: a new empty enhanced copy is taken from the not enhanced ones. Returns its position. */
export function startEnhancement(inventory: ItemInventory, line: ItemEntry): number {
  if (line.enhanced) return line.enhancementPos;
  const copies = (inventory.enchantments[line.item.id] ??= []);
  copies.push([]);
  return copies.length - 1;
}

/** Adds or removes one enhancement of a copy (at most three); a copy without enhancement goes back to the plain ones. */
export function toggleEnhancement(
  inventory: ItemInventory,
  itemId: string,
  pos: number,
  enhancement: string | number,
): 'added' | 'removed' | 'copyRemoved' | 'full' {
  const enhancements = inventory.enchantments[itemId][pos] as (string | number)[];
  const at = enhancements.indexOf(enhancement);
  if (at >= 0) {
    enhancements.splice(at, 1);
    if (enhancements.length > 0) return 'removed';
    inventory.enchantments[itemId].splice(pos, 1);
    if (inventory.enchantments[itemId].length === 0) delete inventory.enchantments[itemId];
    return 'copyRemoved';
  }
  if (enhancements.length >= MAX_ENHANCEMENTS) return 'full';
  enhancements.push(enhancement);
  return 'added';
}

/** What the "tools" tab adds: up to this many copies of each item. */
export const ADD_ALL_EQUIPMENT = 2;
export const ADD_ALL_MATERIA = 4;

/** Adds copies of the items up to `amount` each (stopping at their limit); returns the lines of the copies added. */
export function addAll(inventory: ItemInventory, lines: readonly ItemEntry[], amount: number): ItemEntry[] {
  const added: ItemEntry[] = [];
  for (const line of lines) {
    for (let i = 0; i < amount; i++) if (addItem(inventory, line) === 'added') added.push(line);
  }
  return added;
}

// --- The farmed TMR of a unit ---

/** One more of the TMR of a unit is farmed: one more owned, one less farmable. Returns the TMR item, if it exists. */
export function farmTmr(
  inventory: ItemInventory,
  data: readonly Item[],
  units: Record<string, { farmable: number }>,
  unitId: string,
  line: ItemEntry | undefined,
): Item | undefined {
  const item = [...data].reverse().find((d) => d['tmrUnit'] === unitId);
  if (!item || !line) return undefined;
  addItem(inventory, line, true);
  units[unitId].farmable -= 1;
  return item;
}

// --- Sellable items and enhancement candidates ---

export const SELLABLE_ITEMS_ACCESS = ['shop', 'recipe', 'recipe-chest', 'recipe-key', 'recipe-quest', 'recipe-shop'];

const ENEMY = {
  races: killerList,
  def: 100,
  spr: 100,
  elementalResists: { dark: 0, light: 0, earth: 0, wind: 0, water: 0, lightning: 0, ice: 0, fire: 0 },
  breaks: { atk: 0, def: 0, mag: 0, spr: 0 },
  buffs: { atk: 0, def: 0, mag: 0, spr: 0 },
  breakability: { atk: true, def: true, mag: true, spr: true },
  imperils: { fire: 0, ice: 0, lightning: 0, water: 0, earth: 0, wind: 0, light: 0, dark: 0 },
};

const INVOLVED_STATS = [
  ...baseStats,
  'physicalKiller',
  'magicalKiller',
  'meanDamageVariance',
  'evoMag',
  'jumpDamage',
  'lbDamage',
  'drawAttacks',
  'lbPerTurn',
  'evade.physical',
  'evade.magical',
  'mpRefresh',
  ...ailmentList.map((a) => `resist|${a}.percent`),
  ...elementList.map((e) => `resist|${e}.percent`),
];

const elementsKey = (item: Item): string => (item['element'] ? [...item['element']].sort().join('-') : 'none');

/** The weapons are compared only with the weapons of the same type and elements, the other items by type. */
function groupForComparison(lines: readonly ItemEntry[]): ItemEntry[][] {
  const groups = new Map<string, ItemEntry[]>();
  for (const line of lines) {
    const key = weaponList.includes(line.item.type) ? `${line.item.type}|${elementsKey(line.item)}` : line.item.type;
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  return typeList.flatMap((type) =>
    [...groups].filter(([key]) => key === type || key.startsWith(`${type}|`)).map(([, group]) => group),
  );
}

type Pool = InstanceType<typeof ItemPool>;
interface Group {
  id: string;
  betterGroups: string[];
  equivalents: ItemEntry[];
  active?: boolean;
}

/** Walks the groups from the best items down: `visit` tells each group how many better items the user has. */
function walkGroups(pool: Pool, visit: (group: Group, betterNumber: number) => void): void {
  const done = new Set<string>();
  const walk = (group: Group): void => {
    if (done.has(group.id)) return;
    done.add(group.id);
    const better = group.betterGroups.reduce((sum, id) => sum + pool.groupByIds[id].available, 0);
    visit(group, better);
    for (const id of pool.lesserGroupsById[group.id] ?? []) walk(pool.groupByIds[id]);
  };
  (pool.keptItems as Group[]).filter((group) => group.active).forEach(walk);
}

function poolOf(lines: readonly ItemEntry[], depth: number): Pool {
  const pool = new ItemPool(depth, INVOLVED_STATS, ENEMY, [], [], [], true, true, undefined);
  pool.addItems(lines);
  pool.prepare();
  return pool;
}

const owned = (inventory: ItemInventory, line: ItemEntry): boolean => !!inventory[line.item.id];

/** The weapons the user owns that are among the best ones (at most `depth` better items): worth enhancing in the Item World. */
export function enhancementCandidates(
  equipments: readonly ItemEntry[],
  inventory: ItemInventory,
  depth: number,
): ItemEntry[] {
  const weapons = equipments.filter((line) => weaponList.includes(line.item.type) && owned(inventory, line));
  const ids = new Set<string>();
  for (const group of groupForComparison(weapons)) {
    const pool = poolOf(group, depth + 1);
    walkGroups(pool, (found, better) => {
      if (better <= depth) found.equivalents.forEach((line) => ids.add(line.key));
    });
  }
  return weapons.filter(
    (line) => line.item['partialDualWield'] || line.item['special']?.includes('dualWield') || ids.has(line.key),
  );
}

/** The items that can be bought or crafted again, or that have more than `depth` strictly better items owned. */
export function sellableItems(
  lines: readonly ItemEntry[],
  inventory: ItemInventory,
  depth: number,
  includeRecipes: boolean,
): ItemEntry[] {
  const candidates = lines.filter(
    (line) => !line.item['exclusiveUnits'] && !line.item['equipedConditions'] && owned(inventory, line),
  );
  const sellable = new Map<string, Record<string, { name: string; available: number }>>();
  for (const group of groupForComparison(candidates)) {
    const pool = poolOf(group, 9999);
    walkGroups(pool, (found, better) => {
      if (better <= depth) return;
      const betterItems: Record<string, { name: string; available: number }> = {};
      for (const id of found.betterGroups) {
        for (const equivalent of pool.groupByIds[id].equivalents as ItemEntry[]) {
          betterItems[equivalent.key] ??= { name: equivalent.item.name, available: equivalent['available'] as number };
        }
      }
      for (const line of found.equivalents) if (!sellable.has(line.key)) sellable.set(line.key, betterItems);
    });
  }
  const access = includeRecipes ? SELLABLE_ITEMS_ACCESS : ['shop'];
  return candidates
    .filter(
      (line) =>
        line.item.access.some((a) => access.includes(a)) ||
        (!line.item['partialDualWield'] &&
          !line.item['equipedConditions'] &&
          !line.item['allowUseOf'] &&
          !line.item['special'] &&
          sellable.has(line.key)),
    )
    .map((line) => ({ ...line, betterItems: sellable.get(line.key) }));
}

// --- Import and export ---

export interface ImportedItem {
  id: string;
  count: number;
  level?: number;
  enhancements?: string[];
}

export const isItemFile = (data: unknown): data is ImportedItem[] =>
  Array.isArray(data) &&
  data.length <= 9999 &&
  data.every(
    (i) =>
      typeof i?.id === 'string' &&
      i.id.length >= 9 &&
      i.id.length <= 12 &&
      typeof i.count === 'number' &&
      (i.enhancements === undefined ||
        (Array.isArray(i.enhancements) &&
          i.enhancements.length <= 3 &&
          i.enhancements.every((e: unknown) => typeof e === 'string' && e.length >= 3 && e.length <= 12))),
  );

const IDS_TO_IGNORE: Record<string, string[]> = { GL: ['409026200', '306002600'], JP: [] };

/** The inventory of the file the game exports, as the inventory of the site (`messages`: what could not be imported). */
export function importInventory(
  file: readonly ImportedItem[],
  data: readonly Item[],
  cards: readonly VisionCard[],
  enchantments: Enchantments,
  enhancementBySkillId: Readonly<Record<string, string>>,
  server: string,
): { inventory: ItemInventory; messages: string[] } {
  const inventory: ItemInventory = { enchantments: {}, visionCardsLevels: {} };
  const messages: string[] = [];
  const dataIds = new Set(data.map((item) => item.id));
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const counts = inventory as unknown as Record<string, number>;
  for (const imported of file) {
    if (IDS_TO_IGNORE[server]?.includes(imported.id)) continue;
    if (dataIds.has(imported.id)) {
      counts[imported.id] = (counts[imported.id] ?? 0) + imported.count;
      if (imported.enhancements) {
        const copies = (inventory.enchantments[imported.id] ??= []);
        copies.push(imported.enhancements.map((e) => enhancementBySkillId[e]));
        // the rare enhancements of this item (the old importer added all of them to the same copy)
        for (const enchant of Object.values(enchantments)) {
          if (String(enchant.id) === imported.id) copies[copies.length - 1].push(enchant.effects);
        }
      }
    } else if (cardsById.has(imported.id)) {
      counts[imported.id] = (counts[imported.id] ?? 0) + imported.count;
      if (cardsById.get(imported.id)!.levels.length > 1) {
        const levels = inventory.visionCardsLevels as Record<string, (number | undefined)[]>;
        (levels[imported.id] ??= []).push(imported.level);
      }
    } else {
      messages.push(`unknown item id : ${imported.id}`);
    }
  }
  return { inventory, messages };
}

export function exportCsv(
  lines: readonly ItemEntry[],
  inventory: ItemInventory,
  units: Record<string, { name: string }>,
): string {
  const labels = itemEnhancementLabels as unknown as Record<string, string | Record<string, string>>;
  const unitName = (item: Item): string => (item['tmrUnit'] ? (units[item['tmrUnit']]?.name ?? '') : '');
  let csv = 'Item Id;Item Name;Item type;Number Owned;TMR of;Access;Enhancement 1;Enhancement 2;Enhancement 3\n';
  for (const { item } of lines) {
    let count = inventory[item.id];
    if (!count || typeof count !== 'number') continue;
    const enhanced = inventory.enchantments[item.id];
    const start = `"${item.id}";"${item.name}";"${item.type}"`;
    for (const enhancements of enhanced ?? []) {
      count--;
      csv += `${start};1;"${unitName(item)}";"${item.access.join(', ')}"`;
      for (const enhancement of enhancements) {
        const label =
          enhancement === 'special_1' ? (labels[enhancement] as Record<string, string>)[item.id] : labels[enhancement];
        csv += `;"${label}"`;
      }
      csv += '\n';
    }
    if (count) csv += `${start};${count};"${unitName(item)}";"${item.access.join(', ')}"\n`;
  }
  return csv;
}

export function exportJson(inventory: ItemInventory, data: readonly Item[], enchantments: Enchantments): string {
  const typeById = Object.fromEntries(data.map((item) => [item.id, item.type]));
  const skills = skillIdByItemEnhancement as unknown as Record<string, unknown>;
  const result: Record<string, unknown>[] = [];
  const cardLevels = inventory.visionCardsLevels as Record<string, number[]>;
  for (const id of Object.keys(inventory)) {
    if (id === 'enchantments' || id === 'version' || id === 'visionCardsLevels' || id === 'excludeFromExpeditions')
      continue;
    if (cardLevels[id]?.[0]) {
      // a card: each number is the level of one card
      cardLevels[id].forEach((level) => result.push({ id, count: 1, level }));
      continue;
    }
    let count = inventory[id] as number;
    for (const enhancements of inventory.enchantments[id] ?? []) {
      count--;
      result.push({
        id,
        count: 1,
        enhancements: (enhancements as (string | number)[]).map((e) => {
          if (typeof e === 'number') return enchantments[e]?.effects;
          if (e === 'special_1') return (skills[e] as Record<string, unknown>)[id];
          if (e === 'rares') return (skills[e] as Record<string, unknown>)[typeById[id]];
          return skills[e];
        }),
      });
    }
    if (count > 0) result.push({ id, count });
  }
  return JSON.stringify(result);
}
