// Builds `public/ALL/events.json` (and `storyChapters.json`, the story chapters kept aside):
// 1. the Global releases of the wiki page Update_Schedule, the pages of its Category:Events, the events of Elvlin only;
// 2. each one linked to its dungeons and missions by name (`match` says how: automatic, not checked one by one).
import assert from 'node:assert';
import fs from 'node:fs';
import { parseSchedule } from './parsers.mjs';
import { eventSlug as norm, FARPLANE_TRIALS, json, ndjson, published, slug, wikiPage } from './sources.mjs';

const AE = json('aenigmatic/dungeons.json');
const archive = Object.values(json('elvlin/event_archive.json').events);

// --- dungeons, areas and missions: aEnigmatic, the newest client texts, the older Global texts ---
const dungeons = new Map();
const areas = new Map();
const missions = new Map();
for (const [id, d] of Object.entries(AE))
  dungeons.set(+id, {
    name: d.names?.[0] ?? null,
    area: +d.subregion_id || null,
    missions: new Map(Object.entries(d.missions ?? {}).map(([m, name]) => [+m, name])),
  });
const textId = (row) => +row.key.split('_').pop();
for (const row of ndjson('pack/F_DUNGEON_MST.ndjson')) {
  const id = +row.U9iHsau3;
  if (!dungeons.has(id)) dungeons.set(id, { name: null, missions: new Map() });
  dungeons.get(id).area = +row.uv60hgDW;
}
for (const row of ndjson('pack/F_TEXT_DUNGEON_NAME.ndjson')) {
  const dungeon = dungeons.get(textId(row));
  if (dungeon) dungeon.name ??= row.v[0];
}
for (const row of ndjson('pack/F_TEXT_AREA_NAME.ndjson')) areas.set(textId(row), row.v[0]);

const index = () => new Map();
const add = (map, name, value) => {
  const key = norm(name);
  if (key) (map.get(key) ?? map.set(key, new Set()).get(key)).add(value);
};
const [byDungeon, byArea, byMission, byPage, byIntro, byArchive, byName] = Array.from({ length: 7 }, index);
/** A mission "Name - PRO" is also the event "Name". */
const addMission = (name, id) => {
  add(byMission, name, id);
  add(byMission, String(name).replace(/\s*-\s*(BGN|INT|ADV|EXT|ELT|PRO|LGD|CHAOS)$/i, ''), id);
};

for (const [id, d] of dungeons) add(byDungeon, d.name, id);
for (const [id, name] of areas) for (const [d, v] of dungeons) if (v.area === id) add(byArea, name, d);
for (const [id, m] of Object.entries(json('aenigmatic/missions.json')))
  missions.set(+id, { name: m.name, dungeon: +m.dungeon_id });
for (const row of ndjson('pack/F_TEXT_MISSION.ndjson')) {
  const id = textId(row);
  const dungeon = Math.floor(id / 100);
  if (row.key.startsWith('MST_MISSION_NAME') && !missions.has(id))
    missions.set(id, { name: row.v[0], dungeon: dungeons.has(dungeon) ? dungeon : null });
}
for (const [id, m] of missions) addMission(m.name, id);
const older = (kind) =>
  Object.entries(json(`aenigmatic/MST_${kind}_NAME.json`)).map(([key, v]) => [
    +key.split('_').pop(),
    String(v[0]).replace(/\u001a/g, ' '),
  ]);
for (const [id, name] of older('DUNGEONS')) {
  if (!dungeons.has(id)) dungeons.set(id, { name, area: null, missions: new Map() });
  add(byDungeon, name, id);
}
for (const [id, name] of older('AREA'))
  for (const [d, v] of dungeons) if (v.area === id || (!v.area && Math.floor(d / 100) === id)) add(byArea, name, d);
for (const [id, name] of older('MISSION')) {
  // an id the newer data hold without a name was given to something else: its old name leads to the wrong dungeon
  if (missions.has(id) && !missions.get(id).name) continue;
  if (!missions.has(id)) missions.set(id, { name, dungeon: Math.floor(id / 100) });
  addMission(name, id);
}
for (const [id, m] of Object.entries(json('elvlin/event_encounters.json').missions))
  add(byPage, m.source_page?.replace(/_/g, ' ') ?? wikiPage(m.source_url), +id);
