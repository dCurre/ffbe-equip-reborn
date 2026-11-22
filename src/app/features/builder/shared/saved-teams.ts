import { computed, signal } from '@angular/core';
import type { Toast } from '../../../shared/services/toast';
import type { UserData } from '../../../shared/services/user-data';

/* eslint-disable @typescript-eslint/no-explicit-any -- a team is the data of a build link */

export interface SavedTeam {
  name: string;
  team: any;
}

/** The teams the user saved in the Drive (the `savedTeams` file), and which one is open in the builder. */
export class SavedTeams {
  readonly teams = signal<readonly SavedTeam[]>([]);
  /** the index of the team being edited, -1 for a new one */
  readonly current = signal(-1);
  readonly title = computed(() => {
    const team = this.teams()[this.current()];
    return team ? `Saved team : ${team.name}` : 'New team';
  });

  private file: Record<string, unknown> = {};
  private loaded = false;

  constructor(
    private readonly userData: UserData,
    private readonly toast: Toast,
  ) {}

  /** Reads the teams the first time; false when the Drive could not be read. */
  async load(): Promise<boolean> {
    if (this.loaded) return true;
    try {
      this.file = await this.userData.read<Record<string, unknown>>('savedTeams');
      this.teams.set((this.file['teams'] as SavedTeam[] | undefined) ?? []);
      this.loaded = true;
      return true;
    } catch {
      this.toast.show('An error occured while trying to load your saved teams from Google Drive.', 'error');
      return false;
    }
  }

  /** Saves over the team being edited. */
  async save(team: any): Promise<void> {
    const index = this.current();
    await this.write(this.teams().map((saved, i) => (i === index ? { ...saved, team } : saved)));
  }

  /** Saves a new team, which becomes the one being edited. */
  async saveAs(name: string, team: any): Promise<void> {
    if (!(await this.load())) return;
    if (await this.write([...this.teams(), { name, team }])) this.current.set(this.teams().length - 1);
  }

  async remove(index: number): Promise<void> {
    const current = this.current();
    if (!(await this.write(this.teams().filter((_, i) => i !== index)))) return;
    if (current === index) this.current.set(-1);
    else if (current > index) this.current.set(current - 1);
  }

  private async write(teams: readonly SavedTeam[]): Promise<boolean> {
    try {
      await this.userData.write('savedTeams', { ...this.file, teams });
      this.teams.set(teams);
      this.toast.show('Team saved', 'success');
      return true;
    } catch {
      this.toast.show('An error occured while trying to save the team.', 'error');
      return false;
    }
  }
}
