import { isTwoHanded } from '../item-values.js';
import { getStatCalculatedValue } from '../stat-calculation.js';
import { weaponList } from '../../constants/item-types.js';
import {
  getWeaponVariance,
  emptyKillerByRace,
  getUsedStatValue,
  addItemKillers,
  getElementCoef,
  getWeaponImperilCoef,
} from './damage-helpers.js';

export function calculateDamage(
  itemAndPassives,
  unitBuild,
  enemyStats,
  formula,
  goalVariance,
  canSwitchWeapon,
  context,
) {
  // declared in the multicast branch of the original function (a hoisted var)
  let result: any;
  var applicableKillerType: any = null;

  if (!context.savedValues.hasOwnProperty('resistModifier')) {
    var elements: any = context.imbues;
    if (formula.value.elements) {
      for (var elementIndex = formula.value.elements.length; elementIndex--;) {
        if (!elements.includes(formula.value.elements[elementIndex])) {
          elements.push(formula.value.elements[elementIndex]);
        }
      }
    }
  }

  var variance: any = {
    min: 1,
    avg: 1,
    max: 1,
  };

  variance = getWeaponVariance(itemAndPassives[0]);
  if (
    unitBuild.involvedStats.includes('jumpDamage') &&
    (isTwoHanded(itemAndPassives[0]) || isTwoHanded(itemAndPassives[1]))
  ) {
    // variance override for two handed weapons and jumps
    variance = { min: 2.5, avg: 2.65, max: 2.8 };
  }

  var switchWeapons: any = false;
  if (canSwitchWeapon && goalVariance && dualWielding) {
    var variance1: any;
    variance1 = getWeaponVariance(itemAndPassives[1]);

    switchWeapons =
      canSwitchWeapon &&
      (variance[goalVariance] < variance1[goalVariance] ||
        (stat == 'atk' &&
          variance[goalVariance] == variance1[goalVariance] &&
          itemAndPassives[0].atk > itemAndPassives[1].atk));
    if (context.multicast) {
      // in normal DW, we want the strongest attack to be the second on-e. In multicast, it's the contrary
      switchWeapons = !switchWeapons;
    }
    if (switchWeapons) {
      variance = variance1;
    }
  }

  var statValueToUse: any = 0;
  var defendingStat: any = 1;

  var dualWielding: any =
    itemAndPassives[0] &&
    weaponList.includes(itemAndPassives[0].type) &&
    itemAndPassives[1] &&
    weaponList.includes(itemAndPassives[1].type);
  var coef: any = formula.value.coef;

  if (formula.value.mechanism == 'physical' || formula.value.mechanism == 'hybrid') {
    applicableKillerType = 'physical';

    if (!context.savedValues.hasOwnProperty('resistModifier')) {
      // Takes elements from weapons into account
      if (!formula.value.fixedAttack && itemAndPassives[0] && itemAndPassives[0].element) {
        for (var elementIndex = itemAndPassives[0].element.length; elementIndex--;) {
          if (!elements.includes(itemAndPassives[0].element[elementIndex])) {
            elements.push(itemAndPassives[0].element[elementIndex]);
          }
        }
      }
      if (!formula.value.fixedAttack && itemAndPassives[1] && itemAndPassives[1].element) {
        for (var elementIndex = itemAndPassives[1].element.length; elementIndex--;) {
          if (!elements.includes(itemAndPassives[1].element[elementIndex])) {
            elements.push(itemAndPassives[1].element[elementIndex]);
          }
        }
      }
    }

    if (formula.value.damageType == 'body' || formula.value.mechanism == 'hybrid') {
      defendingStat = 'def';

      var stat: any = 'atk';
      if (formula.value.use) {
        stat = formula.value.use.stat;
      }

      var calculatedValue: any = getStatCalculatedValue(context, itemAndPassives, stat, unitBuild);

      if (stat == 'atk') {
        if (switchWeapons ? !context.treatingLeftHandAttacks : context.treatingLeftHandAttacks) {
          // if not switching weapon and treating second attack, or switching weapon and treating first attack, use left hand value
          statValueToUse = calculatedValue.left;
        } else {
          // else use right hand value
          statValueToUse = calculatedValue.right;
        }
      } else {
        statValueToUse = calculatedValue.total;
      }
    } else {
      defendingStat = 'spr';
      statValueToUse = getUsedStatValue(context, itemAndPassives, formula, unitBuild, 'mag');
    }

    if (
      dualWielding &&
      !formula.value.fixedAttack &&
      !context.isLb &&
      !context.multicast &&
      (!formula.value.delay || formula.value.jump)
    ) {
      // Plan for the left hand attack to be calculated later
      context.remainingLeftHandAttacks.push(formula);
    }
  } else if (formula.value.mechanism == 'magical') {
    applicableKillerType = 'magical';
    if (formula.value.damageType == 'mind') {
      defendingStat = 'spr';

      statValueToUse = getUsedStatValue(context, itemAndPassives, formula, unitBuild, 'mag');
      if (formula.value.use) {
        if (formula.value.use.percent) {
          statValueToUse *= formula.value.use.percent / 100;
        }
        if (formula.value.use.max) {
          if (statValueToUse > formula.value.use.max) {
            statValueToUse = formula.value.use.max;
          }
        }
      }
    } else {
      defendingStat = 'def';
      statValueToUse = getStatCalculatedValue(context, itemAndPassives, 'atk', unitBuild).right;
    }
  } else if (
    formula.value.mechanism == 'summonerSkillMAG/SPRMechanism' ||
    formula.value.mechanism == 'summonerSkillMAGMechanism' ||
    formula.value.mechanism == 'summonerSkillSPRMechanism'
  ) {
    defendingStat = 'spr';
    coef = formula.value.magCoef > formula.value.sprCoef ? formula.value.magCoef : formula.value.sprCoef;
    if (formula.value.magCoef > formula.value.sprCoef) {
      statValueToUse = getUsedStatValue(context, itemAndPassives, formula, unitBuild, 'mag');
    } else if (formula.value.magCoef < formula.value.sprCoef) {
      statValueToUse = getUsedStatValue(context, itemAndPassives, formula, unitBuild, 'spr');
    } else {
      statValueToUse = 0;
    }
  } else if (formula.value.mechanism == 'mpMagPhysicalDamage') {
    applicableKillerType = 'physical';
    defendingStat = 'spr';
    coef = formula.value.mpCoef;
    statValueToUse = getStatCalculatedValue(context, itemAndPassives, 'mag', unitBuild).total;
  } else if (formula.value.mechanism == 'mpMagMagicalDamage') {
    applicableKillerType = 'magical';
    defendingStat = 'spr';
    coef = formula.value.mpCoef;
    statValueToUse = getStatCalculatedValue(context, itemAndPassives, 'mag', unitBuild).total;
  } else if (formula.value.mechanism == 'mpSprPhysicalDamage') {
    applicableKillerType = 'physical';
    defendingStat = 'spr';
    coef = formula.value.mpCoef;
    statValueToUse = getStatCalculatedValue(context, itemAndPassives, 'spr', unitBuild).total;
  } else if (formula.value.mechanism == 'mpSprMagicalDamage') {
    applicableKillerType = 'magical';
    defendingStat = 'spr';
    coef = formula.value.mpCoef;
    statValueToUse = getStatCalculatedValue(context, itemAndPassives, 'spr', unitBuild).total;
  }
  // Killer
  var killerMultiplicator: any = 1;
  if (applicableKillerType && !formula.value.fixedAttack && enemyStats.races.length > 0) {
    if (context.savedValues.killerMultiplicator.hasOwnProperty(applicableKillerType)) {
      killerMultiplicator = context.savedValues.killerMultiplicator[applicableKillerType];
    } else {
      var cumulatedKillerByRace: any = emptyKillerByRace();
      var cumulatedKiller: any = 0;
      addItemKillers(cumulatedKillerByRace, itemAndPassives, enemyStats, applicableKillerType);
      if (context.killerBuff && context.killerBuff[applicableKillerType]) {
        for (var raceIndex = enemyStats.races.length; raceIndex--;) {
          if (context.killerBuff[applicableKillerType][enemyStats.races[raceIndex]]) {
            cumulatedKillerByRace[enemyStats.races[raceIndex]] +=
              context.killerBuff[applicableKillerType][enemyStats.races[raceIndex]];
          }
        }
      }
      if (enemyStats.races.length > 0) {
        for (var raceIndex = enemyStats.races.length; raceIndex--;) {
          cumulatedKiller += cumulatedKillerByRace[enemyStats.races[raceIndex]];
        }
      }
      if (enemyStats.races.length > 0) {
        killerMultiplicator += cumulatedKiller / 100 / enemyStats.races.length;
      }
      context.savedValues.killerMultiplicator[applicableKillerType] = killerMultiplicator;
    }
  }

  // Element weakness/resistance
  var resistModifier: any;
  if (context.savedValues.hasOwnProperty('resistModifier')) {
    resistModifier = context.savedValues.resistModifier;
  } else {
    resistModifier = Math.max(1 - getElementCoef(elements, enemyStats), 0);
    context.savedValues.resistModifier = resistModifier;
  }

  let weaponImperilCoef;
  if (context.savedValues.hasOwnProperty('weaponImperilCoef')) {
    weaponImperilCoef = context.savedValues.weaponImperilCoef;
  } else {
    weaponImperilCoef = getWeaponImperilCoef(itemAndPassives[0], itemAndPassives[1], enemyStats);
    context.savedValues.weaponImperilCoef = weaponImperilCoef;
  }

  let elementBoostModifier;
  if (context.savedValues.hasOwnProperty('elementBoostModifier')) {
    elementBoostModifier = context.savedValues.elementBoostModifier;
  } else {
    if (elements.length) {
      elementBoostModifier =
        1 +
        elements.map((e) => unitBuild.baseValues.elementBuffs[e] || 0).reduce((acc, value) => acc + value, 0) /
          100 /
          elements.length;
    } else {
      elementBoostModifier = 1;
    }
    context.savedValues.elementBoostModifier = elementBoostModifier;
  }

  var jumpMultiplier: any = 1;
  if (formula.value.jump) {
    jumpMultiplier += getStatCalculatedValue(context, itemAndPassives, 'jumpDamage', unitBuild).total / 100;
  }

  if (formula.value.ifUsedAgain && enemyStats.races.includes(formula.value.ifUsedAgain.race)) {
    coef = formula.value.ifUsedAgain.coef;
  }
  if (context.currentSkill && context.skillEnhancement[context.currentSkill]) {
    coef += context.skillEnhancement[context.currentSkill];
  }
  if (context.currentSkill && context.skillEnhancement['allMagicalAttacks'] && formula.value.mechanism == 'magical') {
    coef += context.skillEnhancement['allMagicalAttacks'];
  }
  if (context.currentSkill && context.skillEnhancement['allPhysicalAttacks'] && formula.value.mechanism == 'physical') {
    coef += context.skillEnhancement['allPhysicalAttacks'];
  }
  if (context.currentSkill && context.skillEnhancement['jumpDamage'] && formula.value.mechanism == 'physical') {
    coef += context.skillEnhancement['jumpDamage'];
  }

  if (formula.value.stack) {
    if (context.stack.lastStackingSkillId != 'any' && context.stack.lastStackingSkillId != context.currentSkill) {
      context.stack.lastStackingSkillId == 'any';
      context.stack.currentStack = 0;
    }
    coef += formula.value.stack * context.stack.currentStack;
    if (context.stack.currentStack < formula.value.maxStack) {
      context.stack.currentStack++;
      context.stack.lastStackingSkillId = context.currentSkill;
    }
  }

  var lbMultiplier: any = 1;
  if (context.isLb) {
    lbMultiplier += getStatCalculatedValue(context, itemAndPassives, 'lbDamage', unitBuild).total / 100;
  }

  var evoMagMultiplier: any = 1;
  if (unitBuild.involvedStats.includes('evoMag')) {
    evoMagMultiplier += getStatCalculatedValue(context, itemAndPassives, 'evoMag', unitBuild).total / 100;
  }
  var evokeDamageBoostMultiplier: any = 1;
  if (unitBuild.involvedStats.includes('evokeDamageBoost.all')) {
    evokeDamageBoostMultiplier +=
      getStatCalculatedValue(context, itemAndPassives, 'evokeDamageBoost.all', unitBuild).total / 100;
  }

  var defendingStatValue: any = enemyStats[defendingStat];
  if (formula.value.ignore && formula.value.ignore[defendingStat]) {
    defendingStatValue = defendingStatValue * (1 - formula.value.ignore[defendingStat] / 100);
  }

  var baseDamage: any =
    (coef *
      (statValueToUse * statValueToUse) *
      evoMagMultiplier *
      evokeDamageBoostMultiplier *
      resistModifier *
      weaponImperilCoef *
      elementBoostModifier *
      killerMultiplicator *
      jumpMultiplier *
      lbMultiplier) /
    (defendingStatValue * (1 + (enemyStats.buffs[defendingStat] - enemyStats.breaks[defendingStat]) / 100));

  result = {
    min: baseDamage * context.damageMultiplier.min * variance.min,
    avg: baseDamage * context.damageMultiplier.avg * variance.avg,
    max: baseDamage * context.damageMultiplier.max * variance.max,
    switchWeapons: switchWeapons,
  };

  if (formula.value.mechanism == 'hybrid') {
    var magStat: any = getStatCalculatedValue(context, itemAndPassives, 'mag', unitBuild).total;
    var magDamage: any =
      (coef *
        (magStat * magStat) *
        evoMagMultiplier *
        evokeDamageBoostMultiplier *
        resistModifier *
        weaponImperilCoef *
        elementBoostModifier *
        killerMultiplicator *
        jumpMultiplier *
        lbMultiplier) /
      (enemyStats.spr * (1 + (enemyStats.buffs.spr - enemyStats.breaks.spr) / 100));

    result = {
      min: ((baseDamage + magDamage) * context.damageMultiplier.min * variance.min) / 2,
      avg: ((baseDamage + magDamage) * context.damageMultiplier.avg * variance.avg) / 2,
      max: ((baseDamage + magDamage) * context.damageMultiplier.max * variance.max) / 2,
      switchWeapons: switchWeapons,
    };
  } else if (
    formula.value.mechanism == 'summonerSkillMAG/SPRMechanism' ||
    formula.value.mechanism == 'summonerSkillMAGMechanism' ||
    formula.value.mechanism == 'summonerSkillSPRMechanism'
  ) {
    if (formula.value.sprSplit > 0) {
      var sprStat: any = getStatCalculatedValue(context, itemAndPassives, 'spr', unitBuild).total;
      var sprDamage: any =
        ((formula.value.sprCoef * formula.value.sprSplit + formula.value.magCoef * formula.value.magSplit) *
          (sprStat * sprStat) *
          evoMagMultiplier *
          evokeDamageBoostMultiplier *
          resistModifier *
          weaponImperilCoef *
          elementBoostModifier *
          lbMultiplier) /
        (enemyStats.spr * (1 + (enemyStats.buffs.spr - enemyStats.breaks.spr) / 100));
    } else {
      sprDamage = 0;
    }
    result = {
      min:
        (formula.value.magSplit * baseDamage + formula.value.sprSplit * sprDamage) *
        context.damageMultiplier.min *
        variance.min,
      avg:
        (formula.value.magSplit * baseDamage + formula.value.sprSplit * sprDamage) *
        context.damageMultiplier.avg *
        variance.avg,
      max:
        (formula.value.magSplit * baseDamage + formula.value.sprSplit * sprDamage) *
        context.damageMultiplier.max *
        variance.max,
      switchWeapons: switchWeapons,
    };
    return result;
  } else if (
    ['mpMagPhysicalDamage', 'mpMagMagicalDamage', 'mpSprPhysicalDamage', 'mpSprMagicalDamage'].includes(
      formula.value.mechanism,
    )
  ) {
    const secondStat = formula.value.mechanism.startsWith('mpMag') ? 'mag' : 'spr';
    let secondStatValue = getStatCalculatedValue(context, itemAndPassives, secondStat, unitBuild).total;
    let mpStat = getStatCalculatedValue(context, itemAndPassives, 'mp', unitBuild).total;
    let totalCoef = coef * mpStat;
    const mpStatDamage: any =
      (totalCoef *
        (secondStatValue * secondStatValue) *
        resistModifier *
        weaponImperilCoef *
        elementBoostModifier *
        jumpMultiplier *
        lbMultiplier *
        killerMultiplicator) /
      (enemyStats.spr * (1 + (enemyStats.buffs.spr - enemyStats.breaks.spr) / 100));

    result = {
      min: (baseDamage + mpStatDamage) * context.damageMultiplier.min * variance.min,
      avg: (baseDamage + mpStatDamage) * context.damageMultiplier.avg * variance.avg,
      max: (baseDamage + mpStatDamage) * context.damageMultiplier.max * variance.max,
      switchWeapons: switchWeapons,
    };
  }
  return result;
}
