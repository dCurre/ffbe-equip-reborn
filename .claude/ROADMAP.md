# Roadmap — FFBE Equip Reborn

Open work only (bugs, cleanup, features). This file is the source of truth for what is left to do:
when an item is completed, **remove it** (don't leave `[x]` lines). The push skill checks this file
before every commit.

Live site: https://dcurre.github.io/ffbe-equip-reborn/ — deployed by GitHub Actions on every push to
`master` (`.github/workflows/deploy-pages.yml`). The site is **static only** (no server on GitHub
Pages): anything that still calls the Node server is broken online.

## Features broken online (need a serverless replacement)

- [ ] **Google login: publish the app.** Login + Drive now run in the browser (`static/googleDrive.js`,
  Google Identity Services token model, scope `drive.appdata`, Google Cloud project of dCurre). The
  OAuth consent screen is in **Testing** mode: only the listed test users can log in. When the flow is
  verified, publish it ("In production") so anyone can log in (`drive.appdata` is a non-sensitive scope:
  no security audit needed). Publishing requires the Branding page: home page
  `https://dcurre.github.io/ffbe-equip-reborn/`, privacy policy
  `https://dcurre.github.io/ffbe-equip-reborn/privacy.html` (`static/privacy.html`), authorized domain
  `dcurre.github.io`; no logo (it would trigger brand verification). Optional: a separate OAuth client for development (origins
  `localhost:3000/4000` only) so the production client only authorizes `https://dcurre.github.io`.
  Known limits: the token lasts ~1h (then the user logs in again); data saved by FFBE Equip Next lives
  in the old project's app folder and can't be read by the new client (users start fresh).
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
  development only. The server login/Drive routes (`server/routes/oauth.js`, `drive.js`,
  `server/lib/oauth.js`, `drive.js`) are no longer called by the site.

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

## Last: shared links (decided to do after everything else)

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

## Ideas (optional)

- [ ] **Raw game data in `tools/*/sources`** (~259 MB) is only needed to re-extract data; the game is
  closed (Global ended Oct 2024, JP data frozen May 2024). Consider removing it from the repo.
