import { EnemyStats } from './enemy-stats.js';
import { isTwoHanded } from './item-values.js';
import { calculateStatValue, getStatCalculatedValue } from './stat-calculation.js';
import { goalValuesCaract, weaponList } from '../constants.js';

export const damageFormulaNames = [
  'physicalDamage',
  'magicalDamage',
  'hybridDamage',
  'jumpDamage',
  'magDamageWithPhysicalMechanism',
  'sprDamageWithPhysicalMechanism',
  'defDamageWithPhysicalMechanism',
  'magDamageWithPhysicalMechanismMultiCast',
  'sprDamageWithPhysicalMechanismMultiCast',
  'defDamageWithPhysicalMechanismMultiCast',
  'atkDamageWithMagicalMechanism',
  'atkDamageWithMagicalMechanismMulticast',
  'sprDamageWithMagicalMechanism',
  'atkDamageWithFixedMechanism',
  'physicalDamageMultiCast',
  'fixedDamageWithPhysicalMechanism',
  'summonerSkillMAG/SPRMechanism',
  'summonerSkillSPRMechanism',
  'summonerSkillMAGMechanism',
  'mpMagPhysicalDamage',
  'mpMagMagicalDamage',
  'mpSprPhysicalDamage',
  'mpSprMagicalDamage',
];

export const operatorsInFormula = ['/', '*', '+', '-', 'OR', 'AND', '>'];

export const weaponBaseDamageVariance = {
  '1h': {
    dagger: { min: 1.1, avg: 1.15, max: 1.2 },
    sword: { min: 1.05, avg: 1.15, max: 1.25 },
    greatSword: { min: 1, avg: 1.15, max: 1.3 },
    katana: { min: 1.05, avg: 1.15, max: 1.25 },
    staff: { min: 1.1, avg: 1.15, max: 1.2 },
    rod: { min: 1.1, avg: 1.15, max: 1.2 },
    bow: { min: 1.35, avg: 1.6, max: 1.85 },
    axe: { min: 0.85, avg: 1.3, max: 1.45 },
    hammer: { min: 0.95, avg: 1.3, max: 1.35 },
    spear: { min: 1, avg: 1.3, max: 1.3 },
    harp: { min: 1.05, avg: 1.15, max: 1.25 },
    whip: { min: 1.05, avg: 1.15, max: 1.25 },
    throwing: { min: 1.05, avg: 1.15, max: 1.25 },
    gun: { min: 1.1, avg: 1.15, max: 1.2 },
    mace: { min: 1.1, avg: 1.15, max: 1.2 },
    fist: { min: 1.15, avg: 1.15, max: 1.15 },
  },
  '2h': {
    dagger: { min: 1.1, avg: 1.15, max: 1.2 },
    sword: { min: 1.25, avg: 1.5, max: 1.75 },
    greatSword: { min: 1.25, avg: 1.5, max: 1.75 },
    katana: { min: 1.25, avg: 1.5, max: 1.75 },
    staff: { min: 1.1, avg: 1.15, max: 1.2 },
    rod: { min: 1.25, avg: 1.5, max: 1.75 },
    bow: { min: 1.35, avg: 1.6, max: 1.85 },
    axe: { min: 1.15, avg: 1.55, max: 1.95 },
    hammer: { min: 1.15, avg: 1.55, max: 1.95 },
    spear: { min: 1.25, avg: 1.5, max: 1.75 },
    harp: { min: 1.35, avg: 1.55, max: 1.75 },
    whip: { min: 1.3, avg: 1.5, max: 1.7 },
    throwing: { min: 1.3, avg: 1.5, max: 1.7 },
    gun: { min: 1.35, avg: 1.55, max: 1.75 },
    mace: { min: 1.4, avg: 1.5, max: 1.6 },
    fist: { min: 1.4, avg: 1.55, max: 1.65 },
  },
  none: { min: 1, avg: 1, max: 1 },
};

function getWeaponVariance(item: any): any {
  if (item && weaponList.includes(item.type)) {
    return item.damageVariance || weaponBaseDamageVariance[isTwoHanded(item) ? '2h' : '1h'][item.type];
  }
  return weaponBaseDamageVariance['none'];
}

