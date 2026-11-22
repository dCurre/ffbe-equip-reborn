import { Component, input } from '@angular/core';

/** Fields glued together in one box, with an optional label on the left (the old Bootstrap `input-group`). */
@Component({
  selector: 'app-input-group',
  templateUrl: './input-group.html',
  styleUrl: './input-group.css',
})
export class InputGroup {
  readonly label = input('');
}
