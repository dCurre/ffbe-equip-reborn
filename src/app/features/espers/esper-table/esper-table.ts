import { Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { baseStats } from '../../../../core/constants/base-lists';
import { KillerList } from '../../../game/components/killer-list/killer-list';
import { ResistList } from '../../../game/components/resist-list/resist-list';
import { Alert } from '../../../shared/components/alert/alert';
import { Icon } from '../../../shared/components/icon/icon';
import { ServerContext } from '../../../shared/services/server-context';
import { calculateSp, esperSprite, EsperInfo, OwnedEsper, Stat, statBonus, statValue } from '../esper-model';

export type Column = 'index' | 'level' | Stat | 'resists' | 'killers';

/** One owned Esper of the table, with the SP it uses. */
export interface EsperRow {
  info: EsperInfo;
  index: number;
  esper: OwnedEsper;
  sp: ReturnType<typeof calculateSp>;
}

/** The stats of all the owned Espers, sortable by column. */
@Component({
  selector: 'app-esper-table',
  imports: [Alert, Icon, ResistList, KillerList, RouterLink],
  templateUrl: './esper-table.html',
  styleUrl: './esper-table.css',
})
export class EsperTable {
  readonly rows = input.required<EsperRow[]>();
  readonly columns = input.required<{ column: Column; label: string }[]>();
  readonly sort = input.required<{ column: Column; descending: boolean }>();
  readonly logged = input.required<boolean>();
  readonly ownedCount = input.required<number>();
  readonly sorted = output<Column>();
  readonly opened = output<string>();
  protected readonly serverContext = inject(ServerContext);

  protected readonly stats = baseStats as Stat[];
  protected readonly sprite = esperSprite;

  protected readonly bonus = statBonus;
  protected readonly value = statValue;

  protected stars(count: number): string {
    return '★'.repeat(count);
  }
}
