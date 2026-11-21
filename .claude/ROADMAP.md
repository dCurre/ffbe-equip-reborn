# Roadmap — FFBE Equip Reborn

Open tasks only (delete done items). The `push` skill updates this file. Deploy: push to `master` → GitHub Pages (static only).

## Bugs and technical debt
- **image-size vulnerability:** high-severity DoS, used only by the retained extraction tools. Run `npm audit fix --force` (breaking, 2.x) only if they're reused. `diffs.exvius.gg`/`diffs.exviusdb.com` are down (2026-11-20): `tools/buildImageLinks`, `tools/JP/getImages.js` and image downloads in `GL|JP/parseItems.js` fail; JSON downloads work. `tools/request.js` is a `fetch` shim.
- **Test coverage:** `npm test` (~9s) covers formulas, stats/damage, GL golden master, optimizer invariants and reduced-pool goldens. Regenerate goldens only with `npm run test:golden:update`. Gaps: `computeFarmableStmr`, `getItemEntry` with inventory, optimizer owned-only/esper/forced-TMR paths. Reduced-pool goldens don't prove global optimality.

## Code quality and optimizer
- **Site rework:** finish the Angular migration per `.claude/REWORK.md`.
- **Code quality review:** large legacy files remain in `static/` (`builder.js` ~5,200 lines, `common.js`, `builder/common.js`, `inventory.js`, `unitSearch.js`, `units.js`); they disappear with the migration. Keep intentional differences: `isTwoHanded` is duplicated (the optimizer Worker loads only `builder/common.js`); `unselectAll` signatures differ across pages.
- **Optimizer review** (correctness, performance, readability; main files `buildOptimizer`, `typeCombinationGenerator`, `itemPool`, `optimizerWebWorker`, `formula`; algorithm in `static/algorithm.html`). Open points:
  - 15 `NaN` values across 5 skills (e.g. Energy Shot 1380140): physical damage uses `mpCoef` without `coef`.
  - Delayed-damage skills (Covering Fire, Missile Shelter, Spiteful Blade): wiki says Physical, game data says `None`. Also verify weapon/final variance on Fixed attacks (currently applied); use `exvius-wiki`.
  - `calculateStatValue` now floors non-ATK stats; inferred from code, not confirmed in-game.
  - Performance baseline: ~3.2s/unit.

## Features (after the rework)
- **Builder unit filters:** owned-only and NVA+ only beside "Only Nv Units".
- **Community app import:** extend manual JSON import (`readJsonFile`) to offline community exports (e.g. Elvlin's); research formats, validate, show imported data.
