import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MonsterTraits } from '../../../game/components/monster-traits/monster-traits';
import { Button } from '../../../shared/components/button/button';
import { Icon } from '../../../shared/components/icon/icon';
import { ServerContext } from '../../../shared/services/server-context';
import { STRINGS } from '../../../strings/en';
import { DungeonMonsters } from '../bestiary-model';

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
  protected readonly t = STRINGS.bestiary;
  protected readonly serverContext = inject(ServerContext);
  protected readonly stats = ['atk', 'def', 'mag', 'spr'] as const;
  readonly data = input.required<DungeonMonsters>();
  readonly mission = input.required<number>();

  /** the strongest first: the boss is at the top (unknown HP at the end) */
  protected readonly monsters = computed(() => {
    const { monsters, missions } = this.data();
    const stage = this.mission();
    return (missions[stage] ?? [])
      .map((index) => monsters[index])
      .sort((a, b) => (b.hp ?? -1) - (a.hp ?? -1))
      .map((monster, position) => {
        return {
          ...monster,
          // another stage draws new rows: reused ones would keep the old portrait and rebuild every list of icons
          key: `${stage}:${position}`,
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
  });
}
