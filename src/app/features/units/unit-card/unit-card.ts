import { Component, input, output } from '@angular/core';
import { WikiLink } from '../../../shared/components/wiki-link/wiki-link';
import type { GameUnit, RarityParts } from '../unit-model';

/** What one unit card shows; computed once per change so the template only reads it. */
export interface Card {
  unit: GameUnit;
  /** the state classes the stylesheet works on: owned, sevenStars, NV, farmable, ... */
  classes: string;
  image: string;
  rarity: RarityParts;
  timeLimited: boolean;
  name: string;
  nv: number;
  sevenStar: number;
  base: number;
  crystal: string | null;
  moogles: number[];
  fragments: number | null;
  /** the trust counters: farmed / total, or only the farmed number when the page shows someone else's collection */
  tmr: { name: string; farmed: number; total: number } | null;
  stmr: { name: string; farmed: number; total: number } | null;
  canAwaken: boolean;
  sevenStars: boolean;
}

/** One unit of the collection: how many are owned, the TMR / STMR counters, and the buttons that appear on hover. */
@Component({
  selector: 'app-unit-card',
  imports: [WikiLink],
  templateUrl: './unit-card.html',
  styleUrl: './unit-card.css',
})
export class UnitCard {
  readonly card = input.required<Card>();
  readonly tab = input.required<string>();
  readonly readOnly = input(false);
  /** load the picture right away: the page is being exported as an image */
  readonly eager = input(false);
  readonly add = output<void>();
  readonly farmedTmr = output<void>();
  readonly farmedStmr = output<void>();
  readonly awaken = output<void>();
  readonly edit = output<void>();
}
