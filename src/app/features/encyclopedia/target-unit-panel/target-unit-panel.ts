import { Component, computed, input, model, output } from '@angular/core';
import { baseStats } from '../../../../core/constants/base-lists';
import { Panel } from '../../../shared/components/panel/panel';
import { debouncer } from '../../../shared/helpers/search-input';

export interface FullUnit {
  id: string;
  name: string;
  max_rarity: string;
  roles?: string[];
  sex?: string;
  equip: string[];
  stats: { maxStats: Record<string, number>; pots: Record<string, number> };
}

/** Picks the unit the items are evaluated for and the base stats the % modifiers apply to. */
@Component({
  selector: 'app-target-unit-panel',
  imports: [Panel],
  templateUrl: './target-unit-panel.html',
  styleUrls: ['../../../shared/styles/search-page.css', './target-unit-panel.css'],
})
export class TargetUnitPanel {
  readonly unitList = input.required<FullUnit[]>();
  readonly unitName = model('');
  readonly baseStatText = model<Record<string, string>>({});
  /** a unit was chosen: the base stats are replaced and the owner clears what depends on the previous one */
  readonly chosen = output<void>();

  protected readonly baseStatList = baseStats;
  protected readonly unit = computed(() => this.unitList().find((u) => u.name === this.unitName()));
  protected readonly stars = computed(() => Array.from({ length: Number(this.unit()?.max_rarity ?? 0) }));
  private readonly debounce = debouncer();

  /** A unit sets the base stats (max stats with its potentials). */
  protected chooseUnit(name: string): void {
    this.unitName.set(name);
    const unit = this.unitList().find((u) => u.name === name);
    this.baseStatText.set(
      unit ? Object.fromEntries(baseStats.map((s) => [s, String(unit.stats.maxStats[s] + unit.stats.pots[s])])) : {},
    );
    this.chosen.emit();
  }

  protected setBaseStat(stat: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.debounce(() => this.baseStatText.update((v) => ({ ...v, [stat]: value })));
  }
}
