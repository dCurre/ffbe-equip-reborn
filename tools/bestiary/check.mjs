// Self-check of the parsers, no download needed: node tools/bestiary/check.mjs
import assert from 'node:assert';
import {
  firstPlaceHp,
  monsterResistances,
  parseGist,
  parseInfoboxes,
  passiveEffects,
  parseSchedule,
  wikiSections,
} from './parsers.mjs';

const schedule = parseSchedule(`== Global Update History ==
=== Season 1 ===
{|
! Date !! Type !! Description
|-
| 30-Sep-2016
| Event
| King Mog Event: [[Orbonne Monastery Vaults|Vaults: B1]] (FFT)
|-
| 30-Sep-2016
| Unit
| [[Delita]]
|}
== References ==`);
assert.deepStrictEqual(schedule, [
  {
    date: '2016-09-30',
    season: 1,
    type: 'Event',
    kind: 'King Mog Event',
    name: 'Vaults: B1',
    page: 'Orbonne Monastery Vaults',
    series: 'FFT',
  },
]);

assert.deepStrictEqual(parseInfoboxes('{{Boss Infobox\n|name = A {{x}}\n|hp = 1,000\n}}\n|hp = 9', 'Boss Infobox'), [
  { name: 'A {{x}}', hp: '1,000' },
]);

const page = `|-
| [[A]]: [[A#A - INT|INT]] || 100
|-
| [[A]]: [[A#A - ADV|ADV]] || 2,000
|}
=== Resistance ===
{{Resistance Infobox
|fire = -50
}}
==== A ADV ====
{{Resistance Infobox
|fire = -40
}}`;
assert.strictEqual(monsterResistances(page, 100).fire, '-50');
assert.strictEqual(monsterResistances(page, 2000).fire, '-40');
assert.strictEqual(monsterResistances(page, 5), null);
assert.strictEqual(firstPlaceHp('|-\n| [[Farplane]]\n| 65 || 240,520 || 400\n|}'), 240520);

const [first, second] = parseGist(`# Mission 'One' (1000001)
# Mission 'Two' (1000002)
# Monster  Calca (104151005)
# Race     Demon, Fairy
# Stats
#        HP      10000000
#        DEF         2000
#
# Element resist
#        Fire          -50%
#
# Immunity
#        Death             +
#
# Passives
#
#  名前 (1) [Passive]
#
#  Increase DEF by 50%
#
# Skills
#
# Mission 'Three' (1000003)
# Monster  Brina (104151006, 7)
#        HP             5
`);
assert.deepStrictEqual(first.missions, [1000001, 1000002]);
assert.deepStrictEqual([first.hp, first.def, first.elements.Fire], [10000000, 2000, -50]);
assert.deepStrictEqual(
  [first.races, first.immunities, first.passives],
  [['Demon', 'Fairy'], ['Death'], ['Increase DEF by 50%']],
);
assert.deepStrictEqual(second.missions, [1000003]);
assert.deepStrictEqual(
  wikiSections('a\n== Boss ==\n=== One (ELT) ===\n== Tips ==').map((s) => s.titles),
  [[], ['Boss'], ['Boss', 'One (ELT)'], ['Tips']],
);
assert.deepStrictEqual(
  passiveEffects([
    'Increase DEF and SPR by 80% and ATK and MAG by 50%',
    'Increase DEF by 20%',
    'Increase ATK by 30% when HP is below 50%',
    'Absorb Water and Light elemental attacks',
  ]),
  { buffs: { def: 100, spr: 80, atk: 50, mag: 50 }, absorb: ['water', 'light'] },
);
console.log('parsers ok');
