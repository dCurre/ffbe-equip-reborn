import { Component, computed, inject, input, output } from '@angular/core';
import { ailmentList, elementList, killerList } from '../../../../core/constants';
import { KillerList } from '../../../game/components/killer-list/killer-list';
import { WikiLink } from '../../../shared/components/wiki-link/wiki-link';
import { UnitContext } from '../unit-context';
import { UnitLimitBurst } from '../unit-limit-burst/unit-limit-burst';
import { UnitSkill } from '../unit-skill/unit-skill';
import { ItemsById } from '../unit-skill-model';
import { Result, skillsToDisplay, UnitSearchState } from '../unit-search-model';

/* eslint-disable @typescript-eslint/no-explicit-any -- the skill data of the units has no fixed shape */

interface Killers {
  name: string;
  physical?: number;
  magical?: number;
}

/** A unit of the results: its picture and name, its passive killers and resistances, and the skills that match the search (or all of them). */
@Component({
  selector: 'app-unit-result',
  imports: [WikiLink, KillerList, UnitLimitBurst, UnitSkill],
  providers: [UnitContext],
  templateUrl: './unit-result.html',
  styleUrl: './unit-result.css',
})
export class UnitResult {
  private readonly context = inject(UnitContext);
  readonly result = input.required<Result>();
  readonly state = input.required<UnitSearchState>();
  readonly itemsById = input.required<ItemsById>();
  readonly toggleSkills = output<void>();

  protected readonly unit = computed(() => this.result().unit);
  protected readonly image = computed(() => {
    const unit = this.unit();
    const max = unit.max_rarity === 'NV' ? '7' : unit.max_rarity;
    return `img/units/unit_icon_${unit.id.substring(0, unit.id.length - 1)}${max}.png`;
  });
  protected readonly open = computed(() => this.state().fullyDisplayedUnits.includes(this.unit().id));
  protected readonly killers = computed(() => passiveKillers(this.result().searchData));
  protected readonly killerSelection = computed(() => {
    const { criteria } = this.state();
    return { physical: criteria.physicalKillers.values, magical: criteria.magicalKillers.values };
  });
  protected readonly elementResists = computed(() =>
    this.resistances(
      this.result().searchData.passives.elementalResist,
      elementList,
      this.state().criteria.elements.values,
    ),
  );
  protected readonly ailmentResists = computed(() =>
    this.resistances(
      this.result().searchData.passives.ailmentResist,
      ailmentList,
      this.state().criteria.ailments.values,
    ),
  );
  private readonly ids = computed(() => skillsToDisplay(this.unit(), this.state()));
  protected readonly showLb = computed(() => this.ids().includes('lb'));
  protected readonly groups = computed(() => {
    const unit = this.unit();
    const group = (cls: string, skills: any[]): { cls: string; skills: any[] } => ({
      cls,
      skills: skills.filter((skill) => this.ids().includes(skill.id)),
    });
    return [group('actives', unit.actives), group('passives', unit.passives), group('magics', unit.magics)].filter(
      (g) => g.skills.length,
    );
  });

  constructor() {
    this.context.unit = this.unit;
    this.context.itemsById = this.itemsById;
  }

  private resistances(
    values: Record<string, number> | undefined,
    list: string[],
    selected: readonly string[],
  ): { name: string; value: number; selected: boolean }[] {
    if (!values) return [];
    return list
      .filter((name) => values[name])
      .map((name) => ({ name, value: values[name], selected: selected.includes(name) }));
  }
}

/** The passive killers of the unit, by race. */
function passiveKillers(search: Result['searchData']): Killers[] {
  const killers: Killers[] = [];
  const add = (name: string, kind: 'physical' | 'magical', value: number): void => {
    const killer = killers.find((k) => k.name === name) ?? killers[killers.push({ name }) - 1];
    killer[kind] = (killer[kind] ?? 0) + value;
  };
  for (let i = killerList.length; i--;) {
    const race = killerList[i];
    const physical = search.passives.physicalKillers?.[race];
    const magical = search.passives.magicalKillers?.[race];
    if (physical) add(race, 'physical', physical);
    if (magical) add(race, 'magical', magical);
  }
  return killers;
}
