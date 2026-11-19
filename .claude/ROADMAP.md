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
- [ ] **Contribute page** (`static/contribute.html`, `POST /:server/corrections`) can't save anything
  without a server. Replace with a link to (prefilled) GitHub issues on this repo, or remove the page.
- [ ] **Retire the server** once the items above are done: `server.js`, `server/`, `config.js`,
  `.config.json` handling and the related npm dependencies — or keep a minimal static server for local
  development only.

## Bugs / technical debt

- [ ] **bootstrap-toggle 2.2.2** (on/off switches, e.g. Units page) is unmaintained and loaded from
  `gitcdn.github.io`, a third-party proxy that may disappear. Vendor it into `static/lib/` or replace it.
  Also consider select2 4.0.5 → 4.0.13 (bug fixes, same major).
- [ ] **Outdated dependencies**: `npm audit`, deprecated `request`, `engines: ">=8"` is wrong; move
  local development to a current Node LTS (CI already uses Node 20).
- [ ] **Security headers**: GitHub Pages can't set HTTP headers, so the CSP from `server.js` is not
  applied online. Add a `<meta http-equiv="Content-Security-Policy">` to the pages if wanted.
- [ ] **Browser cache of data files** (`staticFileCache` in `static/common.js`) stores big JSON
  uncompressed in `localStorage` (~5 MB quota; large files just get re-downloaded). Consider IndexedDB
  or dropping the cache. Symptom: `QuotaExceededError` warnings in the console when saving
  `GL/visionCards.json`, `GL/unitsWithPassives.json` (handled, not breaking). Also fix the log line
  "Retrieved … (undefined bytes)" in `staticFileCache.retrieve` (logs `.length` of a parsed object).
- [ ] **Tests** (`npm test`, mocha in `test/`): status unknown after the changes; check and fix or
  prune tests for removed routes.

## Code quality and build algorithm

- [ ] **Review code quality**: evaluate splitting the UI into reusable components and removing
  duplicated code. The frontend is plain jQuery with very large files (`static/builder.js` ~5,200
  lines, `static/common.js` ~2,900, `inventory.js` / `unitSearch.js` / `units.js` ~1,700 each) and
  repeated blocks across pages (same header/menu/footer markup in every HTML page, similar
  load/save logic in `units.js` / `inventory.js` / `espers.js`). Start with an analysis of the
  duplication and a proposal (incremental refactor vs a component framework) before changing code.
- [ ] **Review the build algorithm** (the equipment optimizer): correctness, performance and
  readability. Main files: `static/builder/buildOptimizer.js`, `static/builder/typeCombinationGenerator.js`,
  `static/builder/itemPool.js`, `static/builder/optimizerWebWorker.js` (runs in Web Workers),
  `static/formula.js` (damage/stat formulas); `static/algorithm.html` documents the approach.
  Remove leftover debug `console.log` calls (e.g. `buildOptimizer.js:47` logs every enchantment item).
  Reference timing on a dev PC: `optimize: ~3.2 s` for one unit.

## Ideas (optional)

- [ ] **Offline Windows app** (Tauri) built from the same static site, once the serverless migration
  is done.
- [ ] **Raw game data in `tools/*/sources`** (~259 MB) is only needed to re-extract data; the game is
  closed (Global ended Oct 2024, JP data frozen May 2024). Consider removing it from the repo.