function emptyKillerByRace(): any {
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
function getUsedStatValue(context: any, itemAndPassives: any, formula: any, unitBuild: any, defaultStat: string) {
  const stat = formula.value.use ? formula.value.use.stat : defaultStat;
  return getStatCalculatedValue(context, itemAndPassives, stat, unitBuild).total;
}

// Adds the killers of the equipped items matching the enemy races, capped at 300% per race
function addItemKillers(cumulatedKillerByRace: any, itemAndPassives: any, enemyStats: any, killerType: string) {
  for (var equipedIndex = itemAndPassives.length; equipedIndex--;) {
    if (itemAndPassives[equipedIndex] && itemAndPassives[equipedIndex].killers) {
      for (var killerIndex = itemAndPassives[equipedIndex].killers.length; killerIndex--;) {
        var killer: any = itemAndPassives[equipedIndex].killers[killerIndex];
        if (enemyStats.races.includes(killer.name) && killer[killerType]) {
          cumulatedKillerByRace[killer.name] = Math.min(300, cumulatedKillerByRace[killer.name] + killer[killerType]);
        }
      }
    }
  }
}

// Adds the elements of the two weapons (slots 0 and 1) that are not already in `elements`
function addWeaponElements(elements: any, itemAndPassives: any): any {
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
function getDamageMultiplier(unitBuild: any): any {
  var level: any = unitBuild.level || (unitBuild.unit.sixStarForm ? 100 : (unitBuild.unit.max_rarity - 1) * 20);
  var levelCorrection: any = 1 + level / 100;
  return {
    min: levelCorrection * 0.85,
    avg: levelCorrection * 0.925,
    max: levelCorrection,
  };
}

function monsterDamage(value: number) {
  return { min: value, avg: value, max: value, switchWeapons: false };
}

function monsterHitValue(kind: 'physical' | 'magical', itemAndPassives, unitBuild, enemyStats, context: any) {
  const [offStat, defStat] = kind == 'physical' ? ['atk', 'def'] : ['mag', 'spr'];
  const defValue =
    context.alreadyCalculatedValues?.[defStat] ||
    calculateStatValue(itemAndPassives, defStat, unitBuild, context.berserk).total;
  const offValue = enemyStats[offStat] * (1 + enemyStats.buffs[offStat] / 100 - enemyStats.breaks[offStat] / 100);
  let mitigation = 1;
  if (unitBuild.unit.mitigation && unitBuild.unit.mitigation[kind]) {
    mitigation = 1 - unitBuild.unit.mitigation[kind] / 100;
  }
  if (unitBuild.baseValues['mitigation']) {
    mitigation =
      mitigation *
      (1 - unitBuild.baseValues['mitigation'].global / 100) *
      (1 - unitBuild.baseValues['mitigation'][kind] / 100);
  }
  return ((offValue * offValue) / defValue) * mitigation;
}

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
    if (
      context.currentSkill &&
      context.skillEnhancement['allPhysicalAttacks'] &&
      formula.value.mechanism == 'physical'
    ) {
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
  } else if (formula.type == 'value') {
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
  } else if (formula.type == 'heal') {
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
  } else if (formula.type == 'constant') {
    return {
      min: formula.value,
      avg: formula.value,
      max: formula.value,
      switchWeapons: false,
    };
  } else if (formula.type == 'chainMultiplier') {
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
  } else if (formula.type == 'statsBuff') {
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
  } else if (formula.type == 'berserk') {
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
  } else if (formula.type == 'break') {
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
  } else if (formula.type == 'killers') {
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
  } else if (formula.type == 'imbue') {
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
  } else if (formula.type == 'skillEnhancement') {
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
  } else if (formula.type == 'elementCondition') {
    var elements: any = addWeaponElements([], itemAndPassives);
    if (formula.element == 'none') {
      return elements.length == 0;
    } else {
      if (elements.length == 0 || !elements.includes(formula.element)) {
        return false;
      }
    }
    return true;
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

export function getChainMult(unitBuild, itemAndPassives) {
  let chainMult = 4;
  if (
    unitBuild.hasDualWieldMastery() &&
    itemAndPassives[0] &&
    itemAndPassives[1] &&
    weaponList.includes(itemAndPassives[1].type)
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

export function calculateMonsterDamage(
  monsterAttackFormula,
  itemAndPassives,
  unitBuild,
  enemyStats,
  context: any = {},
) {
  let result1, result2, atk, mag, def, spr, baseValue, mitigation;
  switch (monsterAttackFormula.type) {
    case '+':
      result1 = calculateMonsterDamage(monsterAttackFormula.value1, itemAndPassives, unitBuild, enemyStats, context);
      result2 = calculateMonsterDamage(monsterAttackFormula.value2, itemAndPassives, unitBuild, enemyStats, context);
      return {
        min: result1.min + result2.min,
        avg: result1.avg + result2.avg,
        max: result1.max + result2.max,
        switchWeapons: result1.switchWeapons || result2.switchWeapons,
      };
    case '*':
      result1 = calculateMonsterDamage(monsterAttackFormula.value1, itemAndPassives, unitBuild, enemyStats, context);
      result2 = calculateMonsterDamage(monsterAttackFormula.value2, itemAndPassives, unitBuild, enemyStats, context);
      return {
        min: result1.min * result2.min,
        avg: result1.avg * result2.avg,
        max: result1.max * result2.max,
        switchWeapons: result1.switchWeapons || result2.switchWeapons,
      };
    case 'constant':
      return {
        min: monsterAttackFormula.value,
        avg: monsterAttackFormula.value,
        max: monsterAttackFormula.value,
        switchWeapons: false,
      };
    case 'skill':
      switch (monsterAttackFormula.formulaName) {
        case 'physicalDamage':
          return monsterDamage(monsterHitValue('physical', itemAndPassives, unitBuild, enemyStats, context));
        case 'magicalDamage':
          return monsterDamage(monsterHitValue('magical', itemAndPassives, unitBuild, enemyStats, context));
        case 'hybridDamage':
          return monsterDamage(
            (monsterHitValue('physical', itemAndPassives, unitBuild, enemyStats, context) +
              monsterHitValue('magical', itemAndPassives, unitBuild, enemyStats, context)) /
              2,
          );
        case 'fixedDamageWithPhysicalMechanism':
          baseValue = 1;
          return {
            min: baseValue,
            avg: baseValue,
            max: baseValue,
            switchWeapons: false,
          };
        case 'atkDamageWithFixedMechanism':
          if (context.alreadyCalculatedValues && context.alreadyCalculatedValues['def']) {
            def = context.alreadyCalculatedValues['def'];
          } else {
            def = calculateStatValue(itemAndPassives, 'def', unitBuild, context.berserk).total;
          }
          atk = enemyStats.atk * (1 + enemyStats.buffs.atk / 100 - enemyStats.breaks.atk / 100);
          mitigation = 1;
          if (unitBuild.baseValues['mitigation']) {
            mitigation = mitigation * (1 - unitBuild.baseValues['mitigation'].global / 100);
          }
          baseValue = ((atk * atk) / def) * mitigation;
          return {
            min: baseValue,
            avg: baseValue,
            max: baseValue,
            switchWeapons: false,
          };
      }
  }
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
