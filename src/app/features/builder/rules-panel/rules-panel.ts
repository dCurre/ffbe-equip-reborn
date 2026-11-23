import { Component } from '@angular/core';
import { Checkbox } from '../../../shared/components/checkbox/checkbox';
import { Panel } from '../../../shared/components/panel/panel';
import { StatePanel } from '../shared/state-panel';
import { STRINGS } from '../../../strings/en';

/** The rules the build must follow, and the damage variance. */
@Component({
  selector: 'app-rules-panel',
  imports: [Panel, Checkbox],
  templateUrl: './rules-panel.html',
  styleUrls: ['../shared/form-common.css', './rules-panel.css'],
})
export class RulesPanel extends StatePanel {
  protected readonly t = STRINGS.rulesPanel;
  protected readonly overcapStats = [
    ['hp', 'HP'],
    ['mp', 'MP'],
    ['atk', 'ATK'],
    ['def', 'DEF'],
    ['mag', 'MAG'],
    ['spr', 'SPR'],
    ['lbPerTurn', 'LB/turn'],
  ];
  protected readonly variations = [
    ['min', 'Minimum'],
    ['avg', 'Average'],
    ['max', 'Maximum'],
  ];
}
