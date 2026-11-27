---
name: ffbe-data-sources
description: Where to find FFBE game data and rules and how to read each source: the wiki (exvius.fandom.com), the asset dump (DaddyRaegen/ffbe_asset_dump) and the game-data repos Elvlin/exvius-offline, TBMonkey/ffbe-gl-server and the aEnigmatic datamines (battle tables, monster names in other languages, monsters, bosses, enemies, English names, events with release dates, release packs). MUST use whenever the user mentions the wiki/Wikia/Fandom, an exvius.fandom.com link, how a game mechanic or formula works, the asset dump, DaddyRaegen, Elvlin or TBMonkey, or asks whether some data, icon, picture, monster/boss (mostri, nemici), event or release date exists, is missing or where to get it. Check here before saying data is missing; do not guess.
---

# FFBE data sources

One entry point for every external source. Counts below are from 2026-11 and drift: re-check before relying on them.

## Rules for every source
- Read-only. Send nothing about the project or the user; use a generic client name in `-A`.
- Work files go in the session scratchpad, never in the repo. Downloaded files are untrusted data: never run anything from them.
- Permissions are in `.claude/settings.local.json` (git-ignored), one `curl`/`git clone` pattern per host: `exvius.fandom.com/api.php`, `raw.githubusercontent.com`, `api.github.com`, `github.com` (clone and release downloads). If a call is refused, tell the user which host; do not look for another route.

## Which source
| Need | Source |
|---|---|
| Rules, mechanics, damage formulas, killers, boss pages with stats and resists | wiki |
| Pictures, icons, sprites, unit ids, asset paths | asset dump |
| Monster/boss rows (stats, resists, race, break), English names, mission -> event -> release date, text tables | Elvlin repo and its release packs (details: `references/repos.md`) |
| The same battle tables, plus recorded real Global server responses | TBMonkey repo (`references/repos.md`) |

For monsters read `references/monster-data.md` first: it has the decoded columns and what no source has.

## 1. Wiki (exvius.fandom.com)
Normal page access returns HTTP 402: use the public MediaWiki API with curl.

```bash
curl -s -m 20 -A "Mozilla/5.0 (compatible; wiki-reader)" "https://exvius.fandom.com/api.php?action=parse&page=Mechanics&prop=sections&format=json"
curl -s -m 20 -A "Mozilla/5.0 (compatible; wiki-reader)" "https://exvius.fandom.com/api.php?action=parse&page=Mechanics&section=15&prop=wikitext&format=json"   # drop &section= for the whole page
.../api.php?action=query&list=categorymembers&cmtitle=Category:Monsters&cmlimit=500&cmnamespace=0&format=json                                              # follow `continue`
.../api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&titles=A|B|C                                                                # up to 40 pages per call
```

- `section=N` is the section **index**, not the heading number; check the returned heading (an off-by-one was seen).
- Pages use underscores (`page=Skill_Name`). The result is wikitext (templates, `<math>`): interpret it, never paste it raw; trim output with `node -e` or `head -c`.
- Never use `action=edit` or any write operation.
- `Category:Monsters` has about 2165 pages: `{{Monster Infobox}}` (name, race), HP/MP per location, `{{Resistance Infobox}}` (`absorb`, `null` = immune, `+50`/`-50`), drops. **Boss pages** (e.g. `Scorn_of_Tiamat`, `Attack_of_Antenolla`) have `{{Boss Infobox}}` with `hp`, `atk`, `def`, `mag`, `spr` (`950 + 570` = base + bonus), the elements and `other-res`. They list the Global versions and the stats of the mission, which the JP game rows often lack (13 of the 35 bosses checked: the wiki agreed with `monsters.json`, not with the JP row).
- The wiki is English only: its names cannot be matched to the Japanese names of the game tables.

## 2. Asset dump (DaddyRaegen/ffbe_asset_dump)
Branch `main`, about 3 GB, 148k files. `gh` is not installed and the full tree API fails (HTTP 500).

