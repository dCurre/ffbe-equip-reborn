import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { elementList } from '../../../../core/constants/base-lists';
import { Item } from '../../../game/helpers/item';
import { ItemAccess } from '../../../game/components/item-access/item-access';
import { ItemName } from '../../../game/components/item-name/item-name';
import { MonsterTraits, Traits } from './monster-traits/monster-traits';
import { ServerContext } from '../../../shared/services/server-context';
import { StaticData } from '../../../shared/services/static-data';
import { Button } from '../../../shared/components/button/button';
import { Combobox } from '../../../shared/components/combobox/combobox';
import { Icon } from '../../../shared/components/icon/icon';
import { Modal } from '../../../shared/components/modal/modal';
import { WikiLink } from '../../../shared/components/wiki-link/wiki-link';
import { SearchBox } from '../../../shared/components/search-box/search-box';
import { TabBar, TabItem } from '../../../shared/components/tab-bar/tab-bar';
import { StatePanel } from '../shared/state-panel';
import { STRINGS } from '../../../strings/en';

const STATS = ['atk', 'def', 'mag', 'spr'] as const;
/** The tab keys of the game data monsters start with this; the curated ones are the names of their category. */
const GROUP = 'group:';
const GROUPS = ['permanent', 'season1', 'season2', 'season3', 'season4', 'collaborations', 'none'];
/** The big list is long: only the first matches are drawn. */
const MAX_ROWS = 100;
const HP_FORMAT = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

/** The tabs that come first in the bar, in this order; the rest follows (the other curated categories, then the groups of events). */
const FIRST = [
  'C. of the Fallen',
  'C. of the Indignant (Scorns)',
  'C. of the Vengeful',
  'C. of Arms',
  'Advent of Purgatory',
  'Dark Visions',
  'Clash of Wills',
];

/**
 * One place of a monster: the `tab` it is listed in, the `trial` (the trial or event chosen inside the tab), the `dungeon` (the text of
 * the column) with its wiki page, and the release of the trial or event.
 */
interface Location {
  tab: string;
  trial: string;
  dungeon: string;
  dungeonPage?: string;
  release?: string;
}

/**
 * A monster of `monstersAll.json`: the curated ones have a `category` (`Recent`, `Espers`, ...), the others come from the game data.
 * It is one entry per boss: `locations` are all the dungeons where it appears, and the list shows it in each of them.
 */
interface Monster {
  name: string;
  races: string[];
  atk: number;
  def: number;
  mag: number;
  spr: number;
  traits?: Traits;
  locations: Location[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [field: string]: any;
}

/** The list of the known monsters (a link and a dialog): choosing one fills the stats, races and resistances of the enemy. */
@Component({
  selector: 'app-monster-list',
  imports: [Button, Combobox, Icon, Modal, ItemAccess, ItemName, MonsterTraits, SearchBox, TabBar, WikiLink],
  templateUrl: './monster-list.html',
  styleUrl: './monster-list.css',
})
export class MonsterList extends StatePanel {
  protected readonly t = STRINGS.monsterList;
  private readonly context = inject(ServerContext);
  private readonly server = this.context.server;
  private readonly staticData = inject(StaticData);

