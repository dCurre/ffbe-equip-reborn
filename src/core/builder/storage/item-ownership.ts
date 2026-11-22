import type { DataStorage } from '../data-storage.js';
import { isStackable } from '../item-values.js';
import { adventurerIds } from '../../constants/game-ids.js';

export const DATA_STORAGE_EASILY_OBTAINABLE_ITEMS = [
  'shop',
  'chest',
  'quest',
  'key',
  'colosseum',
  'recipe',
  'recipe-chest',
  'recipe-key',
  'recipe-quest',
  'recipe-shop',
  'recipe-colosseum',
];

export function getAvailableNumbers(storage: DataStorage, item) {
  if (storage.itemsToInclude && storage.itemsToInclude.includes(item.id)) {
    var numbers: any = storage.getOwnedNumber(item);
    if (!numbers.available) {
      numbers.available = 1;
      numbers.total = numbers.total + 1;
    }
    return numbers;
  } else if (storage.onlyUseOwnedItems) {
    var numbers: any = storage.getOwnedNumber(item);
    if (!isStackable(item)) {
      numbers.available = Math.min(numbers.available, 1);
    }
    return numbers;
  } else {
    var number: any;
    if (storage.onlyUseShopRecipeItems) {
      if (item.maxNumber || adventurerIds.includes(item.id)) {
        return { total: 0, available: 0, totalOwnedNumber: 0 };
      }
      var shopRecipe: any = false;
      for (var index: any = item.access.length; index--;) {
        var access: any = item.access[index];
        if (access.startsWith('recipe') || access == 'shop') {
          if (access.endsWith('event')) {
            return { total: 0, available: 0, totalOwnedNumber: 0 };
          }
          shopRecipe = true;
          if (!storage.exludeEventEquipment) {
            break;
          }
        }
      }
      if (shopRecipe) {
        return { total: 4, available: 4, totalOwnedNumber: 0 };
      } else {
        return { total: 0, available: 0, totalOwnedNumber: 0 };
      }
    } else {
      if (
        storage.excludeNotReleasedYet ||
        storage.excludeTMR5 ||
        storage.exludeEventEquipment ||
        storage.excludePremium ||
        storage.excludeSTMR
      ) {
        for (var index: any = item.access.length; index--;) {
          var access: any = item.access[index];
          if (
            (storage.excludeNotReleasedYet && access == 'not released yet') ||
            (storage.excludeTMR5 && access.startsWith('TMR-5*') && item.tmrUnit != storage.currentBuild.unit.id) ||
            (storage.excludePremium && access == 'premium') ||
            (storage.excludeSTMR && (access == 'STMR' || access == 'stmrUpgrade'))
          ) {
            return { total: 0, available: 0, totalOwnedNumber: 0 };
          }
        }
        if (storage.exludeEventEquipment && item.access.every((a) => a.endsWith('event'))) {
          return { total: 0, available: 0, totalOwnedNumber: 0 };
        }
      }
      if (item.type === 'visionCard' && item.level != storage.defaultVisionCardLevel && item.levels.length != 1) {
        return { total: 0, available: 0, totalOwnedNumber: 0 };
      }
      number = 4;
      if (item.maxNumber) {
        if (storage.alreadyUsedItems[item.id]) {
          number = item.maxNumber - storage.alreadyUsedItems[item.id];
        } else {
          number = item.maxNumber;
        }
      }
      if (!isStackable(item)) {
        if (storage.unstackablePinnedItems.includes(item.id)) {
          number = 0;
        } else {
          number = 1;
        }
      }
    }
    if (!isStackable(item)) {
      number = Math.min(number, 1);
    }
    return { total: number, available: number, totalOwnedNumber: 0 };
  }
}

export function getOwnedNumber(storage: DataStorage, item) {
  var totalNumber: any = 0;
  var totalOwnedNumber: any = 0;
  var availableNumber: any = 0;
  if (
    storage.onlyUseOwnedItemsAvailableForExpeditions &&
    storage.itemInventory.excludeFromExpeditions.includes(item.id)
  ) {
    return { total: 0, available: 0, totalOwnedNumber: 0 };
  }
  if (item.type == 'visionCard') {
    let indexOfDash = item.id.indexOf('-');
    let baseId = item.id.substr(0, indexOfDash);
    let level = item.id.substr(indexOfDash + 1);
    if (storage.itemInventory.visionCardsLevels[baseId]) {
      totalNumber = storage.itemInventory.visionCardsLevels[baseId].filter((l) => l == level).length;
    } else if (storage.itemInventory[baseId]) {
      totalNumber = storage.itemInventory[baseId];
    }
  } else {
    if (storage.itemInventory[item.id]) {
      totalNumber = storage.itemInventory[item.id];
    }
  }

  totalOwnedNumber = totalNumber;
  if (storage.includeTMROfOwnedUnits) {
    if (item.tmrUnit && storage.ownedUnits[item.tmrUnit]) {
      totalNumber += storage.ownedUnits[item.tmrUnit].farmable;
    }
  }
  if (storage.includeTmrMoogles) {
    if (item.tmrUnit && storage.ownedUnits[item.tmrUnit] && storage.ownedUnits[item.tmrUnit].tmrMoogles) {
      totalNumber += storage.ownedUnits[item.tmrUnit].tmrMoogles.length;
    }
  }
  if (
    storage.includeTrialRewards &&
    totalNumber == 0 &&
    item.access.includes('trial') &&
    (!item.access.includes('not released yet') || !storage.excludeNotReleasedYet)
  ) {
    totalNumber += 1;
  }
  if (
    storage.includeEasilyObtainableItems &&
    totalNumber == 0 &&
    item.access.some((type) => DATA_STORAGE_EASILY_OBTAINABLE_ITEMS.includes(type))
  ) {
    totalNumber += item.maxNumber ? item.maxNumber : 4;
  }
  if (storage.includeChocoboItems && totalNumber == 0 && item.access.includes('chocobo')) {
    totalNumber += item.maxNumber ? item.maxNumber : 4;
  }
  if (storage.includeFarmableStmr && totalNumber === 0 && storage.farmableStmrs[item.id]) {
    totalNumber += 1;
  }

  if (storage.alreadyUsedItems[item.id]) {
    availableNumber = Math.max(0, totalNumber - storage.alreadyUsedItems[item.id]);
    if (!isStackable(item)) {
      if (storage.unstackablePinnedItems.includes(item.id)) {
        availableNumber = 0;
      } else {
        availableNumber = Math.min(1, availableNumber);
      }
    }
  } else {
    availableNumber = totalNumber;
  }
  return { total: totalNumber, available: availableNumber, totalOwnedNumber: totalOwnedNumber };
}

