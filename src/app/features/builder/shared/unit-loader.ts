import { baseStats } from '../../../../core/constants/base-lists';
import type { DataStorage } from '../../../../core/builder/data-storage';
import { UnitBuild } from '../../../../core/builder/unit-build';
import { UnitShift } from '../../../../core/builder/unit-shift';
import type { StaticData } from '../../../shared/services/static-data';
import type { Toast } from '../../../shared/services/toast';
import { updateGoal } from './build-inputs';
import type { BuilderState, BuilderUnit } from './builder-state';
import { choiceFromFormula } from './goal';

/* eslint-disable @typescript-eslint/no-explicit-any -- the build data of the core is open */

export const MAX_POTS = 1.5;

/** The EX awakening a unit starts from: its highest level (the old page always started from the top). */
export const highestEx = (build: UnitBuild): number => build.unit?.exAwakening?.length ?? 3;

/** Loads a unit into the state: its skills, a new build, the inputs of the stats and the goal. */
export class UnitLoader {
  /** The enhancement levels of a link being opened, used by the next `choose`. */
  pendingEnhancementLevels: number[] | undefined;

  constructor(
    private readonly s: BuilderState,
    private readonly staticData: StaticData,
    private readonly toast: Toast,
    private readonly dataStorage: DataStorage,
  ) {}

  async choose(id: string): Promise<void> {
    this.s.unitId.set(id);
    if (!id) return;
    const units = this.s.units();
    let data: BuilderUnit | undefined;
    let skillsId = id;
    if (id.endsWith('-6')) {
      skillsId = id.slice(0, -2);
      data = units[skillsId]?.['6_form'];
    } else if (id.endsWith('-7')) {
      skillsId = id.slice(0, -2);
      data = units[skillsId]?.['7_form'];
    } else {
      data = units[id];
    }
    if (!data) return;
    try {
      await this.loadSkills(skillsId);
    } catch {
      this.toast.show('Error while loading the skills of the unit', 'error');
      return;
    }
    const previous = this.s.build();
    const same = previous.unit && previous.unit.id === data.id && previous.unit.sixStarForm === data.sixStarForm;
    const oldValues = previous.baseValues;
    const oldLevel = previous.level;
    const build = new UnitBuild();
    build.monsterAttackFormula = this.s.monsterAttackFormula();
    let unitData = data;
    if (unitData.enhancements) {
      unitData = JSON.parse(JSON.stringify(unitData));
      this.initEnhancementLevels(
        unitData,
        this.pendingEnhancementLevels ?? (same ? previous.unit?.enhancementLevels : undefined),
      );
      this.pendingEnhancementLevels = undefined;
    }
    build.setUnit(unitData);
    if (same) {
      build.baseValues = oldValues;
      build.level = oldLevel;
    }
    let shifted = unitData.braveShift
      ? units[unitData.braveShift]
      : unitData.braveShifted
        ? units[unitData.braveShifted]
        : null;
    // a copy: the enhancements add their skills to it, and the unit of the list must not grow at each choice
    if (shifted?.enhancements) shifted = JSON.parse(JSON.stringify(shifted)) as BuilderUnit;
    if (shifted) {
      const shift = new UnitShift();
      shift.setUnit(shifted);
      this.initEnhancementLevels(shifted);
      build.setBraveShift(shift);
    } else {
      build.setBraveShift(null);
    }
    if (unitData.materiaSlots || unitData.materiaSlots === 0) {
      for (let i = 4 - unitData.materiaSlots; i--;)
        build.fixItem({ name: 'Unavailable slot', type: 'unavailable', placeHolder: true }, 9 - i);
    }
    if (!unitData.equip.includes('visionCard')) {
      if (unitData['6_form']) unitData.equip.push('visionCard');
      else build.fixItem({ name: 'Unavailable slot', type: 'unavailable', placeHolder: true }, 10);
    }
    this.s.build.set(build);
    // the reduction of the overcap and the forced TMR are for the 7★ and NV units
    if (data.max_rarity !== 7 && data.max_rarity !== 'NV') this.s.tryReduceOvercap.set(false);
    this.dataStorage.setUnitBuild(build);
    this.s.level.set(String(build.level || 120));
    this.s.exLevel.set(String(build._exAwakeningLevel > -1 ? build._exAwakeningLevel : highestEx(build)));
    if (this.s.showLevel() && !build.level) build.level = 120;
    if (this.s.showExLevel() && !(build._exAwakeningLevel > -1)) build.setExAwakeningLevel(highestEx(build));
    this.resetStats(build, !!same);
    const goal = choiceFromFormula(null, null, this.s.unitWithSkills(), {
      atk: unitData.stats.pots.atk,
      mag: unitData.stats.pots.mag,
    });
    this.s.customFormula.set(null);
    this.s.goalChoice.set(goal.choice);
    updateGoal(this.s);
    this.s.recalculateApplicableSkills();
    this.s.refresh();
  }

