// Builds `public/ALL/dungeonMonsters.json`: the monsters of every mission of `events.json` (run `events.mjs` first).
// The best source wins, and each monster says which one it comes from (`source`):
//   1. `datamine` / `datamineJp`: the gist of aEnigmatic about the mission (Global values; Japan when there is no other);
//   2. `table`: the Japan battle tables of Elvlin;
//   3. the battles rebuilt by Elvlin (`event_encounters.json`) give only the names: their stats are those of another
//      monster, so they are looked for by name and HP in the gists, the tables and the wiki boss boxes (`wiki`);
//      `wikiResists` has only the resistances, `unknown` nothing but name, races and the published HP.
// Missing stats are null: no made up number is written.
import assert from 'node:assert';
import fs from 'node:fs';
import {
  AILMENTS,
  ELEMENTS,
  firstPlaceHp,
  monsterResistances,
  parseGist,
  passiveEffects,
  parseInfoboxes,
  wikiSections,
} from './parsers.mjs';
import {
  FARPLANE_TRIALS,
  json,
  PERMANENT_TRIALS,
  published,
  slug,
  text,
  trialPage,
  tsv,
  WIKI_TRIALS,
} from './sources.mjs';

const RACES = [
  ,
  'beast',
  'bird',
  'aquatic',
  'demon',
  'human',
  'machine',
  'dragon',
  'spirit',
  'bug',
  'stone',
  'plant',
  'undead',
];
const ELEMENT_NAMES = ['fire', 'ice', 'lightning', 'water', 'wind', 'earth', 'light', 'dark', 'noElement'];
const AILMENT_ICONS = ['poison', 'blind', 'sleep', 'silence', 'paralysis', 'confuse', 'disease', 'petrification'];
const STATS = ['atk', 'def', 'mag', 'spr'];
const readPublished = (name) => JSON.parse(fs.readFileSync(published(name), 'utf8'));
// the events and stages this script makes (the stages have negative ids) are made again at every run
const events = readPublished('events').filter((e) => e.match !== 'builderList');
for (const e of events) if (e.dungeons) e.dungeons = e.dungeons.filter((d) => d.id >= 0);

const names = json('aenigmatic/MST_MONSTER_NAME.json');
const battleNames = json('elvlin/battle_names.json');
const parts = new Map(tsv('elvlin/F_MONSTER_PARTS_MST.tsv').map((c) => [c[0], c]));
const encounters = json('elvlin/event_encounters.json').missions;
const encounterFields = (() => {
  const head = text('elvlin/F_MONSTER_PARTS_MST.tsv').split('\n')[0];
  return JSON.parse(head.slice(head.indexOf('{'))).fields;
})();

/** The English name of a monster part; a later part without its own name is "Name (part N)". */
function partName(row) {
  if (names[row[0]]?.[0]) return names[row[0]][0];
  const group = names[row[0].slice(0, -2)]?.[0] || (battleNames.monsters || battleNames)[`monster${row[0]}`];
  return group && (+row[1] > 1 ? `${group} (part ${row[1]})` : group);
}

// --- traits ---
/** The traits of a monster (the shape of `app-monster-traits`) from the percents of each element, status and break. */
function traits({
  elements = [],
  absorb = [],
  ailments = [],
  breakable = [],
  partialBreak = [],
  immune = [],
  notes = [],
}) {
  const out = {};
  const absorbed = [...new Set([...absorb, ...ELEMENT_NAMES.filter((_, i) => elements[i] > 100)])];
  const pick = (test) =>
    ELEMENT_NAMES.map((name, i) => ({ name, percent: elements[i] })).filter(
      (r) => !absorbed.includes(r.name) && test(r.percent),
    );
  if (absorbed.length) out.absorb = absorbed;
  const resist = pick((p) => p > 0);
  const weak = pick((p) => p < 0);
  if (resist.length) out.resist = resist;
  if (weak.length) out.weak = weak;
  const full = AILMENT_ICONS.filter((_, i) => ailments[i] >= 100).map((name) => ({ icon: `ailment-${name}` }));
  const partial = AILMENT_ICONS.map((name, i) => ({ icons: [`ailment-${name}`], percent: ailments[i] }))
    .filter((s) => s.percent > 0 && s.percent < 100)
    .concat(partialBreak.map(([stat, percent]) => ({ icons: [`ailment-break_${stat}`], percent })));
  if (partial.length) out.statusResist = partial;
  if (breakable.length) out.break = breakable;
  if (full.length || immune.length) out.immune = [...full, ...immune];
  if (notes.length) out.notes = notes;
  return out;
}

