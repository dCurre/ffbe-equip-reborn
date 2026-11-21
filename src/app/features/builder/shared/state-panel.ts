import { Directive, input } from '@angular/core';
import type { BuilderState } from './builder-state';

/** A part of the page that reads and writes the state of one unit. */
@Directive()
export abstract class StatePanel {
  readonly state = input.required<BuilderState>();

  protected get s(): BuilderState {
    return this.state();
  }
}
