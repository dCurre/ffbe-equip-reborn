# Site Rework (branch `angular_migration`)

Committed and pushed on this branch.

## Status
Phases 1 (TS core), 2 (Angular shell) and 3 (pages) done in code; `src/app` restructuring done; old pages removed and data/images moved to `public/`. `ng build` passes, `ng test` 105 passing, `npm test` 137. TypeScript `~6.0.x`; Prettier: 2 spaces, single quotes, width 120. Ask the owner only when something is ambiguous.

## Known differences from the old site (keep or fix in the check)
- Espers: resist/killer sorting counts entries (the old one was wrong); levels above max are clamped, not thrown; wiki links use `exvius.fandom.com`; connectors are measured SVG instead of `jquery.line`; share URL `.../espers?server=GL&o#Name|r|l|hex`.
- Builder: negative goal resists are ignored (as in the old site); Export for Battle and the Holiday Hero message were removed on purpose.
- `noFallthroughCasesInSwitch` is off because of four suspicious switches in `tree-comparator.ts` (`shortcut:` in `tsconfig.json`).

## Final checks
- Compare all pages with the old site (code: `git show 0e9eee65d:static/<file>`); verify dialogs, inventory, units, light theme, Drive loading.
- Present remaining differences to the owner.

**Next:** section-by-section check with the owner (compare with the old site, fix differences).
