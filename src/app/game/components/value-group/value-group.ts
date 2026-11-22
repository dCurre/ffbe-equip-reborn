import { Component } from '@angular/core';

/**
 * Icons and the value they share (resistances, killers): the icons go in the content and the value in an element with the
 * `value` attribute. The value stays on the right, so the values of a list line up. `--value-group-min-width` sets the width.
 */
@Component({
  selector: 'app-value-group',
  templateUrl: './value-group.html',
  styleUrl: './value-group.css',
})
export class ValueGroup {}