// the absorbed elements are a passive of unknown content in the tables: learned from the monsters of the Builder list
const curated = new Map(
  readPublished('monstersAll')
    .filter((m) => m.traits?.absorb)
    .map((m) => [`${slug(m.name)}|${m.hp}`, m.traits.absorb]),
);
const absorbByPassive = {};
for (const row of parts.values()) {
  const known = curated.get(`${slug(names[row[0]]?.[0])}|${row[3]}`);
  if (known && +row[20]) absorbByPassive[row[20]] = known;
}

/** A monster of a row of the battle tables (or of a rebuilt battle, written in the same columns). */
function fromRow(row, name, source) {
  const broken = String(row[38]).split(',');
  return {
    name,
    ids: [String(row[0]).slice(0, -2)],
    hp: +row[3],
    atk: +row[5],
    def: +row[6],
    mag: +row[7],
    spr: +row[8],
    races: String(row[31])
      .split(',')
      .map((i) => RACES[i])
      .filter(Boolean),
    traits: traits({
      elements: String(row[9]).split(',').map(Number),
      absorb: absorbByPassive[row[20]],
      breakable: STATS.filter((_, i) => broken[i] === '0'),
    }),
    source,
  };
}

// --- datamine gists ---
/** How the datamines call the races the site calls otherwise. */
const RACE_ALIASES = {
  machina: 'machine',
  fairy: 'spirit',
  reaper: 'undead',
  avian: 'bird',
  insect: 'bug',
  rock: 'stone',
  plantoid: 'plant',
};
const gists = json('gists/index.json').flatMap(({ name, file }) => {
  // Global files first, the ones without a server next, Japan last
  const rank = /\.gl\./.test(name) ? 0 : /\.jp\./.test(name) ? 2 : 1;
  return parseGist(text(`gists/${file}`)).map((m) => ({ ...m, rank, english: names[m.id]?.[0] }));
});
const latin = (s) => !/[　-鿿＀-￯]/.test(s);

function fromGist(g) {
  const breakable = STATS.filter((s) => g.debuffs[s.toUpperCase()] < 100);
  const partialBreak = STATS.map((s) => [s, g.debuffs[s.toUpperCase()]]).filter(([, p]) => p > 0 && p < 100);
  const immune = [
    ...['Stop', 'Charm', 'Berserk'].filter((d) => g.debuffs[d] >= 100),
    ...g.immunities.filter((i) => i === 'Death'),
  ].map((d) => ({ icon: `ailment-${d.toLowerCase()}` }));
  // only what the monster can be hit with: being immune to gravity is the rule, the abilities are on the wiki
  const notes = [
    ...(g.immunities.includes('Gravity') ? [] : ['Vulnerable to gravity']),
    ...Object.entries(g.damage)
      .filter(([, p]) => p)
      .map(([kind, p]) => `${kind[0].toUpperCase()}${kind.slice(1)} damage resist ${p}%`),
  ];
  const { buffs, absorb } = passiveEffects(g.passives);
  return {
    name: latin(g.name) ? g.name : g.english,
    ids: [g.id.slice(0, -2)],
    hp: g.hp,
    atk: g.atk,
    def: g.def,
    mag: g.mag,
    spr: g.spr,
    races: g.races
      .map((r) => r.toLowerCase())
      .map((r) => RACE_ALIASES[r] ?? r)
      .filter((r) => RACES.includes(r)),
    traits: traits({
      elements: ELEMENTS.map((e) => g.elements[e]),
      absorb,
      ailments: AILMENTS.map((a) => g.ailments[a]),
      breakable,
      partialBreak,
      immune,
      notes,
    }),
    ...(Object.keys(buffs).length && { buffs }),
    source: g.rank === 2 ? 'datamineJp' : 'datamine',
  };
}

