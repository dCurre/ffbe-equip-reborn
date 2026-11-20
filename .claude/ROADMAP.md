# Roadmap — FFBE Equip Reborn

Open work only (bugs, cleanup, features). This file is the source of truth for what is left to do:
when an item is completed, **remove it** (don't leave `[x]` lines). The push skill checks this file
before every commit.

Live site: https://dcurre.github.io/ffbe-equip-reborn/ — deployed by GitHub Actions on every push to
`master` (`.github/workflows/deploy-pages.yml`). The site is **static only** (no server on GitHub
Pages): anything that still calls the Node server is broken online.

## Features broken online (need a serverless replacement)

- [ ] **`/clientConfig` script tag** in `static/builder.html` and `static/units.html` returns 404 (the server
  is gone). Remove it once imgur export and shared links ("Last" section) no longer need it.

## Bugs / technical debt

- [ ] **Outdated dependencies**: `npm audit` reports 1 high issue in `image-size` (DoS in the ICNS parser),
  used only by the data-extraction tools, which never run on the public site and **stay** (decided: do not
  delete them). Fix with `npm audit fix --force` (image-size 2.x, breaking) only if those tools are run again.
  Their image servers `diffs.exvius.gg` and `diffs.exviusdb.com` no longer respond (checked 2026-11-20):
  `tools/buildImageLinks` and `tools/JP/getImages.js` are unusable and the image `download` step of
  `GL|JP/parseItems.js` fails; the JSON data from GitHub (`aEnigmatic/ffbe`, `ffbe-jp`, `ffbe-gl-strings`) still
  downloads fine. The tools now use `tools/request.js` (a `fetch` shim, output verified identical to `request`).
- [ ] **Tests**: `npm test` runs `node --test "test/static/*.js"` (35 tests, ~2 s): formula parsing, stats and
  damage with hand-computed values (`test.stats.js`, `test.damage.js`) and a golden master of the
  calculations on the real GL data (`test.golden.js`: all 1,653 units; `npm run test:golden:update`
  regenerates `test/static/golden/calc.json` when a change is intended). `npm run test:coverage` prints
  the coverage of `formula.js` (46.9%) and `builder/common.js` (45.3%). Still uncovered:
  `calculateMonsterDamage`, `areConditionOK`, `findBestItemVersion`, `combineTwoItems`,
  `applyEnhancements`, `getEsperStatBonus`, `chainMastery`, `formulaFromEffect`, the formula conditions,
  and the optimizer (`buildOptimizer.js`, `itemPool.js`, `typeCombinationGenerator.js`: a golden master
  needs the data prepared by `builder.js`, which is bound to the DOM). Add these before reviewing the
  build algorithm or splitting `builder.js`.

## Code quality and build algorithm

- [ ] **Review code quality** (what is left). Done: unused scripts/libraries and debug `console.log`
  removed, globals shadowing `common.js` renamed (`inventory.js`) or simplified (`unselectAll`),
  header/menu/footer shared in `static/layout.js`, JSON import shared (`readJsonFile` in `common.js`).
  Left:
  - Very large files: `static/builder.js` ~5,200 lines (161 global functions), `common.js` ~2,750,
    `builder/common.js` ~2,200, `inventory.js` / `unitSearch.js` / `units.js` ~1,700 each. The scripts are
    classic (no ES modules) and the HTML uses `onclick="fn()"`, so functions must stay global unless the
    handlers are migrated. Split only after the tests above exist.
  - `isTwoHanded` is defined in both `common.js` and `builder/common.js` on purpose (the optimizer Web
    Worker loads only `builder/common.js`); `unselectAll` in `common.js` has another signature than the
    ones in `unitSearch.js` / `encyclopedia.js`.
  - Idea, not decided: migrate to Angular in a separate branch, page by page, once the base is clean. It
    would not make the site faster by itself: measure where it is slow first (builder, units, inventory)
    and fix the hot spots. It needs Node >= 20 (local is 24) and a GitHub Pages setup (`--base-href`,
    hash routes or a `404.html` fallback, CSP meta tag).
- [ ] **Review the build algorithm** (the equipment optimizer): correctness, performance and
  readability. Main files: `static/builder/buildOptimizer.js`, `static/builder/typeCombinationGenerator.js`,
  `static/builder/itemPool.js`, `static/builder/optimizerWebWorker.js` (runs in Web Workers),
  `static/formula.js` (damage/stat formulas); `static/algorithm.html` documents the approach.
  Found while writing the tests (`static/builder/common.js`): the final `Math.floor` in
  `calculateStatValue` is assigned to `calculatedValue`, which is never used afterwards, so the total of
  the non-ATK stats is not rounded; `var chainMult; chainMult += ...` in `innerCalculateBuildValueWithFormula`
  is `NaN` and never used (dead code).
  The golden master (`npm test`, test.golden.js) also found 144 unit skills (432 values over 3 scenarios)
  whose damage is `NaN`: mostly `damage` effects with mechanism `none` and sums of such effects, plus a few
  physical ones. Check if they are skills the builder never offers as goal or a real defect.
  Reference timing on a dev PC: `optimize: ~3.2 s` for one unit.

## Last: imgur and shared links (decided to do after everything else)

- [ ] **Export to imgur.** Uses `window.clientConfig.imgurClientId` from the server. Drop it, or call
  imgur from the browser with an own client ID.
- [ ] **Shared build links.** The builder posts to `/partyBuild` (server → Firebase Storage) and reads
  links back from Firebase Storage via `window.clientConfig.firebaseBucketUri`. Firebase Storage now
  requires the paid Blaze plan, so it can't stay. Plan: encode the build in the URL itself, compressed
  (`CompressionStream` deflate + base64url), no backend.
  - The builder can already READ a build from the URL (`readStateHashData` / `shortLinkFormatToData`
    in `static/builder.js`, the 2018 `shortLink` format), but nothing creates such links anymore.
  - Don't put the full `getStateHash()` state in the link: it repeats item names, icons, stats and the
    whole esper object. Estimated link length (2026-11-19, real GL data, distinct units/items):
    full state compressed ≈ 1,300 chars (1 unit), 2,700 (5), 4,400 (10) — over Discord's 2,000-char
    message limit from ~5 units. A compact format with only ids + goal, pots, enchantments, pinned
    flags and non-default monster settings, compressed: ≈ 270 / 500 / 770 chars. Item ids are stable
    because the game data is frozen, so links won't break.
  - Before implementing, verify how `loadStateHashAndBuild` rebuilds a build from ids. Old short links
    of FFBE Equip Next (Firebase ids) can't be recovered.
- [ ] **Public unit collection links.** Same mechanism (`PUT /:server/publicUnitCollection`, Firebase
  Storage `UnitCollections/`, `static/units.js`). Migrate together with shared builds. Currently disabled
  by an early `return` at the top of `savePublicLink()` in `static/units.js` (it was called 10 s after
  every change and always failed with a 404); remove it when migrating.
