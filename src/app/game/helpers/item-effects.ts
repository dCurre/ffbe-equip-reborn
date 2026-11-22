import { baseStats, typeList } from '../../../core/constants';
import { KillerEntry } from '../components/killer-list/killer-list';
import { ResistEntry } from '../components/resist-list/resist-list';
import { Item } from './item';

/** A piece of one effect line: plain text, an equipment picture, a skill, a text of the data with `[name|icon]` links... */
export type EffectPart =
  | { type: 'text'; text: string }
  | { type: 'equipment'; name: string }
  | { type: 'upper'; text: string }
  | { type: 'gameText'; text: string }
  | { type: 'skill'; icon: string; name: string; description: string };

/** One special effect of an item, ready to be drawn by `ItemSpecial`. */
export type ItemEffect =
  | { kind: 'elements'; elements: string[] }
  | { kind: 'inflict'; entries: ResistEntry[] }
  | { kind: 'resist'; entries: ResistEntry[] }
  | { kind: 'killers'; killers: KillerEntry[] }
  | { kind: 'conditional'; icon: string; stats: string; equipment: string }
  | { kind: 'line'; parts: EffectPart[]; skill: boolean };

interface SkillData {
  icon: string;
  name: string;
  effects: { desc: string }[];
}

const text = (value: string): EffectPart => ({ type: 'text', text: value });
const line = (...parts: (EffectPart | string)[]): ItemEffect => ({
  kind: 'line',
  parts: parts.map((part) => (typeof part === 'string' ? text(part) : part)),
  skill: false,
});
const skillPart = (skill: SkillData): EffectPart => ({
  type: 'skill',
  icon: skill.icon,
  name: skill.name,
  description: skill.effects.map((effect) => effect.desc).join(', '),
});

function wielding(item: Item, key: string, suffix: string): ItemEffect[] {
  const values = item[key];
  if (!values) return [];
  return baseStats
    .filter((stat) => values[stat])
    .map((stat) => line(`Increase equipment ${stat.toUpperCase()} (${values[stat]}%) ${suffix}`));
}

function conditionals(item: Item): ItemEffect[] {
  const conditions: Record<string, unknown>[] = item['conditional'] ?? [];
  return conditions
    .filter((c) => c['equipedCondition'] && typeList.includes(c['equipedCondition'] as string))
    .map((c): ItemEffect => ({
      kind: 'conditional',
      icon: c['icon'] as string,
      stats: baseStats
        .filter((s) => c[s + '%'])
        .map((s) => `${s.toUpperCase()}+${c[s + '%']}%`)
        .join(', '),
      equipment: c['equipedCondition'] as string,
    }));
}

