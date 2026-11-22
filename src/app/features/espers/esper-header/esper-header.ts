import { Component, ElementRef, input, output, viewChild } from '@angular/core';
import { KillerList } from '../../../game/components/killer-list/killer-list';
import { ResistList } from '../../../game/components/resist-list/resist-list';
import { EsperInfo, OwnedEsper, Stat, statBonus, statValue } from '../esper-model';

/** The name, rarity, level, SP and stats of the Esper being viewed. */
@Component({
  selector: 'app-esper-header',
  imports: [ResistList, KillerList],
  templateUrl: './esper-header.html',
  styleUrl: './esper-header.css',
})
export class EsperHeader {
  readonly info = input.required<EsperInfo>();
  readonly current = input.required<OwnedEsper | undefined>();
  readonly logged = input.required<boolean>();
  readonly sp = input.required<{ used: number; available: number } | null>();
  readonly rarityChange = output<string>();
  readonly levelInput = output<Event>();
  /** the SP label: the page shows a fixed one once this one is scrolled out of view */
  readonly spLabel = viewChild<ElementRef<HTMLElement>>('spLabel');

  protected readonly statGroups: Stat[][] = [
    ['hp', 'atk', 'mag'],
    ['mp', 'def', 'spr'],
  ];

  protected readonly bonus = statBonus;
  protected readonly value = statValue;

  protected rarities(): number[] {
    return Array.from({ length: this.info().maxLevel }, (_, i) => i + 1);
  }
}
