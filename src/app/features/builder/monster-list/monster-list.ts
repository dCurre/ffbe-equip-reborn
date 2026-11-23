import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { elementList } from '../../../../core/constants/base-lists';
import { Item } from '../../../game/helpers/item';
import { ItemLine } from '../../../game/components/item-line/item-line';
import { ServerContext } from '../../../shared/services/server-context';
import { StaticData } from '../../../shared/services/static-data';
import { Button } from '../../../shared/components/button/button';
import { Icon } from '../../../shared/components/icon/icon';
import { Modal } from '../../../shared/components/modal/modal';
import { TabBar, TabItem } from '../../../shared/components/tab-bar/tab-bar';
import { StatePanel } from '../shared/state-panel';
import { STRINGS } from '../../../strings/en';

const STATS = ['atk', 'def', 'mag', 'spr'] as const;

/** A monster of `monsters.json`. */
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

/** The monsters by category (`Recent`, `Espers`, ...). */
type Bestiary = Record<string, Monster[]>;

/** The list of the known monsters (a link and a dialog): choosing one fills the stats, races and resistances of the enemy. */
@Component({
  selector: 'app-monster-list',
  imports: [Button, Icon, Modal, ItemLine, TabBar],
  templateUrl: './monster-list.html',
  styleUrl: './monster-list.css',
})
export class MonsterList extends StatePanel {
  protected readonly t = STRINGS.monsterList;
  private readonly server = inject(ServerContext).server;
  private readonly staticData = inject(StaticData);

  protected readonly open = signal(false);
  protected readonly bestiary = resource({
    params: () => this.server(),
    loader: () => this.staticData.get<Bestiary>('monsters'),
  });
  protected readonly categories = computed<TabItem<string>[]>(() =>
    Object.keys(this.bestiary.value() ?? {}).map((name) => ({ key: name, title: name })),
  );
  /** the category shown: the first one until another is chosen */
  protected readonly category = linkedSignal(() => this.categories()[0]?.key);
  /** the monsters of the category, each with the item the line shows (a monster is shown like an item) */
  protected readonly rows = computed(() =>
    (this.bestiary.value()?.[this.category()] ?? []).map((monster) => ({
      monster,
      item: { ...monster, id: monster.name, type: 'monster', access: monster.races } as Item,
    })),
  );

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
        elementList.map((element) => [element, text(monster.resist?.find((r) => r.name === element)?.percent)]),
      ),
    );
    s.races.set(monster.races);
    s.refresh();
    this.open.set(false);
  }
}
