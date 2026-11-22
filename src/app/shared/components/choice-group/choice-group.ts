import { booleanAttribute, Component, computed, input, model } from '@angular/core';
import { Icon } from '../../../shared/components/icon/icon';
import { Button } from '../button/button';

export interface Choice {
  value: string;
  /** the icon `<iconType>-<icon>` of the sprite table (the value when not given) */
  icon?: string;
  /** a text instead of a picture, or next to the picture when there is an `icon` too */
  label?: string;
  tooltip?: string;
}

/**
 * A group of toggle buttons (the old `btn-group` with `data-toggle="buttons"`): pictures or texts, one choice at a time
 * (`single`) or any number of them.
 */
@Component({
  imports: [Button, Icon],
  selector: 'app-choice-group',
  host: { '[class.pills]': 'pills()' },
  templateUrl: './choice-group.html',
  styleUrl: './choice-group.css',
})
export class ChoiceGroup {
  readonly choices = input.required<readonly Choice[]>();
  readonly iconType = input('');
  readonly single = input(false);
  /** separate round buttons, with the pictures at their own size, instead of one joined bar */
  readonly pills = input(false, { transform: booleanAttribute });
  /** the values selected (for `single`, zero or one value) */
  readonly selected = model<readonly string[]>([]);

  private readonly set = computed(() => new Set(this.selected()));

  protected isSelected(value: string): boolean {
    return this.set().has(value);
  }

  protected iconId(choice: Choice): string {
    return `${this.iconType()}-${choice.icon ?? choice.value}`;
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
