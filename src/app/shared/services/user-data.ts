import { inject, Injectable } from '@angular/core';
import { GoogleDrive } from './google-drive';
import { ServerContext } from './server-context';

/** The files of the user's data in the Drive app folder; the file name is `<table>_<server>.json`, as on the old site. */
export type UserTable = 'itemInventory' | 'units' | 'espers' | 'consumables' | 'savedTeams' | 'settings' | 'clearedMissions';

/** The user's inventory, units, espers and consumables, one set per game server. */
@Injectable({ providedIn: 'root' })
export class UserData {
  private readonly drive = inject(GoogleDrive);
  private readonly serverContext = inject(ServerContext);

  readonly loggedIn = this.drive.loggedIn;

  read<T = Record<string, unknown>>(table: UserTable, emptyValue = {} as T): Promise<T> {
    return this.drive.readJson<T>(this.fileName(table), emptyValue);
  }

  write(table: UserTable, data: unknown): Promise<void> {
    return this.drive.writeJson(this.fileName(table), data);
  }

  private fileName(table: UserTable): string {
    return `${table}_${this.serverContext.server()}.json`;
  }
}
