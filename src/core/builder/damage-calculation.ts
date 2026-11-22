import { EnemyStats } from './enemy-stats.js';
import { operatorsInFormula } from './damage/damage-data.js';
import { getDamageMultiplier } from './damage/damage-helpers.js';
import { calculateDamage } from './damage/damage-attack.js';
import { calculateValue } from './damage/damage-value.js';
import {
  calculateHeal,
  calculateConstant,
  calculateChainMultiplier,
  calculateImperil,
  calculateStatsBuff,
  calculateBerserk,
  calculateBreak,
  calculateKillers,
  calculateImbue,
  calculateSkillEnhancement,
  calculateElementCondition,
} from './damage/damage-effects.js';

export function calculateBuildValueWithFormula(
  itemAndPassives,
  unitBuild,
  enemyStats,
  formula,
  goalVariance,
  canSwitchWeapon = true,
  ignoreConditions = false,
) {
  // save initial bufs
  var atkBuff: any = unitBuild.baseValues.atk.buff;
  var defBuff: any = unitBuild.baseValues.def.buff;
  var magBuff: any = unitBuild.baseValues.mag.buff;
  var sprBuff: any = unitBuild.baseValues.spr.buff;
  var lbDamageBuff: any = unitBuild.baseValues.lbDamage;
  var result: any = innerCalculateBuildValueWithFormula(
    itemAndPassives,
    unitBuild,
    EnemyStats.copy(enemyStats),
    formula,
    goalVariance,
    canSwitchWeapon,
    ignoreConditions,
  );
  // restore initial buffs
  unitBuild.baseValues.atk.buff = atkBuff;
  unitBuild.baseValues.def.buff = defBuff;
  unitBuild.baseValues.mag.buff = magBuff;
  unitBuild.baseValues.spr.buff = sprBuff;
  unitBuild.baseValues.lbDamage = lbDamageBuff;
  return result;
}