const gistByMission = new Map();
const gistByNameHp = new Map();
for (const g of gists) {
  for (const m of g.missions) (gistByMission.get(m) ?? gistByMission.set(m, []).get(m)).push(g);
  const key = `${slug(latin(g.name) ? g.name : g.english)}|${g.hp}`;
  if (!gistByNameHp.has(key) || g.rank < gistByNameHp.get(key).rank) gistByNameHp.set(key, g);
}

// --- the tables by name and HP: only when every row of that name and HP says the same ---
const tableByNameHp = new Map();
for (const row of parts.values()) {
  const name = partName(row);
  if (!name) continue;
  const key = `${slug(name)}|${row[3]}`;
  (tableByNameHp.get(key) ?? tableByNameHp.set(key, []).get(key)).push(row);
}
const sameProfile = (rows) => new Set(rows.map((c) => [c[5], c[6], c[7], c[8], c[9], c[31]].join())).size === 1;

// --- the wiki ---
const encounterPages = Object.values(json('wiki/encounterPages.json'));
const monsterPages = json('wiki/monsterPages.json');
/** The first number of "400,000" or "950 + 570" (base + bonus). */
const number = (s) => {
  const m = String(s ?? '')
    .replace(/,/g, '')
    .match(/^[+-]?\d+/);
  return m ? +m[0] : null;
};
const bossBoxes = new Map();
for (const page of encounterPages)
  for (const box of parseInfoboxes(page, 'Boss Infobox')) {
    const key = `${slug(box.name)}|${number(box.hp)}`;
    // a box with the stats wins over one without
    if (!bossBoxes.has(key) || number(box.def) !== null) bossBoxes.set(key, box);
  }

const plain = (s) =>
  String(s)
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/<[^>]*>|\{\{[^}]*\}\}|'{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const WIKI_ELEMENTS = ['fire', 'ice', 'lightning', 'water', 'wind', 'earth', 'light', 'dark'];
const WIKI_AILMENTS = ['poison', 'blind', 'sleep', 'silence', 'paralyze', 'confuse', 'disease', 'petrify'];

/** The traits of a wiki infobox, or null when it says nothing about the resistances. */
function wikiTraits(box) {
  if (![...WIKI_ELEMENTS, ...WIKI_AILMENTS, 'other-res'].some((f) => box[f])) return null;
  const sentences = plain(box['other-res'] ?? '').split(/(?<=\.)\s+/);
  const gravity = (s) => /^immune to .*(gravity|death)/i.test(s) && !/break/i.test(s);
  const death = sentences.some((s) => gravity(s) && /death/i.test(s));
  return traits({
    elements: WIKI_ELEMENTS.map((e) => number(box[e]) ?? 0),
    absorb: WIKI_ELEMENTS.filter((e) => /absorb/i.test(box[e] ?? '')),
    ailments: WIKI_AILMENTS.map((a) => (/null|immune/i.test(box[a] ?? '') ? 100 : (number(box[a]) ?? 0))),
    immune: death ? [{ icon: 'ailment-death' }] : [],
    notes: sentences.filter((s) => s && !gravity(s)),
  });
}

/** The buffs (%) of the stats a wiki box writes as base and bonus: "950 + 570". */
function wikiBuffs(box) {
  const buffs = {};
  for (const stat of STATS) {
    const base = number(box[stat]);
    const bonus = number(
      String(box[stat] ?? '')
        .split('+')[1]
        ?.trim(),
    );
    if (base && bonus) buffs[stat] = Math.round((bonus / base) * 100);
  }
  return Object.keys(buffs).length ? { buffs } : {};
}

/** A monster of a rebuilt battle: its name is sure, its stats are looked for elsewhere. */
function fromEncounter(name, row, hp) {
  const key = `${slug(name)}|${hp}`;
  const { races, ids } = fromRow(row, name);
  const unknown = { name, ids, hp, atk: null, def: null, mag: null, spr: null, races, traits: {}, source: 'unknown' };
  if (hp !== null) {
    const gist = gistByNameHp.get(key);
    if (gist) return fromGist(gist);
    const rows = tableByNameHp.get(key);
    if (rows && sameProfile(rows)) return fromRow(rows[0], name, 'table');
    const box = bossBoxes.get(key);
    if (box) {
      const found = wikiTraits(box) ?? {};
      if (number(box.def) !== null && number(box.spr) !== null) {
        const stats = Object.fromEntries(STATS.map((s) => [s, number(box[s])]));
        return { ...unknown, ...stats, ...wikiBuffs(box), traits: found, source: 'wiki' };
      }
      if (wikiTraits(box)) return { ...unknown, traits: found, source: 'wikiResists' };
    }
    // the page of the monster: the box of the place that has these HP
    const place = monsterPages[name] && monsterResistances(monsterPages[name], hp);
    const found = place && wikiTraits(place);
    if (found) return { ...unknown, traits: found, source: 'wikiResists' };
  }
  return unknown;
}

