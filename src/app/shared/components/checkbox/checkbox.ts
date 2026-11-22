import { Component, model } from '@angular/core';

/** A checkbox with its label as content; `[(checked)]` binds the value. */
@Component({
  selector: 'app-checkbox',
  templateUrl: './checkbox.html',
  styleUrl: './checkbox.css',
})
export class Checkbox {
  readonly checked = model(false);
}
