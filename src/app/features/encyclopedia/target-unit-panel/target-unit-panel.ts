import { Component, computed, input, model, output } from '@angular/core';
import { baseStats } from '../../../../core/constants/base-lists';
import { Combobox } from '../../../shared/components/combobox/combobox';
import { Icon } from '../../../shared/components/icon/icon';
import { Panel } from '../../../shared/components/panel/panel';
import { debouncer } from '../../../shared/helpers/search-input';
import { STRINGS } from '../../../strings/en';

export interface FullUnit {
  id: string;
  name: string;
  max_rarity: string;
  roles?: string[];
  sex?: string;
  equip: string[];
  stats: { maxStats: Record<string, number>; pots: Record<string, number> };
}

const CRYSTALS: Record<string, string> = {
  NV: 'NV',
  '7': 'sevenStarCrystal',
  '6': 'redCrystal',
  '5': 'rainbowCrystal',
  '4': 'goldCrystal',
  '3': 'blueCrystal',
};

/** Picks the unit the items are evaluated for and the base stats the % modifiers apply to. */
@Component({
  selector: 'app-target-unit-panel',
  imports: [Panel, Combobox, Icon],
  templateUrl: './target-unit-panel.html',
  styleUrls: ['../../../shared/styles/search-page.css', './target-unit-panel.css'],
})
export class TargetUnitPanel {
  protected readonly t = STRINGS.targetUnitPanel;
  readonly unitList = input.required<FullUnit[]>();
  readonly unitName = model('');
  readonly baseStatText = model<Record<string, string>>({});
  /** a unit was chosen: the base stats are replaced and the owner clears what depends on the previous one */
  readonly chosen = output<void>();

  protected readonly unitNames = computed(() => [...new Set(this.unitList().map((u) => u.name))]);
  protected readonly baseStatList = baseStats;
  protected readonly unit = computed(() => this.unitList().find((u) => u.name === this.unitName()));
  /** the crystal of the unit's max rarity (none for a 2★ unit) */
  protected readonly crystal = computed(() => {
    const rarity = this.unit()?.max_rarity ?? '';
    return rarity && rarity in CRYSTALS ? `crystal-${CRYSTALS[rarity]}` : '';
  });
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