// --- mission -> pools -> battle groups -> monster parts ---
const link = (file, from, to) => {
  const map = new Map();
  for (const c of tsv(`elvlin/${file}.tsv`)) (map.get(c[from]) ?? map.set(c[from], new Set()).get(c[from])).add(c[to]);
  return (key) => [...(map.get(key) ?? [])];
};
const poolsOf = link('F_MISSION_PHASE_MST', 0, 8);
const groupsOf = link('F_BATTLE_LOTTERY_MST', 0, 2);
const partsOf = link('F_BATTLE_GROUP_MST', 0, 1);

const list = [];
const indexes = new Map();
// the portrait of a monster: the id its source gives (`ids`, best first), else one of a monster with the same name
const portraits = new Set(json('asset-dump/icons.json'));
const idsByName = new Map();
const addName = (name, id) => {
  const key = slug(name);
  if (key && portraits.has(id)) (idsByName.get(key) ?? idsByName.set(key, []).get(key)).push(id);
};
for (const [id, v] of Object.entries(names)) addName(v[0], id.length > 7 ? id.slice(0, -2) : id);
for (const row of parts.values()) addName(partName(row), row[0].slice(0, -2));
// the newest bosses have only the portrait of their entry in the in-game bestiary
for (const battle of Object.values(encounters))
  for (const enemy of battle.enemies ?? []) addName(enemy.enemy, enemy.dictionary);
const indexOf = ({ ids = [], ...monster }) => {
  const icon = [...ids, ...(idsByName.get(slug(monster.name)) ?? [])].find((id) => portraits.has(id));
  if (icon) monster.icon = icon;
  const key = JSON.stringify(monster);
  if (!indexes.has(key)) indexes.set(key, list.push(monster) - 1);
  return indexes.get(key);
};

function monstersOf(mission) {
  const gist = gistByMission.get(mission);
  if (gist) {
    const best = Math.min(...gist.map((g) => g.rank));
    const found = gist.filter((g) => g.rank === best).map(fromGist);
    // a Japan file with names nobody translated: the tables are better
    if (found.every((m) => m.name)) return found;
  }
  const found = [];
  const seen = new Set();
  for (const id of poolsOf(String(mission)).flatMap(groupsOf).flatMap(partsOf)) {
    const row = parts.get(id);
    const name = row && partName(row);
    if (!name) continue;
    found.push(fromRow(row, name, 'table'));
    seen.add(slug(name));
  }
  const battle = encounters[mission];
  for (const enemy of battle?.enemies ?? []) {
    if (seen.has(slug(enemy.enemy))) continue;
    const id = enemy.local_roster_native_references?.part_id;
    // a rebuilt battle says which entry of the in-game bestiary the monster is: its portrait is that one
    const portrait = (m) => ({ ...m, ids: [enemy.dictionary, ...(m.ids ?? [])] });
    if (parts.has(id)) {
      found.push(portrait(fromRow(parts.get(id), enemy.enemy, 'table')));
      continue;
    }
    const rebuilt = (battle.bundle?.bV34YIJQ ?? []).find(
      (r) => r.xqartN26 === id || (!id && r.G4L0YIB2 === enemy.enemy),
    );
    if (!rebuilt) continue;
    const row = encounterFields.map((f) => rebuilt[f] ?? '');
    const hp = enemy.published_stats?.hp ? +rebuilt.fh31sk7B : null;
    found.push(portrait(fromEncounter(enemy.enemy, row, hp)));
  }
  return found;
}

