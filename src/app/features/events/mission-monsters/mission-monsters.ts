import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MonsterTraits } from '../../../game/components/monster-traits/monster-traits';
import { Button } from '../../../shared/components/button/button';
import { Icon } from '../../../shared/components/icon/icon';
import { ServerContext } from '../../../shared/services/server-context';
import { STRINGS } from '../../../strings/en';
import { DungeonMonsters } from '../events-model';

const NUMBER = new Intl.NumberFormat('en');
const format = (value: number | null): string => (value === null ? '?' : NUMBER.format(value));

/** The monsters of a mission: stats, races and what they take. */
@Component({
  selector: 'app-mission-monsters',
  imports: [Button, Icon, MonsterTraits, RouterLink],
  templateUrl: './mission-monsters.html',
  styleUrl: './mission-monsters.css',
})
export class MissionMonsters {
  protected readonly t = STRINGS.events;
  protected readonly serverContext = inject(ServerContext);
  protected readonly stats = ['atk', 'def', 'mag', 'spr'] as const;
  /** the columns after the first one: HP, the stats, races and resistances */
  protected readonly emptyColumns = [1, 2, 3, 4, 5, 6, 7];
  readonly data = input.required<DungeonMonsters>();
  readonly mission = input.required<number>();

  /** the lists of monsters of the stage, each with its heading */
  protected readonly battles = computed(() =>
    this.sections(this.mission()).map(([title, list], section) => {
      const key = `${this.mission()}:${section}`;
      return { key, title, monsters: this.rows(list, key) };
    }),
  );
  /** how many battles the stage has when their monsters are not known, else 0 */
  protected readonly unsplit = computed(() => {
    const known = this.data().battles?.[this.mission()];
    return typeof known === 'number' ? known : 0;
  });

  /**
   * The battles of the stage in order when the monsters of each one are known, the groups the wiki tells apart, else
   * the whole stage as one list without a heading.
   */
  private sections(stage: number): [string, readonly number[]][] {
    const { missions, battles } = this.data();
    const known = battles?.[stage];
    const { battle, of } = this.t;
    if (Array.isArray(known)) {
      return known.map((list, i) => [known.length > 1 ? `${battle} ${i + 1} ${of} ${known.length}` : '', list]);
    }
    if (typeof known === 'object') {
      const { count, last, earlier, other } = known;
      const range = count > 2 ? `${this.t.battles} 1–${count - 1}` : `${battle} 1`;
      return [
        [`${range} ${of} ${count}, ${this.t.fromThese}`, earlier],
        [`${battle} ${count} ${of} ${count}`, last],
        ...(other ? [[this.t.battleNotKnown, other] as [string, number[]]] : []),
      ];
    }
    return [['', missions[stage] ?? []]];
  }

  /** the strongest first: the boss is at the top (unknown HP at the end) */
  private rows(list: readonly number[], battle: string) {
    const { monsters } = this.data();
    return list
      .map((index) => monsters[index])
      .sort((a, b) => (b.hp ?? -1) - (a.hp ?? -1))
      .map((monster, position) => {
        return {
          ...monster,
          // another stage draws new rows: reused ones would keep the old portrait and rebuild every list of icons
          key: `${battle}:${position}`,
          health: format(monster.hp),
          // what goes to the Builder: a monster with its stats, or at least with its resistances
          enemy: monster.def === null && !Object.keys(monster.traits).length ? null : monster,
          statsMissing: [monster.atk, monster.def, monster.mag, monster.spr].includes(null),
          values: this.stats.map((stat) => {
            const base = monster[stat];
            const buff = monster.buffs?.[stat];
            // the stat in battle, written when a passive raises it
            const total = buff && base !== null ? format(Math.floor((base * (100 + buff)) / 100)) : '';
            return { stat, base: format(base), buff, total };
          }),
        };
      });
  }
}
