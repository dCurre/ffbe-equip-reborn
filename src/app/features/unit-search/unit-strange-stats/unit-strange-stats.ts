import { Component, computed, input } from '@angular/core';
import { strangeStats } from '../unit-skill-model';
import { Icon } from '../../../shared/components/icon/icon';

/* eslint-disable @typescript-eslint/no-explicit-any -- the skill data of the units has no fixed shape */

/** A warning when a damage skill uses a stat that is not the usual one. */
@Component({
  imports: [Icon],
  selector: 'app-unit-strange-stats',
  templateUrl: './unit-strange-stats.html',
  styleUrl: './unit-strange-stats.css',
})
export class UnitStrangeStats {
  readonly effects = input.required<any[]>();
  protected readonly strange = computed(() => strangeStats(this.effects()));
}