  /** Changes the level of one enhancement of the unit: the unit is loaded again with it. */
  async setEnhancement(index: number, level: number): Promise<void> {
    const levels = [...(this.s.unit()?.enhancementLevels ?? [])];
    levels[index] = level;
    this.pendingEnhancementLevels = levels;
    await this.choose(this.s.unitId());
  }

  /** Switches the unit to its Brave Shift form, or back: the inputs take the values of the other form. */
  braveShift(): void {
    const build = this.s.build();
    if (!build.hasBraveShift()) return;
    build.braveShift();
    // the old page selected the other form in the unit list too (`loadBuild`)
    const unit = build.unit;
    this.s.unitId.set(`${unit.id}${unit.sixStarForm ? '-6' : ''}${unit.sevenStarForm ? '-7' : ''}`);
    this.s.tick.update((n) => n + 1); // the form is another unit: what depends on it must see it from here on
    // the other form starts without a level: the stats need the default of the page (as `updateUnitLevelDisplay`)
    if (this.s.showLevel() && !build.level) build.level = 120;
    if (this.s.showExLevel() && !(build._exAwakeningLevel > -1)) build.setExAwakeningLevel(highestEx(build));
    build.updateStats(); // the EX awakening may have changed while the other form was shown
    this.s.level.set(String(build.level || 120));
    this.s.exLevel.set(String(build._exAwakeningLevel > -1 ? build._exAwakeningLevel : highestEx(build)));
    this.resetStats(build, true);
    this.s.customFormula.set(null);
    this.s.recalculateApplicableSkills();
    this.s.tick.update((n) => n + 1);
    updateGoal(this.s);
    this.s.refresh();
  }

  private async loadSkills(id: string): Promise<void> {
    if (this.s.unitsWithSkills.has(id)) return;
    const result = await this.staticData.get<any>(`unit/${id}`);
    this.s.unitsWithSkills.set(id, result);
    const unit = this.s.units()[id];
    const other = unit?.braveShift ?? unit?.braveShifted;
    if (other) await this.loadSkills(other);
  }

  private initEnhancementLevels(unit: BuilderUnit, previous?: number[]): void {
    unit.enhancementLevels = [];
    if (!unit.enhancements) return;
    for (let i = unit.enhancements.length; i--;) {
      const level = previous?.[i] ?? unit.enhancements[i].levels.length - 1;
      unit.skills = unit.skills.concat(unit.enhancements[i].levels[level]);
      unit.enhancementLevels[i] = level;
    }
  }

  /** The inputs of the stats take the values of the unit (the pots at their maximum, as the old page did). */
  private resetStats(build: UnitBuild, keep: boolean): void {
    const pots: Record<string, string> = {};
    const buffs: Record<string, string> = {};
    for (const stat of baseStats) {
      const own = build.baseValues?.[stat];
      pots[stat] = String(own?.pots !== undefined ? own.pots : Math.floor(build.unit.stats.pots[stat] * MAX_POTS));
      buffs[stat] = own?.buff ? String(own.buff) : '';
    }
    this.s.pots.set(pots);
    this.s.buffs.set(buffs);
    if (!keep) {
      this.s.lbFillRate.set('');
      this.s.lbShards.set('');
      this.s.mitigations.set({ physical: '', magical: '', global: '' });
      this.s.drawAttacks.set('');
      this.s.lbDamage.set('');
      this.s.killerBuffs.set({});
      this.s.elementBuffs.set({});
    }
    this.s.innateElements.set(build.innateElements ?? []);
  }
}
