import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Button } from '../../../shared/components/button/button';
import { Combobox } from '../../../shared/components/combobox/combobox';
import { Icon } from '../../../shared/components/icon/icon';
import { SearchBox } from '../../../shared/components/search-box/search-box';
import { WikiLink } from '../../../shared/components/wiki-link/wiki-link';
import { ServerContext } from '../../../shared/services/server-context';
import { StaticData } from '../../../shared/services/static-data';
import { UserData } from '../../../shared/services/user-data';
import { STRINGS } from '../../../strings/en';
import {
  DungeonMonsters,
  eventKey,
  EventSort,
  eventType,
  GameEvent,
  Hit,
  matchingDungeons,
  matchingStages,
  questCount,
  monsterHits,
  sortEvents,
} from '../events-model';
import { EventDetail } from '../event-detail/event-detail';

/** How many of the stages, dungeons or monsters found are written under an event. */
const SHOWN = 3;

/** A line under a found event: the first names found (each opens its stage) and how many more there are. */
const line = (label: string, hits: Hit[]) => ({ label, hits: hits.slice(0, SHOWN), more: hits.length - SHOWN });

const distinct = (values: (string | undefined)[]): string[] =>
  [...new Set(values.filter((value): value is string => !!value))].sort((a, b) => a.localeCompare(b));

/**
 * All the events, with search (by name, stage, dungeon or monster), filters by type and series, and the order by name or
 * release. One event at a time opens under its row; the link of the page keeps which one and which stage.
 */
@Component({
  selector: 'app-event-table',
  imports: [Button, Combobox, EventDetail, Icon, SearchBox, WikiLink],
  templateUrl: './event-table.html',
  styleUrl: './event-table.css',
})
export class EventTable {
  protected readonly t = STRINGS.events;
  readonly events = input.required<readonly GameEvent[]>();
  readonly loading = input(false);
  private readonly searchBox = viewChild.required(SearchBox);
  /** the key of the event opened, and the stage shown in it */
  readonly opened = input<string | null>(null);
  readonly stage = input<number | null>(null);
  private readonly staticData = inject(StaticData);
  private readonly userData = inject(UserData);
  private readonly serverContext = inject(ServerContext);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly openedRow = viewChild<ElementRef<HTMLElement>>('openedRow');

  protected readonly query = signal('');
  protected readonly type = signal('');
  protected readonly series = signal('');
  protected readonly sort = signal<EventSort>({ by: 'date', descending: false });
  protected readonly types = computed(() => distinct(this.events().map(eventType)));
  protected readonly allSeries = computed(() => distinct(this.events().map((event) => event.series)));
  /** the stages of the imported save, in the account of the user */
  protected readonly cleared = resource({
    params: () => (this.userData.loggedIn() ? this.serverContext.server() : undefined),
    loader: async () => new Set(await this.userData.read<number[]>('clearedMissions', [])),
  });
  protected readonly completed = computed(() => (this.cleared.hasValue() ? this.cleared.value() : new Set<number>()));
  /** the monsters (over 2 MB) are downloaded at the first search */
  protected readonly monsters = resource({
    params: () => (this.query().trim() ? true : undefined),
    loader: () => this.staticData.get<DungeonMonsters>('dungeonMonsters'),
  });
  private readonly monsterNames = computed(() => {
    const data = this.monsters.hasValue() ? this.monsters.value() : undefined;
    return new Map(data ? this.events().map((event) => [event, monsterHits(event, data)]) : []);
  });
  protected readonly rows = computed(() => {
    const text = this.query().trim().toLowerCase();
    const type = this.type();
    const series = this.series();
    const names = this.monsterNames();
    // the monsters of an event with the text in their name
    const monstersOf = (event: GameEvent): Hit[] =>
      text ? (names.get(event) ?? []).filter(({ name }) => name.toLowerCase().includes(text)) : [];
    const found = this.events()
      .filter((event) => (!type || eventType(event) === type) && (!series || event.series === series))
      .map((event) => ({
        event,
        dungeons: text ? matchingDungeons(event, text) : [],
        stages: text ? matchingStages(event, text) : [],
        monsters: monstersOf(event),
      }))
      .filter(
        ({ event, dungeons, stages, monsters }) =>
          dungeons.length || stages.length || monsters.length || event.name.toLowerCase().includes(text),
      );
    const matched = new Map(found.map((hit) => [hit.event, hit]));
    return sortEvents([...matched.keys()], this.sort()).map((event) => {
      const hit = matched.get(event);
      const quests = questCount(event);
      return {
        event,
        key: eventKey(event),
        quests,
        several: quests > 1,
        lines: [
          line(this.t.dungeons, hit?.dungeons ?? []),
          line(this.t.missions, hit?.stages ?? []),
          line(this.t.monsters, hit?.monsters ?? []),
        ].filter(({ hits }) => hits.length),
      };
    });
  });

  constructor() {
    // a link to an event, or the one above closing, can leave the opened row out of sight
    afterRenderEffect(() => {
      const row = this.openedRow()?.nativeElement.previousElementSibling;
      if (!row) return;
      const { top } = row.getBoundingClientRect();
      if (top < 0 || top > window.innerHeight * 0.7) row.scrollIntoView({ block: 'start' });
    });
  }

  /** Back to every event: the search and the two filters empty. */
  protected clearFilters(): void {
    this.type.set('');
    this.series.set('');
    this.searchBox().clear();
  }

  protected toggle(key: string): void {
    this.show(key === this.opened() ? null : key, null);
  }

  /** The link of the page says what is open; changing the stage does not add a step to the history. */
  protected show(event: string | null, stage: number | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { event, stage },
      queryParamsHandling: 'merge',
      replaceUrl: event === this.opened(),
    });
  }

  /** A second click on a column turns the order around; a new column starts with A–Z or the oldest. */
  protected sortBy(by: EventSort['by']): void {
    this.sort.update((sort) => ({ by, descending: sort.by === by && !sort.descending }));
  }

  protected ariaSort(by: EventSort['by']): string | null {
    if (this.sort().by !== by) return null;
    return this.sort().descending ? 'descending' : 'ascending';
  }
}
