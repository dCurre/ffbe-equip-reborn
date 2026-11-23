import { computed, signal, type WritableSignal } from '@angular/core';
import { areConditionOK } from '../../../../core/builder/item-conditions';
import { UnitBuild } from '../../../../core/builder/unit-build';
import { typeList } from '../../../../core/constants/item-types';
import { hasStack } from '../../../../core/formula/formula-queries';
import type { OwnedUnit } from '../../../shared/services/inventory';
import { ServerContext } from '../../../shared/services/server-context';

/** A unit of the inventory the user has (the entry can also be only a unit to farm). The Brave Shift form is owned with the other form. */
const isOwned = (unit: OwnedUnit | undefined): boolean =>
  !!unit && (unit.number > 0 || (unit.sevenStar ?? 0) > 0 || (unit.nv ?? 0) > 0);
import { readGoal, syncBaseValues } from './build-inputs';
import { defaultMonsterAttackFormula, GoalOption, goalOptions, multicastChoices, multicastEffect } from './goal';
import { OptimizerRunner } from './optimizer-runner';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

export type EquipmentSource = 'all' | 'owned' | 'shop';

/** A unit of `unitsWithPassives.json` (the data the builder works on). */
export interface BuilderUnit {
  id: string;
  name: string;
  max_rarity: string | number;
  min_rarity?: string | number;
  stats: { maxStats: Record<string, number>; pots: Record<string, number> };
  equip: string[];
  skills: any[];
  enhancements?: { name: string; levels: any[][] }[];
  enhancementLevels?: number[];
  braveShift?: string;
  braveShifted?: string;
  sixStarForm?: boolean;
  sevenStarForm?: boolean;
  [field: string]: any;
}

/**
 * Everything the page shows about ONE unit being built: the build, the inputs of the unit, the goal, the enemy and the options.
 * The core object `build` changes in place: `tick` tells the signals that it did.
 */
export class BuilderState {
  /** The data of the game: the tabs of the page share it. */
  readonly units: WritableSignal<Record<string, BuilderUnit>>;
  readonly unitsWithSkills: Map<string, any>;

  readonly build = signal<UnitBuild>(new UnitBuild());
  readonly tick = signal(0);
  readonly unitId = signal('');
  readonly onlyNvUnits = signal(true);
  readonly onlyOwnedUnits = signal(false);
  readonly level = signal('120');
  readonly exLevel = signal('3');
  readonly pots = signal<Record<string, string>>({});
  readonly buffs = signal<Record<string, string>>({});
  readonly lbFillRate = signal('');
  readonly lbShards = signal('');
  readonly mitigations = signal({ physical: '', magical: '', global: '' });
  readonly drawAttacks = signal('');
  readonly lbDamage = signal('');
  readonly stack = signal('');
  readonly killerBuffs = signal<Record<string, { physical: string; magical: string }>>({});
  readonly elementBuffs = signal<Record<string, string>>({});
  readonly innateElements = signal<readonly string[]>([]);

  // --- The goal ---
  readonly goalChoice = signal('physicalDamage');
  readonly multicastSelection = signal<string[]>([]);
  readonly chainMultiplier = signal('');
  readonly forcedElements = signal<readonly string[]>([]);
  readonly ailmentImmunities = signal<readonly string[]>([]);
  readonly goalResists = signal<Record<string, string>>({});
  readonly various = signal<readonly string[]>([]);
  readonly goalVariation = signal('avg');
  readonly customFormula = signal<any>(null);

  // --- The enemy ---
  readonly races = signal<readonly string[]>([]);
  readonly monster = signal({ atk: '', mag: '', def: '', spr: '' });
  readonly monsterBreaks = signal<Record<string, string>>({});
  readonly monsterBuffs = signal<Record<string, string>>({});
  /** A stat that cannot be broken keeps its break at 0. */
  readonly monsterBreakability = signal<Record<string, boolean>>({ atk: true, def: true, mag: true, spr: true });
  readonly monsterResists = signal<Record<string, string>>({});
  /** The imperils of the elements and of the weapons (they share the record of the core). */
  readonly monsterImperils = signal<Record<string, string>>({});
  readonly monsterAttackFormula = signal<any>(defaultMonsterAttackFormula);

  // --- The options ---
  readonly source = signal<EquipmentSource>('all');
  readonly forceDoubleHand = signal(false);
  readonly forceDualWield = signal(false);
  readonly tryEquipSources = signal(false);
  readonly tryReduceOvercap = signal(false);
  /** the stat that gets the room freed by the reduced overcap */
  readonly reduceOvercapStat = signal('hp');
  readonly forceTmrAbility = signal(false);
  readonly useElementConditionedMateria = signal(false);
  readonly defaultVisionCardLevel = signal('10');
  readonly excludeEvent = signal(false);
  readonly excludeTmr5 = signal(false);
  readonly excludeNotReleased = signal(true);
  readonly excludePremium = signal(false);
  readonly excludeStmr = signal(false);
  readonly includeTmrOfOwnedUnits = signal(false);
  readonly includeTmrMoogles = signal(false);
  readonly includeFarmableStmr = signal(false);
  readonly includeTrialRewards = signal(false);
  readonly includeChocoboItems = signal(false);
  readonly includeEasyItems = signal(false);
  readonly workerCount = signal(OptimizerRunner.defaultWorkerCount());
  readonly excluded = signal<string[]>(['409009000']);
  readonly included = signal<string[]>([]);
  readonly message = signal('');

