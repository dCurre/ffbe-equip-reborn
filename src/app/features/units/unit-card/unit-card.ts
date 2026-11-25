import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, ElementRef, inject, input, output, signal } from '@angular/core';
import { roleList } from '../../../../core/constants/unit-restrictions';
import { Button } from '../../../shared/components/button/button';
import { Icon } from '../../../shared/components/icon/icon';
import { ItemLine } from '../../../game/components/item-line/item-line';
import type { TrustItem } from '../unit-model';
import { ExLevel } from '../../../shared/components/ex-level/ex-level';
import { RarityStars } from '../../../shared/components/rarity-stars/rarity-stars';
import { WikiLink } from '../../../shared/components/wiki-link/wiki-link';
import type { GameUnit, RarityCopies, RarityParts } from '../unit-model';
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
  /** an NV-capable unit has an EX level; it can be raised while it is owned as NV and below 3 */
  hasEx: boolean;
  canRaiseEx: boolean;
  /** the copies owned at each rarity the unit can have */
  copies: RarityCopies[];
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
  imports: [NgTemplateOutlet, Button, ExLevel, Icon, ItemLine, RarityStars, WikiLink],
  host: { '(document:pointerdown)': 'outside($event)' },
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
  /** a tap on the pill of an EX level adds a copy at that level, a long press (or the right button) removes one */
  readonly exCopy = output<{ level: number; delta: 1 | -1 }>();
  /** the counter the pointer is on: only its item line is drawn */
  /** how far a TMR / STMR is: nothing to farm at all, some left, or all farmed */
  protected state(counter: TrustCounter | null | undefined): 'none' | 'partial' | 'complete' {
    if (!counter?.total) return 'none';
    return counter.farmed >= counter.total ? 'complete' : 'partial';
  }

  protected readonly tip = signal<'tmr' | 'stmr' | null>(null);

  private readonly element: HTMLElement = inject(ElementRef).nativeElement;
  private pressTimer: ReturnType<typeof setTimeout> | undefined;
  private longPress = false;

  /** The pill of an EX level: a tap adds an NV copy at that level, a long press (or the right button) removes one. */
  protected pressStart(level: number): void {
    this.longPress = false;
    this.pressTimer = setTimeout(() => {
      this.longPress = true;
      this.exCopy.emit({ level, delta: -1 });
    }, 500);
  }

  protected pressEnd(): void {
    clearTimeout(this.pressTimer);
  }

  protected tap(level: number): void {
    if (this.longPress) this.longPress = false; // the long press has done its work
    else this.exCopy.emit({ level, delta: 1 });
  }

  protected secondary(event: Event, level: number): void {
    event.preventDefault(); // a long press on a phone gives this event too
    if (!this.longPress) this.exCopy.emit({ level, delta: -1 });
  }

  protected hover(which: string, event: PointerEvent): void {
    if (event.pointerType === 'mouse') this.tip.set(which as 'tmr' | 'stmr'); // a touch has no hover
  }

  protected leave(event: PointerEvent): void {
    if (event.pointerType === 'mouse') this.tip.set(null);
    this.tipRelease();
  }

  private tipTimer: ReturnType<typeof setTimeout> | undefined;
  private tipByHold = false;

  /** A touch held on the pill (about half a second) shows the item line, where there is no hover. */
  protected tipPress(which: string, event: PointerEvent): void {
    this.tipByHold = false;
    if (event.pointerType !== 'touch') return;
    this.tipTimer = setTimeout(() => {
      this.tipByHold = true;
      this.tip.set(which as 'tmr' | 'stmr');
    }, 450);
  }

  protected tipRelease(): void {
    clearTimeout(this.tipTimer);
  }

  /** The menu a long press opens on a phone is not wanted on the pill. */
  protected noMenu(event: Event): void {
    if (this.tipByHold) event.preventDefault();
  }

  /** The keyboard focus shows the item line; the focus a tap gives does not (that tap has its own turn in `farm`). */
  protected focusTip(which: string, event: Event): void {
    if ((event.target as HTMLElement).matches(':focus-visible')) this.tip.set(which as 'tmr' | 'stmr');
  }

  /** A tap outside the card hides the item line that a touch left open. */
  protected outside(event: Event): void {
    if (!this.element.contains(event.target as Node)) this.tip.set(null);
  }

  /** A click on the TMR / STMR pill marks it as farmed while one is left to farm (not after a long press: that showed the item). */
  protected farm(which: string): void {
    if (this.tipByHold) {
      this.tipByHold = false;
      return;
    }
    if (this.readOnly()) return;
    const card = this.card();
    if (which === 'tmr' && card.farmable) this.farmedTmr.emit();
    else if (which === 'stmr' && card.farmableStmr) this.farmedStmr.emit();
  }
}
