// Downloads the sources of the Events page into `.cache/events` (about 80 MB). A file already there is not downloaded
// again: delete the folder to refresh everything.
//   node tools/events/fetch.mjs && node tools/events/events.mjs && node tools/events/monsters.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseSchedule } from './parsers.mjs';
import { CACHE, cached, FARPLANE_TRIALS, json, published, ROOT, trialPage } from './sources.mjs';

const AGENT = { headers: { 'User-Agent': 'data-reader/1.0' } };

async function get(url) {
  const response = await fetch(url, AGENT);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

async function save(name, content) {
  const file = cached(name);
  if (fs.existsSync(file)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, await content());
  console.log(name);
}

const raw = (repo, file) => () => get(`https://raw.githubusercontent.com/${repo}/HEAD/${file}`);
const wiki = async (query) =>
  JSON.parse(await get(`https://exvius.fandom.com/api.php?format=json&action=query&${query}`));

/** The wikitext of many pages, keyed by the title asked (redirects followed; `withTitle` keeps the one they lead to). */
async function wikiTexts(titles, withTitle = false) {
  const out = {};
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const { query } = await wiki(
      `prop=revisions&rvprop=content&rvslots=main&redirects=1&titles=${encodeURIComponent(batch.join('|'))}`,
    );
    const renamed = {};
    for (const { from, to } of [...(query.normalized ?? []), ...(query.redirects ?? [])]) renamed[from] = to;
    const texts = new Map(Object.values(query.pages).map((p) => [p.title, p.revisions?.[0]?.slots.main['*']]));
    for (const title of batch) {
      let final = title;
      while (renamed[final] && renamed[final] !== final) final = renamed[final];
      const text = texts.get(final);
      if (text) out[title] = withTitle ? { title: final, text } : text;
    }
  }
  return JSON.stringify(out);
}

// --- game data repos ---
const ELVLIN = 'Elvlin/exvius-offline';
for (const file of [
  'event_archive.json',
  'event_encounters.json',
  'event_battles.json',
  'battle_names.json',
  'content/omitted_global_event_sources.json',
  ...['MONSTER_PARTS', 'BATTLE_GROUP', 'BATTLE_LOTTERY', 'MISSION_PHASE'].map((t) => `content/battle/F_${t}_MST.tsv`),
])
  await save(`elvlin/${path.basename(file)}`, raw(ELVLIN, `source/server/${file}`));
for (const file of ['dungeons', 'missions'])
  await save(`aenigmatic/${file}.json`, raw('aEnigmatic/ffbe', `${file}.json`));
for (const file of ['MONSTER', 'MISSION', 'DUNGEONS', 'AREA'])
  await save(`aenigmatic/MST_${file}_NAME.json`, raw('aEnigmatic/ffbe-gl-strings', `MST_${file}_NAME.json`));

// the newest client texts, read one by one out of a release pack of Elvlin
const zipget = path.join(ROOT, '.claude', 'skills', 'ffbe-data-sources', 'scripts', 'zipget.cjs');
fs.mkdirSync(cached('pack'), { recursive: true });
for (const entry of [
  'static/text_decoded/F_TEXT_AREA_NAME.ndjson',
  'static/text_decoded/F_TEXT_DUNGEON_NAME.ndjson',
  'static/text_decoded/F_TEXT_MISSION.ndjson',
  'static/mst_decoded/F_DUNGEON_MST.ndjson',
]) {
  const name = path.basename(entry);
  if (!fs.existsSync(cached(`pack/${name}`)))
    execFileSync('node', [zipget, 'content-003', entry, name], { cwd: cached('pack'), stdio: 'inherit' });
}

// --- datamine gists of aEnigmatic: the real stats of many missions ---
await save('gists/index.json', async () => {
  const files = [];
  for (let page = 1; ; page++) {
    const gists = JSON.parse(await get(`https://api.github.com/users/aEnigmatic/gists?per_page=100&page=${page}`));
    for (const gist of gists)
      Object.values(gist.files).forEach((f, i) =>
        files.push({ name: f.filename, file: `${gist.id}_${i}.txt`, url: f.raw_url }),
      );
    if (gists.length < 100) return JSON.stringify(files);
  }
});
const gists = json('gists/index.json');
for (let i = 0; i < gists.length; i += 8)
  await Promise.all(gists.slice(i, i + 8).map((g) => save(`gists/${g.file}`, () => get(g.url))));

// --- the portraits of the monsters (asset dump): only the list, `icons.mjs` downloads the ones shown ---
// the tree API cannot list that repo: a clone without the files, outside the project
await save('asset-dump/icons.json', () => {
  const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-dump-'));
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1e8 });
  const options = ['--filter=blob:none', '--no-checkout', '--depth', '1'];
  git('clone', '-q', ...options, 'https://github.com/DaddyRaegen/ffbe_asset_dump', clone);
  const files = git('-C', clone, 'ls-tree', '-r', '--name-only', 'HEAD', 'monster_icon');
  fs.rmSync(clone, { recursive: true, force: true });
  return JSON.stringify([...files.matchAll(/monster_icon_(\d+)\.png/g)].map((m) => m[1]));
});

// --- wiki ---
await save('wiki/Update_Schedule.json', () => wikiTexts(['Update_Schedule']));
await save('wiki/events.json', async () => {
  const titles = [];
  let next = '';
  do {
    const result = await wiki(`list=categorymembers&cmtitle=Category:Events&cmlimit=500&cmnamespace=0${next}`);
    titles.push(...result.query.categorymembers.map((m) => m.title));
    next = result.continue ? `&cmcontinue=${encodeURIComponent(result.continue.cmcontinue)}` : '';
  } while (next);
  return JSON.stringify(titles);
});
await save('wiki/eventPages.json', () => wikiTexts(json('wiki/events.json')));
// the pages of the releases of the schedule, with the title a redirect leads to
await save('wiki/releasePages.json', () => {
  const releases = parseSchedule(json('wiki/Update_Schedule.json').Update_Schedule);
  const titles = releases.map((e) => (e.page && !e.page.includes('#') ? e.page : e.name));
  return wikiTexts([...new Set(titles)].sort(), true);
});
// the pages that tell something about the monsters of the rebuilt battles: their events and the monsters themselves
const encounters = Object.values(json('elvlin/event_encounters.json').missions);
const distinct = (values) => [...new Set(values.filter(Boolean))].sort();
await save('wiki/encounterPages.json', () => wikiTexts(distinct(encounters.map((m) => m.source_page))));
await save('wiki/monsterPages.json', () =>
  wikiTexts(distinct(encounters.flatMap((m) => (m.enemies ?? []).map((e) => e.enemy)))),
);
await save('wiki/farplanePages.json', () => wikiTexts(FARPLANE_TRIALS.map((t) => t.boss)));
// the pages of the permanent trials of the monster list
const trials = JSON.parse(fs.readFileSync(published('monstersAll'), 'utf8')).filter((m) =>
  ['Espers', 'Others'].includes(m.category),
);
await save('wiki/trialPages.json', () => wikiTexts(distinct(trials.flatMap((m) => m.locations.map(trialPage)))));
console.log(`sources ready in ${CACHE}`);