export function calculateAlreadyUsedItems(storage: DataStorage, builds, currentUnitIndex) {
  storage.alreadyUsedItems = { enhancements: {} };
  storage.unstackablePinnedItems = [];
  storage.alreadyUsedEspers = [];
  for (var i: any = 0, len = builds.length; i < len; i++) {
    if (i != currentUnitIndex) {
      let unitItems = getUnitItems(builds[i]);

      Object.keys(unitItems).forEach((id) => {
        if (id !== 'enhancements') {
          if (storage.alreadyUsedItems[id]) {
            storage.alreadyUsedItems[id] += unitItems[id];
          } else {
            storage.alreadyUsedItems[id] = unitItems[id];
          }
        }
      });
      Object.keys(unitItems.enhancements).forEach((id) => {
        if (!storage.alreadyUsedItems.enhancements[id]) {
          storage.alreadyUsedItems.enhancements[id] = [];
        }
        storage.alreadyUsedItems.enhancements[id] = storage.alreadyUsedItems.enhancements[id].concat(
          unitItems.enhancements[id],
        );
      });

      if (builds[i].build[11]) {
        storage.alreadyUsedEspers.push(builds[i].build[11].id);
      }
    } else {
      for (var index: any = 0; index < 10; index++) {
        if (builds[i].fixedItems[index]) {
          var item: any = builds[i].fixedItems[index];
          if (item) {
            if (storage.alreadyUsedItems[item.id]) {
              storage.alreadyUsedItems[item.id]++;
            } else {
              storage.alreadyUsedItems[item.id] = 1;
            }
            if (item.enhancements) {
              if (!storage.alreadyUsedItems.enhancements[item.id]) {
                storage.alreadyUsedItems.enhancements[item.id] = [];
              }
              storage.alreadyUsedItems.enhancements[item.id].push(item.enhancements);
            }
            if (!isStackable(item)) {
              storage.unstackablePinnedItems.push(item.id);
            }
          }
        }
      }
      if (builds[i].fixedItems[11]) {
        storage.alreadyUsedEspers.push(builds[i].build[11].id);
      }
    }
  }
}

function getUnitItems(unitBuild) {
  let usedItems = { enhancements: {} };
  for (let i = 0; i <= 10; i++) {
    if (unitBuild.build[i]) {
      let item = unitBuild.build[i];
      if (usedItems[item.id]) {
        usedItems[item.id]++;
      } else {
        usedItems[item.id] = 1;
      }
      if (item.enhancements) {
        if (!usedItems.enhancements[item.id]) {
          usedItems.enhancements[item.id] = [];
        }
        usedItems.enhancements[item.id].push(item.enhancements);
      }
    }
  }
  if (unitBuild.hasBraveShift()) {
    let build = unitBuild._braveShift.build;
    let braveShiftUsedItems = {};
    let braveShiftUsedItemsEnhancements = {};
    for (let i = 0; i <= 10; i++) {
      if (build[i]) {
        let item = build[i];

        if (braveShiftUsedItems[item.id]) {
          braveShiftUsedItems[item.id]++;
        } else {
          braveShiftUsedItems[item.id] = 1;
        }
        if (item.enhancements) {
          if (!braveShiftUsedItemsEnhancements[item.id]) {
            braveShiftUsedItemsEnhancements[item.id] = [];
          }
          braveShiftUsedItemsEnhancements[item.id].push(item.enhancements);
        }
      }
    }
    Object.keys(braveShiftUsedItems).forEach((k) => {
      usedItems[k] = Math.max(usedItems[k] | 0, braveShiftUsedItems[k] | 0);
    });
    Object.keys(braveShiftUsedItemsEnhancements).forEach((k) => {
      if (!usedItems.enhancements[k]) {
        usedItems.enhancements[k] = [];
      }
      let temp = usedItems.enhancements[k].map((e) => JSON.stringify(e));
      braveShiftUsedItemsEnhancements[k].forEach((e) => {
        let foundIndex = temp.indexOf(JSON.stringify(e));
        if (foundIndex >= 0) {
          temp.splice(foundIndex, 1);
        } else {
          usedItems.enhancements[k].push(e);
        }
      });
    });
  }
  return usedItems;
}
