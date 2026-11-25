import { booleanAttribute, Component, computed, input, model } from '@angular/core';
import { Choice, ChoiceGroup } from '../choice-group/choice-group';

/** NV is above the stars. */
const rank = (rarity: string): number => (rarity === 'NV+' ? 9 : rarity === 'NV' ? 8 : parseInt(rarity, 10));

/** The name of a rarity: `3★`, `NV`. */
export const rarityName = (rarity: string): string => (rarity.startsWith('NV') ? rarity : `${rarity}★`);

/** Whether a unit can have this base and this max: the max is not under the base, and NV+ is only a max of the NV units. */
const possible = (base: string, max: string): boolean => rank(max) >= rank(base) && (max !== 'NV+' || base === 'NV');

const toChoice = (value: string, disabled: boolean): Choice => ({ value, rarity: value, tooltip: rarityName(value), disabled });

/**
 * The filter of the rarity of units: a row for the base and a row for the max. The base and the max of a unit go up together:
 * a max under every base chosen (and a base over every max chosen) has no unit, so it is shown disabled and a choice takes
 * off the ones of the other row that it makes impossible.
 */
@Component({
  imports: [ChoiceGroup],
  selector: 'app-rarity-filter',
  host: { '[class.heading]': 'heading()' },
  templateUrl: './rarity-filter.html',
  styleUrl: './rarity-filter.css',
})
export class RarityFilter {
  /** the rarities to choose from (`"1"` … `"7"`, `"NV"`, `"NV+"`) */
  readonly bases = input.required<readonly string[]>();
  readonly maxes = input.required<readonly string[]>();
  readonly baseLabel = input.required<string>();
  readonly maxLabel = input.required<string>();
  /** the labels like the headings of a filter panel (a grid of label and buttons), not a line of text with its buttons */
  readonly heading = input(false, { transform: booleanAttribute });
  readonly base = model<readonly string[]>([]);
  readonly max = model<readonly string[]>([]);

  protected readonly baseChoices = computed(() => {
    const max = this.max();
    return this.bases().map((value) => toChoice(value, max.length > 0 && !max.some((m) => possible(value, m))));
  });
  protected readonly maxChoices = computed(() => {
    const base = this.base();
    return this.maxes().map((value) => toChoice(value, base.length > 0 && !base.some((b) => possible(b, value))));
  });

  // a choice takes off the ones of the other row that it makes impossible (nothing chosen takes nothing off)
  protected setBase(values: readonly string[]): void {
    this.base.set(values);
    if (values.length) this.max.set(this.max().filter((m) => values.some((b) => possible(b, m))));
  }

  protected setMax(values: readonly string[]): void {
    this.max.set(values);
    if (values.length) this.base.set(this.base().filter((b) => values.some((m) => possible(b, m))));
  }
}
