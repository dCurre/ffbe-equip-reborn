import type { DataStorage } from '../data-storage.js';
import { includeAll, matches } from '../../array-utils.js';
import { getElementCoef } from '../damage/damage-helpers.js';
import { getValue } from '../item-values.js';

export function itemCanBeOfUseForGoal(storage: DataStorage, item, enemyStats, elementBuffs = {}) {
  if (storage.currentBuild.formula.type == 'condition' && storage.currentBuild.formula.elements && item.element) {
    if (storage.currentBuild.formula.elements.includes('none')) {
      return false;
    } else if (!includeAll(storage.currentBuild.formula.elements, item.element)) {
      return false;
    } else {
      return true;
    }
  }

  var stats: any = storage.currentBuild.involvedStats;

  for (var index: any = 0, len = stats.length; index < len; index++) {
    if (stats[index] == 'weaponElement') {
      if (
        item.element &&
        (getElementCoef(item.element, enemyStats) < 0 ||
          item.element.map((e) => elementBuffs[e] || 0).reduce((acc, val) => acc + val, 0))
      )
        return true;
    } else if (stats[index] == 'physicalKiller') {
      if (getKillerCoef(item, 'physical', enemyStats) > 0) return true;
    } else if (stats[index] == 'magicalKiller') {
      if (getKillerCoef(item, 'magical', enemyStats) > 0) return true;
    } else if (stats[index] == 'lbPerTurn') {
      if (item.lbPerTurn || item.lbFillRate) return true;
    } else if (stats[index] == 'meanDamageVariance') {
      if (item.meanDamageVariance && item.meanDamageVariance > 1) return true;
    } else if (stats[index] == 'skillEnhancement') {
      if (item.skillEnhancement && item.skillEnhancement[0] > 0) return true;
    } else if (stats[index] == 'chainMastery') {
      if (item.chainMastery && item.chainMastery > 0) {
        return true;
      }

      if (item.type == 'visionCard') {
        let vcLevels = item.levels;
        vcLevels.forEach((levelNumber) => {
          if (levelNumber.chainMastery && levelNumber.chainMastery > 0) {
            return true;
          }
        });
      }
    } else {
      if (getValue(item, stats[index]) > 0) return true;
      if (item[stats[index] + '%'] && item[stats[index] + '%'] > 0) return true;
      if (item.staticStats && item.staticStats[stats[index]]) return true;
      if (item.singleWielding && item.singleWielding[stats[index]]) return true;
      if (item.singleWieldingGL && item.singleWieldingGL[stats[index]]) return true;
      if (item.singleWieldingOneHanded && item.singleWieldingOneHanded[stats[index]]) return true;
      if (item.singleWieldingOneHandedGL && item.singleWieldingOneHandedGL[stats[index]]) return true;
      if (item.dualWielding && item.dualWielding[stats[index]]) return true;
      if (item.oneWeaponMastery && item.oneWeaponMastery[stats[index]]) return true;
      if (item.esperStatsBonus && item.esperStatsBonus.all && item.esperStatsBonus.all[stats[index]]) return true;
    }
  }
  if (storage.desirableElements.length != 0) {
    if (item.element && matches(item.element, storage.desirableElements)) return true;
  }
  if (storage.desiredEquipmentType.length != 0) {
    if (item.type && storage.desiredEquipmentType.includes(item.type)) return true;
  }
  if (storage.unitBuild.desirableItemIds.length != 0) {
    if (storage.unitBuild.desirableItemIds.includes(item.id)) return true;
  }
  if (storage.skillIds.length > 0 && item.skillEnhancement) {
    if (storage.skillIds.some((id) => item.skillEnhancement[id])) return true;
  }
}

export function itemWithUnstackableSkillOnlyUsefulInOne(storage: DataStorage, item, enemyStats, elementBuffs) {
  if (item.notStackableSkills) {
    var itemWithoutUnstackableSkills: any = JSON.parse(JSON.stringify(item));
    Object.keys(itemWithoutUnstackableSkills.notStackableSkills).forEach((id) => {
      let skill = itemWithoutUnstackableSkills.notStackableSkills[id];
      Object.keys(skill).forEach((stat) => {
        storage.removeStat(itemWithoutUnstackableSkills, stat, skill[stat]);
      });
    });
    return storage.itemCanBeOfUseForGoal(itemWithoutUnstackableSkills, enemyStats, elementBuffs);
  }
  return false;
}

export function removeStat(storage: DataStorage, item, stat, value) {
  if (typeof value === 'number') {
    if (item[stat] == value) {
      delete item[stat];
    } else {
    }
    item[stat] -= value;
  } else if (stat == 'evade') {
    if (value.physical) {
      storage.removeStat(item.evade, 'physical', value.physical);
    }
    if (value.magical) {
      storage.removeStat(item.evade, 'magical', value.magical);
    }
    if (!item.evade.physical && !item.evade.magical) {
      delete item.evade;
    }
  }
}

function getKillerCoef(item, applicableKillerType, enemyStats) {
  var cumulatedKiller: any = 0;
  if (enemyStats.races.length > 0 && item.killers) {
    for (var killerIndex: any = item.killers.length; killerIndex--;) {
      if (
        enemyStats.races.includes(item.killers[killerIndex].name) &&
        item.killers[killerIndex][applicableKillerType]
      ) {
        cumulatedKiller += item.killers[killerIndex][applicableKillerType];
      }
    }
  }
  return cumulatedKiller / enemyStats.races.length;
}
