# Rework — Completed Work Reference

Archive of finished migration work. Read only the section for the area you are modifying; never at session start. Open tasks: `REWORK.md`.

## Phase 1–2 facts
- TS core in `src/core/` (128 tests, golden files unchanged); remaining cleanup: types, `noImplicitAny`.
- Angular 22.3 shell in `src/app/`; legacy `.html` routes redirect keeping query strings/fragments.
- Services: `ServerContext` (`?server`, `?l`), `Theme` (legacy `data-theme` + localStorage key), `StaticData` (fetch/cache/loading notice), `GoogleDrive`, `UserData`, `LinkStore` (Worker).
- `src/styles.css`: light/dark tokens from the legacy styles. CSP in `src/index.html`; no CDN/FontAwesome.
- `angular.json` copies `static/GL`, `static/JP` JSON, `static/img`, `static/css-img` as assets; keep them in `static/` until the old pages are removed.
- Deploy: build, copy `index.html` to `404.html`, publish `dist/ffbe-equip-reborn/browser` under `/ffbe-equip-reborn/`. Optimizer Worker bundling verified (85 kB).
- Header banner/mobile menu simplified. `noFallthroughCasesInSwitch` is off because of four suspicious switches in `tree-comparator.ts` (`shortcut:` in `tsconfig.json`).

## Layout and static pages
Done and compared with the legacy site: `homepage`, `contribute`, `algorithm`, `builderHelp`, `privacy`.
- `src/app/layout/`: `site-header`, `site-footer`, `PageContent`/`PageColumn` (footer goes inside each page).
- Templates generated from legacy HTML; escape braces as `&#123;`.
- Shared components: Button (`button[app-button]`), Icon (custom SVG paths), Panel (heading slot), Alert, Modal, Toasts.
- Routes may set `data.theme: 'light'` without persisting it (`algorithm`, `builderHelp`).

## Espers
Migrated; browser comparison still pending.
- `features/espers/`: `esper-model.ts` (tested SP, stats, node toggling, link encode/decode), `node-view.ts`, `espers.ts/html/css`.
- Shared: `sprites.ts` (on-demand sprite CSS), toasts, `page-chrome.ts` (hides header on `#link` pages), resist/killer lists.
- Differences to confirm: initial sort arrow; resist/killer sorting counts entries (legacy was wrong); levels above max are clamped, not thrown; wiki links use `exvius.fandom.com`; connectors are measured SVG instead of `jquery.line`; share URL `.../espers?server=GL&o#Name|r|l|hex`.
- Browser checks: tabs, sorting, rarity/level, node click/reset/hover, connectors per rarity, mobile grid, share/import dialogs, login/demo/link modes, Drive save timing, `beforeunload`, dark colors.

## Units, encyclopedia, inventory, unit search
Migrated; some browser checks pending.
- `features/units`, `encyclopedia`, `inventory`, `unit-search`; tested `*-model.ts` logic; long lists render progressively with `IntersectionObserver`.
- Shared: `Inventory` (loads items/units/consumables once, migrates old unit-file versions, saves after 3s, exposes counts), export/download helper, CSS Custom Highlight API, wiki helper/link, `ChoiceGroup`.
- `App` loads inventory unless `?o` is present; server/language changes reload the page, as before.
- Differences to confirm: header item count excludes `visionCardsLevels` (legacy was +1 too high); New Units count 581 vs legacy 585 on identical data (+4 unexplained); removing the last enhancement restores the plain item (legacy used the wrong ID).

## Restructure `src/app`
Convention: one folder per component with `.ts`/`.html`/`.css`; logic used by one feature lives in that feature's `shared/` (e.g. `features/builder/shared/`).
- `features/builder/`: one folder per component, logic in `shared/`; `unit-panel`, `build-result` and `options-panel` split into sub-components.
- Extracted from `units` (`unit-edit-modal`, `unit-stmr-modal`, `unit-awaken-modal`, cards `unit-card`, `unit-collection-stats`), `inventory` (`inventory-card`, `inventory-enhancement-modal`) and `espers` (`esper-tabs`, `esper-table`, `esper-header`, `esper-grid` with the training board and its scroll/line logic).
- Unit search results are real components (`unit-result`, `unit-skill`, `unit-effect`, `unit-limit-burst` and small ones); `unit-search-html.ts` and `game/item-html.ts` removed, no `innerHTML` left.
- `shared/` split into `services/` (injectables), `helpers/` (pure functions), `state/` (`ShareLinkState`, `ImportState`) and `components/`; `game/` split into `models/`, `helpers/` and `components/`; layout components (`page-column`, `page-content`, `page-placeholder`) in their own folders.
- Duplicated code removed in `src/` (jscpd: 0.68% → 0.09%): helpers in `damage-calculation`, `stat-calculation`, `type-combination-generator`, `build-optimizer`, `tree-comparator`, `formula`, `unit-search-model`, `esper-model`; shared `app-credits` component. Left on purpose: import lists, the `limit`/`visible` paging pattern, one loop header in `unit-search-model`, and the selected-button CSS (a global class loses to component styles).
