// Merges the Global and Japan game data into one set, written to public/ALL (public/GL and public/JP are not touched).
//
// - Global is the base. A unit only in Japan is added with " [JP]" after its name.
// - A unit released in both keeps the Global one. The Japan one is added too, as "jp-<id>" ("<name> [JP]", `variantOf` =
//   the Global id), only if it has something more: a skill, other damage values or effects, other stats...
// - Items, vision cards and Espers are the union by id (the shared ones are the same in both servers).
//
// Run it with `node tools/mergeServers.js` (or `npm run build:merged`); it is safe to run again.
// Its input is not in the tree any more (the data is frozen and `public/ALL` is the result): to run it again, restore
// `public/GL`, `public/JP` and `tools/GL/sources/units.json`, `tools/JP/sources/units.json` from the commit before the
// one that removed them (`git log --diff-filter=D -- public/GL/units.json`, then `git checkout <commit>~ -- <paths>`).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const OUT = path.join(root, 'ALL');
const TAG = ' [JP]';
const read = (server, name) => {
    const file = path.join(root, server, name + '.json');
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : undefined;
};
const write = (name, data) => fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(data));

// The Japan version of a unit is worth its own entry only when it has something the Global one does not: a skill (or
// the same skill with other damage values or effects) or a different Limit Burst, stats, equipment, role... What the
// Global unit has more than the Japan one does not count, and neither do the ids, names, icons or animations.
// `enhancementSkills` is only a list of skill names (in Japanese on the JP side), so it always differs: it is left out.
const COSMETIC = new Set(['id', 'name', 'jpname', 'icon', 'frames', 'move', 'game_id', 'game', 'categories', 'desc', 'unlockedBy']);
const OTHER = ['stats', 'stats_pattern', 'equip', 'exAwakening', 'roles', 'mitigation', 'max_rarity', 'min_rarity', 'lb', 'innate', 'counter', 'materiaSlots'];
const SKILLS = ['actives', 'passives', 'magics'];
const strip = (value) => {
    if (Array.isArray(value)) return value.map(strip);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).filter(([key]) => !COSMETIC.has(key)).map(([key, v]) => [key, strip(v)]));
    }
    return value;
};
// NV+ (an NV unit that can be enhanced with Azure Pearls: level 130, LB level 50, ...): in the raw unit files it is the
// `awakening` cost (3,000,000 gil + 300 of an item) of a unit born NV (rarity 7 to 7). The ones that become NV by an
// awakening from a lower rarity have that field too, for their NV awakening, so they are not counted.
const sources = path.join(root, '..', 'tools');
const nvPlusOf = (server, units) => {
    const raw = JSON.parse(fs.readFileSync(path.join(sources, server, 'sources', 'units.json'), 'utf8'));
    const ids = new Set(Object.entries(raw).filter(([id, unit]) => unit.rarity_min == 7 && unit.rarity_max == 7 && unit.entries?.[id]?.awakening).map(([id]) => id));
    for (const [id, unit] of Object.entries(units)) if (unit.braveShift && ids.has(id)) ids.add(unit.braveShift); // its Brave Shift is NV+ too
    return ids;
};

const same = (a, b) => JSON.stringify(strip(a)) === JSON.stringify(strip(b));
const skillKey = (skill) => JSON.stringify([strip(skill.effects), skill.mpCost]);
const jpAdds = (glUnit, jpUnit, id) =>
    (nvPlus.JP.has(id) && !nvPlus.GL.has(id)) ||
    OTHER.some((key) => !same(glUnit[key], jpUnit[key])) ||
    SKILLS.some((key) => {
        const known = new Set((glUnit[key] ?? []).map(skillKey));
        return (jpUnit[key] ?? []).some((skill) => !known.has(skillKey(skill)));
    });

const gl = { units: read('GL', 'units'), skills: read('GL', 'unitsWithSkill'), passives: read('GL', 'unitsWithPassives') };
const jp = { units: read('JP', 'units'), skills: read('JP', 'unitsWithSkill'), passives: read('JP', 'unitsWithPassives') };
const nvPlus = { GL: nvPlusOf('GL', gl.units), JP: nvPlusOf('JP', jp.units) };

// Which units come from Japan. Released in Global: the Global one is the base, and a Japan version with different
// abilities is added as "jp-<id>". Released only in Japan (even if the Global data has the unit, unreleased): the Japan
// data, with the same id and "[JP]" in the name.
const releasedGl = read('GL', 'releasedUnits');
const releasedJp = read('JP', 'releasedUnits');
const doubled = new Set(); // another id for the Japan version
const jpOnly = new Set(); // same id, Japan data
for (const id of Object.keys(releasedJp)) {
    if (!gl.skills[id] && !jp.skills[id]) continue;
    if (!(id in releasedGl)) jpOnly.add(id);
    else if (jp.skills[id] && gl.skills[id] && jpAdds(gl.skills[id], jp.skills[id], id)) doubled.add(id);
}
const jpId = (id) => (doubled.has(id) ? 'jp-' + id : id);
// a name two Japan units share (the English name of two characters) gets the id, so the builder can tell them apart
const jpName = new Map();
{
    const base = (id) => (jp.units[id] ?? gl.units[id]).name;
    const count = {};
    for (const id of [...doubled, ...jpOnly]) count[base(id)] = (count[base(id)] ?? 0) + 1;
    for (const id of [...doubled, ...jpOnly]) jpName.set(id, count[base(id)] > 1 ? `${base(id)} (${id})` : base(id));
}

