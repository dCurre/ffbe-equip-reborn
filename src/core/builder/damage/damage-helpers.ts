import { isTwoHanded } from '../item-values.js';
import { getStatCalculatedValue } from '../stat-calculation.js';
import { weaponList } from '../../constants/item-types.js';
import { weaponBaseDamageVariance } from './damage-data.js';

export function getWeaponVariance(item: any): any {
  if (item && weaponList.includes(item.type)) {
    return item.damageVariance || weaponBaseDamageVariance[isTwoHanded(item) ? '2h' : '1h'][item.type];
  }
  return weaponBaseDamageVariance['none'];
}

export function emptyKillerByRace(): any {
  return {
    aquatic: 0,
    beast: 0,
    bird: 0,
    bug: 0,
    demon: 0,
    dragon: 0,
    human: 0,
    machine: 0,
    plant: 0,
    undead: 0,
    stone: 0,
    spirit: 0,
  };
}

// Total of the stat the formula uses (`use.stat`), or of `defaultStat` when the formula does not specify one
export function getUsedStatValue(
  context: any,
  itemAndPassives: any,
  formula: any,
  unitBuild: any,
  defaultStat: string,
) {
  const stat = formula.value.use ? formula.value.use.stat : defaultStat;
  return getStatCalculatedValue(context, itemAndPassives, stat, unitBuild).total;
}

// Adds the killers of the equipped items matching the enemy races, capped at 300% per race. The killers of the Galvanite
// nodes of the Esper (Stat Break, `limitKillers`) are a bucket of their own: up to 50% per race on top of the 300%.
export function addItemKillers(cumulatedKillerByRace: any, itemAndPassives: any, enemyStats: any, killerType: string) {
  const limitBreakByRace: Record<string, number> = {};
  for (var equipedIndex = itemAndPassives.length; equipedIndex--;) {
    const limitKillers = itemAndPassives[equipedIndex]?.limitKillers;
    for (const killer of limitKillers ?? []) {
      if (enemyStats.races.includes(killer.name) && killer[killerType]) {
        limitBreakByRace[killer.name] = Math.min(50, (limitBreakByRace[killer.name] ?? 0) + killer[killerType]);
      }
    }
    if (itemAndPassives[equipedIndex] && itemAndPassives[equipedIndex].killers) {
      for (var killerIndex = itemAndPassives[equipedIndex].killers.length; killerIndex--;) {
        var killer: any = itemAndPassives[equipedIndex].killers[killerIndex];
        if (enemyStats.races.includes(killer.name) && killer[killerType]) {
          cumulatedKillerByRace[killer.name] = Math.min(300, cumulatedKillerByRace[killer.name] + killer[killerType]);
        }
      }
    }
  }
  for (const [race, bonus] of Object.entries(limitBreakByRace)) cumulatedKillerByRace[race] += bonus;
}

// Adds the elements of the two weapons (slots 0 and 1) that are not already in `elements`
export function addWeaponElements(elements: any, itemAndPassives: any): any {
  for (var slot = 0; slot < 2; slot++) {
    if (itemAndPassives[slot] && itemAndPassives[slot].element) {
      for (var elementIndex = itemAndPassives[slot].element.length; elementIndex--;) {
        if (!elements.includes(itemAndPassives[slot].element[elementIndex])) {
          elements.push(itemAndPassives[slot].element[elementIndex]);
        }
      }
    }
  }
  return elements;
}

// Level correction (1+(level/100)) and final multiplier (between 85% and 100%, so 92.5% mean)
export function getDamageMultiplier(unitBuild: any): any {
  var level: any = unitBuild.level || (unitBuild.unit.sixStarForm ? 100 : (unitBuild.unit.max_rarity - 1) * 20);
  var levelCorrection: any = 1 + level / 100;
  return {
    min: levelCorrection * 0.85,
    avg: levelCorrection * 0.925,
    max: levelCorrection,
  };
}

export function getChainMult(unitBuild, itemAndPassives) {
  let chainMult = 4;
  // two weapons and a passive of the unit (that applies) or an item that improves the dual wield, as the stat of the chain mastery
  if (
    itemAndPassives[0] &&
    itemAndPassives[1] &&
    weaponList.includes(itemAndPassives[1].type) &&
    itemAndPassives.some((item) => item?.improvedTDW)
  ) {
    chainMult = 8;
  }
  itemAndPassives
    .filter((i) => i && i.chainMastery)
    .forEach((i) => {
      chainMult += i.chainMastery / 100;
    });
  return Math.min(chainMult, 6);
}

export function getElementCoef(elements, enemyStats) {
  var resistModifier: any = 0;

  for (var i = elements.length; i--;) {
    var element: any = elements[i];
    resistModifier += (enemyStats.elementalResists[element] - enemyStats.imperils[element]) / 100;
  }
  if (elements.length) {
    resistModifier = resistModifier / elements.length;
  }
  return resistModifier;
}

export function getWeaponImperilCoef(weapon1, weapon2, enemyStats) {
  let weaponTypes: any[] = [];
  if (weapon1 && weaponList.includes(weapon1.type)) {
    weaponTypes.push(weapon1.type);
  }
  if (weapon2 && weaponList.includes(weapon2.type) && !weaponTypes.includes(weapon2.type)) {
    weaponTypes.push(weapon2.type);
  }
  let weaponImperil = 1;
  if (weaponTypes.length) {
    weaponImperil +=
      Math.floor(
        weaponTypes.map((weaponType) => enemyStats.imperils[weaponType] || 0).reduce((acc, value) => acc + value, 0) /
          weaponTypes.length,
      ) / 100;
  }
  return weaponImperil;
}
