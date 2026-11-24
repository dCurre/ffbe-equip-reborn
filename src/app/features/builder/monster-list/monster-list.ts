import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { elementList } from '../../../../core/constants/base-lists';
import { Item } from '../../../game/helpers/item';
import { ItemLine } from '../../../game/components/item-line/item-line';
import { ServerContext } from '../../../shared/services/server-context';
import { StaticData } from '../../../shared/services/static-data';
import { Button } from '../../../shared/components/button/button';
import { Combobox } from '../../../shared/components/combobox/combobox';
import { Icon } from '../../../shared/components/icon/icon';
import { Modal } from '../../../shared/components/modal/modal';
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

/** The group of events of a monster of the game data (`none` = no event found); the curated ones belong to a category instead. */
const groupOf = (monster: { [field: string]: unknown }): string | undefined =>
  monster['category'] ? undefined : ((monster['eventGroup'] as string | undefined) ?? 'none');

/** A monster of `monstersAll.json`: the curated ones have a `category` (`Recent`, `Espers`, ...), the others come from the game data. */
interface Monster {
  name: string;
  races: string[];
  atk: number;
  def: number;
  mag: number;
  spr: number;
  resist?: { name: string; percent: number }[];
  breakability?: Record<string, boolean>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [field: string]: any;
}

/** The list of the known monsters (a link and a dialog): choosing one fills the stats, races and resistances of the enemy. */
@Component({
  selector: 'app-monster-list',
  imports: [Button, Combobox, Icon, Modal, ItemLine, SearchBox, TabBar],
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
    return (this.bestiary.value() ?? []).map((monster, index) => ({ monster, name: names?.[index] || monster.name }));
  });
  /** the curated categories in the order of the file, then the groups of events of the monsters of the game data */
  protected readonly categories = computed<TabItem<string>[]>(() => {
    const monsters = this.bestiary.value() ?? [];
    const groups = new Set(monsters.map((monster) => groupOf(monster)));
    const titles: Record<string, string> = this.t.groups;
    return [
      ...[...new Set(monsters.map((monster) => monster['category'] as string | undefined))]
        .filter((name): name is string => !!name)
        .map((name) => ({ key: name, title: name })),
      ...GROUPS.filter((group) => groups.has(group)).map((group) => ({ key: GROUP + group, title: titles[group] })),
    ];
  });
  /** the category shown: the first one until another is chosen */
  protected readonly category = linkedSignal(() => this.categories()[0]?.key);
  /** the group of events shown, when the tab is one of the game data monsters */
  private readonly group = computed(() => (this.category()?.startsWith(GROUP) ? this.category().slice(GROUP.length) : undefined));
  protected readonly isGame = computed(() => this.group() !== undefined);
  protected readonly query = signal('');
  /** the event chosen in the group ('' = all of them); a new tab starts again from all */
  protected readonly event = linkedSignal<string, string>({ source: () => this.category(), computation: () => '' });
  /** the events of the group, the newest first (the ones without a date at the end) */
  protected readonly events = computed(() => {
    const released = new Map<string, string>();
    for (const { monster } of this.entries()) {
      if (groupOf(monster) === this.group() && monster['event']) released.set(monster['event'], monster['release'] ?? '');
    }
    return [...released].sort((a, b) => b[1].localeCompare(a[1]) || a[0].localeCompare(b[0])).map(([name]) => name);
  });
  private readonly matches = computed(() => {
    const text = this.query().trim().toLowerCase();
    const event = this.event();
    // the search finds the monster by its name in the language of the page and by the English one
    return this.entries().filter(
      ({ monster, name }) =>
        groupOf(monster) === this.group() &&
        (!event || monster['event'] === event) &&
        `${name} ${monster.name} ${monster['event'] ?? ''}`.toLowerCase().includes(text),
    );
  });
  protected readonly truncated = computed(() => this.isGame() && this.matches().length > MAX_ROWS);
  /** the monsters of the category, each with the item the line shows (a monster is shown like an item) */
  protected readonly rows = computed(() => {
    const category = this.category();
    const entries = this.isGame()
      ? this.matches().slice(0, MAX_ROWS)
      : this.entries().filter(({ monster }) => monster['category'] === category);
    return entries.map(({ monster, name }) => ({
      monster,
      // the monsters of the big list share names (levels, phases): the HP and the event tell them apart
      item: {
        ...monster,
        id: monster.name,
        name: this.isGame() ? this.label(monster, name) : name,
        // the wiki page is the English name, not the translated one
        wikiEntry: monster['wikiEntry'] ?? monster.name,
        type: 'monster',
        access: monster.races,
      } as Item,
    }));
  });

  private label(monster: Monster, name: string): string {
    const event = monster['event'] ? `, ${monster['event']}${monster['release'] ? ` ${monster['release']}` : ''}` : '';
    return `${name} (${HP_FORMAT.format(monster['hp'])} HP${event})`;
  }

  protected choose(monster: Monster): void {
    const s = this.s;
    const text = (value: unknown): string => (value ? String(value) : '');
    s.monster.set({ atk: text(monster.atk), mag: text(monster.mag), def: text(monster.def), spr: text(monster.spr) });
    s.monsterBuffs.set(Object.fromEntries(STATS.map((stat) => [stat, text(monster[`${stat}%`])])));
    s.monsterBreaks.set({});
    // the monsters without data about it cannot be broken
    s.monsterBreakability.set(Object.fromEntries(STATS.map((stat) => [stat, !!monster.breakability?.[stat]])));
    s.monsterResists.set(
      Object.fromEntries(
        elementList.map((element) => [
          element,
          // the big list gives the absorbed elements apart: they are 999 like in the curated ones
          monster['absorb']?.includes(element) ? '999' : text(monster.resist?.find((r) => r.name === element)?.percent),
        ]),
      ),
    );
    s.races.set(monster.races);
    s.refresh();
    this.open.set(false);
  }
}
