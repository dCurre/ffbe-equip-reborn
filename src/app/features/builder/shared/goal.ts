import { formulaFromSkill, getSkillFromId } from '../../../../core/formula/formula-parser';
import {
  getChainMultiplier,
  isSimpleFormula,
  makeSureFormulaHaveSimpleConditions,
} from '../../../../core/formula/formula-conditions';
import { getMulticastSkillAbleToMulticast, hasMulticast } from '../../../../core/formula/formula-queries';

/* eslint-disable @typescript-eslint/no-explicit-any -- formulas and skills are open data */

/** The goals of the page that are a formula written once (damage of 1x a mechanism, a stat, ...). */
export const formulaByGoal: Record<string, any> = {
  physicalDamage: skill('physicalDamage', '1x physical ATK damage', {
    mechanism: 'physical',
    damageType: 'body',
    coef: 1,
  }),
  magicalDamage: skill('magicalDamage', '1x magical MAG damage', { mechanism: 'magical', damageType: 'mind', coef: 1 }),
  hybridDamage: skill('hybridDamage', '1x hybrid ATK/MAG damage', { mechanism: 'hybrid', coef: 1 }),
  jumpDamage: skill('jumpDamage', '1x jump damage', { mechanism: 'physical', damageType: 'body', coef: 1, jump: true }),
  magDamageWithPhysicalMechanism: skill('magDamageWithPhysicalMechanism', '1x physical MAG damage', {
    mechanism: 'physical',
    damageType: 'mind',
    coef: 1,
  }),
  sprDamageWithPhysicalMechanism: skill('sprDamageWithPhysicalMechanism', '1x physical SPR damage', {
    mechanism: 'physical',
    damageType: 'mind',
    coef: 1,
    use: { stat: 'spr' },
  }),
  defDamageWithPhysicalMechanism: skill('defDamageWithPhysicalMechanism', '1x physical DEF damage', {
    mechanism: 'physical',
    damageType: 'body',
    coef: 1,
    use: { stat: 'def' },
  }),
  atkDamageWithMagicalMechanism: skill('atkDamageWithMagicalMechanism', '1x magical ATK damage', {
    mechanism: 'magical',
    damageType: 'body',
    coef: 1,
  }),
  sprDamageWithMagicalMechanism: skill('sprDamageWithMagicalMechanism', '1x magical SPR damage', {
    mechanism: 'magical',
    damageType: 'mind',
    coef: 1,
    use: { stat: 'spr' },
  }),
  mpDamageWithMagicalMechanism: skill('mpDamageWithMagicalMechanism', '1x magical MP damage', {
    mechanism: 'magical',
    damageType: 'mind',
    coef: 1,
    use: { stat: 'mp' },
  }),
  mpMagPhysicalDamage: skill('mpMagPhysicalDamage', '1x physical MP + MAG damage', {
    mechanism: 'mpMagPhysicalDamage',
    damageType: 'body',
    coef: 1,
  }),
  mpMagMagicalDamage: skill('mpMagMagicalDamage', '1x magical MP + MAG damage', {
    mechanism: 'mpMagMagicalDamage',
    damageType: 'mind',
    coef: 1,
  }),
  mpSprPhysicalDamage: skill('mpSprPhysicalDamage', '1x physical MP + SPR damage', {
    mechanism: 'mpSprPhysicalDamage',
    damageType: 'body',
    coef: 1,
  }),
  mpSprMagicalDamage: skill('mpSprMagicalDamage', '1x magical MP + SPR damage', {
    mechanism: 'mpSprMagicalDamage',
    damageType: 'mind',
    coef: 1,
  }),
  atkDamageWithFixedMechanism: value('atkDamageWithFixedMechanism'),
  physicalDamageMultiCast: value('physicalDamageMultiCast'),
  fixedDamageWithPhysicalMechanism: value('fixedDamageWithPhysicalMechanism'),
  'summonerSkillMAG/SPRMechanism': value('summonerSkillMAG/SPRMechanism'),
  summonerSkillMAGMechanism: value('summonerSkillMAGMechanism'),
  summonerSkillSPRMechanism: value('summonerSkillSPRMechanism'),
  atk: value('atk'),
  mag: value('mag'),
  def: value('def'),
  spr: value('spr'),
  hp: value('hp'),
  mp: value('mp'),
  physicaleHp: { type: '*', value1: value('hp'), value2: value('def') },
  magicaleHp: { type: '*', value1: value('hp'), value2: value('spr') },
  physicalEvasion: value('evade.physical'),
  magicalEvasion: value('evade.magical'),
  mpRefresh: { type: '*', value1: value('mp'), value2: value('mpRefresh') },
  heal: {
    type: '+',
    value1: { type: '/', value1: value('spr'), value2: { type: 'constant', value: 2 } },
    value2: { type: '/', value1: value('mag'), value2: { type: 'constant', value: 10 } },
  },
};

