import { ailmentList, baseStats, elementList } from '../../../../core/constants/base-lists';
import { weaponList } from '../../../../core/constants/item-types';
import { calculateBuildValueWithFormula } from '../../../../core/builder/damage-calculation';
import { calculateMonsterDamage } from '../../../../core/builder/damage/damage-monster';
import { EnemyStats } from '../../../../core/builder/enemy-stats';
import { calculateStatValue, getEquipmentStatBonus, getStatBonusCap } from '../../../../core/builder/stat-calculation';
import { formulaByGoal } from './goal';
import { STRINGS } from '../../../strings/en';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

export interface Variation {
  min: number;
  avg: number;
  max: number;
}

export interface StatTotal {
  stat: string;
  total: number;
  bonus: number;
  bonusOver: boolean;
  bonusCap: number;
  /** the "equipped stat (DH)" bonus, when the build has one */
  flat: number;
  flatOver: boolean;
  flatCap: number;
  /** the stat is what the goal maximizes */
  involved: boolean;
}

export interface ExtraStat {
  key: string;
  label: string;
  title?: string;
  value: number;
  suffix: string;
  /** more than the game takes into account */
  over: boolean;
  cap: number;
  involved: boolean;
}

export interface DamageLine {
  kind: 'build' | 'physical' | 'magical' | 'hybrid' | 'heal';
  label: string;
  value: Variation;
  secondary: boolean;
}

/** The resistance of the build to an element or an ailment; `involved`: the goal is made of it. */
export interface ResistTotal {
  name: string;
  percent: number;
  involved: boolean;
}

export interface ResultStats {
  totals: StatTotal[];
  physicalEhp: number;
  magicalEhp: number;
  /** the goal maximizes the eHP */
  ehpGoal: 'physical' | 'magical' | null;
  extras: ExtraStat[];
  elementResists: ResistTotal[];
  ailmentResists: ResistTotal[];
  killers: { name: string; physical: number; magical: number }[];
  damage: DamageLine[];
  damageTaken: number;
}

/** The stats that show only when the build has some, with the unit they are written in. */
const EXTRAS: { key: string; stat: string; label: string; title?: string; suffix: string }[] = [
  { key: 'evadePhysical', stat: 'evade.physical', label: STRINGS.resultStats.pEvade, title: STRINGS.resultStats.physicalEvade, suffix: '%' },
  { key: 'lbPerTurn', stat: 'lbPerTurn', label: STRINGS.resultStats.lbTurn, suffix: '' },
  { key: 'accuracy', stat: 'accuracy', label: STRINGS.resultStats.accuracy, suffix: '%' },
  { key: 'drawAttacks', stat: 'drawAttacks', label: STRINGS.resultStats.dAttacks, suffix: '%' },
  { key: 'evokeDamageBoost', stat: 'evokeDamageBoost.all', label: STRINGS.resultStats.evokeDmg, suffix: '%' },
  { key: 'evoMag', stat: 'evoMag', label: STRINGS.resultStats.evoMag, suffix: '%' },
  { key: 'lbFillRate', stat: 'lbFillRate', label: STRINGS.resultStats.lbFillRate, suffix: '%' },
  { key: 'jumpDamage', stat: 'jumpDamage', label: STRINGS.resultStats.jumpD, suffix: '%' },
  { key: 'lbDamage', stat: 'lbDamage', label: STRINGS.resultStats.lbDamage, suffix: '%' },
  { key: 'chainMastery', stat: 'chainMastery', label: STRINGS.resultStats.chainMastery, suffix: 'x' },
];

/** The killers of the equipment, summed by race. */
export function sumKillers(items: any[]): { name: string; physical: number; magical: number }[] {
  const byName = new Map<string, { name: string; physical: number; magical: number }>();
  for (const item of items) {
    for (const killer of item?.killers ?? []) {
      const entry = byName.get(killer.name) ?? { name: killer.name, physical: 0, magical: 0 };
      entry.physical += killer.physical || 0;
      entry.magical += killer.magical || 0;
      byName.set(killer.name, entry);
    }
  }
  return [...byName.values()];
}

/** The mitigation the unit has: its own, and the one entered in the page. */
function mitigation(build: any, kind: 'physical' | 'magical'): number {
  let value = 1;
  if (build.unit.mitigation?.[kind]) value = 1 - build.unit.mitigation[kind] / 100;
  const entered = build.baseValues?.mitigation;
  if (entered) value *= (1 - entered.global / 100) * (1 - entered[kind] / 100);
  return value;
}

/** The name of the skill when the goal is a single skill (its result is the one to show, not a damage per kind). */
function singleSkillName(formula: any): string | null {
  if (!formula) return null;
  if (formula.type === 'value' || formula.type === 'skill') return formula.name;
  if (formula.type === 'condition' && formula.formula.type === 'skill') return formula.formula.name;
  if (formula.type === '*' && formula.value1.type === 'chainMultiplier') {
    const label = formula.value1.value === 'MAX' ? 'MAX chain' : `${formula.value1.value}x chain`;
    if (formula.value2.type === 'value' || formula.value2.type === 'skill') return `${label} ${formula.value2.name}`;
  }
  return null;
}

