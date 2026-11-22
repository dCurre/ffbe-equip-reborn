import { chainFamilySkillName } from '../../../core/constants/game-ids';
import { elementList } from '../../../core/constants/base-lists';
import { typeList } from '../../../core/constants/item-types';
import type { SkillUnit } from './unit-search-model';

/* eslint-disable @typescript-eslint/no-explicit-any -- the skill data of the units has no fixed shape */

/** The items by id, to name the items a skill needs to be equipped. */
export type ItemsById = Readonly<Record<string, { name: string; icon?: string }>>;

/** The kinds of damage of a skill, as the equipment picture that stands for each one. */
export function damageIcons(effects: any[]): string[] {
  const icons: string[] = [];
  for (const { effect } of effects) {
    if (!effect?.damage) continue;
    const icon = { physical: 'sword', magical: 'rod', hybrid: 'hybrid' }[effect.damage.mechanism as string];
    if (icon && !icons.includes(icon)) icons.push(icon);
  }
  return icons;
}

export function innateElements(effects: any[]): string[] {
  const elements: string[] = [];
  for (const { effect } of effects) {
    for (const element of effect?.damage?.elements ?? []) if (!elements.includes(element)) elements.push(element);
  }
  return elements;
}

/** The chain family and the chain tag of a skill. */
export function chainFamilies(skill: any): { title: string; label: string }[] {
  const families: { title: string; label: string }[] = [];
  if (skill.chainFamily) {
    families.push({
      title: (chainFamilySkillName as Record<string, string>)[skill.chainFamily],
      label: skill.chainFamily,
    });
  }
  if (skill.chainTag) families.push({ title: 'Chain Tag', label: 'Chain Tag' });
  return families;
}

/** The stat a damage skill uses when it is not the usual one, and the stat of the monster it damages when that is not the usual one. */
export function strangeStats(effects: any[]): { stat: string; monsterStat?: string } | null {
  for (const { effect } of effects) {
    const damage = effect?.damage;
    if (!damage) continue;
    const use: string | undefined = damage.use?.stat;
    if (damage.mechanism === 'physical') {
      if (damage.damageType === 'mind') return { stat: use ?? 'MAG', monsterStat: 'SPR' };
      if (use) return { stat: use };
    } else if (damage.mechanism === 'magical') {
      if (damage.damageType === 'body') return { stat: use ?? 'ATK', monsterStat: 'DEF' };
      if (use) return { stat: use };
    }
  }
  return null;
}

const unlockedBySkill = (skillId: string, effects: any[], name: string): string[] => {
  const lines: string[] = [];
  for (const { effect } of effects) {
    const gain = effect?.gainSkills;
    if (!gain?.skills.map((s: any) => s.id).includes(skillId)) continue;
    lines.push(`Unlocked by ${name} for ${gain.turns === 0 ? 'current turn' : `${gain.turns} turn(s)`}`);
  }
  return lines;
};

/** What unlocks a skill: a limit burst or a skill that gives it for some turns, an auto cast, a replaced attack. */
export function unlockLines(skillId: string, unlockers: string[], unit: SkillUnit): string[] {
  const lines: string[] = [];
  for (const id of unlockers) {
    if (id === 'lb') {
      lines.push(...unlockedBySkill(skillId, unit.lb.maxEffects, 'LB'));
      continue;
    }
    for (const skill of unit.actives.filter((s) => s.id === id)) {
      lines.push(...unlockedBySkill(skillId, skill.effects, skill.name));
    }
    for (const skill of unit.actives.filter((s) => s.effects[0].effect?.cooldownSkill?.id === id)) {
      const cooldown = skill.effects[0].effect.cooldownSkill;
      lines.push(...unlockedBySkill(skillId, cooldown.effects, cooldown.name));
    }
    for (const skill of unit.passives.filter((s) => s.id === id)) {
      for (const { effect } of skill.effects) {
        if (effect?.autoCastedSkill?.id === skillId) lines.push(`Autocasted at start of battle by ${skill.name}`);
        if (effect?.replaceNormalAttack?.id === skillId) lines.push('Replace normal attack');
      }
    }
  }
  return lines;
}

export function ifUsedAfter(skills: any[], unit: SkillUnit): string {
  const names = skills
    .map((s) => s.id)
    .map((id) => unit.actives.find((s) => s.id === id)?.name ?? 'unknown skill')
    .join(', ');
  return `If used after ${names}`;
}

const TARGETS: Record<string, Record<string, string>> = {
  SELF: { '': ' to self' },
  ENEMY: { ST: ' to one enemy', AOE: ' to all enemies', RND: ' to one random enemy' },
  ALLY: { ST: ' to one ally', AOE: ' to all allies', RND: ' to one random ally' },
  ALLY_BUT_SELF: { ST: ' to one ally but self', AOE: ' to all allies but self', RND: ' to one random ally but self' },
  ANY: { ST: ' to one target', AOE: ' to all allies or enemies' },
};

export function turnsAndTargets(effect: any): string {
  const target = TARGETS[effect.target];
  return (
    (effect.turns ? ` for ${effect.turns} turns` : '') +
    (target ? (effect.target === 'SELF' ? target[''] : (target[effect.area] ?? '')) : '')
  );
}

/** The resistances an effect gives, grouped by value; each one is an element or an ailment. */
export function resistGroups(effect: any): { value: string; resists: { name: string; element: boolean }[] }[] {
  const byValue: Record<string, string[]> = {};
  for (const resist of effect.resist) (byValue[resist.percent] ??= []).push(resist.name);
  return Object.keys(byValue)
    .sort()
    .map((value) => ({
      value,
      resists: byValue[value].map((name) => ({ name, element: elementList.includes(name) })),
    }));
}

export type ConditionPart = { type: string } | { element: string } | { items: { name: string; icon?: string }[] };

/** What a skill needs to be equipped: a type of equipment, an element, or one of some items. */
export function conditionParts(conditions: any[], itemsById: ItemsById): ConditionPart[] {
  const item = (id: string): { name: string; icon?: string } => itemsById[`${id}-1`] ?? itemsById[id];
  return conditions.map((condition) => {
    if (typeList.includes(condition)) return { type: condition };
    if (elementList.includes(condition)) return { element: condition };
    if (Array.isArray(condition)) return { items: condition.map((id: string) => item(id)) };
    return { items: [itemsById[condition]] };
  });
}
