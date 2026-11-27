// What the scripts of the Events page share: where the downloaded sources are and how to read them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The downloads (`fetch.mjs`), not in git. */
export const CACHE = process.env.EVENTS_CACHE || path.join(ROOT, '.cache', 'events');
export const cached = (name) => path.join(CACHE, name);
export const published = (name) => path.join(ROOT, 'public', 'ALL', `${name}.json`);

export const text = (name) => fs.readFileSync(cached(name), 'utf8');
export const json = (name) => JSON.parse(text(name));
/** One JSON object per line (the tables of the release packs). */
export const ndjson = (name) =>
  text(name)
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
/** The battle tables: tab separated, the first line is a `# {json}` header with the field names. */
export const tsv = (name) =>
  text(name)
    .split(/\r?\n/)
    .filter((line) => line && line[0] !== '#')
    .map((line) => line.split('\t'));

/** A monster name without case, spaces and punctuation. */
export const slug = (name) =>
  String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** An event or dungeon name as the sources agree on it: no notes in brackets, no leading "The". */
export const eventSlug = (name) =>
  String(name ?? '')
    .normalize('NFD')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '')
    .replace(/^the/, '');

export const wikiPage = (url) => url && decodeURIComponent(url.split('/wiki/')[1] ?? '').replace(/_/g, ' ');

/**
 * The first trials are fought in the Tower of Earth of the Farplane (wiki page `Farplane`): the missions are all named
 * "The Farplane". "Rebirth of the ..." of the Chamber of the Reborn is their rematch, not the trial.
 */
export const FARPLANE_TRIALS = [
  // the first boss of the tower is there from the launch: the schedule does not list it
  { boss: 'White Dragon', mission: 2000101, events: [] },
  { boss: 'Demon Chimera', mission: 2000102, events: ['Demon Chimera'] },
  { boss: 'Brachiosaur', mission: 2000103, events: ['Brachiosaur'] },
  { boss: 'Erinyes', mission: 2000201, events: ['Erinyes', 'Demon of Resentment'] },
];

/**
 * The permanent trials that no schedule lists, from the monster list written by hand (`monstersAll.json`, categories
 * `Espers` and `Others`): each boss of the list with its mission in the game data, null where there is none.
 */
export const PERMANENT_TRIALS = {
  'Alexander 3★': 11515107,
  'Anima 2★': 11515206,
  'Anima 3★': 11515207,
  Asura: 11720701,
  'Asura 2★': 11720702,
  'Bahamut 1★': 1920801,
  'Bahamut 2★': 1920802,
  'Carbuncle 3★': 1325107,
  'Diabolos 3★': 1230107,
  'Fenrir 3★': 11215107,
  'Golem 3★': 1125107,
  'Ifrit 3★': 1115007,
  'Kokuryu 2★': 1715106,
  'Lakshmi 3★': 1625107,
  'Leviathan 3★': 11315103,
  'Odin 3★': 1425107,
  'Phoenix 3★': 11425107,
  'Ramuh 3★': 1135507,
  'Shiva 3★': 1125206,
  'Siren 3★': 1110406,
  'Tetra Sylphid 3★': 1815107,
  'Titan 3★': 1515007,
  "Bennu (Madam's Manor)": 11430201,
  "Undine (Madam's Manor)": 11430301,
  "Delanbo (Madam's Manor)": 11430401,
  'Celestial Maiden (Asura:Deva)': 11720101,
  'Ittosai (Asura:Asura)': 11720201,
  'Heretical Maester (Asura:Manusya)': 11720301,
  'King of Preta (Asura:Preta)': 11720401,
  'Flesh Devourer (Asura:Tiryagyoni)': 11720501,
  'Asvasirsa (Asura:Naraka)': 11720601,
  'Gosirsa (Asura:Naraka)': 11720601,
  'Abominable Wooden Soldier': null,
};
/** The wiki page of a place of the monster list ('' when it has none). */
export const trialPage = (location) => decodeURIComponent(location.dungeonPage ?? '').replace(/_/g, ' ');

/**
 * First trials whose Japan tables disagree with the Global values of the wiki page (the Builder list agrees with the
 * wiki): the bosses of the mission are the ones of the page.
 */
export const WIKI_TRIALS = {
  8991103: 'Attack of Antenolla',
  8991104: 'Attack of the 2-Headed Dragon',
  8991106: 'Attack of Gilgamesh',
  8993803: 'The Octopus and the Teacher',
};
