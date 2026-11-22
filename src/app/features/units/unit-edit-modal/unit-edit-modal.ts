import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Inventory, OwnedUnit } from '../../../shared/services/inventory';
import { Modal } from '../../../shared/components/modal/modal';
import { applyEdit, GameUnit, maxTrust, num, parseMoogles, UnitEdit } from '../unit-model';

/** Edits what the user owns of one unit: the copies, the TMR / STMR owned, the NV extras and the TMR moogles. */
@Component({
  selector: 'app-unit-edit-modal',
  imports: [FormsModule, Modal],
  templateUrl: './unit-edit-modal.html',
  styleUrl: './unit-edit-modal.css',
})
export class UnitEditModal {
  private readonly inventory = inject(Inventory);
  /** the units with a TMR in the game: only those have moogles to edit */
  readonly tmr = input.required<Record<string, { id: string }>>();
  /** the STMR of each unit */
  readonly stmr = input.required<Record<string, { id: string }>>();
  readonly saved = output<void>();

  protected readonly unit = signal<GameUnit | null>(null);
  protected readonly open = signal(false);
  protected readonly error = signal('');
  protected edit: UnitEdit = emptyEdit();
  /** the TMR / STMR of the unit in the inventory */
  protected owned = { tmr: 0, stmr: 0 };

  /** Opens the dialog on a unit, with what the user owns of it. */
  show(unit: GameUnit): void {
    this.owned = {
      tmr: this.inventory.count(this.tmr()[unit.id]?.id ?? ''),
      stmr: this.inventory.count(this.stmr()[unit.id]?.id ?? ''),
    };
    const mine: Partial<OwnedUnit> = this.inventory.units()[unit.id] ?? {};
    this.edit = {
      number: mine.number ?? 0,
      sevenStar: mine.sevenStar ?? 0,
      nv: mine.nv ?? 0,
      exRank: String(mine.exRank ?? 0),
      fragments: unit.fragmentId ? (this.inventory.consumables()[unit.fragmentId] ?? 0) : 0,
      tmrMoogles: (mine.tmrMoogles ?? []).join(', '),
    };
    this.error.set('');
    this.unit.set(unit);
    this.open.set(true);
  }

  protected save(): void {
    const unit = this.unit()!;
    const moogles = parseMoogles(this.edit.tmrMoogles);
    if (!moogles) {
      this.error.set('Wrong value for the TMR Moogles: use numbers separated by commas');
      return;
    }
    const values: UnitEdit = {
      ...this.edit,
      number: num(this.edit.number),
      sevenStar: num(this.edit.sevenStar),
      nv: num(this.edit.nv),
      fragments: num(this.edit.fragments),
      // a number input gives a number (or null when emptied), not the text the field started with
      exRank: String(this.edit.exRank ?? ''),
    };
    const max = maxTrust(unit, values);
    const farmed = {
      tmr: Math.min(Math.max(0, num(this.owned.tmr)), max.tmr),
      stmr: Math.min(Math.max(0, num(this.owned.stmr)), max.stmr),
    };
    for (const [item, count] of [[this.tmr()[unit.id], farmed.tmr], [this.stmr()[unit.id], farmed.stmr]] as const) {
      if (!item) continue;
      if (count) this.inventory.items()[item.id] = count;
      else delete this.inventory.items()[item.id];
    }
    applyEdit(this.inventory.units(), unit, values, moogles, farmed);
    if (unit.max_rarity === 'NV' && unit.fragmentId) this.inventory.consumables()[unit.fragmentId] = values.fragments;
    this.open.set(false);
    this.saved.emit();
  }

  /** The most TMR / STMR the unit can have with the copies typed so far. */
  protected max(): { tmr: number; stmr: number } {
    return maxTrust(this.unit()!, {
      number: num(this.edit.number),
      sevenStar: num(this.edit.sevenStar),
      nv: num(this.edit.nv),
    });
  }

  /** Which fields the dialog shows. */
  protected canEdit(field: 'nv' | 'sevenStar' | 'number' | 'stmr' | 'tmr' | 'nvExtras' | 'moogles'): boolean {
    const unit = this.unit();
    if (!unit) return false;
    const max = String(unit.max_rarity);
    switch (field) {
      case 'nv':
      case 'nvExtras':
        return max === 'NV';
      case 'sevenStar':
        return max === '7' || (max === 'NV' && unit.min_rarity !== 'NV');
      case 'number':
        return Number(unit.min_rarity) < 7;
      case 'tmr':
        return !!this.tmr()[unit.id];
      case 'stmr':
        return !!this.stmr()[unit.id] && (max === '7' || max === 'NV');
      case 'moogles':
        return !!this.tmr()[unit.id];
      default:
        return true;
    }
  }
}

function emptyEdit(): UnitEdit {
  return { number: 0, sevenStar: 0, nv: 0, exRank: '', fragments: 0, tmrMoogles: '' };
}
