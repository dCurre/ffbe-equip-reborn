import { booleanAttribute, Component, input, model } from '@angular/core';

/**
 * A number field for the inputs of the builder: the value is a text (an empty field is empty), an icon can be put at the left
 * (`withIcon` and an element with the `leading` attribute) and a suffix at the right. `tone` colors a typed value.
 */
@Component({
  selector: 'app-number-field',
  host: { '[class]': 'tone()', '[style.width.px]': 'width()' },
  templateUrl: './number-field.html',
  styleUrl: './number-field.css',
})
export class NumberField {
  readonly value = model('');
  readonly placeholder = input('0');
  readonly title = input('');
  readonly suffix = input('');
  readonly width = input(70);
  /** `buff` (green) or `debuff` (red) */
  readonly tone = input('');
  readonly withIcon = input(false, { transform: booleanAttribute });
  readonly disabled = input(false);
  /** the lowest value the arrows reach; no limit when not given (a resistance can be negative) */
  readonly min = input<number | null>(null);
}
