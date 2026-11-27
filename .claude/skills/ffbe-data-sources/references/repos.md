# Game data repos

Counts are from 2026-11. Raw files: `https://raw.githubusercontent.com/<owner>/<repo>/HEAD/<path>`. Full tree: `https://api.github.com/repos/<owner>/<repo>/git/trees/HEAD?recursive=1` (60 requests/hour, not truncated for these two).

## Elvlin/exvius-offline (the richest, 1613 files)
- `source/server/content/battle/*.tsv`: the JP battle tables. `F_MONSTER_PARTS_MST` (17147 rows: stats, resists, race, break), `F_MONSTER_MST` (JP names), `F_MONSTER_SKILL_MST`, `F_MONSTER_SKILL_SET_MST`, `F_BATTLE_GROUP_MST`, `F_BATTLE_LOTTERY_MST`, `F_MISSION_PHASE_MST`, `F_MISSION_MST`. Column names are obfuscated; the first line is a `# {json}` header with the field order. Decoded columns: `monster-data.md`.
- `source/server/battle_names.json`: English names, `monster{id}` and `skill{id}` (only the battles the app serves).
- `source/server/event_encounters.json` (21 MB), `colosseum_encounters.json`, `event_battles.json`: per-mission bundles. Part rows are under tag `bV34YIJQ` (same fields by name, English names for Global events), skills under `Wp39QX52`, break under `BJ6A0KTt`/`7KCkJd1E`. They are reconstructed from the wiki, not recorded.
- `source/server/event_archive.json`: 874 events with `name`, `group` (`permanent`, `season1..4`, `collaborations`), **`release`**, `missions`. Also `raid_archive.json` (88 raids) and `community_events.json`.
- `source/server/content/break_status.json` (break data of 67 parts, community datamine), `dialogue_en.json` (JP -> EN strings), `ai_repairs.json` (one AI row only).
- `data/latest.json`: the 23 release packs (`exvius-data-001.zip`..., 18.6 GB). Read single files with `scripts/zipget.cjs`.
  - `data-001`: `static/mst_decoded/*.ndjson` (219 client master tables: `F_ABILITY_MST`, `F_AI_MST`, `F_MONSTER_DICTIONARY_MST`, `F_DUNGEON_MST`, `F_EFFECT_GROUP_MST`...) and `static/text_decoded/*.ndjson` (texts: `F_TEXT_MONSTER_NAME`, `F_TEXT_MONSTER_SKILL_NAME`...). The monster battle tables are not in the client: the server sends them at the start of each battle.
  - `content-003` and `kira-event` (a few MB): the newest `F_TEXT_MONSTER_NAME`, the official English names (30115 ids, key `MST_MONSTER_NAME_<part id>`).
  - `.cpk` archives (12.9 GB): art and effects only, no tables.

## TBMonkey/ffbe-gl-server (83 files)
- The same `server/content/battle/*.tsv` tables as Elvlin (Elvlin's `cow` files name `exvius-offline` as their source, so the data looks shared).
- `server/responses.json` (9.6 MB): **recorded responses of a real Global client** v9.0.0. 2033 part rows (1351 distinct), some with event-boosted values (e.g. Mom Bomb 44,444,444 HP).
- `server/ffbe_battle.py`, `battle_content.py`: how the tables are served. `docs/analysis/FFBE_SERVER_CONTRACT.md` (91 KB): the protocol, not read in full.

## aEnigmatic datamines (older, no battle rows)
Same layout in all three; files are JSON keyed by id. They hold nothing about monster stats, resists or absorbs: checked 2026-11, see "Known gaps" in `SKILL.md`.
- `aEnigmatic/ffbe` (Global, last push 2024-09): `units`, `equipment`, `items`, `skills_ability`, `skills_passive` (15809), `skills_magic`, `limitbursts`, `materia`, `summons`, `vision_cards`, `dungeons`, `worlds`, `missions` (17915: dungeon, name, cost, difficulty, rewards, challenges; **no monsters**), `monster_skills` (19432, English effects decoded: e.g. "Reduce resistance to Ice by 90% for 3 turns"), `monster_skillsets` (5187: part row id -> English monster name + skill ids, e.g. `407281000` = Tiamat), `monster_ai` (2778, names only). The `skills_passive` ids do not include the monster passive ids (100003, 100149...); `100091` is "ATK +40%" there too.
- `aEnigmatic/ffbe-jp` (JP, last push 2025-10): the same files for Japan (missions 17924, skills_passive 14142).
- `aEnigmatic/ffbe-gl-strings` (Global texts, 2024-09, 159 files `MST_*.json`): `MST_MONSTER_NAME.json` has **16857 monster names in 7+ languages**. Key = monster id (16821 are 9-digit part row ids, the rest 7-digit group ids); value = array in this order: English, Traditional Chinese, Korean, French, German, Spanish, Indonesian, then a variant with control characters. Example: `2080710` = ["Blue-toned Bomb", "藍色音調炸彈", "푸른색 봄", "Bomboson bleu", "Blaugetönte Bomber", "Bom tono azulado", "Bom Nuansa Biru"]. Kept for a multilingual site (the site already has `_fr/_de/_es/_ko/_zh` data files); its English names add nothing to the official `F_TEXT_MONSTER_NAME` of the packs. Other useful files: `MST_MONSTER_SKILL_NAME`, `MST_MONSTERDICTIONARY_*` (monster dictionary texts), `MST_MISSION_NAME`, `MST_ABILITY_NAME`.

## DanUgore/ffbe_data (2018, JP + GL, 37 files)
Last push 2018-02: an old extract in the format of Deathmax's Brave Frontier data (`jp/` and `gl/` folders: `ability`, `ai`, `monskills`, `unit`, `equip`, `item`, `limits`, `beasts`, `boards`, `learns`, `materia`, `magic`, `recipe`, `missions`). Checked 2026-11: consistent with the newer data (4323 of its 4452 JP monster skill ids are in `F_MONSTER_SKILL_MST`; 502 of 579 GL ones in aEnigmatic), but it adds nothing: `missions.json` has only the wave count (3440 missions, `waves` is a number, no monsters), no monster stats, resists or passives, and everything is older than the other sources.

## Checked and not useful
- `S0524/ffbe-offline-localization`: a guide and 5 scripts to translate FFBE Offline (cpk/utf patching), no game data. Only `inspect_cpk.py` (the `@UTF` table format) is of interest.
- `CreamySeaman6/Exvius-Revival-Desktop`: a launcher (C/Python) to run the client without an emulator, no data.
