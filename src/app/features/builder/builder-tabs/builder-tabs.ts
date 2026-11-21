import { Component, input, model, output } from '@angular/core';

/** The tab bar of the builder: one tab per unit being built. */
@Component({
  selector: 'app-builder-tabs',
  templateUrl: './builder-tabs.html',
  styleUrl: './builder-tabs.css',
})
export class BuilderTabs {
  readonly names = input.required<string[]>();
  readonly max = input.required<number>();
  readonly disabled = input(false);
  readonly active = model.required<number>();
  readonly add = output<void>();
  readonly close = output<number>();
}