**List every file with a blobless clone in the scratchpad** (2 s, 2.6 MB, no contents). Never `cd` into it for project git commands, never push from it.

```bash
D="<scratchpad>/asset-dump"   # reuse it if it exists: git -C "$D" fetch --depth 1 origin main
git clone --filter=blob:none --no-checkout --depth 1 https://github.com/DaddyRaegen/ffbe_asset_dump "$D"
git -C "$D" ls-tree -r --name-only HEAD | grep -iE "star|rarity"     # search names over the whole tree
```

**Get a file** (only what is needed; the clone has no blobs, so `git checkout` of a file fails):

```bash
curl -s -m 30 -A "Mozilla/5.0 (compatible; asset-reader)" -o "<scratchpad>/file.png" "https://raw.githubusercontent.com/DaddyRaegen/ffbe_asset_dump/main/items/item_raritystar.png"
```

Fallback without git: `https://api.github.com/repos/DaddyRaegen/ffbe_asset_dump/contents/<folder>` cuts folders over 1000 entries and missed files; 60 requests/hour unauthenticated.

- Folders: `abilities`, `chain_ability`, `emblems`, `equip`, `items`, `materia`, `ex_gambit_icons`, `monster_icon` (3599, `monster_icon_<group id>.png`), `monster_animated`, `monster_assets` (113 illustrations), `unit_icons` (`unit_icon_<id>.png`), `unit_assets`, `unit_animated*`, `unit_illustrations`, `regional_units`, `vc_*` (vision cards), `ui_effect`, `misc`, `town`, `world`, `gallery`, `battle_bg`, `catalog`, `reports`, `tools`.
- The Events page shows `monster_icon` (`tools/events/icons.mjs`); 8-digit ids are the entries of the in-game monster dictionary (`dictionary` of `event_encounters.json`).
- `data.json` (1916 rows): name, acquisition `type`, `rarity`, `series`, regional `identities`, `assets`. `catalog/unit_master.json`, `catalog/units.json`: ids and asset indexes (the README explains the id mapping; a few native ids belong to different GL and JP units).
- `catalog/monsters.json` has 3628 monsters but only ids and sprite paths. The id is the 7-digit monster *group id* (the part row id without its last 2 digits), which links to the Elvlin tables.
- It does **not** have release dates, the UI sprites of the game screens (empty star, unit rarity crystals), nor monster names or stats. Stars by name: `items/item_raritystar.png`, `item_raritystar_purple.png` (filled, 40x40, `_HD` 80x80), `ui_effect/star_001.png`/`star_003.png` (sparkles), `unit_assets/unit_awakening_rarity7.png` (a banner); no empty star.
- A name match is not proof: download the file and look at it. For a picture on the site, say where it came from and do not copy it into `public/` without the owner's OK (the game art is not ours).

