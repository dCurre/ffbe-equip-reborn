import { NgTemplateOutlet } from '@angular/common';
import { Component, input, output, signal } from '@angular/core';
import { Button } from '../../../shared/components/button/button';
import { Icon, SpriteName } from '../../../shared/components/icon/icon';
import { ItemLine } from '../../../game/components/item-line/item-line';
import type { ItemUnits } from '../../../game/models/item-context.model';
import type { TrustItem } from '../unit-model';
import { WikiLink } from '../../../shared/components/wiki-link/wiki-link';
import type { GameUnit, RarityParts } from '../unit-model';

/** A TMR / STMR counter: the item is shown in a tooltip (a shared collection may not know it). */
export interface TrustCounter {
  name: string;
  item?: TrustItem;
  farmed: number;
  total: number;
}

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
  crystal: SpriteName | null;
  moogles: number[];
  fragments: number | null;
  /** the trust counters: farmed / total, or only the farmed number when the page shows someone else's collection */
  tmr: TrustCounter | null;
  stmr: TrustCounter | null;
  canAwaken: boolean;
  sevenStars: boolean;
}

/** One unit of the collection: how many are owned, the TMR / STMR counters, and the buttons that appear on hover. */
@Component({
  selector: 'app-unit-card',
  imports: [NgTemplateOutlet, Button, Icon, ItemLine, WikiLink],
  templateUrl: './unit-card.html',
  styleUrl: './unit-card.css',
})
export class UnitCard {
  readonly card = input.required<Card>();
  readonly tab = input.required<string>();
  readonly readOnly = input(false);
  /** every unit by id, to name the unit a TMR belongs to */
  readonly units = input<ItemUnits>({});
  /** load the picture right away: the page is being exported as an image */
  readonly eager = input(false);
  readonly add = output<void>();
  readonly farmedTmr = output<void>();
  readonly farmedStmr = output<void>();
  readonly awaken = output<void>();
  readonly edit = output<void>();
  /** the counter the pointer is on: only its item line is drawn */
  protected readonly tip = signal<'tmr' | 'stmr' | null>(null);
}
