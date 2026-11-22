import type { DataStorage } from '../data-storage.js';
import { includeAll, matches } from '../../array-utils.js';
import { getElementCoef } from '../damage/damage-helpers.js';
import { applyEnhancements } from '../item-combination.js';
import { isApplicable } from '../item-conditions.js';
import { adventurerIds } from '../../constants/game-ids.js';
import { baseStats } from '../../constants/base-lists.js';
import { weaponList } from '../../constants/item-types.js';

export function prepareItem(
  storage: DataStorage,
  item,
  baseValues,
  enemyStats,
  elementBuffs,
  availableNumber,
  ownedAvailableNumber,
  adventurersAvailable,
  alreadyAddedIds,
  equipable,
  pinnedItemIds,
  tmrAbilityEnhancedItem = false,
) {
  var added: any = false;
  if (
    storage.defaultWeaponEnhancement &&
    storage.defaultWeaponEnhancement.length > 0 &&
    weaponList.includes(item.type) &&
    !item.enhancements
  ) {
    item = applyEnhancements(item, storage.defaultWeaponEnhancement, storage.itemEnchantments);
  }
  for (var index: any = 0, len = baseStats.length; index < len; index++) {
    item['total_' + baseStats[index]] = storage.getStatValueIfExists(
      item,
      baseStats[index],
      baseValues[baseStats[index]].total,
    );
  }
  if (item.element && !includeAll(storage.unitBuild.innateElements, item.element)) {
    item.elementType = 'element';
    item.elementCoef = getElementCoef(item.element, enemyStats) * -1;
  } else {
    item.elementType = 'neutral';
  }
  if (availableNumber > 0 && isApplicable(item, storage.unitBuild.unit)) {
    if (
      (item.special && item.special.includes('dualWield')) ||
      (item.partialDualWield && matches(equipable, item.partialDualWield))
    ) {
      storage.dualWieldSources.push(storage.getItemEntry(item, 1, ownedAvailableNumber > 0));
    }
    if (item.allowUseOf) {
      let allowUseOf = item.allowUseOf;
      if (!Array.isArray(item.allowUseOf)) {
        allowUseOf = [allowUseOf];
      }
      if (allowUseOf.filter((a) => !equipable.includes(a)).length > 0) {
        storage.equipSources.push(item);
      }
    }
    if (storage.itemCanBeOfUseForGoal(item, enemyStats, elementBuffs)) {
      if (storage.itemWithUnstackableSkillOnlyUsefulInOne(item, enemyStats, elementBuffs)) {
        availableNumber = Math.min(1, availableNumber);
        ownedAvailableNumber = Math.min(1, ownedAvailableNumber);
      }
      if (adventurerIds.includes(item.id)) {
        // Manage adventurers to only keep the best available
        adventurersAvailable[item.id] = item;
        return;
      }
      if (item.equipedConditions) {
        if (ownedAvailableNumber < availableNumber) {
          if (ownedAvailableNumber > 0) {
            storage.dataWithCondition.push(storage.getItemEntry(item, ownedAvailableNumber, true));
          }
          storage.dataWithCondition.push(storage.getItemEntry(item, availableNumber - ownedAvailableNumber, false));
        } else {
          storage.dataWithCondition.push(storage.getItemEntry(item, availableNumber, true));
        }
      } else {
        if (!alreadyAddedIds.includes(item.id)) {
          if (!storage.dataByType[item.type]) {
            storage.dataByType[item.type] = [];
          }
          if (ownedAvailableNumber < availableNumber) {
            if (ownedAvailableNumber > 0) {
              storage.dataByType[item.type].push(storage.getItemEntry(item, ownedAvailableNumber, true));
            }
            storage.dataByType[item.type].push(
              storage.getItemEntry(item, availableNumber - ownedAvailableNumber, false),
            );
          } else {
            storage.dataByType[item.type].push(storage.getItemEntry(item, availableNumber, true));
          }
          if (!tmrAbilityEnhancedItem) {
            alreadyAddedIds.push(item.id);
          }
          added = true;
        }
      }
    }
    if (weaponList.includes(item.type)) {
      storage.addToWeaponsByTypeAndHands(item);
    }
  } else if (pinnedItemIds.includes(item.id)) {
    storage.addToWeaponsByTypeAndHands(item);
  }
  return added;
}

export function addToWeaponsByTypeAndHands(storage: DataStorage, item) {
  if (weaponList.includes(item.type)) {
    if (!storage.weaponsByTypeAndHands[item.type]) {
      storage.weaponsByTypeAndHands[item.type] = {};
    }
    var handNumber: any = 1;
    if (item.special && item.special.includes('twoHanded')) {
      handNumber = 2;
    }
    if (!storage.weaponsByTypeAndHands[item.type][handNumber]) {
      storage.weaponsByTypeAndHands[item.type][handNumber] = 0;
    }
    storage.weaponsByTypeAndHands[item.type][handNumber]++;
  }
}
