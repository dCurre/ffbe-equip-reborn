import { signal } from '@angular/core';
import { DataStorage } from '../../../../core/builder/data-storage';
import { OptimizerRequest, OptimizerResponse } from '../../../../core/builder/optimizer-session';
import { TypeCombinationGenerator } from '../../../../core/builder/type-combination-generator';
import { UnitBuild } from '../../../../core/builder/unit-build';
import { getValue, isTwoHanded } from '../../../../core/builder/item-values';
import { calculateStatValue, getEquipmentStatBonus, getStatBonusCap } from '../../../../core/builder/stat-calculation';
import { baseStats } from '../../../../core/constants/base-lists';
import { percentValues } from '../../../../core/constants/stat-values';
import { weaponList } from '../../../../core/constants/item-types';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

export interface RunOptions {
  forceDoubleHand: boolean;
  forceDualWield: boolean;
  tryEquipSources: boolean;
  forceTmrAbility: boolean;
  server: string;
  espers: Record<string, any>;
  enemyStats: any;
  monsterAttackFormula: any;
  goalVariation: string;
  /** after the search, tries again to free the overcap in favor of this stat (null: no second search) */
  reduceOvercapStat: string | null;
}

export interface RunCallbacks {
  /** a better build was found: show it */
  onBetter(build: UnitBuild): void;
  /** the run is over (or was stopped) */
  onDone(): void;
  /** the rules chosen leave no build to try */
  onNoCombination(): void;
  /** every combination was tried and the goal has a condition that no build meets */
  onConditionNotMet(): void;
  /** the weapons were in the other hands in the best build */
  onWeaponsSwitched(): void;
}

/**
 * The pool of Web Workers that look for the best build of a unit: it sends them the data and the type combinations of
 * the equipment, keeps the best build they find, and reports the progress.
 */
export class OptimizerRunner {
  readonly running = signal(false);
  readonly progress = signal(0);
  readonly builds = signal(0);

  private workers: Worker[] = [];
  private workerWorkingCount = 0;
  private remaining: any[] = [];
  private total = 0;
  private processed = 0;
  private chunkSize = 2;
  private build: UnitBuild | null = null;
  private callbacks: RunCallbacks | null = null;
  private options: RunOptions | null = null;
  private pinnedWeapons: any[] = [];
  private itemsToExclude: string[] = [];
  /** the fixed items and the goal of the first search, while the search to reduce the overcap runs */
  private saved: { fixedItems: any[]; formula: any } | null = null;

  constructor(private readonly dataStorage: DataStorage) {}

  /** The number of workers: half of the processor cores, at least one (4 when the browser does not tell). */
  static defaultWorkerCount(): number {
    return navigator.hardwareConcurrency ? Math.max(1, Math.floor(navigator.hardwareConcurrency / 2)) : 4;
  }

  /** Starts `count` new workers (the previous ones are stopped) that know every version of the items. */
  init(count: number, itemEnchantments: unknown): void {
    this.terminate();
    for (let i = 0; i < count; i++) {
      const worker = new Worker(new URL('../../../../core/builder/optimizer.worker', import.meta.url), {
        type: 'module',
      });
      this.send(worker, {
        type: 'init',
        allItemVersions: this.dataStorage.itemWithVariation,
        number: i,
        itemEnchantments,
      });
      worker.onmessage = (event: MessageEvent<string>) => this.onMessage(JSON.parse(event.data) as OptimizerResponse);
      this.workers.push(worker);
    }
  }

  private terminate(): void {
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
  }

  private send(worker: Worker, message: OptimizerRequest): void {
    worker.postMessage(JSON.stringify(message));
  }

  /** Looks for the best build of the unit (its fixed items stay). */
  run(build: UnitBuild, options: RunOptions, callbacks: RunCallbacks, itemsToExclude: string[]): void {
    this.build = build;
    this.callbacks = callbacks;
    this.options = options;
    this.itemsToExclude = itemsToExclude;
    this.saved = null;
    this.begin();
  }

