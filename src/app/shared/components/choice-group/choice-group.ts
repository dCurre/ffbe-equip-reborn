import { Component, computed, input, model } from '@angular/core';

export interface Choice {
  value: string;
  /** the picture `img-<iconType>-<icon>` (the value when not given) */
  icon?: string;
  /** a text instead of a picture */
  label?: string;
  tooltip?: string;
}

/**
 * A group of toggle buttons (the old `btn-group` with `data-toggle="buttons"`): pictures or texts, one choice at a time
 * (`single`) or any number of them.
 */
@Component({
  selector: 'app-choice-group',
  templateUrl: './choice-group.html',
  styleUrl: './choice-group.css',
})
export class ChoiceGroup {
  readonly choices = input.required<readonly Choice[]>();
  readonly iconType = input('');
  readonly single = input(false);
  /** the values selected (for `single`, zero or one value) */
  readonly selected = model<readonly string[]>([]);

  private readonly set = computed(() => new Set(this.selected()));

  protected isSelected(value: string): boolean {
    return this.set().has(value);
  }

  protected iconClass(choice: Choice): string {
    return `img img-${this.iconType()}-${choice.icon ?? choice.value}`;
  }

  protected toggle(value: string): void {
    // like a radio button: the chosen one stays chosen, another click elsewhere replaces it
    if (this.single()) this.selected.set([value]);
    else
      this.selected.set(
        this.set().has(value) ? this.selected().filter((v) => v !== value) : [...this.selected(), value],
      );
  }
}
