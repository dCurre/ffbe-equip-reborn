// The three formats the Events page reads as text: the wiki update schedule, the wiki infoboxes, the datamine gists.

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const LINK = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
const unlink = (s) => s.replace(LINK, (m, page, label) => label || page).trim();
const isoDate = (s) => {
  const m = s.match(/(\d{1,2})[- ]([A-Za-z]{3})[a-z]*[- ](\d{4})/);
  return m && `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};

/** The events, trials and story chapters of the "Global Update History" of the wiki page, the oldest first. */
export function parseSchedule(wikitext) {
  const clean = wikitext.replace(/<!--[\s\S]*?-->/g, '').replace(/<ref[^>]*\/>|<ref[\s\S]*?<\/ref>/g, '');
  const end = clean.indexOf('== References');
  const history = clean.slice(clean.indexOf('== Global Update History'), end < 0 ? undefined : end);
  const entries = [];
  for (const season of history.split(/^=== *(?=Season)/m).slice(1)) {
    const number = +season.match(/Season (\d)/)[1];
    for (const row of season.split(/^\|-.*$/m)) {
      const cells = row.split(/^\|\}/m)[0].replace(/\|\|/g, '\n|').split(/\n\|/).slice(1);
      if (cells.length < 3) continue;
      const date = isoDate(cells[0]);
      const type = cells[1].trim();
      if (!date || !['Event', 'Trial', 'Story'].includes(type)) continue;
      for (let line of cells
        .slice(2)
        .join('\n|')
        .split(/\n|<br\s*\/?>/)) {
        line = line
          .replace(/^[\s*:#-]+/, '')
          .replace(/'''?/g, '')
          .trim();
        if (!line) continue;
        // "Kind: [[Name]] (Series)": the colon outside the links separates the kind
        const colon = line.replace(LINK, (m) => 'x'.repeat(m.length)).indexOf(':');
        // the marks of the schedule, "(Rerun) King Mog Event", are written in square brackets
        const kind = colon < 0 ? null : unlink(line.slice(0, colon)).replace(/\(([^)]*)\)/g, '[$1]');
        const rest = colon < 0 ? line : line.slice(colon + 1);
        const links = [...rest.matchAll(LINK)].filter((m) => !/^(File|Category):/i.test(m[1]));
        const common = { date, season: number, type, kind };
        if (!links.length) {
          const name = unlink(rest);
          if (name) entries.push({ ...common, name, page: null, series: null });
          continue;
        }
        links.forEach((m, i) => {
          const after = rest.slice(m.index + m[0].length, links[i + 1]?.index ?? rest.length);
          const series = after.match(/^\s*\(([^)]*)\)/)?.[1] ?? null;
          entries.push({ ...common, name: (m[2] || m[1]).trim(), page: m[1].trim(), series });
        });
      }
    }
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

/** The fields of every `{{<template>` of a page (`Boss Infobox`, `Resistance Infobox`). */
export function parseInfoboxes(wikitext, template) {
  const boxes = [];
  const start = new RegExp(`\\{\\{\\s*${template}`, 'gi');
  for (const found of wikitext.matchAll(start)) {
    let depth = 0;
    let end = found.index;
    for (; end < wikitext.length; end++) {
      if (wikitext.startsWith('{{', end)) {
        depth++;
        end++;
      } else if (wikitext.startsWith('}}', end)) {
        depth--;
        end++;
        if (!depth) break;
      }
    }
    const body = wikitext.slice(found.index, end).replace(/<!--[\s\S]*?-->/g, '');
    const fields = {};
    for (const m of body.matchAll(/^[ \t]*\|[ \t]*([\w-]+)[ \t]*=[ \t]*([^\n]*)/gm)) fields[m[1]] ??= m[2].trim();
    boxes.push(fields);
  }
  return boxes;
}

/** The rows of the places of a monster page: place, level, HP... */
const places = (wikitext) => wikitext.split(/^\|-.*$/m).filter((row) => row.includes('[[') && row.includes('||'));

/** The HP of the first place listed by a monster page, or null. */
export function firstPlaceHp(wikitext) {
  const hp = places(wikitext)[0]?.match(/^\|\s*\d+\s*\|\|\s*([\d,]+)/m)?.[1];
  return hp ? +hp.replace(/,/g, '') : null;
}

/**
 * The resistance box of a monster page that goes with these HP, or null. A page lists the places of the monster in a
 * table (place, level, HP...) and may have one box per place, under a heading named like the difficulty of the place;
 * the box without such a heading is the one of the first place.
 */
export function monsterResistances(wikitext, hp) {
  const boxes = wikitext.split(/^(?==+[^=\n].*=+[ \t]*$)/m).flatMap((part) =>
    parseInfoboxes(part, 'Resistance Infobox').map((box) => ({
      box,
      heading: part.match(/^=+\s*(.*?)\s*=+[ \t]*$/m)?.[1] ?? '',
    })),
  );
  const rows = places(wikitext);
  const hasHp = new RegExp(`\\b${hp}\\b`);
  const place = rows.findIndex((row) => hasHp.test(row.replace(/,/g, '')));
  if (place < 0 || !boxes.length) return null;
  if (boxes.length === 1) return boxes[0].box;
  const plain = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const anchor = rows[place].match(/\[\[[^\]|#]*#([^\]|]+)/)?.[1];
  const named = anchor && boxes.find((b) => plain(b.heading) === plain(anchor));
  if (named) return named.box;
  return place === 0 ? boxes[0].box : null;
}

/** The parts of a page under each heading, with the titles of the headings above it (the closest last). */
export function wikiSections(wikitext) {
  const open = [];
  return wikitext.split(/^(?=(?:<[^>]*>)*==+[^=\n].*==+)/m).map((text) => {
    const heading = text.match(/^(?:<[^>]*>)*(==+)\s*(.*?)\s*==+/);
    if (heading) {
      while (open.length && open.at(-1).level >= heading[1].length) open.pop();
      open.push({ level: heading[1].length, title: heading[2] });
    }
    return { titles: open.map((h) => h.title), text };
  });
}

const value = (block, name) => {
  const m = block.match(new RegExp(`^#\\s+${name}\\s+(-?\\d+)`, 'm'));
  return m ? +m[1] : null;
};
/** The lines of a `# Title` section of a monster, up to the next one. */
const section = (block, title) => block.match(new RegExp(`^# ${title}.*\\n((?:#(?! [A-Z]).*\\n?)*)`, 'm'))?.[1] ?? '';
const table = (block, title, names) =>
  Object.fromEntries(names.map((name) => [name, value(section(block, title), `${name}\\??`) ?? 0]));

export const ELEMENTS = ['Fire', 'Ice', 'Lightning', 'Water', 'Wind', 'Earth', 'Light', 'Dark', 'Non-Elemental'];
export const AILMENTS = ['Poison', 'Blind', 'Sleep', 'Silence', 'Paralyze', 'Confusion', 'Disease', 'Petrify'];
export const DEBUFFS = ['ATK', 'DEF', 'MAG', 'SPR', 'Stop', 'Charm', 'Berserk'];

/** "ATK and MAG by 50%": the stats and the percent */
const RAISE = '((?:(?:ATK|DEF|MAG|SPR)(?:, | and |/))*(?:ATK|DEF|MAG|SPR)) by (\\d+)%';
/** A passive that raises stats and nothing else: "Increase DEF and SPR by 80% and ATK and MAG by 50%". */
const STAT_PASSIVE = new RegExp(`^Increase ${RAISE}(?: and ${RAISE})*$`);

/** What the passives of a monster change for who calculates a damage: the stats raised (%) and the elements absorbed. */
export function passiveEffects(passives) {
  const buffs = {};
  const absorb = [];
  for (const line of passives) {
    if (STAT_PASSIVE.test(line))
      for (const [, raised, percent] of line.matchAll(new RegExp(RAISE, 'g')))
        for (const stat of raised.match(/ATK|DEF|MAG|SPR/g)) {
          const key = stat.toLowerCase();
          buffs[key] = (buffs[key] ?? 0) + Number(percent);
        }
    const absorbed = line.match(/^Absorb (.+) elemental attacks$/)?.[1];
    if (absorbed) absorb.push(...absorbed.toLowerCase().split(/, | and /));
  }
  return { buffs, absorb: [...new Set(absorb)] };
}

/**
 * The battles of the missions of a datamine file that lists them one by one ("1. Wave"): mission id -> the monster ids of
 * each battle. Most files only list the monsters, without their battle: nothing for those.
 */
export function parseGistWaves(content) {
  const missions = {};
  let waves;
  for (const line of content.replace(/\r/g, '').split('\n')) {
    const mission = line.match(/^# Mission .*\((\d{6,})\)/)?.[1];
    if (mission) waves = missions[mission] = [];
    else if (/^#\s*\d+\.\s*Wave\b/.test(line)) waves?.push([]);
    else {
      const id = line.match(/^#\s+\*\s.*\((\d{6,})\)\s*$/)?.[1];
      if (id) waves?.at(-1)?.push(id);
      else if (/^# Monster Info/.test(line)) waves = undefined;
    }
  }
  return Object.fromEntries(Object.entries(missions).filter(([, list]) => list.length));
}

/** The monsters of a datamine file of aEnigmatic, each with the missions it is listed under. */
export function parseGist(content) {
  const monsters = [];
  let missions = [];
  let listing = false;
  for (const block of content.replace(/\r/g, '').split(/^(?=# Mission |# Monster {2,})/m)) {
    const mission = block.match(/^# Mission .*\((\d{6,})\)/);
    if (mission) {
      // several missions in a row share the monsters that follow; after a monster a new list starts
      if (!listing) missions = [];
      missions.push(+mission[1]);
      listing = true;
      continue;
    }
    const head = block.match(/^# Monster {2,}(.*?)\s*\((\d+)(?:,[^)]*)?\)/);
    const hp = value(block, 'HP');
    if (!head || hp === null) continue;
    listing = false;
    monsters.push({
      name: head[1],
      id: head[2],
      missions: [...missions],
      races: (block.match(/^# Race\s+(.+)$/m)?.[1] ?? '').split(',').map((race) => race.trim()),
      hp,
      mp: value(block, 'MP'),
      atk: value(block, 'ATK'),
      def: value(block, 'DEF'),
      mag: value(block, 'MAG'),
      spr: value(block, 'SPR'),
      damage: table(block, 'Damage resist', ['physical', 'magical']),
      elements: table(block, 'Element resist', ELEMENTS),
      ailments: table(block, 'Status resist', AILMENTS),
      debuffs: table(block, 'Debuff resist', DEBUFFS),
      immunities: [...section(block, 'Immunity').matchAll(/^#\s+(Death|Gravity)\s+\+/gm)].map((m) => m[1]),
      // the effect lines of the passives (the line after each name)
      passives: [...section(block, 'Passives').matchAll(/\[Passive\]\s*\n#\s*\n((?:#\s{2}\S.*\n)+)/g)].flatMap((m) =>
        m[1]
          .trim()
          .split('\n')
          .map((line) => line.replace(/^#\s+/, '')),
      ),
    });
  }
  return monsters;
}