  protected readonly open = signal(false);
  /** the list (`monstersAll.json`, over 1 MB) is downloaded when the dialog is opened */
  protected readonly bestiary = resource({
    params: () => (this.open() ? this.server() : undefined),
    loader: () => this.staticData.get<Monster[]>('monstersAll'),
  });
  /** the names in the language of the page (`monstersAll_fr.json`...): one per monster of the list, empty where the English name stays */
  private readonly translated = resource({
    params: () => (this.open() && this.context.language() !== 'en' ? this.context.language() : undefined),
    loader: () => this.staticData.get<string[]>('monstersAll', true),
  });
  private readonly entries = computed(() => {
    const names = this.translated.value();
    return (this.bestiary.value() ?? []).flatMap((monster, index) =>
      monster.locations.map((location) => ({ monster, name: names?.[index] || monster.name, location })),
    );
  });
  /** the Chamber and event tabs first, the other curated categories in the order of the file, then the groups of events of the game data */
  protected readonly categories = computed<TabItem<string>[]>(() => {
    const tabs = new Set(this.entries().map(({ location }) => location.tab));
    const titles: Record<string, string> = this.t.groups;
    const named = new Set([...FIRST, ...tabs].filter((tab) => tabs.has(tab) && !tab.startsWith(GROUP)));
    return [
      ...[...named].map((name) => ({ key: name, title: name })),
      ...GROUPS.filter((group) => tabs.has(GROUP + group)).map((group) => ({ key: GROUP + group, title: titles[group] })),
    ];
  });
  /** the category shown: the first one until another is chosen */
  protected readonly category = linkedSignal(() => this.categories()[0]?.key);
  protected readonly query = signal('');
  /** the trial or event chosen in the tab ('' = all of them); a new tab starts again from all */
  protected readonly event = linkedSignal<string, string>({ source: () => this.category(), computation: () => '' });
  /** the trials or events of the tab, the newest first (the ones without a date at the end) */
  protected readonly events = computed(() => {
    const released = new Map<string, string>();
    for (const { location } of this.entries()) {
      const trial = location.trial;
      if (location.tab !== this.category() || !trial) continue;
      const known = released.get(trial);
      const release = location.release ?? '';
      // a trial is as old as its first release (a rerun has a later date)
      if (known === undefined || (release && (!known || release < known))) released.set(trial, release);
    }
    return [...released].sort((a, b) => b[1].localeCompare(a[1]) || a[0].localeCompare(b[0])).map(([name]) => name);
  });
  private readonly matches = computed(() => {
    const text = this.query().trim().toLowerCase();
    const event = this.event();
    const category = this.category();
    // the search finds the monster by its name in the language of the page and by the English one
    const found = this.entries().filter(
      ({ monster, name, location }) =>
        location.tab === category &&
        (!event || location.trial === event) &&
        `${name} ${monster.name} ${location.dungeon}`.toLowerCase().includes(text),
    );
    // newest first, the undated last; the other curated categories keep the order of the file
    return FIRST.includes(category) || !!category?.startsWith(GROUP)
      ? found.sort((a, b) => (b.location.release ?? '').localeCompare(a.location.release ?? ''))
      : found;
  });
  protected readonly truncated = computed(() => this.matches().length > MAX_ROWS);
  /** the monsters of the category, each with the item the line shows (a monster is shown like an item) */
  protected readonly rows = computed(() => {
    return this.matches().slice(0, MAX_ROWS).map(({ monster, name, location }) => ({
      monster,
      location,
      where: { text: location.dungeon, page: location.dungeonPage },
      // the monsters of the big list share names (levels, phases): the HP tells them apart
      item: {
        ...monster,
        id: monster.name,
        name: monster['category'] ? name : this.label(monster, name),
        type: 'monster',
        access: monster.races,
      } as Item,
    }));
  });

  private label(monster: Monster, name: string): string {
    return `${name} (${HP_FORMAT.format(monster['hp'])} HP)`;
  }

  protected choose(monster: Monster): void {
    const s = this.s;
    const text = (value: unknown): string => (value ? String(value) : '');
    s.monster.set({ atk: text(monster.atk), mag: text(monster.mag), def: text(monster.def), spr: text(monster.spr) });
    s.monsterBuffs.set(Object.fromEntries(STATS.map((stat) => [stat, text(monster[`${stat}%`])])));
    s.monsterBreaks.set({});
    // the monsters without data about it cannot be broken
    s.monsterBreakability.set(Object.fromEntries(STATS.map((stat) => [stat, !!monster.traits?.break?.includes(stat)])));
    s.monsterResists.set(
      Object.fromEntries(
        elementList.map((element) => [
          element,
          // the absorbed elements are 999 in the Builder
          monster.traits?.absorb?.includes(element)
            ? '999'
            : text([...(monster.traits?.resist ?? []), ...(monster.traits?.weak ?? [])].find((r) => r.name === element)?.percent),
        ]),
      ),
    );
    s.races.set(monster.races);
    s.refresh();
    this.open.set(false);
  }
}
