import { getStatCalculatedValue } from '../stat-calculation.js';
import { addWeaponElements, getChainMult } from './damage-helpers.js';

export function calculateHeal(itemAndPassives, unitBuild, formula, context) {
  // declared in the multicast branch of the original function (a hoisted var)
  let result: any;
  var sprStat: any = getStatCalculatedValue(context, itemAndPassives, 'spr', unitBuild).total / 2;
  var magStat: any = getStatCalculatedValue(context, itemAndPassives, 'mag', unitBuild).total / 10;
  var coef: any = formula.value.coef;
  result = formula.value.split
    ? {
        min: formula.value.base / formula.value.split + (sprStat + magStat) * (coef / formula.value.split) * 0.85,
        avg: formula.value.base / formula.value.split + (sprStat + magStat) * (coef / formula.value.split) * 0.925,
        max: formula.value.base / formula.value.split + (sprStat + magStat) * (coef / formula.value.split),
        switchWeapons: false,
      }
    : {
        min: formula.value.base + (sprStat + magStat) * coef * 0.85,
        avg: formula.value.base + (sprStat + magStat) * coef * 0.925,
        max: formula.value.base + (sprStat + magStat) * coef,
        switchWeapons: false,
      };
  return result;
}

export function calculateConstant(formula) {
  return {
    min: formula.value,
    avg: formula.value,
    max: formula.value,
    switchWeapons: false,
  };
}

export function calculateChainMultiplier(itemAndPassives, unitBuild, formula) {
  if (formula.value === 'MAX') {
    let chainMult = getChainMult(unitBuild, itemAndPassives);
    return {
      min: chainMult,
      avg: chainMult,
      max: chainMult,
      switchWeapons: false,
    };
  } else {
    return {
      min: formula.value,
      avg: formula.value,
      max: formula.value,
      switchWeapons: false,
    };
  }
}

export function calculateImperil(enemyStats, formula, context) {
  var imperiledElements: any = Object.keys(formula.value);
  for (let i = imperiledElements.length; i--;) {
    var element: any = imperiledElements[i];
    if (enemyStats.imperils[element] < formula.value[element]) {
      enemyStats.imperils[element] = formula.value[element];
      delete context.savedValues.resistModifier;
    }
  }
  return {
    min: 0,
    avg: 0,
    max: 0,
    switchWeapons: false,
  };
}

export function calculateStatsBuff(unitBuild, formula, context) {
  if (formula.value.atk) {
    if (unitBuild.baseValues.atk.buff < formula.value.atk) {
      unitBuild.baseValues.atk.buff = formula.value.atk;
      delete context.savedValues.atk;
    }
  }
  if (formula.value.def) {
    if (unitBuild.baseValues.def.buff < formula.value.def) {
      unitBuild.baseValues.def.buff = formula.value.def;
      delete context.savedValues.def;
    }
  }
  if (formula.value.mag) {
    if (unitBuild.baseValues.mag.buff < formula.value.mag) {
      unitBuild.baseValues.mag.buff = formula.value.mag;
      delete context.savedValues.mag;
    }
  }
  if (formula.value.spr) {
    if (unitBuild.baseValues.spr.buff < formula.value.spr) {
      unitBuild.baseValues.spr.buff = formula.value.spr;
      delete context.savedValues.spr;
    }
  }
  if (formula.value.lbDamage) {
    if (unitBuild.baseValues.lbDamage < formula.value.lbDamage) {
      unitBuild.baseValues.lbDamage = formula.value.lbDamage;
      delete context.savedValues.lbDamage;
    }
  }
  return {
    min: 0,
    avg: 0,
    max: 0,
    switchWeapons: false,
  };
}

export function calculateBerserk(formula, context) {
  if (!context.berserk || context.berserk < formula.value) {
    context.berserk = formula.value;
    delete context.savedValues.atk;
  }
  return {
    min: 0,
    avg: 0,
    max: 0,
    switchWeapons: false,
  };
}

export function calculateBreak(enemyStats, formula) {
  if (formula.value.def && enemyStats.breakability.def) {
    if (enemyStats.breaks.def < formula.value.def) {
      enemyStats.breaks.def = formula.value.def;
    }
  }
  if (formula.value.spr && enemyStats.breakability.spr) {
    if (enemyStats.breaks.spr < formula.value.spr) {
      enemyStats.breaks.spr = formula.value.spr;
    }
  }
  return {
    min: 0,
    avg: 0,
    max: 0,
    switchWeapons: false,
  };
}

export function calculateKillers(formula, context) {
  if (!context.killerBuff) {
    context.killerBuff = {};
  }
  for (let i = formula.value.killers.length; i--;) {
    if (formula.value.killers[i].physical) {
      if (!context.killerBuff.physical) {
        context.killerBuff.physical = {};
      }
      if (
        !context.killerBuff.physical[formula.value.killers[i].name] ||
        context.killerBuff.physical[formula.value.killers[i].name] < formula.value.killers[i].physical
      ) {
        context.killerBuff.physical[formula.value.killers[i].name] = formula.value.killers[i].physical;
      }
    }
    if (formula.value.killers[i].magical) {
      if (!context.killerBuff.magical) {
        context.killerBuff.magical = {};
      }
      if (
        !context.killerBuff.magical[formula.value.killers[i].name] ||
        context.killerBuff.magical[formula.value.killers[i].name] < formula.value.killers[i].magical
      ) {
        context.killerBuff.magical[formula.value.killers[i].name] = formula.value.killers[i].magical;
      }
    }
  }
  context.savedValues.killerMultiplicator = {};

  return {
    min: 0,
    avg: 0,
    max: 0,
    switchWeapons: false,
  };
}

export function calculateImbue(formula, context) {
  for (var elementIndex = formula.value.length; elementIndex--;) {
    if (!context.imbues.includes(formula.value[elementIndex])) {
      context.imbues.push(formula.value[elementIndex]);
      delete context.savedValues.resistModifier;
    }
  }
  return {
    min: 0,
    avg: 0,
    max: 0,
    switchWeapons: false,
  };
}

export function calculateSkillEnhancement(formula, context) {
  var skills: any = Object.keys(formula.value);
  for (let i = skills.length; i--;) {
    if (!context.skillEnhancement[skills[i]]) {
      context.skillEnhancement[skills[i]] = formula.value[skills[i]];
    } else {
      context.skillEnhancement[skills[i]] += formula.value[skills[i]];
    }
  }
  return {
    min: 0,
    avg: 0,
    max: 0,
    switchWeapons: false,
  };
}

export function calculateElementCondition(itemAndPassives, formula) {
  var elements: any = addWeaponElements([], itemAndPassives);
  if (formula.element == 'none') {
    return elements.length == 0;
  } else {
    if (elements.length == 0 || !elements.includes(formula.element)) {
      return false;
    }
  }
  return true;
}