function skill(formulaName: string, name: string, damage: Record<string, unknown>): any {
  return { type: 'skill', id: '0', name, formulaName, value: { type: 'damage', value: damage } };
}

function value(name: string): any {
  return { type: 'value', name };
}

/** The goals offered first, with their names. */
export const goalQuickSelect: [string, string][] = [
  ['physicalDamage', 'Physical damage'],
  ['magicalDamage', 'Magical damage'],
  ['hybridDamage', 'Hybrid damage'],
  ['jumpDamage', 'Jump damage'],
  ['magDamageWithPhysicalMechanism', 'Physical type MAG damage'],
  ['sprDamageWithPhysicalMechanism', 'Physical type SPR damage'],
  ['defDamageWithPhysicalMechanism', 'Physical type DEF damage'],
  ['atkDamageWithMagicalMechanism', 'Magical type ATK damage'],
  ['sprDamageWithMagicalMechanism', 'Magical type SPR damage'],
  ['mpDamageWithMagicalMechanism', 'Magical type MP damage'],
  ['atkDamageWithFixedMechanism', 'Fixed type ATK damage'],
  ['physicalDamageMultiCast', 'Physical damage Multicast'],
  ['fixedDamageWithPhysicalMechanism', 'Physical type Fixed damage (1000)'],
  ['summonerSkillMAG/SPRMechanism', 'Summoner Skill MAG/SPR'],
  ['summonerSkillMAGMechanism', 'Summoner Skill MAG'],
  ['summonerSkillSPRMechanism', 'Summoner Skill SPR'],
  ['mpMagPhysicalDamage', 'Physical MP/MAG Scaling Damage'],
  ['mpMagMagicalDamage', 'Magical MP/MAG Scaling Damage'],
  ['mpSprPhysicalDamage', 'Magical MP/SPR Scaling Damage'],
  ['mpSprMagicalDamage', 'Magical MP/MAG Scaling Damage'],
  ['physicaleHp', 'Physical eHP (HP * DEF)'],
  ['magicaleHp', 'Magical eHP (HP * SPR)'],
  ['atk', 'ATK'],
  ['mag', 'MAG'],
  ['def', 'DEF'],
  ['spr', 'SPR'],
  ['hp', 'HP'],
  ['mp', 'MP'],
  ['physicalEvasion', 'Physical evasion'],
  ['magicalEvasion', 'Magical evasion'],
  ['mpRefresh', 'MP/turn'],
  ['heal', 'Heal'],
];

/** The formula the monsters hit with, unless the user chooses another. */
export const defaultMonsterAttackFormula: any = {
  type: '*',
  value1: { type: 'constant', value: 1 },
  value2: formulaByGoal['physicalDamage'],
};

// --- The choices of the goal select of a unit ---

export type GoalKind = 'damage' | 'stat' | 'lb' | 'skill' | 'magic' | 'multicast' | '';

export interface GoalOption {
  value: string;
  label: string;
  disabled: boolean;
  kind: GoalKind;
  icon?: string;
  /** "☆": a skill that needs another one used the turn before, or the upgraded limit burst */
  upgraded?: string;
}

const GOAL_KIND: Record<string, GoalKind> = {
  physicalDamage: 'damage',
  magicalDamage: 'damage',
  hybridDamage: 'damage',
  jumpDamage: 'damage',
  magDamageWithPhysicalMechanism: 'damage',
  sprDamageWithPhysicalMechanism: 'damage',
  defDamageWithPhysicalMechanism: 'damage',
  atkDamageWithMagicalMechanism: 'damage',
  sprDamageWithMagicalMechanism: 'damage',
  atkDamageWithFixedMechanism: 'damage',
  physicalDamageMultiCast: 'damage',
  fixedDamageWithPhysicalMechanism: 'damage',
  'summonerSkillMAG/SPR': 'damage',
  summonerSkillMAG: 'damage',
  summonerSkillSPR: 'damage',
  physicaleHp: 'stat',
  magicaleHp: 'stat',
  atk: 'stat',
  mag: 'stat',
  def: 'stat',
  spr: 'stat',
  hp: 'stat',
  mp: 'stat',
  physicalEvasion: 'stat',
  magicalEvasion: 'stat',
  mpRefresh: 'stat',
  heal: 'stat',
};

