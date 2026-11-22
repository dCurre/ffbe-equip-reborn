import { getValue, isTwoHanded } from './item-values.js';
import { baseStats, percentValues, shieldList, weaponList } from '../constants.js';

export const valuesToNotRoundDown = ['lbPerTurn', 'chainMastery', 'evoMag', 'lbDamage'];

export function getStatCalculatedValue(context, itemAndPassives, stat, unitBuild) {
  if (context.savedValues[stat]) {
    return context.savedValues[stat];
  } else {
    var result: any = calculateStatValue(itemAndPassives, stat, unitBuild, context.berserk);
    context.savedValues[stat] = result;
    return result;
  }
}

export function getEquipmentStatBonus(itemAndPassives, stat, doCap = true) {
  if (
    (baseStats.includes(stat) || stat == 'accuracy') &&
    itemAndPassives[0] &&
    weaponList.includes(itemAndPassives[0].type)
  ) {
    let normalStack = 0;
    let twoHanded = isTwoHanded(itemAndPassives[0]);
    let dualWield = itemAndPassives[1] && weaponList.includes(itemAndPassives[1].type);
    let oneWeapon = !itemAndPassives[1] || shieldList.includes(itemAndPassives[1].type);
    for (var index = itemAndPassives.length; index--;) {
      var item: any = itemAndPassives[index];
      if (item) {
        if (item.singleWielding && item.singleWielding[stat] && itemAndPassives[0] && !itemAndPassives[1]) {
          normalStack += item.singleWielding[stat] / 100;
        }
        if (oneWeapon && item.oneWeaponMastery && item.oneWeaponMastery[stat]) {
          normalStack += item.oneWeaponMastery[stat] / 100;
        }
        if (
          !twoHanded &&
          item.singleWieldingOneHanded &&
          item.singleWieldingOneHanded[stat] &&
          itemAndPassives[0] &&
          !itemAndPassives[1]
        ) {
          normalStack += item.singleWieldingOneHanded[stat] / 100;
        }
        if (dualWield && item.dualWielding && item.dualWielding[stat]) {
          if (doCap) {
            normalStack = Math.min(normalStack + item.dualWielding[stat] / 100, getStatBonusCap('tdw') / 100);
          } else {
            normalStack += item.dualWielding[stat] / 100;
          }
        }
      }
    }
    if (doCap) {
      return 1 + Math.min(getStatBonusCap('tdh') / 100, normalStack);
    } else {
      return 1 + normalStack;
    }
  } else {
    return 1;
  }
}

export function getEsperStatBonus(itemAndPassives, stat, esper) {
  var statsBonus: any = 100;
  if (baseStats.includes(stat)) {
    for (var index = itemAndPassives.length; index--;) {
      var item: any = itemAndPassives[index];
      if (item && item.esperStatsBonus) {
        if (item.esperStatsBonus.all && item.esperStatsBonus.all[stat]) {
          statsBonus += item.esperStatsBonus.all[stat];
        }
        if (esper && item.esperStatsBonus[esper.id] && item.esperStatsBonus[esper.id][stat]) {
          statsBonus += item.esperStatsBonus[esper.id][stat];
        }
      }
    }
  }
  return Math.min(3, statsBonus / 100);
}