(function intros(node) {
  if (!node || typeof node !== 'object') return;
  if (node.mission && node.source_page) add(byIntro, wikiPage(node.source_page), +node.mission);
  Object.values(node).forEach(intros);
})(json('elvlin/omitted_global_event_sources.json'));
for (const e of archive) {
  add(byArchive, e.name, e);
  add(byArchive, wikiPage(e.source_page), e);
}
// the first link of a release uses only the aEnigmatic dungeons and the Elvlin events
for (const [id, d] of Object.entries(AE)) if (d.names?.[0]) add(byName, d.names[0], +id);
for (const e of archive)
  for (const id of e.dungeons ?? []) {
    add(byName, e.name, +id);
    add(byName, wikiPage(e.source_page), +id);
  }

const dungeonsOf = (ids) =>
  [...ids].map((id) => {
    const d = dungeons.get(id);
    const all = new Map(d?.missions ?? []);
    for (const [m, v] of missions) if (v.dungeon === id && !all.has(m)) all.set(m, v.name);
    return { id, name: d?.name ?? null, missions: [...all].map(([m, name]) => ({ id: m, name })) };
  });
const fromMissions = (ids) => {
  const grouped = new Map();
  for (const m of ids) {
    const d = missions.get(m)?.dungeon ?? Math.floor(m / 100);
    (grouped.get(d) ?? grouped.set(d, []).get(d)).push(m);
  }
  return [...grouped].map(([id, list]) => ({
    id,
    name: dungeons.get(id)?.name ?? null,
    missions: list.map((m) => ({ id: m, name: missions.get(m)?.name ?? null })),
  }));
};
const areaOf = (d) => dungeons.get(d.id)?.area ?? Math.floor(d.id / 100);

/** A `Page#section` link is the whole chamber: only the name is the trial. */
const keysOf = (e) => [e.name, e.page?.includes('#') ? null : e.page].filter(Boolean).map(norm);
const union = (map, keys) => new Set(keys.flatMap((key) => [...(map.get(key) ?? [])]));

function link(e) {
  if (e.dungeons.length || e.eventIds.length) {
    e.match ??= 'name';
    if (!e.dungeons.length) {
      const ids = archive.filter((a) => e.eventIds.includes(+a.area)).flatMap((a) => (a.dungeons ?? []).map(Number));
      e.dungeons = dungeonsOf(new Set(ids));
    }
    return e;
  }
  const keys = keysOf(e);
  const unit = e.name.match(/^Unit Intro - (.+)/)?.[1];
  const tries = [
    ['archive', () => dungeonsOf(new Set([...union(byArchive, keys)].flatMap((a) => (a.dungeons ?? []).map(Number))))],
    ['unitIntro', () => fromMissions(union(byIntro, keys))],
    ['dungeon', () => dungeonsOf(union(byDungeon, keys))],
    ['area', () => dungeonsOf(union(byArea, keys))],
    ['encounterPage', () => fromMissions(union(byPage, keys))],
    ['mission', () => fromMissions(union(byMission, keys))],
  ];
  for (const [how, find] of tries) {
    const found = find();
    if (!found.length) continue;
    e.dungeons = found;
    e.match = how;
    e.eventIds = [...new Set(found.map(areaOf))];
    if (e.eventIds.length > 1) e.ambiguous = true;
    return e;
  }
  // a Unit Intro mission is named after the unit, inside the Unit Intro dungeons (965...)
  const intro = unit ? [...(byMission.get(norm(unit)) ?? [])].filter((m) => String(m).startsWith('965')) : [];
  if (intro.length) {
    e.dungeons = fromMissions(intro);
    e.match = 'mission';
    e.eventIds = [...new Set(e.dungeons.map(areaOf))];
    return e;
  }
  e.match = null;
  return e;
}

