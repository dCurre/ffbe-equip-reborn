import { combineTwoItems } from '../../../core/builder/item-combination';
import { Item } from './item';

/** A vision card of `visionCards.json`: its base values and, for each level, what that level adds. */
export interface VisionCard extends Item {
  levels: Record<string, unknown>[];
}

/** The card instance at a level: the base values with the values of that level (`level` is 1-based). */
export function cardInstance(card: VisionCard, level: number): Item {
  const instance = combineTwoItems(card, card.levels[level - 1]) as Item;
  instance.level = level;
  return instance;
}

/**
 * Every way a card can be used: for each conditional bonus of a level, with it and without it. A bonus that needs
 * equipped types never makes a variant (the old code checked its condition with the wrong arguments, so it always skipped it).
 */
function combinations(
  item: Item,
  conditionals: Record<string, unknown>[],
  found: (item: Item) => void,
  index = 0,
): void {
  if (index === conditionals.length) {
    found(item);
    return;
  }
  combinations(item, conditionals, found, index + 1);
  const conditional = conditionals[index];
  if (conditional['equipedConditions']) return;
  const combined = combineTwoItems(item, conditional) as Item;
  for (const field of [
    'exclusiveUnits',
    'exclusiveSex',
    'max7StarUnit',
    'exclusiveRoles',
    'chainMastery',
    'singleWielding',
  ]) {
    if (conditional[field]) combined[field] = conditional[field];
  }
  combinations(combined, conditionals, found, index + 1);
}

/** The cards as items of `data`: one for each level (and conditional), with the id `<card>-<level>`. */
export function cardsAsItems(cards: Readonly<Record<string, VisionCard>>): Item[] {
  const items: Item[] = [];
  for (const card of Object.values(cards)) {
    card.levels.forEach((levelValues, index) => {
      const instance = combineTwoItems(card, levelValues) as Item;
      instance.id = `${instance.id}-${index + 1}`;
      instance.level = index + 1;
      const conditionals = (levelValues['conditional'] as Record<string, unknown>[] | undefined) ?? [];
      combinations(instance, conditionals, (found) => {
        // the stats of the last level become the stats of the card
        Object.assign(found, card.levels[card.levels.length - 1]);
        items.push(found);
      });
    });
  }
  return items;
}
