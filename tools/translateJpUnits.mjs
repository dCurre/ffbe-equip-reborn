// Writes tools/jpUnitNames.json (unit id -> English `name`, `wikiEntry` = its wiki page) into the unit files of public/ALL.
// The Japanese name stays in `jpname`, which only the searches read. The names come from the wiki page `Unit_List/JP`.
// `versionOf`: the Global unit of the same character, under another id in Japan (written as `variantOf`).
// `ownUnit`: Japan gave this id to another character: the items with a Japanese name that name it as TMR / STMR are of
// the `jp-<id>` entry, whose pictures are `img/units/unit_*_jp-<id>.png`.
// It also sends the Brave Shift of every `jp-` unit back to the `jp-` base (as tools/mergeServers.js now does), and keeps
// one copy of the `enhancements` of the Japan units: their old converter read the passives twice and listed each twice.
//
// Run it with `node tools/translateJpUnits.mjs`, also after tools/mergeServers.js; it is safe to run again.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ALL = path.join(here, '..', 'public', 'ALL');
const TAG = ' [JP]';
const map = JSON.parse(fs.readFileSync(path.join(here, 'jpUnitNames.json'), 'utf8'));
const JAPANESE = /[぀-ヺー-ヿ一-鿿]/; // kana and kanji
const KANA = /[぀-ヺー-ヿ]/; // U+30FB (・) is also in the Chinese names
const GL_ID_WITH_JP_DATA = '202001627'; // not marked as a Japan unit, but its data is

// cut only a list that is the same block twice, so a second run changes nothing
const keepOneCopy = (unit) => {
    const list = unit?.enhancements;
    if (!list || list.length % 2) return;
    const half = list.length / 2;
    if (JSON.stringify(list.slice(0, half)) === JSON.stringify(list.slice(half))) unit.enhancements = list.slice(0, half);
};

for (const file of fs.readdirSync(ALL).filter((name) => /^(units(With(Skill|Passives))?(_\w\w)?|releasedUnits)\.json$/.test(name))) {
    const units = JSON.parse(fs.readFileSync(path.join(ALL, file), 'utf8'));
    for (const [id, { name, wikiEntry, versionOf }] of Object.entries(map)) {
        const unit = units[id];
        if (!unit) continue;
        // the Chinese files have real translations (kanji without kana): those stay
        const chinese = file.endsWith('_zh.json') && JAPANESE.test(unit.name) && !KANA.test(unit.name);
        if (name && !chinese) {
            const tagged = unit.name.endsWith(TAG);
            const old = tagged ? unit.name.slice(0, -TAG.length) : unit.name;
            if (JAPANESE.test(old)) unit.jpname ??= old; // not every unit has it, and the searches need it
            unit.name = tagged ? name + TAG : name;
        }
        if (wikiEntry && file !== 'releasedUnits.json') unit.wikiEntry = wikiEntry;
        if (versionOf && file !== 'releasedUnits.json') unit.variantOf = versionOf;
    }
    for (const [id, unit] of Object.entries(units)) {
        if (id.startsWith('jp-') && units['jp-' + unit.braveShifted]) unit.braveShifted = 'jp-' + unit.braveShifted;
        if (unit.server === 'JP' || id === GL_ID_WITH_JP_DATA) [unit, unit['6_form'], unit['7_form']].forEach(keepOneCopy);
    }
    fs.writeFileSync(path.join(ALL, file), JSON.stringify(units));
    console.log('written', file);
}

const ownIds = new Set(Object.keys(map).filter((id) => map[id].ownUnit).map((id) => id.slice('jp-'.length)));
const TRUST = ['tmrUnit', 'stmrUnit'];
const items = JSON.parse(fs.readFileSync(path.join(ALL, 'data.json'), 'utf8'));
const ownItems = new Set(items.filter((item) => JAPANESE.test(item.name) && TRUST.some((key) => ownIds.has(item[key]))).map((item) => item.id));
for (const file of fs.readdirSync(ALL).filter((name) => /^data(_\w\w)?\.json$/.test(name))) {
    const data = JSON.parse(fs.readFileSync(path.join(ALL, file), 'utf8'));
    for (const item of data) {
        if (!ownItems.has(item.id)) continue;
        for (const key of TRUST) if (ownIds.has(item[key])) item[key] = 'jp-' + item[key];
    }
    fs.writeFileSync(path.join(ALL, file), JSON.stringify(data));
    console.log('written', file);
}
