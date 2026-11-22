import { baseStats } from '../../../core/constants/base-lists';
import { Item } from '../models/item.model';

/**
 * The stats of an item as text, one entry per stat (`hp+120`, `atk+5%`, `total def+10`): the entries after the first one start
 * with a comma, so they read as one list. An Esper's stats grow with its bonus (up to x3).
 */
export function itemStats(item: Item): { stat: string; text: string }[] {
  const stats = item.type === 'monster' ? ['def', 'spr'] : baseStats;
  let coefficient = 1;
  if (item.type === 'esper' && item['esperStatsBonus']) {
    if (item['esperStatsBonus'].all) coefficient += item['esperStatsBonus'].all['hp'] / 100;
    if (item['esperStatsBonus'][item.id]) coefficient += item['esperStatsBonus'][item.id]['hp'] / 100;
    coefficient = Math.min(3, coefficient);
  }
  let started = false;
  return stats.map((stat) => {
    const texts: string[] = [];
    if (item[stat]) texts.push(`${stat}+${Math.floor(item[stat] * coefficient)}`);
    if (item[stat + '%']) texts.push(`${stat}+${item[stat + '%']}%`);
    if (item['staticStats']?.[stat]) texts.push(`total ${stat}+${item['staticStats'][stat]}`);
    const text = texts
      .map((value) => {
        const piece = started ? `, ${value}` : value;
        started = true;
        return piece;
      })
      .join('');
    return { stat, text };
  });
}
