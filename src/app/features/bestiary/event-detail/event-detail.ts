import { Component, computed, inject, input, output, resource } from '@angular/core';
import { Button } from '../../../shared/components/button/button';
import { Icon } from '../../../shared/components/icon/icon';
import { TabBar, TabItem } from '../../../shared/components/tab-bar/tab-bar';
import { WikiLink } from '../../../shared/components/wiki-link/wiki-link';
import { StaticData } from '../../../shared/services/static-data';
import { STRINGS } from '../../../strings/en';
import { DungeonMonsters, GameEvent, stageLabel } from '../bestiary-model';
import { MissionMonsters } from '../mission-monsters/mission-monsters';

/**
 * An event opened under its row: a tab for each dungeon, a tab for each stage of the dungeon, the monsters of the stage.
 * `stage` says what is open; Esc closes.
 */
@Component({
  selector: 'app-event-detail',
  imports: [Button, Icon, MissionMonsters, TabBar, WikiLink],
  host: { '(document:keydown)': 'onKey($event)' },
  templateUrl: './event-detail.html',
  styleUrl: './event-detail.css',
})
export class EventDetail {
  protected readonly t = STRINGS.bestiary;
  private readonly staticData = inject(StaticData);
  readonly event = input.required<GameEvent>();
  /** the id of the stage shown; the first one when null or not of this event */
  readonly stage = input<number | null>(null);
  readonly stageSelected = output<number>();
  readonly closed = output<void>();

  protected readonly monsters = resource({
    loader: () => this.staticData.get<DungeonMonsters>('dungeonMonsters'),
  });
  private readonly dungeons = computed(() => (this.event().dungeons ?? []).filter((d) => d.missions.length));
  protected readonly dungeon = computed(
    () => this.dungeons().find((d) => d.missions.some((m) => m.id === this.stage())) ?? this.dungeons()[0],
  );
  protected readonly mission = computed(
    () => this.dungeon()?.missions.find((m) => m.id === this.stage()) ?? this.dungeon()?.missions[0],
  );
  /** the tabs are keyed by the first stage of the dungeon: choosing one opens that stage */
  protected readonly dungeonTabs = computed<TabItem<string>[]>(() =>
    this.dungeons().map((d) => ({ key: String(d.missions[0].id), title: d.name ?? `${this.t.dungeon} ${d.id}` })),
  );
  /** each stage with how many monsters it has, once they are downloaded */
  protected readonly stageTabs = computed<TabItem<string>[]>(() => {
    const data = this.monsters.hasValue() ? this.monsters.value() : undefined;
    return (this.dungeon()?.missions ?? []).map(({ id, name }) => ({
      key: String(id),
      title: name ? stageLabel(name, this.dungeon().name, this.event().name) : `${this.t.mission} ${id}`,
      count: data?.missions[id]?.length ?? (data ? 0 : undefined),
    }));
  });

  protected open(stage: string): void {
    this.stageSelected.emit(Number(stage));
  }

  protected onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    // Esc of a field, a menu or a dialog belongs to it
    if (event.key !== 'Escape' || event.defaultPrevented || target.closest?.('input, textarea, dialog')) return;
    this.closed.emit();
  }
}