// the wiki is more precise than the Japan tables for the bosses of the first trials: HP and resistances from their page
const farplanePages = json('wiki/farplanePages.json');
function withBossPage(mission, monster) {
  if (!FARPLANE_TRIALS.some((t) => t.mission === mission && t.boss === monster.name)) return monster;
  const page = farplanePages[monster.name];
  const hp = firstPlaceHp(page);
  const box = monsterResistances(page, hp);
  assert(hp && box, `wiki page of ${monster.name}`);
  // the page does not say which stats can be broken: the tables do
  const traits = { ...wikiTraits(box), break: monster.traits.break };
  return { ...monster, hp, traits, source: 'tableWiki' };
}

// the first trials the tables get wrong: the bosses of their wiki page (the tables say which stats can be broken)
const releasePages = json('wiki/releasePages.json');
function withWikiTrial(mission, found) {
  const title = WIKI_TRIALS[mission];
  if (!title) return found;
  const bosses = parseInfoboxes(releasePages[title].text, 'Boss Infobox').map(wikiBoss).filter(Boolean);
  assert(bosses.length && found.every((m) => m.source === 'table'), `wiki trial ${title}`);
  return bosses.map((boss) => {
    // "Antenolla A (Flower)" is the "Antenolla" of the tables
    const name = slug(boss.name.replace(/( [A-D])? \(.*\)$/, ''));
    const row = found.find((m) => slug(m.name) === name) ?? found[0];
    return { ...boss, ids: idsByName.get(name), traits: { ...boss.traits, break: row.traits.break } };
  });
}

const missions = {};
const wanted = new Set(events.flatMap((e) => (e.dungeons ?? []).flatMap((d) => d.missions.map((m) => m.id))));
for (const mission of wanted) {
  const bosses = withWikiTrial(mission, monstersOf(mission));
  const found = [...new Set(bosses.map((m) => indexOf(withBossPage(mission, m))))];
  if (found.length) missions[mission] = found;
}

// --- explorations and events without stages: the wiki page of an event may give all the stats of its bosses ---
const eventPages = json('wiki/eventPages.json');
const exploration = (e) => /explor/i.test(`${e.kind ?? ''} ${e.name}`);
const hasMonsters = (e) => (e.dungeons ?? []).some((d) => d.missions.some((m) => missions[m.id]));
const DIFFICULTY = ['bgn', 'easy', 'int', 'adv', 'pro', 'hard', 'elt', 'lgd'];
const rank = (name) => Math.max(...DIFFICULTY.map((d, i) => (new RegExp(`\\b${d}\\b`, 'i').test(name) ? i : -1)));

/** A boss of a wiki page with every stat, or null. */
function wikiBoss(box) {
  const stats = ['hp', ...STATS].map((s) => [s, number(box[s])]);
  if (stats.some(([, v]) => v === null)) return null;
  const race = plain(box.race ?? '')
    .toLowerCase()
    .replace(/s$/, '');
  const races = [RACE_ALIASES[race] ?? race].filter((r) => RACES.includes(r));
  const traits = wikiTraits(box) ?? {};
  return { name: plain(box.name), ...Object.fromEntries(stats), ...wikiBuffs(box), races, traits, source: 'wiki' };
}