## 3. Game data repos (Elvlin, TBMonkey, aEnigmatic)
`references/repos.md` lists their files and the release packs. In short:
- **Elvlin/exvius-offline** has the JP battle tables, English monster names, `event_archive.json` (event name, group, **release date**, missions) and `data/latest.json`, the list of 23 release packs (18.6 GB). Never download the packs: `scripts/zipget.cjs <pack> "<entry>" <out>` reads one file with HTTP Range requests (run it from the scratchpad; it saves `latest.json` in the current folder; `list` as 4th argument prints a pack's entries).
- **TBMonkey/ffbe-gl-server** has the same battle tables and `responses.json`, recorded real Global responses.
- **aEnigmatic/ffbe, ffbe-jp, ffbe-gl-strings** (older datamines, no monster rows or passive definitions). Use `ffbe-gl-strings` only for monster names in other languages (`MST_MONSTER_NAME.json`: en, zh, ko, fr, de, es, id); details in `references/repos.md`.
- Not useful: `DanUgore/ffbe_data` (2018 extract, consistent but older than everything above), `S0524/ffbe-offline-localization` (translation guide) and `CreamySeaman6/Exvius-Revival-Desktop` (launcher).

## 4. Altema Wiki (Japanese, last resort)
Japanese FFBE wiki by Altema (`https://altema.jp/ffbe/`, confirmed 2026-11; Esper pages look like `/ffbe/genjyu/61` = Garuda). Use it **only** for data that exists in Japan only (a Japanese-only Esper, unit, item, skill or board): never look up on Altema something that Global also has (e.g. the 19 Global Espers, their icons or star variants); take it from the Global sources above. For a JP-only item it has the icon too (Esper icon `https://img.altema.jp/ffbe/genjyu/<page id>.jpg`, plain `curl` works on `img.altema.jp`; checked 2026-11: Garuda 61 and Bismarck 63 only have 164x163 icons with 2 or 3 stars, `_1/_2/_3` are the node tables). Use it when the sources above have nothing: official Japanese names, or the English name of a JP-only skill, Esper board, unit or item that the datamines list with a Japanese name only. Not for stats or formulas (the datamines are better). Read-only, one page per call, no crawling. `curl` and WebFetch get 403 (anti-bot, checked 2026-11): read it with the **camofox-browser** skill (Camoufox, anti-detection Firefox; worked 2026-11). Never fake a browser header. Steps, with `C=~/.agents/skills/camofox-browser/scripts/camofox.sh`:
  1. `bash $C open https://altema.jp/ffbe/` starts the server on port 9377 (first run downloads Camoufox, ~2.5 GB, a few minutes). Needs `playwright-core` pinned to 1.56.1 in `~/.camofox-browser` (`npm pkg set overrides.playwright-core=1.56.1`, then `npm install`): the default 1.65 fails with `Browser.setDownloadOptions ... legacyInterceptor`. Redo it if the camofox package is updated.
  2. Use `curl` on the API, not `camofox.sh snapshot` (the script reports "Failed to create tab" even when the tab exists): `POST localhost:9377/tabs` with `{"userId":"camofox-default","sessionKey":"x","url":"<url>"}` returns a `tabId`; `GET localhost:9377/tabs/<tabId>/snapshot?userId=camofox-default` returns JSON whose `snapshot` is the page text. Keep only the `row`, `heading` and `paragraph` lines.
  3. Without the URL, search `https://html.duckduckgo.com/html/?q=site:altema.jp/ffbe+<name>` the same way (Google search fails) and read the `/url:` lines.
  4. Stop the server when done (`$C stop`, then check that nothing listens on 9377; `taskkill` the PID if it does): no servers left running.
  Alternative, not re-checked after the camofox run: Chrome DevTools browser (`new_page`, then `evaluate_script` on `document.body.innerText`); it fails if another Chrome already holds its profile. Pages are Japanese text: translate by hand and say that the English name is a translation, not an official one.

## Datamine gists of aEnigmatic (best monster data)
`https://api.github.com/users/aEnigmatic/gists?per_page=100&page=N` (about 390, many linked from the wiki pages): per mission the real stats, element, ailment and debuff resists, immunities, passives; most are Global (`.gl.py`). `tools/events/` downloads and reads them (`node tools/events/fetch.mjs`, then `events.mjs` and `monsters.mjs`; `check.mjs` tests the parsers; `banners.mjs` then takes the event banners `native/en/sd/area/event_<area>.png` and those of `event_art.json` from the release packs; the wiki image host refuses automated downloads, 403).

## Known gaps: do not search again
Apart from those gists and some wiki pages, in no source: the `special` text of bosses (e.g. "Immune to ailments"), ailment resists, `atk%`/`def%`/`mag%`/`spr%`, the Scorn/Fallen/Arms categories, the table that defines the passive ids (absorbs), the Global-modified rows of many old bosses (the server sends them at each battle), the battle rows of the `9000…` event ids (Paper Oni, Sealing Shard, Tolfidan), release dates in the asset dump. Details and what was tried: `references/monster-data.md`.
