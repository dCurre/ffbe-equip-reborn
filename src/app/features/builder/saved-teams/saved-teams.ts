import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Button } from '../../../shared/components/button/button';
import { ConfirmModal } from '../../../shared/components/confirm-modal/confirm-modal';
import { Icon } from '../../../shared/components/icon/icon';
import { InputGroup } from '../../../shared/components/input-group/input-group';
import { Modal } from '../../../shared/components/modal/modal';
import { Panel } from '../../../shared/components/panel/panel';
import { Toast } from '../../../shared/services/toast';
import type { SavedTeams } from '../shared/saved-teams';

/** The teams saved in the Drive: the one being edited with its save buttons, and the list to load, import or delete. */
@Component({
  selector: 'app-saved-teams',
  imports: [Panel, Button, Icon, Modal, ConfirmModal, InputGroup],
  templateUrl: './saved-teams.html',
  styleUrl: './saved-teams.css',
})
export class SavedTeamsPanel {
  private readonly toast = inject(Toast);

  readonly teams = input.required<SavedTeams>();
  /** the builder has units: saving makes sense, and loading a team would replace them */
  readonly hasUnits = input.required<boolean>();
  readonly save = output<void>();
  readonly saveAs = output<string>();
  readonly loadTeam = output<number>();
  readonly importTeam = output<number>();

  protected readonly listOpen = signal(false);
  protected readonly nameOpen = signal(false);
  protected readonly name = signal('');
  protected readonly loadOpen = signal(false);
  protected readonly deleteOpen = signal(false);
  private readonly target = signal(-1);

  /** The newest team first. */
  protected readonly entries = computed(() =>
    this.teams()
      .teams()
      .map((saved, index) => ({ saved, index }))
      .reverse(),
  );

  protected async showList(): Promise<void> {
    if (await this.teams().load()) this.listOpen.set(true);
  }

  protected saveClicked(): void {
    if (this.teams().current() < 0) this.nameOpen.set(true);
    else this.save.emit();
  }

  protected confirmName(): void {
    const name = this.name().trim();
    if (!name) {
      this.toast.show('Please enter a name', 'error');
      return;
    }
    this.nameOpen.set(false);
    this.saveAs.emit(name);
  }

  protected loadClicked(index: number): void {
    this.target.set(index);
    if (this.hasUnits()) this.loadOpen.set(true);
    else this.confirmLoad();
  }

  protected confirmLoad(): void {
    this.loadOpen.set(false);
    this.listOpen.set(false);
    this.loadTeam.emit(this.target());
  }

  protected importClicked(index: number): void {
    this.listOpen.set(false);
    this.importTeam.emit(index);
  }

  protected deleteClicked(index: number): void {
    this.target.set(index);
    this.deleteOpen.set(true);
  }

  protected async confirmDelete(): Promise<void> {
    this.deleteOpen.set(false);
    await this.teams().remove(this.target());
  }
}