// --- the events ---
const releases = parseSchedule(json('wiki/Update_Schedule.json').Update_Schedule).map((entry) => {
  const keys = keysOf(entry);
  const found = [...union(byName, keys)].map((id) => ({
    id,
    name: AE[id]?.names?.[0] ?? null,
    missions: Object.entries(AE[id]?.missions ?? {}).map(([m, name]) => ({ id: +m, name })),
  }));
  const eventIds = [
    ...new Set(
      archive
        .filter((a) => keys.includes(norm(a.name)) || a.dungeons?.some((d) => found.some((x) => x.id === +d)))
        .map((a) => +a.area),
    ),
  ];
  return { ...entry, dungeons: found, eventIds };
});
const events = releases.map((e) => link({ ...e, source: 'schedule' }));
const seen = new Set(events.flatMap((e) => [norm(e.name), norm(e.page?.split('#')[0])]));
for (const page of json('wiki/events.json'))
  if (!seen.has(norm(page))) {
    seen.add(norm(page));
    events.push(link({ name: page, page, dungeons: [], eventIds: [], source: 'wiki' }));
  }
const used = new Set(events.flatMap((e) => e.eventIds));
for (const a of archive)
  if (!used.has(+a.area) && !seen.has(norm(a.name)))
    events.push({
      type: 'Event',
      kind: a.kind ?? null,
      name: a.name,
      page: wikiPage(a.source_page) || null,
      series: a.collaboration ?? null,
      eventIds: [+a.area],
      dungeons: dungeonsOf(new Set((a.dungeons ?? []).map(Number))),
      match: 'archive',
      source: 'elvlin',
    });