const notSupported = (formula: any): string => (formula.notSupported ? ' - Not supported yet' : '');

/** The upgraded limit burst of a unit (a passive that replaces it), if it has one. */
export function replacedLb(unit: any): any | undefined {
  for (let i = unit.passives.length; i--;) {
    for (let j = unit.passives[i].effects.length; j--;) {
      const effect = unit.passives[i].effects[j].effect;
      if (effect?.replaceLb) return effect.replaceLb;
    }
  }
  return undefined;
}

/** What the goal select offers for a unit: the default goals, its limit burst, its skills and its multicasts. */
export function goalOptions(unit: any): GoalOption[] {
  const options: GoalOption[] = [];
  for (let i = goalQuickSelect.length - 1; i >= 0; i--) {
    const [id, label] = goalQuickSelect[i];
    options.push({ value: id, label, disabled: false, kind: GOAL_KIND[id] ?? '' });
  }
  const lbFormula = formulaFromSkill(unit.lb);
  if (lbFormula) {
    options.push({
      value: 'LB',
      label: `${unit.lb.name} (Limit Burst)${notSupported(lbFormula)}`,
      disabled: !!lbFormula.notSupported,
      kind: 'lb',
      icon: 'img/icons/lb.png',
    });
  }
  for (let i = unit.passives.length; i--;) {
    const passive = unit.passives[i];
    for (let j = passive.effects.length; j--;) {
      const effect = passive.effects[j].effect;
      if (effect?.replaceLb) {
        const formula = formulaFromSkill(effect.replaceLb);
        if (formula) {
          options.push({
            value: 'LB_REPLACED',
            label: `${effect.replaceLb.name} (Limit Burst)${notSupported(formula)}`,
            disabled: !!formula.notSupported,
            kind: 'lb',
            icon: 'img/icons/lb.png',
            upgraded: 'Upgraded LB',
          });
        }
      }
      if (effect?.multicast) {
        options.push({
          value: `MULTICAST_${passive.id}`,
          label: passive.name,
          disabled: false,
          kind: 'multicast',
          icon: `img/items/${passive.icon}`,
        });
      }
    }
  }
  const skillOption = (skill: any, formula: any, kind: GoalKind): GoalOption => ({
    value: `SKILL_${skill.id}`,
    label: skill.name + notSupported(formula),
    disabled: !!formula.notSupported,
    kind: formula.notSupported ? '' : kind,
    icon: `img/items/${skill.icon}`,
    upgraded: skill.ifUsedLastTurn
      ? `if ${[...new Set<string>(skill.ifUsedLastTurn.map((x: any) => x.name))].sort().join(',')} used last turn`
      : undefined,
  });
  for (let i = unit.actives.length; i--;) {
    const active = unit.actives[i];
    const formula = formulaFromSkill(active);
    if (formula) {
      options.push(skillOption(active, formula, 'skill'));
    } else {
      for (let j = active.effects.length; j--;) {
        if (active.effects[j].effect?.multicast) {
          options.push({
            value: `MULTICAST_${active.id}`,
            label: active.name,
            disabled: false,
            kind: 'multicast',
            icon: `img/items/${active.icon}`,
          });
        }
      }
    }
  }
  for (let i = unit.magics.length; i--;) {
    const magic = unit.magics[i];
    const formula = formulaFromSkill(magic);
    if (formula) options.push(skillOption(magic, formula, 'magic'));
  }
  return options;
}

/** The multicast effect of a skill. */
export function multicastEffect(skill: any): any {
  let found: any;
  for (let i = skill.effects.length; i--;)
    if (skill.effects[i].effect?.multicast) found = skill.effects[i].effect.multicast;
  return found;
}

/** The skills the choices of a multicast can be. */
export function multicastChoices(unit: any, skillId: string): any[] {
  const multicast = multicastEffect(getSkillFromId(skillId, unit));
  let skills = unit.magics.filter(
    (magic: any) =>
      (magic.magic === 'white' && multicast.type.includes('whiteMagic')) ||
      (magic.magic === 'green' && multicast.type.includes('greenMagic')) ||
      (magic.magic === 'black' && multicast.type.includes('blackMagic')),
  );
  if (multicast.type.includes('allSkills')) {
    skills = skills.concat(unit.actives.filter((s: any) => !multicast.excludedSkills?.some((x: any) => x.id === s.id)));
  }
  if (multicast.type.includes('skills')) {
    skills = skills.concat(unit.actives.filter((s: any) => multicast.skills.some((x: any) => x.id === s.id)));
  }
  return skills;
}

