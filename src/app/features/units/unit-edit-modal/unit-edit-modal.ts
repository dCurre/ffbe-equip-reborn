import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Inventory, OwnedUnit } from '../../../shared/services/inventory';
import { Button } from '../../../shared/components/button/button';
import { Modal } from '../../../shared/components/modal/modal';
import { applyEdit, GameUnit, num, parseMoogles, UnitEdit } from '../unit-model';

/** Edits what the user owns of one unit: the copies, what can still be farmed, the NV extras and the TMR moogles. */
@Component({
  selector: 'app-unit-edit-modal',
  imports: [FormsModule, Modal, Button],
  templateUrl: './unit-edit-modal.html',
  styleUrl: './unit-edit-modal.css',
})
export class UnitEditModal {
  private readonly inventory = inject(Inventory);
  /** the units with a TMR in the game: only those have moogles to edit */
  readonly tmr = input.required<Record<string, unknown>>();
  readonly saved = output<void>();

  protected readonly unit = signal<GameUnit | null>(null);
  protected readonly open = signal(false);
  protected readonly error = signal('');
  protected edit: UnitEdit = emptyEdit();

  /** Opens the dialog on a unit, with what the user owns of it. */
  show(unit: GameUnit): void {
    const mine: Partial<OwnedUnit> = this.inventory.units()[unit.id] ?? {};
    this.edit = {
      number: mine.number ?? 0,
      farmable: mine.farmable ?? 0,
      sevenStar: mine.sevenStar ?? 0,
      farmableStmr: mine.farmableStmr ?? 0,
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
      farmable: num(this.edit.farmable),
      sevenStar: num(this.edit.sevenStar),
      farmableStmr: num(this.edit.farmableStmr),
      nv: num(this.edit.nv),
      fragments: num(this.edit.fragments),
    };
    applyEdit(this.inventory.units(), unit, values, moogles);
    if (unit.max_rarity === 'NV' && unit.fragmentId) this.inventory.consumables()[unit.fragmentId] = values.fragments;
    this.open.set(false);
    this.saved.emit();
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
      case 'stmr':
        return max === '7' || max === 'NV';
      case 'moogles':
        return !!this.tmr()[unit.id];
      default:
        return true;
    }
  }
}

function emptyEdit(): UnitEdit {
  return { number: 0, farmable: 0, sevenStar: 0, farmableStmr: 0, nv: 0, exRank: '', fragments: 0, tmrMoogles: '' };
}