  /** Sends the data to the workers and starts feeding them the type combinations. */
  private begin(): void {
    const build = this.build!;
    const options = this.options!;
    const callbacks = this.callbacks!;
    const itemsToExclude = this.itemsToExclude;
    this.running.set(true);
    this.progress.set(0);
    this.builds.set(0);
    this.dataStorage.setUnitBuild(build);
    this.dataStorage.itemsToExclude = itemsToExclude;
    this.dataStorage.prepareData(itemsToExclude, options.enemyStats, build.baseValues.elementBuffs, build.formula);

    const espers: Record<string, any> = {};
    for (const [name, esper] of Object.entries(options.espers))
      if (!itemsToExclude.includes(name)) espers[name] = esper;
    for (const worker of this.workers) {
      this.send(worker, {
        type: 'setData',
        server: options.server,
        espers,
        unit: build.unit,
        level: build.level,
        exAwakeningLevel: build._exAwakeningLevel,
        fixedItems: build.fixedItems,
        baseValues: build.baseValues,
        innateElements: build.innateElements,
        formula: build.formula,
        monsterAttackFormula: options.monsterAttackFormula,
        dataByType: this.dataStorage.dataByType,
        dataWithCondition: this.dataStorage.dataWithCondition,
        dualWieldSources: this.dataStorage.dualWieldSources,
        alreadyUsedEspers: this.dataStorage.alreadyUsedEspers,
        useEspers: !this.dataStorage.onlyUseShopRecipeItems,
        desirableElements: this.dataStorage.desirableElements,
        enemyStats: options.enemyStats,
        goalVariation: options.goalVariation,
      });
    }
    const generator = new TypeCombinationGenerator(
      options.forceDoubleHand,
      options.forceDualWield,
      options.tryEquipSources,
      build,
      this.dataStorage.dualWieldSources,
      this.dataStorage.equipSources,
      this.dataStorage.dataByType,
      this.dataStorage.weaponsByTypeAndHands,
      options.forceTmrAbility,
      this.dataStorage,
    );
    this.remaining = generator.generateTypeCombinations(undefined);
    if (this.remaining.length === 0) {
      this.stop();
      callbacks.onNoCombination();
      return;
    }
    this.chunkSize = Math.min(this.chunkSize, Math.ceil(this.remaining.length / 20));
    this.pinnedWeapons = [build.fixedItems[0], build.fixedItems[1]];
    this.processed = 0;
    this.total = this.remaining.length;
    this.workerWorkingCount = 0;
    for (let i = this.workers.length; i--;) this.feed(i);
  }

  /** Stops the workers (the best build found so far stays) and starts fresh ones for the next run. */
  stop(): void {
    const count = this.workers.length;
    if (this.saved && this.build) {
      this.build.fixedItems = this.saved.fixedItems;
      this.build.formula = this.saved.formula;
      this.saved = null;
    }
    this.terminate();
    this.workerWorkingCount = 0;
    this.running.set(false);
    if (count) this.init(count, this.dataStorage.itemEnchantments ?? null);
  }

  private feed(workerIndex: number): void {
    if (this.remaining.length === 0) return;
    const chunk = this.remaining.slice(0, this.chunkSize);
    this.remaining = this.remaining.slice(this.chunkSize);
    this.send(this.workers[workerIndex], { type: 'optimize', typeCombinations: chunk });
    this.workerWorkingCount++;
  }

  private onMessage(message: OptimizerResponse): void {
    const build = this.build!;
    const goal = this.options!.goalVariation;
    switch (message.type) {
      case 'buildCounterUpdate':
        this.builds.update((n) => n + message.counter);
        break;
      case 'betterBuildFound': {
        const current = build.buildValue?.[goal];
        const better =
          !current ||
          current < message.value[goal] ||
          (current === message.value[goal] &&
            (message.freeSlots > build.freeSlots ||
              calculateStatValue(message.build, 'hp', build).total >
                calculateStatValue(build.build, 'hp', build).total));
        if (!better) break;
        build.build = message.build;
        build.buildValue = message.value;
        build.freeSlots = message.freeSlots;
        // if the best build has the weapons the other way round, the pinned weapons follow
        const [first, second] = [build.fixedItems[0], build.fixedItems[1]];
        const switched =
          (first && (!build.build[0] || build.build[0].id !== first.id)) ||
          (second && (!build.build[1] || build.build[1].id !== second.id));
        if (switched) [build.fixedItems[0], build.fixedItems[1]] = [second, first];
        this.callbacks!.onBetter(build);
        // any build will do: the first one is enough
        if (
          build.formula.type === 'condition' &&
          build.formula.formula.type === 'value' &&
          build.formula.formula.name === 'any'
        ) {
          this.stop();
          this.progress.set(100);
          this.callbacks!.onDone();
        }
        break;
      }
      case 'finished': {
        this.workerWorkingCount--;
        this.feed(message.number);
        this.processed = Math.min(this.processed + this.chunkSize, this.total);
        this.progress.set(Math.floor((this.processed / this.total) * 100));
        if (this.workerWorkingCount === 0) this.finish();
        break;
      }
    }
  }

