import { Component, computed, inject, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { PageContent } from '../../layout/page-content/page-content';
import { Alert } from '../../shared/components/alert/alert';
import { Icon } from '../../shared/components/icon/icon';
import { StaticData } from '../../shared/services/static-data';
import { STRINGS } from '../../strings/en';
import { GameEvent } from './events-model';
import { EventTable } from './event-table/event-table';

/** The events of the game; the `event` and `stage` parameters of the link say which one is open. */
@Component({
  selector: 'app-events',
  imports: [Alert, EventTable, Icon, PageContent],
  templateUrl: './events.html',
})
export class Events {
  protected readonly t = STRINGS.events;
  private readonly staticData = inject(StaticData);
  private readonly params = toSignal(inject(ActivatedRoute).queryParamMap);

  private readonly data = resource({ loader: () => this.staticData.get<GameEvent[]>('events') });
  protected readonly failed = computed(() => !!this.data.error());
  protected readonly loading = computed(() => this.data.isLoading());
  protected readonly events = computed(() => (this.data.hasValue() ? this.data.value() : []));
  protected readonly opened = computed(() => this.params()?.get('event') ?? null);
  /** the stages made from the wiki have negative ids */
  protected readonly stage = computed(() => Number(this.params()?.get('stage')) || null);
}
