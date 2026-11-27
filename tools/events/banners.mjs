// The banners of the Events page: the original English pictures of the game, read out of the release packs of Elvlin,
// made 480 px wide webp files in `public/img/events` and written in `events.json` (run it after `monsters.mjs`).
// Needs `sharp` (npm install -D sharp).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { cached, json, published, ROOT } from './sources.mjs';

const WIDTH = 480;
/** The packs that hold area banners, the ones with the final native files first. */
const PACKS = ['content-003', 'content-002', 'kira-event', 'data-010', 'data-001'];
const OUT = path.join(ROOT, 'public', 'img', 'events');
const zipget = path.join(ROOT, '.claude', 'skills', 'ffbe-data-sources', 'scripts', 'zipget.cjs');
const pack = (args) =>
  execFileSync('node', [zipget, ...args], { cwd: cached('pack'), encoding: 'utf8', maxBuffer: 1e8 });

// --- which file of which pack has each banner (by file name; an English folder wins over a common one) ---
const files = new Map();
for (const id of PACKS) {
  const listing = cached(`pack/list-${id}.txt`);
  if (!fs.existsSync(listing)) fs.writeFileSync(listing, pack([id, 'x', 'x', 'list']));
  const entries = fs
    .readFileSync(listing, 'utf8')
    .split('\n')
    .map((line) => line.match(/^(.*\/area\/.*\.png) \d+/i)?.[1])
    .filter(Boolean)
    .sort((a, b) => Number(/\/en\//.test(b)) - Number(/\/en\//.test(a)));
  for (const entry of entries) {
    const name = path.basename(entry).toLowerCase();
    if (!files.has(name)) files.set(name, { pack: id, entry });
  }
}

// --- the banner of a dungeon, else of its area (the table of Elvlin, else the file named after the area) ---
const art = json('elvlin/event_art.json');
const known = (...names) => names.map((name) => name?.toLowerCase()).find((name) => files.has(name));
const events = JSON.parse(fs.readFileSync(published('events'), 'utf8'));
const dungeonBanner = (dungeon) => known(art.dungeons[dungeon.id]?.filename);

function eventBanner(event) {
  for (const dungeon of event.dungeons) if (dungeonBanner(dungeon)) return dungeonBanner(dungeon);
  for (const area of event.eventIds ?? []) {
    const found = known(art.events[area]?.filename, art.native_events[area]?.filename, `event_${area}.png`);
    if (found) return found;
  }
  return undefined;
}

const webp = (name) => `${name.replace(/\.png$/, '').replace(/[^a-z0-9_-]/g, '_')}.webp`;
const used = new Set();
const set = (target, name) => {
  delete target.banner;
  if (!name) return;
  used.add(name);
  target.banner = webp(name);
};
for (const event of events) {
  const own = eventBanner(event);
  set(event, own);
  // in a chamber each boss has its own when it differs from the one of the chamber
  for (const dungeon of event.dungeons) {
    const section = event.match === 'chamber' ? dungeonBanner(dungeon) : undefined;
    set(dungeon, section === own ? undefined : section);
  }
}

// --- download what is missing, one call for each pack, then resize ---
fs.mkdirSync(cached('banners'), { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const missing = [...used].filter((name) => !fs.existsSync(path.join(OUT, webp(name))));
for (const id of PACKS) {
  const wanted = missing
    .filter((name) => files.get(name).pack === id && !fs.existsSync(cached(`banners/${name}`)))
    .map((name) => ({ entry: files.get(name).entry, out: cached(`banners/${name}`) }));
  if (!wanted.length) continue;
  fs.writeFileSync(cached('pack/wanted.json'), JSON.stringify(wanted));
  pack([id, '@wanted.json', 'x']);
  console.log(id, wanted.length);
}
for (const name of missing)
  await sharp(cached(`banners/${name}`))
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(path.join(OUT, webp(name)));
// the pictures nothing shows any more
const kept = new Set([...used].map(webp));
for (const file of fs.readdirSync(OUT)) if (!kept.has(file)) fs.rmSync(path.join(OUT, file));

fs.writeFileSync(published('events'), JSON.stringify(events));
const bytes = [...kept].reduce((sum, file) => sum + fs.statSync(path.join(OUT, file)).size, 0);
console.log({ events: events.length, withBanner: events.filter((e) => e.banner).length, pictures: kept.size, bytes });
