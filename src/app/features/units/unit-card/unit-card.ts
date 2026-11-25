import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { roleList } from '../../../../core/constants/unit-restrictions';
import { Button } from '../../../shared/components/button/button';
import { Icon, SpriteName } from '../../../shared/components/icon/icon';
import { ItemLine } from '../../../game/components/item-line/item-line';
import type { TrustItem } from '../unit-model';
import { WikiLink } from '../../../shared/components/wiki-link/wiki-link';
import type { GameUnit, RarityParts } from '../unit-model';
import { STRINGS } from '../../../strings/en';

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
  /** EX level of an NV unit, 0 to 3 */
  exRank: number;
  /** an NV-capable unit has an EX level; it can be raised while it is owned as NV and below 3 */
  hasEx: boolean;
  canRaiseEx: boolean;
  sevenStar: number;
  base: number;
  crystal: SpriteName | null;
  moogles: number[];
  fragments: number | null;
  /** the trust counters: farmed / total, or only the farmed number when the page shows someone else's collection */
  tmr: TrustCounter | null;
  stmr: TrustCounter | null;
  canAwaken: boolean;
  canRemove: boolean;
  /** the TMR / STMR still to farm, and whether the unit has an STMR */
  farmable: boolean;
  farmableStmr: boolean;
  canStmr: boolean;
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
  protected readonly t = STRINGS.unitCard;
  readonly card = input.required<Card>();
  readonly tab = input.required<string>();
  readonly readOnly = input(false);
  /** the roles the page filters by: the other roles of the unit are dimmed */
  readonly searchedRoles = input<readonly string[]>([]);
  protected readonly roles = computed(() =>
    roleList
      .filter((name) => this.card().unit.roles?.includes(name))
      .map((name) => ({ name, dimmed: this.searchedRoles().length > 0 && !this.searchedRoles().includes(name) })),
  );
  readonly add = output<void>();
  readonly remove = output<void>();
  readonly farmedTmr = output<void>();
  readonly farmedStmr = output<void>();
  readonly awaken = output<void>();
  readonly raiseEx = output<void>();
  readonly edit = output<void>();
  /** the counter the pointer is on: only its item line is drawn */
  /** how far a TMR / STMR is: nothing to farm at all, some left, or all farmed */
  protected state(counter: TrustCounter | null | undefined): 'none' | 'partial' | 'complete' {
    if (!counter?.total) return 'none';
    return counter.farmed >= counter.total ? 'complete' : 'partial';
  }

  protected readonly tip = signal<'tmr' | 'stmr' | null>(null);
}
