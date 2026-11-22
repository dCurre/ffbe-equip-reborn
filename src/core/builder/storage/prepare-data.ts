import type { DataStorage } from '../data-storage.js';
import { applyEnhancements } from '../item-combination.js';
import { getPlaceHolder } from '../item-entry.js';
import { ItemPool } from '../item-pool.js';
import { adventurerIds } from '../../constants/game-ids.js';
import { typeList, weaponList } from '../../constants/item-types.js';
import { getSkillIds } from '../../formula/formula-queries.js';

export function prepareData(storage: DataStorage, itemsToExclude, enemyStats, elementBuffs, formula) {
  storage.dataByType = {};
  storage.dataWithCondition = [];
  storage.dualWieldSources = [];
  storage.equipSources = [];
  storage.weaponsByTypeAndHands = {};
  storage.availableTmr = null;
  storage.availableStmr = null;
  for (var i: any = weaponList.length; i--;) {
    storage.weaponsByTypeAndHands[weaponList[i]] = {};
  }
  var tempData: any = {};
  var adventurersAvailable: any = {};
  var alreadyAddedIds: any = [];
  var equipable: any = storage.unitBuild.getCurrentUnitEquip();
  var itemNumber: any = storage.data.length;
  var pinnedItemIds: any = [];
  if (storage.unitBuild.formula) {
    storage.skillIds = getSkillIds(storage.unitBuild.formula) || [];
  } else {
    storage.skillIds = [];
  }
  for (var i: any = 0; i < 10; i++) {
    if (storage.unitBuild.fixedItems[i]) {
      pinnedItemIds.push(storage.unitBuild.fixedItems[i].id);
    }
  }

  if (storage.useElementConditionedMateria) {
    storage.addDesirableElementsFromItems(enemyStats);
  }

  for (var index: any = 0; index < itemNumber; index++) {
    var item: any = storage.data[storage.data.length - 1 - index];
    var availableNumbers: any = storage.getAvailableNumbers(item);
    var availableNumber: any = availableNumbers.available;
    var ownedAvailableNumber: any = Math.max(
      availableNumber - availableNumbers.total + availableNumbers.totalOwnedNumber,
      0,
    );
    if (itemsToExclude.includes(item.id)) {
      continue;
    }

    var addedToItems: any = false;

    if (
      availableNumber > 0 &&
      storage.unitBuild != null &&
      storage.unitBuild.unit != null &&
      item.tmrUnit &&
      item.tmrUnit == storage.unitBuild.unit.id
    ) {
      if (
        storage.defaultWeaponEnhancement &&
        storage.defaultWeaponEnhancement.length > 0 &&
        weaponList.includes(item.type) &&
        !item.enhancements
      ) {
        storage.availableTmr = applyEnhancements(item, storage.defaultWeaponEnhancement, storage.itemEnchantments);
      } else {
        storage.availableTmr = item;
      }
    }
    if (
      availableNumber > 0 &&
      storage.unitBuild != null &&
      storage.unitBuild.unit != null &&
      item.stmrUnit &&
      item.stmrUnit == storage.unitBuild.unit.id
    ) {
      if (
        storage.defaultWeaponEnhancement &&
        storage.defaultWeaponEnhancement.length > 0 &&
        weaponList.includes(item.type) &&
        !item.enhancements
      ) {
        storage.availableStmr = applyEnhancements(item, storage.defaultWeaponEnhancement, storage.itemEnchantments);
      } else {
        storage.availableStmr = item;
      }
    }

    if (
      availableNumber > 0 &&
      storage.onlyUseOwnedItems &&
      storage.itemInventory &&
      storage.itemInventory.enchantments &&
      storage.itemInventory.enchantments[item.id]
    ) {
      var enhancementsAvailables: any = storage.itemInventory.enchantments[item.id].slice();
      if (storage.alreadyUsedItems.enhancements[item.id]) {
        for (var i: any = storage.alreadyUsedItems.enhancements[item.id].length; i--;) {
          var enhancementString: any = JSON.stringify(storage.alreadyUsedItems.enhancements[item.id][i]);
          for (var j: any = enhancementsAvailables.length; j--;) {
            if (enhancementString == JSON.stringify(storage.itemInventory.enchantments[item.id][j])) {
              enhancementsAvailables.splice(j, 1);
              break;
            }
          }
        }
      }
      for (var i: any = enhancementsAvailables.length; i--;) {
        addedToItems =
          storage.prepareItem(
            applyEnhancements(item, enhancementsAvailables[i], storage.itemEnchantments),
            storage.unitBuild.baseValues,
            enemyStats,
            elementBuffs,
            1,
            ownedAvailableNumber,
            adventurersAvailable,
            alreadyAddedIds,
            equipable,
            pinnedItemIds,
            true,
          ) || addedToItems;
        availableNumber--;
        if (ownedAvailableNumber > 0) {
          ownedAvailableNumber--;
        }
      }
    }

    if (availableNumber > 0) {
      addedToItems =
        storage.prepareItem(
          item,
          storage.unitBuild.baseValues,
          enemyStats,
          elementBuffs,
          availableNumber,
          ownedAvailableNumber,
          adventurersAvailable,
          alreadyAddedIds,
          equipable,
          pinnedItemIds,
        ) || addedToItems;
    }
    if (addedToItems && !alreadyAddedIds.includes(item.id)) {
      alreadyAddedIds.push(item.id);
    }
  }
  var adventurerAlreadyPinned: any = false;
  for (var index: any = 6; index < 10; index++) {
    if (storage.unitBuild.fixedItems[index] && adventurerIds.includes(storage.unitBuild.fixedItems[index].id)) {
      adventurerAlreadyPinned = true;
      break;
    }
  }
  if (!adventurerAlreadyPinned) {
    for (var index: any = adventurerIds.length - 1; index >= 0; index--) {
      // Manage adventurers  to only keep the best available
      if (adventurersAvailable[adventurerIds[index]]) {
        if (!storage.dataByType['materia']) {
          storage.dataByType['materia'] = [];
        }
        var item: any = adventurersAvailable[adventurerIds[index]];
        var availableNumbers: any = storage.getAvailableNumbers(item);
        var availableNumber: any = availableNumbers.available;
        var ownedAvailableNumber: any = Math.max(
          availableNumber - availableNumbers.total + availableNumbers.totalOwnedNumber,
          0,
        );
        storage.dataByType['materia'].push(storage.getItemEntry(item, availableNumber, ownedAvailableNumber > 0));
        break;
      }
    }
  }
  storage.dataWithCondition.sort(function (entry1, entry2) {
    if (entry1.item.id == entry2.item.id) {
      return entry2.item.equipedConditions.length - entry1.item.equipedConditions.length;
    } else {
      return entry1.item.id - entry2.item.id;
    }
  });
  for (var typeIndex: any = 0, len = typeList.length; typeIndex < len; typeIndex++) {
    var type: any = typeList[typeIndex];
    if (storage.dataByType[type] && storage.dataByType[type].length > 0) {
      var numberNeeded: any = 1;
      if (weaponList.includes(type) || type == 'accessory') {
        numberNeeded = 2;
      }
      if (type == 'materia') {
        numberNeeded = 4;
      }
      var itemPool: any = new ItemPool(
        numberNeeded,
        storage.unitBuild.involvedStats,
        enemyStats,
        storage.desirableElements,
        storage.unitBuild.desirableItemIds,
        storage.skillIds,
        true,
        true,
        false,
      );
      /*if (storage.defaultWeaponEnhancement && storage.defaultWeaponEnhancement.length > 0 && weaponList.includes(type)) {
                  storage.dataByType[type].forEach(entry => {
                      if (!entry.item.enhancements) {
                          entry.item = applyEnhancements(entry.item, storage.defaultWeaponEnhancement, storage.itemEnchantments)
                      }
                  });
              }*/
      itemPool.addItems(storage.dataByType[type]);
      itemPool.prepare();
      //var tree: any = ItemTreeComparator.sort(storage.dataByType[type], numberNeeded, storage.unitBuild, enemyStats, storage.desirableElements, storage.unitBuild.desirableItemIds);
      storage.dataByType[type] = itemPool.getEntries();
    } else {
      storage.dataByType[type] = [{ item: getPlaceHolder(type), available: numberNeeded }];
    }
  }
  // Manage dual wield sources
  var dualWieldByType: any = {};
  for (var i: any = storage.dualWieldSources.length; i--;) {
    var entry: any = storage.dualWieldSources[i];
    if (entry.item.partialDualWield) {
      if (!dualWieldByType[entry.item.type + 'partial']) {
        dualWieldByType[entry.item.type + 'partial'] = [];
      }

      dualWieldByType[entry.item.type + 'partial'].push(entry);
    } else {
      if (!dualWieldByType[entry.item.type]) {
        dualWieldByType[entry.item.type] = [];
      }
      dualWieldByType[entry.item.type].push(entry);
    }
  }
  var types: any = Object.keys(dualWieldByType);
  storage.dualWieldSources = [];
  for (var i: any = types.length; i--;) {
    var itemPool: any = new ItemPool(
      1,
      storage.unitBuild.involvedStats,
      enemyStats,
      storage.desirableElements,
      storage.unitBuild.desirableItemIds,
      storage.skillIds,
      true,
      true,
      false,
    );
    itemPool.addItems(dualWieldByType[types[i]]);
    itemPool.prepare();
    storage.dualWieldSources = storage.dualWieldSources.concat(itemPool.getEntries().map((x) => x.item));
    /*var tree: any = ItemTreeComparator.sort(dualWieldByType[types[i]], numberNeeded, storage.unitBuild, enemyStats, storage.desirableElements, storage.unitBuild.desirableItemIds);
          for (var index: any = 0, lenChildren = tree.children.length; index < lenChildren; index++) {
              storage.dualWieldSources.push(tree.children[index].equivalents[0].item);
          }*/
  }
}
