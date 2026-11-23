import { Component } from '@angular/core';
import { STRINGS } from '../../../strings/en';

/** The short guide shown at the right of the builder until a unit is chosen (the old `#help`). */
@Component({
  selector: 'app-build-help',
  templateUrl: './build-help.html',
  styleUrl: './build-help.css',
})
export class BuildHelp {
  protected readonly t = STRINGS.buildHelp;
}
