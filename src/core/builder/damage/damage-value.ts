import { isTwoHanded } from '../item-values.js';
import { calculateStatValue, getStatCalculatedValue } from '../stat-calculation.js';
import { goalValuesCaract } from '../../constants/stat-values.js';
import { weaponList } from '../../constants/item-types.js';
import { damageFormulaNames } from './damage-data.js';
import {
  getWeaponVariance,
  emptyKillerByRace,
  addItemKillers,
  addWeaponElements,
  getDamageMultiplier,
  getElementCoef,
} from './damage-helpers.js';
import { monsterDamage, calculateMonsterDamage } from './damage-monster.js';

export function calculateValue(
  itemAndPassives,
  unitBuild,
  enemyStats,
  formula,
  goalVariance,
  canSwitchWeapon,
  context,
) {
  if (context.alreadyCalculatedValues[formula.name]) {
    return context.alreadyCalculatedValues[formula.name];
  }
  if (damageFormulaNames.includes(formula.name)) {
    var cumulatedKillerByRace: any = emptyKillerByRace();
    var cumulatedKiller: any = 0;
    var applicableKillerType: any = null;
    if (unitBuild.involvedStats.includes('physicalKiller')) {
      applicableKillerType = 'physical';
    } else if (unitBuild.involvedStats.includes('magicalKiller')) {
      applicableKillerType = 'magical';
    }
    if (applicableKillerType) {
      addItemKillers(cumulatedKillerByRace, itemAndPassives, enemyStats, applicableKillerType);
      if (enemyStats.races.length > 0) {
        for (var raceIndex = enemyStats.races.length; raceIndex--;) {
          cumulatedKiller += cumulatedKillerByRace[enemyStats.races[raceIndex]];
        }
      }
    }

    // Element weakness/resistance
    var elements: any = unitBuild.innateElements.slice();
    if (unitBuild.involvedStats.includes('weaponElement')) {
      addWeaponElements(elements, itemAndPassives);
    }
    var resistModifier: any = getElementCoef(elements, enemyStats);

    let elementBoostModifier;
    if (elements.length) {
      elementBoostModifier =
        1 +
        elements.map((e) => unitBuild.baseValues.elementBuffs[e] || 0).reduce((acc, value) => acc + value, 0) /
          elements.length;
    } else {
      elementBoostModifier = 1;
    }

    // Killers
    var killerMultiplicator: any = 1;
    if (enemyStats.races.length > 0) {
      killerMultiplicator += cumulatedKiller / 100 / enemyStats.races.length;
    }

    var jumpMultiplier: any = 1;
    if (unitBuild.involvedStats.includes('jumpDamage')) {
      jumpMultiplier += calculateStatValue(itemAndPassives, 'jumpDamage', unitBuild).total / 100;
    }

    var evoMagMultiplier: any = 1;
    if (unitBuild.involvedStats.includes('evoMag')) {
      evoMagMultiplier += calculateStatValue(itemAndPassives, 'evoMag', unitBuild).total / 100;
    }
    var evokeDamageBoostMultiplier: any = 1;
    if (unitBuild.involvedStats.includes('evokeDamageBoost.all')) {
      evokeDamageBoostMultiplier +=
        getStatCalculatedValue(context, itemAndPassives, 'evokeDamageBoost.all', unitBuild).total / 100;
    }

    let lbMultiplier = 1;
    if (formula.lb) {
      lbMultiplier += getStatCalculatedValue(context, itemAndPassives, 'lbDamage', unitBuild).total / 100;
    }

    var damageMultiplier: any = getDamageMultiplier(unitBuild);

    var total: any = {
      min: 0,
      avg: 0,
      max: 0,
      switchWeapons: false,
    };
    var value: any;
    if (formula.name == 'fixedDamageWithPhysicalMechanism') {
      var damage: any = 1000 * (1 - resistModifier) * killerMultiplicator;
      value = {
        min: damage,
        avg: damage,
        max: damage,
        switchWeapons: false,
      };
    } else {
      for (var statIndex = goalValuesCaract[formula.name].statsToMaximize.length; statIndex--;) {
        var stat: any = goalValuesCaract[formula.name].statsToMaximize[statIndex];
        var calculatedValue: any = calculateStatValue(itemAndPassives, stat, unitBuild, context.berserk);

        if ('atk' == stat || 'def' == stat) {
          var variance: any;
          var switchWeapons: any = false;
          variance = getWeaponVariance(itemAndPassives[0]);
          if (
            unitBuild.involvedStats.includes('jumpDamage') &&
            (isTwoHanded(itemAndPassives[0]) || isTwoHanded(itemAndPassives[1]))
          ) {
            // variance override for two handed weapons and jumps
            variance = { min: 2.3, avg: 2.45, max: 2.6 };
          }

          if (
            goalVariance &&
            itemAndPassives[0] &&
            weaponList.includes(itemAndPassives[0].type) &&
            itemAndPassives[1] &&
            weaponList.includes(itemAndPassives[1].type)
          ) {
            var variance1: any;
            variance1 = getWeaponVariance(itemAndPassives[1]);

            if (goalValuesCaract[formula.name].type == 'none' || formula.name == 'physicalDamageMultiCast') {
              switchWeapons =
                canSwitchWeapon &&
                calculatedValue.right * calculatedValue.right * variance[goalVariance] <
                  calculatedValue.left * calculatedValue.left * variance1[goalVariance];
              if (switchWeapons) {
                variance = variance1;
                calculatedValue.right = calculatedValue.left;
              }
              calculatedValue.left = 0;
            } else {
              switchWeapons =
                canSwitchWeapon &&
                (variance[goalVariance] < variance1[goalVariance] ||
                  (stat == 'atk' &&
                    variance[goalVariance] == variance1[goalVariance] &&
                    itemAndPassives[0].atk > itemAndPassives[1].atk));
              if (switchWeapons) {
                variance = variance1;
                var tmp: any = calculatedValue.left;
                calculatedValue.left = calculatedValue.right;
                calculatedValue.right = tmp;
              }
            }
          } else {
            if (goalValuesCaract[formula.name].type == 'none' || formula.name == 'physicalDamageMultiCast') {
              calculatedValue.left = 0;
            }
          }

          var enemyResistanceStat: any = enemyStats.def * (1 - enemyStats.breaks.def / 100);
          let base =
            ((calculatedValue.right * calculatedValue.right + calculatedValue.left * calculatedValue.left) *
              (1 - resistModifier) *
              killerMultiplicator *
              jumpMultiplier *
              lbMultiplier) /
            enemyResistanceStat;
          total.min += base * damageMultiplier.min * variance.min;
          total.avg += base * damageMultiplier.avg * variance.avg;
          total.max += base * damageMultiplier.max * variance.max;
          total.switchWeapons = total.switchWeapons || switchWeapons;
        } else {
          var enemyResistanceStat: any = enemyStats.spr * (1 - enemyStats.breaks.spr / 100);
          var dualWieldCoef: any = 1;
          if (
            goalValuesCaract[formula.name].type == 'physical' &&
            !goalValuesCaract[formula.name].multicast &&
            itemAndPassives[0] &&
            itemAndPassives[1] &&
            weaponList.includes(itemAndPassives[0].type) &&
            weaponList.includes(itemAndPassives[1].type)
          ) {
            dualWieldCoef = 2;
          }
          var base: any =
            (calculatedValue.total *
              calculatedValue.total *
              (1 - resistModifier) *
              elementBoostModifier *
              killerMultiplicator *
              dualWieldCoef *
              jumpMultiplier *
              evoMagMultiplier *
              evokeDamageBoostMultiplier *
              lbMultiplier) /
            enemyResistanceStat;
          total.min += base * damageMultiplier.min;
          total.avg += base * damageMultiplier.avg;
          total.max += base * damageMultiplier.max;
        }
      }
      value = {
        min: total.min / goalValuesCaract[formula.name].statsToMaximize.length,
        avg: total.avg / goalValuesCaract[formula.name].statsToMaximize.length,
        max: total.max / goalValuesCaract[formula.name].statsToMaximize.length,
        switchWeapons: total.switchWeapons,
      };
    }
    context.alreadyCalculatedValues[formula.name] = value;
    return value;
  } else if (formula.name === 'monsterDamage') {
    return calculateMonsterDamage(enemyStats.monsterAttack, itemAndPassives, unitBuild, enemyStats, context);
  } else {
    var value: any = calculateStatValue(itemAndPassives, formula.name, unitBuild, context.berserk).total;
    if (formula.name == 'mpRefresh') {
      value /= 100;
    }
    var result: any = {
      min: value,
      avg: value,
      max: value,
      switchWeapons: false,
    };
    context.alreadyCalculatedValues[formula.name] = result;
    return result;
  }
}
