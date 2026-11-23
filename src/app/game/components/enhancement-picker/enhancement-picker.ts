import { Component, computed, input, output } from '@angular/core';
import { itemEnhancementLabels } from '../../../../core/constants/item-enhancement-labels';
import { ENHANCEMENT_GROUPS } from '../../helpers/enhancement-groups';
import { STRINGS } from '../../../strings/en';

/** The enhancements an item can have, in columns: click a value to select or unselect it (`toggled`). */
@Component({
  selector: 'app-enhancement-picker',
  templateUrl: './enhancement-picker.html',
  styleUrl: './enhancement-picker.css',
})
export class EnhancementPicker {
  /** the rare enhancements of the game */
  readonly enchantments = input.required<Readonly<Record<string, { effects: string }>>>();
  /** the item being enhanced: some have a rare enhancement of their own (`special_1`) */
  readonly itemId = input<string>();
  readonly selected = input<readonly (string | number)[]>([]);
  readonly toggled = output<string | number>();

  protected readonly columns = computed(() => {
    const id = this.itemId();
    const special = id ? ((itemEnhancementLabels.special_1 as Record<string, string>)[id] ?? '') : '';
    const rare = Object.entries(this.enchantments()).map(([key, value]) => ({
      key: Number(key),
      label: value.effects,
    }));
    return [
      { title: STRINGS.enhancementPicker.rare, choices: [...(special ? [{ key: 'special_1', label: special }] : []), ...rare] },
      ...ENHANCEMENT_GROUPS.map((group) => ({
        title: group.title,
        choices: group.choices.map(([key, label]) => ({ key, label })),
      })),
    ];
  });
}
