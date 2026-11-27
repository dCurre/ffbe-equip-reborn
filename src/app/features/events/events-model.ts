import { Traits } from '../../game/components/monster-traits/monster-traits';

export interface Mission {
  id: number;
  /** null where the game data has no name */
  name: string | null;
}

/** A dungeon of an event; in a chamber (`Chamber of Arms`...) it is the section of one boss. */
export interface Dungeon {
  id: number;
  name: string | null;
  /** the release of the boss and its wiki page, in a chamber */
  date?: string;
  page?: string;
  /** the picture of the boss in `img/events`, in a chamber */
  banner?: string;
  missions: Mission[];
}

/** An event of `events.json`. */
export interface GameEvent {
  name: string;
  /** the wiki page when it is not the name; '' when there is none */
  page?: string;
  /** the first release of the Global version (`2016-09-30`), when known */
  date?: string;
  /** the later releases of the same dungeons */
  reruns?: string[];
  kind?: string;
  series?: string;
  /** its picture in `img/events` */
  banner?: string;
  dungeons?: Dungeon[];
}

/**
 * Where a monster comes from: the datamine of its mission (Global or Japan), the Japan battle tables (alone, or with
 * the HP and resistances of the wiki), the wiki (stats and resistances, or the resistances only), the monster list written
 * by hand for the Builder (`builderList`: the permanent trials), or nowhere (`unknown`: name, races and sometimes the HP).
 */
export type MonsterSource =
  'datamine' | 'datamineJp' | 'table' | 'tableWiki' | 'wiki' | 'wikiResists' | 'builderList' | 'unknown';

/** A monster of `dungeonMonsters.json`; null is a value nobody published. */
export interface Monster {
  name: string;
  hp: number | null;
  atk: number | null;
  def: number | null;
  mag: number | null;
  spr: number | null;
  races: string[];
  traits: Traits;
  /** its portrait, `img/monsters/<icon>.webp` */
  icon?: string;
  /** the stats a passive raises, in percent (as the buffs of the enemy in the Builder) */
  buffs?: Partial<Record<'atk' | 'def' | 'mag' | 'spr', number>>;
  source: MonsterSource;
}

/**
 * What the wiki says of a stage of `count` battles: the monsters (indexes) of the last one, the ones the others draw
 * from, and the ones of the stage it does not name.
 */
export interface BattleHints {
  count: number;
  last: number[];
  earlier: number[];
  other?: number[];
}

/**
 * `dungeonMonsters.json`: the monsters of each mission, as indexes in `monsters`. `battles` is there for the stages
 * of more than one battle: the monsters of each one in order, else the hints of the wiki, else only how many they are.
 */
export interface DungeonMonsters {
  monsters: Monster[];
  missions: Record<string, number[]>;
  battles?: Record<string, number[][] | BattleHints | number>;
}

export interface EventSort {
  by: 'name' | 'date';
  descending: boolean;
}

/** What tells an event apart in the data and in the link of its page. */
export const eventKey = (event: GameEvent): string => `${event.name}|${event.date ?? ''}|${event.page ?? '-'}`;

/** A dungeon, stage or monster of an event, with the stage that opens it. */
export interface Hit {
  name: string;
  stage: number;
}

/** The first hit of each name. */
const distinct = (hits: Hit[]): Hit[] => {
  const first = new Map<string, Hit>();
  for (const hit of hits) if (!first.has(hit.name)) first.set(hit.name, hit);
  return [...first.values()];
};

const matching = (event: GameEvent, hits: Hit[], text: string): Hit[] =>
  distinct(hits.filter(({ name }) => name !== event.name && name.toLowerCase().includes(text)));

/** The dungeons of an event (the boss sections of a chamber) found by the lower case text. */
export const matchingDungeons = (event: GameEvent, text: string): Hit[] =>
  matching(
    event,
    (event.dungeons ?? []).flatMap(({ name, missions }) =>
      name && missions.length ? [{ name, stage: missions[0].id }] : [],
    ),
    text,
  );

/**
 * The stages (the levels that are played) of an event found by the text, without the ones a found dungeon already says
 * ("Scorn of Amon - INT" of the dungeon "Scorn of Amon").
 */
export const matchingStages = (event: GameEvent, text: string): Hit[] => {
  const dungeons = matchingDungeons(event, text);
  const stages = (event.dungeons ?? []).flatMap((dungeon) =>
    dungeon.missions.flatMap(({ id, name }) => (name ? [{ name, stage: id }] : [])),
  );
  return matching(event, stages, text).filter(({ name }) => !dungeons.some((d) => name.startsWith(d.name)));
};

/** The monsters of an event, each with the first stage that has it (to search the event by boss). */
export const monsterHits = (event: GameEvent, data: DungeonMonsters): Hit[] =>
  distinct(
    (event.dungeons ?? []).flatMap((dungeon) =>
      dungeon.missions.flatMap(({ id }) =>
        (data.missions[id] ?? []).map((i) => ({ name: data.monsters[i].name, stage: id })),
      ),
    ),
  );

/** The name of a stage on its tab: without the name of the dungeon or of the event it starts with. */
export function stageLabel(stage: string, ...containers: (string | null)[]): string {
  for (const name of containers) {
    const rest = name && stage.startsWith(name) ? stage.slice(name.length).replace(/^[\s:–-]+/, '') : '';
    if (rest) return rest;
  }
  return stage;
}

/** The quests of an event: its dungeons with something to play (in a chamber, one for each boss). */
export const questCount = (event: GameEvent): number =>
  (event.dungeons ?? []).filter((dungeon) => dungeon.missions.length).length;

/** The type of event without the marks of the schedule (reruns, "trial-1"), to filter by it. */
export const eventType = (event: GameEvent): string =>
  (event.kind ?? '')
    .replace(/^\[(Rerun|Update)\]\s*/i, '')
    .replace(/\s*(-\d+|#\d+)\s*$/, '')
    .replace(/\bevents?\b/i, 'Event')
    .trim();

/** The events in the chosen order; by date, the ones without a date stay at the end in both directions. */
export function sortEvents(events: readonly GameEvent[], { by, descending }: EventSort): GameEvent[] {
  const direction = descending ? -1 : 1;
  const byName = (a: GameEvent, b: GameEvent): number => a.name.localeCompare(b.name, 'en', { numeric: true });
  return [...events].sort((a, b) => {
    if (by === 'name') return direction * byName(a, b);
    if (!a.date || !b.date) return Number(!a.date) - Number(!b.date) || byName(a, b);
    return direction * a.date.localeCompare(b.date) || byName(a, b);
  });
}
