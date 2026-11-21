import { Component } from '@angular/core';
import { Icon } from '../../shared/components/icon/icon';
import { Panel } from '../../shared/components/panel/panel';

/** How the builder finds the best build, with the diagrams in `img/algo`. */
@Component({
  selector: 'app-algorithm',
  imports: [Panel, Icon],
  templateUrl: './algorithm.html',
  styleUrl: './algorithm.css',
})
export class Algorithm {}
