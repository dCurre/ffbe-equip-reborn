import { baseStats, itemEnhancementAbilities } from '../constants.js';

export const simpleAddCombineProperties = [
  'hp',
  'hp%',
  'mp',
  'mp%',
  'atk',
  'atk%',
  'def',
  'def%',
  'mag',
  'mag%',
  'spr',
  'spr%',
  'evoMag',
  'accuracy',
  'jumpDamage',
  'lbFillRate',
  'mpRefresh',
  'lbDamage',
];

export function combineTwoItems(item1, item2) {
  var sum: any = JSON.parse(JSON.stringify(item1));
  for (var index = simpleAddCombineProperties.length; index--;) {
    var stat: any = simpleAddCombineProperties[index];
    if (item2[stat]) {
      addToStat(sum, stat, item2[stat]);
    }
  }
  if (item2.evade) {
    addEvade(sum, item2.evade);
  }
  if (item2.singleWielding) {
    addEqStatBonus(sum, 'singleWielding', item2.singleWielding);
  }
  if (item2.singleWieldingOneHanded) {
    addEqStatBonus(sum, 'singleWieldingOneHanded', item2.singleWieldingOneHanded);
  }
  if (item2.dualWielding) {
    addEqStatBonus(sum, 'dualWielding', item2.dualWielding);
  }
  if (item2.oneWeaponMastery) {
    addEqStatBonus(sum, 'oneWeaponMastery', item2.oneWeaponMastery);
  }
  if (item2.resist) {
    addResist(sum, item2.resist);
  }
  if (item2.lbPerTurn) {
    addLbPerTurn(sum, item2.lbPerTurn);
  }
  if (item2.killers) {
    for (let index = item2.killers.length; index--;) {
      addKiller(sum, item2.killers[index].name, item2.killers[index].physical, item2.killers[index].magical);
    }
  }
  if (item2.staticStats) {
    if (!sum.staticStats) sum.staticStats = {};
    baseStats.forEach((stat) => {
      if (item2.staticStats[stat]) {
        addToStat(sum.staticStats, stat, item2.staticStats[stat]);
      }
    });
  }
  if (item2.evokeDamageBoost) {
    if (!sum.evokeDamageBoost) {
      sum.evokeDamageBoost = {};
    }
    Object.keys(item2.evokeDamageBoost).forEach((esperName) => {
      addToStat(sum.evokeDamageBoost, esperName, item2.evokeDamageBoost[esperName]);
    });
  }
  if (item2.special) {
    if (!sum.special) {
      sum.special = [];
    }
    sum.special = sum.special.concat(item2.special);
  }
  return sum;
}

export function addToStat(skill, stat, value) {
  if (!skill[stat]) {
    skill[stat] = value;
  } else {
    skill[stat] += value;
  }
}

export function addKiller(skill, race, physicalPercent, magicalPercent) {
  if (!skill.killers) {
    skill.killers = [];
  }
  var killerData: any;
  for (var index in skill.killers) {
    if (skill.killers[index].name == race) {
      killerData = skill.killers[index];
      break;
    }
  }

  if (!killerData) {
    killerData = { name: race };
    skill.killers.push(killerData);
  }
  if (physicalPercent != 0) {
    if (killerData.physical) {
      killerData.physical += physicalPercent;
    } else {
      killerData.physical = physicalPercent;
    }
  }
  if (magicalPercent != 0) {
    if (killerData.magical) {
      killerData.magical += magicalPercent;
    } else {
      killerData.magical = magicalPercent;
    }
  }
}

export function addResist(item, values) {
  if (!item.resist) {
    item.resist = [];
  }
  for (var index = values.length; index--;) {
    item.resist.push(values[index]);
  }
}

export function addEvade(item, evade) {
  if (!item.evade) {
    item.evade = {};
  }
  if (evade.physical) {
    if (item.evade.physical) {
      item.evade.physical = item.evade.physical + evade.physical;
    } else {
      item.evade.physical = evade.physical;
    }
  }
  if (evade.magical) {
    if (item.evade.magical) {
      item.evade.magical = item.evade.magical + evade.magical;
    } else {
      item.evade.magical = evade.magical;
    }
  }
}

export function addEqStatBonus(item, doubleHandType, values) {
  if (!item[doubleHandType]) {
    item[doubleHandType] = {};
  }
  var stats: any = Object.keys(values);
  for (var index = stats.length; index--;) {
    var stat: any = stats[index];
    addToStat(item[doubleHandType], stat, values[stat]);
  }
}

export function addLbPerTurn(item, lbPerTurn) {
  if (!item.lbPerTurn) {
    item.lbPerTurn = { min: 0, max: 0 };
  }
  item.lbPerTurn.min += lbPerTurn.min;
  item.lbPerTurn.max += lbPerTurn.max;
}

export function applyEnhancements(item, enhancements, itemEnchantments) {
  if (enhancements) {
    var result: any = JSON.parse(JSON.stringify(item));
    result.enhancements = enhancements.slice();
    for (var i = enhancements.length; i--;) {
      var enhancement: any = enhancements[i];
      var enhancementValue: any;
      // if enhancement is a number, look it up in the itemEnchantments
      if (typeof enhancement === 'number') {
        if (itemEnchantments[enhancement]) {
          enhancementValue = itemEnchantments[enhancement].enchant;
        }
      } else if (enhancement === 'special_1') {
        enhancementValue = itemEnhancementAbilities[enhancement][item.id];
      } else {
        enhancementValue = itemEnhancementAbilities[enhancement];
      }
      if (enhancementValue) {
        result = combineTwoItems(result, enhancementValue);
      }
    }
    result.originalItem = item;
    return result;
  } else {
    return item;
  }
}