  private finish(): void {
    const build = this.build!;
    if (this.saved) {
      build.fixedItems = this.saved.fixedItems;
      build.formula = this.saved.formula;
      this.saved = null;
    } else if (this.reduceOvercap()) return;
    if (!build.buildValue && build.formula.condition) this.callbacks!.onConditionNotMet();
    const [a, b] = this.pinnedWeapons;
    const switched =
      (a && (!build.fixedItems[0] || build.fixedItems[0].id !== a.id)) ||
      (b && (!build.fixedItems[1] || build.fixedItems[1].id !== b.id));
    if (switched) this.callbacks!.onWeaponsSwitched();
    this.running.set(false);
    this.callbacks!.onDone();
  }

  /** The stats of the build that exceed their cap, written as the item values that raise them. */
  private overcappedStats(build: UnitBuild): string[] {
    const items = build.build;
    const result: string[] = [];
    for (let i = baseStats.length; i--;) {
      const stat = baseStats[i];
      if (calculateStatValue(items, stat, build).bonusPercent > getStatBonusCap(stat)) {
        result.push((percentValues as Record<string, string>)[stat]);
      }
      const equipmentFlatStatBonus = Math.round((getEquipmentStatBonus(items, stat, false) - 1) * 100);
      if (equipmentFlatStatBonus > 0) {
        if (items[0] && items[1] && weaponList.includes(items[0].type) && weaponList.includes(items[1].type)) {
          if (equipmentFlatStatBonus > 100) result.push(`dualWielding.${stat}`);
        } else if (equipmentFlatStatBonus > 300) {
          if (!isTwoHanded(items[0])) result.push(`singleWieldingOneHanded.${stat}`);
          result.push(`singleWielding.${stat}`, `oneWeaponMastery.${stat}`);
        }
      }
    }
    return result;
  }

  /**
   * Starts a second search when the best build has an overcap: the items that do not feed the overcapped stats stay,
   * the others are free, and the goal becomes the stat to favor, for a build that is at least as good as the first.
   * Returns false when there is nothing to reduce.
   */
  private reduceOvercap(): boolean {
    const build = this.build!;
    const options = this.options!;
    if (!options.reduceOvercapStat || !build.buildValue) return false;
    const overcapped = this.overcappedStats(build);
    if (overcapped.length === 0) return false;
    this.saved = { fixedItems: build.fixedItems.slice(), formula: JSON.parse(JSON.stringify(build.formula)) };
    for (let i = 0; i < 11; i++) {
      if (build.build[i] && !build.fixedItems[i] && !overcapped.some((stat) => getValue(build.build[i], stat) > 0)) {
        build.fixedItems[i] = build.build[i];
      } else {
        build.build[i] = null;
      }
    }
    const reached = {
      type: '>',
      value1: build.formula.type === 'condition' ? build.formula.formula : build.formula,
      value2: { type: 'constant', value: Math.floor(build.buildValue[options.goalVariation]) },
    };
    build.formula = {
      type: 'condition',
      formula: { type: 'value', name: options.reduceOvercapStat },
      condition:
        build.formula.type === 'condition'
          ? { type: 'AND', value1: reached, value2: build.formula.condition }
          : reached,
    };
    build.buildValue[options.goalVariation] = 0;
    this.dataStorage.calculateAlreadyUsedItems([build], 0);
    build.prepareEquipable();
    this.begin();
    return true;
  }
}
