import { booleanAttribute, Component, input } from '@angular/core';

export type ButtonVariant = 'default' | 'primary' | 'flat' | 'link';

/**
 * The button of the site: `<button app-button>`, or `<a app-button>` for a link that looks like one. The label and any
 * `<app-icon>` go inside.
 * - `variant`: `primary` (the main action), `flat` (no frame: an icon alone, a stepper), `link` (looks like a link)
 * - `small`: less padding
 * - `active`: for a toggle, `true` / `false` says whether it is pressed (left out, the button is not a toggle)
 * Places that need something particular (size, colors) set it in their own stylesheet on the element.
 */
@Component({
  selector: 'button[app-button], a[app-button]',
  host: {
    '[attr.data-variant]': 'variant()',
    '[class.small]': 'small()',
    '[class.active]': 'active()',
    '[attr.aria-pressed]': 'active() ?? null',
  },
  templateUrl: './button.html',
  styleUrl: './button.css',
})
export class Button {
  readonly variant = input<ButtonVariant>('default');
  readonly small = input(false, { transform: booleanAttribute });
  readonly active = input<boolean>();
}
