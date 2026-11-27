import { elementList } from '../../../../core/constants/base-lists';
import type { Traits } from '../../../game/components/monster-traits/monster-traits';
import type { BuilderState } from './builder-state';

const STATS = ['atk', 'def', 'mag', 'spr'] as const;
/** The buffs of the enemy, in percent. */
export type EnemyBuffs = Partial<Record<(typeof STATS)[number], number>>;

/** A monster as the Builder takes it from the Bestiary. */
export interface Enemy {
  name: string;
  atk?: number | null;
  def?: number | null;
  mag?: number | null;
  spr?: number | null;
  races: string[];
  traits?: Traits;
}

/**
 * Makes the monster the enemy of the build: stats, buffs, breaks allowed, element resistances and races. With
 * `breakUnknown` a monster that says nothing about the breaks keeps them allowed, else it cannot be broken.
 */
export function setEnemy(s: BuilderState, enemy: Enemy, buffs: EnemyBuffs, breakUnknown = false): void {
  const text = (value: unknown): string => (value ? String(value) : '');
  const { traits } = enemy;
  s.monster.set({ atk: text(enemy.atk), mag: text(enemy.mag), def: text(enemy.def), spr: text(enemy.spr) });
  s.monsterBuffs.set(Object.fromEntries(STATS.map((stat) => [stat, text(buffs[stat])])));
  s.monsterBreaks.set({});
  s.monsterBreakability.set(
    Object.fromEntries(
      STATS.map((stat) => [stat, breakUnknown && !traits?.break ? true : !!traits?.break?.includes(stat)]),
    ),
  );
  s.monsterResists.set(
    Object.fromEntries(
      elementList.map((element) => [
        element,
        // the absorbed elements are 999 in the Builder
        traits?.absorb?.includes(element)
          ? '999'
          : text([...(traits?.resist ?? []), ...(traits?.weak ?? [])].find((r) => r.name === element)?.percent),
      ]),
    ),
  );
  s.races.set(enemy.races);
  s.refresh();
}
