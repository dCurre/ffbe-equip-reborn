import { booleanAttribute, Component, input } from '@angular/core';
import { ResistEntry, ResistList } from '../resist-list/resist-list';
import { Icon } from '../../../shared/components/icon/icon';
import { STRINGS } from '../../../strings/en';

/** What a row of `monstersAll.json` (or `dungeonMonsters.json`) says about the monster (`traits`), ready to print: the names are those of the icons. */
export interface Traits {
  /** the elements absorbed */
  absorb?: string[];
  /** the resistances of the elements (`noElement` too) and the weaknesses (negative) */
  resist?: ResistEntry[];
  weak?: ResistEntry[];
  /** the resistance to statuses and to the break of stats: the icons (`ailment-blind`, `ailment-break_mag`) and the percent */
  statusResist?: { icons: string[]; percent: number }[];
  /** the stats that can be broken */
  break?: string[];
  /** the icons of what the monster is immune to; `title` says it when the icon alone does not */
  immune?: { icon: string; title?: string }[];
  vulnerable?: { name: string; percent?: number }[];
  /** what has no icon, as text */
  notes?: string[];
}

/** What a monster takes: the elements it absorbs, resists and is weak to, the stats that can be broken, what it is immune to. */
@Component({
  selector: 'app-monster-traits',
  imports: [Icon, ResistList],
  host: { class: 'td', '[class.compact]': 'compact()' },
  templateUrl: './monster-traits.html',
  styleUrl: './monster-traits.css',
})
export class MonsterTraits {
  protected readonly t = STRINGS.monsterTraits;
  readonly traits = input<Traits>();
  /** smaller icons and labels, for a dense table */
  readonly compact = input(false, { transform: booleanAttribute });
}