export function innerCalculateBuildValueWithFormula(
  itemAndPassives,
  unitBuild,
  enemyStats,
  formula,
  goalVariance,
  canSwitchWeapon,
  ignoreConditions,
  context?,
) {
  if (!context) {
    context = {
      alreadyCalculatedValues: {},
      remainingLeftHandAttacks: [],
      skillEnhancement: {},
      imbues: unitBuild.innateElements.slice(),
      savedValues: {
        killerMultiplicator: {},
      },
      stack: {
        currentStack: unitBuild.baseValues.currentStack,
        lastStackingSkillId: 'any',
      },
      killerBuff: {},
    };
    for (var i = 0; i < itemAndPassives.length; i++) {
      if (itemAndPassives[i] && itemAndPassives[i].skillEnhancement) {
        var skills: any = Object.keys(itemAndPassives[i].skillEnhancement);
        for (var j = skills.length; j--;) {
          if (!context.skillEnhancement[skills[j]]) {
            context.skillEnhancement[skills[j]] = itemAndPassives[i].skillEnhancement[skills[j]];
          } else {
            context.skillEnhancement[skills[j]] += itemAndPassives[i].skillEnhancement[skills[j]];
          }
        }
      }
    }
    if (unitBuild.baseValues.killerBuffs && unitBuild.baseValues.killerBuffs.length) {
      unitBuild.baseValues.killerBuffs.forEach((killerData) => {
        if (killerData.physical) {
          if (!context.killerBuff.physical) context.killerBuff.physical = {};
          context.killerBuff.physical[killerData.name] = killerData.physical;
        }
        if (killerData.magical) {
          if (!context.killerBuff.magical) context.killerBuff.magical = {};
          context.killerBuff.magical[killerData.name] = killerData.magical;
        }
      });
    }
    context.damageMultiplier = getDamageMultiplier(unitBuild);
  }
  if (formula.type == 'multicast') {
    context.multicast = true;
    var result: any = {
      min: 0,
      avg: 0,
      max: 0,
      switchWeapons: false,
    };
    for (var i = 0, len = formula.skills.length; i < len; i++) {
      var skillValue: any = innerCalculateBuildValueWithFormula(
        itemAndPassives,
        unitBuild,
        enemyStats,
        formula.skills[i],
        goalVariance,
        canSwitchWeapon,
        ignoreConditions,
        context,
      );
      result.min += skillValue.min;
      result.avg += skillValue.avg;
      result.max += skillValue.max;
      result.switchWeapons |= skillValue.switchWeapons;
    }
    delete context.multicast;
    return result;
  } else if (formula.type == 'skill') {
    context.currentSkill = formula.id;
    context.isLb = !!formula.lb;
    var result: any = innerCalculateBuildValueWithFormula(
      itemAndPassives,
      unitBuild,
      enemyStats,
      formula.value,
      goalVariance,
      canSwitchWeapon,
      ignoreConditions,
      context,
    );
    if (
      !formula.preventDualCastWithDualWield &&
      context.remainingLeftHandAttacks &&
      context.remainingLeftHandAttacks.length > 0
    ) {
      context.treatingLeftHandAttacks = true;
      for (var i = 0, len = context.remainingLeftHandAttacks.length; i < len; i++) {
        var leftHandAttackResult: any = innerCalculateBuildValueWithFormula(
          itemAndPassives,
          unitBuild,
          enemyStats,
          context.remainingLeftHandAttacks[i],
          goalVariance,
          canSwitchWeapon,
          ignoreConditions,
          context,
        );
        result.min += leftHandAttackResult.min;
        result.avg += leftHandAttackResult.avg;
        result.max += leftHandAttackResult.max;
      }
    }
    context.treatingLeftHandAttacks = false;
    context.remainingLeftHandAttacks = [];
    context.currentSkill = null;
    context.isLb = false;
    return result;
  } else if (formula.type == 'damage') {
    return calculateDamage(itemAndPassives, unitBuild, enemyStats, formula, goalVariance, canSwitchWeapon, context);
  } else if (formula.type == 'value') {
    return calculateValue(itemAndPassives, unitBuild, enemyStats, formula, goalVariance, canSwitchWeapon, context);
  } else if (formula.type == 'heal') {
    return calculateHeal(itemAndPassives, unitBuild, formula, context);
  } else if (formula.type == 'constant') {
    return calculateConstant(formula);
  } else if (formula.type == 'chainMultiplier') {
    return calculateChainMultiplier(itemAndPassives, unitBuild, formula);
  } else if (operatorsInFormula.includes(formula.type)) {
    var result1: any = innerCalculateBuildValueWithFormula(
      itemAndPassives,
      unitBuild,
      enemyStats,
      formula.value1,
      goalVariance,
      canSwitchWeapon,
      ignoreConditions,
      context,
    );
    if (formula.type == 'OR') {
      if (result1) {
        return true;
      } else {
        return innerCalculateBuildValueWithFormula(
          itemAndPassives,
          unitBuild,
          enemyStats,
          formula.value2,
          goalVariance,
          canSwitchWeapon,
          ignoreConditions,
          context,
        );
      }
    } else if (formula.type == 'AND') {
      if (result1) {
        return innerCalculateBuildValueWithFormula(
          itemAndPassives,
          unitBuild,
          enemyStats,
          formula.value2,
          goalVariance,
          canSwitchWeapon,
          ignoreConditions,
          context,
        );
      } else {
        return false;
      }
    } else {
      var result2: any = innerCalculateBuildValueWithFormula(
        itemAndPassives,
        unitBuild,
        enemyStats,
        formula.value2,
        goalVariance,
        canSwitchWeapon,
        ignoreConditions,
        context,
      );
      if (formula.type == '*') {
        return {
          min: result1.min * result2.min,
          avg: result1.avg * result2.avg,
          max: result1.max * result2.max,
          switchWeapons: result1.switchWeapons || result2.switchWeapons,
        };
      } else if (formula.type == '+') {
        return {
          min: result1.min + result2.min,
          avg: result1.avg + result2.avg,
          max: result1.max + result2.max,
          switchWeapons: result1.switchWeapons || result2.switchWeapons,
        };
      } else if (formula.type == '/') {
        return {
          min: result1.min / (result2.max == 0 ? 0.00001 : result2.max),
          avg: result1.avg / (result2.avg == 0 ? 0.00001 : result2.avg),
          max: result1.max / (result2.min == 0 ? 0.00001 : result2.min),
          switchWeapons: result1.switchWeapons || result2.switchWeapons,
        };
      } else if (formula.type == '-') {
        return {
          min: result1.min - result2.max,
          avg: result1.avg - result2.avg,
          max: result1.max - result2.min,
          switchWeapons: result1.switchWeapons || result2.switchWeapons,
        };
      } else if (formula.type == '>') {
        return result1[goalVariance] >= result2[goalVariance];
      }
    }
  } else if (formula.type == 'imperil') {
    return calculateImperil(enemyStats, formula, context);
  } else if (formula.type == 'statsBuff') {
    return calculateStatsBuff(unitBuild, formula, context);
  } else if (formula.type == 'berserk') {
    return calculateBerserk(formula, context);
  } else if (formula.type == 'break') {
    return calculateBreak(enemyStats, formula);
  } else if (formula.type == 'killers') {
    return calculateKillers(formula, context);
  } else if (formula.type == 'imbue') {
    return calculateImbue(formula, context);
  } else if (formula.type == 'skillEnhancement') {
    return calculateSkillEnhancement(formula, context);
  } else if (formula.type == 'elementCondition') {
    return calculateElementCondition(itemAndPassives, formula);
  } else if (formula.type == 'condition') {
    if (!ignoreConditions) {
      var value: any = innerCalculateBuildValueWithFormula(
        itemAndPassives,
        unitBuild,
        enemyStats,
        formula.condition,
        goalVariance,
        canSwitchWeapon,
        ignoreConditions,
        context,
      );
      if (!value) {
        return -1;
      }
    }
    return innerCalculateBuildValueWithFormula(
      itemAndPassives,
      unitBuild,
      enemyStats,
      formula.formula,
      goalVariance,
      canSwitchWeapon,
      ignoreConditions,
      context,
    );
  }
}
