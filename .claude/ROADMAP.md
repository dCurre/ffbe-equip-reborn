# Roadmap — FFBE Equip Reborn

Open work only (bugs, cleanup, features). This file is the source of truth for what is left to do:
when an item is completed, **remove it** (don't leave `[x]` lines). The push skill checks this file
before every commit.

Live site: https://dcurre.github.io/ffbe-equip-reborn/ — deployed by GitHub Actions on every push to
`master` (`.github/workflows/deploy-pages.yml`). The site is **static only** (no server on GitHub
Pages): anything that still calls the Node server is broken online.

## Bugs / technical debt

- [ ] **Outdated dependencies**: `npm audit` reports 1 high issue in `image-size` (DoS in the ICNS parser),
  used only by the data-extraction tools, which never run on the public site and **stay** (decided: do not
  delete them). Fix with `npm audit fix --force` (image-size 2.x, breaking) only if those tools are run again.
  Their image servers `diffs.exvius.gg` and `diffs.exviusdb.com` no longer respond (checked 2026-11-20):
  `tools/buildImageLinks` and `tools/JP/getImages.js` are unusable and the image `download` step of
  `GL|JP/parseItems.js` fails; the JSON data from GitHub (`aEnigmatic/ffbe`, `ffbe-jp`, `ffbe-gl-strings`) still
  downloads fine. The tools now use `tools/request.js` (a `fetch` shim, output verified identical to `request`).
- [ ] **Tests**: `npm test` runs `node --test "test/static/*.js"` (126 tests, ~8 s): formula parsing, stats and
  damage with hand-computed values (`test.stats.js`, `test.damage.js`), a golden master of the
  calculations on the real GL data (`test.golden.js`: all 1,653 units) and the optimizer: `test.optimizer.js`
  (invariants on the first 12 type combinations) and `test.optimizerGolden.js` (full search, best build and value of
  3 units, item pool reduced to the best 80 per type: ~1 s per unit; the unreduced search takes over 10 minutes in one
  thread). The optimizer runs without builder.js through `helpers/optimizerEnv.js` / `optimizerRun.js`.
  `npm run test:golden:update` regenerates `calc.json` and `optimizer.json` when a change is intended.
  `npm run test:coverage` prints the coverage of `formula.js` and `builder/common.js`. Still uncovered:
  `computeFarmableStmr` and `getItemEntry` with an inventory, and the owned-only / esper / forced-TMR / force-doublehand
  optimizer paths. The golden pool is reduced, so it does not prove the full search finds the global best.

## Code quality and build algorithm

- [ ] **Site rework (to design, next topic).** Nothing decided yet. To settle first: the goal (speed, look,
  maintainability), the scope (all pages or one first: builder, units, inventory) and the technology (clean up
  the classic scripts, or a framework such as Angular: see the idea below). Measure where the site is slow
  before choosing. Constraints: static site on GitHub Pages, no backend (only the link store Worker in `worker/`). The
  tests (`npm test`, golden master included) are the safety net: extend them before splitting `builder.js`.
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
  The golden master found 144 unit skills whose damage was `NaN` (the builder offered them as goal): most
  have attack type "None" in the game data, the wiki's **Fixed** attack type (Mug, Covering Fire...). Fixed:
  `formulaFromEffect` (`formula.js`) now computes them with the stat of their damage type (hybrid if missing),
  ignoring killers, dual wield and weapon elements (`fixedAttack`, wiki "Mechanics", "Damage Types"), and no
  longer offers the effects on SELF/ALLY (HP cost, token damage for buffs) as goal. Still open:
  - 15 values (5 skills, e.g. Energy Shot 1380140) are still `NaN`: physical damage with `mpCoef` and no `coef`.
  - To verify in game: the wiki lists the delayed-damage skills (Covering Fire, Missile Shelter, Spiteful
    Blade) as plain Physical, not Fixed, but the game data says "None" for all, so they are treated as Fixed
    (no killers, no dual wield). Also unknown: whether the weapon/final variance applies to Fixed attacks
    (kept applied). Test: use the skill twice on an enemy with a known killer or resistance.
  - The wiki is hand written and inconsistent (Hallowed Song); read it with the `exvius-wiki` skill.
  Future check: `calculateStatValue` now rounds down the total of the non-ATK stats (it did not before,
  the `Math.floor` result was discarded). The change is deduced from the code, not compared with the game:
  verify it against an offline FFBE repo or known in-game values (golden master regenerated, up to -0.42%).
  Reference timing on a dev PC: `optimize: ~3.2 s` for one unit.

## New features (after the site rework)

- [ ] **Builder unit filters**, in the same place as the existing "Only Nv Units" option:
  1. filter to owned units only;
  2. filter to NVA+ units only.