  // --- What follows from them ---
  readonly unitOptions;
  /** the filter of the owned units can be used: the inventory is there */
  readonly hasOwnedUnits;
  // the build changes in place (the Brave Shift swaps its unit): the same object must still wake what reads it
  readonly current = computed(
    () => {
      this.tick();
      const build = this.build();
      return build.unit ? build : null;
    },
    { equal: () => false },
  );
  readonly unit = computed<BuilderUnit | null>(() => this.current()?.unit ?? null);
  readonly hasBraveShift = computed(() => !!this.current()?.hasBraveShift());
  readonly unitWithSkills = computed(() => {
    this.tick();
    const unit = this.unit();
    return unit ? this.unitsWithSkills.get(unit.id.toString()) : null;
  });
  readonly goalOptions = computed<GoalOption[]>(() => {
    const unit = this.unitWithSkills();
    return unit ? goalOptions(unit) : [];
  });
  readonly multicastTimes = computed(() => {
    const choice = this.goalChoice();
    const unit = this.unitWithSkills();
    if (!unit || !choice.startsWith('MULTICAST_')) return [];
    const times =
      multicastEffect(unit.actives.concat(unit.passives).find((s: any) => s.id === choice.substring(10)))?.time ?? 0;
    return Array.from({ length: times }, (_, i) => i);
  });
  readonly multicastOptions = computed(() => {
    const choice = this.goalChoice();
    const unit = this.unitWithSkills();
    if (!unit || !choice.startsWith('MULTICAST_')) return [];
    return multicastChoices(unit, choice.substring(10)).map((skill) => ({ id: `SKILL_${skill.id}`, name: skill.name }));
  });
  readonly showLevel = computed(() => {
    const unit = this.unit();
    return !!unit && (unit.max_rarity === 7 || unit.max_rarity === 'NV') && !unit.sixStarForm;
  });
  readonly showExLevel = computed(() => {
    const unit = this.unit();
    return this.showLevel() && unit!.max_rarity === 'NV' && !unit!.sevenStarForm;
  });
  readonly equipable = computed(() => {
    this.tick();
    const unit = this.unit();
    const banned = this.build().bannedEquipableTypes ?? [];
    // all the slots of the old page; the ones the unit can't use stay dimmed
    // the arrow of the old page: a skill of the unit that works when equipped with that type
    const boosted: unknown[] = (this.build().unit?.skills ?? []).flatMap((skill: any) => skill.equipedConditions ?? []);
    return unit
      ? typeList
          .filter((type) => type !== 'accessory' && type !== 'visionCard')
          .map((type) => ({
            type,
            usable: unit.equip.includes(type),
            banned: banned.includes(type),
            boosted: boosted.includes(type),
          }))
      : [];
  });
  readonly showStack = computed(() => {
    this.tick();
    const formula = this.build().formula;
    return !!formula && hasStack(formula);
  });

  /** `ownedUnits`: the units of the inventory of the user, null when there is none (not logged in). */
  constructor(
    serverContext: ServerContext,
    sharedWith?: BuilderState,
    private readonly ownedUnits: () => Record<string, OwnedUnit> | null = () => null,
  ) {
    this.units = sharedWith?.units ?? signal({});
    this.unitsWithSkills = sharedWith?.unitsWithSkills ?? new Map();
    this.hasOwnedUnits = computed(() => !!this.ownedUnits());
    this.unitOptions = computed(() => {
      const nvOnly = this.onlyNvUnits();
      const owned = this.onlyOwnedUnits() ? this.ownedUnits() : null;
      const server = serverContext.server();
      return Object.entries(this.units())
        .filter(([, unit]) => !nvOnly || unit.max_rarity === 'NV')
        .filter(([id, unit]) => !owned || isOwned(owned[id]) || isOwned(owned[unit.braveShift ?? unit.braveShifted ?? '']))
        .sort(([, a], [, b]) => a.name.localeCompare(b.name))
        .flatMap(([id, unit]) => {
          let label = unit.name;
          if (!nvOnly && unit['6_form'] && unit.max_rarity === 7) label += ` ${unit.max_rarity}★ `;
          if (unit.max_rarity === 'NV' && unit['7_form']) label += ' NV ';
          if (server !== 'JP' && (unit['unreleased7Star'] || unit['jpname'])) label += ' - JP data';
          const options = [{ id, label }];
          if (!nvOnly && unit['7_form']) options.push({ id: `${id}-7`, label: `${unit['7_form'].name} 7★` });
          if (!nvOnly && unit['6_form']) options.push({ id: `${id}-6`, label: `${unit['6_form'].name} 6★` });
          return options;
        });
    });
  }

  /** The skills of the unit that the equipment makes active are part of the build (the old `recalculateApplicableSkills`). */
  recalculateApplicableSkills(): void {
    const build = this.build();
    if (!build.unit) return;
    build.build = (build.build ?? []).slice(0, 12);
    for (let i = build.unit.skills.length; i--;) {
      const skill = build.unit.skills[i];
      if (areConditionOK(skill, build.build, build.level, build._exAwakeningLevel)) build.build.push(skill);
    }
  }

  /** Reads the inputs, and shows the current build again. */
  refresh(): void {
    if (this.build().unit) {
      syncBaseValues(this);
      readGoal(this);
    }
    this.tick.update((n) => n + 1);
  }
}
