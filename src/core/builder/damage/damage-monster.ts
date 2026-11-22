import { calculateStatValue } from '../stat-calculation.js';

export function monsterDamage(value: number) {
  return { min: value, avg: value, max: value, switchWeapons: false };
}

export function monsterHitValue(kind: 'physical' | 'magical', itemAndPassives, unitBuild, enemyStats, context: any) {
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
