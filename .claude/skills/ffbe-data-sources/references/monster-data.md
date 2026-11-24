# Monster data: what was decoded and what is still missing

Used to build `public/ALL/monstersAll.json` (curated bosses of the old `monsters.json` + game rows). The generator was a one-off script run by hand (extraction scripts are kept out of the repo on purpose); the steps below are enough to redo it.

## F_MONSTER_PARTS_MST columns (0-based, tab separated)
| Col | Meaning |
|---|---|
| 0 | part row id (`407281000`); monster group id = id without the last 2 digits (`4072810`, the dump id) |
| 1 | part number (1 = main; arms, wings... are parts 2+) |
| 2 | name (JP) |
| 3 / 4 | HP / MP |
| 5-8 | ATK / DEF / MAG / SPR |
| 9 | 9 values: fire, ice, lightning, water, wind, earth, light, dark resist %, then non-elemental. Negative = weak, above 100 = absorb-like (150, 300...). Matches the wiki on every non-absorb resist checked (67/67) |
| 20 | passive id (see below) |
| 31 | race ids, comma list: 1 beast, 2 bird, 3 aquatic, 4 demon, 5 human, 6 machine, 7 dragon, 8 spirit, 9 bug, 10 stone, 11 plant, 12 undead |
| 38 | first 4 values = break resist of ATK/DEF/MAG/SPR: `0` = breakable, `100` = not (380 of 392 values match the wiki) |
| 16, 17 | attack animation codes (not passives) |
| 10 | NOT the ailment resists: `100,100,...` for almost everyone, also for "immune to ailments" bosses |

Not found in any data: `atk%`/`def%`/`mag%`/`spr%` (60 for all in the curated file), `special` text (e.g. "Immune to ailments"), ailment resists, the categories (Scorn, Fallen, Arms...).

## Absorbs (the 999 of the curated file)
- The base resist of the row does not carry them (the Tiamat row is all zeros). Column 20 (`jmKe42Yg`) is a passive id and the same id always means the same absorbed elements for the curated bosses: 100003 fire, 100004 ice, 100005 lightning, 100006 water, 100007 earth, 100010 wind, 100011 light, 100012 dark, 100091 Tiamat (fire/ice/lightning/dark), 100019 Omega, 100021 water+earth (Malboro, Antenolla), 100084 Mom Bomb fire, 100085 Dad Bomb ice, 43 ids learned in all.
- The table that defines the ids is in no repo: only ids seen on a curated boss can be used. Unknown ids (100149, 100096, 100121, 100047...) look like resist/stat passives, not absorbs.
- Skill effects (`F_MONSTER_SKILL_MST` col 14 type, col 16 params; 33/117 = temporary element resist change, 141 = status, 15 = attack) and `F_AI_MST` (fight script) do not hold absorbs. `F_ABILITY_MST` ids overlap with the passive ids (100091 is "ATK +40%" there): do not use it for them.

## Monster -> event
`F_BATTLE_GROUP_MST` (col 1 part id -> col 0 group) -> `F_BATTLE_LOTTERY_MST` (col 2 group -> col 0 pool) -> `F_MISSION_PHASE_MST` (col 8 pool -> col 0 mission) -> `event_archive.json` events (`missions` list): gives event name, group and release. The per-mission rows of the encounter files give the mission directly. A boss in several events: the earliest dated one was used. The release is JP or Global: not checked.

## Names
English: `F_TEXT_MONSTER_NAME` of packs `content-003` and `kira-event` (key `MST_MONSTER_NAME_<part id>`, value `v[0]`), then `battle_names.json`. Later parts of a monster without their own name: "Name (part N)".

## Curated bosses vs the game rows
- 112 of 147 had the same HP and stats; 138 with name + HP. For 13 of them the wiki agrees with the curated file and not with the JP row (event-modified values: Mom/Dad Bomb DEF 60, Iron Giant SPR 35, Brachiosaur 1.2M HP, Antenolla A-D 580K HP, Tegmine DEF 400); for Brina the row and the wiki agree on MAG 1100 (the curated 110 was a typo). The Espers have 100 as a placeholder in the curated file where the wiki gives nothing.
- No game row at all: Paper Oni, Sealing Shard, Tolfidan (ids `9000…` exist in the name table only); Antenolla A-D and 2-Headed Dragon exist only as base rows with other HP.
- Plan used: curated entries win (they follow the wiki), the Espers 100s and Brina MAG come from the row, the rest of the game rows are added with their event.

## Names in other languages
`public/ALL/monstersAll_<fr|de|es|ko|zh>.json`: one array per language, same order and length as `monstersAll.json`, `""` where the English name stays. Built from `aEnigmatic/ffbe-gl-strings` `MST_MONSTER_NAME.json` (value order en, zh, ko, fr, de, es, id) looked up by the part row id of each entry, then by its 7-digit group id; control characters are stripped. Keep the id of each entry while building (a curated boss uses the id of its matched game row; the ones without a row, e.g. Antenolla A-D, stay English). The page loads the file of its language with `StaticData.get('monstersAll', true)`.

## Fields of `monstersAll.json` today (edited by hand, no generator in the repo)
Besides name, stats, `races`, `hp`/`mp`, `category` (curated rows): each row has `locations` (one object per dungeon where the boss appears: `tab`, `trial`, `dungeon`, `dungeonPage`, `release`; the Builder list shows the boss in each) and `traits` (absorb, resist, weak, statusResist, break, immune, vulnerable, notes, ready for icons). The raw `resist`, `absorb`, `breakability` and `special` fields no longer exist in the file.
