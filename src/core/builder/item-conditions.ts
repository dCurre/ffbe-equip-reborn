import { applyEnhancements } from './item-combination.js';
import { baseStats, elementList } from '../constants/base-lists.js';
import { percentValues } from '../constants/stat-values.js';
import { typeList, weaponList } from '../constants/item-types.js';

export function isApplicable(item, unit) {
  if (item.exclusiveSex && item.exclusiveSex != unit.sex) {
    return false;
  }
  if (item.exclusiveRoles && !item.exclusiveRoles.some((role) => unit.roles.includes(role))) {
    return false;
  }
  if (item.exclusiveUnits && !item.exclusiveUnits.includes(unit.id)) {
    return false;
  }
  if (item.max7StarUnit && unit.max_rarity === 'NV') {
    return false;
  }
  return true;
}

export const elementSet = new Set(elementList);

export const typeSet = new Set(typeList);

export function areConditionOK(item, equiped, level = 0, exLevel?) {
  if (level && item.levelCondition && item.levelCondition > level) {
    return false;
  }

  if (exLevel > -1 && item.exLevelCondition) {
    if (item.exLevelCondition > exLevel) {
      return false;
    }
  }
  if (item.equipedConditions) {
    if (item.equipedConditions.every((condition) => weaponList.includes(condition))) {
      if (
        (equiped[0] && item.equipedConditions.includes(equiped[0].type)) ||
        (equiped[1] && item.equipedConditions.includes(equiped[1].type))
      ) {
        return true;
      }
      return false;
    } else {
      // Otherweise loop through the item.equippedConditions and see if any of them are met usng the isEquipedConditionOK function
      for (var conditionIndex = item.equipedConditions.length; conditionIndex--;) {
        if (!isEquipedConditionOK(equiped, item.equipedConditions[conditionIndex])) {
          return false;
        }
      }
    }
  }
  return true;
}

export function isEquipedConditionOK(equiped, condition) {
  if (Array.isArray(condition)) {
    return condition.some((c) => isEquipedConditionOK(equiped, c));
  } else {
    switch (true) {
      case elementSet.has(condition):
        return (
          (equiped[0] && equiped[0].element && equiped[0].element.includes(condition)) ||
          (equiped[1] && equiped[1].element && equiped[1].element.includes(condition))
        );
      case typeSet.has(condition):
        return equiped.some((equipment, index) => {
          if (equipment && equipment.type === condition) {
            return true;
          }
        });
      case condition === 'unarmed':
        return !equiped[0] && !equiped[1];
      default:
        return equiped.some((equipment, index) => {
          if (equipment && equipment.id) {
            if (equipment.id.toString().includes('-')) {
              let cardLevelId = equipment.id.split('-');
              return cardLevelId[0] === condition;
            } else {
              return equipment.id === condition;
            }
          }
        });
    }
  }
}

function conditionsNotMetItem(item): any {
  var result: any = {
    id: item.id,
    name: item.name,
    jpname: item.jpname,
    icon: item.icon,
    type: item.type,
    access: ['Conditions not met'],
    enhancements: item.enhancements,
  };
  if (item.special && item.special.includes('notStackable')) {
    result.special = ['notStackable'];
  }
  return result;
}

function countVersionConditions(item): number {
  let count = item.equipedConditions ? item.equipedConditions.length : 0;
  if (item.exclusiveUnits) count++;
  if (item.exclusiveSex) count++;
  if (item.exclusiveRoles) count++;
  return count;
}

export function findBestItemVersion(build, item, itemWithVariation, unit, itemEnchantments?) {
  var itemVersions: any = itemWithVariation[item.id];
  if (!itemVersions) {
    if (isApplicable(item, unit) && (!item.equipedConditions || areConditionOK(item, build))) {
      return item;
    } else {
      return conditionsNotMetItem(item);
    }
  } else {
    itemVersions.sort(function (item1, item2) {
      var conditionNumber1: any = countVersionConditions(item1);
      var conditionNumber2: any = countVersionConditions(item2);
      let result = conditionNumber2 - conditionNumber1;
      if (result != 0) {
        return result;
      } else {
        return Object.keys(item2).length - Object.keys(item1).length;
      }
    });
    for (var index in itemVersions) {
      if (isApplicable(itemVersions[index], unit) && areConditionOK(itemVersions[index], build)) {
        if (item.enhancements) {
          return applyEnhancements(itemVersions[index], item.enhancements, itemEnchantments);
        } else {
          return itemVersions[index];
        }
      }
    }
    var item: any = itemVersions[0];
    return conditionsNotMetItem(item);
  }
}

export function getEsperItem(esper) {
  var item: any = {};
  item.name = esper.name;
  item.id = esper.name;
  item.type = 'esper';
  item.hp = Math.floor(esper.hp / 100);
  item.mp = Math.floor(esper.mp / 100);
  item.atk = Math.floor(esper.atk / 100);
  item.def = Math.floor(esper.def / 100);
  item.mag = Math.floor(esper.mag / 100);
  item.spr = Math.floor(esper.spr / 100);
  item.access = ['story'];
  item.maxLevel = esper.maxLevel;
  if (esper.killers) {
    item.killers = esper.killers;
  }
  if (esper.resist) {
    item.resist = esper.resist;
  }
  if (esper.esperStatsBonus) {
    item.esperStatsBonus = esper.esperStatsBonus;
  }
  if (esper.level) {
    item.level = esper.level;
  }
  if (esper.rarity) {
    item.rarity = esper.rarity;
  }
  if (esper.lbPerTurn) {
    item.lbPerTurn = esper.lbPerTurn;
  }
  if (esper.lbFillRate) {
    item.lbFillRate = esper.lbFillRate;
  }
  if (esper.lbDamage) {
    item.lbDamage = esper.lbDamage;
  }
  if (esper.evade) {
    item.evade = esper.evade;
  }
  if (esper.buildLink) {
    item.buildLink = esper.buildLink;
  }
  if (esper.conditional) {
    item.conditional = esper.conditional;
  }
  if (esper.jumpDamage) {
    item.jumpDamage = esper.jumpDamage;
  }
  for (var i = baseStats.length; i--;) {
    if (esper[percentValues[baseStats[i]]]) {
      item[percentValues[baseStats[i]]] = esper[percentValues[baseStats[i]]];
    }
  }
  item.originalEsper = esper;
  return item;
}
