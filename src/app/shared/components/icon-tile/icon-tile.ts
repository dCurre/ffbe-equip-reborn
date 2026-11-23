import { Component, input } from '@angular/core';
import { Icon } from '../icon/icon';

/** An icon with a percent over its bottom, white with a black outline (a resist, a killer). `overCap` and `involved` color the value. */
@Component({
  selector: 'app-icon-tile',
  imports: [Icon],
  templateUrl: './icon-tile.html',
  styleUrl: './icon-tile.css',
})
export class IconTile {
  readonly icon = input.required<string>();
  readonly value = input.required<number>();
  readonly tooltip = input<string>();
  readonly involved = input(false);
  readonly overCap = input(false);
}