export function calculateStatValue(itemAndPassives, stat, unitBuild, berserk = 0, ignoreBuffs = false) {
  var equipmentStatBonus: any = getEquipmentStatBonus(itemAndPassives, stat, true);
  var esperStatBonus: any = 1;
  if (itemAndPassives[11]) {
    esperStatBonus = getEsperStatBonus(itemAndPassives, stat, itemAndPassives[11]);
  }
  var calculatedValue: any = 0;
  var currentPercentIncrease: any = { value: 0 };
  var baseValue: any = 0;
  var buffValue: any = 0;
  if (baseStats.includes(stat)) {
    baseValue = unitBuild.baseValues[stat].total;
    // itemAndPassives[10] is the VC
    if (itemAndPassives[10] && itemAndPassives[10][stat]) {
      baseValue += itemAndPassives[10][stat];
    }
    if (!ignoreBuffs) {
      if (stat === 'hp') {
        buffValue = unitBuild.baseValues[stat].buff;
      } else if (stat === 'atk' && berserk) {
        buffValue = ((unitBuild.baseValues[stat].buff + berserk) * baseValue) / 100;
      } else {
        buffValue = (unitBuild.baseValues[stat].buff * baseValue) / 100;
      }
    }
  } else if (stat == 'lbPerTurn') {
    baseValue = unitBuild.baseValues['lbFillRate'].total;
    buffValue = (unitBuild.baseValues['lbFillRate'].buff * baseValue) / 100;
  }

  var calculatedValue: any = baseValue + buffValue;

  if (stat == 'accuracy') {
    calculatedValue += (equipmentStatBonus - 1) * 100;
    equipmentStatBonus = 1;
  }

  for (var equipedIndex = itemAndPassives.length; equipedIndex--;) {
    if (itemAndPassives[equipedIndex]) {
      var equipmentStatBonusToApply: any = 1;
      if (equipedIndex < 11) {
        equipmentStatBonusToApply = equipmentStatBonus;
      }
      if (equipedIndex == 11) {
        equipmentStatBonusToApply = esperStatBonus;
      }
      if ('evade.magical' == stat) {
        calculatedValue = Math.max(
          calculatedValue,
          calculateStateValueForIndex(
            itemAndPassives,
            equipedIndex,
            baseValue,
            currentPercentIncrease,
            equipmentStatBonusToApply,
            stat,
          ),
        );
      } else if (equipedIndex < 2 && 'atk' == stat) {
        calculatedValue += calculatePercentStateValueForIndex(
          itemAndPassives[equipedIndex],
          baseValue,
          currentPercentIncrease,
          stat,
        );
        calculatedValue += calculateFlatStateValueForIndex(itemAndPassives, equipedIndex, equipmentStatBonus - 1, stat);
      } else {
        calculatedValue += calculateStateValueForIndex(
          itemAndPassives,
          equipedIndex,
          baseValue,
          currentPercentIncrease,
          equipmentStatBonusToApply,
          stat,
        );
      }
    }
  }

  if (stat == 'chainMastery') {
    calculatedValue = calculatedValue / 100 + 4;
    const build = unitBuild['unitShift']['build'];
    if (build[0] !== null && build[1] !== null) {
      if (hasShiftItemWith(unitBuild, 'improvedDW')) {
        calculatedValue = calculatedValue + 2;
      }
      if (hasShiftItemWith(unitBuild, 'improvedTDW')) {
        calculatedValue = calculatedValue + 2;
      }
    }
  }

  // check if the itemAndPassives have a not stackable skill
  calculatedValue = checkForNotStackableSkills(itemAndPassives, stat, unitBuild, calculatedValue);

  if (stat === 'atk') {
    let realCap = calculatedValue;
    var result: any = { right: 0, left: 0, total: 0, bonusPercent: currentPercentIncrease.value, overcap: realCap };
    var right: any = calculateFlatStateValueForIndex(itemAndPassives, 0, 1, stat);
    var left: any = calculateFlatStateValueForIndex(itemAndPassives, 1, 1, stat);
    if (itemAndPassives[1] && weaponList.includes(itemAndPassives[1].type)) {
      result.right = Math.floor(calculatedValue + right);
      result.left = Math.floor(calculatedValue + left);
      result.total = Math.floor(calculatedValue + right + left);
    } else {
      result.right = Math.floor(calculatedValue + right + left);
      result.left = 0;
      result.total = result.right;
    }
  } else {
    let realCap = calculatedValue;
    if (
      stat === 'lbDamage' ||
      stat === 'jumpDamage' ||
      stat === 'evoMag' ||
      stat === 'evokeDamageBoost.all' ||
      stat.includes('%')
    ) {
      calculatedValue = Math.min(getStatBonusCap(stat), calculatedValue);
      if (stat === 'lbDamage') {
        calculatedValue = calculatedValue + unitBuild.baseValues['lbDamage'];
      }
    }
    if (!valuesToNotRoundDown.includes(stat)) {
      calculatedValue = Math.floor(calculatedValue);
    }
    var result: any = {
      right: 0,
      left: 0,
      total: calculatedValue,
      bonusPercent: currentPercentIncrease.value,
      overcap: realCap,
    };
    if (itemAndPassives[0] && weaponList.includes(itemAndPassives[0].type)) {
      result.right = result.total;
    }
    if (itemAndPassives[1] && weaponList.includes(itemAndPassives[1].type)) {
      result.left = result.total;
    }
  }

  return result;
}

// Whether any item of the unit shift build has the given flag (improvedDW / improvedTDW)
function hasShiftItemWith(unitBuild: any, flag: 'improvedDW' | 'improvedTDW'): boolean {
  return Object.values(unitBuild['unitShift']['build']).some((item: any) => item?.[flag]);
}

// How many copies of the item are equipped
function countEquipped(itemsAndPassives: any, item: any): number {
  return itemsAndPassives.filter((other) => other && other.id == item.id).length;
}

