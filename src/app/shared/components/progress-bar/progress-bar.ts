import { Component, input } from '@angular/core';

/** A bar that fills from 0 to 100 with the percentage written in it. */
@Component({
  selector: 'app-progress-bar',
  templateUrl: './progress-bar.html',
  styleUrl: './progress-bar.css',
})
export class ProgressBar {
  readonly value = input.required<number>();
  readonly label = input('Progress');
}