// --- From the choice to the formula, and back ---

export interface SimpleConditions {
  forcedElements: string[];
  ailmentImunity: string[];
  elementalResist: Record<string, number>;
  various: string[];
}

/** The goal chosen: a name (or `custom`), and its formula. */
export interface Goal {
  goal: string;
  formula: any;
}

/**
 * The formula of the choice of the goal select. `multicastSkillIds` are the skills chosen for each cast of a multicast
 * (`SKILL_<id>` values).
 */
export function resolveGoal(choice: string, unit: any, multicastSkillIds: string[] = []): Goal | null {
  if (!choice) return null;
  if (choice === 'LB') return { goal: 'custom', formula: formulaFromSkill(unit.lb) };
  if (choice === 'LB_REPLACED') {
    const lb = replacedLb(unit);
    if (!lb) return null;
    const formula = formulaFromSkill(lb);
    formula.lb = true;
    formula.replacedLb = true;
    return { goal: 'custom', formula };
  }
  if (choice.startsWith('SKILL_')) {
    return { goal: 'custom', formula: formulaFromSkill(getSkillFromId(choice.substring(6), unit)) };
  }
  if (choice.startsWith('MULTICAST_')) {
    const multicast = multicastEffect(getSkillFromId(choice.substring(10), unit));
    const skills: any[] = [];
    for (let i = 0; i < multicast.time; i++) {
      const skill = getSkillFromId(multicastSkillIds[i].substring(6), unit);
      skills.push(formulaFromSkill(skill, true));
    }
    return { goal: 'custom', formula: { type: 'multicast', skills } };
  }
  return { goal: choice, formula: formulaByGoal[choice] };
}

/** The goal formula with the chain multiplier and the simple conditions (resistances, immunities, ...) of the page. */
export function withConditions(formula: any, conditions: SimpleConditions, chainMultiplier: number | 'MAX'): any {
  if (!formula) return formula;
  if (chainMultiplier !== 1) {
    formula = { type: '*', value1: { type: 'chainMultiplier', value: chainMultiplier }, value2: formula };
  }
  return makeSureFormulaHaveSimpleConditions(formula, conditions);
}

/** `1,5` or `max`: the value of the chain multiplier input. */
export function parseChainMultiplier(text: string): number | 'MAX' {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) return 1;
  if (trimmed.toUpperCase() === 'MAX') return 'MAX';
  return parseFloat(trimmed) || 1;
}

/** The choice of the goal select that gives a formula (the page opened from a link or a saved team has the formula only). */
export function choiceFromFormula(
  goal: string | null,
  formula: any,
  unit: any,
  pots: { atk: number; mag: number },
): { choice: string; multicastSkills?: any[]; chainMultiplier?: number | 'MAX'; custom: boolean } {
  if (goal === 'custom' && formula && isSimpleFormula(formula)) {
    let base = formula;
    if (base.type === 'condition') base = base.formula;
    if (base.type === '*') base = base.value2;
    const chainMultiplier = getChainMultiplier(formula);
    if (base.type === 'skill') {
      if (base.lb) return { choice: base.replacedLb ? 'LB_REPLACED' : 'LB', chainMultiplier, custom: false };
      if (base.id && base.id !== '0') return { choice: `SKILL_${base.id}`, chainMultiplier, custom: false };
      return { choice: base.formulaName, chainMultiplier, custom: false };
    }
    if (base.type === 'multicast') {
      const skills = base.skills.map((s: any) => getSkillFromId(s.id, unit));
      const caster = getMulticastSkillAbleToMulticast(skills, unit);
      return {
        choice: caster ? `MULTICAST_${caster.id}` : 'physicalDamage',
        multicastSkills: skills,
        chainMultiplier,
        custom: false,
      };
    }
  }
  if (!goal) {
    if (pots.mag > pots.atk) return { choice: 'magicalDamage', custom: false };
    return { choice: hasMulticast(unit) ? 'physicalDamageMultiCast' : 'physicalDamage', custom: false };
  }
  if (goal !== 'custom') return { choice: goal, custom: false };
  let inner = formula;
  if (inner?.type === 'condition') inner = inner.formula;
  const known = Object.keys(formulaByGoal).find((key) => JSON.stringify(formulaByGoal[key]) === JSON.stringify(inner));
  if (formula && !isSimpleFormula(formula)) return { choice: known ?? 'physicalDamage', custom: true };
  return { choice: known ?? 'physicalDamage', custom: false };
}
