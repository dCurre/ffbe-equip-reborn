# Site Rework (branch `angular_migration`)

Nothing committed yet; one descriptive commit at the end (ROADMAP included). Completed-work details: `REWORK-reference.md` (read only the relevant section, never at start).

## Status
Phases 1 (TS core) and 2 (Angular shell) done; phase 3 (pages) migrated, builder incomplete. `ng build` passes, `ng test` 98 passing. TypeScript `~6.0.x`; Prettier: 2 spaces, single quotes, width 120. Ask the owner only when something is ambiguous.

## Priority: restructure `src/app`
Run `ng build` + `ng test` after every step.
Completed restructuring: see `REWORK-reference.md`.
Checked on screen by the owner (look/aesthetics postponed): builder, units, inventory, espers. Not checked yet: unit search results (new components; killers now one line per kind) and the Esper board / table / tabs after the CSS split (phone view of the board, small-screen rules).
1. Big files in `src/core` (`constants`, `damage-calculation`, `formula`, `data-storage`) only if touched often.

## Builder — remaining
1. Verify Monster panel. 2. Restore reduce-overcap-for-stat and Damage variance. 3. Compare goal panel, form, results, Parameter Challenges with old site. 4. Brave Shift. 5. Saved Teams (Google Drive). 6. Image export, Export for Battle. 7. Complete Parameter Challenges. 8. Owned Esper management, URL Esper loading.

## Final checks
- Compare all pages with old site; verify dialogs, inventory, units, light theme, Drive loading.
- Remove old pages; move data/images out of `static/`.
- Present remaining differences to the owner.

**Next:** finish restructuring `src/app`, then builder.
