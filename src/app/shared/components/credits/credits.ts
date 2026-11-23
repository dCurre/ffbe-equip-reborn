import { Component } from '@angular/core';
import { STRINGS } from '../../../strings/en';

/** The thanks to the original FFBE Equip projects and the disclaimer, shown in the footer and on the privacy page. */
@Component({
  selector: 'app-credits',
  templateUrl: './credits.html',
  styleUrl: './credits.css',
})
export class Credits {
  protected readonly t = STRINGS.credits;
}
