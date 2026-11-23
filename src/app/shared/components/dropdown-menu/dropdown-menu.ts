import { booleanAttribute, Component, input, signal } from '@angular/core';
import { Icon } from '../icon/icon';

export interface MenuItem {
  label: string;
  run: () => void;
}

/** A link that opens a list of actions; a click on an action, or anywhere else, closes it. */
@Component({
  selector: 'app-dropdown-menu',
  imports: [Icon],
  host: { '(document:click)': 'open.set(false)' },
  templateUrl: './dropdown-menu.html',
  styleUrl: './dropdown-menu.css',
})
export class DropdownMenu {
  readonly label = input.required<string>();
  readonly items = input.required<readonly MenuItem[]>();
  /** the icon before the label */
  readonly icon = input('link');
  /** only the link, without the frame of a button */
  readonly plain = input(false, { transform: booleanAttribute });
  protected readonly open = signal(false);

  protected run(item: MenuItem): void {
    this.open.set(false);
    item.run();
  }
}
