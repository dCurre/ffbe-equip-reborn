import { Component, input } from '@angular/core';
import { typeList } from '../../../../core/constants/item-types';
import { TypeStat } from '../inventory-model';
import { Icon } from '../../../shared/components/icon/icon';

/** How many different items (and copies) are owned for each equipment type. */
@Component({
  imports: [Icon],
  selector: 'app-inventory-stats',
  templateUrl: './inventory-stats.html',
  styleUrl: './inventory-stats.css',
})
export class InventoryStats {
  readonly counts = input.required<Record<string, TypeStat>>();
  protected readonly types = ['materia', ...typeList.filter((type) => type !== 'materia')];
}