/** Adds the bosses of the page of an event to the mission they are described for. */
function addWikiBosses(event) {
  const page = releasePages[event.page || event.name]?.text ?? eventPages[event.page || event.name] ?? '';
  const sections = wikiSections(page);
  const eventMissions = (event.dungeons ?? []).flatMap((d) => d.missions);
  // the missions whose battle lists the boss: their section is named like them
  const battles = sections.flatMap(({ titles, text: part }) => {
    const mission = eventMissions.find((m) => slug(m.name) === slug(plain(titles.at(-1) ?? '')));
    const bosses = parseInfoboxes(part, 'Battle Infobox').flatMap((b) => plain(b.boss ?? '').split(/,| {2,}/));
    return mission ? [{ mission, bosses: slug(bosses.join()) }] : [];
  });
  for (const { titles, text: part } of sections)
    for (const box of parseInfoboxes(part, 'Boss Infobox')) {
      const boss = wikiBoss(box);
      if (!boss) continue;
      // the difficulty of the heading ("Boss Info (ELT)"), else the hardest battle with the boss
      const wanted = titles.map(rank).findLast((r) => r >= 0);
      const found = battles.filter((b) => b.bosses.includes(slug(boss.name))).map((b) => b.mission);
      const mission =
        found.find((m) => rank(m.name) === wanted) ?? found.sort((a, b) => rank(b.name) - rank(a.name))[0];
      if (!mission) continue;
      const index = indexOf(boss);
      if (!missions[mission.id]?.includes(index)) (missions[mission.id] ??= []).push(index);
    }
}
const hasStages = (e) => (e.dungeons ?? []).some((d) => d.missions.length);
let wikiId = 0;
/** The data have no stage for the event: the battles of its page become stages, the ones with a boss and its stats. */
function stagesFromWiki(event) {
  const page = releasePages[event.page || event.name]?.text ?? eventPages[event.page || event.name] ?? '';
  // temporary ids (fractions) while the bosses are placed: only the stages kept get a number
  const stages = wikiSections(page)
    .filter(({ text: part }) => parseInfoboxes(part, 'Battle Infobox').length)
    .map(({ titles }, i) => {
      const title = plain(titles.at(-1) ?? '');
      return { id: -(i + 0.5), title, name: !title || title === 'Battle Info' ? event.name : title };
    });
  event.dungeons = [{ id: 0, name: event.name, missions: stages.map((m) => ({ id: m.id, name: m.title })) }];
  addWikiBosses(event);
  const found = stages.filter((m) => missions[m.id]);
  const kept = found.map((m) => {
    const id = --wikiId;
    missions[id] = missions[m.id];
    delete missions[m.id];
    return { id, name: m.name };
  });
  event.dungeons = kept.length ? [{ id: --wikiId, name: event.name, missions: kept }] : [];
}
for (const event of events)
  if (!hasStages(event)) stagesFromWiki(event);
  else if (exploration(event) && !hasMonsters(event)) addWikiBosses(event);
// left out of the site: the events without a stage, and the explorations with nothing to show
const kept = events.filter((e) => hasStages(e) && (!exploration(e) || hasMonsters(e)));
// --- the permanent trials: the bosses of the Builder list that are in no event ---
/** A boss as the list writes it; the stats the list says it does not know are null (its numbers are placeholders). */
function fromList({ name, hp, races, traits: found = {}, locations, category, mp, ...entry }) {
  const unknown = (found.notes ?? []).find((n) => /stats not available/i.test(n)) ?? '';
  const stats = Object.fromEntries(STATS.map((s) => [s, new RegExp(s, 'i').test(unknown) ? null : (entry[s] ?? null)]));
  const buffs = Object.fromEntries(STATS.filter((s) => entry[`${s}%`]).map((s) => [s, entry[`${s}%`]]));
  const notes = (found.notes ?? []).filter((n) => n !== unknown);
  const { notes: _, ...rest } = found;
  return {
    name: bossName(name),
    hp,
    ...stats,
    races,
    traits: { ...rest, ...(notes.length && { notes }) },
    ...(Object.keys(buffs).length && { buffs }),
    source: 'builderList',
  };
}
/** "Bahamut 2★" and "Bennu (Madam's Manor)" are the monsters "Bahamut" and "Bennu". */
function bossName(name) {
  return name.replace(/ \d★$| \([^)]*\)$/g, '');
}
const trialPages = json('wiki/trialPages.json');
/**
 * A boss the data do not have: what its wiki page says (HP, resistances, the stats it gives), else what the list says.
 */
function unpublished(boss) {
  const listed = fromList(boss);
  const any = boss.locations
    .flatMap((l) => parseInfoboxes(trialPages[trialPage(l)] ?? '', 'Boss Infobox'))
    .find((b) => slug(plain(b.name)) === slug(listed.name));
  const traits = any && wikiTraits(any);
  if (!traits) return listed;
  const stats = Object.fromEntries(STATS.map((s) => [s, number(any[s])]));
  return {
    name: listed.name,
    hp: number(any.hp),
    ...stats,
    ...wikiBuffs(any),
    races: listed.races,
    traits: { ...traits, ...(listed.traits.break && { break: listed.traits.break }) },
    source: STATS.every((s) => stats[s] !== null) ? 'wiki' : 'wikiResists',
  };
}
/** The name of the trial of a place: "Pit of Chains/New Trial of the Vengeful" is the second part. */
const trialName = (place) =>
  decodeURIComponent(place)
    .split(/\/| - (?=Trial)/)
    .at(-1);

