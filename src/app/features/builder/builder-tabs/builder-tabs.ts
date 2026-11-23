import { Component, input, model, output } from '@angular/core';
import { Button } from '../../../shared/components/button/button';
import { Icon } from '../../../shared/components/icon/icon';

/** The tab bar of the builder: one tab per unit being built. */
@Component({
  imports: [Button, Icon],
  selector: 'app-builder-tabs',
  templateUrl: './builder-tabs.html',
  styleUrl: './builder-tabs.css',
})
export class BuilderTabs {
  readonly names = input.required<string[]>();
  /** the picture of the unit of each tab ('' for none) */
  readonly icons = input<string[]>([]);
  readonly max = input.required<number>();
  readonly disabled = input(false);
  readonly active = model.required<number>();
  readonly add = output<void>();
  readonly close = output<number>();
}