/** Every special effect of the item, in the order the old site showed them: elements, resists, killers, skills, masteries... */
export function itemEffects(item: Item): ItemEffect[] {
  const effects: ItemEffect[] = [];
  if (item['element']) effects.push({ kind: 'elements', elements: item['element'] });
  if (item['ailments']) effects.push({ kind: 'inflict', entries: item['ailments'] });
  if (item['resist']) effects.push({ kind: 'resist', entries: item['resist'] });
  if (item['killers']) effects.push({ kind: 'killers', killers: item['killers'] });
  if (item['special']?.includes('dualWield')) {
    effects.push({ kind: 'line', parts: [{ type: 'gameText', text: '[Dual Wield|ability_72.png]' }], skill: true });
  }
  if (item['partialDualWield']) {
    effects.push({
      kind: 'line',
      parts: [
        { type: 'gameText', text: '[Dual Wield|ability_72.png] of ' },
        ...item['partialDualWield'].map((name: string): EffectPart => ({ type: 'equipment', name })),
      ],
      skill: true,
    });
  }
  if (item['allowUseOf']) {
    const types: string[] = Array.isArray(item['allowUseOf']) ? item['allowUseOf'] : [item['allowUseOf']];
    effects.push(
      line(
        'Allow use of ',
        ...types.flatMap((name, i): EffectPart[] => [...(i ? [text(', ')] : []), { type: 'equipment', name }]),
      ),
    );
  }
  effects.push(...conditionals(item));
  if (item['evade']?.physical) effects.push(line(`Evade physical attacks ${item['evade'].physical}%`));
  if (item['evade']?.magical) effects.push(line(`Evade magical attacks ${item['evade'].magical}%`));
  effects.push(...wielding(item, 'singleWielding', 'when single wielding'));
  effects.push(...wielding(item, 'singleWieldingOneHanded', 'when single wielding a one-handed weapon'));
  effects.push(...wielding(item, 'dualWielding', 'when dual wielding'));
  effects.push(...wielding(item, 'oneWeaponMastery', 'when single wielding any weapon with or without shield'));
  if (item['chainMastery']) effects.push(line(`Increase chain modifier cap (${item['chainMastery']}%)`));
  if (item['accuracy']) effects.push(line(`Increase Accuracy (${item['accuracy']}%)`));
  if (item['singleWielding']?.accuracy) {
    effects.push(line(`Increase Accuracy (${item['singleWielding'].accuracy}%) when single wielding`));
  }
  if (item['singleWieldingOneHanded']?.accuracy) {
    effects.push(
      line(
        `Increase Accuracy (${item['singleWieldingOneHanded'].accuracy}%) when single wielding a one-handed wreapon`,
      ),
    );
  }
  if (item['damageVariance']) {
    const { min, max } = item['damageVariance'];
    effects.push(line(`Damage variance from x${min} to x${max} (average : x${(min + max) / 2})`));
  }
  if (item['mpRefresh']) effects.push(line(`Recover MP (${item['mpRefresh']}%) per turn`));
  if (item['jumpDamage']) effects.push(line(`Increase damage dealt by jump attacks by ${item['jumpDamage']}%`));
  if (item['lbFillRate']) effects.push(line(`Increase LB gauge fill rate (${item['lbFillRate']}%)`));
  if (item['lbDamage']) effects.push(line(`Increase LB damage (+${item['lbDamage']}%)`));
  if (item['lbPerTurn']) {
    const { min, max } = item['lbPerTurn'];
    effects.push(line(`Increase LB gauge each turn (${min === max ? min : `${min}-${max}`})`));
  }
  if (item['evoMag']) effects.push(line(`Increase Esper summon damage by ${item['evoMag']}%`));
  for (const esper of Object.keys(item['esperStatsBonus'] ?? {})) {
    const hp = item['esperStatsBonus'][esper].hp;
    effects.push(
      line(esper === 'all' ? `Increase esper's bonus stats (${hp}%)` : `Increase ${esper}'s bonus stats (${hp}%)`),
    );
  }
  if (item['drawAttacks']) effects.push(line(`+${item['drawAttacks']}% draw attacks`));
  const breakability = item['breakability'];
  if (breakability && (breakability.atk || breakability.def || breakability.mag || breakability.spr)) {
    effects.push(
      line('Vulnerable to ', { type: 'upper', text: baseStats.filter((s) => breakability[s]).join('/') }, ' breaks'),
    );
  }
  if (item['guts']) {
    const { chance, ifHpOver, time } = item['guts'];
    effects.push(
      line(`${chance}% chance to set HP to 1 upon fatal damage, if HP was above ${ifHpOver}% (max ${time} times)`),
    );
  }
  for (const key of Object.keys(item['evokeDamageBoost'] ?? {})) {
    const value = item['evokeDamageBoost'][key];
    effects.push(
      line(key === 'all' ? `+${value}% damage for esper summons and evoke skills` : `+${value}% ${key} summon damage`),
    );
  }
  for (const counter of item['counterSkills'] ?? []) {
    effects.push(
      line(
        `Counter ${counter.counter} damage with `,
        skillPart(counter.skill),
        counter.maxTime ? ` (max ${counter.maxTime}/turn)` : '',
      ),
    );
  }
  for (const skill of item['skills'] ?? []) effects.push({ kind: 'line', parts: [skillPart(skill)], skill: true });
  for (const skill of item['autoCastedSkills'] ?? []) {
    effects.push(line('Cast at start of battle or when revived: ', skillPart(skill)));
  }
  for (const entry of item['startOfTurnSkills'] ?? []) {
    effects.push(line('Cast at start of turn: ', skillPart(entry.skill)));
  }
  for (const value of item['special'] ?? []) {
    if (!['twoHanded', 'notStackable', 'dualWield'].includes(value)) {
      effects.push({ kind: 'line', parts: [{ type: 'gameText', text: value }], skill: false });
    }
  }
  return effects;
}