// --- trials the data names otherwise: the names of their missions or dungeons are in the headings of their wiki page ---
const releasePages = json('wiki/releasePages.json');
// "Chamber of Arms - Warrior of Bravery", found by the whole name or the last part
const chamber = new Map();
for (const [id, m] of missions) {
  const short = String(m.name).match(/^(?:Hidden )?Chamber of Arms - (.+)/)?.[1];
  if (!short) continue;
  for (const name of [m.name, short]) (chamber.get(slug(name)) ?? chamber.set(slug(name), []).get(slug(name))).push(id);
}
const unlinked = events.filter((e) => !e.dungeons.length && !e.eventIds.length);
// an entry named after one mission ("Sheratan - The Troubled Strategist (Vengeance)") keeps it for itself
const own = new Map(unlinked.map((e) => [e, chamber.get(slug(e.name.split(' - ').pop())) ?? []]));
const claimed = new Set(unlinked.filter((e) => e.name.includes(' - ')).flatMap((e) => own.get(e)));
for (const e of unlinked) {
  const page = releasePages[e.page && !e.page.includes('#') ? e.page : e.name];
  const headings = [...(page?.text.matchAll(/^(?:<[^>]*>)*==+\s*(.*?)\s*==+/gm) ?? [])].map((m) => m[1]);
  const ids = own.get(e).length
    ? own.get(e)
    : [...new Set(headings.flatMap((h) => chamber.get(slug(h)) ?? []))].filter((id) => !claimed.has(id));
  // else the dungeon of the page a redirect leads to, or of the pages a heading links
  const names = [page?.title, ...headings.map((h) => h.match(/^\[\[([^\]|]+)/)?.[1])].filter(Boolean);
  const found = ids.length ? fromMissions(ids) : dungeonsOf(union(byDungeon, names.map(norm)));
  if (!found.length) continue;
  e.dungeons = found;
  e.eventIds = [...new Set(found.map(areaOf))];
  e.match = 'wikiPage';
}

// Dark Visions: the N-th episode is the N-th Elvlin area (by number), the release dates agree
const visionAreas = archive.filter((a) => a.name === 'Dark Visions').sort((a, b) => a.area - b.area);
const number = (e) => +e.name.match(/\d+$/)[0];
const episodes = events.filter((e) => /Advent of Chaos #\d+$/.test(e.name)).sort((a, b) => number(a) - number(b));
const visionDungeons = new Map(episodes.flatMap((e) => e.dungeons).map((d) => [d.id, d]));
assert(visionAreas.length === episodes.length, 'Dark Visions episodes and areas differ');
episodes.forEach((e, i) => {
  const a = visionAreas[i];
  assert(Math.abs(new Date(a.release) - new Date(e.date)) <= 3 * 864e5, `date of ${e.name}`);
  e.dungeons = a.dungeons.map((id) => visionDungeons.get(+id));
  assert(e.dungeons.every(Boolean), `dungeons of ${e.name}`);
  e.eventIds = [+a.area];
  e.match = 'darkVisionsOrder';
  delete e.ambiguous;
});
// missions without a dungeon in the data: the dungeon is the mission id without its last two digits
for (const e of events) {
  if (e.dungeons.every((d) => Number.isInteger(d.id))) continue;
  const grouped = new Map();
  for (const d of e.dungeons)
    for (const m of d.missions) {
      const id = Number.isInteger(d.id) ? d.id : Math.floor(m.id / 100);
      if (!grouped.has(id)) grouped.set(id, { id, name: d.name ?? AE[id]?.names?.[0] ?? null, missions: [] });
      grouped.get(id).missions.push(m);
    }
  e.dungeons = [...grouped.values()];
  e.eventIds = [...new Set(e.dungeons.map((d) => +AE[d.id]?.subregion_id || Math.floor(d.id / 100)))];
}

// the category of the wiki also holds the pages of some abilities and items
const pages = json('wiki/eventPages.json');
const notAnEvent = (e) =>
  e.source === 'wiki' &&
  !e.dungeons.length &&
  !e.eventIds.length &&
  (/^(Element|Trap Element) -/.test(e.name) ||
    /(Type'''\s*:|\|\s*type\s*=)\s*(Active|Passive|Accessory|Sword)/i.test(pages[e.name] ?? ''));

// left out on purpose: the quests that only show off a new unit ("... and Story Event" is a story event, it stays)
// the "FFBE - Story Event" entries (craft material quests), the "Character Episodes" and the unit popularity contests
const leftOut = (e) =>
  /^Unit Intro|Popularity Contest/i.test(e.name) ||
  /^(U\.Intro Events?|FFBE - Story Event|Character Episodes)$/i.test(e.kind || e.type || '');

const list = [];
const chapters = [];
const written = new Set();
for (const e of events) {
  if (notAnEvent(e) || leftOut(e)) continue;
  const out = { name: e.name };
  if (e.page && e.page !== e.name) out.page = e.page;
  else if (!e.page) out.page = '';
  if (e.date) out.date = e.date;
  if (e.kind || e.type) out.kind = e.kind || e.type;
  if (e.series) out.series = e.series;
  if (e.eventIds.length) out.eventIds = e.eventIds;
  if (e.dungeons.length) out.dungeons = e.dungeons.map(({ id, name, missions: m }) => ({ id, name, missions: m }));
  if (e.match) out.match = e.match;
  if (e.ambiguous) out.ambiguous = true;
  const key = `${out.name}|${out.date}|${out.page ?? ''}`;
  if (written.has(key)) continue;
  written.add(key);
  (e.type === 'Story' || /\/Story$/.test(e.name) ? chapters : list).push(out);
}
// --- the trials of a permanent chamber are one event, with a section for each boss and its release ---
const CHAMBERS = [
  { name: 'Chamber of the Fallen', match: /Chamber of the Fallen/i },
  { name: 'Chamber of the Indignant', match: /Chamber of the Indignant/i },
  { name: 'Chamber of the Vengeful', match: /Chamber of the Vengeful/i },
  { name: 'Chamber of Arms', match: /Chamber of Arm/i },
  { name: 'Advent of Purgatory', match: /Advent of Purgatory/i },
  { name: 'Series Boss Battle', match: /^Series Boss Battle/i, kind: 'Boss series' },
  { name: 'Twelve Types Takedown', match: /^Twelve Types/i, kind: 'Boss series' },
];
/** The section of one boss: all the missions of its entry. */
const section = (name, entry, found) => ({
  id: entry?.dungeons?.[0]?.id ?? Math.floor((found[0]?.id ?? 0) / 100),
  name,
  ...(entry?.date && { date: entry.date }),
  ...(entry?.page !== '' && { page: entry?.page ?? name }),
  missions: found,
});
const missionsIn = (entry) => (entry.dungeons ?? []).flatMap((d) => d.missions);
const group = (name, page, kind, sections, entries) => {
  const dates = sections.map((x) => x.date).filter(Boolean);
  const ids = [...new Set(entries.flatMap((e) => e.eventIds ?? []))];
  return {
    name,
    ...(page && { page }),
    ...(dates.length && { date: dates.sort()[0] }),
    kind,
    ...(ids.length && { eventIds: ids }),
    dungeons: sections,
    match: 'chamber',
  };
};
/** Takes the entries that match out of the list. */
const take = (test) => {
  const taken = list.filter(test);
  for (const e of taken) list.splice(list.indexOf(e), 1);
  return taken;
};

// the Farplane first: the schedule files one of its bosses under the Chamber of Arms, and lists it twice
const towerNames = new Set(FARPLANE_TRIALS.flatMap((t) => t.events));
const tower = take((e) => towerNames.has(e.name));
const towerSections = FARPLANE_TRIALS.map((t) => {
  const entry = tower.find((e) => t.events.includes(e.name));
  const mission = [{ id: t.mission, name: 'The Farplane' }];
  return section(t.boss, entry && { date: entry.date }, mission);
});
const groups = [group('Farplane (Tower of Earth)', 'Farplane', 'Trial chamber', towerSections, tower)];
for (const { name, match, kind = 'Trial chamber' } of CHAMBERS) {
  const entries = take((e) => match.test(e.kind ?? '')).sort((a, b) => (a.date ?? '9').localeCompare(b.date ?? '9'));
  // "Kefka - EXT" has its own section and release: the section of "Kefka" leaves those stages to it
  const own = (e) => {
    const later = new Set(
      entries.filter((x) => x.name.startsWith(`${e.name} - `)).flatMap((x) => missionsIn(x).map((m) => m.id)),
    );
    return missionsIn(e).filter((m) => !later.has(m.id));
  };
  const sections = entries.map((e) => section(e.name.replace(`${name} - `, ''), e, own(e)));
  groups.push(group(name, name, kind, sections, entries));
}
// the Global schedule lists only the "- EXT" of some trials: the first version is in the same dungeon
for (const e of groups)
  for (const ext of [...e.dungeons]) {
    const name = ext.name.replace(/ - EXT$/, '');
    if (name === ext.name || e.dungeons.some((d) => d.name === name)) continue;
    const found = [...missions]
      .filter(([, m]) => m.dungeon === ext.id && m.name === name)
      .map(([id]) => ({ id, name }));
    if (found.length) e.dungeons.splice(e.dungeons.indexOf(ext), 0, { id: ext.id, name, page: name, missions: found });
  }
list.push(...groups);

assert(list.find((e) => e.name === 'Orbonne Monastery Vaults').eventIds.includes(703), 'Orbonne');
const bossMissions = (chamberName, boss) =>
  list
    .find((e) => e.name === chamberName)
    .dungeons.find((d) => d.name === boss)
    .missions.map((m) => m.id);
assert.deepStrictEqual(bossMissions('Farplane (Tower of Earth)', 'Brachiosaur'), [2000103], 'Brachiosaur');
assert.deepStrictEqual(bossMissions('Farplane (Tower of Earth)', 'Erinyes'), [2000201], 'Erinyes');
assert(bossMissions('Chamber of Arms', 'Tegmine').includes(8980107), 'Tegmine');
assert(
  list.every((e) => (e.dungeons ?? []).every((d) => Number.isInteger(d.id))),
  'dungeon ids',
);
fs.writeFileSync(published('events'), JSON.stringify(list));
fs.writeFileSync(published('storyChapters'), JSON.stringify(chapters));
console.log(`events ${list.length}, story chapters ${chapters.length}`);
