import { baseStats } from '../../../core/constants/base-lists';
import { percentValues } from '../../../core/constants/stat-values';
import { typeList } from '../../../core/constants/item-types';
import { BoardNode, Killer, Resist, Stat } from './esper-model';

const WIKI = 'https://exvius.fandom.com/wiki/';

export interface ConditionalPart {
  icon: string;
  stats: string;
  equipment: string;
}

/** What a board node shows: its kind (the color), picture, text and SP cost. */
export interface NodeView {
  kinds: string[];
  icon?: string;
  text?: string;
  wiki?: string;
  resist?: Resist[];
  killers?: Killer[];
  conditional?: ConditionalPart[];
  cost: number;
}

const abilityIcon = (text: string): string | undefined => text.match(/ability_\d+\.png/)?.[0];
// [Bird Killer | Stat Break I | ability_79.png ] or [Bird Killer | ability_79.png]: the part inside the brackets, without the picture
const abilityName = (text: string): string => text.replace(/\|ability_\d+\.png/, '').replace(/\[|\]/g, '');

/** The same cases and the same priority as the old `showNode`: a later case replaces what the earlier ones showed. */
export function nodeView(node: BoardNode): NodeView {
  const view: NodeView = { kinds: [], cost: node.cost.SP };
  const show = (kind: string, content: Omit<NodeView, 'kinds' | 'cost'>) => {
    view.icon = content.icon;
    view.text = content.text;
    view.wiki = content.wiki;
    view.resist = content.resist;
    view.killers = content.killers;
    view.conditional = content.conditional;
    if (!view.kinds.includes(kind)) view.kinds.push(kind);
  };

  for (const stat of baseStats as Stat[]) {
    if (node[stat]) {
      show(stat, { text: `${stat.toUpperCase()} + ${node[stat]}` });
      break;
    }
    const percent = percentValues[stat];
    if (node[percent]) {
      show(stat, { icon: 'ability_77.png', text: `${stat.toUpperCase()} + ${node[percent]}%` });
      break;
    }
  }
  if (node.special) {
    const text = node.special[0].toString();
    const bracket = text.indexOf('[');
    const ability = text.substring(bracket, bracket + text.indexOf(':'));
    show('ability', { icon: abilityIcon(ability), text: abilityName(ability) });
  }
  if (node.resist) show('resist', { resist: node.resist });
  if (node.killers) show('killer', { killers: node.killers });
  if (node.esperStatsBonus) {
    show('ability', { icon: 'ability_77.png', text: 'ST Reflection Boost', wiki: 'ST_Reflection_Boost' });
  }
  if (node.lbPerTurn)
    show('ability', { icon: 'ability_91.png', text: `+${node.lbPerTurn.min} LS/turn`, wiki: 'Auto-Limit' });
  if (node.lbFillRate) show('ability', { icon: 'ability_78.png', text: `+${node.lbFillRate}% LB fill rate` });
  if (node.lbDamage) show('ability', { icon: 'ability_78.png', text: `+${node.lbDamage}% LB damage` });
  if (node.evade?.physical) {
    show('ability', { icon: 'ability_97.png', text: `${node.evade.physical}% physical evasion`, wiki: 'Air_Step' });
  }
  if (node.evade?.magical) {
    show('ability', { icon: 'ability_97.png', text: `${node.evade.magical}% magical evasion`, wiki: 'Air_Wall' });
  }
  if (node.jumpDamage) show('ability', { icon: 'ability_80.png', text: `+${node.jumpDamage}% jump damage` });
  if (node.conditional) {
    const parts = node.conditional
      .filter((c) => c.equipedCondition && typeList.includes(c.equipedCondition))
      .map((c) => ({
        icon: c.icon as string,
        equipment: c.equipedCondition as string,
        stats: baseStats
          .filter((stat) => c[`${stat}%`])
          .map((stat) => `${stat.toUpperCase()}+${c[`${stat}%`]}%`)
          .join(', '),
      }));
    show('ability', { conditional: parts });
  }
  if (view.wiki) view.wiki = WIKI + view.wiki;
  return view;
}