const trials = readPublished('monstersAll').filter((m) => m.category === 'Espers' || m.category === 'Others');
assert.deepStrictEqual(
  trials.map((m) => m.name).filter((name) => !(name in PERMANENT_TRIALS)),
  [],
  'bosses of the list without a line in PERMANENT_TRIALS',
);
/** The stage of a boss: the monsters of its mission from the data, with the boss of the list where they lack it. */
function trialStage(boss, name, bossOnly = false) {
  const mission = PERMANENT_TRIALS[boss.name] ?? --wikiId;
  const isBoss = (m) => slug(m.name) === slug(bossName(boss.name));
  const found = (mission > 0 ? monstersOf(mission) : []).filter((m) =>
    isBoss(m) ? m.def !== null && m.spr !== null : !bossOnly,
  );
  if (!found.some(isBoss)) found.unshift(unpublished(boss));
  missions[mission] = [...new Set([...(missions[mission] ?? []), ...found.map(indexOf)])];
  return { id: mission, name };
}
const permanent = (name, sections, page = '') =>
  kept.push({ name, page, kind: 'Permanent trial', dungeons: sections, match: 'builderList' });
const dungeon = (name, stages, page) => ({
  id: Math.floor(Math.abs(stages[0].id) / 100),
  name,
  ...(page && { page }),
  missions: stages,
});

const espers = Map.groupBy(
  trials.filter((m) => m.category === 'Espers'),
  (m) => bossName(m.name),
);
permanent(
  'Esper Trials',
  [...espers].map(([esper, bosses]) => {
    const stages = bosses
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
      .map((m) => trialStage(m, `${m.name} - ${trialName(m.locations[0].dungeon)}`));
    return dungeon(esper, stages, trialPage(bosses.at(-1).locations[0]));
  }),
);
const others = trials.filter((m) => m.category === 'Others');
const place = (test, title, bossOnly) => {
  const bosses = others.filter((m) => test.test(m.name));
  const stages = new Map();
  for (const m of bosses) {
    const stage = trialStage(m, m.locations[0].dungeon, bossOnly);
    stages.set(stage.id, stage);
  }
  const page = trialPage(bosses[0].locations[0]);
  permanent(title, [dungeon(title, [...stages.values()])], stages.size > 1 ? '' : page);
};
// one datamine file for the six realms: only the boss of each one is sure
place(/Asura:/, 'Asura Realm', true);
place(/Madam's Manor/, "Madam's Manor");
place(/Wooden Soldier/, 'Abominable Wooden Soldier');
fs.writeFileSync(published('events'), JSON.stringify(kept));

console.log({
  leftOut: events.length - kept.length,
  stagesFromWiki: kept.filter((e) => e.dungeons.some((d) => d.id < 0)).map((e) => e.name),
});
assert(
  missions[7050105]?.some((i) => list[i].name === 'Golbez' && list[i].def === 25),
  'Golbez, from the wiki',
);

const frostor = Object.values(missions)
  .flat()
  .map((i) => list[i])
  .find((m) => m.name === 'Frostor' && m.hp === 129000);
assert(frostor?.source === 'wikiResists' && frostor.def === null, 'Frostor: wiki resistances, no stats');
const brachiosaur = list[missions[2000103][0]];
assert(brachiosaur.hp === 240520 && brachiosaur.traits.immune.length, 'Brachiosaur: the wiki HP and immunities');
assert(
  frostor.traits.weak.some((r) => r.name === 'fire' && r.percent === -50),
  'Frostor is weak to fire',
);
const welter = list.find((m) => m.name === 'Warden Welter' && m.hp === 30000000);
assert(welter.buffs.def === 50 && welter.traits.absorb.includes('light'), 'Warden Welter: buffs and absorbs');
assert(frostor.icon === '10000004', 'Frostor portrait');
assert(
  list.every((m) => m.name && (m.hp === null || Number.isFinite(m.hp)) && m.source),
  'incomplete monster',
);
fs.writeFileSync(published('dungeonMonsters'), JSON.stringify({ monsters: list, missions }));
const count = list.reduce((all, m) => ({ ...all, [m.source]: (all[m.source] ?? 0) + 1 }), {});
console.log({ missions: Object.keys(missions).length, of: wanted.size, monsters: list.length, ...count });
