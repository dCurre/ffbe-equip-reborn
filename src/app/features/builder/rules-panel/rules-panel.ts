import { Component, output } from '@angular/core';
import { Panel } from '../../../shared/components/panel/panel';
import { StatePanel } from '../shared/state-panel';

/** The rules the build must follow, and how many cores to use. */
@Component({
  selector: 'app-rules-panel',
  imports: [Panel],
  templateUrl: './rules-panel.html',
  styleUrls: ['../shared/form-common.css', './rules-panel.css'],
})
export class RulesPanel extends StatePanel {
  readonly workers = output<string>();
  protected readonly overcapStats = [
    ['hp', 'HP'],
    ['mp', 'MP'],
    ['atk', 'ATK'],
    ['def', 'DEF'],
    ['mag', 'MAG'],
    ['spr', 'SPR'],
    ['lbPerTurn', 'LB/turn'],
  ];
}
