import { Component, computed, inject, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { PageContent } from '../../layout/page-content/page-content';
import { Alert } from '../../shared/components/alert/alert';
import { Icon } from '../../shared/components/icon/icon';
import { ICONS } from '../../shared/components/icon/icon-map';
import { TabBar, TabItem } from '../../shared/components/tab-bar/tab-bar';
import { StaticData } from '../../shared/services/static-data';
import { STRINGS } from '../../strings/en';
import { GameEvent } from './events-model';
import { EventTable } from './event-table/event-table';

type View = 'events' | 'story';

/**
 * The events and the story of the game; the `view`, `event` and `stage` parameters of the link say which tab is shown
 * and what is open in it.
 */
@Component({
  selector: 'app-events',
  imports: [Alert, EventTable, Icon, PageContent, TabBar],
  templateUrl: './events.html',
  styleUrl: './events.css',
})
export class Events {
  protected readonly t = STRINGS.events;
  private readonly staticData = inject(StaticData);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.queryParamMap);

  protected readonly tabs: TabItem<View>[] = [
    // the "Vortex" and "World" buttons of the world map of the game, which have their name on them: the title is the tooltip
    { key: 'events', title: this.t.eventsTab, image: ICONS.vortex.src, kind: 'picture' },
    { key: 'story', title: this.t.storyTab, image: ICONS.world.src, kind: 'picture' },
  ];
  protected readonly view = computed<View>(() => (this.params()?.get('view') === 'story' ? 'story' : 'events'));
  private readonly eventList = resource({ loader: () => this.staticData.get<GameEvent[]>('events') });
  /** downloaded the first time its tab is shown */
  private readonly story = resource({
    params: () => (this.view() === 'story' ? true : undefined),
    loader: () => this.staticData.get<GameEvent[]>('storyChapters'),
  });
  private readonly data = computed(() => (this.view() === 'story' ? this.story : this.eventList));
  protected readonly failed = computed(() => !!this.data().error());
  protected readonly loading = computed(() => this.data().isLoading());
  protected readonly events = computed(() => {
    const data = this.data();
    return data.hasValue() ? data.value() : [];
  });
  protected readonly opened = computed(() => this.params()?.get('event') ?? null);
  /** the stages made from the wiki have negative ids */
  protected readonly stage = computed(() => Number(this.params()?.get('stage')) || null);

  /** What was open belongs to the other tab: it closes. */
  protected showView(view: View): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: view === 'story' ? view : null, event: null, stage: null },
      queryParamsHandling: 'merge',
    });
  }
}
