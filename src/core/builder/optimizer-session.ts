import { BuildOptimizer } from './build-optimizer.js';
import { UnitBuild } from './unit-build.js';

/** Messages the page sends to an optimizer worker. They are sent as JSON strings, so everything in them is plain data. */
export type OptimizerRequest =
  | { type: 'init'; allItemVersions: any; number: number; itemEnchantments?: any }
  | {
      type: 'setData';
      unit: any;
      fixedItems: any;
      baseValues: any;
      level: number;
      exAwakeningLevel: number;
      innateElements: string[];
      monsterAttackFormula: any;
      formula: any;
      dataByType: any;
      dataWithCondition: any;
      dualWieldSources?: any /* sent by the page, not used by the optimizer */;
      enemyStats: any;
      useEspers: boolean;
      espers: any;
      alreadyUsedEspers: any;
      goalVariation: string;
      desirableElements: string[];
      server?: string;
    }
  | { type: 'optimize'; typeCombinations: any[] };

/** What a worker answers. */
export type OptimizerResponse =
  | { type: 'buildCounterUpdate'; counter: number }
  | { type: 'betterBuildFound'; build: any; value: any; freeSlots: number }
  | { type: 'finished'; number: number };

/**
 * The conversation of one optimizer worker, without the Worker API (so it can be tested): `init`, then `setData`, then
 * `optimize` (which answers with `betterBuildFound` messages and one `finished`).
 */
export class OptimizerSession {
  private optimizer: BuildOptimizer | null = null;
  private number = 0;
  private post: (response: OptimizerResponse) => void;

  constructor(post: (response: OptimizerResponse) => void) {
    this.post = post;
  }

  handle(message: OptimizerRequest): void {
    switch (message.type) {
      case 'init':
        this.optimizer = new BuildOptimizer(
          message.allItemVersions,
          (counter) => this.post({ type: 'buildCounterUpdate', counter }),
          message.itemEnchantments ?? null,
        );
        this.number = message.number;
        break;
      case 'setData': {
        const optimizer = this.initialized();
        const unitBuild = new UnitBuild(message.unit, message.fixedItems, message.baseValues);
        unitBuild.level = message.level;
        unitBuild.setExAwakeningLevel(message.exAwakeningLevel);
        unitBuild.innateElements = message.innateElements;
        unitBuild.monsterAttackFormula = message.monsterAttackFormula;
        unitBuild.formula = message.formula;
        optimizer.unitBuild = unitBuild;
        optimizer.dataByType = message.dataByType;
        optimizer.dataWithCondition = message.dataWithCondition;
        optimizer.enemyStats = message.enemyStats;
        optimizer.useEspers = message.useEspers;
        optimizer.espers = message.espers;
        optimizer.alreadyUsedEspers = message.alreadyUsedEspers;
        optimizer.goalVariation = message.goalVariation;
        optimizer.desirableElements = message.desirableElements;
        break;
      }
      case 'optimize':
        this.initialized().optimizeFor(message.typeCombinations, (build, value, freeSlots) => {
          this.post({ type: 'betterBuildFound', build, value, freeSlots });
        });
        this.post({ type: 'finished', number: this.number });
        break;
    }
  }

  private initialized(): BuildOptimizer {
    if (!this.optimizer) {
      throw new Error('The optimizer worker received a message before "init"');
    }
    return this.optimizer;
  }
}
