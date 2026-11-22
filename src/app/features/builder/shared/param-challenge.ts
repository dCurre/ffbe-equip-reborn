import { signal } from '@angular/core';
import type { UnitBuild } from '../../../../core/builder/unit-build';
import type { OwnedUnits } from '../../../shared/services/inventory';
import type { Toast } from '../../../shared/services/toast';
import { chooseGoal } from './build-inputs';
import type { BuilderState, BuilderUnit } from './builder-state';
import type { OptimizerRunner, RunCallbacks } from './optimizer-runner';
import type { UnitLoader } from './unit-loader';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

export type UnitPool = 'sevenStar' | 'potentialSevenStar' | 'rainbows';

/** A unit that is always allowed (the old page listed it by hand). */
const ALWAYS_ALLOWED = '306000804';

/** The challenges: a stat and the value to pass. */
export const CHALLENGES = [
  'HP_25500',
  'MP_1850',
  'ATK_2650',
  'DEF_1650',
  'MAG_2000',
  'SPR_1850',
  'HP_14000',
  'MP_1100',
  'ATK_1650',
  'DEF_1000',
  'MAG_1200',
  'SPR_1100',
].map((value) => ({ value, label: `${value.split('_')[0]} > ${value.split('_')[1]}` }));

/** The stat of a unit at its best before the equipment: maximum level, all the potting and the passive percent. */
export function baseValue(stat: string, unit: BuilderUnit): number {
  const base = unit.stats.maxStats[stat] + unit.stats.pots[stat];
  const percent = unit.skills?.[0]?.[`${stat}%`];
  return base * (1 + (percent ? percent / 100 : 0));
}

/** The units of the pool the user owns, the ones with the highest stat first (rainbows not at 7★ are tried in their 6★ form). */
export function candidateUnits(
  stat: string,
  pool: UnitPool,
  owned: OwnedUnits,
  units: Record<string, BuilderUnit>,
): string[] {
  const isSeven = (id: string): boolean => !!owned[id].sevenStar || id === ALWAYS_ALLOWED;
  const isPotentialSeven = (id: string): boolean => id.endsWith('5') && owned[id].number >= 2;
  const sixStar = (id: string): boolean =>
    pool === 'rainbows' &&
    id.endsWith('5') &&
    !(owned[id].sevenStar || owned[id].number >= 2) &&
    !!(units[id] as any)?.['6_form'];
  const value = (id: string): number => {
    const unit = id.endsWith('-6') ? (units[id.slice(0, -2)] as any)['6_form'] : units[id];
    return baseValue(stat, unit);
  };
  return Object.keys(owned)
    .filter((id) => units[id])
    .filter((id) => {
      if (pool === 'sevenStar') return isSeven(id);
      if (pool === 'potentialSevenStar') return isSeven(id) || isPotentialSeven(id);
      return id === ALWAYS_ALLOWED || (id.endsWith('5') && (owned[id].number >= 1 || !!owned[id].sevenStar));
    })
    .map((id) => (sixStar(id) ? `${id}-6` : id))
    .sort((a, b) => value(b) - value(a));
}

/**
 * The Parameter Challenges: tries the owned units, the strongest first, until one reaches the value of the challenge with
 * the items the user owns. "Find another way" goes on with the next unit.
 */
export class ParamChallenge {
  readonly challenge = signal(CHALLENGES[0].value);
  readonly pool = signal<UnitPool>('sevenStar');
  readonly running = signal(false);
  /** a unit was found: the next click looks for another one */
  readonly found = signal(false);

  private ids: string[] = [];
  private index = -1;
  private stat = '';
  private goal = 0;
  private best: { value: number; build: UnitBuild | null; id: string } = { value: 0, build: null, id: '' };

  constructor(
    private readonly s: BuilderState,
    private readonly loader: UnitLoader,
    private readonly runner: OptimizerRunner,
    private readonly toast: Toast,
    private readonly ownedUnits: () => OwnedUnits,
    /** starts the search for the unit of the tab, with these callbacks over the ones of the page */
    private readonly run: (callbacks: Partial<RunCallbacks>) => void,
  ) {}

  /** Another challenge or unit pool: the search starts again from the strongest unit. */
  reset(): void {
    this.index = -1;
    this.best = { value: 0, build: null, id: '' };
    this.found.set(false);
  }

  async find(): Promise<void> {
    if (this.running()) {
      this.runner.stop();
      this.running.set(false);
      this.toast.show('The calculation has been stopped.');
      return;
    }
    const [stat, goal] = this.challenge().split('_');
    this.stat = stat.toLowerCase();
    this.goal = parseInt(goal, 10);
    if (this.index < 0) {
      this.ids = candidateUnits(this.stat, this.pool(), this.ownedUnits(), this.s.units());
      this.best = { value: 0, build: null, id: '' };
    }
    this.running.set(true);
    await this.next();
  }

  private async next(): Promise<void> {
    if (this.index + 1 >= this.ids.length) return this.finish();
    this.index++;
    await this.loader.choose(this.ids[this.index]);
    chooseGoal(this.s, this.stat);
    this.run({
      onBetter: (build) => this.onBetter(build),
      onDone: () => void this.next(),
      onNoCombination: () => void this.next(),
      onConditionNotMet: () => undefined,
      onWeaponsSwitched: () => undefined,
    });
  }

  private onBetter(build: UnitBuild): void {
    this.s.tick.update((n) => n + 1);
    const value = build.buildValue.max;
    if (value > this.best.value) this.best = { value, build, id: this.ids[this.index] };
    if (value < this.goal) return;
    // any build over the value will do: stop at the first one
    this.runner.stop();
    this.runner.progress.set(100);
    this.running.set(false);
    this.found.set(true);
  }

  private async finish(): Promise<void> {
    const { value, build, id } = this.best;
    this.index = -1;
    this.running.set(false);
    this.found.set(false);
    if (!build) {
      this.toast.show('No unit to try for this challenge', 'warn');
      return;
    }
    this.toast.show(
      value >= this.goal
        ? 'No more possible builds. The best build found is displayed.'
        : 'Impossible to do the challenge. The best build found is displayed.',
    );
    await this.loader.choose(id);
    chooseGoal(this.s, this.stat);
    this.s.build.set(build);
    this.s.refresh();
  }
}