export function checkForNotStackableSkills(itemsAndPassives, stat, unitBuild, calculatedValue) {
  // check if the itemAndPassives have a not stackable skill
  for (var equipedIndex = itemsAndPassives.length; equipedIndex--;) {
    if (itemsAndPassives[equipedIndex]) {
      var item: any = itemsAndPassives[equipedIndex];
      if (item.notStackableSkills) {
        var skill: any = item.notStackableSkills;
        if (skill) {
          // forEach not stackable skill in the skill object
          Object.keys(skill).forEach(function (key) {
            var skillId: any = key;
            var skillValue: any = skill[key];
            if (skillValue.staticStats) {
              var skillStaticStats: any = skillValue.staticStats;
              if (skillStaticStats[stat]) {
                var skillStatValue: any = skillStaticStats[stat];
                if (skillStatValue) {
                  var count: any = countEquipped(itemsAndPassives, item);
                  // and then add the value to the calculatedValue
                  if (count == 1 && stat != 'atk') {
                    calculatedValue += skillStatValue;
                    // But if more than one of the item is equipped, then only add half of the value
                  } else if (count > 1 && stat != 'atk') {
                    calculatedValue += skillStatValue / 2;
                  } else if (count > 1 && stat == 'atk') {
                    calculatedValue -= skillStatValue / 2;
                  }

                  if (stat == 'atk') {
                    if (equipedIndex >= 2) {
                      calculatedValue += skillStatValue;
                    }
                  }
                }
              }
            }

            if (stat === 'chainMastery' && skillValue.chainMastery) {
              var chainMastery: any = skillValue.chainMastery;
              if (chainMastery) {
                var count: any = countEquipped(itemsAndPassives, item);

                // and then add the value to the calculatedValue
                if (count == 1) {
                  calculatedValue += chainMastery / 100;
                  // But if more than one of the item is equipped, then only add half of the value
                } else if (count > 1) {
                  calculatedValue += chainMastery / 100 / 2;
                }
              }
            }
          });
        }
      }
    }
  }

  return calculatedValue;
}

export function calculateStateValueForIndex(items, index, baseValue, currentPercentIncrease, equipmentStatBonus, stat) {
  let item = items[index];
  if (item) {
    if (stat == 'lbPerTurn') {
      var value: any = 0;
      if (item.lbPerTurn) {
        var lbPerTurn: any = getValue(item, 'lbPerTurn');
        value += lbPerTurn;
      }
      if (item.lbFillRate) {
        value += (item.lbFillRate * baseValue) / 100;
      }
      return value;
    } else {
      let value;
      let staticValue = item.staticStats?.[stat] || 0;

      // if item has notStackableSkills, and notStackableSkills contains a skill with that stat check if it has staticStats for the stat && item.staticStats contains the stat
      if (item.notStackableSkills) {
        (Object.values(item.notStackableSkills) as any[]).forEach((skill) => {
          if (skill.staticStats && skill.staticStats[stat]) {
            staticValue = 0;
          }
        });
      }

      //
      if (index === 10 && baseStats.includes(stat)) {
        value = 0; // Vision Card flat stats are added to the base value directly earlier in the calculation
      } else {
        value = getValue(item, stat);

        if (stat === 'chainMastery' && item.notStackableSkills) {
          (Object.values(item.notStackableSkills) as any[]).forEach((skill) => {
            if (skill.chainMastery) {
              value = 0;
            }
          });
        }
      }
      if (item[percentValues[stat]]) {
        var itemPercentValue: any = getValue(item, percentValues[stat]);
        var percentTakenIntoAccount: any = Math.min(
          itemPercentValue,
          Math.max(getStatBonusCap(stat) - currentPercentIncrease.value, 0),
        );
        currentPercentIncrease.value += itemPercentValue;
        return value * equipmentStatBonus + (percentTakenIntoAccount * baseValue) / 100 + staticValue;
      } else {
        return value * equipmentStatBonus + staticValue;
      }
    }
  }
  return 0;
}

export function getStatBonusCap(stat, unitBuild?) {
  switch (stat) {
    case 'lbDamage':
      return 300;
    case 'lbPerTurn':
      return 12;
    case 'lbFillRate':
      return 1000;
    case 'tdh':
      return 400;
    case 'tdw':
      return 400;
    case 'jumpDamage':
      return 800;
    case 'evoMag':
      return 300;
    case 'evokeDamageBoost.all':
      return 300;
    case 'chainMastery':
      if (unitBuild) {
        // the cap grows to 8 with improved dual wield, and only with two weapons equipped
        const build = unitBuild['unitShift']['build'];
        if (build[0] && build[1] && hasShiftItemWith(unitBuild, 'improvedDW')) {
          return 8;
        }
      }
      return 6;
    case 'drawAttacks':
      return 100;
    case 'accuracy':
      return 100;
    case 'evade.physical':
      return 100;
    default:
      return 400;
  }
}

export function calculateFlatStateValueForIndex(items, index, equipmentStatBonus, stat) {
  if (index === 10) {
    return 0; // Vision Card flat stats are added to the base value directly earlier in the calculation
  }
  if (items[index] && items[index][stat]) {
    return items[index][stat] * equipmentStatBonus;
  }
  return 0;
}

export function calculatePercentStateValueForIndex(item, baseValue, currentPercentIncrease, stat) {
  let result = 0;
  if (item && item[percentValues[stat]]) {
    var itemPercentValue: any = item[percentValues[stat]];
    var percentTakenIntoAccount: any = Math.min(
      itemPercentValue,
      Math.max(getStatBonusCap(stat) - currentPercentIncrease.value, 0),
    );
    currentPercentIncrease.value += itemPercentValue;
    result = (percentTakenIntoAccount * baseValue) / 100;
  }
  if (item && item.staticStats && item.staticStats[stat]) {
    result += item.staticStats[stat];
  }
  return result;
}