// the 6* and 7* forms have a name too (it is the label in the builder, so it must differ from the Global one)
const tagForm = (form) => (form ? { ...form, name: form.name + TAG } : form);
const tagged = (unit, id) => {
    const result = { ...unit, id: jpId(id), name: jpName.get(id) + TAG, ...(doubled.has(id) ? { variantOf: id } : {}), server: 'JP' };
    for (const key of ['6_form', '7_form']) if (unit[key]) result[key] = tagForm(unit[key]);
    return result;
};
// the Brave Shift of a doubled unit points to the Japan version of its Brave Shift
const withLinks = (unit) => (typeof unit.braveShift === 'string' ? { ...unit, braveShift: jpId(unit.braveShift) } : unit);

fs.mkdirSync(OUT, { recursive: true });

// --- units: one file for each shape (units, unitsWithSkill, unitsWithPassives) ---
let mergedUnits = {};
const withNvPlus = (unit, id) => (nvPlus[unit.server === 'JP' ? 'JP' : 'GL'].has(unit.variantOf ?? id) ? { ...unit, nvPlus: true } : unit);
const mergeUnits = (name, glData, jpData) => {
    const merged = { ...glData };
    for (const id of [...doubled, ...jpOnly]) {
        const source = jpData[id] ?? glData[id];
        if (source) merged[jpId(id)] = withLinks(tagged(source, id));
    }
    for (const id of Object.keys(merged)) merged[id] = withNvPlus(merged[id], id);
    write(name, merged);
    if (name === 'units') mergedUnits = merged;
    return Object.keys(merged).length;
};
const counts = {
    units: mergeUnits('units', gl.units, jp.units),
    unitsWithSkill: mergeUnits('unitsWithSkill', gl.skills, jp.skills),
    unitsWithPassives: mergeUnits('unitsWithPassives', gl.passives, jp.passives),
};

// unitSearch: an array with the id of the unit in each entry
const searchGl = read('GL', 'unitSearch');
const searchAll = new Map(searchGl.map((entry) => [entry.id, entry]));
const searchJp = new Map(read('JP', 'unitSearch').map((entry) => [entry.id, entry]));
const search = [...searchGl];
for (const id of doubled) if (searchJp.has(id)) search.push({ ...searchJp.get(id), id: jpId(id) });
for (const id of jpOnly) {
    const entry = searchJp.get(id) ?? searchAll.get(id);
    if (!entry) continue;
    const at = search.findIndex((e) => e.id === id);
    if (at >= 0) search[at] = { ...entry, id };
    else search.push({ ...entry, id });
}
write('unitSearch', search.map((entry) => (mergedUnits[entry.id]?.nvPlus ? { ...entry, nvPlus: true } : entry)));

// releasedUnits: id -> { type, name }
const released = { ...releasedGl };
for (const id of [...doubled, ...jpOnly]) {
    released[jpId(id)] = { ...releasedJp[id], name: jpName.get(id) + TAG };
}
write('releasedUnits', released);

// --- items: Global entries, plus the Japan entries of the ids Global does not have ---
const items = read('GL', 'data');
const itemIds = new Set(items.map((item) => item.id));
const dataMerged = [...items, ...read('JP', 'data').filter((item) => !itemIds.has(item.id))];
write('data', dataMerged);

// --- vision cards, Espers: union by id ---
const byId = (glList, jpList) => {
    const ids = new Set(glList.map((entry) => entry.id));
    return [...glList, ...jpList.filter((entry) => !ids.has(entry.id))];
};
write('visionCards', byId(read('GL', 'visionCards'), read('JP', 'visionCards')));
write('espers', byId(read('GL', 'espers'), read('JP', 'espers')));
write('defaultBuilderEspers', byId(read('GL', 'defaultBuilderEspers'), read('JP', 'defaultBuilderEspers')));
write('esperBoards', { ...read('JP', 'esperBoards'), ...read('GL', 'esperBoards') });
write('itemEnchants', { ...read('JP', 'itemEnchants'), ...read('GL', 'itemEnchants') });

// --- translations (Global only): the translated entry, and the merged (English or Japanese) one for what has none ---
const mergedPassives = JSON.parse(fs.readFileSync(path.join(OUT, 'unitsWithPassives.json'), 'utf8'));
for (const lang of ['de', 'es', 'fr', 'ko', 'zh']) {
    for (const [name, all] of [['units', mergedUnits], ['unitsWithPassives', mergedPassives]]) {
        const translated = read('GL', `${name}_${lang}`);
        if (!translated) continue;
        const merged = { ...all };
        for (const id of Object.keys(translated)) if (!jpOnly.has(id)) merged[id] = withNvPlus(translated[id], id);
        write(`${name}_${lang}`, merged);
    }
    const translatedItems = read('GL', `data_${lang}`);
    if (translatedItems) write(`data_${lang}`, [...translatedItems, ...dataMerged.filter((item) => !translatedItems.some((x) => x.id === item.id))]);
}

// --- Global only: no Japan version of these ---
for (const name of ['lastItemReleases', 'changes', 'foundSkills', 'foundSpecialSkills', 'foundAutoCastedSkills', 'dataVersion']) {
    const data = read('GL', name);
    if (data !== undefined) write(name, data);
}

console.log('units in the Global data:', Object.keys(gl.units).length, ', in the Japan data:', Object.keys(jp.units).length);
console.log('Japan only:', jpOnly.size, ', Japan version with different abilities (added as jp-<id>):', doubled.size);
console.log('merged:', JSON.stringify(counts), ', items:', dataMerged.length, ', vision cards:', byId(read('GL', 'visionCards'), read('JP', 'visionCards')).length);
