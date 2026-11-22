# Roadmap — FFBE Equip Reborn

Open tasks only (delete done items). The `push` skill updates this file. Deploy: push to `master` → GitHub Pages (static only).

## Bugs and technical debt
- **Persistent login (works locally, Worker deployed):** after the push, try login, renewal and logout on `https://dcurre.github.io` (its origin must be authorized in Google Cloud). Old logged-in users must log in once. If Google returns no refresh token (409), the user removes the app at myaccount.google.com/permissions and retries. Optional: rotate the Google client secret (shown once in a session transcript) with `npx wrangler secret put GOOGLE_CLIENT_SECRET` in `worker/`.
- **Extraction tools:** `diffs.exvius.gg`/`diffs.exviusdb.com` are down (2026-11-20): `tools/buildImageLinks`, `tools/JP/getImages.js` and image downloads in `GL|JP/parseItems.js` fail; JSON downloads work. `tools/request.js` is a `fetch` shim.
- **Test coverage:** `npm test` covers formulas, stats/damage, GL golden master, optimizer invariants and reduced-pool goldens. Regenerate goldens only with `npm run test:golden:update`. Gaps: `computeFarmableStmr`, `getItemEntry` with inventory, optimizer owned-only/esper/forced-TMR paths. Reduced-pool goldens don't prove global optimality.

## Code quality and optimizer
- **Angular migration check:** compare each page with the old site (`git show 0e9eee65d:static/<file>`), fix differences. Intended differences: negative goal resists ignored; no Export for Battle; `noFallthroughCasesInSwitch` off (`tree-comparator.ts`). Mark what to fix, delete what is fine:
  - Pages: Builder, Encyclopedia, Unit Search, Inventory
  - Cross-page: dialogs, light theme, Drive loading
- **Optimizer review** (correctness, performance, readability; main files `buildOptimizer`, `typeCombinationGenerator`, `itemPool`, `optimizerWebWorker`, `formula`; algorithm in the Algorithm page). Open points:
  - 15 `NaN` values across 5 skills (e.g. Energy Shot 1380140): physical damage uses `mpCoef` without `coef`.
  - Delayed-damage skills (Covering Fire, Missile Shelter, Spiteful Blade): wiki says Physical, game data says `None`. Also verify weapon/final variance on Fixed attacks (currently applied); use `exvius-wiki`.
  - `calculateStatValue` now floors non-ATK stats; inferred from code, not confirmed in-game.
- **Icon tooltips:** the titles in `shared/components/icon/icon-map.ts` are drafts (e.g. access, slots, ailments): check the wording; the encyclopedia choice tooltips (`encyclopedia.ts`) could now come from that table.

## Features (after the rework)
- **Builder unit filters:** owned-only and NVA+ only beside "Only Nv Units".
- **Community app import:** extend manual JSON import (`readJsonFile`) to offline community exports (e.g. Elvlin's); research formats, validate, show imported data.
