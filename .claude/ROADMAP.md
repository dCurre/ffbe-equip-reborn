# Roadmap — FFBE Equip Reborn

Open work only (bugs, cleanup, features). This file is the source of truth for what is left to do:
when an item is completed, **remove it** (don't leave `[x]` lines). The push skill checks this file
before every commit.

Live site: https://dcurre.github.io/ffbe-equip-reborn/ — deployed by GitHub Actions on every push to
`master` (`.github/workflows/deploy-pages.yml`). The site is **static only** (no server on GitHub
Pages): anything that still calls the Node server is broken online.

## Features broken online (need a serverless replacement)

- [ ] **Shared build links.** The builder posts to `/partyBuild` (server → Firebase Storage) and reads
  links back from Firebase Storage via `window.clientConfig.firebaseBucketUri`. Firebase Storage now
  requires the paid Blaze plan, so it can't stay. Preferred replacement: encode the build in the URL
  itself (compress with the browser's `CompressionStream` + base64url; no backend). Alternative if
  short links are wanted: Supabase used directly from the browser. Decide which, then implement.
- [ ] **Public unit collection links.** Same mechanism as above (`PUT /:server/publicUnitCollection`,
  Firebase Storage `UnitCollections/`, `static/units.js`). Migrate together with shared builds.
- [ ] **Google login + Drive sync.** Today handled by the server (`server/routes/oauth.js`,
  `server/routes/drive.js`, cookie session). Move it to the browser with Google Identity Services and
  the Drive REST API, keeping the same scope (`drive.appfolder` / appdata). Needs an own Google Cloud
  project + OAuth consent screen (check verification requirements for public use). Known trade-off:
  the access token lasts ~1h and must be renewed (sometimes a short popup).
- [ ] **Export to imgur.** Uses `window.clientConfig.imgurClientId` from the server. Drop it, or call
  imgur from the browser with an own client ID.
- [ ] **`/clientConfig` script tag** in `static/builder.html` and `static/units.html` returns 404 on
  GitHub Pages. Remove it (or replace with a static config file) once the features above no longer
  need it.
- [ ] **Process data correction issues**: the Contribute page now opens GitHub issues (label
  `documentation`, title prefix `[Data]`, form `.github/ISSUE_TEMPLATE/data_correction.yml`) with the
  corrections as JSON. They must be applied to `static/<server>/data.json` by hand or with a script (the
  old flow used `tools/GL/applyCorrections.js` / `tools/JP/applyCorrection.js` with a `corrections.json`).
  Open questions on the Contribute page: the item correction tool may not be worth keeping (no GL
  item is `unknown`; JP data is frozen) — decide whether to keep it or leave only bugs/suggestions.
  The results after a search are slow to appear (likely `displayItems` rendering every match at once;
  not measured yet); the "add" action (pencil) is not self-explanatory ("Add to corrections").
- [ ] **Retire the server** once the items above are done: `server.js`, `server/`, `config.js`,
  `.config.json` handling and the related npm dependencies — or keep a minimal static server for local
  development only.

## Bugs / technical debt

- [ ] **Outdated server dependencies** (`npm audit`: ~50 vulnerabilities, deprecated `request`): they
  only run locally (server and data-extraction tools), never on the public site. Most will disappear
  when the server is retired: run the audit again after that and update what remains.
- [ ] **Local Node version**: local development currently runs on Node 15 (end of life since 2021,
  kept for now because other projects on the same machine need it); the deploy uses Node 24 from
  `.node-version`. Upgrade locally when convenient, then raise `engines` in `package.json` (now `>=15`).
- [ ] **Tests** (`npm test`, mocha in `test/`) are all broken: they use CommonJS `require` in an ES
  module project. Do this BEFORE the code quality / build algorithm reviews: rewrite
  `test/static/test.formula.js` (damage/stat formulas — the safety net for refactoring) with a current
  runner (e.g. `node --test`), and delete the server tests (`test/server/`) when the server is retired;
  then drop `mocha`, `nyc`, `supertest`, `nock`, `mock-require`, `webpack-node-externals` and
  `test/webpack.config.js`.

## Code quality and build algorithm

- [ ] **Review code quality**: evaluate splitting the UI into reusable components and removing
  duplicated code. The frontend is plain jQuery with very large files (`static/builder.js` ~5,200
  lines, `static/common.js` ~2,900, `inventory.js` / `unitSearch.js` / `units.js` ~1,700 each) and
  repeated blocks across pages (same header/menu/footer markup in every HTML page, similar
  load/save logic in `units.js` / `inventory.js` / `espers.js`). Start with an analysis of the
  duplication and a proposal (incremental refactor vs a component framework) before changing code.
  Also check for libraries loaded by the pages but no longer used (bootstrap-toggle was loaded by
  `units.html` although unused since 2019).
  Check global functions redefined with the same name as in `static/common.js` (they silently replace
  it on that page): `unselectAll` (encyclopedia.js, unitSearch.js), `prepareSearch` and `sort`
  (inventory.js), `isTwoHanded` (builder/common.js). `filterItems` in contribute.js caused an infinite
  recursion in the search and was renamed; verify each of the others is an intended override.
- [ ] **Review the build algorithm** (the equipment optimizer): correctness, performance and
  readability. Main files: `static/builder/buildOptimizer.js`, `static/builder/typeCombinationGenerator.js`,
  `static/builder/itemPool.js`, `static/builder/optimizerWebWorker.js` (runs in Web Workers),
  `static/formula.js` (damage/stat formulas); `static/algorithm.html` documents the approach.
  Remove leftover debug `console.log` calls (e.g. `buildOptimizer.js:47` logs every enchantment item;
  `espers.js` logs "entering/exiting notLoaded function", `displayEspers` and every skill name).
  Reference timing on a dev PC: `optimize: ~3.2 s` for one unit.

## Ideas (optional)

- [ ] **Raw game data in `tools/*/sources`** (~259 MB) is only needed to re-extract data; the game is
  closed (Global ended Oct 2024, JP data frozen May 2024). Consider removing it from the repo.