/** Everything the page shows about a build: the stats, the resists and killers, and the damage on the enemy (the old `logBuild`). */
export function resultStats(
  build: any,
  enemy: EnemyStats,
  variation: 'min' | 'avg' | 'max',
  goalValue: any,
): ResultStats {
  const items = build.build;
  const involved: string[] = build.involvedStats ?? [];
  const totals: StatTotal[] = baseStats.map((stat) => {
    const result = calculateStatValue(items, stat, build);
    const flat = Math.round((getEquipmentStatBonus(items, stat, false) - 1) * 100);
    let flatCap = getStatBonusCap('tdh', build);
    if (items[0] && items[1] && weaponList.includes(items[0].type) && weaponList.includes(items[1].type))
      flatCap = build.tdwCap * 100;
    const bonusCap = getStatBonusCap(stat, build);
    return {
      stat,
      total: Math.floor(result.total),
      bonus: result.bonusPercent,
      bonusOver: result.bonusPercent > bonusCap,
      bonusCap,
      flat,
      flatOver: flat > flatCap,
      flatCap,
      involved: involved.includes(stat),
    };
  });
  const value = (stat: string): number => totals.find((t) => t.stat === stat)!.total;
  const raw = (stat: string): number => calculateStatValue(items, stat, build).total;
  const physicalEhp = Math.floor((value('def') * value('hp')) / mitigation(build, 'physical'));
  const magicalEhp = Math.floor((value('spr') * value('hp')) / mitigation(build, 'magical'));

  const extras: ExtraStat[] = [];
  const addExtra = (
    key: string,
    label: string,
    title: string | undefined,
    amount: number,
    suffix: string,
    over: boolean,
    cap: number,
    isInvolved: boolean,
  ): void => {
    if (amount) extras.push({ key, label, title, value: amount, suffix, over, cap, involved: isInvolved });
  };
  addExtra('evadeMagical', 'M. Evade', 'Magical Evade', raw('evade.magical'), '%', false, 0, false);
  addExtra('mpRefresh', 'MP/turn', undefined, Math.floor((value('mp') * raw('mpRefresh')) / 100), '', false, 0, false);
  for (const extra of EXTRAS) {
    const { overcap } = calculateStatValue(items, extra.stat, build);
    const cap = getStatBonusCap(extra.stat, build);
    const isInvolved = involved.includes(extra.stat) || (extra.stat === 'lbFillRate' && involved.includes('lbPerTurn'));
    addExtra(extra.key, extra.label, extra.title, overcap, extra.suffix, overcap > cap, cap, isInvolved);
  }

  // the order of the old page
  const order = [
    'evadePhysical',
    'evadeMagical',
    'mpRefresh',
    'lbPerTurn',
    'lbFillRate',
    'evoMag',
    'evokeDamageBoost',
    'accuracy',
    'drawAttacks',
    'jumpDamage',
    'lbDamage',
    'chainMastery',
  ];
  extras.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

  // all of them, also the ones at 0 (the old page showed every element and ailment)
  const resists = (names: readonly string[], max?: number): ResistTotal[] =>
    names.map((name) => {
      const total = calculateStatValue(items, `resist|${name}.percent`, build).total;
      return {
        name,
        percent: max === undefined ? total : Math.min(max, total),
        involved: involved.includes(`resist|${name}.percent`),
      };
    });

  const damage: DamageLine[] = [];
  const skillName = singleSkillName(build.formula);
  const goal =
    goalValue ??
    (build.formula ? calculateBuildValueWithFormula(items, build, enemy, build.formula, variation, false, true) : null);
  const kinds: [DamageLine['kind'], string, boolean][] = [
    ['physical', 'physicalDamage', involved.includes('atk')],
    ['magical', 'magicalDamage', involved.includes('mag')],
    ['hybrid', 'hybridDamage', involved.includes('atk') && involved.includes('mag')],
    ['heal', 'heal', involved.includes('mag') && involved.includes('spr')],
  ];
  const labels: Record<string, string> = {
    physical: `Physical damage on a ${enemy.def} DEF enemy with a 1x skill`,
    magical: `Magical damage on a ${enemy.spr} SPR enemy with a 1x skill`,
    hybrid: `Hybrid damage on a ${enemy.def} DEF ${enemy.spr} SPR enemy with a 1x skill`,
    heal: 'Healing coef',
  };
  const perKind: any[] = [];
  if (!skillName) {
    for (const [kind, goalName, shown] of kinds) {
      if (!shown) continue;
      const result = calculateBuildValueWithFormula(items, build, enemy, formulaByGoal[goalName], variation, false);
      perKind.push(result);
      damage.push({ kind, label: labels[kind], value: result, secondary: false });
    }
  }
  // the goal line shows when the goal is one skill, or when no other line has the same value
  if (goal && (skillName || !perKind.some((result) => result[variation] === goal[variation]))) {
    damage.unshift({ kind: 'build', label: skillName ?? 'Build goal calculated value', value: goal, secondary: false });
    for (const line of damage) if (line.kind !== 'build') line.secondary = true;
  }
  const damageTaken = Math.floor(calculateMonsterDamage(enemy.monsterAttack, items, build, enemy)?.max ?? 0);

  return {
    totals,
    physicalEhp,
    magicalEhp,
    ehpGoal: build.goal === 'physicaleHp' ? 'physical' : build.goal === 'magicaleHp' ? 'magical' : null,
    extras,
    elementResists: resists(elementList),
    ailmentResists: resists(ailmentList, 100),
    killers: sumKillers(items),
    damage,
    damageTaken,
  };
}
